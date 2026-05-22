import { Injectable } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '../config/config.service';
import type { EmailItem } from '../shared/types';

@Injectable()
export class GmailService {
  constructor(private readonly configService: ConfigService) {}

  async listEmails(
    auth: OAuth2Client,
    query: string | undefined,
    maxResults: number,
  ): Promise<EmailItem[]> {
    const service = google.gmail({ version: 'v1', auth });
    const response = await service.users.messages.list({
      userId: this.configService.config.gmailUserId,
      q: query || undefined,
      maxResults,
    });

    const messages = (response.data.messages ?? []).filter((message) =>
      Boolean(message.id),
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
