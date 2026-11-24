import { z } from 'zod';
import { ApiError } from '../api-error';
import { CATEGORY_IDS, type CategoryId } from './catalog';

export interface DreamMatchRequest {
  text: string;
  /** The category the words were typed under, if any. */
  area: CategoryId | null;
}

const MAX_CHARACTERS = 200;

const RequestSchema = z.strictObject({
  text: z.string().trim().refine(isVisible).refine(isShortEnough),
  area: z.enum(CATEGORY_IDS).nullable(),
});

export function parseRequest(body: unknown): DreamMatchRequest {
  const result = RequestSchema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'invalid_request');
  return result.data;
}

/** Invisible characters stay in the text, because Arabic and emoji use them, but don't count as text. */
function isVisible(text: string): boolean {
  return text.replace(/\p{Cf}/gu, '').trim() !== '';
}

/** Counts whole characters, so an emoji is one and not two. */
function isShortEnough(text: string): boolean {
  return [...text].length <= MAX_CHARACTERS;
}
