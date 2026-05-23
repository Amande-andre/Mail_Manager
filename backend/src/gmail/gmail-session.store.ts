import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Credentials } from 'google-auth-library';
import { ConfigService } from '../config/config.service';

export type GmailSessionData = {
  state?: string;
  tokens?: Credentials;
  expiresAt: number;
};

type StoredTokens = {
  iv: string;
  tag: string;
  data: string;
};

@Injectable()
export class GmailSessionStore {
  private readonly logger = new Logger(GmailSessionStore.name);
  private readonly db: Database.Database;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = this.resolveEncryptionKey();
    this.ensureDatabaseDirectory();
    this.db = new Database(this.configService.config.sessionDbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gmail_sessions (
        session_id TEXT PRIMARY KEY,
        state TEXT,
        tokens TEXT,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  getSession(sessionId: string): GmailSessionData | null {
    const row = this.db
      .prepare(
        'SELECT session_id, state, tokens, expires_at FROM gmail_sessions WHERE session_id = ?',
      )
      .get(sessionId) as
      | { state: string | null; tokens: string | null; expires_at: number }
      | undefined;
    if (!row) {
      return null;
    }
    if (row.expires_at <= Date.now()) {
      this.deleteSession(sessionId);
      return null;
    }
    let tokens: Credentials | undefined;
    if (row.tokens) {
      try {
        tokens = this.decryptTokens(row.tokens);
      } catch {
        this.deleteSession(sessionId);
        return null;
      }
    }
    return {
      state: row.state ?? undefined,
      tokens,
      expiresAt: row.expires_at,
    };
  }

  upsertSession(sessionId: string, session: GmailSessionData): void {
    const tokens = session.tokens ? this.encryptTokens(session.tokens) : null;
    this.db
      .prepare(
        `
        INSERT INTO gmail_sessions (session_id, state, tokens, expires_at)
        VALUES (@sessionId, @state, @tokens, @expiresAt)
        ON CONFLICT(session_id)
        DO UPDATE SET state = @state, tokens = @tokens, expires_at = @expiresAt
      `,
      )
      .run({
        sessionId,
        state: session.state ?? null,
        tokens,
        expiresAt: session.expiresAt,
      });
  }

  deleteSession(sessionId: string): void {
    this.db
      .prepare('DELETE FROM gmail_sessions WHERE session_id = ?')
      .run(sessionId);
  }

  private ensureDatabaseDirectory(): void {
    const dir = path.dirname(this.configService.config.sessionDbPath);
    mkdirSync(dir, { recursive: true });
  }

  private resolveEncryptionKey(): Buffer {
    const raw = this.configService.config.sessionEncryptionKey;
    if (!raw) {
      if (this.isTestEnv()) {
        this.logger.warn(
          'SESSION_ENCRYPTION_KEY manquant en test. Clé éphémère utilisée.',
        );
        return randomBytes(32);
      }
      throw new Error('SESSION_ENCRYPTION_KEY manquant.');
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'SESSION_ENCRYPTION_KEY invalide. Utilisez une clé de 32 octets (base64 ou hex).',
      );
    }
    return key;
  }

  private isTestEnv(): boolean {
    return (
      process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)
    );
  }

  private encryptTokens(tokens: Credentials): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const payload = Buffer.from(JSON.stringify(tokens), 'utf8');
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    const stored: StoredTokens = {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };
    return JSON.stringify(stored);
  }

  private decryptTokens(payload: string): Credentials {
    try {
      const parsed = JSON.parse(payload) as StoredTokens;
      const iv = Buffer.from(parsed.iv, 'base64');
      const tag = Buffer.from(parsed.tag, 'base64');
      const data = Buffer.from(parsed.data, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final(),
      ]);
      return JSON.parse(decrypted.toString('utf8')) as Credentials;
    } catch (error) {
      const details =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : 'Erreur inconnue';
      this.logger.warn(`Impossible de déchiffrer les tokens OAuth: ${details}`);
      throw new Error('Tokens OAuth illisibles.');
    }
  }
}
