import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

# XGBoost and SHAP are optional. When absent the study still runs, using
# Random Forest in place of XGBoost, and says so in the output rather than
# silently mislabelling the model.
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except Exception:
    XGBOOST_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except Exception:
    SHAP_AVAILABLE = False


def _boosted_classifier():
    """Return the strongest available tree ensemble, and its real name."""
    if XGBOOST_AVAILABLE:
        return XGBClassifier(
            n_estimators=100, max_depth=3, learning_rate=0.08,
            eval_metric="logloss", random_state=42,
        ), "XGBoost"
    return RandomForestClassifier(
        n_estimators=200, max_depth=6, min_samples_leaf=3, random_state=42,
    ), "Random Forest (XGBoost not installed)"

def load_data():
    """Load the synthetic demo dataset. This study is demo-data only, because
    the candidate variables it compares exist only in synthetic data."""
    data_path = Path(__file__).parent.parent / "data" / "projects_demo.json"
    if not data_path.exists():
        from app.data.generator import save_generated_projects
        save_generated_projects(data_path)

    with open(data_path, "r", encoding="utf-8") as f:
        projects = json.load(f)
    return projects

def prepare_dataframes(projects):
    rows_cuf = []
    rows_extended = []
    targets = []

    for p in projects:
        cuf_features = {
            "cost_variance_pct": float(p["cost_variance_pct"]),
            "expenditure_ratio": float(p["expenditure_ratio"]),
            "progress_gap": float(p["progress_gap"]),
            "schedule_delay_months": float(p["schedule_delay_months"]),
            "milestone_delay_ratio": float(p["milestone_delay_ratio"]),
            "planned_progress": float(p["planned_progress"]),
            "actual_progress": float(p["actual_progress"])
        }
        cand = p.get("candidate_variables", {})
        cand_features = {
            "contractor_rating": float(cand.get("contractor_rating", 3.0)),
            "land_acquisition_delay_days": float(cand.get("land_acquisition_delay_days", 0)),
            "weather_disruption_days": float(cand.get("weather_disruption_days", 0)),
            "material_price_escalation_pct": float(cand.get("material_price_escalation_pct", 5.0)),
            "labour_availability_index": float(cand.get("labour_availability_index", 0.8)),
            "funding_payment_delay_days": float(cand.get("funding_payment_delay_days", 0)),
            "tender_contract_issues": int(cand.get("tender_contract_issues", 0))
        }

        combined = {**cuf_features, **cand_features}
        rows_cuf.append(cuf_features)
        rows_extended.append(combined)
        targets.append(int(p["is_high_risk_target"]))

    df_cuf = pd.DataFrame(rows_cuf)
    df_extended = pd.DataFrame(rows_extended)
    y = np.array(targets)
    return df_cuf, df_extended, y

def evaluate_model(model, X_train, X_test, y_train, y_test):
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else y_pred

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    try:
        auc = roc_auc_score(y_test, y_prob)
    except Exception:
        auc = 0.5

    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(auc), 4)
    }

def train_and_evaluate():
    projects = load_data()
    df_cuf, df_extended, y = prepare_dataframes(projects)

    # 80/20 train/test split with seed
    X_train_a, X_test_a, y_train, y_test = train_test_split(df_cuf, y, test_size=0.20, random_state=42, stratify=y)
    X_train_b, X_test_b, _, _ = train_test_split(df_extended, y, test_size=0.20, random_state=42, stratify=y)

    boosted, boosted_name = _boosted_classifier()
    # The boosted entry is keyed by the model actually used. When XGBoost is not
    # installed this reads "Random Forest (XGBoost not installed)", so the UI can
    # never present Random Forest metrics under an XGBoost label.
    models_to_test = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
        boosted_name: boosted,
    }

    results_model_a = {}
    results_model_b = {}

    for name, model_cls in models_to_test.items():
        # Evaluate on CUF Features (Model A)
        m_a = model_cls.__class__(**model_cls.get_params())
        results_model_a[name] = evaluate_model(m_a, X_train_a, X_test_a, y_train, y_test)

        # Evaluate on CUF + Candidate Features (Model B)
        m_b = model_cls.__class__(**model_cls.get_params())
        results_model_b[name] = evaluate_model(m_b, X_train_b, X_test_b, y_train, y_test)

    # Train final tree-ensemble models for feature importance & SHAP
    xgb_a, _ = _boosted_classifier()
    xgb_a.fit(X_train_a, y_train)

    xgb_b, _ = _boosted_classifier()
    xgb_b.fit(X_train_b, y_train)

    # Feature importances for Model A
    feat_imp_a = [
        {"feature": feat, "importance": round(float(imp), 4), "category": "CUF Core"}
        for feat, imp in zip(df_cuf.columns, xgb_a.feature_importances_)
    ]
    feat_imp_a.sort(key=lambda x: x["importance"], reverse=True)

    # Feature importances for Model B
    cuf_cols = set(df_cuf.columns)
    feat_imp_b = [
        {
            "feature": feat,
            "importance": round(float(imp), 4),
            "category": "CUF Core" if feat in cuf_cols else "Candidate Variable (Extended)"
        }
        for feat, imp in zip(df_extended.columns, xgb_b.feature_importances_)
    ]
    feat_imp_b.sort(key=lambda x: x["importance"], reverse=True)

    # SHAP summary computation on the test sample (optional dependency)
    shap_summary = []
    shap_note = "SHAP is not installed in this environment."
    if SHAP_AVAILABLE:
        try:
            explainer_b = shap.TreeExplainer(xgb_b)
            shap_vals = explainer_b.shap_values(X_test_b)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[-1]
            mean_abs_shap = np.abs(np.array(shap_vals)).mean(axis=0)
            if mean_abs_shap.ndim > 1:
                mean_abs_shap = mean_abs_shap.mean(axis=-1)
            shap_summary = [
                {"feature": feat, "mean_abs_shap": round(float(val), 4)}
                for feat, val in zip(df_extended.columns, mean_abs_shap)
            ]
            shap_summary.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
            shap_note = "Mean absolute SHAP value per feature on the held-out test set."
        except Exception as exc:
            shap_note = f"SHAP computation unavailable: {exc}"

    # The finding is derived from the deltas actually measured, so it cannot
    # claim an uplift the numbers do not show.
    auc_gain = round(results_model_b[boosted_name]["roc_auc"] - results_model_a[boosted_name]["roc_auc"], 4)
    f1_gain = round(results_model_b[boosted_name]["f1"] - results_model_a[boosted_name]["f1"], 4)
    if auc_gain > 0.005 or f1_gain > 0.005:
        key_finding = (
            f"Adding the candidate variables improved the {boosted_name} model on this "
            f"split (ROC-AUC {auc_gain:+.4f}, F1 {f1_gain:+.4f})."
        )
    elif auc_gain < -0.005 or f1_gain < -0.005:
        key_finding = (
            f"Adding the candidate variables did not improve the {boosted_name} model on "
            f"this split (ROC-AUC {auc_gain:+.4f}, F1 {f1_gain:+.4f})."
        )
    else:
        key_finding = (
            f"Adding the candidate variables made no material difference on this split "
            f"(ROC-AUC {auc_gain:+.4f}, F1 {f1_gain:+.4f}). Note that Model A already "
            f"receives lagging outcome variables the label is derived from, which leaves "
            f"very little headroom for any additional feature to demonstrate."
        )

    output = {
        "dataset_metadata": {
            "total_samples": len(projects),
            "train_samples": len(X_train_a),
            "test_samples": len(X_test_a),
            "high_risk_prevalence": round(float(y.mean()), 3),
            "source": "Demo data is synthetic and for demonstration purposes only."
        },
        "model_a_cuf": {
            "name": "Model A (Current CUF Baseline Variables)",
            "description": "Trained solely on standard monitoring metrics: progress gap, cost variance, schedule delay, milestone slippage.",
            "metrics": results_model_a,
            "feature_importance": feat_imp_a
        },
        "model_b_extended": {
            "name": "Model B (CUF + Candidate Additional Variables)",
            "description": "Trained on standard CUF variables plus candidate factors: contractor rating, land acquisition delay, weather, material inflation, labour availability.",
            "metrics": results_model_b,
            "feature_importance": feat_imp_b
        },
        "boosted_model_used": boosted_name,
        "xgboost_available": XGBOOST_AVAILABLE,
        "shap_available": SHAP_AVAILABLE,
        "shap_note": shap_note,
        "shap_summary": shap_summary,
        "methodological_caveat": (
            "This study compares two FEATURE SETS, not two methodologies. Both models "
            "receive lagging outcome variables (cost variance, schedule delay, progress "
            "gap) that the target label is itself derived from, so the absolute metrics "
            "here are optimistic and should not be read as forecasting accuracy. "
            "For the leakage-controlled comparison of a conventional statistical "
            "baseline against machine learning, see /cuf/baseline-vs-ml."
        ),
        "performance_uplift_summary": {
            "boosted_model": boosted_name,
            "auc_gain": auc_gain,
            "f1_gain": f1_gain,
            "key_finding": key_finding,
        }
    }

    return output


def _write_results(output):
    """
    Write the study to disk. Only used when this module is run directly, as a
    developer convenience. The API deliberately does NOT read this file: a
    result written on another machine could report metrics for an estimator
    that is not the one available at request time.
    """
    out_file = Path(__file__).parent / "ml_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"ML evaluation completed. Results written to {out_file}")


if __name__ == "__main__":
    _write_results(train_and_evaluate())
