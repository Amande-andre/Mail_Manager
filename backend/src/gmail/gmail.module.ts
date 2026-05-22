import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { ConfigModule } from '../config/config.module';
import { GmailAuthService } from './gmail-auth.service';
import { GmailSessionStore } from './gmail-session.store';

@Module({
  imports: [ConfigModule],
  providers: [GmailService, GmailAuthService, GmailSessionStore],
  exports: [GmailService, GmailAuthService],
})
export class GmailModule {}
