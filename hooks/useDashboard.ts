import { useState, useEffect, useCallback } from 'react';
import { getSavingsAccounts } from '../db/savings';
import { getRegularExpenses } from '../db/regularExpenses';
import { getTransactions, Transaction } from '../db/transactions';
import { useApp } from '../context/AppContext';
import { Period, getDateRange } from '../utils/dateRanges';
import { calcRecurringContribution } from '../utils/recurringContributions';

export interface DashboardData {
  totalSavings: number;
  totalDebts: number;
  netWorth: number;
  recentTransactions: Transaction[];
  periodTransactions: Transaction[];
  periodSpend: number;
  periodIncome: number;
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
    periodSpend: 0,
    periodIncome: 0,
    loading: true,
  });

  const load = useCallback(async () => {
    setData(d => ({ ...d, loading: true }));
    const { dateFrom, dateTo } = getDateRange(period, customRange);

    // All-time date range for net worth calculation
    const allTimeRange = { dateFrom: '2000-01-01', dateTo: new Date().toISOString().split('T')[0] };

    const [savings, expenses, recent, allIncome, allExpenseTxns, periodExpenseTxns, periodIncomeTxns] =
      await Promise.all([
        getSavingsAccounts(),
        getRegularExpenses(),
        getTransactions({ limit: 30 }),
        getTransactions({ type: 'income' }),
        getTransactions({ type: 'expense' }),
        getTransactions({ type: 'expense', dateFrom, dateTo }),
        getTransactions({ type: 'income', dateFrom, dateTo }),
      ]);

    const accountBalances = savings.reduce((sum, a) => sum + a.balance, 0);
    const totalIncome = allIncome.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenseTxns = allExpenseTxns.reduce((sum, t) => sum + t.amount, 0);
    const recurringAllTime = calcRecurringContribution(expenses, allTimeRange);

    const netWorth = accountBalances + totalIncome - totalExpenseTxns - recurringAllTime;

    const periodSpend =
      periodExpenseTxns.reduce((sum, t) => sum + t.amount, 0) +
      calcRecurringContribution(expenses, { dateFrom, dateTo });
    const periodIncome = periodIncomeTxns.reduce((sum, t) => sum + t.amount, 0);

    setData({
      totalSavings: accountBalances,
      totalDebts: recurringAllTime,
      netWorth,
      recentTransactions: recent,
      periodTransactions: [...periodExpenseTxns, ...periodIncomeTxns].sort(
        (a, b) => b.date.localeCompare(a.date)
      ),
      periodSpend,
      periodIncome,
      loading: false,
    });
  }, [period, customRange?.from, customRange?.to, state.refreshKey]);

  useEffect(() => {
    if (state.dbReady) load();
  }, [state.dbReady, load]);

  return data;
}
