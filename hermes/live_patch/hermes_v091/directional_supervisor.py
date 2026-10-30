from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from macro_waves.analysis_teams import _run_codex_json
from macro_waves.config import Settings
from macro_waves.openrouter import analyze_structured
from macro_waves.storage import write_json
from .diagnostics import make_issue, sanitize_error
from .model_contracts import validate_json_schema
from .analysis_contract import audit_case
from .agent_qualification import require_qualification


SUPERVISOR_FIELDS = {
    "summary", "market_state", "selected_bias", "current_wave_summary", "preferred_case",
    "bull_assessment", "bear_assessment", "source_news_assessment", "macro_synthesis",
    "confidence", "disclaimer",
}

SUPERVISOR_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": sorted(SUPERVISOR_FIELDS),
    "properties": {
        **{key: {"type": "string"} for key in SUPERVISOR_FIELDS},
        "market_state": {"type": "string", "enum": ["bullish", "bearish", "sideways", "decision_zone"]},
        "selected_bias": {"type": "string", "enum": ["bull", "bear", "neutral"]},
        "preferred_case": {"type": "string", "enum": ["bull", "bear", "balanced"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "source_news_assessment": {"type": "array", "items": {"type": "string"}},
    },
}


def validate_supervisor(result: dict, evidence: dict) -> None:
    validate_json_schema(result, SUPERVISOR_SCHEMA)
    expected = aggregate_timeframe_state(evidence.get("timeframe_structure", {}))
    for key, value in expected.items():
        if result[key] != value:
            raise ValueError(f"{key} must be {value!r} according to deterministic timeframe states")

CRITIC_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": [
        "verdict", "hard_conflicts", "bias_or_cherry_picking", "omissions",
        "required_corrections", "confidence_cap", "assessment",
    ],
    "properties": {
        "verdict": {"type": "string", "enum": ["approve", "revise"]},
        "hard_conflicts": {"type": "array", "items": {"type": "string"}},
        "bias_or_cherry_picking": {"type": "array", "items": {"type": "string"}},
        "omissions": {"type": "array", "items": {"type": "string"}},
        "required_corrections": {"type": "array", "items": {"type": "string"}},
        "confidence_cap": {"type": "number", "minimum": 0, "maximum": 1},
        "assessment": {"type": "string"},
    },
}


def build_supervisor_evidence(dataset: dict, bull_team: dict, bear_team: dict, rules: dict) -> dict:
    market_keys = (
        "current_price", "current_price_time", "rsi14_weekly", "ma5", "ma10", "ma20", "ma50",
        "support", "resistance", "fibonacci", "confirmed_major_pivots", "coinbase_close_deviation",
    )
    sources = []
    for item in dataset.get("external_sources_untrusted", [])[:20]:
        sources.append({
            "id": item.get("id"), "kind": item.get("kind"), "created_at": item.get("created_at"),
            "claims": item.get("claims", [])[:8], "uncertainties": item.get("uncertainties", [])[:4],
            "indicators": item.get("indicators", []),
            "indicator_usage": item.get("indicator_usage", "Externe historische Beobachtungen; Quellzeitpunkt und Zeitebene beachten."),
        })
    news = []
    for item in dataset.get("market_news_untrusted", [])[:10]:
        news.append({
            key: item.get(key) for key in (
                "title", "impact", "valid_from", "valid_until", "facts", "potential_effects", "uncertainties",
            )
        })
    return {
        "market_data": {key: dataset.get(key) for key in market_keys if key in dataset},
        "bull_team": _without_usage(bull_team),
        "bear_team": _without_usage(bear_team),
        "rule_team": _without_usage(rules),
        "external_sources_untrusted": sources,
        "active_news_untrusted": news,
        "expert_source_untrusted": dataset.get("expert_source_untrusted", {}),
        "confirmatory_context": _compact_confirmation(dataset.get("confirmatory_market_context", {})),
        "cycle_context": dataset.get("cycle_context", {}),
        "timeframe_structure": dataset.get("timeframe_structure", {}),
    }


def _fallback_supervisor(evidence: dict, reasons: list[str]) -> dict:
    frames = evidence.get("timeframe_structure", {})
    aggregate = aggregate_timeframe_state(frames)
    bull = evidence.get("bull_team", {}).get("leader", {})
    bear = evidence.get("bear_team", {}).get("leader", {})
    states = {
        key: frames.get(key, {}).get("state", "unknown")
        for key in ("monthly", "weekly", "daily")
    }
    bull_wave = bull.get("current_wave", {}).get("label", "Bull-Case offen")
    bear_wave = bear.get("current_wave", {}).get("label", "Bear-Case offen")
    return {
        "summary": deterministic_state_summary(states, aggregate),
        "market_state": aggregate["market_state"],
        "selected_bias": aggregate["selected_bias"],
        "current_wave_summary": f"Degraded mode: {bull_wave}; Gegenfall: {bear_wave}.",
        "preferred_case": aggregate["preferred_case"],
        "bull_assessment": "Bull-Case wird unverändert aus dem Team-Ergebnis übernommen; keine gültige KI-Synthese verfügbar.",
        "bear_assessment": "Bear-Case wird unverändert aus dem Team-Ergebnis übernommen; keine gültige KI-Synthese verfügbar.",
        "source_news_assessment": [
            "Quellen und News wurden im Degraded mode nicht semantisch neu gewichtet.",
            "Deterministische Kurs- und Zeitrahmenregeln bleiben maßgeblich.",
        ],
        "macro_synthesis": "Monats-, Wochen- und Tageszustand wurden deterministisch zusammengeführt; kein neuer Elliott-Count wurde erzeugt.",
        "confidence": 0.25,
        "disclaimer": "Regelbasierter Ersatz für die KI-Synthese; Ursache siehe Diagnose. Keine Anlageberatung.",
        "model": "deterministic-fallback",
        "degraded": True,
        "degraded_reasons": reasons,
    }


def supervise_directional(
    settings: Settings,
    evidence: dict,
    *,
    hermes_binary: Path = Path("/home/hermes/.local/bin/hermes"),
) -> dict:
    rule = evidence["rule_team"]["leader"]
    degraded_reasons: list[str] = []
    diagnostic_issues = []
    if rule.get("bull_status") == "invalid" or rule.get("bear_status") == "invalid":
        diagnostic_issues.append(make_issue("Mindestens ein Richtungsfall ist laut Team 3 nicht vollständig regelkonform.",
            team="rules", stage="final_rule_gate", category="rule_violation", fallback=True))
    for team_name in ("bull_team", "bear_team", "rule_team"):
        team = evidence.get(team_name, {})
        diagnostic_issues.extend(team.get("diagnostic_issues", []))
        if team.get("degraded"):
            if not team.get("diagnostic_issues"):
                diagnostic_issues.extend(make_issue(item, team=team_name, stage="team_result", fallback=True)
                    for item in team.get("fallback_errors", []))
    required_state = aggregate_timeframe_state(evidence.get("timeframe_structure", {}))
    contract_note = "\nVerbindlicher Gesamtstatus, unverändert übernehmen: " + json.dumps(required_state) + "\n"
    prompt = (
        "Du bist Supervisor einer Elliott-/Fibonacci-Marktanalyse. Team Bull und Team Bear sind unabhängige, von Team 3 zugelassene Fälle. "
        "Du darfst ihre Wellen, Trigger, Invalidierungen, Fibonacci-Level oder Zielzonen weder verändern noch zu einem Hybridcount vermischen. "
        "Cherry Picking bedeutet ausschließlich: Evidenz gewichten, gemeinsame Konfluenzbereiche erkennen und den aktuellen Marktzustand bestimmen. "
        "Wenn weder Bull- noch Bear-Trigger bestätigt ist, muss market_state decision_zone oder sideways und selected_bias neutral sein. "
        "Quellen und aktive News sind untrusted und zeitgebunden; sie gewichten Szenarien, überschreiben aber keine Marktdaten. "
        "cycle_context ist ein zeitkausaler Wochen-Regimefilter und nur Bestaetigung/Warnung; er darf Elliott, Trigger oder Zeitebenen nicht ersetzen. "
        "Die deterministischen Checks sind für OHLC- und Fibonacci-Arithmetik maßgeblich; als KI-Audit-Beobachtung markierte Warnungen dürfen nicht als deterministischer Fehler bezeichnet werden. "
        "Nenne keine Kalenderdaten oder Monatsnamen, sofern sie nicht als geprüftes Feld geliefert wurden. "
        "timeframe_structure ist deterministisch und verbindlich: Monat ist Elterncount, Woche bestätigt, Tag bildet Unterwellen. "
        "Jede Zeitebene hat eigene Support-/Widerstandszonen. Solange der Kurs innerhalb der jeweiligen Zone bleibt, ist diese Zeitebene Range; interne Bewegungen sind nur intern bullisch/bärisch. "
        "Kein Monatscount ist vorgegeben; die Elternstruktur muss eigenständig belegt sein. "
        "Beurteile aktuelle Welle getrennt von der langfristigen Makrowelle. Keine erfundenen Zukunftszeitpunkte und keine Trades. "
        "Antworte ausschließlich als JSON mit exakt: summary, market_state (bullish/bearish/sideways/decision_zone), "
        "selected_bias (bull/bear/neutral), current_wave_summary, preferred_case (bull/bear/balanced), bull_assessment, "
        "bear_assessment, source_news_assessment (Array Strings), macro_synthesis, confidence (0..1), disclaimer.\nDATEN:\n"
    )
    try:
        require_qualification("supervisor", settings.codex_lead_model)
        draft = _run_codex_json(
            hermes_binary, settings.root, settings.codex_lead_model,
            prompt + json.dumps(evidence, ensure_ascii=False) + contract_note,
            expected=SUPERVISOR_FIELDS, timeout=300, schema=SUPERVISOR_SCHEMA,
            validator=lambda value: validate_supervisor(value, evidence), stage="supervisor_draft",
        )
        diagnostic_issues.extend(draft.pop("diagnostic_issues", []))
    except Exception as exc:
        issues = getattr(exc, "diagnostic_issues", None) or [make_issue(exc, team="supervisor", provider="openai-codex", model=settings.codex_lead_model, stage="supervisor_draft")]
        diagnostic_issues.extend(dict(issue, fallback=True) for issue in issues)
        draft = _fallback_supervisor(evidence, [sanitize_error(exc)])
    mode = str(evidence.get("bull_team", {}).get("mode", "standard"))
    critic_families = critic_families_for_mode(mode, _next_quick_critic(settings, diagnostic_issues) if mode == "quick" else None)
    critic_input = _critic_evidence(evidence, draft)
    with ThreadPoolExecutor(max_workers=len(critic_families)) as executor:
        futures = {
            family: executor.submit(_run_critic, settings, family, mode, critic_input)
            for family in critic_families
        }
        critics = {family: _critic_result(family, future) for family, future in futures.items()}
    for family, critic in critics.items():
        for issue in critic.pop("diagnostic_issues", []):
            diagnostic_issues.append(dict(issue, team="critic_" + family, model=critic.get("model") or _critic_model(settings, family, mode)))
    # A fully failed draft has exhausted its bounded correction budget already.
    # Do not spend another 300s for the same failed provider in the same run.
    needs_revision = draft.get("model") != "deterministic-fallback" and (mode == "deep" or any(item.get("verdict") == "revise" for item in critics.values()))
    result = draft
    resolution = {"status": "deterministic_fallback_no_revision" if draft.get("model") == "deterministic-fallback" else "accepted_without_revision", "model": draft.get("model", settings.codex_lead_model)}
    if needs_revision:
        correction_prompt = (
            "Du bist erneut der GPT-Supervisor. Die unabhaengigen Kritiker haben deinen Entwurf geprueft. "
            "Korrigiere nur Synthese, Gewichtung, Auslassungen und Konfidenz. Veraendere niemals Bull-/Bear-Counts, "
            "Trigger, Invalidierungen, Fibonacci-Level oder Zielzonen. Harte deterministische Felder bleiben bindend. "
            "Beantworte jeden tragfaehigen Kritikerhinweis im neuen Bericht; bei unaufloesbarem Konflikt bleibe neutral. "
            "Antworte ausschliesslich mit exakt: summary, market_state, selected_bias, current_wave_summary, "
            "preferred_case, bull_assessment, bear_assessment, source_news_assessment, macro_synthesis, confidence, disclaimer.\nDATEN:\n"
        )
        try:
            require_qualification("supervisor", settings.codex_lead_model)
            result = _run_codex_json(
                hermes_binary, settings.root, settings.codex_lead_model,
                correction_prompt + json.dumps({"evidence": evidence, "draft": draft, "critics": critics}, ensure_ascii=False) + contract_note,
                expected=SUPERVISOR_FIELDS, timeout=300, schema=SUPERVISOR_SCHEMA,
                validator=lambda value: validate_supervisor(value, evidence), stage="supervisor_correction",
            )
            diagnostic_issues.extend(result.pop("diagnostic_issues", []))
            resolution = {"status": "corrected_after_critics", "model": settings.codex_lead_model}
        except Exception as exc:
            issues = getattr(exc, "diagnostic_issues", None) or [make_issue(exc, team="supervisor", provider="openai-codex", model=settings.codex_lead_model, stage="supervisor_correction")]
            diagnostic_issues.extend(dict(issue, fallback=True) for issue in issues)
            resolution = {"status": "correction_unavailable_kept_previous", "model": settings.codex_lead_model}
    degraded_reasons = list(dict.fromkeys(issue["message"] for issue in diagnostic_issues if not issue.get("recovered")))
    bull = evidence["bull_team"]["leader"]
    bear = evidence["bear_team"]["leader"]
    result["bull_case"] = bull
    result["bear_case"] = bear
    current = float(evidence["market_data"]["current_price"])
    result["decision_support_zones"] = _nearest_zones(current, bull, bear, "support_zones", below=True)
    result["decision_resistance_zones"] = _nearest_zones(current, bull, bear, "resistance_zones", below=False)
    result["macro_views"] = {"bull": bull["macro_view"], "bear": bear["macro_view"]}
    result["timeframe_structure"] = evidence.get("timeframe_structure", {})
    aggregate = aggregate_timeframe_state(result["timeframe_structure"])
    chosen = aggregate.get("selected_bias")
    if chosen in {"bull", "bear"}:
        selected = bull if chosen == "bull" else bear
        audit = selected.get("elliott_validation", {})
        if audit.get("status") != "valid" or not audit.get("triggerConfirmed") or rule.get(f"{chosen}_status") != "valid":
            aggregate = {"market_state": "decision_zone", "selected_bias": "neutral", "preferred_case": "balanced"}
    result.update(aggregate)
    result["timeframe_states"] = {
        key: result["timeframe_structure"].get(key, {}).get("state", "unknown")
        for key in ("monthly", "weekly", "daily")
    }
    result["quality_gate"] = {
        "closed_candles_only": bool(result["timeframe_structure"].get("data_quality", {}).get("closed_candles_only")),
        "both_directional_cases_present": bool(bull and bear),
        "deterministic_ruleset": result["timeframe_structure"].get("ruleset", {}).get("name"),
        "aggregate_is_neutral_when_timeframes_conflict": aggregate["selected_bias"] == "neutral" if len(set(result["timeframe_states"].values())) > 1 else True,
        "critic_coverage": sorted(critics),
        "all_critics_available": all(item.get("verdict") in {"approve", "revise"} for item in critics.values()),
        "degraded_output": bool(degraded_reasons),
    }
    result["critics"] = critics
    result["critic_resolution"] = resolution
    calibrated, calibration = calibrate_confidence(
        float(result.get("confidence", 0)), aggregate, result["timeframe_states"],
        evidence.get("rule_team", {}).get("leader", {}), critics,
    )
    result["confidence"] = calibrated
    result["confidence_calibration"] = calibration
    result["summary"] = deterministic_state_summary(result["timeframe_states"], aggregate)
    result["degraded"] = bool(degraded_reasons)
    result["degraded_reasons"] = list(dict.fromkeys(degraded_reasons))
    result["diagnostic_issues"] = diagnostic_issues
    return result


def critic_families_for_mode(mode: str, quick_family: str | None = None) -> list[str]:
    if mode == "quick":
        return [quick_family if quick_family in {"gemini", "claude"} else "gemini"]
    return ["gemini", "claude"]


def _next_quick_critic(settings: Settings, diagnostic_issues: list | None = None) -> str:
    path = settings.root / "data" / "critic-rotation.json"
    family = "gemini"
    if path.exists():
        try:
            stored = json.loads(path.read_text(encoding="utf-8"))
            family = str(stored.get("next", family))
        except (OSError, ValueError, TypeError):
            family = "gemini"
    if family not in {"gemini", "claude"}:
        family = "gemini"
    try:
        write_json(path, {"last": family, "next": "claude" if family == "gemini" else "gemini"})
    except OSError as exc:
        if diagnostic_issues is not None:
            diagnostic_issues.append(make_issue(exc, team="supervisor", stage="critic_rotation", category="storage", recovered=True))
    return family


def _critic_evidence(evidence: dict, draft: dict) -> dict:
    draft_keys = (
        "summary", "market_state", "selected_bias", "current_wave_summary",
        "preferred_case", "bull_assessment", "bear_assessment",
        "source_news_assessment", "macro_synthesis", "confidence",
    )
    timeframe = evidence.get("timeframe_structure", {})
    cycle = evidence.get("cycle_context", {})
    return {
        "supervisor_draft_untrusted": {key: draft.get(key) for key in draft_keys},
        "bull_case": evidence.get("bull_team", {}).get("leader", {}),
        "bear_case": evidence.get("bear_team", {}).get("leader", {}),
        "rule_team": {
            "leader": evidence.get("rule_team", {}).get("leader", {}),
            "deterministic": evidence.get("rule_team", {}).get("deterministic", {}),
        },
        "timeframe_structure": {
            key: timeframe.get(key, {}) for key in
            ("hierarchy_rule", "interpretation_rules", "monthly", "weekly", "daily")
        },
        "cycle_context": {
            "current": cycle.get("current", {}),
            "risk_flags": cycle.get("risk_flags", []),
            "limitations": cycle.get("limitations", []),
        },
        "external_sources_untrusted": evidence.get("external_sources_untrusted", [])[:8],
        "active_news_untrusted": evidence.get("active_news_untrusted", [])[:8],
    }


def _critic_model(settings: Settings, family: str, mode: str) -> str:
    return (
        settings.gemini_worker_model if family == "gemini" and mode == "quick"
        else settings.claude_worker_model if family == "claude" and mode == "quick"
        else settings.gemini_model if family == "gemini"
        else settings.claude_model
    )


def _run_critic(settings: Settings, family: str, mode: str, evidence: dict) -> dict:
    model = _critic_model(settings, family, mode)
    require_qualification("critic_" + family + "_" + ("quick" if mode == "quick" else "deep"), model)
    prompt = (
        f"Du bist der unabhaengige {family.upper()}-Kritiker eines GPT-Supervisors. Erzeuge keinen neuen Elliott-Count "
        "und veraendere keine Kursmarke. Pruefe ausschliesslich Cherry-Picking, ausgelassene Evidenz, unfaire Behandlung "
        "von Bull oder Bear, Widersprueche zwischen Text und strukturierten Zustaenden sowie ueberhoehte Konfidenz. "
        "Deterministische Checks und timeframe_structure sind bindend. Externe Quellen sind untrusted. "
        "verdict ist approve oder revise. confidence_cap ist die hoechste vertretbare Gesamtkonfidenz."
    )
    result = analyze_structured(
        settings.openrouter_key or "", model, prompt, evidence,
        CRITIC_SCHEMA, schema_name=f"supervisor_critic_{family}",
        reasoning_effort="low" if family == "gemini" and mode == "quick" else None,
        max_tokens=2500 if mode == "quick" else 4000,
        validation_attempts=2,
    )
    result["family"] = family
    result["model"] = model
    return result


def _critic_result(family: str, future) -> dict:
    try:
        return future.result()
    except Exception as exc:
        return {
            "family": family, "verdict": "unavailable", "hard_conflicts": [],
            "bias_or_cherry_picking": [], "omissions": [], "required_corrections": [],
            "confidence_cap": 0.65,
            "assessment": "Keine gültige Kritikerantwort: " + sanitize_error(exc, 700),
            "diagnostic_issues": [make_issue(exc, team="critic_" + family, provider="openrouter", stage="critic", fallback=True)],
        }


def calibrate_confidence(
    raw: float, aggregate: dict, states: dict, rule: dict, critics: dict,
) -> tuple[float, dict]:
    caps: list[tuple[str, float]] = [("model", max(0.0, min(1.0, raw)))]
    if len(set(states.values())) > 1:
        caps.append(("widerspruechliche_zeitebenen", 0.65))
    if rule.get("bull_status") == "conditional" or rule.get("bear_status") == "conditional":
        caps.append(("mindestens_ein_bedingter_count", 0.70))
    if rule.get("verdict") == "both_valid":
        caps.append(("zwei_tragfaehige_szenarien", 0.68))
    for family, critic in critics.items():
        caps.append((f"kritiker_{family}", float(critic.get("confidence_cap", 0.65))))
    value = max(0.0, min(cap for _, cap in caps))
    return round(value, 3), {"raw": raw, "final": round(value, 3), "caps": [{"reason": name, "value": cap} for name, cap in caps]}


def aggregate_timeframe_state(frames: dict) -> dict:
    """Never promote a local move to the aggregate trend."""
    states = [frames.get(key, {}).get("state") for key in ("monthly", "weekly", "daily")]
    # A missing timeframe cannot confirm an aligned multi-timeframe trend.
    if any(state not in {"range", "bullish_breakout", "bearish_breakdown"} for state in states):
        return {"market_state": "decision_zone", "selected_bias": "neutral", "preferred_case": "balanced"}
    if states and all(state == "bullish_breakout" for state in states):
        return {"market_state": "bullish", "selected_bias": "bull", "preferred_case": "bull"}
    if states and all(state == "bearish_breakdown" for state in states):
        return {"market_state": "bearish", "selected_bias": "bear", "preferred_case": "bear"}
    if states and all(state == "range" for state in states):
        return {"market_state": "sideways", "selected_bias": "neutral", "preferred_case": "balanced"}
    return {"market_state": "decision_zone", "selected_bias": "neutral", "preferred_case": "balanced"}


def deterministic_state_summary(states: dict, aggregate: dict) -> str:
    labels = {
        "range": "Range",
        "bullish_breakout": "bullisch bestaetigt",
        "bearish_breakdown": "baerisch bestaetigt",
        "unknown": "offen",
    }
    month = labels.get(states.get("monthly", "unknown"), "offen")
    week = labels.get(states.get("weekly", "unknown"), "offen")
    day = labels.get(states.get("daily", "unknown"), "offen")
    if aggregate["market_state"] == "decision_zone":
        conclusion = (
            "Die Zeitebenen sind nicht richtungsgleich. Der Gesamtstatus bleibt deshalb neutral in der "
            "Entscheidungszone; eine lokale Bewegung ist kein bestaetigter uebergeordneter Trend."
        )
    elif aggregate["market_state"] == "sideways":
        conclusion = "Alle betrachteten Zeitebenen befinden sich in einer Range; der Gesamtstatus ist neutral."
    elif aggregate["market_state"] == "bullish":
        conclusion = "Alle betrachteten Zeitebenen bestaetigen den bullischen Zustand."
    else:
        conclusion = "Alle betrachteten Zeitebenen bestaetigen den baerischen Zustand."
    return f"Monat: {month}. Woche: {week}. Tag: {day}. {conclusion}"


def telegram_directional_summary(symbol: str, result: dict, dataset: dict) -> str:
    state_labels = {
        "bullish": "↗ BULLISCH", "bearish": "↘ BÄRISCH",
        "sideways": "→ SEITWÄRTS", "decision_zone": "↔ ENTSCHEIDUNGSZONE",
    }
    bull = result["bull_case"]
    bear = result["bear_case"]
    supports = result.get("decision_support_zones", [])
    resistances = result.get("decision_resistance_zones", [])
    lines = [
        f"{symbol.replace('USDT', '/USDT')} · Elliott + Fibonacci",
        "",
        f"Gesamtstatus: {state_labels[result['market_state']]}",
        f"Aktuelle Welle: {result['current_wave_summary']}",
        "",
        f"BULL · {bull['current_wave']['label']} ({bull['current_wave']['status']})",
        f"Trigger: {float(bull['trigger']):,.2f} · Ungültig: {float(bull['invalidation']):,.2f}",
        f"Ziel: {float(bull['target_zone'][0]):,.2f}–{float(bull['target_zone'][1]):,.2f}",
        f"BEAR · {bear['current_wave']['label']} ({bear['current_wave']['status']})",
        f"Trigger: {float(bear['trigger']):,.2f} · Ungültig: {float(bear['invalidation']):,.2f}",
        f"Ziel: {float(bear['target_zone'][0]):,.2f}–{float(bear['target_zone'][1]):,.2f}",
        "",
    ]
    if result.get("degraded"):
        issues = [item for item in result.get("diagnostic_issues", []) if not item.get("recovered")]
        reasons = list(dict.fromkeys(
            f"{item.get('team') or 'Analyse'} / {item.get('model') or item.get('stage') or 'Prüfung'}: {sanitize_error(item.get('message', ''), 180)}"
            for item in issues))
        if not reasons:
            reasons = [sanitize_error(reason, 220) for reason in result.get("degraded_reasons", [])]
        diagnostics = result.get("diagnostics", {})
        warning = ["⚠️ EINGESCHRÄNKTE ANALYSE: Einzelne Schritte konnten nicht vollständig abgeschlossen werden."]
        warning.extend("Grund: " + reason for reason in reasons[:2])
        if diagnostics.get("stored") and diagnostics.get("issue_ids"):
            warning.append(f"SQL-Diagnose: {diagnostics['run_id']} / {symbol} (analysis_diagnostics).")
        elif diagnostics.get("storage_error"):
            warning.append("SQL-Diagnose konnte nicht gespeichert werden: " + sanitize_error(diagnostics["storage_error"], 120))
        warning.append("Regelbasierte Ersatzteile oder der letzte gültige Entwurf sind im Bericht gekennzeichnet.")
        lines[2:2] = warning + [""]
    frames = result.get("timeframe_structure", {})
    frame_labels = {"range": "Range", "bullish_breakout": "bullisch bestätigt", "bearish_breakdown": "bärisch bestätigt"}
    if frames:
        lines.extend([
            " · ".join(
                f"{label}: {frame_labels.get(frames.get(key, {}).get('state'), 'offen')}"
                for key, label in (("monthly", "Monat"), ("weekly", "Woche"), ("daily", "Tag"))
            ),
            "",
        ])
    monthly = result.get("timeframe_structure", {}).get("monthly", {})
    monthly_levels = monthly.get("b_retracement_levels", [])
    if monthly_levels:
        lines.extend([
            "Monat: Elterncount unbestätigt",
            "B-Retracements: " + " · ".join(
                f"{float(level['ratio']) * 100:g}% ({float(level['price']):,.0f})" for level in monthly_levels
            ),
            "C-Status: noch nicht bestätigt",
            "",
        ])
    if supports:
        lines.append("Nächste Supports: " + " · ".join(f"{z[0]:,.0f}–{z[1]:,.0f}" for z in supports[:3]))
    if resistances:
        lines.append("Nächste Widerstände: " + " · ".join(f"{z[0]:,.0f}–{z[1]:,.0f}" for z in resistances[:3]))
    lines.extend([
        "",
        "Makro Bull: " + bull["macro_view"]["interpretation"],
        "Makro Bear: " + bear["macro_view"]["interpretation"],
        "",
        "Keine Anlageberatung.",
    ])
    return "\n".join(lines)[:3900]


def _nearest_zones(current: float, bull: dict, bear: dict, key: str, *, below: bool) -> list[list[float]]:
    unique: dict[tuple[float, float], list[float]] = {}
    for candidate in (bull, bear):
        for raw in candidate.get(key, []):
            zone = [float(raw[0]), float(raw[1])]
            if (below and zone[0] <= current) or (not below and zone[1] >= current):
                unique[(round(zone[0], 2), round(zone[1], 2))] = zone
    zones = list(unique.values())
    return sorted(zones, key=lambda zone: min(abs(current - zone[0]), abs(current - zone[1])))[:4]


def _without_usage(value: dict) -> dict:
    return json.loads(json.dumps(value, ensure_ascii=False), object_hook=lambda item: {k: v for k, v in item.items() if k != "usage"})


def _compact_confirmation(context: dict) -> dict:
    return {
        "role": context.get("role"), "primary_method": context.get("primary_method"),
        "derivatives": {key: context.get("derivatives", {}).get(key) for key in ("status", "funding_rate_8h", "global_long_short_ratio", "basis_rate")},
        "options": {key: context.get("options", {}).get(key) for key in ("status", "put_call_open_interest_ratio", "open_interest_weighted_mark_iv_percent")},
        "macro_status": context.get("macro", {}).get("status"), "onchain_status": context.get("onchain", {}).get("status"),
    }
