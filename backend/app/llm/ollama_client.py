"""
Ollama local LLM client for PAIMANA-AI assistant.

Fulfills the offline / sovereign air-gapped specification from SIH26103
(Llama 3 / Mistral via Ollama).

Auto-detects whether an Ollama server is reachable on http://127.0.0.1:11434
(or OLLAMA_BASE_URL). If available, free-form queries are answered locally
without sending data outside the host/network.
"""

import json
import os
import urllib.request
import urllib.error
from typing import Tuple, Dict, Any, Optional

from app.llm.gemini_client import SYSTEM_PROMPT

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3")


def is_ollama_reachable(timeout_seconds: float = 1.0) -> bool:
    """Check if Ollama server is running and responding."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_available_models(timeout_seconds: float = 1.5) -> list:
    """List models installed in local Ollama instance."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return [m.get("name") for m in data.get("models", [])]
    except Exception:
        pass
    return []


def get_status() -> Dict[str, Any]:
    reachable = is_ollama_reachable()
    models = get_available_models() if reachable else []
    active_model = DEFAULT_MODEL
    if models and not any(DEFAULT_MODEL in m for m in models):
        active_model = models[0]

    return {
        "llm_enabled": reachable,
        "provider": "OLLAMA",
        "base_url": OLLAMA_BASE_URL,
        "model": active_model if reachable else None,
        "available_models": models,
        "notice": (
            f"Ollama local LLM active ({active_model})"
            if reachable
            else "Ollama is not running locally. Start with 'ollama run llama3'."
        ),
    }


def generate_answer(message: str, context: dict, timeout_seconds: float = 30.0) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Call Ollama /api/generate with strict context and system prompt.
    """
    status = get_status()
    if not status["llm_enabled"]:
        return None, {"error": "Ollama not reachable"}

    model = status["model"] or DEFAULT_MODEL
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"--- ACTIVE PAIMANA CONTEXT ---\n"
        f"{json.dumps(context, indent=2)}\n\n"
        f"--- USER QUESTION ---\n"
        f"{message}\n\n"
        f"Answer directly following the absolute rules:"
    )

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
        }
    }

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/generate",
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            if resp.status == 200:
                result = json.loads(resp.read().decode("utf-8"))
                response_text = result.get("response", "").strip()
                return response_text, {
                    "provider": "OLLAMA",
                    "model": model,
                    "total_duration": result.get("total_duration"),
                }
    except Exception as e:
        return None, {"error": str(e), "provider": "OLLAMA"}

    return None, {"error": "No response from Ollama"}
