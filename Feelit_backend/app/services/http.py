"""One shared HTTP client for every outbound API call."""
import logging

import httpx

from app.config import settings

logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines would print API keys in URLs
log = logging.getLogger("feelit")
client = httpx.AsyncClient(
    timeout=httpx.Timeout(20, connect=8),
    # Wikimedia requires a contact URL in the User-Agent; we give the app's own site.
    headers={"User-Agent": f"FeelIt/1.0 ({settings.cors_origin_list[0]}; travel planner for India)"},
)


async def get_json(url: str, **kwargs) -> dict | None:
    """GET a JSON document; returns None (and logs) on any failure."""
    return await _json("GET", url, **kwargs)


async def post_json(url: str, keep_error: bool = False, **kwargs) -> dict | None:
    """POST and read a JSON document; returns None (and logs) on any failure.

    With keep_error=True a JSON error body is returned instead of None, marked with "_status".
    """
    return await _json("POST", url, keep_error, **kwargs)


async def _json(method: str, url: str, keep_error: bool = False, **kwargs) -> dict | None:
    try:
        response = await client.request(method, url, **kwargs)
    except httpx.HTTPError as error:
        # httpx's message includes the full URL, which can contain API keys: log the error type only.
        log.warning("%s %s failed: %s", method, url.split("?")[0], type(error).__name__)
        return None
    try:
        body = response.json()
    except ValueError:
        body = None
    if response.is_success and body is not None:
        return body
    # The provider's own response body never contains our keys and makes failures diagnosable.
    log.warning("%s %s failed: %s %s", method, url.split("?")[0], response.status_code, " ".join(response.text[:300].split()))
    return {**body, "_status": response.status_code} if keep_error and isinstance(body, dict) else None
