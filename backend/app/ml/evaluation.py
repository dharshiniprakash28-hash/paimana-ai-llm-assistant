"""
PAIMANA-AI model evaluation pipeline (SIH26103).

Answers the question the problem statement actually asks: does AI/ML give a
significant gain over conventional statistical methods?

To make that comparison meaningful, the pipeline enforces four things:

1. LEAKAGE CONTROL.  The supervised target is derived from cost variance,
   schedule delay and progress gap. Those three variables - and anything
   algebraically derived from them (including panel deltas) - are EXCLUDED
   from the feature matrix. The models are only allowed *leading* indicators
   that a monitoring cell could plausibly observe before the overrun materialises.

2. IDENTICAL SETUP.  The conventional baseline and the ML model share the same
   dataset, the same target, the same train/test split, the same preprocessing
   matrix and the same evaluation set. The only thing that varies is the
   estimator.

3. MEASURED METRICS ONLY.  Every number returned by this module is computed
   from an actual fitted model on an actual held-out test set. Nothing is
   hard-coded. If a metric cannot be computed it is returned as null.

4. NO WINNER DECLARED.  The module reports per-metric deltas and leaves the
   interpretation to the reader. A negative delta is reported as a negative
   delta.

5. PERSISTENT TRAINED MODEL CACHE & LOCAL EXPLAINABILITY.
   Trained models are cached in-memory keyed by the SHA-256 hash of the active
   dataset, avoiding redundant refitting. Local per-project SHAP drivers are
   computed via TreeExplainer for individual project inspection.

Two tasks are evaluated:
  * CLASSIFICATION -> will the project end up materially off-track?
      baseline: Logistic Regression      ML: XGBoost (Random Forest fallback)
  * REGRESSION     -> what cost variance percentage will it end up with?
      baseline: Linear Regression        ML: XGBoost (Random Forest fallback)
"""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    mean_absolute_error, mean_squared_error, r2_score,
)

RANDOM_STATE = 42
TEST_SIZE = 0.20

# ---------------------------------------------------------------------------
# Optional dependency: XGBoost. If it is not installed we fall back to Random
# Forest and say so explicitly, rather than silently reporting the wrong model.
# ---------------------------------------------------------------------------
try:
    from xgboost import XGBClassifier, XGBRegressor
    XGBOOST_AVAILABLE = True
except Exception:  # pragma: no cover - environment dependent
    XGBOOST_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except Exception:  # pragma: no cover - environment dependent
    SHAP_AVAILABLE = False


# ---------------------------------------------------------------------------
# Feature specification & Leakage Control
# ---------------------------------------------------------------------------

# Excluded on purpose - these define the label or are derived from it.
LEAKING_FIELDS = [
    "cost_variance", "cost_variance_pct", "revised_cost",
    "schedule_delay_months", "progress_gap", "actual_progress",
    "expenditure", "expenditure_ratio",
    "milestone_delays", "milestone_delay_ratio", "milestones_completed",
    "status", "expected_completion_date", "is_high_risk_target",
    "history", "month_over_month_cost_delta", "month_over_month_delay_delta",
    "future_progress_delta", "lagging_slippage_trend",
    "recent_progress_gap_delta", "burn_rate",
]

NUMERIC_LEADING_FEATURES = [
    "original_cost",
    "planned_duration_months",
    "planned_progress",
    "milestone_count",
    "contractor_rating",
    "land_acquisition_delay_days",
    "weather_disruption_days",
    "material_price_escalation_pct",
    "labour_availability_index",
    "funding_payment_delay_days",
    "tender_contract_issues",
]

CATEGORICAL_LEADING_FEATURES = [
    "environmental_clearance",
    "land_acquisition_status",
    "region",
    "ministry",
]

# In-memory model cache keyed by SHA-256 hash of active dataset
_ACTIVE_MODEL_BUNDLE = {}


def compute_dataset_hash(projects):
    """Compute a deterministic hash of dataset attributes that influence training."""
    if not projects:
        return "empty"
    summary = []
    for p in projects:
        cand = p.get("candidate_variables") or {}
        summary.append((
            str(p.get("project_id")),
            str(p.get("original_cost")),
            str(cand.get("contractor_rating")),
            str(cand.get("land_acquisition_delay_days")),
            str(p.get("is_high_risk_target")),
            str(p.get("cost_variance_pct")),
        ))
    raw = json.dumps(summary, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _safe_float(value, default=0.0):
    try:
        if value is None:
            return default
        v = float(value)
        return default if math.isnan(v) or math.isinf(v) else v
    except (TypeError, ValueError):
        return default


def build_feature_frame(projects, feature_columns=None):
    """Build the leading-indicator feature matrix shared by both models."""
    rows = []
    for p in projects:
        cand = p.get("candidate_variables") or {}
        rows.append({
            "original_cost": _safe_float(p.get("original_cost")),
            "planned_duration_months": _safe_float(p.get("planned_duration_months"), 36.0),
            "planned_progress": _safe_float(p.get("planned_progress"), 50.0),
            "milestone_count": _safe_float(p.get("milestone_count"), 10.0),
            "contractor_rating": _safe_float(cand.get("contractor_rating"), 3.0),
            "land_acquisition_delay_days": _safe_float(cand.get("land_acquisition_delay_days")),
            "weather_disruption_days": _safe_float(cand.get("weather_disruption_days")),
            "material_price_escalation_pct": _safe_float(cand.get("material_price_escalation_pct"), 5.0),
            "labour_availability_index": _safe_float(cand.get("labour_availability_index"), 0.8),
            "funding_payment_delay_days": _safe_float(cand.get("funding_payment_delay_days")),
            "tender_contract_issues": _safe_float(cand.get("tender_contract_issues")),
            "environmental_clearance": str(cand.get("environmental_clearance", "Unknown")),
            "land_acquisition_status": str(cand.get("land_acquisition_status", "Unknown")),
            "region": str(p.get("region", "Unknown")),
            "ministry": str(p.get("ministry", "Unknown")),
        })

    df = pd.DataFrame(rows)
    df = pd.get_dummies(df, columns=CATEGORICAL_LEADING_FEATURES, drop_first=False)
    if feature_columns is not None:
        df = df.reindex(columns=feature_columns, fill_value=0.0)
    return df.astype(float)


def _classification_metrics(y_true, y_pred, y_prob):
    try:
        auc = float(roc_auc_score(y_true, y_prob)) if y_prob is not None else None
    except Exception:
        auc = None
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc": round(auc, 4) if auc is not None else None,
    }


def _regression_metrics(y_true, y_pred):
    mse = float(mean_squared_error(y_true, y_pred))
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(math.sqrt(mse)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def _delta_table(baseline, ml, higher_is_better=True):
    """Per-metric difference. No winner is declared; sign is reported as-is."""
    rows = []
    for key in baseline:
        b, m = baseline.get(key), ml.get(key)
        if b is None or m is None:
            rows.append({
                "metric": key, "baseline": b, "ml": m,
                "delta": None, "ml_better": None,
                "note": "Metric not computable on this evaluation set.",
            })
            continue
        delta = round(m - b, 4)
        better = (delta > 0) if higher_is_better else (delta < 0)
        rows.append({
            "metric": key, "baseline": b, "ml": m,
            "delta": delta,
            "ml_better": bool(better) if delta != 0 else None,
            "note": None,
        })
    return rows


def run_evaluation(projects, force_refresh=False):
    """
    Fit and score the conventional baseline and the ML model on the same data.
    Caches trained models and evaluation outputs by dataset hash.
    """
    if not projects or len(projects) < 30:
        return {
            "available": False,
            "reason": (
                "Insufficient data for model evaluation. At least 30 projects with "
                "the required leading-indicator fields are needed."
            ),
            "sample_count": len(projects) if projects else 0,
        }

    d_hash = compute_dataset_hash(projects)
    if not force_refresh and d_hash in _ACTIVE_MODEL_BUNDLE:
        return _ACTIVE_MODEL_BUNDLE[d_hash]["result"]

    X = build_feature_frame(projects)
    feature_names = list(X.columns)

    y_cls = np.array([int(p.get("is_high_risk_target", 0)) for p in projects])
    y_reg = np.array([_safe_float(p.get("cost_variance_pct")) for p in projects])

    if len(np.unique(y_cls)) < 2:
        return {
            "available": False,
            "reason": "Target variable has only one class in this dataset; classification cannot be evaluated.",
            "sample_count": len(projects),
        }

    # ---- Single shared split, reused by BOTH models and BOTH tasks ----
    idx = np.arange(len(projects))
    idx_train, idx_test = train_test_split(
        idx, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_cls
    )

    X_train_raw, X_test_raw = X.iloc[idx_train], X.iloc[idx_test]

    # ---- Shared preprocessing: one scaler, fitted on train only ----
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_test = scaler.transform(X_test_raw)

    y_cls_train, y_cls_test = y_cls[idx_train], y_cls[idx_test]
    y_reg_train, y_reg_test = y_reg[idx_train], y_reg[idx_test]

    ml_model_name = "XGBoost" if XGBOOST_AVAILABLE else "Random Forest"
    ml_fallback_note = None if XGBOOST_AVAILABLE else (
        "XGBoost is not installed in this environment; Random Forest was used as "
        "the ML model. Install xgboost to evaluate the XGBoost configuration."
    )

    # ================= CLASSIFICATION =================
    baseline_clf = LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)
    baseline_clf.fit(X_train, y_cls_train)
    base_pred = baseline_clf.predict(X_test)
    base_prob = baseline_clf.predict_proba(X_test)[:, 1]
    cls_baseline = _classification_metrics(y_cls_test, base_pred, base_prob)

    if XGBOOST_AVAILABLE:
        ml_clf = XGBClassifier(
            n_estimators=300, max_depth=4, learning_rate=0.06,
            subsample=0.9, colsample_bytree=0.9,
            eval_metric="logloss", random_state=RANDOM_STATE,
        )
    else:
        ml_clf = RandomForestClassifier(
            n_estimators=300, max_depth=8, min_samples_leaf=3,
            random_state=RANDOM_STATE,
        )
    ml_clf.fit(X_train, y_cls_train)
    ml_pred = ml_clf.predict(X_test)
    ml_prob = ml_clf.predict_proba(X_test)[:, 1]
    cls_ml = _classification_metrics(y_cls_test, ml_pred, ml_prob)

    # ================= REGRESSION =================
    baseline_reg = LinearRegression()
    baseline_reg.fit(X_train, y_reg_train)
    reg_baseline = _regression_metrics(y_reg_test, baseline_reg.predict(X_test))

    if XGBOOST_AVAILABLE:
        ml_reg = XGBRegressor(
            n_estimators=300, max_depth=4, learning_rate=0.06,
            subsample=0.9, colsample_bytree=0.9, random_state=RANDOM_STATE,
        )
    else:
        ml_reg = RandomForestRegressor(
            n_estimators=300, max_depth=8, min_samples_leaf=3,
            random_state=RANDOM_STATE,
        )
    ml_reg.fit(X_train, y_reg_train)
    reg_ml = _regression_metrics(y_reg_test, ml_reg.predict(X_test))

    hist_mean = float(np.mean(y_reg_train))
    reg_hist_avg = _regression_metrics(y_reg_test, np.full_like(y_reg_test, hist_mean))

    # ================= Explainability =================
    feature_importance = []
    if hasattr(ml_clf, "feature_importances_"):
        feature_importance = sorted(
            [
                {"feature": f, "importance": round(float(v), 5)}
                for f, v in zip(feature_names, ml_clf.feature_importances_)
            ],
            key=lambda d: d["importance"], reverse=True,
        )[:15]

    baseline_coefficients = sorted(
        [
            {"feature": f, "coefficient": round(float(c), 5)}
            for f, c in zip(feature_names, baseline_clf.coef_[0])
        ],
        key=lambda d: abs(d["coefficient"]), reverse=True,
    )[:15]

    shap_summary = []
    shap_note = "SHAP is not installed in this environment."
    explainer = None
    if SHAP_AVAILABLE:
        try:
            explainer = shap.TreeExplainer(ml_clf)
            shap_values = explainer.shap_values(X_test)
            if isinstance(shap_values, list):
                shap_values = shap_values[-1]
            mean_abs = np.abs(np.array(shap_values)).mean(axis=0)
            if mean_abs.ndim > 1:
                mean_abs = mean_abs.mean(axis=-1)
            shap_summary = sorted(
                [
                    {"feature": f, "mean_abs_shap": round(float(v), 5)}
                    for f, v in zip(feature_names, mean_abs)
                ],
                key=lambda d: d["mean_abs_shap"], reverse=True,
            )[:15]
            shap_note = "Mean absolute SHAP value per feature on the held-out test set."
        except Exception as exc:  # pragma: no cover
            shap_summary = []
            shap_note = f"SHAP computation unavailable: {exc}"

    result = {
        "available": True,
        "dataset_hash": d_hash,
        "evaluation_protocol": {
            "dataset": "Active PAIMANA-AI dataset",
            "total_samples": len(projects),
            "train_samples": int(len(idx_train)),
            "test_samples": int(len(idx_test)),
            "test_size": TEST_SIZE,
            "random_state": RANDOM_STATE,
            "split": "Single stratified 80/20 hold-out split, shared by both models",
            "preprocessing": "StandardScaler fitted on the training split only; identical matrix supplied to both models",
            "feature_count": len(feature_names),
            "features": feature_names,
            "leakage_control": (
                "Cost variance, schedule delay, progress gap, expenditure and milestone "
                "outcome fields are excluded from the feature matrix because the target "
                "is derived from them. Only leading indicators are used."
            ),
            "excluded_fields": LEAKING_FIELDS,
            "statement": "Evaluation uses the same test dataset and evaluation procedure for both models.",
        },
        "classification": {
            "task": "Binary classification - will the project end up materially off-track?",
            "target": "is_high_risk_target (cost variance >= 10% OR schedule delay >= 6 months OR progress gap >= 10%)",
            "positive_class_rate_train": round(float(np.mean(y_cls_train)), 4),
            "positive_class_rate_test": round(float(np.mean(y_cls_test)), 4),
            "baseline": {
                "name": "Logistic Regression",
                "type": "Conventional statistical baseline",
                "metrics": cls_baseline,
                "coefficients": baseline_coefficients,
            },
            "ml": {
                "name": ml_model_name,
                "type": "Machine learning model",
                "metrics": cls_ml,
                "feature_importance": feature_importance,
                "fallback_note": ml_fallback_note,
            },
            "comparison": _delta_table(cls_baseline, cls_ml, higher_is_better=True),
        },
        "regression": {
            "task": "Regression - predicted final cost variance percentage",
            "target": "cost_variance_pct",
            "baseline": {
                "name": "Linear Regression",
                "type": "Conventional statistical baseline",
                "metrics": reg_baseline,
            },
            "ml": {
                "name": ml_model_name,
                "type": "Machine learning model",
                "metrics": reg_ml,
                "fallback_note": ml_fallback_note,
            },
            "historical_average_reference": {
                "name": "Historical average (training mean)",
                "type": "Simplest conventional reference",
                "predicted_value": round(hist_mean, 4),
                "metrics": reg_hist_avg,
            },
            "comparison_error": _delta_table(
                {k: reg_baseline[k] for k in ("mae", "rmse")},
                {k: reg_ml[k] for k in ("mae", "rmse")},
                higher_is_better=False,
            ),
            "comparison_fit": _delta_table(
                {"r2": reg_baseline["r2"]}, {"r2": reg_ml["r2"]}, higher_is_better=True
            ),
        },
        "explainability": {
            "shap_available": SHAP_AVAILABLE,
            "shap_note": shap_note,
            "shap_summary": shap_summary,
        },
        "model_information": {
            "ml_model": ml_model_name,
            "xgboost_available": XGBOOST_AVAILABLE,
            "baseline_classification_model": "Logistic Regression",
            "baseline_regression_model": "Linear Regression",
            "training_samples": int(len(idx_train)),
            "test_samples": int(len(idx_test)),
            "feature_count": len(feature_names),
            "features": feature_names,
            "explainability": "SHAP (TreeExplainer)" if SHAP_AVAILABLE else "Not installed",
        },
        "interpretation": (
            "Evaluation uses the same test dataset and evaluation procedure for both models. "
            "Both models receive an identical preprocessed feature matrix of leading indicators; "
            "only the estimator differs. Per-metric differences are reported as measured, "
            "including where the machine learning model does not outperform the conventional "
            "baseline. No model is designated a winner."
        ),
        "disclaimer": (
            "Metrics are computed at runtime from the active dataset. They are model "
            "performance figures for this prototype only and are not official Government "
            "of India statistics or certified predictions."
        ),
    }

    # Cache fitted bundle
    _ACTIVE_MODEL_BUNDLE[d_hash] = {
        "result": result,
        "ml_clf": ml_clf,
        "ml_reg": ml_reg,
        "scaler": scaler,
        "feature_names": feature_names,
        "explainer": explainer,
        "ml_model_name": ml_model_name,
    }

    return result


def predict_single_project(project, projects_context=None):
    """
    Predict high-risk probability, cost variance %, and local SHAP drivers
    for a single project using the trained ML model.
    """
    # Honest integrity: require candidate variables
    cand = project.get("candidate_variables")
    if not cand or project.get("original_cost") is None:
        return {
            "available": False,
            "reason": (
                "ML model requires candidate leading indicators (contractor rating, "
                "environmental status, land acquisition delay days). "
                "Rule engine score remains authoritative."
            ),
            "ml_risk_probability": None,
            "ml_risk_level": None,
            "shap_drivers": [],
        }

    # Ensure model is fitted
    bundle = None
    if projects_context:
        d_hash = compute_dataset_hash(projects_context)
        if d_hash in _ACTIVE_MODEL_BUNDLE:
            bundle = _ACTIVE_MODEL_BUNDLE[d_hash]
        else:
            run_evaluation(projects_context)
            bundle = _ACTIVE_MODEL_BUNDLE.get(d_hash)

    if not bundle and _ACTIVE_MODEL_BUNDLE:
        bundle = next(iter(_ACTIVE_MODEL_BUNDLE.values()))

    if not bundle:
        return {
            "available": False,
            "reason": "ML model bundle not yet initialised for active dataset.",
            "ml_risk_probability": None,
            "ml_risk_level": None,
            "shap_drivers": [],
        }

    try:
        feature_names = bundle["feature_names"]
        scaler = bundle["scaler"]
        ml_clf = bundle["ml_clf"]
        ml_reg = bundle["ml_reg"]
        explainer = bundle.get("explainer")
        ml_model_name = bundle.get("ml_model_name", "ML Model")

        row_df = build_feature_frame([project], feature_columns=feature_names)
        scaled_row = scaler.transform(row_df)

        prob = float(ml_clf.predict_proba(scaled_row)[:, 1][0])
        pred_cv = float(ml_reg.predict(scaled_row)[0])

        shap_drivers = []
        if explainer is not None:
            try:
                sv = explainer.shap_values(scaled_row)
                if isinstance(sv, list):
                    sv = sv[-1]
                vals = np.array(sv).flatten()
                for feat, val in zip(feature_names, vals):
                    val_float = float(val)
                    if abs(val_float) > 0.001:
                        shap_drivers.append({
                            "feature": feat.replace("_", " ").title(),
                            "raw_feature": feat,
                            "shap_impact": round(val_float, 4),
                            "shap_value": round(val_float, 4),
                            "direction": "increases_risk" if val_float > 0 else "decreases_risk",
                            "description": f"{feat.replace('_', ' ')} ({'+' if val_float > 0 else ''}{val_float:.3f})",
                        })
                shap_drivers.sort(key=lambda d: abs(d["shap_impact"]), reverse=True)
                shap_drivers = shap_drivers[:6]
            except Exception:
                shap_drivers = []

        prob_pct = round(prob * 100, 1)
        if prob_pct >= 70.0:
            level = "CRITICAL"
        elif prob_pct >= 45.0:
            level = "HIGH"
        elif prob_pct >= 25.0:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "available": True,
            "ml_risk_probability": prob_pct,
            "predicted_risk_pct": prob_pct,
            "ml_risk_score": int(round(prob_pct)),
            "ml_risk_level": level,
            "predicted_cost_variance_pct": round(pred_cv, 1),
            "predicted_delay_class": 1 if prob_pct >= 50.0 else 0,
            "model_name": ml_model_name,
            "shap_drivers": shap_drivers,
            "local_shap_drivers": shap_drivers,
            "disclaimer": (
                f"Predicted by {ml_model_name} from leading indicators only. "
                "Disclosed alongside rule engine score (Option A resolution)."
            ),
        }
    except Exception as exc:
        return {
            "available": False,
            "reason": f"ML prediction could not be computed: {exc}",
            "ml_risk_probability": None,
            "predicted_risk_pct": None,
            "ml_risk_level": None,
            "predicted_delay_class": 0,
            "shap_drivers": [],
            "local_shap_drivers": [],
        }


def run_and_cache(projects, cache_path=None):
    """Run evaluation and cache in memory."""
    result = run_evaluation(projects)
    return result


if __name__ == "__main__":
    data_path = Path(__file__).parent.parent / "data" / "projects_demo.json"
    with open(data_path, "r", encoding="utf-8") as fh:
        demo_projects = json.load(fh)
    out = run_evaluation(demo_projects)
    print(json.dumps(out.get("classification", {}), indent=2)[:2000])
    print(json.dumps(out.get("regression", {}), indent=2)[:1500])
