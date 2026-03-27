import { parseExpense, ParsedExpense } from '../utils/nlpParser';

// ─── Empty / invalid input ────────────────────────────────────────────────────

describe('parseExpense — empty / invalid input', () => {
  it('returns null amount for empty string', () => {
    expect(parseExpense('').amount).toBeNull();
  });

  it('returns Uncategorized for empty string', () => {
    expect(parseExpense('').category).toBe('Uncategorized');
  });

  it('returns CAD as default currency for empty string', () => {
    expect(parseExpense('').currency).toBe('CAD');
  });

  it('returns empty merchant for empty string', () => {
    expect(parseExpense('').merchant).toBe('');
  });

  it('returns null amount when no number is found', () => {
    expect(parseExpense('coffee').amount).toBeNull();
  });
});

// ─── Amount extraction ────────────────────────────────────────────────────────

describe('parseExpense — amount extraction', () => {
  it('extracts integer amount', () => {
    expect(parseExpense('spent 45 on coffee').amount).toBe(45);
  });

  it('extracts decimal amount', () => {
    expect(parseExpense('paid 17.99 for Netflix').amount).toBe(17.99);
  });

  it('extracts amount with dollar sign prefix', () => {
    expect(parseExpense('$30 at the gas station').amount).toBe(30);
  });

  it('extracts first number when multiple numbers present', () => {
    expect(parseExpense('spent 20 on 5 coffees').amount).toBe(20);
  });

  it('extracts amount with two decimal places', () => {
    expect(parseExpense('paid 9.99 spotify').amount).toBe(9.99);
  });
});

// ─── Currency detection ───────────────────────────────────────────────────────

describe('parseExpense — currency detection', () => {
  it('defaults to CAD when no currency word is present', () => {
    expect(parseExpense('spent 20 on coffee').currency).toBe('CAD');
  });

  it('detects CAD from "dollars"', () => {
    expect(parseExpense('spent 45 dollars on coffee').currency).toBe('CAD');
  });

  it('detects CAD from "bucks"', () => {
    expect(parseExpense('paid 10 bucks').currency).toBe('CAD');
  });

  it('detects USD from "usd"', () => {
    expect(parseExpense('paid 30 usd for gas').currency).toBe('USD');
  });

  it('detects EUR from "euros"', () => {
    expect(parseExpense('spent 50 euros').currency).toBe('EUR');
  });

  it('detects GBP from "pounds"', () => {
    expect(parseExpense('paid 25 pounds').currency).toBe('GBP');
  });

  it('detects JPY from "yen"', () => {
    expect(parseExpense('1000 yen at restaurant').currency).toBe('JPY');
  });
});

// ─── Category detection ───────────────────────────────────────────────────────

describe('parseExpense — category detection', () => {
  it('categorizes coffee as Food & Drink', () => {
    expect(parseExpense('spent 5 on coffee').category).toBe('Food & Drink');
  });

  it('categorizes starbucks as Food & Drink', () => {
    expect(parseExpense('starbucks 6.50').category).toBe('Food & Drink');
  });

  it('categorizes netflix as Subscriptions', () => {
    expect(parseExpense('paid 17.99 netflix').category).toBe('Subscriptions');
  });

  it('categorizes spotify as Subscriptions', () => {
    expect(parseExpense('spotify 9.99').category).toBe('Subscriptions');
  });

  it('categorizes gas as Transportation', () => {
    expect(parseExpense('paid 60 for gas').category).toBe('Transportation');
  });

  it('categorizes uber as Transportation', () => {
    expect(parseExpense('uber 12').category).toBe('Transportation');
  });

  it('categorizes rent as Housing', () => {
    expect(parseExpense('rent 1800').category).toBe('Housing');
  });

  it('categorizes walmart as Groceries', () => {
    expect(parseExpense('walmart 95').category).toBe('Groceries');
  });

  it('categorizes gym as Fitness', () => {
    expect(parseExpense('gym membership 50').category).toBe('Fitness');
  });

  it('categorizes pharmacy as Health', () => {
    expect(parseExpense('pharmacy 20').category).toBe('Health');
  });

  it('returns Uncategorized when no keyword matches', () => {
    expect(parseExpense('paid 99 for something').category).toBe('Uncategorized');
  });

  it('detects multi-word keyword "tim hortons"', () => {
    expect(parseExpense('tim hortons 4.50').category).toBe('Food & Drink');
  });
});

// ─── Merchant extraction ──────────────────────────────────────────────────────

describe('parseExpense — merchant extraction', () => {
  it('extracts merchant from simple phrase', () => {
    expect(parseExpense('netflix 17.99').merchant).toBe('Netflix');
  });

  it('filters out filler words', () => {
    const result = parseExpense('spent 45 dollars at starbucks');
    expect(result.merchant.toLowerCase()).not.toContain('spent');
    expect(result.merchant.toLowerCase()).not.toContain('dollars');
    expect(result.merchant.toLowerCase()).not.toContain('at');
  });

  it('capitalizes first letter of each merchant word', () => {
    const result = parseExpense('uber 12');
    expect(result.merchant[0]).toBe(result.merchant[0].toUpperCase());
  });

  it('returns empty merchant when all words are filler/amount/currency', () => {
    expect(parseExpense('paid 20 dollars').merchant).toBe('');
  });
});

// ─── notes field ─────────────────────────────────────────────────────────────

describe('parseExpense — notes', () => {
  it('always returns null for notes (set by user in confirmation sheet)', () => {
    expect(parseExpense('coffee 5').notes).toBeNull();
  });
});

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('parseExpense — return shape', () => {
  it('always returns all required fields', () => {
    const result: ParsedExpense = parseExpense('netflix 17.99');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('currency');
    expect(result).toHaveProperty('merchant');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('notes');
  });
});

// ─── Custom categories ────────────────────────────────────────────────────────

describe('parseExpense — custom categories', () => {
  const customCats = [
    { name: 'Entertainment', keywords: ['cineplex', 'amc', 'movie'] },
    { name: 'Pets', keywords: ['vet', 'petco', 'dog food'] },
  ];

  it('matches a custom category keyword', () => {
    expect(parseExpense('cineplex 15', customCats).category).toBe('Entertainment');
  });

  it('matches a multi-word custom keyword', () => {
    expect(parseExpense('dog food 25', customCats).category).toBe('Pets');
  });

  it('custom keyword takes precedence over built-in keyword for same word', () => {
    // 'fitness' is a built-in Fitness keyword; override it with custom
    const overrideCats = [{ name: 'MyFitness', keywords: ['fitness'] }];
    expect(parseExpense('fitness 50', overrideCats).category).toBe('MyFitness');
  });

  it('falls back to built-in keyword when no custom keyword matches', () => {
    expect(parseExpense('netflix 17.99', customCats).category).toBe('Subscriptions');
  });

  it('returns Uncategorized when neither custom nor built-in keywords match', () => {
    expect(parseExpense('random thing 10', customCats).category).toBe('Uncategorized');
  });

  it('ignores empty keyword strings in custom categories', () => {
    const catsWithEmpty = [{ name: 'Empty', keywords: ['', '  '] }];
    expect(parseExpense('coffee 5', catsWithEmpty).category).toBe('Food & Drink');
  });

  it('works when customCategories is undefined (no change to behaviour)', () => {
    expect(parseExpense('gym 50').category).toBe('Fitness');
  });
});

// ─── Merchant overrides ───────────────────────────────────────────────────────

describe('parseExpense — merchant overrides', () => {
  const overrides: Record<string, string> = {
    'starbucks': 'Entertainment',
    'amazon': 'Shopping',
  };

  it('uses merchant override when merchant matches', () => {
    expect(parseExpense('starbucks 6', [], overrides).category).toBe('Entertainment');
  });

  it('override takes precedence over built-in keyword match', () => {
    // 'starbucks' is built-in Food & Drink; override wins
    expect(parseExpense('starbucks 6', [], overrides).category).toBe('Entertainment');
  });

  it('override takes precedence over custom category keywords', () => {
    const customCats = [{ name: 'MyCat', keywords: ['starbucks'] }];
    expect(parseExpense('starbucks 6', customCats, overrides).category).toBe('Entertainment');
  });

  it('falls back to keyword matching when merchant has no override', () => {
    expect(parseExpense('netflix 15', [], overrides).category).toBe('Subscriptions');
  });

  it('does not apply override when merchant is empty', () => {
    const overridesWithEmpty: Record<string, string> = { '': 'ShouldNotMatch' };
    expect(parseExpense('paid 20 dollars', [], overridesWithEmpty).category).toBe('Uncategorized');
  });

  it('works when merchantOverrides is undefined', () => {
    expect(parseExpense('gym 50', [], undefined).category).toBe('Fitness');
  });
});
