"""Mirror alarm-stream quotes and evaluate personal app alarms on native ticks."""
from datetime import datetime, timezone
import json
import logging
import math
import os
import threading
import time
import urllib.error
import urllib.request

from .alert_state import locked_state
from .storage import write_json

LOG = logging.getLogger(__name__)


def iso(milliseconds):
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc).isoformat()


def timestamp(value):
    return int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)


class AppStore:
    def request(self, table, query='', *, method='GET', data=None, prefer='return=representation'):
        base = os.environ.get('SUPABASE_URL', '').rstrip('/')
        key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        if not base.startswith('https://') or not key:
            raise RuntimeError('Supabase app bridge is not configured')
        request = urllib.request.Request(base + '/rest/v1/' + table + ('?' + query if query else ''),
            method=method, data=json.dumps(data).encode() if data is not None else None,
            headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                     'Content-Type': 'application/json', 'Prefer': prefer})
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                raw = response.read()
                return json.loads(raw) if raw else []
        except urllib.error.HTTPError as error:
            # Never log auth headers, installation identities or push tokens.
            raise RuntimeError('App storage returned HTTP ' + str(error.code)) from None

    def rules(self):
        return self.request('market_price_alerts', 'status=eq.active&select=id,symbol,crossing,price,created_at&limit=1000')

    def quotes(self, values):
        return self.request('market_live_prices', 'on_conflict=symbol', method='POST', data=values,
                            prefer='resolution=merge-duplicates,return=minimal')

    def claim(self, identity, event):
        rows = self.request('market_price_alerts', 'id=eq.' + identity + '&status=eq.active', method='PATCH',
            data={'status': 'triggered', 'triggered_at': iso(event['tradedAt']), 'triggered_price': event['price']})
        if not rows:
            rows = self.request('market_price_alerts', 'id=eq.' + identity + '&select=*')
        return rows[0] if rows else None

    def acknowledge(self, identity):
        self.request('market_price_alerts', 'id=eq.' + identity + '&status=eq.triggered', method='PATCH',
            data={'notified_at': datetime.now(timezone.utc).isoformat()}, prefer='return=minimal')


class PriceAlertBridge:
    def __init__(self, root, store=None, sender=None):
        self.root = root
        self.store = store or AppStore()
        self.sender = sender
        self.lock = threading.Lock()
        self.latest = {}
        self.rules = []
        self.matched = set()
        self.error = None

    def observe(self, symbol, price, traded_at, sequence, *, recovered=False):
        if not math.isfinite(price) or price <= 0:
            return
        with self.lock:
            self.latest[symbol] = {'symbol': symbol, 'price': price, 'traded_at': iso(traded_at),
                                   'received_at': iso(int(time.time() * 1000)), 'trade_id': sequence}
            for rule in self.rules:
                identity = rule['id']
                if identity in self.matched or rule['symbol'] != symbol or traded_at < timestamp(rule['created_at']):
                    continue
                target = float(rule['price'])
                if not (price >= target if rule['crossing'] == 'above' else price <= target):
                    continue
                with locked_state(self.root) as state:
                    outbox = state.setdefault('appPriceOutbox', {})
                    if identity not in outbox:
                        outbox[identity] = {'symbol': symbol, 'price': price, 'tradedAt': traded_at,
                                            'recovered': recovered}
                self.matched.add(identity)

    def sync_quotes(self):
        with self.lock:
            values = list(self.latest.values())
        if values:
            self.store.quotes(values)

    def reload_rules(self):
        rules = self.store.rules()
        with self.lock:
            self.rules = rules
            self.matched.intersection_update(rule['id'] for rule in rules)

    def deliver(self):
        with locked_state(self.root) as state:
            pending = list(state.get('appPriceOutbox', {}).items())
        failed = False
        for identity, event in pending:
            try:
                self.deliver_one(identity, event)
            except Exception:
                failed = True
        if failed:
            raise RuntimeError('Some personal alarm destinations remain pending')

    def deliver_one(self, identity, event):
        from .app_push import send_push
        sender = self.sender or (lambda data, token: send_push(self.root, data, token=token))
        row = self.store.claim(identity, event)
        if not row or row['status'] != 'triggered' or row.get('notified_at'):
            self.remove(identity)
            return
        # A cancelled rule never produces a notification. Replays of our own
        # claimed event are safe after restart; a different claim isn't ours.
        if timestamp(row['triggered_at']) != event['tradedAt']:
            self.remove(identity)
            return
        if row.get('push_token') and not event.get('pushSent'):
            relation = 'erreicht oder überschritten' if row['crossing'] == 'above' else 'erreicht oder unterschritten'
            data = {'kind': 'personal_price', 'eventId': identity, 'symbol': row['symbol'],
                'title': row['symbol'].replace('USDT', '') + ' · PREISALARM',
                'body': f"{row['price']} USDT {relation}. Live-Kurs: {event['price']} USDT.",
                'price': str(row['price']), 'currentPrice': str(event['price']),
                'direction': row['crossing'], 'sentAt': str(event['tradedAt'])}
            if event.get('recovered'):
                data['body'] += ' Kontakt nach Verbindungsunterbrechung nachgeladen.'
            sender(data, row['push_token'])
            with locked_state(self.root) as state:
                state['appPriceOutbox'][identity]['pushSent'] = True
        self.store.acknowledge(identity)
        self.remove(identity)

    def remove(self, identity):
        with locked_state(self.root) as state:
            state.setdefault('appPriceOutbox', {}).pop(identity, None)

    def run(self):
        # Quotes/rule propagation has its own worker, so network/FCM delays can
        # never stop tick evaluation in the main stream consumer.
        def delivery_loop():
            while True:
                try:
                    self.deliver()
                except Exception:
                    LOG.error('Personal alarm delivery failed; durable outbox retained')
                    time.sleep(5)
                time.sleep(.25)
        threading.Thread(target=delivery_loop, daemon=True, name='app-alarm-delivery').start()
        while True:
            try:
                self.reload_rules()
                self.sync_quotes()
                self.error = None
            except Exception as error:
                self.error = str(error)
                LOG.error('Live app synchronization failed: %s', type(error).__name__)
            with self.lock:
                count = len(self.rules)
            write_json(self.root / 'reports/live-alerts/app-health.json', {
                'updatedAt': int(time.time() * 1000), 'status': 'connected' if self.error is None else 'retrying',
                'activePersonalAlarms': count, 'error': self.error,
            })
            time.sleep(1)
