import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { ConfigModule } from '../config/config.module';
import { GmailAuthService } from './gmail-auth.service';

@Module({
  imports: [ConfigModule],
  providers: [GmailService, GmailAuthService],
  exports: [GmailService, GmailAuthService],
})
export class GmailModule {}
