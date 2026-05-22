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
import type { Credentials, OAuth2Client } from 'google-auth-library';
import { ConfigService } from '../config/config.service';

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

type SessionData = {
  state?: string;
  tokens?: Credentials;
};

@Injectable()
export class GmailAuthService {
  private readonly logger = new Logger(GmailAuthService.name);
  private readonly sessions = new Map<string, SessionData>();
  private cachedCredentials: OAuthCredentialsFile | null = null;

  constructor(private readonly configService: ConfigService) {}

  getSessionId(req: Request): string | null {
    const cookies = this.parseCookies(req.headers.cookie);
    return cookies[this.configService.config.sessionCookieName] || null;
  }

  ensureSession(req: Request, res: Response): string {
    const existing = this.getSessionId(req);
    if (existing) {
      return existing;
    }
    const sessionId = randomBytes(24).toString('hex');
    this.sessions.set(sessionId, {});
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
    const session = this.sessions.get(sessionId);
    return Boolean(session?.tokens);
  }

  async getAuthUrl(sessionId: string): Promise<string> {
    const state = randomBytes(16).toString('hex');
    const session = this.sessions.get(sessionId) ?? {};
    session.state = state;
    this.sessions.set(sessionId, session);

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
    const session = this.sessions.get(sessionId);
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
    this.sessions.set(sessionId, session);
  }

  async getAuthorizedClient(sessionId: string): Promise<OAuth2Client> {
    const session = this.sessions.get(sessionId);
    if (!session?.tokens) {
      throw new UnauthorizedException('Authentification Gmail requise.');
    }
    const auth = await this.buildOAuthClient();
    auth.setCredentials(session.tokens);
    auth.on('tokens', (tokens) => {
      const current = this.sessions.get(sessionId);
      if (!current) {
        return;
      }
      current.tokens = { ...current.tokens, ...tokens };
      this.sessions.set(sessionId, current);
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
    const updated = this.sessions.get(sessionId);
    if (updated) {
      updated.tokens = auth.credentials;
      this.sessions.set(sessionId, updated);
    }
    return auth;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
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
      acc[rawKey] = decodeURIComponent(rest.join('='));
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
    if (process.env.NODE_ENV === 'production') {
      parts.push('Secure');
    }
    return parts.join('; ');
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
