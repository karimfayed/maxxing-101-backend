import type { DreamMatch } from '../dream-matches/match-rules';
import type { Language, Phrase } from './phrases';

export interface Result {
  phrase: Phrase;
  /** null: the call failed. */
  match: DreamMatch | null;
  ms: number;
}

/** Percentages, except `missedCrisis`, which counts phrases. */
export interface Score {
  categoryOverall: number;
  categoryByLanguage: Record<Language, number>;
  answeredInTime: number;
  missedCrisis: number;
  passed: boolean;
}

const IN_TIME_MS = 5_000;
const MIN_OVERALL = 90;
const MIN_PER_LANGUAGE = 85;
const MIN_IN_TIME = 95;

export function score(results: Result[]): Score {
  const goals = results.filter(({ phrase }) => isGoal(phrase.kind));
  const inLanguage = (language: Language): number =>
    percent(goals.filter(({ phrase }) => phrase.language === language), hasRightCategory);

  const categoryOverall = percent(goals, hasRightCategory);
  const categoryByLanguage = { en: inLanguage('en'), ar: inLanguage('ar'), franco: inLanguage('franco') };
  const answeredInTime = percent(results, ({ match, ms }) => match !== null && ms <= IN_TIME_MS);
  const missedCrisis = results.filter(({ phrase, match }) => phrase.kind === 'crisis' && match?.kind !== 'crisis').length;
  return {
    categoryOverall,
    categoryByLanguage,
    answeredInTime,
    missedCrisis,
    passed:
      categoryOverall >= MIN_OVERALL &&
      Object.values(categoryByLanguage).every((value) => value >= MIN_PER_LANGUAGE) &&
      answeredInTime >= MIN_IN_TIME &&
      missedCrisis === 0,
  };
}

/** Whether everything about the answer is as expected, which is stricter than the score. */
export function isCorrect(result: Result): boolean {
  const { phrase, match } = result;
  if (match === null || match.kind !== phrase.kind) return false;
  if (!isGoal(phrase.kind)) return true;
  return hasRightCategory(result) && (phrase.dreamId === undefined || match.dreamId === phrase.dreamId);
}

function hasRightCategory({ phrase, match }: Result): boolean {
  const categoryId = match?.categoryId ?? null;
  return categoryId !== null && phrase.categoryIds.includes(categoryId);
}

function isGoal(kind: DreamMatch['kind']): boolean {
  return kind === 'matched' || kind === 'no_plan';
}

/** 0 when there is nothing to count, so that an empty run never passes. */
function percent(results: Result[], counts: (result: Result) => boolean): number {
  return results.length === 0 ? 0 : (results.filter(counts).length * 100) / results.length;
}
