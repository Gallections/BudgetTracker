import { getDateRange, getPreviousDateRange } from '../utils/dateRanges';

// Helper: parse a YYYY-MM-DD string into { y, m, d }
function parts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── this_month ───────────────────────────────────────────────────────────────

describe('getDateRange — this_month', () => {
  it('dateFrom is the 1st of the current month', () => {
    const { dateFrom } = getDateRange('this_month');
    const { d } = parts(dateFrom);
    expect(d).toBe(1);
  });

  it('dateFrom month matches the current month', () => {
    const { dateFrom } = getDateRange('this_month');
    const { m } = parts(dateFrom);
    expect(m).toBe(new Date().getMonth() + 1);
  });

  it('dateTo is today', () => {
    expect(getDateRange('this_month').dateTo).toBe(today());
  });

  it('dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getDateRange('this_month');
    expect(dateFrom <= dateTo).toBe(true);
  });
});

// ─── last_month ───────────────────────────────────────────────────────────────

describe('getDateRange — last_month', () => {
  it('dateFrom is the 1st of last month', () => {
    const { dateFrom } = getDateRange('last_month');
    expect(parts(dateFrom).d).toBe(1);
  });

  it('dateTo is the last day of last month', () => {
    const now = new Date();
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const { dateTo } = getDateRange('last_month');
    expect(parts(dateTo).d).toBe(lastDayOfLastMonth);
  });

  it('dateFrom month is one before current (or December if January)', () => {
    const { dateFrom } = getDateRange('last_month');
    const currentMonth = new Date().getMonth() + 1;
    const expectedMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    expect(parts(dateFrom).m).toBe(expectedMonth);
  });

  it('dateTo month equals dateFrom month', () => {
    const { dateFrom, dateTo } = getDateRange('last_month');
    expect(parts(dateTo).m).toBe(parts(dateFrom).m);
  });

  it('dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getDateRange('last_month');
    expect(dateFrom <= dateTo).toBe(true);
  });
});

// ─── last_3_months ────────────────────────────────────────────────────────────

describe('getDateRange — last_3_months', () => {
  it('dateTo is today', () => {
    expect(getDateRange('last_3_months').dateTo).toBe(today());
  });

  it('dateFrom is the 1st of a month 3 months ago', () => {
    const { dateFrom } = getDateRange('last_3_months');
    expect(parts(dateFrom).d).toBe(1);
  });

  it('dateFrom is approximately 3 months before today', () => {
    const { dateFrom } = getDateRange('last_3_months');
    const now = new Date();
    const expectedMonth = ((now.getMonth() - 3 + 12) % 12) + 1;
    expect(parts(dateFrom).m).toBe(expectedMonth);
  });

  it('dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getDateRange('last_3_months');
    expect(dateFrom <= dateTo).toBe(true);
  });
});

// ─── custom ───────────────────────────────────────────────────────────────────

describe('getDateRange — custom', () => {
  it('passes through the provided from date', () => {
    const { dateFrom } = getDateRange('custom', { from: '2026-01-15', to: '2026-01-31' });
    expect(dateFrom).toBe('2026-01-15');
  });

  it('passes through the provided to date', () => {
    const { dateTo } = getDateRange('custom', { from: '2026-01-15', to: '2026-01-31' });
    expect(dateTo).toBe('2026-01-31');
  });

  it('falls back to today when no custom range provided', () => {
    const { dateFrom, dateTo } = getDateRange('custom');
    expect(dateFrom).toBe(today());
    expect(dateTo).toBe(today());
  });
});

// ─── getPreviousDateRange ─────────────────────────────────────────────────────

describe('getPreviousDateRange', () => {
  it('returns null for custom period', () => {
    expect(getPreviousDateRange('custom')).toBeNull();
  });

  it('this_month: dateFrom is 1st of last month', () => {
    const result = getPreviousDateRange('this_month')!;
    const now = new Date();
    const expectedMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    expect(parts(result.dateFrom).d).toBe(1);
    expect(parts(result.dateFrom).m).toBe(expectedMonth);
  });

  it('this_month: dateTo is last day of last month', () => {
    const result = getPreviousDateRange('this_month')!;
    const now = new Date();
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    expect(parts(result.dateTo).d).toBe(lastDayOfLastMonth);
  });

  it('this_month: dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getPreviousDateRange('this_month')!;
    expect(dateFrom <= dateTo).toBe(true);
  });

  it('last_month: dateFrom is 1st of two months ago', () => {
    const result = getPreviousDateRange('last_month')!;
    const now = new Date();
    const expectedMonth = ((now.getMonth() - 2 + 12) % 12) + 1;
    expect(parts(result.dateFrom).d).toBe(1);
    expect(parts(result.dateFrom).m).toBe(expectedMonth);
  });

  it('last_month: dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getPreviousDateRange('last_month')!;
    expect(dateFrom <= dateTo).toBe(true);
  });

  it('last_3_months: dateFrom is 1st of a month 6 months ago', () => {
    const result = getPreviousDateRange('last_3_months')!;
    const now = new Date();
    const expectedMonth = ((now.getMonth() - 6 + 12) % 12) + 1;
    expect(parts(result.dateFrom).d).toBe(1);
    expect(parts(result.dateFrom).m).toBe(expectedMonth);
  });

  it('last_3_months: dateTo is last day of the month 3 months ago', () => {
    const result = getPreviousDateRange('last_3_months')!;
    const now = new Date();
    const lastDayOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 0).getDate();
    expect(parts(result.dateTo).d).toBe(lastDayOf3MonthsAgo);
  });

  it('last_3_months: dateFrom <= dateTo', () => {
    const { dateFrom, dateTo } = getPreviousDateRange('last_3_months')!;
    expect(dateFrom <= dateTo).toBe(true);
  });

  it('all non-custom periods return YYYY-MM-DD formatted strings', () => {
    const periods = ['this_month', 'last_month', 'last_3_months'] as const;
    for (const p of periods) {
      const result = getPreviousDateRange(p)!;
      expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ─── return shape ─────────────────────────────────────────────────────────────

describe('getDateRange — return shape', () => {
  const periods = ['this_month', 'last_month', 'last_3_months', 'custom'] as const;

  it.each(periods)('%s returns dateFrom and dateTo strings', (period) => {
    const result = getDateRange(period);
    expect(typeof result.dateFrom).toBe('string');
    expect(typeof result.dateTo).toBe('string');
  });

  it.each(periods)('%s dateFrom matches YYYY-MM-DD format', (period) => {
    const { dateFrom } = getDateRange(period);
    expect(dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(periods)('%s dateTo matches YYYY-MM-DD format', (period) => {
    const { dateTo } = getDateRange(period);
    expect(dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
