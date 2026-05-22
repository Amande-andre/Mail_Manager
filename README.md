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

1. Générez `token.json` localement (voir section Authentification Gmail).
2. Créez un dossier `secrets/` et placez `credentials.json` et `token.json` dedans.
3. Créez un fichier `.env` avec au minimum `AI_API_KEY` (et vos autres variables si besoin).
4. Lancez :

```bash
docker compose up --build
```

Ouvrez `http://localhost:8000`.

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

## Hébergement pour tests (Fly.io, Docker)

Solution simple et peu coûteuse avec volume persistant pour `token.json`.

1. Initialisez l'app :
   ```bash
   fly launch --no-deploy
   ```
2. Créez un volume persistant :
   ```bash
   fly volumes create mail_data --size 1
   ```
3. Montez le volume sur `/data` dans `fly.toml`.
4. Configurez les secrets :
   ```bash
   fly secrets set \
     AI_API_KEY=... \
     ALLOWED_ORIGINS=https://<app>.fly.dev \
     GMAIL_CREDENTIALS_PATH=/data/credentials.json \
     GMAIL_TOKEN_PATH=/data/token.json
   ```
5. Uploadez `credentials.json` et `token.json` dans `/data` :
   ```bash
   fly ssh sftp shell
   ```
6. Déployez :
   ```bash
   fly deploy
   ```

## Notes

- Les fichiers `credentials.json` et `token.json` ne sont pas versionnés.
- L'ancienne branche `master` contenait un environnement virtuel local ; il est maintenant ignoré via `.gitignore`.
- Aucune suite de tests n'est fournie pour le moment.
