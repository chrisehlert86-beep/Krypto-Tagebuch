from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from hermes_v091.signal_lifecycle import evaluate_plan
from .config import BINANCE_API, Settings
from .market_publication import alert_levels, format_level_alert, level_fingerprint, report_payloads, sync_report_to_supabase
from .storage import write_json
from .telegram import send_message


def fetch_price(symbol: str) -> float:
    with urllib.request.urlopen(f"{BINANCE_API}/api/v3/ticker/price?symbol={symbol}", timeout=15) as response:
        return float(json.load(response)["price"])


def fetch_closed_candles(symbol: str, timeframe: str, since: int, now: int) -> list:
    query = urllib.parse.urlencode({"symbol": symbol,
        "interval": {"m30": "30m", "daily": "1d", "weekly": "1w", "monthly": "1M"}[timeframe],
        "startTime": since + 1, "limit": 1000})
    with urllib.request.urlopen(f"{BINANCE_API}/api/v3/klines?{query}", timeout=15) as response:
        data = json.load(response)
    if not isinstance(data, list):
        raise ValueError("Invalid candle response")
    return [[int(r[0]), *[float(v) for v in r[1:6]]] for r in data if int(r[6]) <= now]


def target_reached(payload: dict, current_price: float) -> bool:
    if payload["direction"] == "long":
        return current_price >= float(payload["target"]["zone"][0])
    if payload["direction"] == "short":
        return current_price <= float(payload["target"]["zone"][1])
    return False


def level_reached(level: dict, current_price: float) -> bool:
    return current_price >= float(level["price"]) if level["crossing"] == "up" else current_price <= float(level["price"])


def run_once(root: Path, *, price_provider=fetch_price, sender=send_message,
             candle_provider=fetch_closed_candles, now: int | None = None,
             synchronizer=sync_report_to_supabase) -> int:
    settings = Settings.load(root)
    if not settings.telegram_token or not settings.telegram_chat_id:
        raise RuntimeError("Telegram credentials are missing")
    now = now if now is not None else int(datetime.now(timezone.utc).timestamp() * 1000)
    report = json.loads((root / "reports" / "analysis_report.json").read_text(encoding="utf-8"))
    path = root / "data" / "market-alert-state.json"
    state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    sent = set(state.get("sent", []))
    histories = state.get("plans", {})
    sent_now = 0
    terminal_change = False
    for payload in report_payloads(report):
        levels = alert_levels(payload)
        for plan in payload.get("signalPlans", []):
            if plan.get("id") and plan.get("status") in {"expired", "invalidated", "ambiguous", "completed"}:
                previous = histories.get(plan["id"], {})
                if previous.get("status") != plan["status"]:
                    histories[plan["id"]] = {"status": plan["status"], "hitLevels": previous.get("hitLevels", [])}
                    terminal_change = True
            if plan.get("status") != "active" or plan.get("direction") == "wait":
                continue
            identity = plan["id"]
            rows = candle_provider(payload["symbol"], plan["timeframe"], int(plan["asOf"]), now)
            lifecycle = evaluate_plan(plan, rows, now=now, previous=histories.get(identity))
            if lifecycle["status"] in {"invalidated", "expired", "ambiguous", "completed"} and lifecycle != histories.get(identity):
                terminal_change = True
            histories[identity] = lifecycle
            write_json(path, {"sent": sorted(sent), "plans": histories})
            if lifecycle["status"] not in {"active", "completed"}:
                continue
            for level in levels:
                if level["planId"] != identity or str(level["ratio"]) not in lifecycle["hitLevels"]:
                    continue
                fingerprint = level_fingerprint(level)
                if fingerprint in sent:
                    continue
                current = float(rows[-1][4]) if rows else float(payload["currentPrice"])
                sender(settings.telegram_token, settings.telegram_chat_id, format_level_alert(level, current))
                sent.add(fingerprint)
                sent_now += 1
                write_json(path, {"sent": sorted(sent), "plans": histories})
    write_json(path, {"sent": sorted(sent), "plans": histories})
    if terminal_change:
        synchronizer(report)
    return sent_now


def main() -> None:
    run_once(Path(os.environ.get("HERMES_ROOT", Path(__file__).resolve().parents[2])))


if __name__ == "__main__":
    main()
