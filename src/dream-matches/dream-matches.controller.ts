import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { parseRequest } from './dream-matches.request';
import { DreamMatchesService } from './dream-matches.service';
import type { DreamMatch } from './match-rules';

@Controller('v1/dream-matches')
@UseGuards(ThrottlerGuard)
export class DreamMatchesController {
  constructor(private readonly dreamMatches: DreamMatchesService) {}

  @Post()
  @HttpCode(200)
  match(@Body() body: unknown): Promise<DreamMatch> {
    return this.dreamMatches.match(parseRequest(body));
  }
}
