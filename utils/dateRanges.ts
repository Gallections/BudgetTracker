export type Period = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

export interface DateRange {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDateRange(
  period: Period,
  custom?: { from: string; to: string }
): DateRange {
  const today = new Date();

  if (period === 'this_month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: toYMD(first), dateTo: toYMD(today) };
  }

  if (period === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { dateFrom: toYMD(first), dateTo: toYMD(last) };
  }

  if (period === 'last_3_months') {
    const first = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    return { dateFrom: toYMD(first), dateTo: toYMD(today) };
  }

  // custom
  return { dateFrom: custom?.from ?? toYMD(today), dateTo: custom?.to ?? toYMD(today) };
}
