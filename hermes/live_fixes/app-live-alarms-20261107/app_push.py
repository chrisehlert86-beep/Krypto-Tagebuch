"""FCM data messages using the existing service account and device destination."""
import json
from pathlib import Path
import sys
import threading
import time
import urllib.error
import urllib.request

_lock = threading.Lock()
_credentials = None


def send_push(root: Path, data: dict, *, token=None, validate_only=False):
    global _credentials
    packages = root / 'data/python-packages'
    if str(packages) not in sys.path:
        sys.path.insert(0, str(packages))
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    with _lock:
        if _credentials is None:
            _credentials = service_account.Credentials.from_service_account_file(
                str(root / 'data/firebase-service-account.json'),
                scopes=['https://www.googleapis.com/auth/firebase.messaging'])
        if not _credentials.valid:
            _credentials.refresh(Request())
        bearer, project = str(_credentials.token), _credentials.project_id
    message = {'data': {key: str(value) for key, value in data.items()},
               'android': {'priority': 'high', 'ttl': '3600s'}}
    message['token' if token else 'topic'] = token or 'market-alerts'
    body = {'message': message, 'validate_only': validate_only}
    request = urllib.request.Request(f'https://fcm.googleapis.com/v1/projects/{project}/messages:send',
        data=json.dumps(body).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + bearer, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Push service returned HTTP ' + str(error.code)) from None
    if not result.get('name'):
        raise RuntimeError('Push service did not acknowledge the message')
    return True
