"""
PAIMANA-AI backend launcher.

Loads the backend .env (so GEMINI_API_KEY is available to the Gemini client)
before importing the application, then serves on http://127.0.0.1:8000.
"""

from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    # python-dotenv is optional; the key can also be exported in the shell.
    pass

import os
import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
