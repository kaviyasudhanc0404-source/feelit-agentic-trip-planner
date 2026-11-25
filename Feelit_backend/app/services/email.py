"""Sending email through Brevo's transactional API."""
from app.config import settings
from app.services.http import post_json

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def email_enabled() -> bool:
    return bool(settings.brevo_api_key and settings.brevo_sender_email)


async def send_email(to_email: str, to_name: str, subject: str, html: str, text: str, tag: str) -> str | None:
    """Send one email. Returns Brevo's message id, or None if it was not accepted (the reason is logged)."""
    if not email_enabled():
        return None
    result = await post_json(
        BREVO_URL,
        keep_error=True,
        headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
        json={
            "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
            "to": [{"email": to_email, "name": to_name}],
            "subject": subject,
            "htmlContent": html,
            "textContent": text,
            "tags": [tag],
        },
    )
    if not result or "_status" in result:
        return None
    return result.get("messageId")
