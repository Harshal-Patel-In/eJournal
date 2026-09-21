"""Email transmission utilities.

Supports standard SMTP (e.g., Gmail SMTP with App Password) with non-blocking
execution, alongside HTTPS API integrations (Resend, Brevo).
"""

import asyncio
from email.message import EmailMessage
import os
import smtplib
import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


def _send_smtp_sync(
    host: str,
    port: int,
    user: str,
    password: str,
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    html_content: str,
) -> None:
    """Synchronous SMTP email delivery using standard library."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.set_content("Please enable HTML to view this email.")
    msg.add_alternative(html_content, subtype="html")

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15.0) as server:
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.send_message(msg)


async def _dispatch_email(to_email: str, subject: str, html_content: str) -> bool:
    """Core dispatcher for sending emails via SMTP, Resend, or Brevo."""
    # 1. SMTP Delivery (Primary choice: e.g. Gmail SMTP with App Password)
    smtp_user = settings.effective_smtp_user
    smtp_pass = settings.effective_smtp_password
    if smtp_user and smtp_pass:
        host = settings.SMTP_HOST or "smtp.gmail.com"
        port = settings.SMTP_PORT or 587
        from_name = settings.SMTP_FROM_NAME or "eJournal"
        from_email = settings.effective_smtp_from_email or smtp_user
        try:
            await asyncio.to_thread(
                _send_smtp_sync,
                host=host,
                port=port,
                user=smtp_user,
                password=smtp_pass,
                from_name=from_name,
                from_email=from_email,
                to_email=to_email,
                subject=subject,
                html_content=html_content,
            )
            logger.info("email_sent_via_smtp", to=to_email, subject=subject, host=host)
            return True
        except Exception as e:
            logger.error(
                "email_smtp_failed",
                error=str(e),
                to=to_email,
                subject=subject,
                host=host,
                port=port,
            )

    # 2. Resend API Integration (Fallback if configured)
    resend_key = getattr(settings, "RESEND_API_KEY", None) or getattr(settings, "resend_api_key", None)
    if not resend_key:
        resend_key = os.environ.get("RESEND_API_KEY")

    if resend_key:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
        }
        from_header = f"{settings.SMTP_FROM_NAME} <{settings.effective_smtp_from_email}>"
        payload = {
            "from": from_header,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code in [200, 201]:
                    logger.info("email_sent_via_resend", to=to_email, subject=subject)
                    return True
                else:
                    logger.error(
                        "email_resend_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_resend_exception", error=str(e), to=to_email)

    # 3. Brevo API Integration (Fallback if configured)
    elif settings.BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        }
        payload = {
            "sender": {
                "name": settings.SMTP_FROM_NAME,
                "email": settings.effective_smtp_from_email,
            },
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 201:
                    logger.info("email_sent_via_brevo", to=to_email, subject=subject)
                    return True
                else:
                    logger.error(
                        "email_brevo_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=to_email,
                    )
        except Exception as e:
            logger.error("email_brevo_exception", error=str(e), to=to_email)

    else:
        logger.warning(
            "email_no_provider_configured",
            to=to_email,
            message="No SMTP, Resend, or Brevo provider configured.",
        )

    return True


async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a verification OTP to the target email.

    - Uses SMTP (e.g. Gmail) if SMTP credentials are provided.
    - Falls back to Resend or Brevo if configured.
    - In development mode, always logs OTP to console.
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

    # Always log the OTP to console in development mode (RULE-LOG03)
    if settings.ENVIRONMENT == "development":
        logger.info(
            "email_otp_dev_log",
            to=to_email,
            otp=otp_code,
            message="Development mode: OTP also printed to console.",
        )

    return await _dispatch_email(to_email, subject, html_content)


async def send_notification_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send a notification email to the target address."""
    if settings.ENVIRONMENT == "development":
        logger.info(
            "email_notification_dev_log",
            to=to_email,
            subject=subject,
            message="Development mode: Email logged to console.",
        )

    return await _dispatch_email(to_email, subject, html_content)
