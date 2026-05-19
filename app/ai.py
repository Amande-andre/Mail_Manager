from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI

from app import config

SYSTEM_PROMPT = (
    "Tu es un assistant qui filtre et trie des emails. "
    "Retourne uniquement un JSON valide avec les champs: "
    "keep_ids (liste d'identifiants à garder), "
    "ordered_ids (liste d'identifiants dans l'ordre recommandé), "
    "summary (explication courte)."
)

LOGGER = logging.getLogger(__name__)


def _get_client() -> OpenAI:
    if not config.AI_API_KEY:
        raise RuntimeError(
            "AI_API_KEY est manquant. Configurez la variable d'environnement."
        )
    if config.AI_BASE_URL:
        return OpenAI(api_key=config.AI_API_KEY, base_url=config.AI_BASE_URL)
    return OpenAI(api_key=config.AI_API_KEY)


def filter_and_sort_emails(
    emails: list[dict[str, Any]], instructions: str
) -> dict[str, Any]:
    client = _get_client()
    payload = {"instructions": instructions, "emails": emails}
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]

    try:
        response = client.chat.completions.create(
            model=config.AI_MODEL,
            messages=messages,
            temperature=config.AI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        LOGGER.warning("Fallback sans response_format: %s", exc)
        response = client.chat.completions.create(
            model=config.AI_MODEL,
            messages=messages,
            temperature=config.AI_TEMPERATURE,
        )

    content = response.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        LOGGER.warning("Réponse IA non JSON: %s", content)
        data = {}

    ids = [email.get("id") for email in emails if email.get("id")]

    def sanitize_id_list(value: Any, fallback: list[str]) -> list[str]:
        if isinstance(value, list):
            cleaned = [item for item in value if isinstance(item, str) and item]
            return cleaned or fallback
        return fallback

    keep_ids = sanitize_id_list(data.get("keep_ids"), ids)
    ordered_ids = sanitize_id_list(data.get("ordered_ids"), keep_ids)

    return {
        "keep_ids": keep_ids,
        "ordered_ids": ordered_ids,
        "summary": data.get("summary", ""),
        "raw": data,
    }
