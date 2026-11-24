import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CategoryId } from './catalog';
import { decideMatch, type ClaudeAnswer, type DreamMatch } from './match-rules';

function answer(parts: Partial<ClaudeAnswer>): ClaudeAnswer {
  return { verdict: 'goal', categoryIds: [], exactDreamIds: [], closestDreamIds: [], notes: [], ...parts };
}

function match(parts: Partial<DreamMatch> & Pick<DreamMatch, 'kind'>): DreamMatch {
  return {
    categoryId: null,
    fitsArea: null,
    dreamId: null,
    closestDreamId: null,
    alternativeDreamIds: [],
    notes: [],
    ...parts,
  };
}

const CASES: [name: string, answer: ClaudeAnswer, area: CategoryId | null, expected: DreamMatch][] = [
  [
    'a goal from another category says which one',
    answer({ categoryIds: ['skill'] }),
    'fitness',
    match({ kind: 'no_plan', categoryId: 'skill', fitsArea: false }),
  ],
  [
    'with no area there is nothing to fit',
    answer({ categoryIds: ['skill'] }),
    null,
    match({ kind: 'no_plan', categoryId: 'skill' }),
  ],
  ['a goal that fits no category', answer({}), 'fitness', match({ kind: 'no_plan', fitsArea: false })],
  [
    'an exact dream in the area',
    answer({ categoryIds: ['fitness'], exactDreamIds: ['run'] }),
    'fitness',
    match({
      kind: 'matched',
      categoryId: 'fitness',
      fitsArea: true,
      dreamId: 'run',
      alternativeDreamIds: ['gentle'],
    }),
  ],
  [
    'a plan in another fitting category beats no plan in the area',
    answer({ categoryIds: ['business', 'create'], exactDreamIds: ['sell'] }),
    'create',
    match({
      kind: 'matched',
      categoryId: 'business',
      fitsArea: true,
      dreamId: 'sell',
      alternativeDreamIds: ['cart', 'service'],
    }),
  ],
  [
    'the area wins between two exact dreams',
    answer({ categoryIds: ['fitness', 'money'], exactDreamIds: ['run', 'cushion'] }),
    'money',
    match({
      kind: 'matched',
      categoryId: 'money',
      fitsArea: true,
      dreamId: 'cushion',
      alternativeDreamIds: ['debt'],
    }),
  ],
  [
    'the first exact dream wins when the area does not fit',
    answer({ categoryIds: ['fitness', 'money'], exactDreamIds: ['run', 'cushion'] }),
    'skill',
    match({
      kind: 'matched',
      categoryId: 'fitness',
      fitsArea: false,
      dreamId: 'run',
      alternativeDreamIds: ['gentle'],
    }),
  ],
  [
    'an exact dream without a plan offers the first planned dream there',
    answer({ categoryIds: ['create'], exactDreamIds: ['write'] }),
    'create',
    match({ kind: 'no_plan', categoryId: 'create', fitsArea: true, dreamId: 'write', closestDreamId: 'film' }),
  ],
  [
    "Claude's closest dream and note are passed on",
    answer({ categoryIds: ['fitness'], closestDreamIds: ['gentle'], notes: ['health_check'] }),
    null,
    match({ kind: 'no_plan', categoryId: 'fitness', closestDreamId: 'gentle', notes: ['health_check'] }),
  ],
  [
    'the closest dream comes from the category that fits, not the area',
    answer({ categoryIds: ['business'], closestDreamIds: ['cart'] }),
    'skill',
    match({ kind: 'no_plan', categoryId: 'business', fitsArea: false, closestDreamId: 'cart' }),
  ],
  [
    'a closest dream without a plan is never offered',
    answer({ categoryIds: ['create'], closestDreamIds: ['make'] }),
    null,
    match({ kind: 'no_plan', categoryId: 'create' }),
  ],
  [
    'an exact dream outside the listed categories is dropped',
    answer({ categoryIds: ['skill'], exactDreamIds: ['run'] }),
    'skill',
    match({ kind: 'no_plan', categoryId: 'skill', fitsArea: true }),
  ],
  [
    'an exact dream with no category at all is dropped',
    answer({ exactDreamIds: ['run'] }),
    null,
    match({ kind: 'no_plan' }),
  ],
  [
    'vague words with no area get the usual three',
    answer({ verdict: 'unclear' }),
    null,
    match({ kind: 'unclear', alternativeDreamIds: ['english', 'gentle', 'cushion'] }),
  ],
  [
    "vague words get the area's dreams first",
    answer({ verdict: 'unclear' }),
    'faith',
    match({ kind: 'unclear', alternativeDreamIds: ['faith', 'english', 'gentle'] }),
  ],
  [
    'vague words never get the same dream twice',
    answer({ verdict: 'unclear' }),
    'fitness',
    match({ kind: 'unclear', alternativeDreamIds: ['run', 'gentle', 'english'] }),
  ],
  [
    'weight loss keeps its note on the match',
    answer({ categoryIds: ['fitness'], exactDreamIds: ['gentle'], notes: ['weight_loss'] }),
    'fitness',
    match({
      kind: 'matched',
      categoryId: 'fitness',
      fitsArea: true,
      dreamId: 'gentle',
      alternativeDreamIds: ['run'],
      notes: ['weight_loss'],
    }),
  ],
  [
    'a fourth category is ignored',
    answer({ categoryIds: ['business', 'skill', 'fitness', 'money'], exactDreamIds: ['cushion'] }),
    'money',
    match({ kind: 'no_plan', categoryId: 'business', fitsArea: false }),
  ],
  [
    'repeated ids do not push others out',
    answer({
      categoryIds: ['skill', 'skill', 'skill', 'money'],
      exactDreamIds: ['cushion', 'cushion'],
      notes: ['weight_loss', 'weight_loss'],
    }),
    'money',
    match({
      kind: 'matched',
      categoryId: 'money',
      fitsArea: true,
      dreamId: 'cushion',
      alternativeDreamIds: ['debt'],
      notes: ['weight_loss'],
    }),
  ],
];

for (const [name, input, area, expected] of CASES) {
  test(name, () => {
    const before = structuredClone(input);
    assert.deepEqual(decideMatch(input, area), expected);
    assert.deepEqual(input, before);
  });
}

for (const verdict of ['out_of_scope', 'not_supported', 'crisis'] as const) {
  test(`${verdict} never carries a plan, category or note`, () => {
    const input = answer({ verdict, categoryIds: ['fitness'], exactDreamIds: ['run'], notes: ['weight_loss'] });
    assert.deepEqual(decideMatch(input, 'fitness'), match({ kind: verdict }));
  });
}
