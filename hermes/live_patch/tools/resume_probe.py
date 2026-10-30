import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "agent-audit.json"
target = root / "agent-audit-final.json"
if not target.exists():
    data = json.loads((root / "agent-audit-routed.json").read_text(encoding="utf-8"))
    data["results"] = [r for r in data["results"]
                       if not (r.get("role") == "supervisor" and r.get("status") == "unavailable")]
    data.pop("completedAt", None)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
