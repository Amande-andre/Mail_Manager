# Mail Manager

Interface web pour configurer, filtrer et trier des emails Gmail avec un agent IA.

## Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: NestJS + TypeScript

## Prérequis

- Node.js 20+
- Un projet Google Cloud avec l’API Gmail activée
- Un fichier `credentials.json` (OAuth client)
- Un fichier `token.json` généré via OAuth (refresh token requis)

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
| `GMAIL_CREDENTIALS_PATH` | Chemin vers `credentials.json` | `/secrets/credentials.json` |
| `GMAIL_TOKEN_PATH` | Chemin vers `token.json` | `/secrets/token.json` |

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

1. Créez un dossier `secrets/` à la racine et placez `credentials.json` et `token.json` dedans.
2. Définissez vos variables d’environnement (`AI_API_KEY`, etc.).
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

- Les fichiers `credentials.json` et `token.json` ne sont pas versionnés.
- Le backend attend un token OAuth valide (avec refresh token) pour accéder à Gmail.
