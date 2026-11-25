"""Server-Sent Events: how the planner and the agent stream their progress to the browser."""
import json
from typing import AsyncIterator

from fastapi.responses import StreamingResponse


def sse(events: AsyncIterator[dict]) -> StreamingResponse:
    async def body():
        async for event in events:
            yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"

    return StreamingResponse(body(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
