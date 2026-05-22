import { existsSync } from 'fs';
import path from 'path';

export interface AppConfig {
  aiApiKey: string;
  aiBaseUrl?: string;
  aiModel: string;
  aiTemperature: number;
  allowedOrigins: string[];
  maxEmailsDefault: number;
  maxEmailsLimit: number;
  gmailUserId: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRedirectUri: string;
  gmailScopes: string[];
  gmailCredentialsPath: string;
  frontendBaseUrl: string;
  sessionCookieName: string;
  sessionDbPath: string;
  sessionEncryptionKey: string;
  port: number;
}

const parseNumber = (
  value: string | undefined,
  fallback: number,
  name: string,
  options?: { min?: number; max?: number; integer?: boolean },
): number => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} doit être un nombre.`);
  }
  if (options?.integer && !Number.isInteger(parsed)) {
    throw new Error(`${name} doit être un entier.`);
  }
  if (options?.min !== undefined && parsed < options.min) {
    throw new Error(`${name} doit être >= ${options.min}.`);
  }
  if (options?.max !== undefined && parsed > options.max) {
    throw new Error(`${name} doit être <= ${options.max}.`);
  }
  return parsed;
};

const parseOrigins = (
  value: string | undefined,
  fallback: string[],
): string[] => {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : fallback;
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
};

const resolvePath = (value: string | undefined, fallback: string): string => {
  if (value && value.trim()) {
    return path.resolve(value.trim());
  }
  return path.resolve(fallback);
};

const baseDir = process.cwd();
const maxEmailsLimit = 100;
const port = parseNumber(process.env.PORT, 3000, 'PORT', {
  min: 1,
  max: 65535,
});
const frontendBaseUrl =
  process.env.FRONTEND_BASE_URL?.trim() || 'http://localhost:5173';
const defaultRedirectUri = `http://localhost:${port}/api/auth/google/callback`;
const sessionDbPath = resolvePath(
  process.env.SESSION_DB_PATH,
  path.join(baseDir, 'data', 'sessions.db'),
);

export const appConfig: AppConfig = {
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  aiModel: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
  aiTemperature: parseNumber(
    process.env.AI_TEMPERATURE,
    0.2,
    'AI_TEMPERATURE',
    {
      min: 0,
      max: 2,
    },
  ),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS, [
    'http://localhost:5173',
  ]),
  maxEmailsDefault: parseNumber(
    process.env.MAX_EMAILS_DEFAULT,
    20,
    'MAX_EMAILS_DEFAULT',
    { min: 1, max: maxEmailsLimit, integer: true },
  ),
  maxEmailsLimit,
  gmailUserId: process.env.GMAIL_USER_ID?.trim() || 'me',
  gmailClientId: process.env.GMAIL_CLIENT_ID?.trim() || '',
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() || '',
  gmailRedirectUri: process.env.GMAIL_REDIRECT_URI?.trim() || '',
  gmailScopes: parseList(process.env.GMAIL_SCOPES, [
    'https://www.googleapis.com/auth/gmail.readonly',
  ]),
  gmailCredentialsPath: resolvePath(
    process.env.GMAIL_CREDENTIALS_PATH,
    path.join(baseDir, 'credentials.json'),
  ),
  frontendBaseUrl,
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'mm_session',
  sessionDbPath,
  sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY?.trim() || '',
  port,
};

export const configSummary = () => ({
  ai_model: appConfig.aiModel,
  ai_base_url: appConfig.aiBaseUrl ?? null,
  ai_key_configured: Boolean(appConfig.aiApiKey),
  gmail_oauth_configured:
    Boolean(appConfig.gmailClientId && appConfig.gmailClientSecret) ||
    existsSync(appConfig.gmailCredentialsPath),
  gmail_redirect_uri: appConfig.gmailRedirectUri || defaultRedirectUri,
  max_emails_default: appConfig.maxEmailsDefault,
  max_emails_limit: appConfig.maxEmailsLimit,
  frontend_base_url: appConfig.frontendBaseUrl,
});
