"""Local, owner-controlled qualification record; model output cannot self-approve."""
import json
import os
from pathlib import Path


def require_qualification(role: str, model: str) -> None:
    configured = os.getenv("HERMES_AGENT_QUALIFICATION_FILE")
    if not configured:
        return
    data = json.loads(Path(configured).read_text(encoding="utf-8"))
    result = next((row for row in data.get("results", []) if row.get("role") == role and row.get("model") == model), None)
    if not result or result.get("status") != "passed":
        raise RuntimeError(f"Agent {role} ({model}) ist für diese Rolle nicht qualifiziert; kein ungeprüfter Ersatz.")
