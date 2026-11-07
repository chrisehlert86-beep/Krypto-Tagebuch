"""Add app quote mirroring and personal push alarms without changing CPU/AI schedules."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path('/opt/hermes-analysis')
BASE = ROOT / 'data/runtime_v091'
OLD = BASE / 'live-alerts-hourly-20261107'
RELEASE = BASE / 'app-live-alarms-20261107'
UNITDIR = Path.home() / '.config/systemd/user'
DROPIN = 'zzzzzzzzz-app-live-20261107.conf'
UNITS = ('hermes-inbox', 'hermes-daily-quick', 'hermes-weekly-deep', 'hermes-market-alerts', 'hermes-cpu-hourly')
ENV = '[Service]\nEnvironment=PYTHONPATH=' + str(RELEASE / 'src') + ':' + str(OLD / 'deps') + ':' + str(BASE) + '\n'


def system(*args, check=True):
    return subprocess.run(['systemctl', '--user', *args], capture_output=True, text=True, check=check).stdout.strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage():
    if (RELEASE / 'src').exists():
        assert json.loads((RELEASE / 'manifest.json').read_text())['status'] == 'staged', 'Cannot restage a live release'
    else:
        shutil.copytree(OLD / 'src', RELEASE / 'src', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        for name in ('migrations', 'library'):
            shutil.copytree(OLD / name, RELEASE / name)
    for name in ('app_alarm_bridge.py', 'app_push.py'):
        shutil.copy2(RELEASE / name, RELEASE / 'src/macro_waves' / name)
    path = RELEASE / 'src/macro_waves/market_alerts_live.py'
    code = (OLD / 'src/macro_waves/market_alerts_live.py').read_text()
    replacements = {
        'from .alert_state import locked_state\n': 'from .alert_state import locked_state\nfrom .app_alarm_bridge import PriceAlertBridge\nfrom .app_push import send_push\n',
        '        self.cursors = {}\n': '        self.cursors = {}\n        self.bridge = None\n',
        "        candidates = [(payload, plan)":
            "        if self.bridge:\n            self.bridge.observe(symbol, price, traded_at, sequence, recovered=recovered)\n        candidates = [(payload, plan)",
        "'price': price, 'symbol': symbol, 'kind': event['kind']}":
            "'price': price, 'symbol': symbol, 'kind': event['kind'],\n"
            "                                                   'pushData': {'kind': 'scenario_level', 'eventId': fingerprint, 'symbol': symbol,\n"
            "                                                       'title': symbol.replace('USDT', '') + ' · PREISALARM', 'body': message,\n"
            "                                                       'price': str(price), 'timeframe': plan['timeframe'], 'sentAt': str(traded_at)}}",
        "                if not settings.telegram_token or not settings.telegram_chat_id:\n"
        "                    raise RuntimeError('Telegram destination is not configured')\n"
        "                send_message(settings.telegram_token, settings.telegram_chat_id, item['message'])\n":
            "                errors = []\n"
            "                if item.get('pushData') and not item.get('pushSent'):\n"
            "                    try:\n"
            "                        send_push(root, item['pushData'])\n"
            "                        with locked_state(root) as state:\n"
            "                            state['liveOutbox'][fingerprint]['pushSent'] = True\n"
            "                    except Exception:\n"
            "                        errors.append('push')\n"
            "                if not item.get('telegramSent'):\n"
            "                    try:\n"
            "                        if not settings.telegram_token or not settings.telegram_chat_id:\n"
            "                            raise RuntimeError('Telegram destination is not configured')\n"
            "                        send_message(settings.telegram_token, settings.telegram_chat_id, item['message'])\n"
            "                        with locked_state(root) as state:\n"
            "                            state['liveOutbox'][fingerprint]['telegramSent'] = True\n"
            "                    except Exception:\n"
            "                        errors.append('telegram')\n"
            "                if errors:\n"
            "                    raise RuntimeError('Alarm destinations pending retry: ' + ','.join(errors))\n",
        '    monitor = LiveMonitor(root)\n':
            "    monitor = LiveMonitor(root)\n    monitor.bridge = PriceAlertBridge(root)\n"
            "    threading.Thread(target=monitor.bridge.run, daemon=True, name='live-app-sync').start()\n",
    }
    for before, after in replacements.items():
        assert code.count(before) == 1, 'Baseline mismatch: ' + before
        code = code.replace(before, after)
    path.write_text(code)
    subprocess.run([str(ROOT / '.venv/bin/python'), '-m', 'compileall', '-q', str(RELEASE / 'src')], check=True)
    manifest = {'status': 'staged', 'hashes': {p.relative_to(RELEASE).as_posix(): sha(p)
                for p in (RELEASE / 'src').rglob('*') if p.is_file() and p.suffix in {'.py', '.json'}}}
    (RELEASE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'status': 'staged', 'cpuAndAiSchedulesChanged': False}))


def schema_probe():
    sys.path[:0] = [str(RELEASE / 'src'), str(OLD / 'deps'), str(BASE)]
    from macro_waves.config import Settings
    from macro_waves.app_alarm_bridge import AppStore
    Settings.load(ROOT)
    store = AppStore()
    for table in ('market_live_prices', 'market_price_alerts'):
        store.request(table, 'select=*&limit=0')
    print(json.dumps({'schemaReady': True}))


def activate():
    schema_probe()
    assert json.loads((RELEASE / 'test-result.json').read_text())['success']
    manifest = json.loads((RELEASE / 'manifest.json').read_text())
    assert manifest['status'] == 'staged'
    for path, expected in manifest['hashes'].items():
        assert sha(RELEASE / path) == expected, path
    for unit in UNITS:
        assert str(OLD / 'src') in system('show', unit + '.service', '--property=Environment', '--value')
    baseline = {'analysisReportSha256': sha(ROOT / 'reports/analysis_report.json'),
                'timers': system('list-timers', '--all', '--no-pager')}
    (RELEASE / 'baseline.json').write_text(json.dumps(baseline, indent=2) + '\n')
    try:
        for unit in UNITS:
            destination = UNITDIR / (unit + '.service.d') / DROPIN
            assert not destination.exists()
            destination.parent.mkdir(exist_ok=True)
            destination.write_text(ENV)
        system('daemon-reload')
        system('restart', 'hermes-market-alerts.service', 'hermes-inbox.service')
        manifest['status'] = 'live'
        (RELEASE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    except Exception:
        rollback()
        raise
    print(json.dumps({'status': 'live', 'quotes': 'same_native_alarm_stream', 'quoteSyncSeconds': 1}))


def rollback():
    for unit in UNITS:
        path = UNITDIR / (unit + '.service.d') / DROPIN
        if path.exists():
            assert path.read_text() == ENV
            path.unlink()
    system('daemon-reload')
    system('restart', 'hermes-market-alerts.service', 'hermes-inbox.service')
    print(json.dumps({'status': 'rolled_back', 'hourlyCpuAndAiPausePreserved': True}))


def verify():
    sys.path[:0] = [str(RELEASE / 'src'), str(OLD / 'deps'), str(BASE)]
    from macro_waves.config import Settings
    from macro_waves.app_alarm_bridge import AppStore
    Settings.load(ROOT)
    store = AppStore()
    health_path = ROOT / 'reports/live-alerts/app-health.json'
    result = {'service': system('show', 'hermes-market-alerts.service', '--property=ActiveState,SubState,NRestarts'),
        'health': json.loads(health_path.read_text()) if health_path.exists() else None,
        'quotes': store.request('market_live_prices', 'select=symbol,price,traded_at,received_at'),
        'timers': system('list-timers', '--all', '--no-pager'),
        'analysisReportPreserved': sha(ROOT / 'reports/analysis_report.json') == json.loads((RELEASE / 'baseline.json').read_text())['analysisReportSha256']}
    (RELEASE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('stage', 'schema_probe', 'activate', 'rollback', 'verify'))
    globals()[parser.parse_args().action]()
