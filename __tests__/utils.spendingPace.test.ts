import { calcSpendingPace } from '../utils/spendingPace';

const day = (d: number) => new Date(2026, 2, d); // March 2026 (31 days)
const feb = (d: number) => new Date(2026, 1, d); // Feb 2026 (28 days)
const apr = (d: number) => new Date(2026, 3, d); // Apr 2026 (30 days)

// ─── null cases ───────────────────────────────────────────────────────────────

describe('calcSpendingPace — returns null', () => {
  it('returns null when budgets is empty', () => {
    expect(calcSpendingPace({}, {}, day(15))).toBeNull();
  });

  it('returns null when all budget values are 0', () => {
    expect(calcSpendingPace({ Groceries: 0 }, {}, day(15))).toBeNull();
  });
});

// ─── totalBudget ──────────────────────────────────────────────────────────────

describe('calcSpendingPace — totalBudget', () => {
  it('sums all budget values', () => {
    const result = calcSpendingPace({ Food: 200, Housing: 1000 }, {}, day(15))!;
    expect(result.totalBudget).toBe(1200);
  });

  it('single category budget', () => {
    const result = calcSpendingPace({ Groceries: 300 }, {}, day(15))!;
    expect(result.totalBudget).toBe(300);
  });
});

// ─── totalSpent ───────────────────────────────────────────────────────────────

describe('calcSpendingPace — totalSpent', () => {
  it('sums spend only for budgeted categories', () => {
    const budgets = { Food: 200, Housing: 1000 };
    const spend = { Food: 80, Housing: 400, Uncategorized: 999 };
    const result = calcSpendingPace(budgets, spend, day(15))!;
    expect(result.totalSpent).toBe(480);
  });

  it('defaults to 0 for budgeted category with no spend', () => {
    const result = calcSpendingPace({ Food: 200 }, {}, day(15))!;
    expect(result.totalSpent).toBe(0);
  });

  it('ignores spend in non-budgeted categories', () => {
    const result = calcSpendingPace({ Food: 200 }, { Subscriptions: 500 }, day(15))!;
    expect(result.totalSpent).toBe(0);
  });
});

// ─── day calculations ─────────────────────────────────────────────────────────

describe('calcSpendingPace — day calculations', () => {
  it('daysElapsed equals the day-of-month', () => {
    expect(calcSpendingPace({ Food: 200 }, {}, day(10))!.daysElapsed).toBe(10);
    expect(calcSpendingPace({ Food: 200 }, {}, day(28))!.daysElapsed).toBe(28);
  });

  it('daysInMonth is 31 for March', () => {
    expect(calcSpendingPace({ Food: 200 }, {}, day(15))!.daysInMonth).toBe(31);
  });

  it('daysInMonth is 28 for February 2026 (non-leap year)', () => {
    expect(calcSpendingPace({ Food: 200 }, {}, feb(14))!.daysInMonth).toBe(28);
  });

  it('daysInMonth is 30 for April', () => {
    expect(calcSpendingPace({ Food: 200 }, {}, apr(15))!.daysInMonth).toBe(30);
  });

  it('daysRemaining = daysInMonth - daysElapsed', () => {
    const result = calcSpendingPace({ Food: 200 }, {}, day(20))!;
    expect(result.daysRemaining).toBe(11); // 31 - 20
  });

  it('daysRemaining is 0 on the last day of the month', () => {
    expect(calcSpendingPace({ Food: 200 }, {}, day(31))!.daysRemaining).toBe(0);
  });

  it('dayPct = daysElapsed / daysInMonth', () => {
    const result = calcSpendingPace({ Food: 200 }, {}, day(31))!;
    expect(result.dayPct).toBe(1);
  });

  it('dayPct is between 0 and 1 mid-month', () => {
    const result = calcSpendingPace({ Food: 300 }, {}, day(15))!;
    expect(result.dayPct).toBeGreaterThan(0);
    expect(result.dayPct).toBeLessThan(1);
  });
});

// ─── expectedSpend & isOverPace ───────────────────────────────────────────────

describe('calcSpendingPace — expectedSpend and isOverPace', () => {
  it('expectedSpend = (daysElapsed / daysInMonth) * totalBudget', () => {
    // Day 15 of 30 days = 50% through month, budget $300 → expected $150
    const result = calcSpendingPace({ Food: 300 }, {}, apr(15))!;
    expect(result.expectedSpend).toBeCloseTo(150, 1);
  });

  it('isOverPace true when spent exceeds expected', () => {
    const result = calcSpendingPace({ Food: 300 }, { Food: 200 }, apr(15))!;
    // Expected ~150, spent 200 → over pace
    expect(result.isOverPace).toBe(true);
  });

  it('isOverPace false when spent is below expected', () => {
    const result = calcSpendingPace({ Food: 300 }, { Food: 50 }, apr(15))!;
    // Expected ~150, spent 50 → on pace
    expect(result.isOverPace).toBe(false);
  });

  it('isOverPace false when spent equals expected exactly', () => {
    // Day 15 of 30, budget 300 → expected exactly 150
    const result = calcSpendingPace({ Food: 300 }, { Food: 150 }, apr(15))!;
    expect(result.isOverPace).toBe(false);
  });
});

// ─── budgetPct ────────────────────────────────────────────────────────────────

describe('calcSpendingPace — budgetPct', () => {
  it('budgetPct = spent / budget when under', () => {
    const result = calcSpendingPace({ Food: 200 }, { Food: 100 }, day(15))!;
    expect(result.budgetPct).toBeCloseTo(0.5, 5);
  });

  it('budgetPct capped at 1 when over budget', () => {
    const result = calcSpendingPace({ Food: 200 }, { Food: 500 }, day(15))!;
    expect(result.budgetPct).toBe(1);
  });

  it('budgetPct is 0 when nothing spent', () => {
    const result = calcSpendingPace({ Food: 200 }, {}, day(15))!;
    expect(result.budgetPct).toBe(0);
  });
});
