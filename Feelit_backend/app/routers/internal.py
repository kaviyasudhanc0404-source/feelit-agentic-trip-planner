"""Endpoints for scheduled jobs. Hidden (404) unless the caller sends the right X-Cron-Secret."""
import hmac

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.services.reminders import send_due_reminders

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/reminders")
async def run_reminders(x_cron_secret: str = Header("")):
    """Send the trip reminders that are due now. Called by the scheduler in the evening (see .github/workflows)."""
    if not settings.cron_secret or not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise HTTPException(404)
    return await send_due_reminders()
