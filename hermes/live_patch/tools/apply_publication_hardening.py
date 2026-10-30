"""Atomic final replacement, with source hash precondition and regression checks."""
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

release = Path(__file__).resolve().parents[1]
manifest_path = release / "activation.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
relative = "src/macro_waves/market_publication.py"
current = release / relative
pending = release / "market_publication.py.new"
if hashlib.sha256(current.read_bytes()).hexdigest() != manifest["sources"][relative]:
    raise RuntimeError("Active publication module changed since activation")
ast.parse(pending.read_text(encoding="utf-8"))
shutil.copy2(current, Path(manifest["backup"]) / "market_publication.before-api-hardening.py")
os.replace(pending, current)
subprocess.run(["/opt/hermes-analysis/.venv/bin/python", "-m", "unittest", "discover", "-s", str(release / "tests"), "-q"], check=True)
from macro_waves.config import Settings
from macro_waves.market_publication import report_payloads, sync_report_to_supabase
root = Path("/opt/hermes-analysis")
Settings.load(root)
report = json.loads((root / "reports/analysis_report.json").read_text(encoding="utf-8"))
for payload in report_payloads(report):
    for name in ("activeCase", "bullCase", "bearCase"):
        if payload[name]["fibonacciLevels"]:
            raise RuntimeError("Legacy alternative still contains unverified levels")
print("sanitized_app_records=" + str(sync_report_to_supabase(report)))
manifest["sources"][relative] = hashlib.sha256(current.read_bytes()).hexdigest()
manifest["regressionTests"] = 36
manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
subprocess.run(["systemctl", "--user", "restart", "hermes-inbox.service"], check=True)
