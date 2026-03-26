export type Category =
  | 'Food & Drink'
  | 'Transportation'
  | 'Subscriptions'
  | 'Housing'
  | 'Groceries'
  | 'Health'
  | 'Fitness'
  | 'Uncategorized';

export const CATEGORIES: Category[] = [
  'Food & Drink',
  'Transportation',
  'Subscriptions',
  'Housing',
  'Groceries',
  'Health',
  'Fitness',
  'Uncategorized',
];

export const KEYWORD_CATEGORY_MAP: Record<string, Category> = {
  coffee: 'Food & Drink',
  latte: 'Food & Drink',
  'tim hortons': 'Food & Drink',
  starbucks: 'Food & Drink',
  cafe: 'Food & Drink',
  restaurant: 'Food & Drink',
  pizza: 'Food & Drink',
  sushi: 'Food & Drink',
  burger: 'Food & Drink',
  uber: 'Transportation',
  lyft: 'Transportation',
  gas: 'Transportation',
  transit: 'Transportation',
  parking: 'Transportation',
  skytrain: 'Transportation',
  bus: 'Transportation',
  taxi: 'Transportation',
  netflix: 'Subscriptions',
  spotify: 'Subscriptions',
  disney: 'Subscriptions',
  subscription: 'Subscriptions',
  'apple music': 'Subscriptions',
  rent: 'Housing',
  mortgage: 'Housing',
  strata: 'Housing',
  hydro: 'Housing',
  utilities: 'Housing',
  groceries: 'Groceries',
  walmart: 'Groceries',
  costco: 'Groceries',
  superstore: 'Groceries',
  'save-on': 'Groceries',
  safeway: 'Groceries',
  'no frills': 'Groceries',
  doctor: 'Health',
  pharmacy: 'Health',
  prescription: 'Health',
  shoppers: 'Health',
  dentist: 'Health',
  clinic: 'Health',
  gym: 'Fitness',
  fitness: 'Fitness',
  yoga: 'Fitness',
  crossfit: 'Fitness',
};
