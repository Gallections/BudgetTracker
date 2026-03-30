import { calcMonthlyReport, MonthlyReport } from '../utils/monthlyReport';
import { Transaction } from '../db/transactions';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    amount: 50,
    currency: 'CAD',
    amount_in_base_currency: 50,
    category: 'Food & Drink',
    merchant: 'Tim Hortons',
    notes: null,
    date: '2026-03-15',   // Saturday
    created_at: '2026-03-15T10:00:00Z',
    deleted_at: null,
    type: 'expense',
    source_account_id: null,
    regular_expense_id: null,
    ...overrides,
  };
}

const NO_PREV: Transaction[] = [];

// ─── null cases ──────────────────────────────────────────────────────────────

describe('calcMonthlyReport — returns null', () => {
  it('returns null when periodTxns is empty and income is 0', () => {
    expect(calcMonthlyReport([], NO_PREV, 0, 0, 0, 0)).toBeNull();
  });

  it('returns non-null when there is income even with no expenses', () => {
    expect(calcMonthlyReport([], NO_PREV, 1000, 0, 0, 0)).not.toBeNull();
  });

  it('returns non-null when there are expense transactions', () => {
    expect(calcMonthlyReport([makeTx()], NO_PREV, 0, 50, 0, 0)).not.toBeNull();
  });
});

// ─── savings rate ─────────────────────────────────────────────────────────────

describe('calcMonthlyReport — savingsRate', () => {
  it('calculates (income - spend) / income', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 1000, 220, 0, 0)!;
    expect(r.savingsRate).toBeCloseTo(0.78, 2);
  });

  it('is null when income is 0', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 0, 50, 0, 0)!;
    expect(r.savingsRate).toBeNull();
  });

  it('can be negative when spend > income', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 100, 200, 0, 0)!;
    expect(r.savingsRate).toBeCloseTo(-1, 2);
  });

  it('calculates prevSavingsRate from prev income/spend', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 1000, 200, 800, 400)!;
    expect(r.prevSavingsRate).toBeCloseTo(0.5, 2);
  });

  it('prevSavingsRate is null when prev income is 0', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 1000, 200, 0, 100)!;
    expect(r.prevSavingsRate).toBeNull();
  });
});

// ─── top merchants ─────────────────────────────────────────────────────────────

describe('calcMonthlyReport — topMerchants', () => {
  it('groups and sums amounts by merchant', () => {
    const txns = [
      makeTx({ id: '1', merchant: 'Tim Hortons', amount: 5 }),
      makeTx({ id: '2', merchant: 'Tim Hortons', amount: 10 }),
      makeTx({ id: '3', merchant: 'Amazon', amount: 40 }),
    ];
    const r = calcMonthlyReport(txns, NO_PREV, 0, 55, 0, 0)!;
    expect(r.topMerchants[0]).toEqual({ merchant: 'Amazon', amount: 40 });
    expect(r.topMerchants[1]).toEqual({ merchant: 'Tim Hortons', amount: 15 });
  });

  it('caps at 5 merchants', () => {
    const txns = ['A', 'B', 'C', 'D', 'E', 'F'].map((m, i) =>
      makeTx({ id: `tx${i}`, merchant: m, amount: 100 - i * 10 })
    );
    const r = calcMonthlyReport(txns, NO_PREV, 0, 450, 0, 0)!;
    expect(r.topMerchants).toHaveLength(5);
  });

  it('skips blank merchant names', () => {
    const txns = [
      makeTx({ id: '1', merchant: '', amount: 100 }),
      makeTx({ id: '2', merchant: '   ', amount: 50 }),
      makeTx({ id: '3', merchant: 'Tim Hortons', amount: 20 }),
    ];
    const r = calcMonthlyReport(txns, NO_PREV, 0, 170, 0, 0)!;
    expect(r.topMerchants).toHaveLength(1);
    expect(r.topMerchants[0].merchant).toBe('Tim Hortons');
  });

  it('excludes income transactions from merchant totals', () => {
    const txns = [
      makeTx({ id: '1', type: 'income', merchant: 'Employer', amount: 3000 }),
      makeTx({ id: '2', type: 'expense', merchant: 'Grocery', amount: 80 }),
    ];
    const r = calcMonthlyReport(txns, NO_PREV, 3000, 80, 0, 0)!;
    expect(r.topMerchants.map(m => m.merchant)).not.toContain('Employer');
  });
});

// ─── category shifts ─────────────────────────────────────────────────────────

describe('calcMonthlyReport — category shifts', () => {
  it('calculates positive delta for increases', () => {
    const curr = [makeTx({ id: '1', category: 'Food & Drink', amount: 200 })];
    const prev = [makeTx({ id: '2', category: 'Food & Drink', amount: 100 })];
    const r = calcMonthlyReport(curr, prev, 0, 200, 0, 100)!;
    expect(r.categoryIncreases[0]).toMatchObject({ category: 'Food & Drink', delta: 100 });
  });

  it('calculates negative delta for decreases', () => {
    const curr = [makeTx({ id: '1', category: 'Transport', amount: 30 })];
    const prev = [makeTx({ id: '2', category: 'Transport', amount: 80 })];
    const r = calcMonthlyReport(curr, prev, 0, 30, 0, 80)!;
    expect(r.categoryDecreases[0]).toMatchObject({ category: 'Transport', delta: -50 });
  });

  it('treats absent category in prev as 0', () => {
    const curr = [makeTx({ id: '1', category: 'Health', amount: 100 })];
    const r = calcMonthlyReport(curr, NO_PREV, 0, 100, 0, 0)!;
    expect(r.categoryIncreases[0]).toMatchObject({ category: 'Health', delta: 100 });
  });

  it('caps increases at 3', () => {
    const curr = ['A', 'B', 'C', 'D'].map((cat, i) =>
      makeTx({ id: `tx${i}`, category: cat, amount: 100 })
    );
    const r = calcMonthlyReport(curr, NO_PREV, 0, 400, 0, 0)!;
    expect(r.categoryIncreases.length).toBeLessThanOrEqual(3);
  });

  it('caps decreases at 3', () => {
    const prev = ['A', 'B', 'C', 'D'].map((cat, i) =>
      makeTx({ id: `tx${i}`, category: cat, amount: 100 })
    );
    // Include a small expense so the function doesn't return null
    const r = calcMonthlyReport([makeTx({ id: 'dummy', amount: 1 })], prev, 0, 1, 0, 400)!;
    expect(r.categoryDecreases.length).toBeLessThanOrEqual(3);
  });
});

// ─── day-of-week spend ────────────────────────────────────────────────────────

describe('calcMonthlyReport — dayOfWeekSpend', () => {
  it('always returns 7 entries', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 0, 50, 0, 0)!;
    expect(r.dayOfWeekSpend).toHaveLength(7);
  });

  it('labels are Mon through Sun in order', () => {
    const r = calcMonthlyReport([makeTx()], NO_PREV, 0, 50, 0, 0)!;
    expect(r.dayOfWeekSpend.map(d => d.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('assigns Saturday spend to Sat slot (2026-03-15 is a Sunday... wait)', () => {
    // 2026-03-15 is a Sunday (getDay() = 0) → index 6 = Sun slot
    const tx = makeTx({ date: '2026-03-15', amount: 90 });
    const r = calcMonthlyReport([tx], NO_PREV, 0, 90, 0, 0)!;
    const sunSlot = r.dayOfWeekSpend.find(d => d.day === 'Sun')!;
    expect(sunSlot.avg).toBeCloseTo(90, 1);
  });

  it('assigns Monday spend to Mon slot (2026-03-16 is Monday)', () => {
    const tx = makeTx({ id: '1', date: '2026-03-16', amount: 60 }); // Monday
    const r = calcMonthlyReport([tx], NO_PREV, 0, 60, 0, 0)!;
    const monSlot = r.dayOfWeekSpend.find(d => d.day === 'Mon')!;
    expect(monSlot.avg).toBeCloseTo(60, 1);
  });

  it('averages multiple transactions on same day-of-week', () => {
    const txns = [
      makeTx({ id: '1', date: '2026-03-16', amount: 40 }),  // Monday
      makeTx({ id: '2', date: '2026-03-23', amount: 60 }),  // Monday
    ];
    const r = calcMonthlyReport(txns, NO_PREV, 0, 100, 0, 0)!;
    const monSlot = r.dayOfWeekSpend.find(d => d.day === 'Mon')!;
    expect(monSlot.avg).toBeCloseTo(50, 1);
  });

  it('returns 0 avg for days with no transactions', () => {
    const tx = makeTx({ date: '2026-03-16', amount: 50 }); // Monday only
    const r = calcMonthlyReport([tx], NO_PREV, 0, 50, 0, 0)!;
    const friSlot = r.dayOfWeekSpend.find(d => d.day === 'Fri')!;
    expect(friSlot.avg).toBe(0);
  });

  it('excludes income transactions from day-of-week', () => {
    const txns = [
      makeTx({ id: '1', type: 'income', date: '2026-03-16', amount: 3000 }),
      makeTx({ id: '2', type: 'expense', date: '2026-03-16', amount: 40 }),
    ];
    const r = calcMonthlyReport(txns, NO_PREV, 3000, 40, 0, 0)!;
    const monSlot = r.dayOfWeekSpend.find(d => d.day === 'Mon')!;
    expect(monSlot.avg).toBeCloseTo(40, 1);
  });
});
