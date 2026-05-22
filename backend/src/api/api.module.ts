import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [ConfigModule, GmailModule, AiModule],
  controllers: [ApiController],
})
export class ApiModule {}
