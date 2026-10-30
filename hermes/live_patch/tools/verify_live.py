"""Read-only verification of installed code, service paths and sanitized app data."""
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

from macro_waves.config import Settings
from macro_waves import market_publication, market_alerts
from hermes_v091 import directional_teams, directional_supervisor, analysis_contract

ROOT = Path("/opt/hermes-analysis")
Settings.load(ROOT)
for module in (market_publication, market_alerts, directional_teams, directional_supervisor, analysis_contract):
    if "elliott-evidence-20261030/src/" not in str(module.__file__):
        raise RuntimeError("Unexpected module origin: " + str(module.__file__))
print("module_origins=verified")
url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
request = urllib.request.Request(url + "/rest/v1/market_analysis_current?select=symbol,payload", headers={"apikey":key,"Authorization":"Bearer "+key})
with urllib.request.urlopen(request, timeout=30) as response:
    rows = json.load(response)
for row in rows:
    payload = row["payload"]
    if payload.get("validationVersion") != analysis_contract.VERSION:
        raise RuntimeError("Legacy payload remains in app")
    print(json.dumps({"symbol":row["symbol"],"direction":payload["direction"],
          "plans":[{"frame":p["timeframe"],"status":p["status"],"levels":len(p["levels"])} for p in payload["signalPlans"]]}))
