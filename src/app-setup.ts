import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiErrorFilter } from './api-error';
import type { AppConfig } from './config';

/** Sets up an app created with `bodyParser: false`. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  // Which forwarded address to believe decides whose rate limit a request counts towards.
  app.set('trust proxy', config.trustProxyHops);
  app.useBodyParser('json', { limit: '4kb' });
  app.useGlobalFilters(new ApiErrorFilter());
}
