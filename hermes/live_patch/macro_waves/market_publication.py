from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any
from datetime import datetime, timezone
from hermes_v091.analysis_contract import VERSION, MAX_AGE, audit_case, case_id, timestamp
from hermes_v091.signal_lifecycle import evaluate_plan, TERMINAL


def _case_payload(case: dict, direction: str) -> dict:
    wave = case.get("current_wave") or {}
    return {
        "direction": direction,
        "waveLabel": str(wave.get("label") or "Welle unklar"),
        "waveStatus": str(wave.get("status") or "unclear"),
        "interpretation": str(wave.get("interpretation") or ""),
        "trigger": float(case.get("trigger") or 0),
        "invalidation": float(case.get("invalidation") or 0),
        "targetZone": _zone(case.get("target_zone")),
        "fibonacciLevels": [
            {
                "ratio": str(item.get("ratio") or ""),
                "price": float(item.get("price") or 0),
                "role": str(item.get("role") or ""),
            }
            for item in case.get("fibonacci_levels", [])
            if isinstance(item, dict)
        ],
        "supportZones": [_zone(zone) for zone in case.get("support_zones", [])],
        "resistanceZones": [_zone(zone) for zone in case.get("resistance_zones", [])],
        "wavePoints": [
            {
                "label": str(point.get("label") or ""),
                "time": int(point.get("time") or 0),
                "price": float(point.get("price") or 0),
            }
            for point in case.get("wave_points", [])
            if isinstance(point, dict)
        ],
        "confidence": float(case.get("confidence") or 0),
    }


def _verified_case_payload(case: dict, dataset: dict, direction: str) -> dict:
    audit = audit_case(case, dataset, "bull" if direction == "long" else "bear")
    if audit["status"] != "valid":
        case = {"current_wave": {"label": "Wellenzählung offen", "status": "unclear",
                 "interpretation": "; ".join(audit["violations"] + audit["warnings"])}, "confidence": 0}
    payload = _case_payload(case, direction)
    payload["validationStatus"] = audit["status"]
    if audit["status"] == "valid":
        payload["fibonacciLevels"] = audit["levels"]
    return payload


def _zone(value: Any) -> list[float]:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        return [0.0, 0.0]
    return sorted([float(value[0]), float(value[1])])


def _candles(dataset: dict, key: str) -> list[dict]:
    result = []
    for row in dataset.get(key, []):
        if not isinstance(row, (list, tuple)) or len(row) < 6:
            continue
        result.append({
            "time": int(row[0]),
            "open": float(row[1]),
            "high": float(row[2]),
            "low": float(row[3]),
            "close": float(row[4]),
            "volume": float(row[5]),
        })
    return result


def _signal_plans(report: dict, symbol: str, item: dict, *, now: int | None = None) -> list[dict]:
    """Only computed report cases can become a plan. Overrides are never read."""
    dataset = item.get("dataset") or {}
    supervisor = item.get("supervisor") or {}
    now = now if now is not None else int(datetime.now(timezone.utc).timestamp() * 1000)
    state_path = Path(os.environ.get("HERMES_ROOT", "/opt/hermes-analysis")) / "data" / "market-alert-state.json"
    histories = json.loads(state_path.read_text(encoding="utf-8")).get("plans", {}) if state_path.exists() else {}
    plans = []
    for frame in ("m30", "daily", "weekly", "monthly"):
        selected = supervisor.get("selected_bias") if frame == "daily" else None
        frame_result = item.get("timeframe_cases", {}).get(frame, {})
        if frame_result:
            selected = frame_result.get("selected_bias")
        case = (supervisor.get(f"{selected}_case") if frame == "daily" else frame_result.get(f"{selected}_case")) or {}
        plan = {"timeframe": frame, "timeframeLabel": _timeframe_label(frame), "direction": "wait",
                "status": "unverified", "waveLabel": "Wellenzählung offen", "levels": [],
                "invalidation": {"relation": "below", "price": 0, "confirmation": ""},
                "note": "Keine eigenständig belegte Analyse dieser Zeitebene verfügbar.", "contractVersion": VERSION}
        if not case:
            if frame == "daily":
                plan["note"] = "Kein bestätigtes Richtungsszenario; WARTEN."
            plans.append(plan)
            continue
        audit = audit_case(case, dataset, selected, frame=frame)
        plan["audit"] = audit
        as_of = timestamp(report["generated_at"]) if report.get("generated_at") else audit.get("asOf", int(dataset.get("current_price_time") or 0))
        plan.update({"id": case_id(symbol, frame, case), "asOf": as_of,
                     "expiresAt": as_of + MAX_AGE[frame]})
        previous = histories.get(plan["id"], {})
        if previous.get("status") in TERMINAL:
            plan.update(status=previous["status"], note="Dieses Szenario ist beendet; eine Kurserholung reaktiviert es nicht.")
        elif now - as_of > MAX_AGE[frame]:
            plan.update(status="expired", note="Die Analyse ist abgelaufen; neue Strukturprüfung erforderlich.")
        elif audit["status"] != "valid":
            plan.update(status=audit["status"], note="; ".join(audit["violations"] + audit["warnings"]))
        elif not audit.get("triggerConfirmed"):
            plan.update(status="pending", note="Bestätigung durch abgeschlossenen Kerzenschluss fehlt.")
        elif item.get("teams", {}).get("rules", {}).get("leader", {}).get(f"{selected}_status") != "valid":
            plan.update(status="unverified", note="Regelteam hat dieses Szenario nicht freigegeben.")
        else:
            targets = [level for level in audit["levels"] if level["role"] == "target"]
            plan.update({"direction": "long" if selected == "bull" else "short", "status": "active",
                "waveLabel": str(case["current_wave"]["label"]),
                "levels": [{**level, "role": "target", "crossing": "up" if selected == "bull" else "down"} for level in targets],
                "invalidation": {"relation": "below" if selected == "bull" else "above", "price": float(case["invalidation"]), "confirmation": "Schlusskurs der ausgewiesenen Zeitebene"},
                "note": "Berechnete Szenarioziele; ein Zielkontakt ist kein Einstiegssignal."})
            if not targets:
                plan.update(direction="wait", status="conditional", note="Keine berechneten Ziele für diese Richtung vorhanden.")
        plans.append(plan)
    return plans


def _timeframe_label(timeframe: str) -> str:
    return {"m30": "30M", "daily": "1D", "weekly": "1W", "monthly": "1M"}.get(timeframe, timeframe)


def _active_direction(supervisor: dict) -> str:
    bias = supervisor.get("selected_bias")
    if bias == "bull":
        return "long"
    if bias == "bear":
        return "short"
    return "wait"


def _active_case(supervisor: dict, direction: str) -> tuple[dict, str]:
    if direction == "short" or (direction == "wait" and supervisor.get("preferred_case") == "bear"):
        return supervisor.get("bear_case") or {}, "short"
    return supervisor.get("bull_case") or {}, "long"


def _target_fib(case: dict, direction: str) -> dict | None:
    zone = _zone(case.get("target_zone"))
    entry = zone[0] if direction == "long" else zone[1]
    levels = [item for item in case.get("fibonacci_levels", []) if isinstance(item, dict) and item.get("price") is not None]
    if not levels:
        return None
    item = min(levels, key=lambda level: abs(float(level["price"]) - entry))
    return {"ratio": str(item.get("ratio") or ""), "price": float(item["price"])}


def build_market_payload(report: dict, symbol: str, item: dict) -> dict:
    supervisor = item.get("supervisor") or {}
    dataset = item.get("dataset") or {}
    plans = _signal_plans(report, symbol, item)
    daily_plan = next(plan for plan in plans if plan["timeframe"] == "daily")
    direction = daily_plan["direction"]
    selected_case, case_direction = _active_case(supervisor, direction)
    bull = supervisor.get("bull_case") or {}
    bear = supervisor.get("bear_case") or {}
    target_zone = _zone(selected_case.get("target_zone"))
    if direction == "wait":
        selected_case = {"current_wave": {"label": "Wellenzählung offen", "status": "unclear", "interpretation": daily_plan["note"]}, "confidence": 0}
        target_zone = [0.0, 0.0]
    target_fib = _target_fib(selected_case, case_direction)
    display_symbol = symbol.removesuffix("USDT") + "/USDT"
    return {
        "symbol": symbol,
        "displaySymbol": display_symbol,
        "generatedAt": str(report.get("generated_at") or ""),
        "runId": str(report.get("run_id") or ""),
        "analysisMode": str(report.get("analysis_mode") or ""),
        "currentPrice": float(dataset.get("current_price") or 0),
        "priceTime": dataset.get("current_price_time"),
        "direction": direction,
        "marketState": str(supervisor.get("market_state") or "unknown"),
        "confidence": float(supervisor.get("confidence") or 0) if direction != "wait" else 0.0,
        "summary": str(supervisor.get("summary") or ""),
        "currentWaveSummary": str(supervisor.get("current_wave_summary") or "") if direction != "wait" else daily_plan["note"],
        "activeCase": _case_payload(selected_case, case_direction),
        "bullCase": _verified_case_payload(bull, dataset, "long"),
        "bearCase": _verified_case_payload(bear, dataset, "short"),
        "target": {
            "kind": "top" if case_direction == "long" else "bottom",
            "zone": target_zone,
            "fibRatio": target_fib["ratio"] if target_fib else None,
            "fibPrice": target_fib["price"] if target_fib else None,
        },
        "invalidation": {
            "relation": "below" if case_direction == "long" else "above",
            "price": float(selected_case.get("invalidation") or 0),
        },
        "signalPlans": plans,
        "validationVersion": VERSION,
        "candles": {
            "m30": _candles(dataset, "m30_ohlcv"),
            "daily": _candles(dataset, "daily_ohlcv"),
            "weekly": _candles(dataset, "weekly_ohlcv"),
            "monthly": _candles(dataset, "monthly_ohlcv"),
        },
    }


def report_payloads(report: dict) -> list[dict]:
    return [
        build_market_payload(report, symbol, item)
        for symbol, item in report.get("markets", {}).items()
        if item.get("supervisor")
    ]


def format_compact_summary(payload: dict) -> str:
    summaries = format_compact_summaries(payload)
    return summaries[0][1]


def format_compact_summaries(payload: dict) -> list[tuple[str, str]]:
    plans = payload.get("signalPlans") or []
    if plans:
        return [(str(plan["timeframe"]), _format_signal_plan_summary(payload, plan)) for plan in plans
                if plan["timeframe"] in {"m30", "daily"} or plan.get("status") == "active"]
    return [("daily", _format_legacy_compact_summary(payload))]


def _format_signal_plan_summary(payload: dict, plan: dict) -> str:
    if plan.get("direction") == "wait":
        return (f"{payload['displaySymbol'].replace('/USDT', '')} · {plan['timeframeLabel']}\n\n"
                f"Richtung: WARTEN\nStatus: {plan.get('status', 'unverified')}\n"
                f"{plan.get('note', 'Keine belastbare Analyse verfügbar.')}\n"
                "Keine bestätigten Fibonacci-Ziele oder Einstiegssignale.")
    direction = "LONG" if plan["direction"] == "long" else "SHORT"
    level_lines = []
    for level in plan["levels"]:
        role = {"target": "Ziel", "long_entry": "Long-Einstieg", "short_entry": "Short-Einstieg"}[level["role"]]
        level_lines.append(f"Fib {level['ratio']}: {_price(level['price'])} USDT · {role}")
    relation = "Unter" if plan["invalidation"]["relation"] == "below" else "Über"
    confirmation = plan["invalidation"].get("confirmation")
    confirmation_line = f"\nBestätigung: {confirmation}" if confirmation else ""
    return (
        f"{payload['displaySymbol'].replace('/USDT', '')} · {plan['timeframeLabel']}\n\n"
        f"Laufende Welle: {plan['waveLabel']}\n"
        f"Richtung: {direction}\n\n"
        "Fibonacci-Level:\n" + "\n".join(level_lines) + "\n\n"
        f"Invalidierung:\n{relation} {_price(plan['invalidation']['price'])} USDT"
        f"{confirmation_line}\n\n{plan.get('note', '')}"
    )


def _format_legacy_compact_summary(payload: dict) -> str:
    case = payload["activeCase"]
    direction = {"long": "LONG", "short": "SHORT", "wait": "WARTEN"}[payload["direction"]]
    zone = payload["target"]["zone"]
    target_heading = "Nächstes Top" if payload["target"]["kind"] == "top" else "Nächster Boden"
    if payload["direction"] == "wait":
        target_heading += " nach Bestätigung"
    fib_ratio = payload["target"].get("fibRatio")
    fib_price = payload["target"].get("fibPrice")
    target_line = f"Zielzone: {_price(zone[0])}–{_price(zone[1])} USDT"
    if fib_ratio and fib_price:
        target_line = f"Fib {fib_ratio} bei {_price(fib_price)} USDT\n{target_line}"
    relation = "Unter" if payload["invalidation"]["relation"] == "below" else "Über"
    trigger_relation = "Über" if case["direction"] == "long" else "Unter"
    trigger = ""
    if payload["direction"] == "wait" and case.get("trigger"):
        trigger = f"\n\nBestätigung:\n{trigger_relation} {_price(case['trigger'])} USDT"
    return (
        f"{payload['displaySymbol'].replace('/USDT', '')} · 1D\n\n"
        f"Laufende Welle: {case['waveLabel']}\n"
        f"Richtung: {direction}\n\n"
        f"{target_heading}:\n{target_line}"
        f"{trigger}\n\n"
        f"Invalidierung:\n{relation} {_price(payload['invalidation']['price'])} USDT"
    )


def format_target_alert(payload: dict, current_price: float) -> str:
    zone = payload["target"]["zone"]
    direction = "LONG" if payload["direction"] == "long" else "SHORT"
    fib = ""
    if payload["target"].get("fibRatio") and payload["target"].get("fibPrice"):
        fib = f"\nFib {payload['target']['fibRatio']}: {_price(payload['target']['fibPrice'])} USDT"
    return (
        "🎯 ZIELZONE ERREICHT\n\n"
        f"{payload['displaySymbol'].replace('/USDT', '')} · 1D\n"
        f"Richtung: {direction}\n"
        f"Laufende Welle: {payload['activeCase']['waveLabel']}\n\n"
        f"Zielzone: {_price(zone[0])}–{_price(zone[1])} USDT"
        f"{fib}\n"
        f"Aktueller Preis: {_price(current_price)} USDT"
    )


def alert_levels(payload: dict) -> list[dict]:
    plans = payload.get("signalPlans") or []
    if plans:
        return [
            {
                "symbol": payload["symbol"],
                "displaySymbol": payload["displaySymbol"],
                "timeframe": plan["timeframe"],
                "timeframeLabel": plan["timeframeLabel"],
                "waveLabel": plan["waveLabel"],
                "direction": plan["direction"],
                "planId": plan["id"], "asOf": plan["asOf"], "invalidation": plan["invalidation"],
                **level,
            }
            for plan in plans
            if plan.get("status") == "active" and plan.get("direction") in {"long", "short"}
            for level in plan["levels"]
        ]
    zone = payload["target"]["zone"]
    return [{
        "symbol": payload["symbol"],
        "displaySymbol": payload["displaySymbol"],
        "timeframe": "daily",
        "timeframeLabel": "1D",
        "waveLabel": payload["activeCase"]["waveLabel"],
        "direction": payload["direction"],
        "ratio": payload["target"].get("fibRatio") or "Zone",
        "price": float(zone[0] if payload["direction"] == "long" else zone[1]),
        "role": "target",
        "crossing": "up" if payload["direction"] == "long" else "down",
    }]


def format_level_alert(level: dict, current_price: float) -> str:
    role = {"target": "ZIEL", "long_entry": "LONG-EINSTIEG", "short_entry": "SHORT-EINSTIEG"}[level["role"]]
    return (
        f"🎯 FIBONACCI-LEVEL ERREICHT · {role}\n\n"
        f"{level['displaySymbol'].replace('/USDT', '')} · {level['timeframeLabel']}\n"
        f"Laufende Welle: {level['waveLabel']}\n"
        f"Fib {level['ratio']}: {_price(level['price'])} USDT\n"
        f"Aktueller Preis: {_price(current_price)} USDT"
    )


def level_fingerprint(level: dict) -> str:
    decimals = 2 if abs(float(level["price"])) < 1000 else 0
    return ":".join([
        str(level.get("planId", "legacy")), str(level["symbol"]), str(level["timeframe"]), str(level["role"]), str(level["ratio"]),
        f"{float(level['price']):.{decimals}f}", str(level["crossing"]),
    ])


def target_fingerprint(payload: dict) -> str:
    zone = payload["target"]["zone"]
    decimals = 2 if max(abs(float(zone[0])), abs(float(zone[1]))) < 1000 else 0
    return ":".join([
        payload["symbol"], payload["direction"],
        f"{float(zone[0]):.{decimals}f}", f"{float(zone[1]):.{decimals}f}",
    ])


def sync_report_to_supabase(report: dict) -> int:
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        return 0
    if not base_url.startswith("https://"):
        raise ValueError("SUPABASE_URL must use HTTPS")
    payloads = report_payloads(report)
    rows = [
        {
            "symbol": payload["symbol"],
            "generated_at": payload["generatedAt"],
            "run_id": payload["runId"],
            "analysis_mode": payload["analysisMode"],
            "payload": payload,
            "updated_at": payload["generatedAt"],
        }
        for payload in payloads
    ]
    request = urllib.request.Request(
        base_url + "/rest/v1/market_analysis_current?on_conflict=symbol",
        data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
        headers={
            "apikey": service_key,
            "Authorization": "Bearer " + service_key,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30):
            pass
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Supabase sync rejected with HTTP {exc.code}") from exc
    return len(rows)


def _price(value: float) -> str:
    decimals = 2 if abs(float(value)) < 1000 else 0
    text = f"{float(value):,.{decimals}f}"
    return text.replace(",", "X").replace(".", ",").replace("X", ".")
