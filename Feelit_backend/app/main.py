"""Feel It API - AI travel planner for India."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.config import settings
from app.db import client as mongo, init_indexes
from app.routers import agent, auth, discover, internal, trips
from app.services import reminders
from app.services.email import email_enabled
from app.services.http import client as http, log

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_indexes()
    except PyMongoError as error:
        # A slow database connection must not stop the app from starting; indexes are created on the next start.
        log.warning("Could not create database indexes at startup: %s", type(error).__name__)
    reminder_task = asyncio.create_task(reminders.run_forever()) if email_enabled() else None
    yield
    if reminder_task:
        reminder_task.cancel()
    await http.aclose()
    await mongo.close()


production = settings.production
app = FastAPI(
    title="Feel It API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if production else "/docs",
    redoc_url=None,
    openapi_url=None if production else "/openapi.json",
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    """422 with field and message only: never echo what was sent back (it may be a password)."""
    detail = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in error.errors()]
    return JSONResponse({"detail": detail}, status_code=422)


class UnexpectedErrors:
    """Turn an unexpected crash into a JSON 500 that still passes through CORS.

    Starlette's own last-resort handler sits outside the CORS middleware, so the browser would only
    see a misleading "can't reach the server" instead of a message it can show.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)
        started = False

        async def tracked(message):
            nonlocal started
            started = started or message["type"] == "http.response.start"
            await send(message)

        try:
            await self.inner(scope, receive, tracked)
        except Exception:
            log.exception("Unhandled error on %s %s", scope["method"], scope["path"])
            if started:  # part of a (streamed) response already went out: nothing sensible left to send
                raise
            await JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)(scope, receive, send)


# Added first = innermost: errors are caught here, then compressed and given CORS headers on the way out.
app.add_middleware(UnexpectedErrors)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

for router in (auth.router, agent.router, trips.router, discover.router, internal.router):
    app.include_router(router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
