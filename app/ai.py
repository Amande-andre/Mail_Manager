from __future__ import annotations

import json
from typing import List, Dict, Any

from openai import OpenAI

from app import config

SYSTEM_PROMPT = (
    "Tu es un assistant qui filtre et trie des emails. "
    "Retourne uniquement un JSON valide avec les champs: "
    "keep_ids (liste d'identifiants à garder), "
    "ordered_ids (liste d'identifiants dans l'ordre recommandé), "
    "summary (explication courte)."
)


def _get_client() -> OpenAI:
    if not config.AI_API_KEY:
        raise RuntimeError(
            "AI_API_KEY est manquant. Configurez la variable d'environnement."
        )
    if config.AI_BASE_URL:
        return OpenAI(api_key=config.AI_API_KEY, base_url=config.AI_BASE_URL)
    return OpenAI(api_key=config.AI_API_KEY)


def filter_and_sort_emails(
    emails: List[Dict[str, Any]], instructions: str
) -> Dict[str, Any]:
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
    except Exception:
        response = client.chat.completions.create(
            model=config.AI_MODEL,
            messages=messages,
            temperature=config.AI_TEMPERATURE,
        )

    content = response.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = {}

    ids = [email.get("id") for email in emails if email.get("id")]
    keep_ids = data.get("keep_ids") if isinstance(data.get("keep_ids"), list) else ids
    ordered_ids = (
        data.get("ordered_ids")
        if isinstance(data.get("ordered_ids"), list)
        else keep_ids
    )

    return {
        "keep_ids": keep_ids,
        "ordered_ids": ordered_ids,
        "summary": data.get("summary", ""),
        "raw": data,
    }
