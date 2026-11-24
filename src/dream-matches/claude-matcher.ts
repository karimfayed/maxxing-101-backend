import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { ApiError } from '../api-error';
import { CATEGORY_IDS, DREAM_IDS } from './catalog';
import { SYSTEM_PROMPT, userMessage } from './claude-prompt';
import { NOTES, VERDICTS, type ClaudeAnswer } from './match-rules';

/** Sorts what a person typed. Throws a 503 ApiError when it can't. */
export interface DreamMatcher {
  ask(text: string): Promise<ClaudeAnswer>;
}

const MAX_TOKENS = 2048;
const TIMEOUT_MS = 5_000;

const AnswerSchema = z.object({
  verdict: z.enum(VERDICTS),
  categoryIds: z.array(z.enum(CATEGORY_IDS)),
  exactDreamIds: z.array(z.enum(DREAM_IDS)),
  closestDreamIds: z.array(z.enum(DREAM_IDS)),
  notes: z.array(z.enum(NOTES)),
});

export class ClaudeMatcher implements DreamMatcher {
  private readonly logger = new Logger(ClaudeMatcher.name);

  /** @param client null when there is no API key: every question is then unavailable. */
  constructor(
    private readonly client: Anthropic | null,
    private readonly model: string,
    private readonly timeoutMs: number = TIMEOUT_MS,
  ) {}

  async ask(text: string): Promise<ClaudeAnswer> {
    if (this.client === null) throw new ApiError(503, 'match_unavailable');
    try {
      const message = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: MAX_TOKENS,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage(text) }],
          output_config: { effort: 'low', format: betaZodOutputFormat(AnswerSchema) },
        },
        { maxRetries: 0, timeout: this.timeoutMs, signal: AbortSignal.timeout(this.timeoutMs) },
      );
      if (message.stop_reason === 'end_turn' && message.parsed_output !== null) return message.parsed_output;
      this.logger.warn(`Claude gave no answer: ${message.stop_reason}`);
    } catch (error) {
      this.logger.warn(`Claude failed: ${describe(error)}`);
    }
    throw new ApiError(503, 'match_unavailable');
  }
}

/** The kind of error only: its message may quote what the person typed. */
function describe(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `${error.constructor.name} ${error.status ?? ''}`.trim();
  return error instanceof Error ? error.constructor.name : 'unknown error';
}
