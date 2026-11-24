import { CATALOG, categoryOf, plannedDreams, type CategoryId, type DreamId } from './catalog';

export const VERDICTS = ['goal', 'unclear', 'out_of_scope', 'not_supported', 'crisis'] as const;
export const NOTES = ['weight_loss', 'health_check'] as const;

export type Verdict = (typeof VERDICTS)[number];
export type Note = (typeof NOTES)[number];

/** What Claude made of the words, without knowing which area they were typed under. Lists are best first. */
export interface ClaudeAnswer {
  verdict: Verdict;
  categoryIds: CategoryId[];
  exactDreamIds: DreamId[];
  closestDreamIds: DreamId[];
  notes: Note[];
}

export interface DreamMatch {
  kind: 'matched' | 'no_plan' | 'unclear' | 'out_of_scope' | 'not_supported' | 'crisis';
  categoryId: CategoryId | null;
  /** Whether the chosen area is one of the categories that fit; null when there is nothing to compare. */
  fitsArea: boolean | null;
  dreamId: DreamId | null;
  closestDreamId: DreamId | null;
  alternativeDreamIds: DreamId[];
  notes: Note[];
}

const MAX_IDS = 3;

/** Offered for words too vague to place, after the area's own dreams. */
const USUAL_OPTIONS: readonly DreamId[] = ['english', 'gentle', 'cushion'];

export function decideMatch(answer: ClaudeAnswer, area: CategoryId | null): DreamMatch {
  switch (answer.verdict) {
    case 'goal':
      return decideGoal(answer, area);
    case 'unclear':
      return emptyMatch('unclear', {
        alternativeDreamIds: firstUnique([...(area === null ? [] : plannedDreams(area)), ...USUAL_OPTIONS]),
      });
    default:
      return emptyMatch(answer.verdict);
  }
}

function decideGoal(answer: ClaudeAnswer, area: CategoryId | null): DreamMatch {
  const categoryIds = firstUnique(answer.categoryIds);
  const fitsArea = area === null ? null : categoryIds.includes(area);
  const notes = firstUnique(answer.notes);
  const exact = answer.exactDreamIds.filter((id) => categoryIds.includes(categoryOf(id)));
  const closest = answer.closestDreamIds.filter((id) => categoryIds.includes(categoryOf(id)));

  const planned = exact.filter(hasPlan);
  const dreamId = planned.find((id) => categoryOf(id) === area) ?? planned[0];
  if (dreamId !== undefined) {
    const categoryId = categoryOf(dreamId);
    const alternativeDreamIds = plannedDreams(categoryId).filter((id) => id !== dreamId);
    return emptyMatch('matched', { categoryId, fitsArea, dreamId, alternativeDreamIds, notes });
  }

  const categoryId = (fitsArea ? area : categoryIds[0]) ?? null;
  const inCategory = (id: DreamId): boolean => categoryOf(id) === categoryId;
  const unplannedId = exact.find(inCategory) ?? null;
  const fallbackId = unplannedId === null || categoryId === null ? undefined : plannedDreams(categoryId)[0];
  const closestDreamId = closest.find((id) => inCategory(id) && hasPlan(id)) ?? fallbackId ?? null;
  return emptyMatch('no_plan', { categoryId, fitsArea, dreamId: unplannedId, closestDreamId, notes });
}

function emptyMatch(kind: DreamMatch['kind'], parts: Partial<DreamMatch> = {}): DreamMatch {
  return {
    kind,
    categoryId: null,
    fitsArea: null,
    dreamId: null,
    closestDreamId: null,
    alternativeDreamIds: [],
    notes: [],
    ...parts,
  };
}

function hasPlan(id: DreamId): boolean {
  return CATALOG.some((category) => category.dreams.some((dream) => dream.id === id && dream.hasPlan));
}

function firstUnique<T>(ids: readonly T[]): T[] {
  return [...new Set(ids)].slice(0, MAX_IDS);
}
