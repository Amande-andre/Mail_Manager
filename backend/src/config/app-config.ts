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
  gmailCredentialsPath: string;
  gmailTokenPath: string;
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

const parseOrigins = (value: string | undefined, fallback: string[]): string[] => {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : fallback;
};

const resolvePath = (value: string | undefined, fallback: string): string => {
  if (value && value.trim()) {
    return path.resolve(value.trim());
  }
  return path.resolve(fallback);
};

const baseDir = process.cwd();
const maxEmailsLimit = 100;

export const appConfig: AppConfig = {
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  aiModel: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
  aiTemperature: parseNumber(process.env.AI_TEMPERATURE, 0.2, 'AI_TEMPERATURE', {
    min: 0,
    max: 2,
  }),
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
  gmailCredentialsPath: resolvePath(
    process.env.GMAIL_CREDENTIALS_PATH,
    path.join(baseDir, 'credentials.json'),
  ),
  gmailTokenPath: resolvePath(
    process.env.GMAIL_TOKEN_PATH,
    path.join(baseDir, 'token.json'),
  ),
  port: parseNumber(process.env.PORT, 3000, 'PORT', { min: 1, max: 65535 }),
};

export const configSummary = () => ({
  ai_model: appConfig.aiModel,
  ai_base_url: appConfig.aiBaseUrl ?? null,
  ai_key_configured: Boolean(appConfig.aiApiKey),
  gmail_credentials_found: existsSync(appConfig.gmailCredentialsPath),
  gmail_token_found: existsSync(appConfig.gmailTokenPath),
  max_emails_default: appConfig.maxEmailsDefault,
});
