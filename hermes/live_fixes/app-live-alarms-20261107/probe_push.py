"""Validate existing FCM credentials without delivering any notification."""
import json
from pathlib import Path
from macro_waves.app_push import send_push

result = send_push(Path('/opt/hermes-analysis'), {'kind': 'validation_only', 'title': 'Validation only'}, validate_only=True)
print(json.dumps({'pushCredentialsValid': result, 'testMessagesSent': 0}))
