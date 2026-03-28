import { calcRecurringContribution } from '../utils/recurringContributions';
import { RegularExpense } from '../db/regularExpenses';

function makeExpense(overrides: Partial<RegularExpense> = {}): RegularExpense {
  return {
    id: 'test-id',
    name: 'Test',
    category: 'Housing',
    amount: 100,
    currency: 'CAD',
    frequency: 'monthly',
    due_day: null,
    outstanding_balance: null,
    notes: null,
    sort_order: 0,
    deleted_at: null,
    start_date: '2025-01-01',
    last_posted_at: null,
    ...overrides,
  };
}

describe('calcRecurringContribution', () => {
  // ─── empty / edge cases ────────────────────────────────────────────────────

  it('returns 0 for empty expense list', () => {
    expect(calcRecurringContribution([], { dateFrom: '2025-01-01', dateTo: '2025-12-31' })).toBe(0);
  });

  it('returns 0 for "once" frequency expense started after the range', () => {
    const e = makeExpense({ frequency: 'once', start_date: '2026-01-01', amount: 500 });
    expect(calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' })).toBe(0);
  });

  it('returns amount for "once" frequency expense started within the range', () => {
    const e = makeExpense({ frequency: 'once', start_date: '2025-06-15', amount: 500 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    expect(result).toBe(500);
  });

  // ─── monthly ───────────────────────────────────────────────────────────────

  it('counts correct monthly cycles for a single month range', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2025-01-01', amount: 200 });
    // Jan: 1 cycle
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-01-31' });
    expect(result).toBe(200);
  });

  it('counts correct monthly cycles for a 3-month range', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2025-01-01', amount: 200 });
    // Jan + Feb + Mar = 3 cycles
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-03-31' });
    expect(result).toBe(600);
  });

  it('does not count months before expense started', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2025-03-01', amount: 100 });
    // Range is Jan–Mar, but expense starts in Mar → 1 cycle
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-03-31' });
    expect(result).toBe(100);
  });

  it('counts 12 monthly cycles for a full year', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2025-01-01', amount: 50 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    expect(result).toBe(600);
  });

  // ─── weekly ────────────────────────────────────────────────────────────────

  it('counts weekly cycles correctly for a ~4-week window', () => {
    const e = makeExpense({ frequency: 'weekly', start_date: '2025-01-01', amount: 10 });
    // Jan 1 to Jan 28 = 27 elapsed days → floor(27/7)+1 = 4 cycles
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-01-28' });
    expect(result).toBe(40);
  });

  it('counts 1 weekly cycle for a 6-day window', () => {
    const e = makeExpense({ frequency: 'weekly', start_date: '2025-01-01', amount: 10 });
    // 6 days → floor(6/7)+1 = 1
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-01-06' });
    expect(result).toBe(10);
  });

  // ─── biweekly ─────────────────────────────────────────────────────────────

  it('counts biweekly cycles correctly for a 28-day window', () => {
    const e = makeExpense({ frequency: 'biweekly', start_date: '2025-01-01', amount: 25 });
    // Jan 1 to Jan 28 = 27 elapsed days → floor(27/14)+1 = 2 cycles
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-01-28' });
    expect(result).toBe(50);
  });

  // ─── quarterly ────────────────────────────────────────────────────────────

  it('counts quarterly cycles for a full year', () => {
    const e = makeExpense({ frequency: 'quarterly', start_date: '2025-01-01', amount: 300 });
    // Q1, Q2, Q3, Q4 → but count is by calendar quarter months starting from window start
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    // Jan, Apr, Jul, Oct → 4 cycles? Let's check: months stepped by 3: Jan→Apr→Jul→Oct → 4
    expect(result).toBe(1200);
  });

  it('counts 1 quarterly cycle for a single quarter', () => {
    const e = makeExpense({ frequency: 'quarterly', start_date: '2025-01-01', amount: 300 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-03-31' });
    expect(result).toBe(300);
  });

  // ─── annually ─────────────────────────────────────────────────────────────

  it('counts 1 annual cycle for a single year', () => {
    const e = makeExpense({ frequency: 'annually', start_date: '2025-01-01', amount: 1200 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    expect(result).toBe(1200);
  });

  it('counts 2 annual cycles for a 2-year range', () => {
    const e = makeExpense({ frequency: 'annually', start_date: '2025-01-01', amount: 1200 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2026-12-31' });
    expect(result).toBe(2400);
  });

  // ─── multiple expenses ────────────────────────────────────────────────────

  it('sums contributions from multiple expenses', () => {
    const e1 = makeExpense({ id: '1', frequency: 'monthly', start_date: '2025-01-01', amount: 100 });
    const e2 = makeExpense({ id: '2', frequency: 'monthly', start_date: '2025-01-01', amount: 200 });
    const result = calcRecurringContribution([e1, e2], { dateFrom: '2025-01-01', dateTo: '2025-01-31' });
    expect(result).toBe(300);
  });

  it('handles expenses with missing start_date by using today', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: null, amount: 100 });
    // Should still return some value >= 100 (at least 1 month in current range)
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateFrom = `${year}-${month}-01`;
    const dateTo = `${year}-${month}-${String(new Date(year, today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    const result = calcRecurringContribution([e], { dateFrom, dateTo });
    expect(result).toBe(100);
  });

  // ─── range boundaries ─────────────────────────────────────────────────────

  it('returns 0 when expense starts after the range end', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2026-01-01', amount: 100 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    expect(result).toBe(0);
  });

  it('returns 0 for a zero-day range that is before start_date', () => {
    const e = makeExpense({ frequency: 'monthly', start_date: '2025-06-01', amount: 100 });
    const result = calcRecurringContribution([e], { dateFrom: '2025-01-01', dateTo: '2025-01-01' });
    expect(result).toBe(0);
  });
});
