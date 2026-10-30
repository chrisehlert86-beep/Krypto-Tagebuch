"""Shared, non-generative rules for model inputs and publication.

Never move a model's anchors, widen its invalidation or relabel its count here.
An endpoint check cannot establish lower-degree subdivisions or a unique count.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone

VERSION = "elliott-evidence-v2"
FRAME_MS = {"m30": 1_800_000, "daily": 86_400_000, "weekly": 604_800_000}
MAX_AGE = {"m30": 24 * 3_600_000, "daily": 7 * 86_400_000,
           "weekly": 30 * 86_400_000, "monthly": 90 * 86_400_000}
RATIOS = (0.382, 0.5, 0.618)

AGENT_CONTRACT = """
Verbindlicher Elliott-Evidenzvertrag elliott-evidence-v2:
Entwickle Hypothesen aus abgeschlossenen OHLC-Kerzen. Eine Monats-B, Monats-C
oder Welle 4 ist keine Vorgabe. Ein Range-Zustand ist kein Wellenmuster.
Benutze für den Tagescount nur daily_ohlcv, niemals Monats-/Wochenpreise am
gleichen Zeitstempel. Punkte enthalten exakten Kerzenbeginn in UTC-ms und
exakten OHLC-Preis; erfinde, verschiebe und runde keine Anker.
Für Impulse dokumentiere Start/Welle 0 und die beobachteten Enden Welle 1..5.
Bei laufender Welle N dürfen nur die Enden 0..N-1 als abgeschlossen gelten.
Welle 2 darf den Beginn 1 nicht überschreiten, Welle 3 muss über Ende 1
hinausgehen und darf bei abgeschlossenem Impuls nicht die kürzeste von 1/3/5
sein. Welle 4 darf im klassischen Impuls nicht in Welle 1 überlappen.
Prüfe auch zwischenliegende Wicks. Eine Überlappung belegt keine Diagonale:
Position im Elterncount, Geometrie und Unterteilung brauchen eigene Evidenz.
ABC ist nicht automatisch ein Zigzag. Zigzag hat 5-3-5, Flat 3-3-5;
eine überschießende B ist bei Expanded Flats möglich. Unbekannte Unterteilung
bleibt conditional. Fibonacci-Verhältnisse sind Richtwerte, keine Pflichtziele.
fib_method ist retracement, extension oder projection. Für Start S, Ende E,
Ratio r gilt retracement: E-(E-S)*r; extension: S+(E-S)*r;
projection: O+(E-S)*r mit zusätzlichem fib_projection_origin O.
Die Ratio einer Extension muss >1 sein. Eine C-Projektion braucht drei Anker.
Liefere pattern (impulse/zigzag/flat/diagonal/unclassified), fib_method,
die Anker und mindestens 0.382/0.5/0.618 beim Retracement (bei Extensions
z.B. 1.272/1.618). Nur nachrechenbare Level sind Fibonacci-Level.
Eine Zielzone muss aus den angegebenen Levels ableitbar sein.
Ein gebrochenes Szenario ist terminal invalidiert; verschiebe seinen Stop nicht.
30M darf innerhalb eines Tagesabwärtstrends steigen, benötigt aber eine eigene
aktuelle 30M-Struktur. Ein höherer Schlusskurs bestätigt keinen kleineren Count.
Ein Zielkontakt ist kein bestätigter Long-Einstieg. Trenne Szenario, Trigger,
Bestätigung, Ziel und Invalidierung. Bei fehlender Evidenz WARTEN/conditional.
Externe Quellen sind zeitgebundene Vergleiche, keine eigenen Berechnungen.
""".strip()


def number(value) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Preis muss eine Zahl sein")
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise ValueError("Preis muss endlich und positiv sein")
    return result


def timestamp(value) -> int:
    if isinstance(value, str):
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    return int(value)


def candle_close_time(opened: int, frame: str) -> int:
    if frame in FRAME_MS:
        return opened + FRAME_MS[frame] - 1
    date = datetime.fromtimestamp(opened / 1000, timezone.utc)
    next_month = date.replace(year=date.year + 1, month=1) if date.month == 12 else date.replace(month=date.month + 1)
    return int(next_month.timestamp() * 1000) - 1


def closed_rows(dataset: dict, frame: str = "daily", *, as_of: int | None = None) -> list:
    rows = dataset.get({"m30": "m30_ohlcv"}.get(frame, frame + "_ohlcv"), [])
    cutoff = as_of if as_of is not None else int(dataset.get("current_price_time") or datetime.now(timezone.utc).timestamp() * 1000)
    result = []
    previous = -1
    for row in rows:
        if len(row) < 6 or int(row[0]) <= previous:
            raise ValueError("Kerzen müssen vollständig und streng chronologisch sein")
        previous = int(row[0])
        prices = [number(value) for value in row[1:5]]
        if min(prices) != float(row[3]) or max(prices) != float(row[2]):
            raise ValueError("Ungültige OHLC-Kerze")
        if cutoff and candle_close_time(int(row[0]), frame) > cutoff:
            continue
        result.append(row)
    return result


def _anchored(point: dict, rows: list) -> None:
    price = number(point["price"])
    row = next((row for row in rows if int(row[0]) == int(point["time"])), None)
    if row is None or not any(math.isclose(price, float(value), rel_tol=1e-10, abs_tol=1e-8) for value in row[1:5]):
        raise ValueError(f"Anker {point.get('label', '')} ist nicht exakt an diese Zeitebene gebunden")


def calculated_levels(case: dict, rows: list) -> list[dict]:
    start, end = case["fib_anchor_start"], case["fib_anchor_end"]
    _anchored(start, rows)
    _anchored(end, rows)
    if int(start["time"]) >= int(end["time"]):
        raise ValueError("Fibonacci-Anker müssen streng chronologisch sein")
    s, e = number(start["price"]), number(end["price"])
    if s == e:
        raise ValueError("Fibonacci-Anker müssen eine Bewegung abbilden")
    method = case.get("fib_method")
    if method not in {"retracement", "extension", "projection"}:
        raise ValueError("Fibonacci-Methode und Berechnungsnachweis fehlen")
    origin = case.get("fib_projection_origin")
    if method == "projection":
        if not origin:
            raise ValueError("Eine Projektion benötigt einen dritten Anker")
        _anchored(origin, rows)
        if int(origin["time"]) <= int(end["time"]):
            raise ValueError("Projektionsursprung muss nach dem Ende der gemessenen Welle liegen")
    values = []
    seen = set()
    for item in case.get("fibonacci_levels", []):
        ratio = float(str(item["ratio"]).replace(",", "."))
        if not math.isfinite(ratio) or ratio <= 0 or ratio in seen:
            raise ValueError("Ungültige oder doppelte Fibonacci-Ratio")
        seen.add(ratio)
        if method == "retracement":
            if ratio >= 1:
                raise ValueError("Retracement-Ratio muss unter 1 liegen")
            price, formula = e - (e - s) * ratio, f"{e} - ({e} - {s}) * {ratio}"
        elif method == "extension":
            if ratio <= 1:
                raise ValueError("Extension-Ratio muss über 1 liegen")
            price, formula = s + (e - s) * ratio, f"{s} + ({e} - {s}) * {ratio}"
        else:
            o = number(origin["price"])
            price, formula = o + (e - s) * ratio, f"{o} + ({e} - {s}) * {ratio}"
        if price <= 0:
            raise ValueError("Fibonacci-Berechnung ergibt keinen positiven Preis")
        if "price" in item and not math.isclose(number(item["price"]), price, rel_tol=1e-9, abs_tol=0.005):
            raise ValueError("Fibonacci-Preis widerspricht der angegebenen Methode und den Ankern")
        values.append({"ratio": str(ratio), "price": price, "role": item.get("role", "target"),
                       "method": method, "formula": formula, "anchorStart": dict(start), "anchorEnd": dict(end),
                       **({"projectionOrigin": dict(origin)} if origin else {})})
    if len(values) < 2:
        raise ValueError("Mindestens zwei berechnete Levels erforderlich")
    return values


def wave_number(label: str) -> str | None:
    text = label.strip().lower()
    match = re.search(r"(?:welle|wave|w)\s*([0-5abc])\b", text)
    if match:
        return match.group(1)
    if text in {"0", "1", "2", "3", "4", "5", "a", "b", "c"}:
        return text
    if re.search(r"\b(start|ursprung|origin)\b", text):
        return "0"
    return None


def audit_case(case: dict, dataset: dict, direction: str, *, frame: str = "daily", as_of: int | None = None) -> dict:
    """Return evidence, never a repaired count. Any error blocks publication."""
    try:
        if direction not in {"bull", "bear"} or case.get("case_direction") != direction:
            raise ValueError("Falsche Szenariorichtung")
        rows = closed_rows(dataset, frame, as_of=as_of)
        if len(rows) < 2:
            raise ValueError("Zu wenige abgeschlossene Kerzen")
        points = case.get("wave_points", [])
        if len(points) < 2:
            raise ValueError("Wellenanker fehlen")
        times = [int(p["time"]) for p in points]
        if times != sorted(set(times)):
            raise ValueError("Wellenpunkte sind nicht streng chronologisch")
        for point in points:
            _anchored(point, rows)
        levels = calculated_levels(case, rows)
        wave = case.get("current_wave") or {}
        if wave.get("degree") != frame:
            raise ValueError("Wellengrad und Ausführungszeitebene stimmen nicht überein")
        labels = {}
        for p in points:
            key = wave_number(str(p.get("label", "")))
            if key is not None:
                if key in labels:
                    raise ValueError("Wellenenden sind mehrfach bezeichnet")
                labels[key] = p
        pattern = case.get("pattern", "unclassified")
        sign = 1 if direction == "bull" else -1
        current_wave = wave_number(str(wave.get("label", "")))
        confirmed = wave.get("status") == "confirmed"
        warnings = []
        if pattern == "impulse":
            upto = int(current_wave) if current_wave and current_wave.isdigit() else 5
            required_end = upto if confirmed else max(0, upto - 1)
            required = [str(i) for i in range(required_end + 1)]
            if any(key not in labels for key in required) or required_end < 2:
                raise ValueError("Impulsbehauptung ohne Start und erforderliche Wellenenden")
            keys = [str(i) for i in range(6) if str(i) in labels]
            if [int(labels[k]["time"]) for k in keys] != sorted(int(labels[k]["time"]) for k in keys):
                raise ValueError("Wellenreihenfolge widerspricht den Labels")
            for i in range(1, 6):
                if str(i) not in labels or str(i-1) not in labels:
                    continue
                move = (number(labels[str(i)]["price"]) - number(labels[str(i-1)]["price"])) * sign
                if (i % 2 == 1 and move <= 0) or (i % 2 == 0 and move >= 0):
                    raise ValueError("Impulswellen alternieren nicht regelkonform")
            if "2" in labels and (labels["2"]["price"] - labels["0"]["price"]) * sign <= 0:
                raise ValueError("Welle 2 verletzt den Beginn von Welle 1")
            if "3" in labels and (labels["3"]["price"] - labels["1"]["price"]) * sign <= 0:
                raise ValueError("Welle 3 überschreitet Ende Welle 1 nicht")
            # The wicks inside W2 and W4 matter, not just their labelled ends.
            for n, origin_key in ((2, "0"), (4, "1")):
                begin = labels.get(str(n-1))
                finish = labels.get(str(n))
                if not begin or origin_key not in labels or (not finish and upto < n):
                    continue
                until = int(finish["time"]) if finish else int(rows[-1][0])
                sample = [r for r in rows if int(begin["time"]) < int(r[0]) <= until]
                adverse = min((float(r[3]) for r in sample), default=math.inf) if sign == 1 else max((float(r[2]) for r in sample), default=-math.inf)
                if (adverse - number(labels[origin_key]["price"])) * sign <= 0:
                    raise ValueError(f"Welle {n} verletzt die Impulsregel durch einen Wick")
            if "5" in labels:
                lengths = [abs(labels[str(i)]["price"] - labels[str(i-1)]["price"]) for i in (1, 3, 5)]
                if lengths[1] < min(lengths[0], lengths[2]):
                    raise ValueError("Welle 3 ist die kürzeste Impulswelle")
            warnings.append("Endpunktregeln geprüft; interne 5-3-5-3-5-Unterteilung bleibt gesondert nachzuweisen")
        elif pattern in {"zigzag", "flat"}:
            required = ("0", "a", "b") if not confirmed else ("0", "a", "b", "c")
            if any(key not in labels for key in required):
                raise ValueError("Korrekturbehauptung ohne Start und A/B-Anker")
            seq = [labels[k] for k in ("0", "a", "b", "c") if k in labels]
            if [p["time"] for p in seq] != sorted(p["time"] for p in seq):
                raise ValueError("ABC-Reihenfolge ist falsch")
            moves = [(b["price"] - a["price"]) * sign for a, b in zip(seq, seq[1:])]
            if any((i % 2 == 0 and m <= 0) or (i % 2 == 1 and m >= 0) for i, m in enumerate(moves)):
                raise ValueError("ABC-Richtung ist widersprüchlich")
            if pattern == "zigzag" and (labels["b"]["price"] - labels["0"]["price"]) * sign <= 0:
                raise ValueError("Zigzag-B überschreitet den Beginn von A")
            warnings.append("Korrektur-Unterteilung 5-3-5 bzw. 3-3-5 nicht aus Endpunkten allein belegt")
        else:
            warnings.append("Kein vollständig prüfbarer Elliott-Count; Diagonalen brauchen eigene Positions-, Geometrie- und Unterteilungsnachweise")
        trigger, invalidation = number(case["trigger"]), number(case["invalidation"])
        if pattern == "impulse" and current_wave in {"2", "3", "4", "5"}:
            invalidation_key = {"2": "0", "3": "2", "4": "1", "5": "4"}[current_wave]
            if invalidation_key not in labels or not math.isclose(invalidation, number(labels[invalidation_key]["price"]), rel_tol=1e-10, abs_tol=1e-8):
                raise ValueError("Invalidierung passt nicht zur behaupteten laufenden Impulswelle")
        if (trigger - invalidation) * sign <= 0:
            raise ValueError("Trigger und Invalidierung widersprechen der Richtung")
        # An invalidation is a declared structural point, never a movable stop.
        if not any(math.isclose(invalidation, number(p["price"]), rel_tol=1e-10, abs_tol=1e-8) for p in points):
            raise ValueError("Invalidierung besitzt keinen deklarierten Strukturanker")
        current = number(dataset.get("current_price", rows[-1][4]))
        broken = (current - invalidation) * sign <= 0
        # Replay every candle after the last supplied structural endpoint. A recovery
        # above the invalidation never revives a scenario that already broke.
        for row in rows:
            if int(row[0]) > times[-1] and (float(row[4]) - invalidation) * sign <= 0:
                broken = True
        if broken:
            raise ValueError("Szenario bereits invalidiert; eine Kurserholung reaktiviert es nicht")
        target = sorted(number(v) for v in case.get("target_zone", []))
        if len(target) != 2 or any(not any(math.isclose(v, level["price"], abs_tol=0.005, rel_tol=1e-9) for level in levels) for v in target):
            raise ValueError("Zielzone ist nicht aus den angegebenen Fibonacci-Levels berechnet")
        if any((v - trigger) * sign <= 0 for v in target):
            raise ValueError("Zielzone liegt nicht jenseits des Bestätigungstriggers")
        if any((current - value) * sign >= 0 for value in target):
            raise ValueError("Die Zielzone wurde bereits erreicht; kein neues aktives Ziel")
        for row in rows:
            if int(row[0]) > times[-1]:
                extreme = float(row[2]) if sign == 1 else float(row[3])
                if any((extreme - value) * sign >= 0 for value in target):
                    raise ValueError("Die Zielzone wurde im Szenarioverlauf bereits berührt")
        # Endpoint geometry alone never proves the required internal subdivisions.
        # No recursive structure verifier exists in this release. In particular,
        # never trust a model-supplied structureVerified/subdivision_verified flag.
        return {"version": VERSION, "status": "conditional", "violations": [],
                "verificationStage": "endpoints_verified", "structureVerified": False,
                "warnings": warnings, "levels": levels, "triggerConfirmed": (float(rows[-1][4]) - trigger) * sign > 0,
                "asOf": candle_close_time(int(rows[-1][0]), frame), "invalidation": invalidation}
    except (ValueError, KeyError, TypeError, OverflowError, IndexError) as exc:
        return {"version": VERSION, "status": "invalid", "violations": [str(exc)], "warnings": [], "levels": [], "triggerConfirmed": False}


def case_id(symbol: str, frame: str, case: dict) -> str:
    content = {k: case.get(k) for k in ("case_direction", "pattern", "wave_points", "fib_method", "fib_anchor_start", "fib_anchor_end", "fib_projection_origin", "trigger", "invalidation", "target_zone")}
    return hashlib.sha256(json.dumps([symbol, frame, content], sort_keys=True).encode()).hexdigest()[:24]
