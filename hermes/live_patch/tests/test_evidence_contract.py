from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from hermes_v091.analysis_contract import AGENT_CONTRACT, VERSION, audit_case, calculated_levels, candle_close_time, closed_rows
from hermes_v091.directional_teams import validate_directional_case
from hermes_v091.signal_lifecycle import evaluate_plan
from macro_waves.market_publication import build_market_payload, alert_levels, format_compact_summaries, _signal_plans
from macro_waves.openrouter import analyze_structured

DAY = 86_400_000
BASE = 1_790_000_000_000 // DAY * DAY


def fixture():
    prices = [100, 120, 110, 150, 125]
    rows = [[BASE + i*DAY, p, p, p, p, 10] for i, p in enumerate(prices)]
    rows.append([BASE + 5*DAY, 151, 152, 150.5, 151, 10])
    points = [{"label": f"Welle {i}", "time": rows[i][0], "price": p} for i, p in enumerate(prices)]
    case = {"case_direction": "bull", "pattern": "impulse", "fib_method": "projection",
            "current_wave": {"label": "Welle 5", "status": "forming", "degree": "daily"},
            "wave_points": points, "fib_anchor_start": points[0].copy(), "fib_anchor_end": points[1].copy(),
            "fib_projection_origin": points[4].copy(),
            "fibonacci_levels": [{"ratio": "1.618", "price": 157.36, "role": "target"},
                                  {"ratio": "2.618", "price": 177.36, "role": "target"}],
            "trigger": 150, "invalidation": 125, "target_zone": [157.36, 177.36]}
    dataset = {"daily_ohlcv": rows, "current_price": 151, "current_price_time": BASE + 6*DAY - 1}
    return case, dataset


class EvidenceTests(unittest.TestCase):
    def test_valid_count_has_cpu_formulas_and_separate_trigger(self):
        case, data = fixture()
        audit = audit_case(case, data, "bull")
        self.assertEqual(audit["status"], "valid", audit)
        self.assertTrue(audit["triggerConfirmed"])
        self.assertIn("125.0 +", audit["levels"][0]["formula"])

    def test_validator_never_changes_wave_label_price_stop_or_target(self):
        case, data = fixture()
        original = copy.deepcopy(case)
        validate_directional_case(case, data, "bull")
        case.pop("elliott_validation")
        self.assertEqual(case, original)
        case["wave_points"][2]["price"] += 0.5
        original = copy.deepcopy(case)
        with self.assertRaises(ValueError):
            validate_directional_case(case, data, "bull")
        self.assertEqual(case, original)

    def test_classic_wave_four_overlap_rejected_in_both_directions(self):
        for direction in ("bull", "bear"):
            case, data = fixture()
            case["wave_points"][4]["price"] = 115
            case["fib_projection_origin"]["price"] = 115
            data["daily_ohlcv"][4][1:5] = [115]*4
            if direction == "bear":
                case["case_direction"] = "bear"
                for point in case["wave_points"]:
                    point["price"] = 300-point["price"]
                for key in ("fib_anchor_start", "fib_anchor_end", "fib_projection_origin"):
                    case[key]["price"] = 300-case[key]["price"]
                for row in data["daily_ohlcv"]:
                    o,h,l,c = row[1:5]
                    row[1:5] = [300-o,300-l,300-h,300-c]
                data["current_price"] = 149
                case["trigger"], case["invalidation"] = 150,185
            for level in case["fibonacci_levels"]:
                level.pop("price")
            computed = calculated_levels(case, data["daily_ohlcv"])
            case["target_zone"] = [x["price"] for x in computed]
            self.assertEqual(audit_case(case,data,direction)["status"], "invalid")

    def test_intra_wave_four_wick_cannot_be_hidden_by_safe_endpoint(self):
        case,data = fixture()
        data["daily_ohlcv"].insert(4,[BASE+3*DAY+DAY//2,130,135,119,130,1])
        audit = audit_case(case,data,"bull")
        self.assertIn("Wick", " ".join(audit["violations"]))

    def test_missing_wave_zero_and_rounded_anchor_rejected(self):
        case,data = fixture()
        case["wave_points"] = case["wave_points"][1:]
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")
        case,data = fixture()
        case["fib_anchor_end"]["price"] = 119.9
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")

    def test_future_and_higher_timeframe_prices_cannot_anchor_daily_count(self):
        case,data = fixture()
        data["current_price_time"] -= DAY
        self.assertEqual(len(closed_rows(data)),5)
        case["fib_projection_origin"]["time"] += 4*DAY
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")
        case,data = fixture()
        case["wave_points"][1]["price"] = 121
        data["weekly_ohlcv"] = [[case["wave_points"][1]["time"],121,121,121,121,1]]
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")

    def test_arbitrary_levels_and_fictitious_target_zone_rejected(self):
        case,data = fixture()
        case["fibonacci_levels"][0]["price"] = 160
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")
        case,data = fixture()
        case["target_zone"] = [160,180]
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")

    def test_projection_requires_third_anchor(self):
        case,data = fixture()
        del case["fib_projection_origin"]
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")

    def test_invalidated_case_cannot_recover(self):
        case,data = fixture()
        data["daily_ohlcv"].extend([[BASE+6*DAY,124,124,124,124,1],[BASE+7*DAY,151,151,151,151,1]])
        data["current_price_time"] += 2*DAY
        self.assertEqual(audit_case(case,data,"bull")["status"],"invalid")

    def test_overrides_are_not_read_and_old_report_cannot_publish_old_targets(self):
        case,data = fixture()
        report = {"generated_at":"2026-10-30T01:00:00+00:00"}
        item = {"dataset": data,"supervisor":{"selected_bias":"neutral","bull_case":case}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"data"
            path.mkdir()
            (path/"market-signal-overrides.json").write_text('{"BTCUSDT":[{"direction":"long","price":81307}]}')
            with patch.dict(os.environ,{"HERMES_ROOT":directory}):
                payload = build_market_payload(report,"BTCUSDT",item)
        self.assertEqual(payload["direction"],"wait")
        self.assertEqual(alert_levels(payload),[])
        self.assertEqual(payload["activeCase"]["wavePoints"],[])
        self.assertTrue(all("WARTEN" in text and "81.307" not in text for _,text in format_compact_summaries(payload)))

    def test_no_daily_case_is_reused_as_m30_case(self):
        case,data = fixture()
        item = {"dataset":data,"supervisor":{"selected_bias":"bull","bull_case":case},
                "teams":{"rules":{"leader":{"bull_status":"valid"}}}}
        plans = _signal_plans({},"BTCUSDT",item,now=data["current_price_time"])
        self.assertEqual(next(p for p in plans if p["timeframe"]=="daily")["direction"],"long")
        self.assertEqual(next(p for p in plans if p["timeframe"]=="m30")["direction"],"wait")

    def test_rule_team_rejection_cannot_be_overruled_by_supervisor(self):
        case,data = fixture()
        item={"dataset":data,"supervisor":{"selected_bias":"bull","bull_case":case},"teams":{"rules":{"leader":{"bull_status":"invalid"}}}}
        plan=next(p for p in _signal_plans({},"BTCUSDT",item,now=data["current_price_time"]) if p["timeframe"]=="daily")
        self.assertEqual(plan["direction"],"wait")

    def test_shared_contract_reaches_structured_provider(self):
        response={"choices":[{"message":{"content":'{"ok":true}'},"finish_reason":"stop"}],"usage":{}}
        schema={"type":"object","required":["ok"],"properties":{"ok":{"type":"boolean"}},"additionalProperties":False}
        with patch("macro_waves.openrouter._request_model_json",return_value=response) as call:
            analyze_structured("test","test","Role",{},schema,schema_name="test")
        self.assertIn(VERSION,call.call_args.kwargs["body"]["messages"][0]["content"])


class LifecycleTests(unittest.TestCase):
    def plan(self):
        return {"id":"test", "timeframe":"m30","direction":"long","status":"active","asOf":BASE-1,
                "invalidation":{"price":79050},"levels":[{"ratio":"0.382","price":81307,"crossing":"up"}]}

    def test_screenshot_failure_invalidates_before_bounce_target(self):
        rows=[[BASE,78000,79000,76000,77000,1],[BASE+1800000,80000,82000,80000,81800,1]]
        result=evaluate_plan(self.plan(),rows,now=BASE+3600000)
        self.assertEqual(result["status"],"invalidated")
        self.assertEqual(result["hitLevels"],[])
        replay=evaluate_plan(self.plan(),rows[1:],now=BASE+3600000,previous=result)
        self.assertEqual(replay["status"],"invalidated")

    def test_same_candle_target_and_stop_is_ambiguous(self):
        result=evaluate_plan(self.plan(),[[BASE,80000,82000,76000,77000,1]],now=BASE+1800000)
        self.assertEqual(result["status"],"ambiguous")
        self.assertEqual(result["hitLevels"],[])

    def test_open_candle_and_pre_analysis_target_do_not_count(self):
        rows=[[BASE-1800000,82000,82000,82000,82000,1],[BASE,80000,82000,80000,81500,1]]
        result=evaluate_plan(self.plan(),rows,now=BASE+500000)
        self.assertEqual(result["status"],"active")
        self.assertEqual(result["hitLevels"],[])

    def test_expired_m30_is_terminal(self):
        self.assertEqual(evaluate_plan(self.plan(),[],now=BASE+2*DAY)["status"],"expired")


if __name__=="__main__":
    unittest.main()
