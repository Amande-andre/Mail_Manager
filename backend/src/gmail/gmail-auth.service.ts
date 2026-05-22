import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import type { Request, Response } from 'express';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '../config/config.service';
import {
  GmailSessionStore,
  type GmailSessionData,
} from './gmail-session.store';

type OAuthCredentialsFile = {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
};

@Injectable()
export class GmailAuthService {
  private readonly logger = new Logger(GmailAuthService.name);
  private cachedCredentials: OAuthCredentialsFile | null = null;
  private readonly sessionTtlMs = 1000 * 60 * 60 * 12;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: GmailSessionStore,
  ) {}

  getSessionId(req: Request): string | null {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionId =
      cookies[this.configService.config.sessionCookieName] || null;
    if (!sessionId) {
      return null;
    }
    return this.getSession(sessionId) ? sessionId : null;
  }

  ensureSession(req: Request, res: Response): string {
    const existing = this.getSessionId(req);
    if (existing) {
      return existing;
    }
    const sessionId = randomBytes(32).toString('hex');
    this.sessionStore.upsertSession(sessionId, {
      expiresAt: Date.now() + this.sessionTtlMs,
    });
    res.setHeader('Set-Cookie', this.buildCookie(sessionId));
    return sessionId;
  }

  clearSessionCookie(res: Response): void {
    res.setHeader('Set-Cookie', this.buildCookie('', 0));
  }

  hasActiveSession(sessionId: string | null): boolean {
    if (!sessionId) {
      return false;
    }
    const session = this.getSession(sessionId);
    return Boolean(session?.tokens);
  }

  async getAuthUrl(sessionId: string): Promise<string> {
    const state = randomBytes(16).toString('hex');
    const session = this.getSession(sessionId) ?? { expiresAt: 0 };
    session.state = state;
    this.saveSession(sessionId, this.touchSession(session));

    const auth = await this.buildOAuthClient();
    return auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: this.configService.config.gmailScopes,
      state,
    });
  }

  async handleCallback(
    sessionId: string,
    code: string,
    state: string | undefined,
  ): Promise<void> {
    if (!code) {
      throw new BadRequestException('Code OAuth manquant.');
    }
    const session = this.getSession(sessionId);
    if (!session?.state || session.state !== state) {
      throw new BadRequestException('State OAuth invalide.');
    }
    const auth = await this.buildOAuthClient();
    const response = await auth.getToken(code);
    if (!response.tokens || Object.keys(response.tokens).length === 0) {
      throw new BadRequestException('Tokens OAuth manquants.');
    }
    session.tokens = response.tokens;
    session.state = undefined;
    this.saveSession(sessionId, this.touchSession(session));
  }

  async getAuthorizedClient(sessionId: string): Promise<OAuth2Client> {
    const session = this.getSession(sessionId);
    if (!session?.tokens) {
      throw new UnauthorizedException('Authentification Gmail requise.');
    }
    const auth = await this.buildOAuthClient();
    auth.setCredentials(session.tokens);
    auth.on('tokens', (tokens) => {
      const current = this.getSession(sessionId);
      if (!current) {
        return;
      }
      current.tokens = { ...current.tokens, ...tokens };
      this.saveSession(sessionId, this.touchSession(current));
    });
    try {
      const accessToken = await auth.getAccessToken();
      if (!accessToken?.token) {
        throw new Error('Token Gmail absent');
      }
    } catch (error) {
      this.logger.warn(
        'Échec de rafraîchissement du token Gmail',
        error as Error,
      );
      throw new UnauthorizedException(
        'Token Gmail invalide. Reconnectez-vous.',
      );
    }
    const updated = this.getSession(sessionId);
    if (updated) {
      updated.tokens = auth.credentials;
      this.saveSession(sessionId, this.touchSession(updated));
    }
    return auth;
  }

  clearSession(sessionId: string): void {
    this.sessionStore.deleteSession(sessionId);
  }

  private getSession(sessionId: string): GmailSessionData | null {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      this.sessionStore.deleteSession(sessionId);
      return null;
    }
    const touched = this.touchSession(session);
    this.saveSession(sessionId, touched);
    return touched;
  }

  private touchSession(session: GmailSessionData): GmailSessionData {
    session.expiresAt = Date.now() + this.sessionTtlMs;
    return session;
  }

  private saveSession(sessionId: string, session: GmailSessionData): void {
    this.sessionStore.upsertSession(sessionId, session);
  }

  private parseCookies(header?: string): Record<string, string> {
    if (!header) {
      return {};
    }
    return header.split(';').reduce<Record<string, string>>((acc, item) => {
      const [rawKey, ...rest] = item.trim().split('=');
      if (!rawKey) {
        return acc;
      }
      const value = rest.join('=');
      try {
        acc[rawKey] = decodeURIComponent(value);
      } catch {
        acc[rawKey] = value;
      }
      return acc;
    }, {});
  }

  private buildCookie(value: string, maxAge?: number): string {
    const parts = [
      `${this.configService.config.sessionCookieName}=${encodeURIComponent(
        value,
      )}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (typeof maxAge === 'number') {
      parts.push(`Max-Age=${maxAge}`);
    }
    if (this.shouldUseSecureCookie()) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  private shouldUseSecureCookie(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return true;
    }
    const frontendUrl = this.configService.config.frontendBaseUrl;
    const redirectUrl = this.configService.config.gmailRedirectUri;
    return (
      frontendUrl.startsWith('https://') ||
      (redirectUrl ? redirectUrl.startsWith('https://') : false)
    );
  }

  private async buildOAuthClient(): Promise<OAuth2Client> {
    const { clientId, clientSecret, redirectUri } =
      await this.resolveOAuthConfig();
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private async resolveOAuthConfig(): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }> {
    const { gmailClientId, gmailClientSecret, gmailRedirectUri } =
      this.configService.config;

    let clientId = gmailClientId;
    let clientSecret = gmailClientSecret;
    let redirectUri =
      gmailRedirectUri ||
      `http://localhost:${this.configService.config.port}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      const credentials = await this.loadCredentialsFile();
      const source = credentials.installed ?? credentials.web;
      clientId = clientId || source?.client_id || '';
      clientSecret = clientSecret || source?.client_secret || '';
      redirectUri =
        gmailRedirectUri ||
        source?.redirect_uris?.[0] ||
        `http://localhost:${this.configService.config.port}/api/auth/google/callback`;
    }

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Configuration OAuth Gmail manquante. Vérifiez GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET et GMAIL_REDIRECT_URI.',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private async loadCredentialsFile(): Promise<OAuthCredentialsFile> {
    if (this.cachedCredentials) {
      return this.cachedCredentials;
    }
    try {
      const raw = await fs.readFile(
        this.configService.config.gmailCredentialsPath,
        'utf-8',
      );
      this.cachedCredentials = JSON.parse(raw) as OAuthCredentialsFile;
      return this.cachedCredentials;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BadRequestException(
          'credentials.json introuvable. Fournissez les identifiants OAuth.',
        );
      }
      throw new BadRequestException('Impossible de lire credentials.json.');
    }
  }
}
