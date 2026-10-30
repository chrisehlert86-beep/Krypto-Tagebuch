"""Activate the stricter endpoint/full-structure distinction with a source guard."""
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
relative = "src/hermes_v091/analysis_contract.py"
current = release / relative
pending = release / "analysis_contract.py.new"
if hashlib.sha256(current.read_bytes()).hexdigest() != manifest["sources"][relative]:
    raise RuntimeError("Active contract changed since the last verified deployment")
ast.parse(pending.read_text(encoding="utf-8"))
shutil.copy2(current, Path(manifest["backup"]) / "analysis_contract.before-structure-gate.py")
os.replace(pending, current)
subprocess.run(["/opt/hermes-analysis/.venv/bin/python", "-m", "unittest", "discover", "-s", str(release / "tests"), "-q"], check=True)
from macro_waves.config import Settings
from macro_waves.market_publication import sync_report_to_supabase
root = Path("/opt/hermes-analysis")
Settings.load(root)
report = json.loads((root / "reports/analysis_report.json").read_text(encoding="utf-8"))
print("app_records=" + str(sync_report_to_supabase(report)))
manifest["sources"][relative] = hashlib.sha256(current.read_bytes()).hexdigest()
manifest["regressionTests"] = 38
manifest["structureVerification"] = "endpoint_only; full_structure_publication_disabled"
manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
subprocess.run(["systemctl", "--user", "restart", "hermes-inbox.service"], check=True)
