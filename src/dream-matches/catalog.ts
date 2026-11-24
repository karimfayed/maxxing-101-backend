/** Ids are permanent and never reused: older versions of the app keep sending and receiving them. */
export const CATEGORY_IDS = ['business', 'skill', 'fitness', 'faith', 'create', 'money'] as const;

export const DREAM_IDS = [
  'sell',
  'cart',
  'service',
  'product',
  'english',
  'code',
  'tool',
  'run',
  'gentle',
  'faith',
  'film',
  'write',
  'make',
  'cushion',
  'debt',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type DreamId = (typeof DREAM_IDS)[number];

export interface Dream {
  id: DreamId;
  label: string;
  /** Whether the app has a reviewed plan for it. */
  hasPlan: boolean;
}

export interface Category {
  id: CategoryId;
  name: string;
  /** What belongs here, for Claude. */
  description: string;
  dreams: readonly Dream[];
}

/** Copied from the mobile app's PathCatalog.kt, in its order within each category. */
export const CATALOG: readonly Category[] = [
  {
    id: 'business',
    name: 'Build a business',
    description: 'Earning money by selling goods or services of your own: a shop, a cart, freelancing, a product.',
    dreams: [
      { id: 'sell', label: 'Sell online', hasPlan: true },
      { id: 'cart', label: 'Open a cart or stall', hasPlan: true },
      { id: 'service', label: 'Offer a service', hasPlan: true },
      { id: 'product', label: 'Make a physical product', hasPlan: false },
    ],
  },
  {
    id: 'skill',
    name: 'Learn a skill',
    description: 'Learning to do something: a language, coding, a work tool, an instrument, driving, studying.',
    dreams: [
      { id: 'english', label: 'Speak English for work', hasPlan: true },
      { id: 'code', label: 'Learn to code', hasPlan: true },
      { id: 'tool', label: 'Master a work tool', hasPlan: true },
    ],
  },
  {
    id: 'fitness',
    name: 'Get fit',
    description: 'Moving, training, sport and healthier everyday habits such as sleep, food and quitting smoking.',
    dreams: [
      { id: 'run', label: 'Run my first 10K', hasPlan: true },
      { id: 'gentle', label: 'Get moving, gently', hasPlan: true },
    ],
  },
  {
    id: 'faith',
    name: 'Grow in faith',
    description: 'Prayer, reading scripture, fasting, reflection and other religious or spiritual practice.',
    dreams: [{ id: 'faith', label: 'Grow in faith', hasPlan: true }],
  },
  {
    id: 'create',
    name: 'Create & make',
    description: 'Making and publishing creative work: videos, writing, music, art, crafts.',
    dreams: [
      { id: 'film', label: 'Post a video every week', hasPlan: true },
      { id: 'write', label: 'Write and publish', hasPlan: false },
      { id: 'make', label: 'Make & sell', hasPlan: false },
    ],
  },
  {
    id: 'money',
    name: 'Master money',
    description: 'Managing the money you have: saving, budgeting and paying off debt, but not investing or trading.',
    dreams: [
      { id: 'cushion', label: 'Build a money cushion', hasPlan: true },
      { id: 'debt', label: 'Clear my debts', hasPlan: true },
    ],
  },
];

const CATEGORY_OF_DREAM = new Map(
  CATALOG.flatMap((category) => category.dreams.map((dream) => [dream.id, category.id] as const)),
);

export function categoryOf(id: DreamId): CategoryId {
  const category = CATEGORY_OF_DREAM.get(id);
  if (category === undefined) throw new Error(`no category holds the dream ${id}`);
  return category;
}

/** The category's dreams that have a plan, in catalog order. */
export function plannedDreams(id: CategoryId): DreamId[] {
  const category = CATALOG.find((candidate) => candidate.id === id);
  return category?.dreams.filter((dream) => dream.hasPlan).map((dream) => dream.id) ?? [];
}
