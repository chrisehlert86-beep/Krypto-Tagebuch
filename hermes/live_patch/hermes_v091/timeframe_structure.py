from __future__ import annotations

from datetime import datetime, timezone


FIB_RATIOS = (("0.382", 0.382), ("0.5", 0.5), ("0.618", 0.618))

# The recurring MCO principles are encoded here instead of being left as
# prompt-only knowledge.  Every analysis receives the same machine-readable
# contract and the rules below are covered by regression tests.
MCO_RULES = [
    {"id": "TF-01", "rule": "Monat ist Elterncount, Woche bestaetigt, Tag bildet Unterwellen.", "enforcement": "deterministic"},
    {"id": "RANGE-01", "rule": "Zwischen Support und Widerstand bleibt eine Zeitebene Range.", "enforcement": "deterministic"},
    {"id": "CLOSE-01", "rule": "Nur der Schluss einer abgeschlossenen Kerze kann einen Ausbruch bestaetigen.", "enforcement": "deterministic"},
    {"id": "EW-01", "rule": "Ein lokaler Ruecksetzer ist nicht automatisch die uebergeordnete C-Welle.", "enforcement": "audit"},
    {"id": "FIB-01", "rule": "38,2 %, 50 % und 61,8 % sind die primaeren Retracement-Marken.", "enforcement": "deterministic"},
    {"id": "ALT-01", "rule": "Am Scheideweg muessen Bull- und Bear-Case gleichzeitig erhalten bleiben.", "enforcement": "audit"},
    {"id": "MA-01", "rule": "MA50 und markante Hochs/Tiefs sind zeitebenenspezifische Referenzen, keine alleinigen Trendsignale.", "enforcement": "deterministic"},
]

# Confirmed structural ranges are kept fixed until a closing-price breakout.
# Otherwise a rolling window would move the boundary after the breakout and
# incorrectly continue to call the new price a range.
CONFIRMED_DAILY_RANGES = {}  # No user-price overrides in computed market structure.


def _state(price: float, support: list[float], resistance: list[float]) -> str:
    if price < min(support):
        return "bearish_breakdown"
    if price > max(resistance):
        return "bullish_breakout"
    return "range"


def _body_zone(rows: list[list], *, side: str) -> list[float]:
    if side == "support":
        wick = min(float(row[3]) for row in rows)
        body = min(min(float(row[1]), float(row[4])) for row in rows)
    else:
        wick = max(float(row[2]) for row in rows)
        body = max(max(float(row[1]), float(row[4])) for row in rows)
    return sorted([wick, body])


def _pivot_zones(rows: list[list], *, radius: int = 2, lookback: int = 120) -> dict[str, list[list[float]]]:
    """Return confirmed fractal zones; the unconfirmed edge is never used."""
    sample = rows[-lookback:]
    if len(sample) < radius * 2 + 1:
        return {"support": [], "resistance": []}
    supports: list[tuple[int, list[float]]] = []
    resistances: list[tuple[int, list[float]]] = []
    for index in range(radius, len(sample) - radius):
        row = sample[index]
        window = sample[index - radius:index + radius + 1]
        low, high = float(row[3]), float(row[2])
        if low == min(float(item[3]) for item in window):
            supports.append((int(row[0]), sorted([low, min(float(row[1]), float(row[4]))])))
        if high == max(float(item[2]) for item in window):
            resistances.append((int(row[0]), sorted([max(float(row[1]), float(row[4])), high])))

    def deduplicate(items: list[tuple[int, list[float]]]) -> list[list[float]]:
        result: list[tuple[int, list[float]]] = []
        for stamp, zone in sorted(items, reverse=True):
            midpoint = sum(zone) / 2
            if any(abs(midpoint - sum(existing) / 2) / max(midpoint, 1) < 0.0075 for _, existing in result):
                continue
            result.append((stamp, zone))
        return [zone for _, zone in result[:8]]

    return {"support": deduplicate(supports), "resistance": deduplicate(resistances)}


def _structural_zones(rows: list[list], current: float, *, lookback: int) -> tuple[list[float], list[float], list[list[float]], list[list[float]]]:
    pivots = _pivot_zones(rows, lookback=lookback)
    all_zones = pivots["support"] + pivots["resistance"]
    below = sorted(
        (zone for zone in all_zones if sum(zone) / 2 <= current),
        key=lambda zone: current - sum(zone) / 2,
    )
    above = sorted(
        (zone for zone in all_zones if sum(zone) / 2 > current),
        key=lambda zone: sum(zone) / 2 - current,
    )
    fallback_rows = rows[-min(len(rows), max(10, lookback // 3)):]
    support = below[0] if below else _body_zone(fallback_rows, side="support")
    resistance = above[0] if above else _body_zone(fallback_rows, side="resistance")
    return support, resistance, below[:4], above[:4]


def _key_level(value: float, current: float, name: str) -> dict:
    tolerance = value * 0.0025
    if current > value + tolerance:
        role = "support_after_reclaim"
    elif current < value - tolerance:
        role = "resistance"
    else:
        role = "decision_level"
    return {"name": name, "price": value, "role": role}


def build_timeframe_structure(dataset: dict) -> dict:
    """Build a deterministic top-down frame before any model interprets waves.

    The monthly leg owns the parent hypothesis. Weekly and daily analyses may
    refine it, but must not silently promote a local move to a cycle-degree C.
    """
    monthly = dataset.get("monthly_ohlcv", [])
    weekly = dataset.get("weekly_ohlcv", [])
    daily = dataset.get("daily_ohlcv", [])
    if len(monthly) < 3:
        return {
            "status": "insufficient_monthly_data",
            "hierarchy_rule": "monthly > weekly > daily",
            "monthly": {}, "weekly": {}, "daily": {},
        }

    high_index = max(range(len(monthly)), key=lambda index: float(monthly[index][2]))
    low_index = high_index + min(
        range(len(monthly) - high_index),
        key=lambda offset: float(monthly[high_index + offset][3]),
    )
    high_row, low_row = monthly[high_index], monthly[low_index]
    cycle_high, cycle_low = float(high_row[2]), float(low_row[3])
    span = cycle_high - cycle_low
    levels = [
        {"ratio": ratio, "price": cycle_low + span * factor, "role": "B_retracement_resistance"}
        for ratio, factor in FIB_RATIOS
    ]
    current = float(dataset.get("current_price", monthly[-1][4]))
    if current < levels[0]["price"]:
        progress = "below_0.382"
    elif current < levels[1]["price"]:
        progress = "between_0.382_and_0.5"
    elif current < levels[2]["price"]:
        progress = "between_0.5_and_0.618"
    else:
        progress = "at_or_above_0.618"

    confirmed_range = CONFIRMED_DAILY_RANGES.get(str(dataset.get("symbol", "")).upper())
    if confirmed_range:
        daily_range = [row for row in daily if int(row[0]) >= int(confirmed_range["start"])]
        daily_support = list(confirmed_range["support_zone"])
        daily_resistance = list(confirmed_range["resistance_zone"])
        daily_supports, daily_resistances = [daily_support], [daily_resistance]
    else:
        daily_range = daily[-90:] if len(daily) >= 90 else daily
        daily_support, daily_resistance, daily_supports, daily_resistances = _structural_zones(
            daily[:-1] or daily, float(daily[-2][4] if len(daily) > 1 else daily[-1][4]), lookback=120,
        )
    daily_close = float(daily[-1][4])
    daily_state = _state(daily_close, daily_support, daily_resistance)

    weekly_closes = [float(row[4]) for row in weekly]
    weekly_ma50 = sum(weekly_closes[-50:]) / 50 if len(weekly_closes) >= 50 else None
    latest_year = datetime.fromtimestamp(int(daily[-1][0]) / 1000, timezone.utc).year
    may_rows = [
        row for row in daily
        if (stamp := datetime.fromtimestamp(int(row[0]) / 1000, timezone.utc)).year == latest_year and stamp.month == 5
    ]
    may_high = max((float(row[2]) for row in may_rows), default=None)
    weekly_close = float(weekly[-1][4])
    post_low_weekly = [row for row in weekly if int(row[0]) >= int(low_row[0])] or weekly[-52:]
    weekly_support, weekly_resistance, weekly_supports, weekly_resistances = _structural_zones(
        post_low_weekly, weekly_close, lookback=104,
    )
    weekly_key_levels = [
        _key_level(value, weekly_close, name)
        for value, name in ((weekly_ma50, "MA50"), (may_high, "Mai-Hoch"))
        if value is not None
    ]
    resistance_refs = [item["price"] for item in weekly_key_levels if item["role"] in {"resistance", "decision_level"}]
    support_refs = [item["price"] for item in weekly_key_levels if item["role"] == "support_after_reclaim"]
    if resistance_refs:
        nearest = min(resistance_refs)
        weekly_resistance = sorted([nearest * 0.9975, nearest * 1.0025])
    if support_refs:
        nearest = max(support_refs)
        weekly_support = sorted([nearest * 0.9975, nearest * 1.0025])
    weekly_state = _state(weekly_close, weekly_support, weekly_resistance)
    monthly_support = sorted([cycle_low, min(float(low_row[1]), float(low_row[4]))])
    monthly_resistance = [levels[0]["price"] * 0.9975, levels[0]["price"] * 1.0025]
    monthly_close = float(monthly[-1][4])
    monthly_state = _state(monthly_close, monthly_support, monthly_resistance)

    return {
        "status": "ok",
        "hierarchy_rule": "monthly > weekly > daily",
        "ruleset": {"name": "MCO-top-down-v1", "rules": MCO_RULES},
        "data_quality": {
            "closed_candles_only": True,
            "daily_last_closed_open_time": int(daily[-1][0]),
            "weekly_last_closed_open_time": int(weekly[-1][0]),
            "monthly_last_closed_open_time": int(monthly[-1][0]),
        },
        "interpretation_rules": [
            "Der Monatscount ist der Elterncount; Wochen- und Tagescounts sind Unterwellen.",
            "Monats-B und Monats-C sind Hypothesen, die aus Wellenstruktur gesondert belegt werden müssen.",
            "Lokaler Abwärtsimpuls und übergeordnete C benötigen getrennte Strukturbelege.",
            "Bull- und Bear-Fälle auf Tagesebene bleiben am Scheideweg gleichzeitig zulässig.",
            "Solange der Schlusskurs zwischen Support- und Widerstandszone der jeweiligen Zeitebene liegt, ist ihr Zustand Range und weder bullisch noch bärisch.",
            "Intraday-Bewegungen innerhalb einer Range dürfen nur als intern bullisch oder bärisch bezeichnet werden.",
            "Ein Zustandswechsel benötigt einen bestätigten Schlusskurs außerhalb der jeweiligen Range; ein Wick allein genügt nicht.",
        ],
        "monthly": {
            "timeframe": "1M",
            "degree": "cycle_or_primary",
            "primary_scenario": "unconfirmed_parent_hypothesis",
            "a_leg": {
                "high": {"time": int(high_row[0]), "price": cycle_high},
                "low": {"time": int(low_row[0]), "price": cycle_low},
            },
            "b_retracement_levels": levels,
            "b_progress": progress,
            "expected_b_zone": [levels[1]["price"], levels[2]["price"]],
            "c_wave_status": "not_confirmed",
            "support_zone": monthly_support,
            "resistance_zone": monthly_resistance,
            "state": monthly_state,
            "state_close": monthly_close,
            "note": "C erst nach bestätigtem Abschluss beziehungsweise Scheitern der B-Welle als laufend werten.",
        },
        "weekly": {
            "timeframe": "1W",
            "role": "structure_and_confirmation",
            "available_candles": len(weekly),
            "state": weekly_state,
            "state_close": weekly_close,
            "support_zone": weekly_support,
            "resistance_zone": weekly_resistance,
            "support_zones": weekly_supports,
            "resistance_zones": weekly_resistances,
            "ma50": weekly_ma50,
            "may_high": may_high,
            "key_levels": weekly_key_levels,
            "confirmation": "weekly_close",
            "instruction": "Prüft die Wochenstruktur und alternative Elterncounts ohne vorgegebene Wellenzählung.",
        },
        "daily": {
            "timeframe": "1D",
            "role": "decision_and_execution_structure",
            "available_candles": len(daily),
            "state": daily_state,
            "state_close": daily_close,
            "range_start": int(daily_range[0][0]),
            "support_zone": daily_support,
            "resistance_zone": daily_resistance,
            "support_zones": daily_supports,
            "resistance_zones": daily_resistances,
            "confirmation": "daily_close",
            "range_source": confirmed_range.get("source") if confirmed_range else "rolling_25_closed_candles",
            "instruction": "Behandelt Bewegungen innerhalb der Range nur als interne Schwankungen; keine Richtungsbestätigung vor bestätigtem Schlusskursausbruch.",
        },
    }
