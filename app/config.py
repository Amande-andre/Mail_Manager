import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

GMAIL_CREDENTIALS_PATH = Path(
    os.getenv("GMAIL_CREDENTIALS_PATH", BASE_DIR / "credentials.json")
)
GMAIL_TOKEN_PATH = Path(os.getenv("GMAIL_TOKEN_PATH", BASE_DIR / "token.json"))
GMAIL_USER_ID = os.getenv("GMAIL_USER_ID", "me")

AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_BASE_URL = os.getenv("AI_BASE_URL")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.2"))

MAX_EMAILS_DEFAULT = int(os.getenv("MAX_EMAILS_DEFAULT", "20"))

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",")
    if origin.strip()
]
