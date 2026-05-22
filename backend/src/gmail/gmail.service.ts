import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '../config/config.service';
import type { EmailItem } from '../shared/types';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

type OAuthCredentials = {
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
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async listEmails(
    query: string | undefined,
    maxResults: number,
  ): Promise<EmailItem[]> {
    const service = await this.getService();
    const response = await service.users.messages.list({
      userId: this.configService.config.gmailUserId,
      q: query || undefined,
      maxResults,
    });

    const messages = (response.data.messages ?? []).filter(
      (message) => Boolean(message.id),
    );
    if (messages.length === 0) {
      return [];
    }

    const details = await Promise.all(
      messages.map((message) =>
        service.users.messages.get({
          userId: this.configService.config.gmailUserId,
          id: message.id as string,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        }),
      ),
    );

    return details.map((detail) => {
      const headers = detail.data.payload?.headers ?? [];
      return {
        id: detail.data.id ?? '',
        threadId: detail.data.threadId ?? null,
        sender: this.extractHeaderValue(headers, 'From'),
        subject: this.extractHeaderValue(headers, 'Subject'),
        date: this.extractHeaderValue(headers, 'Date'),
        snippet: detail.data.snippet ?? '',
      };
    });
  }

  private async getService(): Promise<gmail_v1.Gmail> {
    const auth = await this.getAuthorizedClient();
    return google.gmail({ version: 'v1', auth });
  }

  private async getAuthorizedClient(): Promise<OAuth2Client> {
    const credentials = await this.loadJsonFile<OAuthCredentials>(
      this.configService.config.gmailCredentialsPath,
      'credentials.json introuvable. Placez-le à la racine du backend ou définissez GMAIL_CREDENTIALS_PATH.',
    );

    const source = credentials.installed ?? credentials.web;
    if (!source?.client_id || !source.client_secret) {
      throw new BadRequestException('credentials.json invalide ou incomplet.');
    }

    const auth = new google.auth.OAuth2(
      source.client_id,
      source.client_secret,
      source.redirect_uris?.[0],
    );

    const token = await this.loadJsonFile<Record<string, unknown>>(
      this.configService.config.gmailTokenPath,
      'Token Gmail manquant ou invalide. Générez token.json via OAuth avant de continuer.',
    );

    auth.setCredentials(token);

    try {
      const accessToken = await auth.getAccessToken();
      if (!accessToken?.token) {
        throw new Error('Token Gmail absent');
      }
    } catch (error) {
      this.logger.warn('Échec de rafraîchissement du token Gmail', error as Error);
      throw new BadRequestException(
        'Token Gmail manquant ou invalide. Générez token.json via OAuth avant de continuer.',
      );
    }

    await this.persistToken(auth);

    return auth;
  }

  private async loadJsonFile<T>(filePath: string, notFoundMessage: string): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BadRequestException(notFoundMessage);
      }
      throw new BadRequestException(`Impossible de lire ${filePath}.`);
    }
  }

  private async persistToken(auth: OAuth2Client): Promise<void> {
    if (!auth.credentials || Object.keys(auth.credentials).length === 0) {
      return;
    }
    try {
      await fs.writeFile(
        this.configService.config.gmailTokenPath,
        JSON.stringify(auth.credentials, null, 2),
      );
    } catch (error) {
      this.logger.warn('Impossible de sauvegarder le token Gmail', error as Error);
    }
  }

  private extractHeaderValue(
    headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
    name: string,
  ): string {
    if (!headers) {
      return '';
    }
    const header = headers.find(
      (item) => item.name?.toLowerCase() === name.toLowerCase(),
    );
    return header?.value ?? '';
  }
}
