# Mail Manager

Interface web pour configurer, filtrer et trier des emails Gmail avec un agent IA.

## Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: NestJS + TypeScript

## Prérequis

- Node.js 20+
- Un projet Google Cloud avec l’API Gmail activée
- Un client OAuth Google (type web) avec un redirect URI vers le backend
- (Optionnel) un fichier `credentials.json` contenant `client_id` / `client_secret`

## Variables d’environnement (backend)

| Variable | Description | Exemple |
| --- | --- | --- |
| `AI_API_KEY` | Clé API IA | `sk-...` |
| `AI_BASE_URL` | Base URL (optionnelle) | `https://openrouter.ai/api/v1` |
| `AI_MODEL` | Modèle IA | `gpt-4o-mini` |
| `AI_TEMPERATURE` | Température | `0.2` |
| `ALLOWED_ORIGINS` | Origines CORS autorisées | `http://localhost:5173` |
| `MAX_EMAILS_DEFAULT` | Nombre d’emails par défaut | `20` |
| `GMAIL_USER_ID` | User ID Gmail | `me` |
| `GMAIL_CLIENT_ID` | OAuth client_id Google | `...apps.googleusercontent.com` |
| `GMAIL_CLIENT_SECRET` | OAuth client_secret Google | `...` |
| `GMAIL_REDIRECT_URI` | Redirect URI OAuth | `http://localhost:3000/api/auth/google/callback` |
| `GMAIL_SCOPES` | Scopes Gmail (CSV) | `https://www.googleapis.com/auth/gmail.readonly` |
| `GMAIL_CREDENTIALS_PATH` | Fichier credentials.json (fallback) | `/secrets/credentials.json` |
| `FRONTEND_BASE_URL` | URL frontend pour redirection OAuth | `http://localhost:5173` |
| `SESSION_COOKIE_NAME` | Nom du cookie de session | `mm_session` |

## Lancer en local

Backend :

```bash
cd backend
npm install
npm run start:dev
```

Frontend :

```bash
cd frontend
npm install
npm run dev
```

Ouvrez ensuite `http://localhost:5173`.

## Docker (local)

1. Créez un dossier `secrets/` à la racine et placez `credentials.json` dedans (optionnel).
2. Définissez vos variables d’environnement (`AI_API_KEY`, `GMAIL_CLIENT_ID`, etc.).
3. Lancez :

```bash
docker compose up --build
```

Frontend : `http://localhost:5173`
Backend : `http://localhost:3000`

## Tests (backend)

```bash
cd backend
npm test
npm run test:e2e
```

## Notes

- L’authentification Gmail est multi-utilisateurs avec tokens stockés en session (pas de persistance).
- Les tokens OAuth ne sont pas versionnés ni persistés pour l’instant.
- Le redirect URI OAuth doit pointer vers `/api/auth/google/callback`.
