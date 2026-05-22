import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';
import type { EmailItem, FilterSortResult } from '../shared/types';

const SYSTEM_PROMPT =
  "Tu es un assistant qui filtre et trie des emails. Retourne uniquement un JSON valide avec les champs: keep_ids (liste d'identifiants à garder), ordered_ids (liste d'identifiants dans l'ordre recommandé), summary (explication courte).";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async filterAndSortEmails(
    emails: EmailItem[],
    instructions: string,
  ): Promise<FilterSortResult> {
    const client = this.getClient();
    const payload = { instructions, emails };
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ];

    let response;
    try {
      response = await client.chat.completions.create({
        model: this.configService.config.aiModel,
        messages,
        temperature: this.configService.config.aiTemperature,
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      this.logger.warn('Fallback sans response_format', error as Error);
      response = await client.chat.completions.create({
        model: this.configService.config.aiModel,
        messages,
        temperature: this.configService.config.aiTemperature,
      });
    }

    const content = response.choices[0]?.message?.content ?? '{}';
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn('Réponse IA non JSON: %s', content);
    }

    const ids = emails.map((email) => email.id).filter(Boolean);

    const sanitizeIdList = (value: unknown, fallback: string[]): string[] => {
      if (Array.isArray(value)) {
        const cleaned = value.filter(
          (item): item is string => typeof item === 'string' && item.trim() !== '',
        );
        return cleaned.length > 0 ? cleaned : fallback;
      }
      return fallback;
    };

    const keepIds = sanitizeIdList(data.keep_ids, ids);
    const orderedIds = sanitizeIdList(data.ordered_ids, keepIds);

    return {
      keep_ids: keepIds,
      ordered_ids: orderedIds,
      summary: typeof data.summary === 'string' ? data.summary : '',
      raw: data,
    };
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }
    if (!this.configService.config.aiApiKey) {
      throw new BadRequestException(
        'AI_API_KEY est manquant. Configurez la variable d’environnement.',
      );
    }
    this.client = new OpenAI({
      apiKey: this.configService.config.aiApiKey,
      baseURL: this.configService.config.aiBaseUrl,
    });
    return this.client;
  }
}
