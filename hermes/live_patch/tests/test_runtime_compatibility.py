from __future__ import annotations

import inspect
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from macro_waves.openrouter import analyze_structured
from hermes_v091.directional_supervisor import _fallback_supervisor, aggregate_timeframe_state, calibrate_confidence, critic_families_for_mode
from hermes_v091.directional_teams import (
    OPENROUTER_GPT_RULE_LEAD_MODEL,
    OPENROUTER_GPT_WORKER_MODEL,
    TEAM_ROLES,
    _run_openrouter_json,
    _method_contract_check,
    build_deterministic_directional_case,
    run_directional_rule_team,
    run_directional_team,
    validate_directional_case,
)
from hermes_v091.timeframe_structure import FIB_RATIOS, MCO_RULES, build_timeframe_structure


def row(stamp: int, opening: float, high: float, low: float, close: float) -> list:
    return [stamp, opening, high, low, close, 1.0]


def fallback_dataset() -> dict:
    monthly = [
        row(1_700_000_000_000, 100_000, 126_000, 95_000, 110_000),
        row(1_710_000_000_000, 110_000, 112_000, 57_770, 60_000),
        row(1_720_000_000_000, 60_000, 85_000, 59_000, 80_000),
    ]
    weekly = [row(1_700_000_000_000 + i * 604_800_000, 70_000, 72_000, 68_000, 70_000 + i * 100) for i in range(60)]
    daily = [row(1_777_075_200_000 + i * 86_400_000, 77_000, 82_000, 75_000, 78_000) for i in range(10)]
    daily[-1][2] = 84_000
    daily[-1][4] = 83_000
    dataset = {
        "symbol": "BTCUSDT", "current_price": 83_000, "last_close": 83_000,
        "monthly_ohlcv": monthly, "weekly_ohlcv": weekly, "daily_ohlcv": daily,
        "support": [60_000, 75_000], "resistance": [84_000, 92_000],
        "fibonacci": {"0.382": 83_800, "0.5": 92_000, "0.618": 100_000},
    }
    dataset["timeframe_structure"] = build_timeframe_structure(dataset)
    return dataset


class RuntimeV091Tests(unittest.TestCase):
    def test_deterministic_fallbacks_never_fabricate_a_valid_wave_count(self):
        dataset = fallback_dataset()
        for direction in ("bull", "bear"):
            case = build_deterministic_directional_case(dataset, direction, "provider offline")
            self.assertIn(case["elliott_validation"]["status"], {"conditional", "invalid"})
            self.assertEqual(case["pattern"], "unclassified")
            self.assertEqual(case["current_wave"]["status"], "unclear")
            self.assertEqual(case["case_direction"], direction)
            self.assertEqual(case["model"], "deterministic-fallback")
            self.assertLessEqual(case["confidence"], 0.2)

    def test_total_directional_provider_failure_still_returns_team_result(self):
        settings = SimpleNamespace(
            root=None, openrouter_key="test", gemini_worker_model="gemini-worker",
            claude_worker_model="claude-worker", gemini_model="gemini-lead",
            claude_model="claude-lead",
        )
        with patch("hermes_v091.directional_teams.analyze_structured", side_effect=RuntimeError("offline")), patch(
            "hermes_v091.directional_teams._run_openrouter_json", side_effect=RuntimeError("offline")
        ):
            team = run_directional_team(settings, fallback_dataset(), direction="bull", mode="quick")
        self.assertTrue(team["degraded"])
        self.assertEqual(team["leader"]["model"], "deterministic-fallback")

    def test_supervisor_fallback_is_explicit_and_neutral_for_mixed_frames(self):
        dataset = fallback_dataset()
        evidence = {
            "timeframe_structure": dataset["timeframe_structure"],
            "bull_team": {"leader": build_deterministic_directional_case(dataset, "bull", "offline")},
            "bear_team": {"leader": build_deterministic_directional_case(dataset, "bear", "offline")},
        }
        result = _fallback_supervisor(evidence, ["supervisor offline"])
        self.assertTrue(result["degraded"])
        self.assertEqual(result["selected_bias"], "neutral")
        self.assertEqual(result["model"], "deterministic-fallback")

    def test_critic_profiles(self):
        self.assertEqual(critic_families_for_mode("quick", "claude"), ["claude"])
        self.assertEqual(critic_families_for_mode("standard"), ["gemini", "claude"])
        self.assertEqual(critic_families_for_mode("deep"), ["gemini", "claude"])

    def test_standard_directional_teams_mix_all_model_families(self):
        self.assertEqual({item[1] for item in TEAM_ROLES["bull"][:3]}, {"gemini", "claude", "gpt"})
        self.assertEqual({item[1] for item in TEAM_ROLES["bear"][:3]}, {"gemini", "claude", "gpt"})

    def test_gpt_specialists_and_rule_team_use_openrouter_not_codex_subscription(self):
        self.assertEqual(OPENROUTER_GPT_WORKER_MODEL, "openai/gpt-5.6-luna")
        self.assertEqual(OPENROUTER_GPT_RULE_LEAD_MODEL, "openai/gpt-5.6-luna-pro")
        self.assertNotIn("_run_codex_json", inspect.getsource(run_directional_team))
        self.assertNotIn("_run_codex_json", inspect.getsource(run_directional_rule_team))

    def test_openrouter_gpt_json_is_locally_validated(self):
        response = {
            "choices": [{"message": {"content": '{"confidence":0.7}'}}],
            "usage": {"cost": 0.01},
        }
        with patch("hermes_v091.directional_teams._request_model_json", return_value=response):
            result = _run_openrouter_json(
                SimpleNamespace(openrouter_key="test"), "openai/gpt-5.6-luna",
                "Return JSON", {}, expected={"confidence"}, max_tokens=100,
            )
        self.assertEqual(result["model"], "openai/gpt-5.6-luna")
        self.assertEqual(result["usage"]["cost"], 0.01)

    def test_structured_model_retries_empty_and_truncated_content_from_clean_context(self):
        responses = [
            {"choices": [{"finish_reason": "stop", "message": {"content": None}}], "usage": {}},
            {"choices": [{"finish_reason": "length", "message": {"content": '{"confidence":'}}], "usage": {}},
            {"choices": [{"finish_reason": "stop", "message": {"content": '{"confidence":0.7}'}}], "usage": {"cost": 0.01}},
        ]
        schema = {
            "type": "object", "additionalProperties": False,
            "required": ["confidence"],
            "properties": {"confidence": {"type": "number"}},
        }
        with patch("macro_waves.openrouter._request_model_json", side_effect=responses) as request, patch(
            "macro_waves.openrouter.time.sleep"
        ):
            result = analyze_structured(
                "test", "anthropic/claude-sonnet-4.6", "Return JSON", {}, schema,
                schema_name="retry_test", validation_attempts=3,
                validator=lambda value: float(value["confidence"]),
            )
        self.assertEqual(result["confidence"], 0.7)
        self.assertEqual(request.call_count, 3)
        for call in request.call_args_list[1:]:
            messages = call.kwargs["body"]["messages"]
            self.assertFalse(any(message.get("role") == "assistant" for message in messages))

    def test_gpt_directional_fallback_retries_full_validator_failure(self):
        responses = [
            {"choices": [{"message": {"content": '{"confidence":0.5,"target_zone":[1]}'}}], "usage": {}},
            {"choices": [{"message": {"content": '{"confidence":0.5,"target_zone":[1,2]}'}}], "usage": {"cost": 0.01}},
        ]

        def validator(value: dict) -> None:
            if len(value["target_zone"]) != 2:
                raise ValueError("target_zone muss genau zwei Werte haben")

        with patch("hermes_v091.directional_teams._request_model_json", side_effect=responses) as request, patch(
            "hermes_v091.directional_teams.time.sleep"
        ):
            result = _run_openrouter_json(
                SimpleNamespace(openrouter_key="test"), "openai/gpt-5.6-luna-pro",
                "Return JSON", {}, expected={"confidence", "target_zone"}, max_tokens=100,
                validator=validator, validation_attempts=3,
            )
        self.assertEqual(result["target_zone"], [1, 2])
        self.assertEqual(request.call_count, 2)

    def test_confidence_is_capped_for_mixed_timeframes_and_two_cases(self):
        value, detail = calibrate_confidence(
            0.91,
            {"market_state": "decision_zone", "selected_bias": "neutral", "preferred_case": "balanced"},
            {"monthly": "range", "weekly": "range", "daily": "bullish_breakout"},
            {"verdict": "both_valid", "bull_status": "conditional", "bear_status": "conditional"},
            {"gemini": {"confidence_cap": 0.8}, "claude": {"confidence_cap": 0.75}},
        )
        self.assertEqual(value, 0.65)
        self.assertEqual(detail["final"], 0.65)
    def test_mixed_timeframes_are_neutral_decision_zone(self):
        result = aggregate_timeframe_state({
            "monthly": {"state": "range"},
            "weekly": {"state": "range"},
            "daily": {"state": "bullish_breakout"},
        })
        self.assertEqual(result["market_state"], "decision_zone")
        self.assertEqual(result["selected_bias"], "neutral")

    def test_direction_requires_alignment_of_all_timeframes(self):
        frames = {key: {"state": "bullish_breakout"} for key in ("monthly", "weekly", "daily")}
        self.assertEqual(aggregate_timeframe_state(frames)["market_state"], "bullish")
        frames["weekly"]["state"] = "range"
        self.assertEqual(aggregate_timeframe_state(frames)["market_state"], "decision_zone")

    def test_all_ranges_are_sideways(self):
        frames = {key: {"state": "range"} for key in ("monthly", "weekly", "daily")}
        self.assertEqual(aggregate_timeframe_state(frames)["market_state"], "sideways")

    def test_ruleset_contains_required_mco_contract(self):
        ids = {item["id"] for item in MCO_RULES}
        self.assertTrue({"TF-01", "RANGE-01", "CLOSE-01", "FIB-01", "MA-01"}.issubset(ids))
        self.assertEqual([ratio for ratio, _ in FIB_RATIOS], ["0.382", "0.5", "0.618"])

    def test_btc_confirmed_daily_range_is_stable(self):
        monthly = [
            row(1_700_000_000_000, 100_000, 126_000, 95_000, 110_000),
            row(1_710_000_000_000, 110_000, 112_000, 57_770, 60_000),
            row(1_720_000_000_000, 60_000, 85_000, 59_000, 80_000),
        ]
        weekly = [row(1_700_000_000_000 + i * 604_800_000, 70_000, 72_000, 68_000, 70_000 + i * 100) for i in range(60)]
        daily = [row(1_777_075_200_000 + i * 86_400_000, 77_000, 82_000, 75_000, 78_000) for i in range(10)]
        daily[-1][4] = 83_000
        result = build_timeframe_structure({
            "symbol": "BTCUSDT", "current_price": 83_000,
            "monthly_ohlcv": monthly, "weekly_ohlcv": weekly, "daily_ohlcv": daily,
        })
        self.assertEqual(result["daily"]["state"], "bullish_breakout")
        self.assertEqual(result["daily"]["resistance_zone"], [78_000.0, 82_000.0])
        self.assertTrue(result["data_quality"]["closed_candles_only"])

    def test_method_contract_rejects_local_trend_promotion(self):
        structure = {
            "ruleset": {"rules": [{"id": value} for value in ("TF-01", "RANGE-01", "CLOSE-01", "FIB-01", "MA-01")]},
            "data_quality": {"closed_candles_only": True},
            "daily": {"state": "range"},
            "monthly": {"c_wave_status": "not_confirmed"},
        }
        levels = [{"ratio": ratio} for ratio in ("0.382", "0.5", "0.618")]
        bull = {"market_state": "trend", "fibonacci_levels": levels}
        bear = {"market_state": "decision_zone", "fibonacci_levels": levels}
        result = _method_contract_check({"timeframe_structure": structure}, bull, bear)
        self.assertEqual(result["status"], "invalid")
        self.assertIn("Bull-Case meldet Trend", result["violations"][0])

    def test_same_candle_fibonacci_anchors_are_rejected(self):
        from test_evidence_contract import fixture
        case, dataset = fixture()
        case["fib_anchor_end"]["time"] = case["fib_anchor_start"]["time"]
        case["fib_anchor_end"]["price"] = case["fib_anchor_start"]["price"]
        with self.assertRaisesRegex(ValueError, "chronologisch"):
            validate_directional_case(case, dataset, "bull")

    def test_primary_fibonacci_levels_are_deterministic(self):
        from hermes_v091.analysis_contract import calculated_levels
        rows = [row(0,100,100,100,100),row(86400000,200,200,200,200)]
        case = {"fib_method":"retracement", "fib_anchor_start":{"time":0,"price":100},
                "fib_anchor_end":{"time":86400000,"price":200},
                "fibonacci_levels":[{"ratio":str(r)} for r in (0.382,0.5,0.618)]}
        self.assertEqual([level["price"] for level in calculated_levels(case, rows)], [161.8,150,138.2])


if __name__ == "__main__":
    unittest.main()
