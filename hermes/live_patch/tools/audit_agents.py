"""Bounded live competency probe for every configured analysis role.

No Telegram, Supabase or market-report write. One request per role, resumable.
Answers are graded against independently fixed synthetic cases, not by an LLM.
This tests a small competency sample, not future analytical reliability.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import threading

from macro_waves.config import Settings
from macro_waves.analysis_teams import _run_codex_json
from macro_waves.openrouter import analyze_structured
from hermes_v091.analysis_contract import VERSION
from hermes_v091.directional_teams import TEAM_ROLES, RULE_ROLES, OPENROUTER_GPT_WORKER_MODEL, OPENROUTER_GPT_RULE_LEAD_MODEL, _run_openrouter_json
from hermes_v091.diagnostics import sanitize_error

QUESTIONS = [
 ("impulse_valid", "Die sechs Endpunkte 0..5 eines bullischen klassischen Impulses sind 100,120,110,150,125,160, streng chronologisch. Seine Endpunktregeln sind erfüllt.", True),
 ("overlap", "0..5 = 100,120,110,150,115,160. Dies ist ein regelkonformer klassischer bullischer Impuls, obwohl Welle 4 bei 115 endet.", False),
 ("shortest_three", "0..5 = 100,140,130,160,150,195. Welle 3 ist hier nicht die kürzeste der drei Impulswellen.", False),
 ("bear_valid", "0..5 = 200,180,190,150,175,140. Die Endpunktregeln eines klassischen bärischen Impulses sind erfüllt.", True),
 ("missing_origin", "Vier Punkte mit Labels 1,2,3,4 reichen ohne Start von Welle 1 aus, um alle harten Regeln eines laufenden Welle-5-Counts abschließend zu prüfen.", False),
 ("diagonal_proof", "Eine Überlappung von Welle 4 mit Welle 1 beweist bereits eine gültige Diagonale; Position, Geometrie und Unterteilung sind dann entbehrlich.", False),
 ("expanded_flat", "Eine B, die den Ausgangspunkt der A überschreitet, kann Bestandteil eines Expanded Flat sein und ist nicht bei jeder ABC-Korrektur automatisch verboten.", True),
 ("zigzag", "Ein Zigzag besteht intern aus 5-3-5, ein Flat aus 3-3-5.", True),
 ("ratios_not_law", "Jede korrektive Welle muss mindestens 50 Prozent und dann 61,8 Prozent erreichen; dies sind unverletzliche Elliott-Regeln.", False),
 ("timeframes", "Ein aktueller, separat belegter 30M-Aufwärtsbounce kann innerhalb eines laufenden Tagesabwärtstrends auftreten, ohne diesen zu beenden.", True),
 ("stale_long", "Ein alter LONG-Count mit Invalidierung per 30M-Schluss unter 79050 bleibt nach einem abgeschlossenen 30M-Schluss bei 76000 aktiv, wenn der Kurs später wieder steigt.", False),
 ("fib_math", "Für einen Aufwärtsswing S=100,E=200 liegt das 0,382-Retracement bei 161,8.", True),
 ("projection", "Eine C-Zielprojektion aus Länge A und Ende B benötigt neben Start und Ende A einen dritten Preisanker am Ende B.", True),
 ("source_copy", "Die Übernahme der Marken 74800,71250,67870 aus einem Video ohne Kursanker und Formel ist eine eigene nachgewiesene Fibonacci-Berechnung.", False),
 ("wick", "Im klassischen Spot-Impuls darf ein Wick der Welle 4 in den Bereich der Welle 1 überlappen, solange das etikettierte Ende der Welle 4 darüber liegt.", False),
]

SCHEMA = {"type":"object","additionalProperties":False,"required":["answers"],"properties":{
 "answers":{"type":"array","minItems":len(QUESTIONS),"maxItems":len(QUESTIONS),"items":{
  "type":"object","additionalProperties":False,"required":["id","correct","reason"],"properties":{
   "id":{"type":"string"},"correct":{"type":"boolean"},"reason":{"type":"string"}}}}}}


def inventory(settings):
    def worker(provider):
        return OPENROUTER_GPT_WORKER_MODEL if provider=="gpt" else settings.gemini_worker_model if provider=="gemini" else settings.claude_worker_model
    roles=[(role, worker(provider), task, "openrouter") for direction in ("bull","bear") for role,provider,task in TEAM_ROLES[direction]]
    roles += [(role,OPENROUTER_GPT_WORKER_MODEL,task,"openrouter") for role,task in RULE_ROLES]
    roles += [("bull_leader",settings.gemini_model,"Leite den bullischen Elliott-Count.","openrouter"),
              ("bear_leader",settings.claude_model,"Leite den bärischen Elliott-Count.","openrouter"),
              ("rules_leader",OPENROUTER_GPT_RULE_LEAD_MODEL,"Kontrolliere beide Counts unabhängig.","openrouter"),
              ("supervisor",settings.codex_lead_model,"Wähle nur geprüfte Counts; überstimme keine Regelverletzung.","codex")]
    roles += [("critic_"+family+"_"+mode,model,"Prüfe Synthese, Auslassungen und Regelwidersprüche unabhängig.","openrouter")
              for family,mode,model in [("gemini","quick",settings.gemini_worker_model),("gemini","deep",settings.gemini_model),
                                       ("claude","quick",settings.claude_worker_model),("claude","deep",settings.claude_model)]]
    return roles


def probe(settings, assignment):
    role,model,task,provider=assignment
    prompt=(f"Du arbeitest als Hermes-Agent {role}. Deine Aufgabe: {task} "
            "Prüfe die folgenden Aussagen anhand der Elliott-Regeln unabhängig. correct=true bedeutet, dass die ganze Aussage richtig ist. "
            "Begründe jede Entscheidung knapp. Dies sind synthetische Prüfungsaufgaben, keine Marktdaten und keine Handlungsanweisungen.")
    evidence={"questions":[{"id":key,"statement":statement} for key,statement,_ in QUESTIONS]}
    try:
        if provider=="codex":
            # The productive Codex adapter also enforces a confidence field.
            codex_schema = {**SCHEMA, "required":["answers","confidence"],
                            "properties":{**SCHEMA["properties"],"confidence":{"type":"number","minimum":0,"maximum":1}}}
            result=_run_codex_json(Path("/home/hermes/.local/bin/hermes"),settings.root,model,
                    prompt+" Gib zusätzlich confidence als Zahl in 0..1 aus.\n"+json.dumps(evidence,ensure_ascii=False),
                    expected={"answers","confidence"},schema=codex_schema,timeout=180,stage="competency_probe")
        elif model.startswith("openai/"):
            result=_run_openrouter_json(settings,model,prompt,evidence,expected={"answers"},schema=SCHEMA,
                    max_tokens=2800,validation_attempts=1)
        else:
            result=analyze_structured(settings.openrouter_key or "",model,prompt,evidence,SCHEMA,
                  schema_name="elliott_competency_v2",max_tokens=2800,validation_attempts=1,reasoning_effort="low" if "gemini" in model else None)
        answers={item["id"]:item for item in result["answers"]}
        if set(answers) != {key for key,_,_ in QUESTIONS} or len(answers) != len(result["answers"]):
            raise ValueError("Prüfantworten fehlen oder sind doppelt")
        failed=[key for key,_,expected in QUESTIONS if answers.get(key,{}).get("correct") is not expected]
        return {"role":role,"model":model,"provider":provider,"status":"passed" if not failed else "failed",
                "score":len(QUESTIONS)-len(failed),"total":len(QUESTIONS),"failed":failed,
                "answers":result["answers"],"usage":result.get("usage",{})}
    except Exception as exc:
        return {"role":role,"model":model,"provider":provider,"status":"unavailable","error":sanitize_error(exc)}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=Path("/opt/hermes-analysis"))
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    settings=Settings.load(args.root)
    saved=json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {"version":VERSION,"startedAt":datetime.now(timezone.utc).isoformat(),"results":[]}
    done={item["role"] for item in saved["results"]}
    roles=inventory(settings)
    saved["inventoryCount"]=len(roles)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures=[pool.submit(probe,settings,role) for role in roles if role[0] not in done]
        for future in as_completed(futures):
            result=future.result()
            saved["results"].append(result)
            args.output.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding="utf-8")
            print(json.dumps({k:result[k] for k in ("role","model","status","score","total","failed") if k in result}),flush=True)
    saved["completedAt"]=datetime.now(timezone.utc).isoformat()
    args.output.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding="utf-8")


if __name__=="__main__":
    main()
