from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from macro_waves.analysis_teams import (
    MODE_PROFILES,
    SPECIALIST_SCHEMA,
    compact_dataset,
    compact_rule_dataset,
    normalize_mode,
)
from macro_waves.config import OPENROUTER_API, Settings
from macro_waves.openrouter import _request_model_json, analyze_structured
from .diagnostics import make_issue
from .model_contracts import validate_json_schema
from .analysis_contract import AGENT_CONTRACT, VERSION, audit_case, calculated_levels
from .agent_qualification import require_qualification


OPENROUTER_GPT_WORKER_MODEL = "openai/gpt-5.6-luna"
OPENROUTER_GPT_RULE_LEAD_MODEL = "openai/gpt-5.6-luna-pro"


def _schema_for_expected(expected: set[str]) -> dict:
    # Compatibility for older callers, with real nested field definitions rather
    # than a root-key-only pseudo-schema. Production callers pass their contract.
    for contract in (SPECIALIST_SCHEMA, DIRECTIONAL_CASE_SCHEMA, DIRECTIONAL_RULE_SCHEMA):
        if expected <= contract["properties"].keys():
            return {
                "type": "object", "additionalProperties": False,
                "required": sorted(expected),
                "properties": {key: contract["properties"][key] for key in sorted(expected)},
            }
    raise ValueError("An explicit JSON schema is required for these output fields")


def _run_openrouter_json(
    settings: Settings,
    model: str,
    prompt: str,
    evidence: dict,
    *,
    expected: set[str],
    max_tokens: int,
    schema: dict | None = None,
    validator: Callable[[dict], None] | None = None,
    validation_attempts: int = 3,
) -> dict:
    """Use an explicit, locally enforced contract on every routed-provider attempt."""
    prompt = AGENT_CONTRACT + "\n\n" + prompt
    schema = schema if schema is not None else _schema_for_expected(expected)
    if set(schema.get("required", [])) != expected:
        raise ValueError("JSON schema required fields must match expected fields")
    if validation_attempts < 1:
        raise ValueError("validation_attempts must be positive")
    schema_text = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    base_messages = [
        {"role": "system", "content": (
            prompt + " Gib ausschließlich ein vollständiges JSON-Objekt ohne Markdown aus. "
            "Der folgende verbindliche JSON-Schema-Vertrag beschreibt ALLE Felder, verschachtelten Objekte, "
            "Datentypen und erlaubten Statuswerte. Keine zusätzlichen Felder oder äußere Ergebnis-Hülle.\n"
            + schema_text
        )},
        {"role": "user", "content": json.dumps(evidence, ensure_ascii=False)},
    ]
    messages = list(base_messages)
    last_error = "unknown"
    repair_errors: list[str] = []
    for attempt in range(validation_attempts):
        response = _request_model_json(
            OPENROUTER_API,
            method="POST",
            headers={
                "Authorization": f"Bearer {settings.openrouter_key or ''}",
                "HTTP-Referer": "https://krypto-tagebuch.vercel.app",
                "X-Title": "Krypto Tagebuch Rule Teams",
            },
            body={
                "model": model,
                "messages": messages,
                "temperature": 0,
                "max_tokens": max_tokens,
            },
        )
        response_data = response if isinstance(response, dict) else {}
        try:
            choice = response_data["choices"][0]
            if not isinstance(choice, dict) or not isinstance(choice.get("message"), dict):
                raise ValueError("choices[0].message must be an object")
            content = choice["message"].get("content")
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            choice = {}
            content = None
            last_error = f"response without choices/message: {exc}"
        if not isinstance(content, str) or not content.strip():
            if choice:
                last_error = f"empty response (finish_reason={choice.get('finish_reason')})"
        else:
            normalized = content.strip()
            if normalized.startswith("```"):
                normalized = re.sub(r"^```(?:json)?\s*|\s*```$", "", normalized).strip()
            try:
                if choice.get("finish_reason") in {"length", "content_filter"}:
                    raise ValueError(f"incomplete model response: finish_reason={choice['finish_reason']}")
                result = json.loads(normalized)
                validate_json_schema(result, schema)
                if validator:
                    validator(result)
                result["model"] = model
                result["usage"] = response_data.get("usage", {})
                if repair_errors:
                    result["diagnostic_issues"] = [
                        make_issue(error, provider="openrouter", model=model,
                                   stage="output_validation", recovered=True,
                                   category="invalid_response")
                        for error in repair_errors
                    ]
                return result
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                last_error = str(exc)[:1200]
        repair_errors.append(last_error)
        if attempt + 1 < validation_attempts:
            messages = base_messages + [{
                "role": "user",
                "content": (
                    f"Der vorherige Versuch war unvollständig oder ungültig: {last_error}. "
                    "Erzeuge den gesamten JSON-Entwurf neu gemäß dem vollständigen Schema in der Systemnachricht. "
                    "Verwende exakt die geforderten verschachtelten Felder, Typen und erlaubten Statuswerte; "
                    "je Zielzone exakt zwei Zahlen und ausschließlich gelieferte OHLC-Anker. "
                    "Kürze Freitext, nicht die Datenstruktur."
                ),
            }]
            time.sleep(min(2**attempt, 4))
    raise ValueError(
        f"OpenRouter JSON validation failed (model={model}) after {validation_attempts} attempts: {last_error}"
    )


POINT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["label", "time", "price"],
    "properties": {
        "label": {"type": "string"},
        "time": {"type": "integer"},
        "price": {"type": "number"},
    },
}

ZONE_SCHEMA = {
    "type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2,
}

DIRECTIONAL_CASE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "case_direction", "pattern", "fib_method", "scenario", "market_state", "current_wave", "wave_points",
        "trigger", "invalidation", "target_zone", "support_zones", "resistance_zones",
        "fib_anchor_start", "fib_anchor_end", "fibonacci_levels", "macro_view",
        "evidence", "contradictions", "confidence",
    ],
    "properties": {
        "case_direction": {"type": "string", "enum": ["bull", "bear"]},
        "pattern": {"type": "string", "enum": ["impulse", "zigzag", "flat", "diagonal", "unclassified"]},
        "fib_method": {"type": "string", "enum": ["retracement", "extension", "projection"]},
        "fib_projection_origin": POINT_SCHEMA,
        "scenario": {"type": "string"},
        "market_state": {"type": "string", "enum": ["trend", "sideways", "decision_zone"]},
        "current_wave": {
            "type": "object", "additionalProperties": False,
            "required": ["label", "degree", "status", "interpretation"],
            "properties": {
                "label": {"type": "string"}, "degree": {"type": "string", "enum": ["daily"]},
                "status": {"type": "string", "enum": ["forming", "correcting", "complete_unconfirmed", "confirmed", "unclear"]},
                "interpretation": {"type": "string"},
            },
        },
        "wave_points": {"type": "array", "items": POINT_SCHEMA, "minItems": 2, "maxItems": 10},
        "trigger": {"type": "number"},
        "invalidation": {"type": "number"},
        "target_zone": ZONE_SCHEMA,
        "support_zones": {"type": "array", "items": ZONE_SCHEMA},
        "resistance_zones": {"type": "array", "items": ZONE_SCHEMA},
        "fib_anchor_start": POINT_SCHEMA,
        "fib_anchor_end": POINT_SCHEMA,
        "fibonacci_levels": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["ratio", "price", "role"],
                "properties": {
                    "ratio": {"type": "string"}, "price": {"type": "number"},
                    "role": {"type": "string", "enum": ["support", "resistance", "target"]},
                },
            },
            "minItems": 2,
        },
        "macro_view": {
            "type": "object", "additionalProperties": False,
            "required": ["wave_label", "degree", "status", "interpretation", "target_zone", "invalidation", "horizon"],
            "properties": {
                "wave_label": {"type": "string"}, "degree": {"type": "string"},
                "status": {"type": "string"}, "interpretation": {"type": "string"},
                "target_zone": ZONE_SCHEMA, "invalidation": {"type": "number"},
                "horizon": {"type": "string"},
            },
        },
        "evidence": {"type": "array", "items": {"type": "string"}},
        "contradictions": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
}

DIRECTIONAL_RULE_SCHEMA: dict[str, Any] = {
    "type": "object", "additionalProperties": False,
    "required": ["verdict", "bull_status", "bear_status", "hard_violations", "warnings", "required_corrections", "confidence"],
    "properties": {
        "verdict": {"type": "string", "enum": ["bull", "bear", "both_valid", "neither_valid"]},
        "bull_status": {"type": "string", "enum": ["valid", "conditional", "invalid"]},
        "bear_status": {"type": "string", "enum": ["valid", "conditional", "invalid"]},
        "hard_violations": {"type": "array", "items": {"type": "string"}},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "required_corrections": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
}

TEAM_ROLES = {
    "bull": [
        ("bull_current_wave", "gemini", "Prüfe unabhängig den bullischen Tagescount mit exakten Endpunkten ab Welle 0; verwerfe ihn bei Regelbruch."),
        ("bull_fibonacci", "gpt", "Berechne aus gültigen OHLC-Ankern die nächsten Fibonacci-Unterstützungen, Widerstände und bullischen Zielzonen der aktuellen Welle."),
        ("bull_confirmation", "claude", "Prüfe Momentum, Marktstruktur, Volumen, Derivate und Quellen ausschließlich auf Bestätigung oder Schwächung des Bull-Case."),
        ("bull_macro", "gemini", "Prüfe alternative Elterncounts aus Monatsdaten, ohne eine B oder große Welle 4 vorauszusetzen."),
    ],
    "bear": [
        ("bear_current_wave", "claude", "Prüfe den bärischen Tagescount unabhängig und trenne lokalen Abwärtsimpuls von einer gesondert belegten übergeordneten C."),
        ("bear_fibonacci", "gpt", "Berechne aus gültigen OHLC-Ankern die nächsten Fibonacci-Widerstände, Unterstützungen und bärischen Zielzonen der aktuellen Welle."),
        ("bear_confirmation", "gemini", "Prüfe Momentum, Marktstruktur, Volumen, Derivate und Quellen ausschließlich auf Bestätigung oder Schwächung des Bear-Case."),
        ("bear_macro", "claude", "Prüfe übergeordnete bärische Alternativen und ihren Bestätigungsstand ohne vorgegebenen Monatscount."),
    ],
}

RULE_ROLES = [
    ("elliott_hierarchy", "Prüfe beide Counts auf Elliott-Regeln und korrekte Trennung der Wellengrade. Bull und Bear dürfen unterschiedliche gültige Zählungen vertreten."),
    ("anchors_and_fibonacci", "Prüfe OHLC-Anker, Chronologie, Fibonacci-Arithmetik, Zonen, Trigger und Invalidierungen beider Fälle."),
    ("directional_integrity", "Prüfe, dass das Bullenteam nur einen echten Bull-Case und das Bärenteam nur einen echten Bear-Case erzeugt und keine Richtung als bestätigt ausgibt, solange Trigger fehlen."),
    ("macro_and_method_audit", "Prüfe aktuelle Welle gegen Makrowelle, Methodendisziplin, Scheingenauigkeit und die große Welle-4-Alternative."),
]


def directional_leader_model(settings: Settings, direction: str) -> str:
    return settings.gemini_model if direction == "bull" else settings.claude_model


def _validate_specialist(result: dict, role: str) -> None:
    validate_json_schema(result, SPECIALIST_SCHEMA)
    if result["role"] != role:
        raise ValueError(f"$.role: expected exactly {role}")


def _specialist_result(role: str, future: Any, *, team: str, model: str) -> dict:
    try:
        result = future.result()
    except Exception as exc:
        issue = make_issue(exc, team=team, provider="openrouter", model=model,
                           stage=f"specialist:{role}", fallback=True)
        return {"role": role, "status": "unavailable", "model": model,
                "error": issue["message"], "diagnostic_issues": [issue]}
    for issue in result.get("diagnostic_issues", []):
        if not issue.get("team"):
            issue["team"] = team
        issue["stage"] = f"specialist:{role}"
    return result


def _deterministic_specialist(role: str, reason: str) -> dict:
    return {
        "role": role,
        "conclusion": "Keine valide KI-Spezialistenbewertung; deterministische Marktstruktur wird als Ersatz verwendet.",
        "evidence": ["Abgeschlossene OHLCV-Kerzen", "Deterministische Zeitrahmenstruktur"],
        "contradictions": [reason[:600]],
        "rule_checks": [{
            "rule": "Degraded-mode",
            "status": "warning",
            "reason": "Keine modellbasierte Spezialistenbewertung verfügbar.",
        }],
        "confidence": 0.0,
        "model": "deterministic-fallback",
        "provider_family": "deterministic",
    }


def build_deterministic_directional_case(dataset: dict, direction: str, reason: str) -> dict:
    from .analysis_contract import closed_rows
    rows = closed_rows(dataset)
    if len(rows) < 2:
        raise ValueError("Mindestens zwei geschlossene Tageskerzen erforderlich")
    # This is an explicitly unclassified reference, never a fabricated Elliott count.
    start_index = min(range(len(rows)-1), key=lambda i: float(rows[i][3]))
    end_index = max(range(start_index+1, len(rows)), key=lambda i: float(rows[i][2]))
    s = {"label": "Strukturtief (kein Wellenlabel)", "time": int(rows[start_index][0]), "price": float(rows[start_index][3])}
    e = {"label": "Strukturhoch (kein Wellenlabel)", "time": int(rows[end_index][0]), "price": float(rows[end_index][2])}
    current = float(dataset.get("current_price", rows[-1][4]))
    method = "extension" if direction == "bull" else "retracement"
    ratios = (1.272, 1.618) if direction == "bull" else (0.382, 0.5, 0.618)
    case = {
        "case_direction": direction, "pattern": "unclassified", "fib_method": method,
        "scenario": "Keine belastbare KI-Zählung; WARTEN.", "market_state": "decision_zone",
        "current_wave": {"label": "Wellenzählung offen", "degree": "daily", "status": "unclear", "interpretation": "Keine bestätigte Elliott-Struktur verfügbar."},
        "wave_points": [s, e], "fib_anchor_start": dict(s), "fib_anchor_end": dict(e),
        "trigger": e["price"] if direction == "bull" else s["price"],
        "invalidation": s["price"] if direction == "bull" else e["price"],
        "fibonacci_levels": [{"ratio": str(r), "role": "target"} for r in ratios],
        "support_zones": [], "resistance_zones": [], "target_zone": [0, 0],
        "macro_view": {"wave_label": "Elterncount offen", "degree": "monthly", "status": "unclear", "interpretation": "Kein Monats-B- oder C-Count vorgegeben.", "target_zone": [0, 0], "invalidation": 0, "horizon": "offen"},
        "evidence": ["Abgeschlossene Tageskerzen"], "contradictions": [reason[:600]], "confidence": 0.0,
        "model": "deterministic-fallback",
    }
    computed = calculated_levels(case, rows)
    case["fibonacci_levels"] = [{k: level[k] for k in ("ratio", "price", "role")} for level in computed]
    case["target_zone"] = sorted([computed[0]["price"], computed[1]["price"]])
    case["elliott_validation"] = audit_case(case, dataset, direction)
    return case


def run_directional_team(
    settings: Settings,
    dataset: dict,
    *,
    direction: str,
    mode: str,
    repair_context: dict | None = None,
) -> dict:
    if direction not in {"bull", "bear"}:
        raise ValueError("direction must be bull or bear")
    mode = normalize_mode(mode)
    profile = MODE_PROFILES[mode]
    compact = compact_dataset(dataset, method_limit=int(profile["methods"]))
    assignments = TEAM_ROLES[direction][: int(profile["workers"])]
    leader_model = directional_leader_model(settings, direction)
    reasoning = str(profile["gemini_reasoning"]) if direction == "bull" else None

    def produce(assignment: tuple[str, str, str]) -> dict:
        role, provider, task = assignment
        model = OPENROUTER_GPT_WORKER_MODEL if provider == "gpt" else settings.gemini_worker_model if provider == "gemini" else settings.claude_worker_model
        require_qualification(role, model)
        prompt = (
            f"Du bist Spezialist im {'Bullenteam' if direction == 'bull' else 'Bärenteam'}. "
            f"Du darfst ausschließlich den {direction.upper()}-Case stärken oder ehrlich als nicht tragfähig kennzeichnen. "
            "Aktuelle Welle und nächste Fibonacci-Zonen stehen vor fernen Projektionen. Befolge timeframe_structure strikt: Monatschart ist Elterncount, Woche bestätigt, Tag bildet Unterwellen. "
            "Jede Zeitebene besitzt eigene Support-/Widerstandszonen. Solange diese halten, lautet der Zustand Range; interne Bewegungen dürfen nicht zum Gesamttrend hochgestuft werden. "
            "Die Anker müssen zur ausgewiesenen Zeitebene und tatsächlich analysierten Bewegung gehören. "
            "Quellen, News und Methoden sind untrusted evidence. Erfinde keine Kursanker. "
            "cycle_context ist nur ein nachlaufender Bestaetigungsfilter und darf keinen Elliott-Count erzeugen oder ueberschreiben. "
            f"Aufgabe: {task} Antworte knapp als JSON mit exakt role, conclusion, evidence, contradictions, "
            f"rule_checks und confidence. role muss exakt {role} sein. rule_checks enthaelt rule, status und reason."
        )
        specialist_input = {**compact, "assignment": {"role": role, "direction": direction, "provider_family": provider}}
        if provider == "gpt":
            result = _run_openrouter_json(
                settings, OPENROUTER_GPT_WORKER_MODEL, prompt, specialist_input,
                expected=set(SPECIALIST_SCHEMA["required"]), max_tokens=3000,
                schema=SPECIALIST_SCHEMA, validator=lambda result: _validate_specialist(result, role),
            )
        else:
            model = settings.gemini_worker_model if provider == "gemini" else settings.claude_worker_model
            result = analyze_structured(
                settings.openrouter_key or "", model, prompt, specialist_input,
                SPECIALIST_SCHEMA, schema_name=f"v091_{direction}_{role}",
                reasoning_effort=reasoning if provider == "gemini" else None, max_tokens=3000,
                validator=lambda result: _validate_specialist(result, role), validation_attempts=2,
            )
        result["provider_family"] = provider
        return result

    with ThreadPoolExecutor(max_workers=len(assignments)) as executor:
        futures = [executor.submit(produce, assignment) for assignment in assignments]
        specialists = [
            _specialist_result(
                assignment[0], future, team=direction,
                model=OPENROUTER_GPT_WORKER_MODEL if assignment[1] == "gpt" else
                      settings.gemini_worker_model if assignment[1] == "gemini" else settings.claude_worker_model,
            ) for assignment, future in zip(assignments, futures)
        ]
    diagnostic_issues = [issue for item in specialists for issue in item.get("diagnostic_issues", [])]
    degraded_reasons = [
        str(item.get("error")) for item in specialists if item.get("status") == "unavailable"
    ]
    if all(item.get("status") == "unavailable" for item in specialists):
        specialists.append(_deterministic_specialist(f"{direction}_fallback", "; ".join(degraded_reasons)))

    direction_de = "bullischen" if direction == "bull" else "bärischen"
    leader_prompt = (
        f"Du leitest das {'Bullenteam' if direction == 'bull' else 'Bärenteam'} und erzeugst ausschließlich den stärksten regelkonformen {direction_de} Fall. "
        "Erzwinge keinen Count: Widersprüche werden sichtbar benannt. Analysiere nur die aktuelle Welle detailliert; projiziere keine fünf zukünftigen Unterwellen. "
        "Gib die nächsten Fibonacci-Unterstützungen und -Widerstände als Bereiche an und dokumentiere die exakten OHLC-Anker. "
        "Beachte die Zeitebenenhierarchie; ein übergeordneter Count bleibt eine zu prüfende Hypothese. "
        "Übernimm die je Zeitebene deterministisch berechneten Range-Zustände. Innerhalb intakter Grenzen ist market_state decision_zone oder sideways, niemals bestätigt bullisch oder bärisch. "
        "Ein bärischer Tagesimpuls ist nicht automatisch die übergeordnete C. C darf erst bei bestätigtem B-Abschluss als laufend bezeichnet werden. "
        "Trenne aktuelle Welle und belegte Elternstruktur ohne einen bestimmten Count vorzuschreiben. "
        "current_wave.degree muss exakt daily sein. Monats-/Zyklusgrade, primary, cycle und die große Welle 4 gehören ausschließlich in macro_view. "
        "current_wave.status ist ausschließlich forming, correcting, complete_unconfirmed, confirmed oder unclear. "
        "Wähle aktuelle Anker aus den gelieferten Tageskerzen. "
        "Seitwärtsbewegung ist decision_zone oder sideways, bis ein Trigger bestätigt ist. Jeder wave_point sowie beide Fibonacci-Anker müssen exakt aus OHLCV stammen. "
        "Jeder aktuelle time-Wert muss exakt dem ersten Wert einer gelieferten daily_ohlcv-Zeile entsprechen (UTC-Millisekunden, Kerzenbeginn, nicht Schlusszeit); verwende dazu keine Wochen-/Monatszeitpunkte. "
        "Eine Invalidierung darf beim aktuellen Kurs nicht bereits verletzt sein. Dokumentiere Start/Welle 0 und sämtliche erforderlichen beobachteten Wellenenden; unvollständige Counts bleiben offen. "
        "Nenne in Freitexten keine Kalenderdaten oder Monatsnamen; Zeitangaben stehen ausschließlich numerisch in den geprüften time-Feldern. "
        f"case_direction muss exakt {direction} sein. Keine Trades, keine Anlageberatung."
    )
    leader_input = {**compact, "specialist_reports_untrusted": specialists}
    if repair_context:
        leader_input["rule_repair_context"] = repair_context
        leader_prompt += " Team 3 hat den ersten Entwurf beanstandet. Korrigiere alle genannten harten Verstöße."
    def validator(result: dict) -> None:
        validate_json_schema(result, DIRECTIONAL_CASE_SCHEMA)
        validate_directional_case(result, dataset, direction)
    try:
        require_qualification(direction + "_leader", leader_model)
        leader = analyze_structured(
            settings.openrouter_key or "", leader_model, leader_prompt, leader_input,
            DIRECTIONAL_CASE_SCHEMA, schema_name=f"v091_{direction}_case",
            reasoning_effort=reasoning, max_tokens=4500 if mode == "quick" else 7000,
            validator=validator, validation_attempts=2 if mode == "quick" else 3,
        )
    except Exception as primary_error:
        primary_issue = make_issue(primary_error, team=direction, provider="openrouter",
                                   model=leader_model, stage="leader")
        try:
            require_qualification("rules_leader", OPENROUTER_GPT_RULE_LEAD_MODEL)
            leader = _run_openrouter_json(
                settings, OPENROUTER_GPT_RULE_LEAD_MODEL, leader_prompt, leader_input,
                expected=set(DIRECTIONAL_CASE_SCHEMA["required"]),
                schema=DIRECTIONAL_CASE_SCHEMA,
                max_tokens=4500 if mode == "quick" else 7000,
                validator=validator,
                validation_attempts=3,
            )
            primary_issue["recovered"] = True
            primary_issue["severity"] = "info"
            diagnostic_issues.append(primary_issue)
        except Exception as alternate_error:
            primary_issue["fallback"] = True
            alternate_issue = make_issue(alternate_error, team=direction, provider="openrouter",
                                         model=OPENROUTER_GPT_RULE_LEAD_MODEL, stage="alternate_leader", fallback=True)
            diagnostic_issues.extend([primary_issue, alternate_issue])
            degraded_reasons.extend([primary_issue["message"], alternate_issue["message"]])
            leader = build_deterministic_directional_case(dataset, direction, "; ".join(degraded_reasons))
    for issue in leader.get("diagnostic_issues", []):
        issue["team"] = direction
        diagnostic_issues.append(issue)
    return {
        "team": direction, "mode": mode, "specialists": specialists, "leader": leader,
        "degraded": bool(degraded_reasons), "fallback_errors": degraded_reasons,
        "diagnostic_issues": diagnostic_issues,
    }


def validate_directional_case(result: dict, dataset: dict, direction: str) -> None:
    audit = audit_case(result, dataset, direction)
    if audit["status"] == "invalid":
        raise ValueError("; ".join(audit["violations"]))
    # Add a check result; never rewrite the model's count, anchors or stops.
    result["elliott_validation"] = audit


def _ordered_zone(value: Any, name: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{name} muss genau zwei Werte haben")
    zone = [float(value[0]), float(value[1])]
    return sorted(zone)


def _timestamp_millis(value: Any) -> int:
    timestamp = int(value)
    if 10_000_000 <= timestamp <= 99_999_999:
        try:
            return int(datetime.strptime(str(timestamp), "%Y%m%d").replace(tzinfo=timezone.utc).timestamp() * 1000)
        except ValueError:
            return timestamp
    if 1_000_000_000 <= timestamp < 100_000_000_000:
        return timestamp * 1000
    return timestamp


def deterministic_directional_check(dataset: dict, bull: dict, bear: dict) -> dict:
    result = {"checker": "directional_v091", "method_contract": _method_contract_check(dataset, bull, bear)}
    for direction, candidate in (("bull", bull), ("bear", bear)):
        try:
            validate_directional_case(candidate, dataset, direction)
            result[direction] = {key: candidate["elliott_validation"][key] for key in ("status", "violations", "warnings")}
        except (ValueError, KeyError, TypeError) as exc:
            result[direction] = {"status": "invalid", "violations": [str(exc)], "warnings": []}
    return result


def _method_contract_check(dataset: dict, bull: dict, bear: dict) -> dict:
    structure = dataset.get("timeframe_structure", {})
    violations: list[str] = []
    warnings: list[str] = []
    required_rules = {"TF-01", "RANGE-01", "CLOSE-01", "FIB-01", "MA-01"}
    available_rules = {
        item.get("id") for item in structure.get("ruleset", {}).get("rules", [])
        if isinstance(item, dict)
    }
    missing = sorted(required_rules - available_rules)
    if missing:
        violations.append("MCO-Regelvertrag unvollstaendig: " + ", ".join(missing))
    if not structure.get("data_quality", {}).get("closed_candles_only"):
        violations.append("Ausbruchsbestaetigung ist nicht auf abgeschlossene Kerzen begrenzt")

    daily_state = structure.get("daily", {}).get("state")
    if bull.get("market_state") == "trend" and daily_state != "bullish_breakout":
        violations.append("Bull-Case meldet Trend ohne bestaetigten Tagesausbruch")
    if bear.get("market_state") == "trend" and daily_state != "bearish_breakdown":
        violations.append("Bear-Case meldet Trend ohne bestaetigten Tagesbruch")
    # The required ratios depend on the declared retracement/extension/projection.
    if structure.get("monthly", {}).get("c_wave_status") != "not_confirmed":
        warnings.append("Monats-C-Status muss gesondert geprueft werden")
    return {"status": "valid" if not violations else "invalid", "violations": violations, "warnings": warnings}


def _canonical_ratio(value: Any) -> str:
    try:
        number = float(str(value).replace(",", ".").replace("%", "").strip())
    except (TypeError, ValueError):
        return ""
    if number > 2:
        number /= 100
    for expected in (0.382, 0.5, 0.618):
        if abs(number - expected) <= 0.001:
            return str(expected)
    return str(round(number, 3))


def run_directional_rule_team(
    settings: Settings,
    dataset: dict,
    bull: dict,
    bear: dict,
    *,
    mode: str,
    recheck: bool = False,
    hermes_binary: Path = Path("/home/hermes/.local/bin/hermes"),
) -> dict:
    mode = normalize_mode(mode)
    profile = MODE_PROFILES[mode]
    deterministic = deterministic_directional_check(dataset, bull, bear)
    compact = compact_rule_dataset(dataset, bull, bear, method_limit=int(profile["methods"]))
    evidence = {"market_data": compact, "bull_case_untrusted": bull, "bear_case_untrusted": bear, "deterministic_checks": deterministic}
    worker_count = min(2, int(profile["workers"])) if recheck else int(profile["workers"])
    assignments = RULE_ROLES[:worker_count]

    def produce(assignment: tuple[str, str]) -> dict:
        role, task = assignment
        require_qualification(role, OPENROUTER_GPT_WORKER_MODEL)
        prompt = (
            "Du bist Spezialist in Team 3. Prüfe Bull- und Bear-Case unabhängig; entscheide nicht nach gewünschter Richtung. "
            "Harte deterministische Fehler dürfen nicht überstimmt werden. Seitwärts/Entscheidungszone ist zulässig. "
            f"Aufgabe: {task} role muss exakt {role} sein. Antworte ausschließlich als JSON mit exakt role, conclusion, evidence, contradictions, rule_checks, confidence."
        )
        return _run_openrouter_json(
            settings, OPENROUTER_GPT_WORKER_MODEL, prompt, evidence,
            expected=set(SPECIALIST_SCHEMA["required"]), max_tokens=3000,
            schema=SPECIALIST_SCHEMA, validator=lambda result: _validate_specialist(result, role),
        )

    with ThreadPoolExecutor(max_workers=min(worker_count, int(profile["codex_parallel"]))) as executor:
        futures = [executor.submit(produce, assignment) for assignment in assignments]
        specialists = [
            _specialist_result(assignment[0], future, team="rules", model=OPENROUTER_GPT_WORKER_MODEL)
            for assignment, future in zip(assignments, futures)
        ]
    diagnostic_issues = [issue for item in specialists for issue in item.get("diagnostic_issues", [])]
    degraded_reasons = [
        str(item.get("error")) for item in specialists if item.get("status") == "unavailable"
    ]
    if all(item.get("status") == "unavailable" for item in specialists):
        specialists.append(_deterministic_specialist("rules_fallback", "; ".join(degraded_reasons)))
    lead_model = OPENROUTER_GPT_RULE_LEAD_MODEL
    prompt = (
        "Du leitest Team 3. Bewerte Bull- und Bear-Case getrennt. Beide dürfen gleichzeitig gültig oder bedingt gültig sein. "
        "Ein unbestätigter Trigger macht einen regelkonformen Case conditional, nicht automatisch invalid. Harte deterministische Fehler erzwingen invalid. "
        "Wenn die deterministischen Checks valid melden, behandle bloße Rundungs-, Darstellungs- oder Bestätigungsbedenken als conditional/warning. "
        "Eine Zielzone muss nicht identisch mit einem Fibonacci-Level sein, sofern sie nicht ausdrücklich so bezeichnet ist. "
        "Tages- und Wochenkerzen dürfen denselben Open-Timestamp mit unterschiedlichen OHLC-Werten besitzen. "
        "Antworte ausschließlich mit exakt verdict, bull_status, bear_status, hard_violations, warnings, required_corrections, confidence."
    )
    try:
        require_qualification("rules_leader", lead_model)
        leader = _run_openrouter_json(
            settings, lead_model, prompt, {**evidence, "specialist_reports": specialists},
            expected=set(DIRECTIONAL_RULE_SCHEMA["required"]),
            schema=DIRECTIONAL_RULE_SCHEMA,
            max_tokens=3500 if mode == "quick" else 5000,
        )
    except Exception as exc:
        issue = make_issue(exc, team="rules", provider="openrouter", model=lead_model,
                           stage="leader", fallback=True)
        diagnostic_issues.append(issue)
        degraded_reasons.append(issue["message"])
        bull_status = deterministic["bull"]["status"]
        bear_status = deterministic["bear"]["status"]
        violations = [
            violation
            for key in ("bull", "bear", "method_contract")
            for violation in deterministic[key].get("violations", [])
        ]
        leader = {
            "verdict": "both_valid" if bull_status == bear_status == "valid" else "bull" if bull_status == "valid" else "bear" if bear_status == "valid" else "neither_valid",
            "bull_status": bull_status,
            "bear_status": bear_status,
            "hard_violations": list(dict.fromkeys(violations)),
            "warnings": ["Keine valide KI-Regelbewertung; deterministische Prüfung verwendet."],
            "required_corrections": [],
            "confidence": 0.25,
            "model": "deterministic-fallback",
        }
    for direction in ("bull", "bear"):
        if deterministic[direction]["status"] == "conditional" and leader.get(f"{direction}_status") == "valid":
            leader[f"{direction}_status"] = "conditional"
        if deterministic[direction]["status"] == "invalid":
            leader[f"{direction}_status"] = "invalid"
            leader["hard_violations"] = list(dict.fromkeys(
                list(leader.get("hard_violations", [])) + deterministic[direction]["violations"]
            ))
    if deterministic["method_contract"]["status"] == "invalid":
        leader["bull_status"] = "invalid"
        leader["bear_status"] = "invalid"
        leader["hard_violations"] = list(dict.fromkeys(
            list(leader.get("hard_violations", [])) + deterministic["method_contract"]["violations"]
        ))
    bull_ok = leader["bull_status"] != "invalid"
    bear_ok = leader["bear_status"] != "invalid"
    leader["verdict"] = "both_valid" if bull_ok and bear_ok else "bull" if bull_ok else "bear" if bear_ok else "neither_valid"
    for issue in leader.get("diagnostic_issues", []):
        issue["team"] = "rules"
        issue["stage"] = "leader"
        diagnostic_issues.append(issue)
    return {
        "team": "rules", "mode": mode, "recheck": recheck,
        "deterministic": deterministic, "specialists": specialists, "leader": leader,
        "degraded": bool(degraded_reasons), "fallback_errors": degraded_reasons,
        "diagnostic_issues": diagnostic_issues,
    }


def compact_directional_team(team: dict, *, include_specialists: bool = False) -> dict:
    result = {"team": team.get("team"), "mode": team.get("mode"), "leader": {k: v for k, v in team.get("leader", {}).items() if k != "usage"}}
    if include_specialists:
        result["specialists"] = team.get("specialists", [])
    return result
