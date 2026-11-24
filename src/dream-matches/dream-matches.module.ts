import Anthropic from '@anthropic-ai/sdk';
import { Logger, Module, type DynamicModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { AppConfig } from '../config';
import { ClaudeMatcher } from './claude-matcher';
import { DailyCap } from './daily-cap';
import { DreamMatchesController } from './dream-matches.controller';
import { DREAM_MATCHER, DreamMatchesService } from './dream-matches.service';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

@Module({})
export class DreamMatchesModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: DreamMatchesModule,
      imports: [
        ThrottlerModule.forRoot([
          { name: 'minute', ttl: MINUTE_MS, limit: config.requestsPerMinute },
          { name: 'day', ttl: DAY_MS, limit: config.requestsPerDay },
        ]),
      ],
      controllers: [DreamMatchesController],
      providers: [
        DreamMatchesService,
        { provide: DailyCap, useFactory: () => new DailyCap(config.claudeCallsPerDay) },
        { provide: DREAM_MATCHER, useFactory: () => createMatcher(config) },
      ],
    };
  }
}

export function createMatcher(config: AppConfig): ClaudeMatcher {
  const { anthropicApiKey: apiKey, claudeModel } = config;
  if (apiKey === null) {
    new Logger(DreamMatchesModule.name).warn(
      'ANTHROPIC_API_KEY is not set: every dream match will be unavailable',
    );
    // No client at all: the SDK would otherwise look for other Claude credentials on the machine.
    return new ClaudeMatcher(null, claudeModel);
  }
  // Set here so the machine's ANTHROPIC_LOG and ANTHROPIC_BASE_URL can neither print the words nor redirect them.
  const client = new Anthropic({
    apiKey,
    authToken: null,
    baseURL: 'https://api.anthropic.com',
    logLevel: 'off',
  });
  return new ClaudeMatcher(client, claudeModel);
}
