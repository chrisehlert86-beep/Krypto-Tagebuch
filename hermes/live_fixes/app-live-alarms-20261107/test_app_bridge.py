import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from macro_waves.app_alarm_bridge import PriceAlertBridge, iso
from macro_waves.alert_state import locked_state


class FakeStore:
    def __init__(self):
        self.row = {'id': 'alarm-test', 'symbol': 'BTCUSDT', 'crossing': 'above', 'price': 110,
                    'created_at': iso(1000), 'status': 'active', 'notified_at': None, 'push_token': 'fake-device'}
        self.published = []
    def rules(self): return [dict(self.row)] if self.row['status'] == 'active' else []
    def quotes(self, values): self.published = values
    def claim(self, identity, event):
        if self.row['status'] == 'active': self.row.update(status='triggered', triggered_at=iso(event['tradedAt']))
        return dict(self.row)
    def acknowledge(self, identity): self.row['notified_at'] = iso(3000)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.store = FakeStore()
        self.sent = []
        self.bridge = PriceAlertBridge(self.root, self.store, lambda data, token: self.sent.append((data, token)))
        self.bridge.reload_rules()
    def tearDown(self): self.directory.cleanup()
    def test_native_tick_is_forwarded_unchanged_to_app(self):
        self.bridge.observe('BTCUSDT', 100.123, 2000, 7)
        self.bridge.sync_quotes()
        self.assertEqual(self.store.published[0]['price'], 100.123)
        self.assertEqual(self.store.published[0]['traded_at'], iso(2000))
        self.assertEqual(self.store.published[0]['trade_id'], 7)
    def test_manual_alarm_without_ai_plan_is_targeted_once(self):
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        self.bridge.observe('BTCUSDT', 120, 2001, 8)
        self.bridge.deliver(); self.bridge.deliver()
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.sent[0][1], 'fake-device')
        self.assertEqual(self.sent[0][0]['kind'], 'personal_price')
        self.assertEqual(self.store.row['status'], 'triggered')
    def test_cancelled_alarm_never_delivers(self):
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        self.store.row['status'] = 'cancelled'
        self.bridge.deliver()
        self.assertEqual(self.sent, [])
    def test_temporary_touch_survives_process_restart(self):
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        fresh = PriceAlertBridge(self.root, self.store, lambda data, token: self.sent.append((data, token)))
        fresh.observe('BTCUSDT', 100, 2001, 8)
        fresh.deliver()
        self.assertEqual(len(self.sent), 1)
    def test_pre_creation_trade_cannot_trigger(self):
        self.bridge.observe('BTCUSDT', 110, 999, 7)
        self.bridge.deliver()
        self.assertEqual(self.sent, [])
    def test_below_condition(self):
        self.store.row.update(crossing='below', price=90)
        self.bridge.reload_rules()
        self.bridge.observe('BTCUSDT', 89, 2000, 7)
        self.bridge.deliver()
        self.assertEqual(len(self.sent), 1)
    def test_failed_delivery_is_retried_from_outbox(self):
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        self.bridge.sender = lambda *a: (_ for _ in ()).throw(RuntimeError('offline'))
        with self.assertRaises(RuntimeError): self.bridge.deliver()
        with locked_state(self.root) as state: self.assertEqual(len(state['appPriceOutbox']), 1)
        self.bridge.sender = lambda data, token: self.sent.append((data, token))
        self.bridge.deliver()
        self.assertEqual(len(self.sent), 1)
    def test_ack_failure_does_not_duplicate_successful_push(self):
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        with patch.object(self.store, 'acknowledge', side_effect=RuntimeError('offline')):
            with self.assertRaises(RuntimeError): self.bridge.deliver()
        self.bridge.deliver()
        self.assertEqual(len(self.sent), 1)
    def test_web_alarm_has_status_without_device_push(self):
        self.store.row['push_token'] = None
        self.bridge.observe('BTCUSDT', 110, 2000, 7)
        self.bridge.deliver()
        self.assertEqual(self.sent, [])
        self.assertEqual(self.store.row['status'], 'triggered')


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(BridgeTests)
    old_path = Path(__file__).parent.parent / 'live-alerts-hourly-20261107/test_live.py'
    spec = importlib.util.spec_from_file_location('prior_live_tests', old_path)
    old = importlib.util.module_from_spec(spec); spec.loader.exec_module(old)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(old))
    with patch('macro_waves.market_alerts_live.send_push', return_value=True):
        result = unittest.TextTestRunner(verbosity=2).run(suite)
    Path(__file__).with_name('test-result.json').write_text(json.dumps({'success': result.wasSuccessful(), 'testsRun': result.testsRun}) + '\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)
