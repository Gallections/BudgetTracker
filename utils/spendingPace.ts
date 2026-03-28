export interface SpendingPace {
  totalBudget: number;
  totalSpent: number;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  expectedSpend: number;
  isOverPace: boolean;
  budgetPct: number;  // capped at 1 for display
  dayPct: number;
}

/**
 * Computes monthly spending pace metrics.
 * Returns null when no budgets are set (nothing to compare against).
 */
export function calcSpendingPace(
  budgets: Record<string, number>,
  spendByCategory: Record<string, number>,
  today: Date = new Date()
): SpendingPace | null {
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  if (totalBudget === 0) return null;

  const totalSpent = Object.keys(budgets).reduce(
    (s, cat) => s + (spendByCategory[cat] ?? 0),
    0
  );

  const daysElapsed = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - daysElapsed;
  const expectedSpend = (daysElapsed / daysInMonth) * totalBudget;

  return {
    totalBudget,
    totalSpent,
    daysElapsed,
    daysInMonth,
    daysRemaining,
    expectedSpend,
    isOverPace: totalSpent > expectedSpend,
    budgetPct: Math.min(totalSpent / totalBudget, 1),
    dayPct: daysElapsed / daysInMonth,
  };
}
