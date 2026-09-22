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

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
