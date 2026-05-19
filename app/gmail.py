from __future__ import annotations

from typing import List, Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app import config

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _load_credentials() -> Optional[Credentials]:
    if not config.GMAIL_TOKEN_PATH.exists():
        return None

    creds = Credentials.from_authorized_user_file(
        str(config.GMAIL_TOKEN_PATH), SCOPES
    )
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        config.GMAIL_TOKEN_PATH.write_text(creds.to_json())
    return creds


def get_service():
    if not config.GMAIL_CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            "credentials.json introuvable. Placez-le à la racine ou définissez "
            "GMAIL_CREDENTIALS_PATH."
        )

    creds = _load_credentials()
    if not creds or not creds.valid:
        raise RuntimeError(
            "Token Gmail manquant ou invalide. Lancez scripts/gmail_auth.py "
            "pour générer token.json."
        )
    return build("gmail", "v1", credentials=creds)


def _get_header(headers, name: str) -> str:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def list_emails(query: str | None, max_results: int) -> List[dict]:
    service = get_service()
    response = (
        service.users()
        .messages()
        .list(userId=config.GMAIL_USER_ID, q=query or None, maxResults=max_results)
        .execute()
    )
    messages = response.get("messages", [])
    emails: List[dict] = []

    for message in messages:
        detail = (
            service.users()
            .messages()
            .get(
                userId=config.GMAIL_USER_ID,
                id=message["id"],
                format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            )
            .execute()
        )
        headers = detail.get("payload", {}).get("headers", [])
        emails.append(
            {
                "id": detail.get("id"),
                "threadId": detail.get("threadId"),
                "sender": _get_header(headers, "From"),
                "subject": _get_header(headers, "Subject"),
                "date": _get_header(headers, "Date"),
                "snippet": detail.get("snippet", ""),
            }
        )

    return emails
