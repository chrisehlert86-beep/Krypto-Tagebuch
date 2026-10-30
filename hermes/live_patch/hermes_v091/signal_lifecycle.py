"""Pure lifecycle replay; terminal events cannot be undone by a later bounce."""
from __future__ import annotations

from .analysis_contract import MAX_AGE, candle_close_time, number

TERMINAL = {"invalidated", "expired", "completed", "ambiguous"}


def evaluate_plan(plan: dict, rows: list, *, now: int, previous: dict | None = None) -> dict:
    if previous and previous.get("status") in TERMINAL:
        return dict(previous)
    if plan.get("status") != "active" or plan.get("direction") not in {"long", "short"}:
        return {"status": "blocked", "hitLevels": []}
    start = int(plan["asOf"])
    if now - start > MAX_AGE[plan["timeframe"]]:
        return {"status": "expired", "hitLevels": []}
    sign = 1 if plan["direction"] == "long" else -1
    invalidation = number(plan["invalidation"]["price"])
    hits = set((previous or {}).get("hitLevels", []))
    active = plan.get("levels", [])
    for row in rows:
        close_at = candle_close_time(int(row[0]), plan["timeframe"])
        if close_at <= start or close_at > now:
            continue
        broken = (float(row[4]) - invalidation) * sign <= 0
        contacts = {str(level["ratio"]) for level in active if int(row[0]) > start
                    if (float(row[2]) >= float(level["price"]) if level["crossing"] == "up"
                        else float(row[3]) <= float(level["price"]))}
        if broken:
            return {"status": "ambiguous" if contacts - hits else "invalidated", "hitLevels": sorted(hits), "at": close_at}
        hits.update(contacts)
    status = "completed" if active and len(hits) == len(active) else "active"
    return {"status": status, "hitLevels": sorted(hits)}
