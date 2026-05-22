import { Injectable } from '@nestjs/common';
import { appConfig, configSummary, type AppConfig } from './app-config';

@Injectable()
export class ConfigService {
  get config(): AppConfig {
    return appConfig;
  }

  getSummary() {
    return configSummary();
  }

  resolveMaxResults(value: string | undefined): number {
    if (!value) {
      return appConfig.maxEmailsDefault;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return appConfig.maxEmailsDefault;
    }
    return Math.min(Math.floor(parsed), appConfig.maxEmailsLimit);
  }
}
