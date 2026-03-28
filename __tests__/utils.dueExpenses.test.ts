import { getDueExpenses } from '../utils/dueExpenses';
import { RegularExpense } from '../db/regularExpenses';

// Helpers
const march = (d: number) => new Date(2026, 2, d); // March 2026

function makeExpense(overrides: Partial<RegularExpense> = {}): RegularExpense {
  return {
    id: 'e1',
    name: 'Netflix',
    category: 'Subscriptions',
    amount: 20,
    currency: 'CAD',
    frequency: 'monthly',
    due_day: 1,
    outstanding_balance: null,
    notes: null,
    sort_order: 0,
    deleted_at: null,
    start_date: null,
    last_posted_at: null,
    ...overrides,
  };
}

// ─── empty / no match ─────────────────────────────────────────────────────────

describe('getDueExpenses — returns empty', () => {
  it('returns [] when expenses array is empty', () => {
    expect(getDueExpenses([], march(15))).toEqual([]);
  });

  it('ignores weekly frequency', () => {
    expect(getDueExpenses([makeExpense({ frequency: 'weekly' })], march(15))).toEqual([]);
  });

  it('ignores biweekly frequency', () => {
    expect(getDueExpenses([makeExpense({ frequency: 'biweekly' })], march(15))).toEqual([]);
  });

  it('ignores quarterly frequency', () => {
    expect(getDueExpenses([makeExpense({ frequency: 'quarterly' })], march(15))).toEqual([]);
  });

  it('ignores annually frequency', () => {
    expect(getDueExpenses([makeExpense({ frequency: 'annually' })], march(15))).toEqual([]);
  });

  it('ignores once frequency', () => {
    expect(getDueExpenses([makeExpense({ frequency: 'once' })], march(15))).toEqual([]);
  });

  it('ignores monthly expense with due_day null', () => {
    expect(getDueExpenses([makeExpense({ due_day: null })], march(15))).toEqual([]);
  });

  it('ignores monthly expense where due_day is in the future', () => {
    // Today is March 10, due_day is 20 → not yet due
    expect(getDueExpenses([makeExpense({ due_day: 20 })], march(10))).toEqual([]);
  });

  it('excludes expense already posted this month', () => {
    const expense = makeExpense({ due_day: 1, last_posted_at: '2026-03' });
    expect(getDueExpenses([expense], march(15))).toEqual([]);
  });
});

// ─── returns due expenses ─────────────────────────────────────────────────────

describe('getDueExpenses — returns due expenses', () => {
  it('returns expense when due_day equals today', () => {
    const expense = makeExpense({ due_day: 15 });
    expect(getDueExpenses([expense], march(15))).toEqual([expense]);
  });

  it('returns expense when due_day is in the past and last_posted_at is null', () => {
    const expense = makeExpense({ due_day: 1, last_posted_at: null });
    expect(getDueExpenses([expense], march(15))).toEqual([expense]);
  });

  it('returns expense when last_posted_at is a prior month', () => {
    const expense = makeExpense({ due_day: 1, last_posted_at: '2026-02' });
    expect(getDueExpenses([expense], march(15))).toEqual([expense]);
  });

  it('returns expense when last_posted_at is from a prior year', () => {
    const expense = makeExpense({ due_day: 1, last_posted_at: '2025-03' });
    expect(getDueExpenses([expense], march(15))).toEqual([expense]);
  });
});

// ─── mixed list ───────────────────────────────────────────────────────────────

describe('getDueExpenses — mixed list', () => {
  it('returns only due expenses from a mixed list', () => {
    const due = makeExpense({ id: 'due', due_day: 5, last_posted_at: null });
    const notDueYet = makeExpense({ id: 'future', due_day: 25, last_posted_at: null });
    const alreadyPosted = makeExpense({ id: 'posted', due_day: 1, last_posted_at: '2026-03' });
    const weekly = makeExpense({ id: 'weekly', frequency: 'weekly' });

    const result = getDueExpenses([due, notDueYet, alreadyPosted, weekly], march(15));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('due');
  });

  it('returns multiple due expenses', () => {
    const e1 = makeExpense({ id: 'e1', due_day: 1 });
    const e2 = makeExpense({ id: 'e2', due_day: 5 });
    const result = getDueExpenses([e1, e2], march(15));
    expect(result).toHaveLength(2);
  });
});
