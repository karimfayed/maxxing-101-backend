import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../api-error';
import type { DreamMatcher } from './claude-matcher';
import { DailyCap } from './daily-cap';
import type { DreamMatchRequest } from './dream-matches.request';
import { decideMatch, type DreamMatch } from './match-rules';

export const DREAM_MATCHER = Symbol('DREAM_MATCHER');

@Injectable()
export class DreamMatchesService {
  constructor(
    @Inject(DREAM_MATCHER) private readonly matcher: DreamMatcher,
    private readonly dailyCap: DailyCap,
  ) {}

  async match({ text, area }: DreamMatchRequest): Promise<DreamMatch> {
    if (!this.dailyCap.tryTake()) throw new ApiError(503, 'match_unavailable');
    return decideMatch(await this.matcher.ask(text), area);
  }
}
