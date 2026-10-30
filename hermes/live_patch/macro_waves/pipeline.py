from __future__ import annotations

import hashlib
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from .analysis_teams import normalize_mode
from .charts import render_chart
from .config import MARKETS, START_DATE, Settings
from .confirmatory_data import collect_confirmatory_context, collect_macro_context
try:
    from hermes_v091.forecast_memory import record_analysis_report, refresh_forecast_report
except ModuleNotFoundError:
    _forecast_runtime = Path(__file__).resolve().parents[2] / "data" / "runtime_v091"
    if str(_forecast_runtime) not in sys.path:
        sys.path.insert(0, str(_forecast_runtime))
    from hermes_v091.forecast_memory import record_analysis_report, refresh_forecast_report
from hermes_v091.diagnostics import make_issue, persist_diagnostics, sanitize_error
from .indicators import fibonacci, moving_average, rsi, support_resistance
from .market_data import cross_source_deviation, fetch_binance_candles, fetch_coinbase_daily
from .method_knowledge import load_method_library
from .news_archive import active_news_for_symbol
from .pivots import major_pivots
from .storage import store_candles, write_json
try:
    from .directional_charts import render_directional_charts
    from .cycle_phases import build_long_cycle_context
    from .directional_supervisor import _fallback_supervisor, _nearest_zones, build_supervisor_evidence, supervise_directional
    from .directional_teams import build_deterministic_directional_case, deterministic_directional_check, run_directional_rule_team, run_directional_team
    from .timeframe_structure import build_timeframe_structure
except ModuleNotFoundError:
    runtime_v091 = Path(__file__).resolve().parents[2] / "data" / "runtime_v091"
    if str(runtime_v091) not in sys.path:
        sys.path.insert(0, str(runtime_v091))
    from hermes_v091.directional_charts import render_directional_charts
    from hermes_v091.cycle_phases import build_long_cycle_context
    from hermes_v091.directional_supervisor import _fallback_supervisor, _nearest_zones, build_supervisor_evidence, supervise_directional
    from hermes_v091.directional_teams import build_deterministic_directional_case, deterministic_directional_check, run_directional_rule_team, run_directional_team
    from hermes_v091.timeframe_structure import build_timeframe_structure
from .publication import publish_outputs
from .source_archive import accepted_for_symbol

CACHE_SCHEMA_VERSION = 33


def _stable_cache_evidence(value):
    """Remove retrieval timestamps that otherwise defeat same-candle retry caches."""
    volatile = {"retrieved_at", "generated_at", "checked_at", "updated_at", "diagnostic_issues", "diagnostics"}
    if isinstance(value, dict):
        return {
            key: _stable_cache_evidence(item)
            for key, item in value.items() if key not in volatile
        }
    if isinstance(value, list):
        return [_stable_cache_evidence(item) for item in value]
    return value


def _cached(root: Path, symbol: str, stage: str, evidence: dict, producer) -> dict:
    cache_input = {
        "schema_version": CACHE_SCHEMA_VERSION,
        "stage": stage,
        "evidence": _stable_cache_evidence(evidence),
    }
    digest = hashlib.sha256(json.dumps(cache_input, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    path = root / "reports" / "cache" / f"{symbol}-{stage}.json"
    issues = []
    try:
        if path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(cached, dict):
                raise ValueError("Cache document must be an object")
            if cached.get("evidence_sha256") == digest and _cacheable_result(cached.get("result")):
                return cached["result"]
    except (OSError, ValueError, TypeError) as exc:
        issues.append(make_issue(exc, team="pipeline", stage=stage + ":cache_read", category="cache", recovered=True))
    result = producer()
    if _cacheable_result(result):
        try:
            write_json(path, {"evidence_sha256": digest, "result": result})
        except OSError as exc:
            issues.append(make_issue(exc, team="pipeline", stage=stage + ":cache_write", category="cache", recovered=True))
    if issues and isinstance(result, dict):
        result.setdefault("diagnostic_issues", []).extend(issues)
    return result


def _team_fallback(dataset: dict, direction: str, mode: str, error: Exception, stage: str) -> dict:
    issue = make_issue(error, team=direction, stage=stage, fallback=True)
    reason = issue["message"]
    return {"team": direction, "mode": mode, "specialists": [],
            "leader": build_deterministic_directional_case(dataset, direction, reason),
            "degraded": True, "fallback_errors": [reason], "diagnostic_issues": [issue]}


def _safe_rule_team(settings: Settings, dataset: dict, bull: dict, bear: dict, *, mode: str, recheck: bool = False) -> dict:
    try:
        return run_directional_rule_team(settings, dataset, bull, bear, mode=mode, recheck=recheck)
    except Exception as exc:
        # Fail closed for every deterministic violation, including method rules.
        checks = deterministic_directional_check(dataset, bull, bear)
        method_ok = checks.get("method_contract", {}).get("status") == "valid"
        statuses = {direction: "valid" if method_ok and checks[direction]["status"] == "valid" else "invalid"
                    for direction in ("bull", "bear")}
        issue = make_issue(exc, team="rules", stage="rule_recheck" if recheck else "rule_audit", fallback=True)
        bull_ok, bear_ok = statuses["bull"] == "valid", statuses["bear"] == "valid"
        violations = list(dict.fromkeys(v for result in checks.values() if isinstance(result, dict)
                                        for v in result.get("violations", [])))
        return {"team": "rules", "mode": mode, "recheck": recheck, "deterministic": checks,
                "specialists": [], "degraded": True, "fallback_errors": [issue["message"]],
                "diagnostic_issues": [issue], "leader": {
                    "model": "deterministic-fallback", "confidence": 0.25,
                    "bull_status": statuses["bull"], "bear_status": statuses["bear"],
                    "verdict": "both_valid" if bull_ok and bear_ok else "bull" if bull_ok else "bear" if bear_ok else "neither_valid",
                    "hard_violations": violations, "required_corrections": violations,
                    "warnings": ["KI-Regelauswertung fehlgeschlagen; deterministische Regelprüfung verwendet."]}}


def _merge_issues(*groups: list[dict]) -> list[dict]:
    result, seen = [], set()
    for group in groups:
        for issue in group:
            if not isinstance(issue, dict):
                continue
            key = json.dumps(issue, sort_keys=True, default=str)
            if key not in seen:
                seen.add(key)
                result.append(issue)
    return result


def _recovered_model_issues(value, team: str, stage: str = "") -> list[dict]:
    issues = []
    if isinstance(value, dict):
        for attempt in value.get("recovered_attempts", []):
            issues.append(make_issue(attempt.get("error", "Model output repaired"), team=team,
                provider="openrouter", model=value.get("model", ""), stage=stage or "output_validation",
                category="rule_violation" if attempt.get("category") == "deterministic_validation" else "invalid_response",
                recovered=True))
        for key, item in value.items():
            if key not in {"diagnostic_issues", "recovered_attempts", "dataset", "bull_case", "bear_case"}:
                issues.extend(_recovered_model_issues(item, team, key if not stage else stage + "." + key))
    elif isinstance(value, list):
        for item in value:
            issues.extend(_recovered_model_issues(item, team, stage))
    return issues


def _attach_diagnostics(item: dict, diagnostic: dict) -> None:
    item["diagnostics"] = diagnostic
    issues = item.setdefault("diagnostic_issues", [])
    if diagnostic.get("storage_error") and not any(issue.get("stage") == "diagnostics_storage" for issue in issues):
        issues.append(make_issue(diagnostic["storage_error"], team="pipeline", stage="diagnostics_storage", category="storage"))
    supervisor = item.get("supervisor")
    if not supervisor:
        return
    supervisor["diagnostic_issues"] = issues
    supervisor["diagnostics"] = diagnostic
    active = [issue["message"] for issue in issues if not issue.get("recovered")]
    if active:
        supervisor["degraded"] = True
        supervisor["degraded_reasons"] = list(dict.fromkeys(supervisor.get("degraded_reasons", []) + active))
        supervisor.setdefault("quality_gate", {})["degraded_output"] = True


def _complete_supervisor_fallback(evidence: dict, issue: dict) -> dict:
    result = _fallback_supervisor(evidence, [issue["message"]])
    bull, bear = evidence["bull_team"]["leader"], evidence["bear_team"]["leader"]
    current = float(evidence["market_data"]["current_price"])
    frames = evidence.get("timeframe_structure", {})
    result.update({
        "bull_case": bull, "bear_case": bear,
        "decision_support_zones": _nearest_zones(current, bull, bear, "support_zones", below=True),
        "decision_resistance_zones": _nearest_zones(current, bull, bear, "resistance_zones", below=False),
        "macro_views": {"bull": bull["macro_view"], "bear": bear["macro_view"]},
        "timeframe_structure": frames,
        "timeframe_states": {key: frames.get(key, {}).get("state", "unknown") for key in ("monthly", "weekly", "daily")},
        "critics": {}, "critic_resolution": {"status": "pipeline_supervisor_fallback"},
        "quality_gate": {"closed_candles_only": bool(frames.get("data_quality", {}).get("closed_candles_only")),
                         "both_directional_cases_present": bool(bull and bear),
                         "deterministic_ruleset": frames.get("ruleset", {}).get("name"),
                         "critic_coverage": [], "all_critics_available": False, "degraded_output": True},
        "diagnostic_issues": [issue],
    })
    return result


def _cacheable_result(result: object) -> bool:
    if not isinstance(result, dict) or result.get("status") == "unavailable" or result.get("degraded"):
        return False
    leader = result.get("leader")
    return not isinstance(leader, dict) or leader.get("status") != "unavailable"


def _apply_quick_rule_gate(rules: dict) -> None:
    """Keep AI audit concerns, but let exact checks own the quick-run hard gate."""
    leader = rules.get("leader", {})
    deterministic = rules.get("deterministic", {})
    method_contract = deterministic.get("method_contract", {})
    if method_contract.get("status") == "invalid":
        leader["bull_status"] = leader["bear_status"] = "invalid"
        leader["verdict"] = "neither_valid"
        leader["hard_violations"] = list(dict.fromkeys(
            list(leader.get("hard_violations", [])) + list(method_contract.get("violations", []))))
        return
    softened: list[str] = []
    for direction in ("bull", "bear"):
        status_key = f"{direction}_status"
        if (
            leader.get(status_key) == "invalid"
            and deterministic.get(direction, {}).get("status") == "valid"
        ):
            leader[status_key] = "conditional"
            softened.append(direction)
    if softened:
        audit_observations = list(leader.get("hard_violations", []))
        if all(deterministic.get(direction, {}).get("status") == "valid" for direction in ("bull", "bear")):
            leader["hard_violations"] = []
            leader.setdefault("warnings", []).extend(
                "KI-Audit-Beobachtung (nicht durch deterministische Prüfung bestätigt): " + observation
                for observation in audit_observations
            )
        leader.setdefault("warnings", []).append(
            "Schnelllauf: KI-Audit-Bedenken wurden als conditional weitergegeben; "
            "die deterministischen OHLC-/Fibonacci-Prüfungen sind gültig (" + ", ".join(softened) + ")."
        )
    bull_ok = leader.get("bull_status") != "invalid"
    bear_ok = leader.get("bear_status") != "invalid"
    leader["verdict"] = "both_valid" if bull_ok and bear_ok else "bull" if bull_ok else "bear" if bear_ok else "neither_valid"


def collect(settings: Settings) -> dict:
    snapshot = {"generated_at": datetime.now(timezone.utc).isoformat(), "markets": {}}
    cycle_report = {"generated_at": snapshot["generated_at"], "markets": {}}
    database = settings.root / "data" / "markets.sqlite3"
    intraday_start = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    for market in MARKETS:
        m30 = fetch_binance_candles(market.symbol, "30m", intraday_start)
        daily = fetch_binance_candles(market.symbol, "1d", START_DATE)
        weekly = fetch_binance_candles(market.symbol, "1w", START_DATE)
        monthly = fetch_binance_candles(market.symbol, "1M", START_DATE)
        coinbase = fetch_coinbase_daily(market.coinbase_product)
        cycle_context = build_long_cycle_context(market.symbol)
        store_candles(database, m30 + daily + weekly + monthly + coinbase)
        closes = [float(row["close"]) for row in weekly]
        ma = {period: moving_average(closes, period) for period in (5, 10, 20, 50)}
        zones = support_resistance(weekly)
        lookback = weekly[-104:]
        low = min(float(row["low"]) for row in lookback)
        high = max(float(row["high"]) for row in lookback)
        metrics = {
            "last_close": closes[-1],
            "current_price": float(daily[-1]["close"]),
            "current_price_time": int(daily[-1]["close_time"]),
            "last_closed_week": weekly[-1]["close_time"],
            "weekly_candles": len(weekly),
            "daily_candles": len(daily),
            "monthly_candles": len(monthly),
            "rsi14_weekly": rsi(closes),
            "ma5": ma[5][-1], "ma10": ma[10][-1], "ma20": ma[20][-1], "ma50": ma[50][-1],
            "ma5_series": ma[5], "ma10_series": ma[10], "ma20_series": ma[20], "ma50_series": ma[50],
            "support": zones["support"], "resistance": zones["resistance"],
            "fibonacci": fibonacci(low, high),
            "confirmed_major_pivots": major_pivots(weekly, market.reversal_fraction),
            "coinbase_close_deviation": cross_source_deviation(daily, coinbase),
            "cycle_context": cycle_context,
        }
        snapshot["markets"][market.symbol] = {
            "metrics": metrics, "m30": m30[-1500:], "monthly": monthly[-72:], "weekly": weekly[-156:], "daily": daily[-550:]
        }
        cycle_report["markets"][market.symbol] = cycle_context
    write_json(settings.root / "reports" / "market_snapshot.json", snapshot)
    write_json(settings.root / "reports" / "cycle_backtest.json", cycle_report)
    return snapshot


def run(settings: Settings, *, use_ai: bool, publish: bool, mode: str = "standard") -> dict:
    run_id = uuid4().hex
    try:
        return _run(settings, use_ai=use_ai, publish=publish, mode=mode, run_id=run_id)
    except Exception as exc:
        issue = make_issue(exc, team="pipeline", stage="run")
        diagnostic = persist_diagnostics(settings.root / "data" / "markets.sqlite3", run_id, "", [issue])
        reference = ("SQL-Diagnose Lauf " + run_id) if diagnostic["stored"] else ("SQL-Diagnose nicht gespeichert: " + diagnostic["storage_error"])
        raise RuntimeError(f"Analyse nicht abgeschlossen: {issue['category']}: {issue['message']} ({reference})") from exc


def _run(settings: Settings, *, use_ai: bool, publish: bool, mode: str, run_id: str) -> dict:
    mode = normalize_mode(mode)
    snapshot = collect(settings)
    report = {"generated_at": snapshot["generated_at"], "analysis_mode": mode, "run_id": run_id, "markets": {}}
    shared_macro_context = collect_macro_context()
    selected_symbols = {
        value.strip().upper()
        for value in os.getenv("ANALYSIS_SYMBOLS", "").split(",")
        if value.strip()
    }
    unknown_symbols = selected_symbols - set(snapshot["markets"])
    if unknown_symbols:
        raise ValueError("Unbekannte Analysesymbole: " + ", ".join(sorted(unknown_symbols)))
    for symbol, source in snapshot["markets"].items():
        if selected_symbols and symbol not in selected_symbols:
            continue
        dataset = {key: value for key, value in source["metrics"].items() if not key.endswith("_series")}
        dataset["symbol"] = symbol
        dataset["weekly_ohlcv_columns"] = ["open_time", "open", "high", "low", "close", "volume"]
        dataset["m30_ohlcv_columns"] = ["open_time", "open", "high", "low", "close", "volume"]
        dataset["m30_ohlcv"] = [
            [row["open_time"], row["open"], row["high"], row["low"], row["close"], row["volume"]]
            for row in source["m30"][-1000:]
        ]
        dataset["weekly_ohlcv"] = [
            [row["open_time"], row["open"], row["high"], row["low"], row["close"], row["volume"]]
            for row in source["weekly"][-104:]
        ]
        dataset["daily_ohlcv_columns"] = ["open_time", "open", "high", "low", "close", "volume"]
        dataset["daily_ohlcv"] = [
            [row["open_time"], row["open"], row["high"], row["low"], row["close"], row["volume"]]
            for row in source["daily"][-365:]
        ]
        dataset["monthly_ohlcv_columns"] = ["open_time", "open", "high", "low", "close", "volume"]
        dataset["monthly_ohlcv"] = [
            [row["open_time"], row["open"], row["high"], row["low"], row["close"], row["volume"]]
            for row in source["monthly"][-72:]
        ]
        dataset["timeframe_structure"] = build_timeframe_structure(dataset)
        dataset["external_sources_untrusted"] = accepted_for_symbol(settings, symbol)
        dataset["market_news_untrusted"] = active_news_for_symbol(settings, symbol)
        dataset["methodology_library_untrusted"] = load_method_library(settings)
        dataset["confirmatory_market_context"] = collect_confirmatory_context(
            symbol,
            glassnode_key=settings.glassnode_key,
            macro=shared_macro_context,
        )
        expert_path = settings.root / "reports" / "experts" / "latest.json"
        if symbol == "BTCUSDT" and expert_path.exists():
            expert = json.loads(expert_path.read_text(encoding="utf-8"))
            dataset["expert_source_untrusted"] = {
                "metadata": expert.get("metadata", {}),
                "claims": expert.get("claims", {}),
            }
        agents = {}
        teams = {}
        issues = []
        supervisor = None
        if use_ai:
            with ThreadPoolExecutor(max_workers=2) as executor:
                bull_future = executor.submit(
                    _cached, settings.root, symbol, f"v091-team-bull-{mode}", dataset,
                    lambda: run_directional_team(settings, dataset, direction="bull", mode=mode),
                )
                bear_future = executor.submit(
                    _cached, settings.root, symbol, f"v091-team-bear-{mode}", dataset,
                    lambda: run_directional_team(settings, dataset, direction="bear", mode=mode),
                )
                for direction, future in (("bull", bull_future), ("bear", bear_future)):
                    try:
                        teams[direction] = future.result()
                    except Exception as exc:
                        teams[direction] = _team_fallback(dataset, direction, mode, exc, "team")
            agents["gemini"] = teams["bull"]["leader"]
            agents["claude"] = teams["bear"]["leader"]
            rule_evidence = {
                "market_data": dataset,
                "bull": agents["gemini"],
                "bear": agents["claude"],
            }
            teams["rules"] = _cached(
                settings.root, symbol, f"v091-team-rules-{mode}", rule_evidence,
                lambda: _safe_rule_team(
                    settings, dataset, agents["gemini"], agents["claude"], mode=mode,
                ),
            )
            if mode == "quick":
                _apply_quick_rule_gate(teams["rules"])
            invalid_teams = [
                team
                for team, status_key in (("bull", "bull_status"), ("bear", "bear_status"))
                if teams["rules"]["leader"].get(status_key) == "invalid"
            ]
            if invalid_teams:
                issues = _merge_issues(issues, teams["rules"].get("diagnostic_issues", []))
                with ThreadPoolExecutor(max_workers=len(invalid_teams)) as executor:
                    repairs = {
                        team: executor.submit(
                            _cached,
                            settings.root,
                            symbol,
                            f"v091-team-{team}-repair-{mode}",
                            {"dataset": dataset, "team": teams[team], "rules": teams["rules"]},
                            lambda team=team: run_directional_team(
                                settings, dataset, direction=team, mode=mode,
                                repair_context={"rejected_case": teams[team]["leader"], "rule_report": teams["rules"]},
                            ),
                        )
                        for team in invalid_teams
                    }
                    for team, future in repairs.items():
                        previous = teams[team]
                        try:
                            teams[team] = future.result()
                        except Exception as exc:
                            teams[team] = _team_fallback(dataset, team, mode, exc, "team_repair")
                        previous_issues = previous.get("diagnostic_issues", [])
                        if not teams[team].get("degraded"):
                            previous_issues = [{**item, "recovered": True, "fallback": False, "severity": "info"} for item in previous_issues]
                        issues = _merge_issues(issues, previous_issues)
                agents["gemini"] = teams["bull"]["leader"]
                agents["claude"] = teams["bear"]["leader"]
                recheck_evidence = {
                    "market_data": dataset,
                    "bull": agents["gemini"],
                    "bear": agents["claude"],
                    "previous_rule_audit": teams["rules"],
                }
                teams["rules"] = _cached(
                    settings.root, symbol, f"v091-team-rules-recheck-{mode}", recheck_evidence,
                    lambda: _safe_rule_team(
                        settings, dataset, agents["gemini"], agents["claude"], mode=mode, recheck=True,
                    ),
                )
            remaining_invalid = [
                direction for direction in ("bull", "bear")
                if teams["rules"]["leader"].get(f"{direction}_status") == "invalid"
            ]
            if remaining_invalid:
                for direction in remaining_invalid:
                    reason = "Team 3 verwarf den KI-Case nach Reparatur; deterministischer Ersatzfall verwendet."
                    issues = _merge_issues(issues, teams[direction].get("diagnostic_issues", []))
                    issues.append(make_issue(reason, team=direction, stage="rule_rejection", category="rule_violation", fallback=True))
                    teams[direction] = {
                        "team": direction, "mode": mode, "specialists": teams[direction].get("specialists", []),
                        "leader": build_deterministic_directional_case(dataset, direction, reason),
                        "degraded": True,
                        "fallback_errors": list(teams[direction].get("fallback_errors", [])) + [reason],
                    }
                agents["gemini"] = teams["bull"]["leader"]
                agents["claude"] = teams["bear"]["leader"]
                issues = _merge_issues(issues, teams["rules"].get("diagnostic_issues", []))
                teams["rules"] = _safe_rule_team(
                    settings, dataset, agents["gemini"], agents["claude"], mode=mode, recheck=True,
                )
            supervisor_evidence = build_supervisor_evidence(dataset, teams["bull"], teams["bear"], teams["rules"])
            try:
                supervisor = _cached(
                    settings.root, symbol, f"v091-supervisor-{mode}", supervisor_evidence,
                    lambda: supervise_directional(settings, supervisor_evidence),
                )
            except Exception as exc:
                issue = make_issue(exc, team="supervisor", stage="supervisor", fallback=True)
                supervisor = _complete_supervisor_fallback(supervisor_evidence, issue)
            for name, team in teams.items():
                issues = _merge_issues(issues, team.get("diagnostic_issues", []))
                issues = _merge_issues(issues, _recovered_model_issues(team, name))
            issues = _merge_issues(issues, supervisor.get("diagnostic_issues", []))
            issues = _merge_issues(issues, _recovered_model_issues(supervisor, "supervisor"))
        current_chart = settings.root / "reports" / "charts" / f"{symbol}-daily.png"
        weekly_chart = settings.root / "reports" / "charts" / f"{symbol}-weekly.png"
        macro_chart = settings.root / "reports" / "charts" / f"{symbol}-monthly.png"
        if supervisor:
            try:
                render_directional_charts(
                    current_chart, weekly_chart, macro_chart, symbol,
                    source["daily"], source["weekly"], source["monthly"], supervisor,
                )
            except Exception as exc:
                issue = make_issue(exc, team="charts", stage="directional_chart", category="chart", fallback=True)
                issues.append(issue)
                supervisor["degraded"] = True
                supervisor.setdefault("degraded_reasons", []).append(
                    "Chart-Fallback: " + issue["message"]
                )
                supervisor.setdefault("quality_gate", {})["degraded_output"] = True
                try:
                    render_chart(current_chart, symbol, source["daily"], source["metrics"], None)
                except Exception as fallback_exc:
                    issues.append(make_issue(fallback_exc, team="charts", stage="basic_chart", category="chart", fallback=True))
                    supervisor.setdefault("degraded_reasons", []).append("Chart nicht erzeugt; Textanalyse bleibt verfügbar.")
                    current_chart = None
                weekly_chart = current_chart
                macro_chart = current_chart
        else:
            render_chart(current_chart, symbol, source["daily"], source["metrics"], None)
            weekly_chart = current_chart
            macro_chart = current_chart
        report["markets"][symbol] = {
            "dataset": dataset, "teams": teams, "agents": agents, "supervisor": supervisor,
            "diagnostic_issues": issues,
            "chart": str(current_chart) if current_chart else None,
            "charts": {
                "current": str(current_chart) if current_chart else None, "daily": str(current_chart) if current_chart else None,
                "weekly": str(weekly_chart) if weekly_chart else None,
                "macro": str(macro_chart) if macro_chart else None, "monthly": str(macro_chart) if macro_chart else None,
            },
        }
    output = settings.root / "reports" / "analysis_report.json"
    database = settings.root / "data" / "markets.sqlite3"
    try:
        record_analysis_report(database, report)
        refresh_forecast_report(settings.root, database)
    except Exception as exc:
        issue = make_issue(exc, team="forecast_memory", stage="forecast_persistence", category="storage")
        for item in report["markets"].values():
            item["diagnostic_issues"].append(issue)
    for symbol, item in report["markets"].items():
        diagnostic = persist_diagnostics(database, run_id, symbol, item["diagnostic_issues"])
        _attach_diagnostics(item, diagnostic)
    try:
        write_json(output, report)
    except OSError as exc:
        issue = make_issue(exc, team="pipeline", stage="report_persistence", category="storage")
        for symbol, item in report["markets"].items():
            item["diagnostic_issues"].append(issue)
            extra = persist_diagnostics(database, run_id, symbol, [issue])
            item["diagnostics"]["issue_ids"].extend(extra["issue_ids"])
            item["diagnostics"]["stored"] = item["diagnostics"]["stored"] and extra["stored"]
            item["diagnostics"]["storage_error"] = item["diagnostics"]["storage_error"] or extra["storage_error"]
            _attach_diagnostics(item, item["diagnostics"])
    if publish:
        publish_report(settings, report)
    return report


def publish_report(settings: Settings, report: dict | None = None) -> int:
    if report is None:
        report = json.loads((settings.root / "reports" / "analysis_report.json").read_text(encoding="utf-8"))
    result = publish_outputs(settings, report)
    return int(result["telegram_messages"])
