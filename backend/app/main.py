from pathlib import Path

try:
    from dotenv import load_dotenv
    # Load the backend .env so GEMINI_API_KEY is available even when the app is
    # started with `uvicorn app.main:app` rather than via run_backend.py.
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.dashboard import router as dashboard_router
from app.routers.projects import router as projects_router
from app.routers.risk import router as risk_router
from app.routers.analytics import router as analytics_router
from app.routers.cuf import router as cuf_router
from app.routers.assistant import router as assistant_router
from app.routers.datasource import router as datasource_router
from app.data.repository import ProjectRepository
from app.llm.gemini_client import get_status as gemini_status

app = FastAPI(
    title="PAIMANA-AI Backend API",
    description="Predictive Infrastructure Monitoring & Early Warning System (SIH 2026 Problem Statement SIH26103 Prototype)",
    version="1.0.0"
)

import os

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

# CORS configuration to allow React frontend (both local and deployed)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(dashboard_router)
app.include_router(projects_router)
app.include_router(risk_router)
app.include_router(analytics_router)
app.include_router(cuf_router)
app.include_router(assistant_router)
app.include_router(datasource_router)

@app.on_event("startup")
def startup_event():
    # Warm up the repository against whichever data source is active.
    repo = ProjectRepository()
    status = repo.data_source_status()
    print(
        f"PAIMANA-AI repository initialised. Active data source: {status['label']} "
        f"({status['active_project_count']} projects). "
        f"Demo dataset: {status['demo_project_count']} synthetic projects."
    )
    llm = gemini_status()
    print(f"Assistant mode: {llm['display_name']}")

@app.get("/")
def root():
    return {
        "platform": "PAIMANA-AI",
        "description": "Predictive Infrastructure Monitoring & Early Warning System",
        "problem_statement": "SIH 2026 - SIH26103",
        "workflow": "DATA -> PREDICT -> EXPLAIN -> ALERT -> ACT",
        "status": "online",
        "docs_url": "/docs",
        "disclaimer": "Prototype system. Demo data is synthetic and for demonstration purposes only.",
        "endpoints": {
            "dashboard": "/dashboard/summary",
            "projects": "/projects",
            "data_source": "/datasource",
            "baseline_vs_ml": "/cuf/baseline-vs-ml",
            "assistant_chat": "/assistant/chat",
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "paimana-ai-backend"}
