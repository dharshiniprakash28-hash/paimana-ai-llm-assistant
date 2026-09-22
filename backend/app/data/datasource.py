"""
Active data source management.

PAIMANA-AI keeps two datasets strictly separate:

  DEMO   500 synthetic projects. Fully populated, including the experimental
         candidate variables. Always labelled as synthetic.

  REAL   A PAIMANA extract imported from CSV/XLSX. Only the fields actually
         present in the uploaded file exist. Nothing is copied over from the
         demo dataset - not values, not risk scores, not candidate variables.

Switching modes swaps which dataset every router, KPI and chart reads from.
The imported dataset and the selected mode are persisted to disk so a browser
refresh, or a backend restart, keeps the real dataset active.
"""

import json
import threading
from pathlib import Path

from app.data.generator import save_generated_projects, DEFAULT_PROJECT_COUNT

DATA_DIR = Path(__file__).parent
DEMO_FILE = DATA_DIR / "projects_demo.json"
IMPORTED_FILE = DATA_DIR / "imported_dataset.json"
STATE_FILE = DATA_DIR / "datasource_state.json"

MODE_DEMO = "DEMO"
MODE_REAL = "REAL"

DEMO_LABEL = "Demo Data - Synthetic"
REAL_LABEL = "Real PAIMANA Data - Imported"

DEMO_DISCLAIMER = (
    "Demo data is synthetic and for demonstration purposes only. "
    "It is not official PAIMANA data."
)
REAL_DISCLAIMER = (
    "Imported PAIMANA data. Risk scores, drivers and alerts shown alongside it are "
    "PAIMANA-AI derived analysis, not official Government of India predictions."
)


class DataSourceManager:
    """Singleton holding the demo dataset, the imported dataset and the active mode."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                inst = super().__new__(cls)
                inst._initialise()
                cls._instance = inst
        return cls._instance

    # ------------------------------------------------------------------
    def _initialise(self):
        self._demo_projects = []
        self._imported_projects = []
        self._import_meta = None
        self._mode = MODE_DEMO
        self._load_demo()
        self._load_persisted_import()

    def _load_demo(self):
        if not DEMO_FILE.exists():
            save_generated_projects(DEMO_FILE, DEFAULT_PROJECT_COUNT)
        with open(DEMO_FILE, "r", encoding="utf-8") as f:
            self._demo_projects = json.load(f)

        # If an older, smaller demo file is present, regenerate at full size.
        if len(self._demo_projects) < DEFAULT_PROJECT_COUNT:
            self._demo_projects = save_generated_projects(DEMO_FILE, DEFAULT_PROJECT_COUNT)

    def _load_persisted_import(self):
        try:
            if IMPORTED_FILE.exists():
                with open(IMPORTED_FILE, "r", encoding="utf-8") as f:
                    payload = json.load(f)
                self._imported_projects = payload.get("projects", [])
                self._import_meta = payload.get("meta")
            if STATE_FILE.exists():
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
                mode = state.get("mode", MODE_DEMO)
                if mode == MODE_REAL and self._imported_projects:
                    self._mode = MODE_REAL
                else:
                    self._mode = MODE_DEMO
        except (OSError, json.JSONDecodeError):
            self._imported_projects = []
            self._import_meta = None
            self._mode = MODE_DEMO

    def _persist_state(self):
        try:
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump({"mode": self._mode}, f)
        except OSError:
            pass

    def _persist_import(self):
        try:
            with open(IMPORTED_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {"projects": self._imported_projects, "meta": self._import_meta},
                    f,
                )
        except OSError:
            pass

    # ------------------------------------------------------------------
    @property
    def mode(self):
        return self._mode

    def set_mode(self, mode):
        mode = (mode or "").upper()
        if mode not in (MODE_DEMO, MODE_REAL):
            raise ValueError(f"Unknown data source mode '{mode}'. Use DEMO or REAL.")
        if mode == MODE_REAL and not self._imported_projects:
            raise ValueError(
                "No PAIMANA dataset has been imported yet. Upload a CSV or XLSX file first."
            )
        self._mode = mode
        self._persist_state()
        return self.status()

    def get_active_projects(self):
        if self._mode == MODE_REAL:
            return self._imported_projects
        return self._demo_projects

    def get_demo_projects(self):
        return self._demo_projects

    def set_imported(self, import_result, activate=True):
        """Store an import_result from app.data.importer.import_projects."""
        self._imported_projects = import_result["projects"]
        self._import_meta = {
            "filename": import_result.get("filename"),
            "imported_at": import_result.get("imported_at"),
            "row_count": import_result.get("row_count"),
            "skipped_rows": import_result.get("skipped_rows"),
            "column_map": import_result.get("column_map"),
            "unmapped_columns": import_result.get("unmapped_columns"),
            "field_availability": import_result.get("field_availability"),
            "warnings": import_result.get("warnings"),
            "risk_ready": import_result.get("risk_ready"),
            "missing_for_risk": import_result.get("missing_for_risk"),
            "partially_missing_for_risk": import_result.get("partially_missing_for_risk"),
        }
        self._persist_import()
        if activate:
            self._mode = MODE_REAL
            self._persist_state()
        return self.status()

    def clear_imported(self):
        self._imported_projects = []
        self._import_meta = None
        self._mode = MODE_DEMO
        try:
            if IMPORTED_FILE.exists():
                IMPORTED_FILE.unlink()
        except OSError:
            pass
        self._persist_state()
        return self.status()

    # ------------------------------------------------------------------
    def status(self):
        is_real = self._mode == MODE_REAL
        return {
            "mode": self._mode,
            "label": REAL_LABEL if is_real else DEMO_LABEL,
            "is_synthetic": not is_real,
            "disclaimer": REAL_DISCLAIMER if is_real else DEMO_DISCLAIMER,
            "active_project_count": len(self.get_active_projects()),
            "demo_project_count": len(self._demo_projects),
            "imported_project_count": len(self._imported_projects),
            "has_imported_dataset": bool(self._imported_projects),
            "import_meta": self._import_meta,
            "available_modes": [
                {"value": MODE_DEMO, "label": DEMO_LABEL, "enabled": True},
                {
                    "value": MODE_REAL,
                    "label": REAL_LABEL,
                    "enabled": bool(self._imported_projects),
                },
            ],
        }
