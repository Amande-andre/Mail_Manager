import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
