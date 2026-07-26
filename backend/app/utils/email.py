"""Email transmission utilities.

Bypasses SMTP port restrictions on free hosts (like Render) by using
the Resend or Brevo HTTPS API.
"""

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a verification OTP to the target email.

    - If `RESEND_API_KEY` is set, uses Resend's sandbox API.
    - If `BREVO_API_KEY` is set, uses Brevo's HTTPS API.
    - Otherwise, falls back to logging the OTP to the console.
    """
    subject = "Verify your eJournal Account"
    html_content = f"""
    <html>
        <body style="font-family: sans-serif; padding: 20px; color: #171717;">
            <h2 style="color: #212529;">Verify your eJournal Account</h2>
            <p>Thank you for registering with eJournal. Please use the following One-Time Password (OTP) to verify email ownership:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; border: 1px solid #dee2e6;">
                {otp_code}
            </div>
            <p style="color: #6c757d; font-size: 14px;">This OTP is valid for 10 minutes. If you did not request this email, please ignore it.</p>
        </body>
    </html>
    """

    # Always log the OTP to console in development mode for easy developer access (RULE-LOG03)
    if settings.ENVIRONMENT == "development":
        logger.info(
            "email_otp_dev_log",
            to=to_email,
            otp=otp_code,
            message="Development mode: OTP also printed to console.",
        )

    # 1. Resend API Integration (Preferred for sandbox testing without domain)
    resend_key = getattr(settings, "RESEND_API_KEY", None) or getattr(settings, "resend_api_key", None)
    if not resend_key:
        # Check environment variables directly if not mapped in Settings
        import os
        resend_key = os.environ.get("RESEND_API_KEY")

    if resend_key:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": f"eJournal <{settings.SMTP_FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code in [200, 201]:
                    logger.info("email_otp_sent_via_resend", to=to_email)
                    return True
                else:
                    logger.error(
                        "email_otp_resend_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_otp_resend_exception", error=str(e), to=to_email)

    # 2. Brevo API Integration
    elif settings.BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        }
        payload = {
            "sender": {"name": "eJournal", "email": settings.SMTP_FROM_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 201:
                    logger.info("email_otp_sent_via_brevo", to=to_email)
                    return True
                else:
                    logger.error(
                        "email_otp_brevo_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_otp_brevo_exception", error=str(e), to=to_email)

    else:
        logger.warning(
            "email_otp_no_api_key",
            to=to_email,
            message="No Resend or Brevo API keys configured.",
        )

    return True


async def send_notification_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send a notification email to the target address."""
    # Log to console in development
    if settings.ENVIRONMENT == "development":
        logger.info(
            "email_notification_dev_log",
            to=to_email,
            subject=subject,
            message="Development mode: Email logged to console.",
        )

    resend_key = getattr(settings, "RESEND_API_KEY", None) or getattr(settings, "resend_api_key", None)
    if not resend_key:
        import os
        resend_key = os.environ.get("RESEND_API_KEY")

    if resend_key:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": f"eJournal <{settings.SMTP_FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code in [200, 201]:
                    logger.info("email_notification_sent_via_resend", to=to_email, subject=subject)
                    return True
                else:
                    logger.error(
                        "email_notification_resend_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_notification_resend_exception", error=str(e), to=to_email)

    elif settings.BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        }
        payload = {
            "sender": {"name": "eJournal", "email": settings.SMTP_FROM_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 201:
                    logger.info("email_notification_sent_via_brevo", to=to_email, subject=subject)
                    return True
                else:
                    logger.error(
                        "email_notification_brevo_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_notification_brevo_exception", error=str(e), to=to_email)
    else:
        logger.warning(
            "email_notification_no_api_key",
            to=to_email,
            subject=subject,
            message="No Resend or Brevo API keys configured."
        )

    return True

