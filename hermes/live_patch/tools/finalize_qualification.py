"""Select the final probe after correcting the probe's Codex output format."""
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess

release = Path(__file__).resolve().parents[1]
audit = release / "agent-audit-final.json"
data = json.loads(audit.read_text(encoding="utf-8"))
if not data.get("completedAt") or len(data["results"]) != 20:
    raise RuntimeError("Final audit incomplete")
for service in ("hermes-inbox.service", "hermes-daily-quick.service", "hermes-weekly-deep.service", "hermes-market-alerts.service"):
    path = Path.home() / ".config/systemd/user" / (service + ".d") / "zz-elliott-evidence.conf"
    source = path.read_text(encoding="utf-8")
    path.write_text(source.replace("agent-audit-routed.json", "agent-audit-final.json"), encoding="utf-8")
subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
subprocess.run(["systemctl", "--user", "restart", "hermes-inbox.service"], check=True)
activation = release / "activation.json"
record = json.loads(activation.read_text(encoding="utf-8"))
record.setdefault("agentResultsAtActivation", record["agentResults"])
record["agentResults"] = {s: sum(r["status"] == s for r in data["results"]) for s in ("passed", "failed", "unavailable")}
record["qualificationFile"] = str(audit)
record["qualificationFinalizedAt"] = datetime.now(timezone.utc).isoformat()
activation.write_text(json.dumps(record, indent=2), encoding="utf-8")
print(json.dumps(record["agentResults"]))
