import { useState, useEffect, useCallback } from 'react';
import { getSavingsAccounts } from '../db/savings';
import { getRegularExpenses } from '../db/regularExpenses';
import { getTransactions, getMonthlySpendTrend, Transaction } from '../db/transactions';
import { useApp } from '../context/AppContext';
import { Period, getDateRange, getPreviousDateRange } from '../utils/dateRanges';
import { calcRecurringContribution } from '../utils/recurringContributions';

export interface DashboardData {
  totalSavings: number;
  totalDebts: number;
  netWorth: number;
  recentTransactions: Transaction[];
  periodTransactions: Transaction[];
  prevPeriodTransactions: Transaction[];
  periodSpend: number;
  periodIncome: number;
  prevPeriodSpend: number;
  prevPeriodIncome: number;
  monthlyTrend: { month: string; amount: number }[];
  loading: boolean;
}

export function useDashboard(
  period: Period,
  customRange?: { from: string; to: string }
): DashboardData {
  const { state } = useApp();
  const [data, setData] = useState<DashboardData>({
    totalSavings: 0,
    totalDebts: 0,
    netWorth: 0,
    recentTransactions: [],
    periodTransactions: [],
    prevPeriodTransactions: [],
    periodSpend: 0,
    periodIncome: 0,
    prevPeriodSpend: 0,
    prevPeriodIncome: 0,
    monthlyTrend: [],
    loading: true,
  });

  const load = useCallback(async () => {
    setData(d => ({ ...d, loading: true }));
    const { dateFrom, dateTo } = getDateRange(period, customRange);
    const prevRange = getPreviousDateRange(period);

    // All-time date range for net worth calculation
    const allTimeRange = { dateFrom: '2000-01-01', dateTo: new Date().toISOString().split('T')[0] };

    const [savings, expenses, recent, allIncome, allUnlinkedExpenseTxns, periodExpenseTxns, periodIncomeTxns, prevExpenseTxns, prevIncomeTxns, monthlyTrend] =
      await Promise.all([
        getSavingsAccounts(),
        getRegularExpenses(),
        getTransactions({ limit: 30 }),
        getTransactions({ type: 'income' }),
        // Only unlinked expenses for net worth — linked expenses already reduced account balances
        getTransactions({ type: 'expense', unlinkedOnly: true }),
        getTransactions({ type: 'expense', dateFrom, dateTo }),
        getTransactions({ type: 'income', dateFrom, dateTo }),
        prevRange ? getTransactions({ type: 'expense', dateFrom: prevRange.dateFrom, dateTo: prevRange.dateTo }) : Promise.resolve([]),
        prevRange ? getTransactions({ type: 'income', dateFrom: prevRange.dateFrom, dateTo: prevRange.dateTo }) : Promise.resolve([]),
        getMonthlySpendTrend(6),
      ]);

    const accountBalances = savings.reduce((sum, a) => sum + a.balance, 0);
    const totalIncome = allIncome.reduce((sum, t) => sum + t.amount, 0);
    const totalUnlinkedExpenses = allUnlinkedExpenseTxns.reduce((sum, t) => sum + t.amount, 0);

    // Exclude recurring expenses that have been posted as transactions — those amounts
    // are already captured in totalUnlinkedExpenses, so counting them again in
    // calcRecurringContribution would double-subtract them from net worth.
    const postedExpenseIds = new Set(
      allUnlinkedExpenseTxns
        .map(t => t.regular_expense_id)
        .filter((id): id is string => id !== null)
    );
    const unpostedRecurring = expenses.filter(e => !postedExpenseIds.has(e.id));
    const recurringAllTime = calcRecurringContribution(unpostedRecurring, allTimeRange);

    // Account balances already reflect linked expenses (auto-decremented on save).
    // Only subtract unlinked expenses (cash / "None" account) to avoid double-counting.
    const netWorth = accountBalances + totalIncome - totalUnlinkedExpenses - recurringAllTime;

    const periodSpend =
      periodExpenseTxns.reduce((sum, t) => sum + t.amount, 0) +
      calcRecurringContribution(expenses, { dateFrom, dateTo });
    const periodIncome = periodIncomeTxns.reduce((sum, t) => sum + t.amount, 0);

    const prevPeriodSpend = prevRange
      ? prevExpenseTxns.reduce((sum, t) => sum + t.amount, 0) +
        calcRecurringContribution(expenses, { dateFrom: prevRange.dateFrom, dateTo: prevRange.dateTo })
      : 0;
    const prevPeriodIncome = prevRange
      ? prevIncomeTxns.reduce((sum, t) => sum + t.amount, 0)
      : 0;

    setData({
      totalSavings: accountBalances,
      totalDebts: recurringAllTime,
      netWorth,
      recentTransactions: recent,
      periodTransactions: [...periodExpenseTxns, ...periodIncomeTxns].sort(
        (a, b) => b.date.localeCompare(a.date)
      ),
      prevPeriodTransactions: [...prevExpenseTxns, ...prevIncomeTxns],
      periodSpend,
      periodIncome,
      prevPeriodSpend,
      prevPeriodIncome,
      monthlyTrend,
      loading: false,
    });
  }, [period, customRange?.from, customRange?.to, state.refreshKey]);

  useEffect(() => {
    if (state.dbReady) load();
  }, [state.dbReady, load]);

  return data;
}
