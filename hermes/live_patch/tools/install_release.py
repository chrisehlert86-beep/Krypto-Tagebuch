"""Activate this tested release with backups; never sends a Telegram message."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path("/opt/hermes-analysis")
RELEASE = Path(__file__).resolve().parents[1]
SERVICES = ("hermes-inbox.service", "hermes-daily-quick.service", "hermes-weekly-deep.service", "hermes-market-alerts.service")


def main():
    if str(RELEASE) != "/opt/hermes-analysis/data/runtime_v091/elliott-evidence-20261030":
        raise RuntimeError("Unexpected release path")
    audit = RELEASE / "agent-audit-final.json"
    results = json.loads(audit.read_text(encoding="utf-8"))
    if len(results["results"]) != 20 or not results.get("completedAt"):
        raise RuntimeError("Agent audit is incomplete")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = ROOT / "backups" / ("elliott-evidence-" + stamp)
    backup.mkdir(parents=True, mode=0o700)
    subprocess.run(["systemctl", "--user", "stop", "hermes-market-alerts.timer"], check=True)
    paths = []
    for service in SERVICES:
        path = Path.home() / ".config/systemd/user" / (service + ".d") / "zz-elliott-evidence.conf"
        path.parent.mkdir(parents=True, exist_ok=True)
        previous = path.read_text() if path.exists() else None
        paths.append({"path": str(path), "previous": previous})
    (backup / "dropins.json").write_text(json.dumps(paths, indent=2), encoding="utf-8")
    override = ROOT / "data/market-signal-overrides.json"
    if override.exists():
        shutil.copy2(override, backup / override.name)
        # Retire this unverified source while preserving it in the incident backup.
        override.rename(override.with_name("market-signal-overrides.retired-" + stamp + ".json"))
    for name in ("analysis_report.json", "publication_state.json"):
        source = ROOT / "reports" / name
        if source.exists():
            shutil.copy2(source, backup / name)
    state = ROOT / "data/market-alert-state.json"
    if state.exists():
        shutil.copy2(state, backup / state.name)
    dropin = ("[Service]\n"
        f"Environment=PYTHONPATH={RELEASE}/src:/opt/hermes-analysis/data/runtime_v091\n"
        f"Environment=HERMES_AGENT_QUALIFICATION_FILE={audit}\n")
    for entry in paths:
        Path(entry["path"]).write_text(dropin, encoding="utf-8")
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "restart", "hermes-inbox.service"], check=True)
    os.environ["HERMES_ROOT"] = str(ROOT)
    os.environ["HERMES_AGENT_QUALIFICATION_FILE"] = str(audit)
    sys.path.insert(0, str(RELEASE / "src"))
    from macro_waves.config import Settings
    from macro_waves.market_publication import report_payloads, sync_report_to_supabase
    from hermes_v091.analysis_contract import VERSION
    Settings.load(ROOT)
    report = json.loads((ROOT / "reports/analysis_report.json").read_text(encoding="utf-8"))
    payloads = report_payloads(report)
    if any(p["direction"] != "wait" or any(plan["levels"] for plan in p["signalPlans"]) for p in payloads):
        raise RuntimeError("Legacy report unexpectedly passed the new gate")
    synced = sync_report_to_supabase(report)
    if synced != len(payloads):
        raise RuntimeError("Corrected app payloads were not all synchronized")
    subprocess.run(["systemctl", "--user", "start", "hermes-market-alerts.timer"], check=True)
    manifest = {"version": VERSION, "activatedAt": stamp, "backup": str(backup),
        "appRecords": synced, "telegramMessagesSentByInstaller": 0,
        "sources": {str(p.relative_to(RELEASE)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in (RELEASE / "src").rglob("*.py")},
        "agentResults": {status: sum(r["status"] == status for r in results["results"])
                         for status in ("passed", "failed", "unavailable")}}
    (RELEASE / "activation.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in manifest.items() if k != "sources"}))


if __name__ == "__main__":
    main()
