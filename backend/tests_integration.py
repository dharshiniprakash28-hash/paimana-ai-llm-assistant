"""
PAIMANA-AI end-to-end integration suite.

Covers the LLM assistant, data-source switching, context grounding, fallback
behaviour and the security audit. Runs without a live server by stubbing
FastAPI, so it works in any environment where scikit-learn is installed.

    python3 tests_integration.py

Gemini itself is NOT called: no API key and no network in CI. The Gemini path
is exercised with a stubbed SDK so the routing, sanitising and fallback logic
are all genuinely tested.
"""
import json
import os
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# --- stub FastAPI so routers import without the dependency installed --------
if "fastapi" not in sys.modules:
    fa = types.ModuleType("fastapi")

    class APIRouter:
        def __init__(self, **kw):
            pass

        def get(self, *a, **k):
            return lambda fn: fn

        def post(self, *a, **k):
            return lambda fn: fn

    class HTTPException(Exception):
        def __init__(self, status_code=500, detail=""):
            self.status_code, self.detail = status_code, detail

    class UploadFile:  # pragma: no cover - only needed for import
        pass

    def File(*a, **k):
        return None

    fa.APIRouter = APIRouter
    fa.HTTPException = HTTPException
    fa.UploadFile = UploadFile
    fa.File = File
    sys.modules["fastapi"] = fa

# --- stub pydantic if it is not installed ----------------------------------
# Only the surface the routers use: annotated fields with defaults, keyword
# construction, and model_dump(). Validation is not simulated, so this suite
# tests routing and grounding logic, not pydantic's own schema enforcement.
try:
    import pydantic  # noqa: F401
    PYDANTIC_REAL = True
except ImportError:
    PYDANTIC_REAL = False
    pyd = types.ModuleType("pydantic")

    class BaseModel:
        def __init__(self, **kw):
            ann = {}
            for klass in reversed(type(self).__mro__):
                ann.update(getattr(klass, "__annotations__", {}) or {})
            for field in ann:
                if field in kw:
                    setattr(self, field, kw[field])
                elif hasattr(type(self), field):
                    default = getattr(type(self), field)
                    setattr(self, field, list(default) if isinstance(default, list)
                            else dict(default) if isinstance(default, dict) else default)
                else:
                    setattr(self, field, None)
            for k, v in kw.items():
                if k not in ann:
                    setattr(self, k, v)

        def model_dump(self):
            return dict(self.__dict__)

        def dict(self):
            return self.model_dump()

    def Field(default=None, **kw):
        return default

    pyd.BaseModel = BaseModel
    pyd.Field = Field
    sys.modules["pydantic"] = pyd

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def main():
    from app.data.datasource import DataSourceManager
    from app.data.importer import import_projects
    from app.data.repository import ProjectRepository
    from app.llm import gemini_client
    from app.llm.context_builder import build_context, extract_project_id
    from app.routers import assistant as ar
    from app.routers import cuf as cuf_router

    ds = DataSourceManager()
    ds.clear_imported()
    repo = ProjectRepository()
    repo.refresh()

    # ================= Demo dataset =================
    status = repo.data_source_status()
    check("demo data is the default active source", status["mode"] == "DEMO")
    check("demo dataset is labelled synthetic", status["is_synthetic"] is True)
    check("demo disclaimer states it is synthetic",
          "synthetic" in status["disclaimer"].lower())
    n_demo = len(repo.projects)
    check("demo dataset loads 500 projects", n_demo == 500, str(n_demo))
    check("every demo project is scored",
          all(p["risk"]["score_available"] for p in repo.projects))

    # ================= Assistant status / fallback =================
    os.environ.pop("GEMINI_API_KEY", None)
    st = gemini_client.get_status()
    check("without a key the assistant reports fallback mode",
          st["llm_enabled"] is False and st["mode"] == "FALLBACK")
    check("fallback notice uses the required wording",
          "LLM mode unavailable" in st["message"] and
          "local assistant fallback" in st["message"])

    resp = ar.assistant_chat(ar.ChatRequest(message="Which projects require attention?"))
    check("fallback chat returns an answer", bool(resp.answer))
    check("fallback chat reports FALLBACK mode", resp.mode == "FALLBACK")
    check("fallback chat carries sources", len(resp.sources) > 0)
    check("fallback answer is grounded in the dataset", "risk" in resp.answer.lower())

    # legacy endpoint preserved
    from app.models.schemas import AssistantQueryRequest
    legacy = ar.handle_assistant_query(
        AssistantQueryRequest(question="How many projects are delayed?"))
    check("legacy /assistant/query still works", bool(legacy.answer))

    # ================= Free-form coverage (fallback) =================
    questions = [
        "Which sectors have the highest cost variance?",
        "Which projects require attention?",
        "How many projects are delayed?",
        "What information is missing for this project's risk analysis?",
        "What are the main risk drivers?",
        "Tell me about ministries",
    ]
    answers = [ar.assistant_chat(ar.ChatRequest(message=q)).answer for q in questions]
    check("every sample question yields a non-empty answer",
          all(len(a) > 40 for a in answers))
    check("fallback answers are not all identical",
          len(set(answers)) > 1, f"{len(set(answers))} distinct")

    # ================= Project context reaches the LLM =================
    ctx, proj = build_context(repo, "Why is PRJ-101 high risk?")
    check("a named project resolves from free text", proj is not None)
    sp = ctx["selected_project"]
    check("selected project context is a dict", isinstance(sp, dict))
    for key in ("project_id", "project_name", "ministry", "sector",
                "implementing_agency", "region"):
        check(f"context carries '{key}'", key in sp)
    for key in ("original_cost", "revised_cost", "expenditure",
                "cost_variance", "cost_variance_pct", "expenditure_ratio"):
        check(f"context financials carry '{key}'", key in sp["financials_rs_crore"])
    check("context carries original completion date",
          "original_completion_date" in sp["schedule"])
    check("context carries revised/expected completion date",
          "revised_or_expected_completion_date" in sp["schedule"])
    check("context carries progress", "actual_progress_pct" in sp["progress"])
    check("context carries milestone information", "milestone_count" in sp["milestones"])
    check("context carries the derived risk score",
          "overall_risk_score" in sp["paimana_ai_risk_analysis"])
    check("context carries risk drivers", "risk_drivers" in sp["paimana_ai_risk_analysis"])
    check("risk analysis is labelled as PAIMANA-AI derived",
          "Not an official Government" in sp["paimana_ai_risk_analysis"]["note"])
    check("context carries alerts", "early_warning_alerts" in sp)

    port = ctx["portfolio"]
    check("portfolio context names the active data source",
          port["active_data_source"]["mode"] == "DEMO")
    check("portfolio context marks demo data synthetic",
          port["active_data_source"]["is_synthetic"] is True)
    check("portfolio totals reflect the real dataset size",
          port["portfolio_totals"]["projects"] == 500)
    check("portfolio context includes relevant projects",
          len(port["relevant_projects"]) > 0)
    check("national reference statistics are supplied separately",
          "national_paimana_reference" in port)

    # question-aware project selection
    d_ctx, _ = build_context(repo, "Which projects are most delayed?")
    c_ctx, _ = build_context(repo, "Which projects have the worst cost overrun?")
    check("relevant projects vary with the question asked",
          [p["project_id"] for p in d_ctx["portfolio"]["relevant_projects"]] !=
          [p["project_id"] for p in c_ctx["portfolio"]["relevant_projects"]])

    # ================= System instruction requirements =================
    sp_text = gemini_client.SYSTEM_PROMPT
    for phrase, label in [
        ("Use ONLY the supplied", "use only supplied context"),
        ("Never invent project values", "do not invent project information"),
        ("Never invent official government statistics", "do not invent govt statistics"),
        ("Do not fabricate milestone", "do not fabricate progress/milestones"),
        ("does not contain this information", "say so when unavailable"),
        ("Distinguish imported PAIMANA data", "distinguish imported vs derived"),
        ("Never claim that PAIMANA-AI predictions", "not official predictions"),
        ("causes of delays", "do not invent delay causes"),
        ("DERIVED ESTIMATES", "do not invent financial forecasts"),
        ("synthetic demo data", "data-source awareness"),
    ]:
        check(f"system instruction covers: {label}", phrase in sp_text)

    # ================= Gemini path, with a stubbed SDK =================
    os.environ["GEMINI_API_KEY"] = "AIzaSyFAKE_TEST_KEY_0123456789abcdef"

    captured = {}

    def fake_generate(question, context, model=None):
        captured["question"] = question
        captured["context"] = context
        return "Stubbed Gemini answer grounded in context.", {"model": "stub"}

    real_generate = gemini_client.generate_answer
    real_sdk = gemini_client.sdk_available
    gemini_client.sdk_available = lambda: True
    gemini_client.generate_answer = fake_generate
    ar.gemini_client.generate_answer = fake_generate

    st2 = gemini_client.get_status()
    check("with a key and SDK the assistant reports Gemini mode",
          st2["llm_enabled"] is True and st2["mode"] == "GEMINI")
    check("Gemini mode label matches the requirement",
          st2["display_name"] == "AI Assistant - Gemini LLM")
    check("status never leaks the API key",
          os.environ["GEMINI_API_KEY"] not in json.dumps(st2))

    g = ar.assistant_chat(ar.ChatRequest(message="Explain PRJ-101's cost increase."))
    check("Gemini-mode chat returns the LLM answer", g.mode == "GEMINI")
    check("the question reaches the LLM", "PRJ-101" in captured["question"])
    check("grounding context reaches the LLM",
          "portfolio" in captured["context"] and
          isinstance(captured["context"]["selected_project"], dict))
    check("project_context is returned to the client",
          g.project_context and g.project_context["project_id"] == "PRJ-101")
    check("explicit project_id is honoured",
          ar.assistant_chat(ar.ChatRequest(message="Summarise this.",
                                           project_id="PRJ-102")
                            ).project_context["project_id"] == "PRJ-102")

    # failure mid-call must degrade, not crash
    def failing(question, context, model=None):
        return None, {"error": "Gemini request failed: 503 upstream unavailable",
                      "recoverable": True}

    ar.gemini_client.generate_answer = failing
    degraded = ar.assistant_chat(ar.ChatRequest(message="Which projects require attention?"))
    check("a failed Gemini call degrades to the local fallback",
          degraded.mode == "FALLBACK" and bool(degraded.answer))
    check("the degrade notice explains what happened",
          "LLM mode unavailable" in (degraded.notice or ""))

    # ================= Security: no secret in any response =================
    leaky_key = os.environ["GEMINI_API_KEY"]

    def leaking(question, context, model=None):
        return None, {
            "error": gemini_client._sanitise_error(
                "Gemini request failed: POST https://generativelanguage.googleapis.com"
                f"/v1beta/models/gemini-2.5-flash:generateContent?key={leaky_key}"),
            "recoverable": True,
        }

    ar.gemini_client.generate_answer = leaking
    leaked_resp = ar.assistant_chat(ar.ChatRequest(message="test"))
    body = json.dumps(leaked_resp.model_dump(), default=str)
    check("API key never appears in a chat response body", leaky_key not in body)
    check("no AIza-shaped token appears in a chat response body", "AIza" not in body)
    check("status response contains no key",
          leaky_key not in json.dumps(ar.assistant_status()))

    gemini_client.generate_answer = real_generate
    gemini_client.sdk_available = real_sdk
    ar.gemini_client.generate_answer = real_generate
    os.environ.pop("GEMINI_API_KEY", None)

    # ================= Real data import + switching =================
    csv = (b"Project ID,Project Name,Ministry,Original Cost,Revised Cost,Sector,"
           b"Expenditure,Schedule Delay Months,Planned Progress,Actual Progress\n"
           b"RLY-001,Freight Corridor Phase II,Ministry of Railways,12500,15900,Railways,"
           b"8200,18,70,42\n"
           b"NHA-003,NH-44 Six Laning,Ministry of Road Transport,5400,5900,Roads,"
           b"3100,7,60,50\n")
    res = import_projects(csv, "real.csv")
    check("real CSV import succeeds", res["row_count"] == 2, str(res["row_count"]))
    ds.set_imported(res, activate=True)
    repo.refresh()
    rstatus = repo.data_source_status()
    check("switching to real data changes the active mode", rstatus["mode"] == "REAL")
    check("real data is not labelled synthetic", rstatus["is_synthetic"] is False)
    check("real dataset replaces the demo projects", len(repo.projects) == 2)

    rid = extract_project_id("Explain RLY-001 cost increase",
                             [p["project_id"] for p in repo.projects])
    check("real-world project IDs resolve from free text", rid == "RLY-001", str(rid))

    rctx, rproj = build_context(repo, "Why is RLY-001 risky?")
    check("real project context is built", rproj is not None)
    check("real portfolio context is flagged non-synthetic",
          rctx["portfolio"]["active_data_source"]["is_synthetic"] is False)

    rchat = ar.assistant_chat(ar.ChatRequest(message="Explain RLY-001 cost increase"))
    check("assistant answers on real data", bool(rchat.answer))
    check("real-data answers disclose the imported source",
          "Imported PAIMANA" in rchat.answer or "imported" in rchat.answer.lower())

    # honest handling of a project that does not exist
    missing = ar.assistant_chat(ar.ChatRequest(message="Tell me about PRJ-999"))
    check("a non-existent project is reported, not invented",
          "does not contain" in missing.answer)

    # ================= Missing data handled honestly =================
    sparse = import_projects(
        b"Project ID,Project Name,Ministry,Original Cost\nX-1,Sparse Project,Ministry of Coal,900\n",
        "sparse.csv")
    ds.set_imported(sparse, activate=True)
    repo.refresh()
    srisk = repo.projects[0]["risk"]
    check("sparse real project receives no fabricated score",
          srisk["score_available"] is False and srisk["overall_risk_score"] is None)
    check("missing model inputs are named", len(srisk["missing_fields"]) > 0,
          ", ".join(srisk["missing_fields"]))
    sctx, _ = build_context(repo, "Why is X-1 risky?")
    check("context marks the risk score unavailable",
          sctx["selected_project"]["paimana_ai_risk_analysis"]["score_available"] is False)
    check("context renders absent fields as 'Not available'",
          sctx["selected_project"]["financials_rs_crore"]["revised_cost"] == "Not available")
    schat = ar.assistant_chat(ar.ChatRequest(message="Why is X-1 risky?"))
    check("assistant reports pending risk rather than inventing one",
          "pending" in schat.answer.lower() or "not available" in schat.answer.lower())

    # CUF evaluation must refuse on a 1-row dataset
    cuf_router._eval_cache.clear()
    ev = cuf_router.baseline_vs_ml(refresh=True)
    check("model evaluation refuses an undersized real dataset",
          ev.get("available") is False)

    # ================= Switch back to demo =================
    ds.clear_imported()
    repo.refresh()
    cuf_router._eval_cache.clear()
    check("switching back restores the demo dataset", len(repo.projects) == 500)
    check("demo projects are scored again after switching back",
          all(p["risk"]["score_available"] for p in repo.projects))

    demo_eval = cuf_router.baseline_vs_ml(refresh=True)
    check("baseline-vs-ML evaluation runs on demo data",
          demo_eval.get("available") is True)
    cm = demo_eval["classification"]
    check("conventional baseline metrics are real numbers",
          all(isinstance(v, float) for v in cm["baseline"]["metrics"].values()))
    check("ML metrics are real numbers",
          all(isinstance(v, float) for v in cm["ml"]["metrics"].values()))

    # ================= Code audit =================
    root = Path(__file__).parent.parent
    src = [p for p in root.rglob("*.py") if "node_modules" not in str(p) and ".venv" not in str(p) and "venv" not in str(p)]
    src += [p for p in (root / "frontend" / "src").rglob("*.jsx")]
    src += [p for p in (root / "frontend" / "src").rglob("*.js")]

    # A real Google key is "AIza" plus 35 more chars. Matching that exact shape
    # avoids flagging the sanitiser's own redaction pattern, which deliberately
    # contains the prefix.
    import re as _re
    key_pat = _re.compile(r"AIza[0-9A-Za-z_\-]{35}")
    key_hits = []
    for f in src:
        if f.name.startswith("tests_"):
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        if key_pat.search(t):
            key_hits.append(f.name)
    check("no Google API key literal anywhere in source", not key_hits, str(key_hits))

    fe_hits = []
    for f in (root / "frontend" / "src").rglob("*.jsx"):
        if "GEMINI_API_KEY" in f.read_text(encoding="utf-8", errors="ignore"):
            fe_hits.append(f.name)
    check("frontend source never references GEMINI_API_KEY", not fe_hits, str(fe_hits))

    gitignore = (root / "backend" / ".gitignore").read_text()
    check(".env is git-ignored", ".env" in gitignore)
    envex = (root / "backend" / ".env.example").read_text()
    check(".env.example holds a placeholder only",
          "your_key_here" in envex and "AIza" not in envex)

    stale = [p.name for p in (root / "backend" / "app" / "ml").glob("*.json")]
    check("no cached metric file is shipped as live performance", not stale, str(stale))

    banned = ("0.68", "0.96", "68%", "96%")
    metric_hits = []
    for f in src:
        if f.name.startswith("tests_"):
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        for b in banned:
            if b in t:
                metric_hits.append(f"{f.name}:{b}")
    check("no example metric literals remain", not metric_hits, str(metric_hits))

    stats = (root / "backend" / "app" / "core" / "national_stats.py").read_text()
    check("national reference statistics remain, clearly labelled",
          "reference" in stats.lower() and "SIH26103" in stats)

    # README
    readme = (root / "README.md").read_text()
    lower = readme.lower()
    for section in ["SIH26103", "Architecture", "Technology stack", "GEMINI_API_KEY",
                    "setup", "run", "Limitations", "FastAPI", "React", "Vite",
                    "Tailwind", "Recharts", "Lucide", "scikit-learn", "XGBoost",
                    "SHAP", "Gemini", "demo data", "import", "data source",
                    "early warning", "API endpoints", "database"]:
        check(f"README documents: {section}", section.lower() in lower)
    check("README contains no real API key", not key_pat.search(readme))

    print(f"\n{len(passed)} passed, {len(failed)} failed")
    for f in failed:
        print("  FAILED:", f)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
