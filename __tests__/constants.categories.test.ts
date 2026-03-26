import { CATEGORIES, KEYWORD_CATEGORY_MAP, Category } from '../constants/categories';

describe('CATEGORIES', () => {
  it('contains all required categories', () => {
    const required: Category[] = [
      'Food & Drink', 'Transportation', 'Subscriptions',
      'Housing', 'Groceries', 'Health', 'Fitness', 'Uncategorized',
    ];
    for (const cat of required) {
      expect(CATEGORIES).toContain(cat);
    }
  });

  it('has no duplicate entries', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });
});

describe('KEYWORD_CATEGORY_MAP', () => {
  it('maps known Food & Drink keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['coffee']).toBe('Food & Drink');
    expect(KEYWORD_CATEGORY_MAP['starbucks']).toBe('Food & Drink');
    expect(KEYWORD_CATEGORY_MAP['latte']).toBe('Food & Drink');
    expect(KEYWORD_CATEGORY_MAP['tim hortons']).toBe('Food & Drink');
  });

  it('maps known Transportation keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['uber']).toBe('Transportation');
    expect(KEYWORD_CATEGORY_MAP['gas']).toBe('Transportation');
    expect(KEYWORD_CATEGORY_MAP['parking']).toBe('Transportation');
    expect(KEYWORD_CATEGORY_MAP['skytrain']).toBe('Transportation');
  });

  it('maps known Subscriptions keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['netflix']).toBe('Subscriptions');
    expect(KEYWORD_CATEGORY_MAP['spotify']).toBe('Subscriptions');
    expect(KEYWORD_CATEGORY_MAP['disney']).toBe('Subscriptions');
  });

  it('maps known Housing keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['rent']).toBe('Housing');
    expect(KEYWORD_CATEGORY_MAP['mortgage']).toBe('Housing');
  });

  it('maps known Groceries keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['walmart']).toBe('Groceries');
    expect(KEYWORD_CATEGORY_MAP['costco']).toBe('Groceries');
    expect(KEYWORD_CATEGORY_MAP['groceries']).toBe('Groceries');
  });

  it('maps known Health keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['pharmacy']).toBe('Health');
    expect(KEYWORD_CATEGORY_MAP['doctor']).toBe('Health');
  });

  it('maps known Fitness keywords correctly', () => {
    expect(KEYWORD_CATEGORY_MAP['gym']).toBe('Fitness');
    expect(KEYWORD_CATEGORY_MAP['yoga']).toBe('Fitness');
  });

  it('all mapped categories exist in CATEGORIES list', () => {
    for (const [keyword, category] of Object.entries(KEYWORD_CATEGORY_MAP)) {
      expect(CATEGORIES).toContain(category);
    }
  });

  it('returns undefined for unknown keywords', () => {
    expect(KEYWORD_CATEGORY_MAP['unknown_merchant_xyz']).toBeUndefined();
  });
});
