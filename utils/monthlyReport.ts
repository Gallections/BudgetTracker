import { Transaction } from '../db/transactions';

export interface MonthlyReport {
  savingsRate: number | null;
  prevSavingsRate: number | null;
  topMerchants: { merchant: string; amount: number }[];
  categoryIncreases: { category: string; current: number; delta: number }[];
  categoryDecreases: { category: string; current: number; delta: number }[];
  dayOfWeekSpend: { day: string; avg: number }[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat → remap to 0=Mon..6=Sun
function jsDayToIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function calcMonthlyReport(
  periodTxns: Transaction[],
  prevTxns: Transaction[],
  periodIncome: number,
  periodSpend: number,
  prevIncome: number,
  prevSpend: number,
): MonthlyReport | null {
  const periodExpenses = periodTxns.filter(t => t.type === 'expense');
  if (periodExpenses.length === 0 && periodIncome === 0) return null;

  // Savings rate
  const savingsRate = periodIncome > 0
    ? (periodIncome - periodSpend) / periodIncome
    : null;
  const prevSavingsRate = prevIncome > 0
    ? (prevIncome - prevSpend) / prevIncome
    : null;

  // Top merchants (top 5 by spend, skip blank)
  const merchantTotals: Record<string, number> = {};
  for (const t of periodExpenses) {
    const m = t.merchant?.trim();
    if (!m) continue;
    merchantTotals[m] = (merchantTotals[m] ?? 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([merchant, amount]) => ({ merchant, amount }));

  // Category shifts
  const spendByCat = (txns: Transaction[]) =>
    txns.filter(t => t.type === 'expense').reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  const currentCats = spendByCat(periodTxns);
  const prevCats = spendByCat(prevTxns);
  const allCats = new Set([...Object.keys(currentCats), ...Object.keys(prevCats)]);

  const shifts = Array.from(allCats).map(category => ({
    category,
    current: currentCats[category] ?? 0,
    delta: (currentCats[category] ?? 0) - (prevCats[category] ?? 0),
  }));

  const categoryIncreases = shifts
    .filter(s => s.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  const categoryDecreases = shifts
    .filter(s => s.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  // Day-of-week spend (Mon–Sun averages)
  const daySums = new Array(7).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const t of periodExpenses) {
    const jsDay = new Date(t.date + 'T00:00:00').getDay();
    const idx = jsDayToIndex(jsDay);
    daySums[idx] += t.amount;
    dayCounts[idx]++;
  }

  const dayOfWeekSpend = DAY_LABELS.map((day, i) => ({
    day,
    avg: dayCounts[i] > 0 ? daySums[i] / dayCounts[i] : 0,
  }));

  return {
    savingsRate,
    prevSavingsRate,
    topMerchants,
    categoryIncreases,
    categoryDecreases,
    dayOfWeekSpend,
  };
}
