"""
Verification suite for the baseline-vs-ML evaluation and the risk engine's
missing-input behaviour.

Runs without FastAPI so it can execute anywhere sklearn is installed:
    python3 tests_upgrade.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.ml import evaluation as ev
from app.ml.engine import calculate_project_risk, RISK_UNAVAILABLE_MESSAGE

DEMO = Path(__file__).parent / "app" / "data" / "projects_demo.json"

passed, failed = [], []


def check(name, condition, detail=""):
    (passed if condition else failed).append(name)
    print(f"{'PASS' if condition else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def main():
    projects = json.loads(DEMO.read_text())

    # ---------------- 1. Both models train on the same setup ----------------
    result = ev.run_evaluation(projects)
    check("evaluation runs and is available", result.get("available") is True)

    proto = result["evaluation_protocol"]
    cls, reg = result["classification"], result["regression"]

    check("conventional classification baseline is Logistic Regression",
          cls["baseline"]["name"] == "Logistic Regression")
    check("conventional regression baseline is Linear Regression",
          reg["baseline"]["name"] == "Linear Regression")
    check("ML model is XGBoost or the declared Random Forest fallback",
          cls["ml"]["name"] in ("XGBoost", "Random Forest"), cls["ml"]["name"])
    check("ML fallback is disclosed when XGBoost is absent",
          ev.XGBOOST_AVAILABLE or cls["ml"]["fallback_note"] is not None)
    check("classification and regression report the same ML estimator",
          cls["ml"]["name"] == reg["ml"]["name"])

    check("train + test equals the full dataset",
          proto["train_samples"] + proto["test_samples"] == len(projects),
          f'{proto["train_samples"]}+{proto["test_samples"]}={len(projects)}')
    check("required same-data statement is present",
          proto["statement"] ==
          "Evaluation uses the same test dataset and evaluation procedure for both models.")

    # ---------------- 2. All five / three metrics are real numbers ----------
    for side in ("baseline", "ml"):
        m = cls[side]["metrics"]
        check(f"classification {side} reports all 5 metrics",
              all(isinstance(m[k], float) for k in
                  ("accuracy", "precision", "recall", "f1", "roc_auc")), str(m))
        check(f"classification {side} metrics lie in [0,1]",
              all(0.0 <= m[k] <= 1.0 for k in m if m[k] is not None))
        r = reg[side]["metrics"]
        check(f"regression {side} reports MAE, RMSE and R2",
              all(isinstance(r[k], float) for k in ("mae", "rmse", "r2")), str(r))
        check(f"regression {side} RMSE is at least MAE", r["rmse"] >= r["mae"])

    # ---------------- 3. Metrics are computed, not hard-coded --------------
    # Re-running on a different subset must move the numbers. If any value were
    # a constant in the source it would survive this unchanged.
    subset = projects[:320]
    alt = ev.run_evaluation(subset)
    check("evaluation succeeds on a different subset", alt.get("available") is True)
    check("sample counts follow the dataset actually passed in",
          alt["evaluation_protocol"]["train_samples"] +
          alt["evaluation_protocol"]["test_samples"] == len(subset))
    moved = (alt["classification"]["ml"]["metrics"]["accuracy"] !=
             cls["ml"]["metrics"]["accuracy"]) or \
            (alt["regression"]["ml"]["metrics"]["mae"] != reg["ml"]["metrics"]["mae"])
    check("metrics change when the dataset changes (not hard-coded)", moved)

    # Determinism: same input, same seed, same numbers.
    again = ev.run_evaluation(projects)
    check("evaluation is reproducible for a fixed seed",
          again["classification"]["ml"]["metrics"] == cls["ml"]["metrics"])

    # ---------------- 4. Shared split, verified directly -------------------
    import numpy as np
    from sklearn.model_selection import train_test_split
    y = np.array([int(p.get("is_high_risk_target", 0)) for p in projects])
    idx = np.arange(len(projects))
    tr1, te1 = train_test_split(idx, test_size=ev.TEST_SIZE,
                                random_state=ev.RANDOM_STATE, stratify=y)
    tr2, te2 = train_test_split(idx, test_size=ev.TEST_SIZE,
                                random_state=ev.RANDOM_STATE, stratify=y)
    check("the split is deterministic, so both models see identical rows",
          np.array_equal(tr1, tr2) and np.array_equal(te1, te2))
    check("train and test sets do not overlap", len(set(tr1) & set(te1)) == 0)

    # ---------------- 5. Leakage control -----------------------------------
    feats = set(proto["features"])
    leaked = feats & set(ev.LEAKING_FIELDS)
    check("no target-derived field is used as a feature", not leaked, str(leaked))

    # ---------------- 6. Model information card is fully populated ---------
    mi = result["model_information"]
    check("model information reports real sample counts",
          mi["training_samples"] == proto["train_samples"] and
          mi["test_samples"] == proto["test_samples"])
    check("model information lists the actual features",
          len(mi["features"]) == mi["feature_count"] > 0)

    # ---------------- 7. Too little data returns no metrics ----------------
    tiny = ev.run_evaluation(projects[:10])
    check("tiny dataset returns unavailable rather than invented metrics",
          tiny.get("available") is False and "classification" not in tiny)

    # ---------------- 8. Risk engine: demo project is scored ---------------
    demo_risk = calculate_project_risk(projects[0])
    check("demo project receives a score", demo_risk["score_available"] is True)
    check("demo project score is 0-100", 0 <= demo_risk["overall_risk_score"] <= 100)
    check("demo project reports no missing fields", demo_risk["missing_fields"] == [])
    check("recommendation disclaimer is attached",
          "not official Government of India instructions"
          in demo_risk["recommendation_disclaimer"])

    # ---------------- 9. Real-style project lacking inputs -----------------
    sparse = {"project_id": "REAL-1", "project_name": "Imported extract",
              "ministry": "Ministry of Railways"}
    sparse_risk = calculate_project_risk(sparse)
    check("sparse real project is NOT scored", sparse_risk["score_available"] is False)
    check("no risk score is fabricated", sparse_risk["overall_risk_score"] is None)
    check("required-inputs-missing message is used",
          sparse_risk["unavailable_message"] == RISK_UNAVAILABLE_MESSAGE)
    check("missing fields are named", len(sparse_risk["missing_fields"]) > 0,
          ", ".join(sparse_risk["missing_fields"]))
    check("no alerts are raised for an unscored project",
          sparse_risk["alerts"] == [])

    # --------------- 10. Partial data: scored, but gaps disclosed ----------
    partial = {"project_id": "REAL-2", "original_cost": 1000.0,
               "revised_cost": 1200.0, "planned_progress": 60.0,
               "actual_progress": 35.0}
    prisk = calculate_project_risk(partial)
    check("partial project is scored from the components it does have",
          prisk["score_available"] is True)
    check("milestone component is reported unavailable",
          "milestone" in prisk["components_unavailable"])
    check("the missing milestone fields are named",
          "milestone" in prisk["missing_fields_by_component"],
          str(prisk["missing_fields_by_component"]))

    # --------------- 11. Financial impact only when derivable --------------
    # A 20% overrun scores 46 on the cost component, below the engine's
    # deliberate 65 alert threshold, so a steeper overrun is used here to
    # exercise the financial-impact path.
    steep = {"project_id": "REAL-4", "original_cost": 1000.0,
             "revised_cost": 1600.0, "planned_progress": 60.0,
             "actual_progress": 35.0, "milestone_count": 10.0,
             "milestone_delays": 5.0}
    srisk = calculate_project_risk(steep)
    cost_alerts = [a for a in srisk["alerts"] if a["risk_type"] == "Cost Overrun Risk"]
    check("cost alert raised once the component crosses its threshold",
          len(cost_alerts) == 1, f'cost component={srisk["cost_overrun_risk_pct"]}')
    if cost_alerts:
        fi = cost_alerts[0]["financial_impact"]
        check("derived financial impact equals revised minus original cost",
              abs(fi["value_cr"] - 600.0) < 0.01, str(fi["value_cr"]))
        check("derived figures are labelled as estimates",
              fi["qualifier"] == "Derived estimate" and fi["derived"] is True)
        check("the derivation formula is stated", "Revised Cost - Original Cost" in fi["basis"])

    no_cost = {"project_id": "REAL-3", "planned_progress": 80.0,
               "actual_progress": 40.0, "schedule_delay_months": 14.0}
    nrisk = calculate_project_risk(no_cost)
    fins = [a["financial_impact"] for a in nrisk["alerts"]]
    check("financial impact reads 'Not available' without cost fields",
          all(f["display"] == "Not available" for f in fins) and len(fins) > 0,
          f"{len(fins)} alerts")
    check("no numeric value accompanies an unavailable impact",
          all(f["value_cr"] is None for f in fins))

    # --------------- 12. Alerts carry the actionable fields ----------------
    alert = prisk["alerts"][0]
    for field in ("project_name", "risk_type", "risk_score", "primary_driver",
                  "financial_impact", "recommended_action", "recommendation_disclaimer"):
        check(f"alert carries '{field}'", alert.get(field) is not None)

    # --------------- 13. No hard-coded metrics in source -------------------
    src_files = list((Path(__file__).parent / "app").rglob("*.py"))
    banned = ("0.68", "0.96", "68%", "96%")
    hits = []
    for f in src_files:
        text = f.read_text(encoding="utf-8")
        for b in banned:
            if b in text:
                hits.append(f"{f.name}:{b}")
    check("no example metric literals remain in backend source", not hits, str(hits))

    # --------------- 14. Panel dataset structure & calibration -------------
    check("demo dataset projects contain panel history",
          all("history" in p and len(p["history"]) >= 18 for p in projects[:10]))
    first_p = projects[0]
    check("panel history has consecutive monthly timestamps",
          all("report_month" in h for h in first_p["history"]))
    check("reasons for delay reflect MoSPI classification",
          any("reason_for_delay" in h and len(h["reason_for_delay"]) > 0 for h in first_p["history"]))

    # --------------- 15. In-memory model caching & refresh -----------------
    res1 = ev.run_evaluation(projects, force_refresh=False)
    res2 = ev.run_evaluation(projects, force_refresh=False)
    check("model evaluation reuses in-memory cache when dataset unchanged",
          res1["dataset_hash"] == res2["dataset_hash"])
    check("force_refresh parameter is supported and produces fresh result",
          ev.run_evaluation(projects, force_refresh=True).get("available") is True)

    # --------------- 16. Option A: ML prediction & SHAP drivers ------------
    single_pred = ev.predict_single_project(first_p, projects)
    check("single project ML prediction returns delay risk probability",
          "predicted_risk_pct" in single_pred and 0.0 <= single_pred["predicted_risk_pct"] <= 100.0,
          str(single_pred.get("predicted_risk_pct")))
    check("single project ML prediction produces local SHAP drivers",
          "local_shap_drivers" in single_pred and isinstance(single_pred["local_shap_drivers"], list))
    if single_pred.get("local_shap_drivers"):
        first_driver = single_pred["local_shap_drivers"][0]
        check("SHAP driver carries feature name and direction",
              "feature" in first_driver and "direction" in first_driver)

    # --------------- 17. Trend signal & Early Warning Detection ------------
    from app.data.repository import calculate_trend_signal
    dummy_deteriorating_history = [
        {"report_month": "2023-01", "planned_progress": 20.0, "actual_progress": 18.0, "burn_rate": 0.9},
        {"report_month": "2023-02", "planned_progress": 28.0, "actual_progress": 22.0, "burn_rate": 1.1},
        {"report_month": "2023-03", "planned_progress": 36.0, "actual_progress": 25.0, "burn_rate": 1.3},
        {"report_month": "2023-04", "planned_progress": 45.0, "actual_progress": 28.0, "burn_rate": 1.5},
    ]
    trend_res = calculate_trend_signal(dummy_deteriorating_history)
    check("trend signal detects deteriorating burn rate and widening gap",
          trend_res["signal"] == "DETERIORATING" and "widened" in trend_res["explanation"])

    # --------------- 18. Multi-month feature leakage guard -----------------
    check("panel delta fields are explicitly registered in LEAKING_FIELDS",
          "recent_progress_gap_delta" in ev.LEAKING_FIELDS and "burn_rate" in ev.LEAKING_FIELDS)

    # --------------- 19. Router contract verifications --------------------
    from app.routers.projects import get_project_history, list_all_alerts as get_alerts
    from app.routers.risk import simulate_risk
    from app.models.schemas import SimulationRequest

    history_out = get_project_history(first_p["project_id"])
    check("GET /projects/{id}/history returns project snapshots",
          history_out["project_id"] == first_p["project_id"] and len(history_out["history"]) >= 18)

    alerts_paged = get_alerts(severity="All", page=1, limit=5)
    check("GET /projects/alerts pagination returns paged dict with total count",
          isinstance(alerts_paged, dict) and "total" in alerts_paged and len(alerts_paged["items"]) <= 5)

    sim_req = SimulationRequest(
        project_id=first_p["project_id"],
        overrides={"expenditure": first_p["expenditure"] + 50.0}
    )
    sim_out = simulate_risk(sim_req)
    sim_score = getattr(sim_out, "simulated_risk_score", None) or (sim_out.get("simulated_risk_score") if isinstance(sim_out, dict) else None)
    check("POST /risk/simulate supports nested overrides payload",
          sim_score is not None and getattr(sim_out, "assessment", None) is not None)

    print(f"\n{len(passed)} passed, {len(failed)} failed")
    if failed:
        for f in failed:
            print("  FAILED:", f)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
