import { useCallback, useEffect, useMemo, useState } from 'react'

type EmailItem = {
  id: string
  threadId?: string | null
  sender?: string
  subject?: string
  date?: string
  snippet?: string
}

type AiResult = {
  keep_ids: string[]
  ordered_ids: string[]
  summary?: string
}

type ConfigResponse = {
  ai_model: string
  ai_base_url: string | null
  ai_key_configured: boolean
  gmail_oauth_configured: boolean
  gmail_redirect_uri: string
  max_emails_default: number
  max_emails_limit: number
  frontend_base_url: string
}

const reportItems = [
  'Mail Manager est une interface web pour charger et trier des emails Gmail.',
  'Le backend NestJS expose une API JSON dédiée au traitement.',
  'Connexion Gmail via OAuth Google multi-utilisateurs.',
  'Tokens stockés en session (pas de persistance pour le moment).',
  'Lecture Gmail en mode read-only après authentification.',
  'Recherche Gmail paramétrable via une requête.',
  'Limitation configurable du nombre d’emails chargés.',
  'Extraction des métadonnées: expéditeur, sujet, date, extrait.',
  'Analyse IA via un provider compatible OpenAI.',
  'Prompt système orienté filtrage et priorisation.',
  'Retour IA attendu: keep_ids, ordered_ids, summary.',
  'Fallback si réponse IA non conforme (sanitization).',
  'CORS configurable via ALLOWED_ORIGINS.',
  'Interface React pour charger les emails.',
  'Formulaire pour saisir des instructions IA.',
  'Affichage des emails chargés dans l’UI.',
  'Affichage de la synthèse IA et de l’ordre recommandé.',
  'Gestion des erreurs côté API avec messages clairs.',
  'Configuration IA par variables d’environnement.',
  'Support d’un base_url IA optionnel.',
  'Exécution locale via NestJS + Vite.',
  'Support Docker avec secrets séparés.',
  'Aucune suite de tests front fournie.',
  'Projet conçu pour un usage simple et direct.',
  'Ce compte rendu reflète l’état actuel du dépôt.',
]

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '')
const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '')
const buildApiUrl = (path: string) => `${apiBaseUrl}${path}`
const apiFetch = (path: string, options?: RequestInit) =>
  fetch(buildApiUrl(path), { ...options, credentials: 'include' })

const broadcastAuthStatus = (status: string) => {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('gmail-auth')
    channel.postMessage({ status })
    channel.close()
    return
  }
  try {
    localStorage.setItem(
      'gmail-auth',
      JSON.stringify({ status, ts: Date.now() }),
    )
  } catch {
    // ignore
  }
}

const getAuthNotice = (status: string | null) => {
  if (status === 'success') {
    return 'Connexion Google réussie.'
  }
  if (status === 'error') {
    return 'Connexion Google échouée. Réessayez.'
  }
  return ''
}

const getAuthNoticeFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  return getAuthNotice(params.get('auth'))
}

const parseMaxResults = (value: string, fallback: number, limit: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.min(Math.floor(parsed), limit)
}

function App() {
  const isReportPage = window.location.pathname === '/report'
  const [configStatus, setConfigStatus] = useState('Chargement...')
  const [authStatus, setAuthStatus] = useState<'checking' | 'ok' | 'missing'>(
    'checking',
  )
  const [authNotice, setAuthNotice] = useState(() => getAuthNoticeFromUrl())
  const [query, setQuery] = useState('')
  const [maxResults, setMaxResults] = useState('20')
  const [maxResultsLimit, setMaxResultsLimit] = useState(100)
  const [instructions, setInstructions] = useState('')
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [error, setError] = useState('')

  const emailById = useMemo(
    () => new Map(emails.map((email) => [email.id, email])),
    [emails],
  )

  const fetchAndUpdateAuthStatus = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/status')
      const data = (await response.json()) as { authenticated?: boolean }
      setAuthStatus(data.authenticated ? 'ok' : 'missing')
    } catch {
      setAuthStatus('missing')
    }
  }, [])

  useEffect(() => {
    if (isReportPage) {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const authParam = params.get('auth')
    if (authParam && window.name === 'gmail-auth') {
      broadcastAuthStatus(authParam)
      window.close()
      return
    }
    if (params.has('auth')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    const loadConfig = async () => {
      try {
        const response = await apiFetch('/api/config')
        const data = (await response.json()) as ConfigResponse
        setConfigStatus(
          `Modèle: ${data.ai_model} | Base URL: ${
            data.ai_base_url || 'OpenAI par défaut'
          } | Clé IA: ${
            data.ai_key_configured ? 'OK' : 'Manquante'
          } | OAuth Gmail: ${data.gmail_oauth_configured ? 'OK' : 'Manquant'}`,
        )
        if (data.max_emails_default) {
          setMaxResults(String(data.max_emails_default))
        }
        if (data.max_emails_limit) {
          setMaxResultsLimit(data.max_emails_limit)
        }
      } catch {
        setConfigStatus('Impossible de charger la configuration.')
      }
    }

    const fetchAuthStatus = async () => {
      try {
        const response = await apiFetch('/api/auth/status')
        const data = (await response.json()) as { authenticated?: boolean }
        setAuthStatus(data.authenticated ? 'ok' : 'missing')
      } catch {
        setAuthStatus('missing')
      }
    }

    loadConfig()
    fetchAuthStatus()
  }, [isReportPage])

  useEffect(() => {
    if (isReportPage) {
      return
    }
    const handleAuthStatusChange = (status: string | null) => {
      setAuthNotice(getAuthNotice(status))
      fetchAndUpdateAuthStatus()
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'gmail-auth' || !event.newValue) {
        return
      }
      try {
        const payload = JSON.parse(event.newValue) as { status?: string }
        handleAuthStatusChange(
          typeof payload.status === 'string' ? payload.status : null,
        )
      } catch {
        handleAuthStatusChange(null)
      }
    }
    window.addEventListener('storage', handleStorage)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('gmail-auth')
      channel.onmessage = (event) => {
        const payload = event.data as { status?: string }
        handleAuthStatusChange(
          typeof payload?.status === 'string' ? payload.status : null,
        )
      }
    }
    return () => {
      window.removeEventListener('storage', handleStorage)
      channel?.close()
    }
  }, [isReportPage, fetchAndUpdateAuthStatus])

  const clearError = () => setError('')
  const showError = (message: string) => setError(message)

  const startAuth = async () => {
    clearError()
    setAuthNotice('')
    try {
      const response = await apiFetch('/api/auth/google/start')
      if (!response.ok) {
        throw new Error('Impossible de démarrer OAuth Google')
      }
      const data = (await response.json()) as { auth_url?: string }
      if (!data.auth_url) {
        throw new Error('URL OAuth manquante')
      }
      const popup = window.open(
        data.auth_url,
        'gmail-auth',
        'width=520,height=620,noopener',
      )
      if (!popup) {
        window.location.href = data.auth_url
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erreur OAuth')
    }
  }

  const logout = async () => {
    clearError()
    setAuthNotice('')
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) {
        throw new Error('Impossible de se déconnecter')
      }
      setAuthStatus('missing')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erreur OAuth')
    }
  }

  const loadEmails = async () => {
    clearError()
    if (authStatus !== 'ok') {
      showError('Authentification Gmail requise.')
      return
    }
    const max = parseMaxResults(maxResults, 20, maxResultsLimit)

    try {
      const response = await apiFetch(
        `/api/emails?query=${encodeURIComponent(query.trim())}&max_results=${max}`,
      )
      if (!response.ok) {
        const errorBody = (await response.json()) as { detail?: string }
        throw new Error(errorBody.detail || 'Erreur Gmail')
      }
      const data = (await response.json()) as { emails?: EmailItem[] }
      setEmails(data.emails ?? [])
      setAiResult(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erreur Gmail')
    }
  }

  const runAi = async () => {
    clearError()
    if (!instructions.trim()) {
      showError('Ajoutez des instructions pour l’IA.')
      return
    }
    if (emails.length === 0) {
      showError('Chargez des emails avant de lancer l’analyse.')
      return
    }

    try {
      const response = await apiFetch('/api/ai/filter-sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim(), emails }),
      })
      if (!response.ok) {
        const errorBody = (await response.json()) as { detail?: string }
        throw new Error(errorBody.detail || 'Erreur IA')
      }
      const result = (await response.json()) as AiResult
      setAiResult(result)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erreur IA')
    }
  }

  if (isReportPage) {
    return (
      <main className="container">
        <header>
          <h1>Compte rendu du projet</h1>
          <p>Résumé en 25 lignes maximum de l’état actuel.</p>
          <p>
            <a href="/">Retour à l&apos;accueil</a>
          </p>
        </header>

        <section className="card">
          <h2>Capacités actuelles</h2>
          <ol>
            {reportItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      </main>
    )
  }

  return (
    <main className="container">
      <header>
        <h1>Gestionnaire de mails</h1>
        <p>Configurez, filtrez et triez vos emails avec un agent IA.</p>
        <p>
          <a href="/report">Voir le compte rendu du projet</a>
        </p>
      </header>

      <section className="card">
        <h2>Configuration</h2>
        <div className="status">{configStatus}</div>
      </section>

      <section className="card">
        <h2>Recherche Gmail</h2>
        <p>
          État OAuth:{' '}
          {authStatus === 'checking'
            ? 'Vérification...'
            : authStatus === 'ok'
              ? 'Connecté'
              : 'Non connecté'}
        </p>
        <div className="button-group">
          <button
            type="button"
            onClick={startAuth}
            disabled={authStatus === 'ok'}
          >
            Se connecter à Google
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={authStatus !== 'ok'}
          >
            Se déconnecter
          </button>
        </div>
        <label>
          Requête Gmail (optionnel)
          <input
            type="text"
            value={query}
            placeholder="from:newsletter"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Nombre maximum d&apos;emails
          <input
            type="number"
            min={1}
            max={maxResultsLimit}
            value={maxResults}
            onChange={(event) => setMaxResults(event.target.value)}
          />
        </label>
        <button type="button" onClick={loadEmails}>
          Charger les emails
        </button>
      </section>

      <section className="card">
        <h2>Instructions IA</h2>
        <textarea
          rows={4}
          value={instructions}
          placeholder="Ex: Garde uniquement les emails urgents et trie par priorité."
          onChange={(event) => setInstructions(event.target.value)}
        />
        <button type="button" onClick={runAi}>
          Analyser avec l&apos;IA
        </button>
      </section>

      <section className="card">
        <h2>Emails chargés</h2>
        {emails.length === 0 ? (
          <div className="list">Aucun email chargé.</div>
        ) : (
          <div className="list">
            {emails.map((email) => (
              <div className="email-card" key={email.id}>
                <div className="email-header">
                  <strong>{email.subject || '(Sans sujet)'}</strong>
                  <span>{email.date || ''}</span>
                </div>
                <div className="email-meta">
                  {email.sender || 'Expéditeur inconnu'}
                </div>
                <div className="email-snippet">{email.snippet || ''}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Résultat IA</h2>
        <p>{aiResult?.summary || 'Aucune analyse pour le moment.'}</p>
        <div className="grid">
          <div>
            <h3>Ordre recommandé</h3>
            <ol>
              {(aiResult?.ordered_ids ?? []).map((id) => {
                const email = emailById.get(id)
                const label = email
                  ? `${email.subject || '(Sans sujet)'} — ${email.sender || ''}`
                  : id
                return <li key={`order-${id}`}>{label}</li>
              })}
            </ol>
          </div>
          <div>
            <h3>Emails à garder</h3>
            <ul>
              {(aiResult?.keep_ids ?? []).map((id) => {
                const email = emailById.get(id)
                const label = email
                  ? `${email.subject || '(Sans sujet)'} — ${email.sender || ''}`
                  : id
                return <li key={`keep-${id}`}>{label}</li>
              })}
            </ul>
          </div>
        </div>
      </section>

      {authNotice ? <section className="card">{authNotice}</section> : null}
      {error ? <section className="card error">{error}</section> : null}
    </main>
  )
}

export default App
