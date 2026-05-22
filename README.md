# Mail Manager

Interface web pour configurer, filtrer et trier des emails avec un agent IA. Le backend FastAPI se connecte à Gmail (OAuth) et à un provider IA compatible OpenAI.

## Fonctionnalités

- Chargement d'emails Gmail via une requête
- Analyse IA pour filtrer et trier
- Interface web simple (HTML/JS) servie par FastAPI

## Prérequis

- Python 3.10+
- Un projet Google Cloud avec l'API Gmail activée
- Un fichier `credentials.json` (OAuth client) placé à la racine du dépôt

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Docker (local)

1. Place `credentials.json` and `token.json` in `./secrets/` (use `python scripts/gmail_auth.py` locally to generate the token).
2. Set AI env vars in `.env`.
3. Run:

```bash
docker compose up --build
```

Open `http://localhost:8000`.

## Authentification Gmail

Générez un `token.json` localement :

```bash
python scripts/gmail_auth.py
```

## Configuration IA

Définissez les variables d'environnement suivantes :

| Variable | Description | Exemple |
| --- | --- | --- |
| `AI_API_KEY` | Clé API IA | `sk-...` |
| `AI_BASE_URL` | Base URL (optionnelle) | `https://openrouter.ai/api/v1` |
| `AI_MODEL` | Modèle IA | `gpt-4o-mini` |
| `AI_TEMPERATURE` | Température | `0.2` |
| `ALLOWED_ORIGINS` | Origines CORS autorisées | `http://localhost:8000` |

## Lancer l'application

```bash
uvicorn app.main:app --reload
```

Ouvrez ensuite `http://localhost:8000`.

## Notes

- Les fichiers `credentials.json` et `token.json` ne sont pas versionnés.
- L'ancienne branche `master` contenait un environnement virtuel local ; il est maintenant ignoré via `.gitignore`.
- Aucune suite de tests n'est fournie pour le moment.
