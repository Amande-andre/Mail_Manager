const state = {
  emails: [],
};

const configStatus = document.getElementById('configStatus');
const errorBox = document.getElementById('errorBox');
const emailsContainer = document.getElementById('emails');
const aiSummary = document.getElementById('aiSummary');
const aiOrder = document.getElementById('aiOrder');
const aiKeep = document.getElementById('aiKeep');

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function renderEmails() {
  if (!state.emails.length) {
    emailsContainer.textContent = 'Aucun email chargé.';
    return;
  }
  emailsContainer.innerHTML = '';
  state.emails.forEach((email) => {
    const card = document.createElement('div');
    card.className = 'email-card';
    card.innerHTML = `
      <div class="email-header">
        <strong>${email.subject || '(Sans sujet)'}</strong>
        <span>${email.date || ''}</span>
      </div>
      <div class="email-meta">${email.sender || 'Expéditeur inconnu'}</div>
      <div class="email-snippet">${email.snippet || ''}</div>
    `;
    emailsContainer.appendChild(card);
  });
}

function renderAiResult(result) {
  aiSummary.textContent = result.summary || 'Analyse terminée.';
  aiOrder.innerHTML = '';
  aiKeep.innerHTML = '';

  const emailById = new Map(state.emails.map((email) => [email.id, email]));

  result.ordered_ids.forEach((id) => {
    const email = emailById.get(id);
    const item = document.createElement('li');
    item.textContent = email
      ? `${email.subject || '(Sans sujet)'} — ${email.sender || ''}`
      : id;
    aiOrder.appendChild(item);
  });

  result.keep_ids.forEach((id) => {
    const email = emailById.get(id);
    const item = document.createElement('li');
    item.textContent = email
      ? `${email.subject || '(Sans sujet)'} — ${email.sender || ''}`
      : id;
    aiKeep.appendChild(item);
  });
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    configStatus.textContent = `Modèle: ${data.ai_model} | Base URL: ${
      data.ai_base_url || 'OpenAI par défaut'
    } | Clé IA: ${data.ai_key_configured ? 'OK' : 'Manquante'} | Gmail: ${
      data.gmail_credentials_found && data.gmail_token_found
        ? 'OK'
        : 'Auth requise'
    }`;
    const maxResults = document.getElementById('maxResults');
    if (data.max_emails_default) {
      maxResults.value = data.max_emails_default;
    }
  } catch (error) {
    configStatus.textContent = 'Impossible de charger la configuration.';
  }
}

async function loadEmails() {
  clearError();
  const query = document.getElementById('query').value.trim();
  const maxResults = document.getElementById('maxResults').value || '20';

  try {
    const response = await fetch(
      `/api/emails?query=${encodeURIComponent(query)}&max_results=${encodeURIComponent(
        maxResults
      )}`
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erreur Gmail');
    }
    const data = await response.json();
    state.emails = data.emails || [];
    renderEmails();
  } catch (error) {
    showError(error.message);
  }
}

async function runAi() {
  clearError();
  const instructions = document.getElementById('instructions').value.trim();
  if (!instructions) {
    showError('Ajoutez des instructions pour l’IA.');
    return;
  }
  if (!state.emails.length) {
    showError('Chargez des emails avant de lancer l’analyse.');
    return;
  }

  try {
    const response = await fetch('/api/ai/filter-sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions, emails: state.emails }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erreur IA');
    }
    const result = await response.json();
    renderAiResult(result);
  } catch (error) {
    showError(error.message);
  }
}

loadConfig();

const loadEmailsButton = document.getElementById('loadEmails');
loadEmailsButton.addEventListener('click', loadEmails);

const runAiButton = document.getElementById('runAi');
runAiButton.addEventListener('click', runAi);
