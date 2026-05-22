import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { GmailService } from '../gmail/gmail.service';
import type { EmailItem, FilterSortRequest } from '../shared/types';

@Controller()
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
    private readonly aiService: AiService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('config')
  getConfig() {
    return this.configService.getSummary();
  }

  @Get('emails')
  async getEmails(
    @Query('query') query?: string,
    @Query('max_results') maxResults?: string,
  ) {
    const max = this.configService.resolveMaxResults(maxResults);
    try {
      const emails = await this.gmailService.listEmails(query, max);
      return { emails };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur Gmail inattendue', error as Error);
      throw new InternalServerErrorException(
        'Erreur Gmail inattendue. Consultez les logs.',
      );
    }
  }

  @Post('ai/filter-sort')
  async filterSort(@Body() payload: Partial<FilterSortRequest>) {
    const instructions = this.normalizeInstructions(payload?.instructions);
    const emails = this.normalizeEmails(payload?.emails);
    try {
      return await this.aiService.filterAndSortEmails(emails, instructions);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur IA inattendue', error as Error);
      throw new InternalServerErrorException(
        'Erreur IA inattendue. Consultez les logs.',
      );
    }
  }

  private normalizeInstructions(instructions: unknown): string {
    if (typeof instructions !== 'string' || instructions.trim().length === 0) {
      throw new BadRequestException('Instructions IA manquantes.');
    }
    return instructions.trim();
  }

  private normalizeEmails(emails: unknown): EmailItem[] {
    if (!Array.isArray(emails)) {
      throw new BadRequestException('Liste d’emails invalide.');
    }
    return emails.map((email, index) => {
      if (!email || typeof email !== 'object') {
        throw new BadRequestException(`Email invalide à l’index ${index}.`);
      }
      const data = email as Record<string, unknown>;
      const id = typeof data.id === 'string' ? data.id.trim() : '';
      if (!id) {
        throw new BadRequestException(`Email id manquant à l’index ${index}.`);
      }
      return {
        id,
        threadId: typeof data.threadId === 'string' ? data.threadId : null,
        sender: typeof data.sender === 'string' ? data.sender : '',
        subject: typeof data.subject === 'string' ? data.subject : '',
        date: typeof data.date === 'string' ? data.date : '',
        snippet: typeof data.snippet === 'string' ? data.snippet : '',
      };
    });
  }
}
