"""AI model access with automatic fallback between free providers.

Every call asks for a JSON object. Two tiers spread the load across free quotas:
  big  - itineraries and the agent: Gemini Flash-Lite first (large token allowance), then Groq and Gemini Flash
  fast - short extraction and parsing: Groq first (quickest), Gemini as backup
"""
import asyncio
import json

from app.config import settings
from app.services.http import log, post_json


class AIUnavailable(Exception):
    """Every provider failed or returned something unusable."""


async def _groq(model: str, system: str, messages: list[dict], max_tokens: int) -> str | None:
    data = await post_json(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={
            "model": model,
            "messages": [{"role": "system", "content": system}, *messages],
            "response_format": {"type": "json_object"},
            "temperature": 0.5,
            "max_completion_tokens": max_tokens,
            "reasoning_effort": "low",
        },
        timeout=60,
        keep_error=True,
    )
    if not data:
        return None
    if "_status" not in data:
        return data["choices"][0]["message"]["content"]
    # gpt-oss sometimes emits our "use a tool" step as a native function call, which Groq rejects.
    # The rejected call is in the error body; turn it back into the JSON our agent loop expects.
    error = data.get("error") or {}
    if error.get("code") == "tool_use_failed":
        try:
            call = json.loads(error["failed_generation"])
            return json.dumps({"tool": call["name"], **(call.get("arguments") or {})})
        except (KeyError, TypeError, ValueError):
            pass
    return None


GEMINI_RETRY_SECONDS = 1.5


async def _gemini(model: str, system: str, messages: list[dict], max_tokens: int) -> str | None:
    request = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in messages
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.5, "maxOutputTokens": max_tokens},
    }
    for attempt in range(2):
        data = await post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=request,
            timeout=45,
            keep_error=True,
        )
        # "High demand" (503) usually clears within a second or two, so it gets one quick retry.
        if data and data.get("_status") == 503 and attempt == 0:
            await asyncio.sleep(GEMINI_RETRY_SECONDS)
            continue
        break
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"] if data and "_status" not in data else None
    except (KeyError, IndexError):
        return None


GEMINI_LITE = (_gemini, "gemini-flash-lite-latest")
TIERS = {
    "big": [GEMINI_LITE, (_groq, "openai/gpt-oss-120b"), (_gemini, "gemini-flash-latest"), (_groq, "openai/gpt-oss-20b")],
    "fast": [(_groq, "openai/gpt-oss-20b"), GEMINI_LITE],
}


async def ask_json(system: str, messages: list[dict] | str, tier: str = "fast", max_tokens: int = 2000) -> dict:
    """Ask the AI for a JSON object, trying each provider in the tier until one succeeds."""
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    for call, model in TIERS[tier]:
        text = await call(model, system, messages, max_tokens)
        if not text:
            continue
        try:
            result = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
            if isinstance(result, dict):
                return result
        except ValueError:
            log.warning("%s returned invalid JSON", model)
    raise AIUnavailable("The AI is busy right now. Please try again in a minute.")
