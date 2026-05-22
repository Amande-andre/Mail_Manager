import { ApiController } from './api/api.controller';
import type { ConfigService } from './config/config.service';
import type { GmailAuthService } from './gmail/gmail-auth.service';
import type { GmailService } from './gmail/gmail.service';
import type { AiService } from './ai/ai.service';

describe('ApiController', () => {
  it('should return health status', () => {
    const controller = new ApiController(
      {} as ConfigService,
      {} as GmailService,
      {} as GmailAuthService,
      {} as AiService,
    );

    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
