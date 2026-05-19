from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import ai, config, gmail, models

app = FastAPI(title="Mail Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/config")
async def get_config():
    return {
        "ai_model": config.AI_MODEL,
        "ai_base_url": config.AI_BASE_URL,
        "ai_key_configured": bool(config.AI_API_KEY),
        "gmail_credentials_found": config.GMAIL_CREDENTIALS_PATH.exists(),
        "gmail_token_found": config.GMAIL_TOKEN_PATH.exists(),
        "max_emails_default": config.MAX_EMAILS_DEFAULT,
    }


@app.get("/api/emails")
async def get_emails(query: str | None = None, max_results: int | None = None):
    try:
        emails = gmail.list_emails(query, max_results or config.MAX_EMAILS_DEFAULT)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Erreur Gmail inattendue") from exc

    return {"emails": emails}


@app.post("/api/ai/filter-sort", response_model=models.FilterSortResponse)
async def ai_filter_sort(payload: models.FilterSortRequest):
    try:
        result = ai.filter_and_sort_emails(
            [email.model_dump() for email in payload.emails],
            payload.instructions,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Erreur IA inattendue") from exc

    return result


app.mount("/", StaticFiles(directory="static", html=True), name="static")
