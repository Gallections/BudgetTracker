import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Alert, ScrollView, Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useDashboard } from '../../hooks/useDashboard';
import { softDeleteTransaction, Transaction } from '../../db/transactions';
import { useApp } from '../../context/AppContext';
import { Period } from '../../utils/dateRanges';
import EditTransactionSheet from '../../components/EditTransactionSheet';
import SearchSheet from '../../components/SearchSheet';
import { getBudgets } from '../../db/userSettings';
import { CATEGORIES } from '../../constants/categories';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { calcSpendingPace } from '../../utils/spendingPace';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SCREEN_WIDTH = Dimensions.get('window').width;

const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: '3 Months' },
  { key: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink': '#F97316',
  Transportation: '#6366F1',
  Subscriptions: '#8B5CF6',
  Housing: '#3B82F6',
  Groceries: '#10B981',
  Health: '#EC4899',
  Fitness: '#F59E0B',
  Uncategorized: '#9CA3AF',
};

function fmt(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function DashboardScreen() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [period, setPeriod] = useState<Period>('this_month');
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [budgets, setBudgetsData] = useState<Record<string, number>>({});
  const [searchVisible, setSearchVisible] = useState(false);

  const customRange = period === 'custom'
    ? { from: toYMD(customFrom), to: toYMD(customTo) }
    : undefined;

  const { totalSavings, netWorth, recentTransactions, periodTransactions, periodSpend, periodIncome, prevPeriodSpend, prevPeriodIncome, monthlyTrend, loading } =
    useDashboard(period, customRange);

  useEffect(() => {
    if (state.dbReady) {
      getBudgets().then(setBudgetsData);
    }
  }, [state.dbReady, state.refreshKey]);

  // Compute spending by category for expense transactions in period
  const spendByCategory = periodTransactions
    .filter(t => t.type === 'expense')
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => {
      const rgb = colors === Colors.dark ? '156, 163, 175' : '107, 114, 128';
      return `rgba(${rgb}, ${opacity})`;
    },
    strokeWidth: 2,
    barPercentage: 0.6,
    decimalPlaces: 0,
    propsForLabels: { fontSize: 11 },
  }), [colors]);

  const pieData = Object.entries(spendByCategory)
    .filter(([, v]) => v > 0)
    .map(([name, population]) => ({
      name: name.length > 12 ? name.slice(0, 12) + '…' : name,
      population: Math.round(population * 100) / 100,
      color: CATEGORY_COLORS[name] ?? '#9CA3AF',
      legendFontColor: colors.text,
      legendFontSize: 11,
    }));

  // Income vs Spend bar chart
  const barData = {
    labels: ['Income', 'Spend'],
    datasets: [{ data: [Math.round(periodIncome), Math.round(periodSpend)] }],
  };

  const hasPieData = pieData.length > 0;
  const hasBarData = periodIncome > 0 || periodSpend > 0;

  const pace = calcSpendingPace(budgets, spendByCategory);
  const overBudgetCategories = Object.keys(budgets).filter(
    cat => (spendByCategory[cat] ?? 0) > budgets[cat]
  );

  const calcDelta = (current: number, prev: number): number | null => {
    if (period === 'custom' || prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100);
  };
  const spendDelta = calcDelta(periodSpend, prevPeriodSpend);
  const incomeDelta = calcDelta(periodIncome, prevPeriodIncome);

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Delete Transaction', `Delete this transaction?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await softDeleteTransaction(tx.id);
          dispatch({ type: 'REFRESH' });
        },
      },
    ]);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'income';
    return (
      <TouchableOpacity style={styles.txRow} onPress={() => setEditingTx(item)} activeOpacity={0.7}>
        <View style={styles.txLeft}>
          <Text style={styles.txMerchant}>{item.merchant || '—'}</Text>
          <View style={styles.txMeta}>
            <View style={[styles.badge, isIncome && styles.badgeIncome]}>
              <Text style={[styles.badgeText, isIncome && styles.badgeTextIncome]}>
                {item.category}
              </Text>
            </View>
            <View style={[styles.typePill, isIncome ? styles.typePillIncome : styles.typePillExpense]}>
              <Text style={styles.typePillText}>{isIncome ? 'Income' : 'Expense'}</Text>
            </View>
            <Text style={styles.txDate}>{item.date}</Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, isIncome && styles.txAmountIncome]}>
            {isIncome ? '+' : '-'}{fmt(item.amount, item.currency)}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={'trash-outline' as IoniconName} size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      {/* Net Worth Card */}
      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthAmount}>{fmt(netWorth, state.baseCurrency)}</Text>
        <View style={styles.netWorthRow}>
          <View style={styles.netWorthSub}>
            <Ionicons name={'wallet-outline' as IoniconName} size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.netWorthSubText}>Accounts {fmt(totalSavings, state.baseCurrency)}</Text>
          </View>
        </View>
      </View>

      {/* Period Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, period === p.key && styles.periodChipActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodChipText, period === p.key && styles.periodChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Custom date pickers */}
      {period === 'custom' && (
        <View style={styles.customRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(v => !v)}>
            <Text style={styles.dateBtnLabel}>From</Text>
            <Text style={styles.dateBtnValue}>{toYMD(customFrom)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSep}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(v => !v)}>
            <Text style={styles.dateBtnLabel}>To</Text>
            <Text style={styles.dateBtnValue}>{toYMD(customTo)}</Text>
          </TouchableOpacity>
        </View>
      )}
      {showFromPicker && (
        <DateTimePicker
          value={customFrom} mode="date" display="spinner" maximumDate={new Date()}
          onChange={(_, d) => { setShowFromPicker(false); if (d) setCustomFrom(d); }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={customTo} mode="date" display="spinner" maximumDate={new Date()}
          onChange={(_, d) => { setShowToPicker(false); if (d) setCustomTo(d); }}
        />
      )}

      {/* Period summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardIncome]}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryAmount, styles.summaryAmountIncome]}>{fmt(periodIncome, state.baseCurrency)}</Text>
          {incomeDelta !== null && (
            <Text style={incomeDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
              {incomeDelta >= 0 ? '▲' : '▼'} {Math.abs(incomeDelta)}%
            </Text>
          )}
        </View>
        <View style={[styles.summaryCard, styles.summaryCardExpense]}>
          <Text style={styles.summaryLabel}>Spend</Text>
          <Text style={[styles.summaryAmount, styles.summaryAmountExpense]}>{fmt(periodSpend, state.baseCurrency)}</Text>
          {spendDelta !== null && (
            <Text style={spendDelta > 0 ? styles.deltaDown : styles.deltaUp}>
              {spendDelta > 0 ? '▲' : '▼'} {Math.abs(spendDelta)}%
            </Text>
          )}
        </View>
      </View>

      {/* Spending Pace Card */}
      {period === 'this_month' && pace !== null && (
        <View style={styles.paceCard}>
          <View style={styles.paceTitleRow}>
            <Text style={styles.paceTitle}>Monthly Budget Pace</Text>
            <Text style={styles.paceDays}>{pace.daysRemaining} days left</Text>
          </View>
          <Text style={styles.paceNumbers}>
            {fmt(pace.totalSpent, state.baseCurrency)} spent of {fmt(pace.totalBudget, state.baseCurrency)} budget
          </Text>
          <View style={styles.paceTrack}>
            <View style={[
              styles.paceFill,
              { width: `${pace.budgetPct * 100}%` as unknown as number },
              pace.isOverPace && styles.paceFillOver,
            ]} />
            <View style={[
              styles.paceDayMark,
              { left: `${pace.dayPct * 100}%` as unknown as number },
            ]} />
          </View>
          <Text style={[styles.paceStatus, pace.isOverPace && styles.paceStatusOver]}>
            {pace.isOverPace ? '⚡ Spending faster than planned' : '✓ On pace'}
          </Text>
        </View>
      )}

      {/* Spending by Category chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Spending by Category</Text>
        {hasPieData ? (
          <PieChart
            data={pieData}
            width={SCREEN_WIDTH - 32}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="10"
            absolute={false}
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>No expenses logged this period</Text>
          </View>
        )}
      </View>

      {/* Income vs Spend chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Income vs Spend</Text>
        {hasBarData ? (
          <BarChart
            data={barData}
            width={SCREEN_WIDTH - 64}
            height={160}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1, index?: number) =>
                index === 0
                  ? `rgba(5, 150, 105, ${opacity})`
                  : `rgba(239, 68, 68, ${opacity})`,
            }}
            yAxisLabel="$"
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>No transactions logged this period</Text>
          </View>
        )}
      </View>

      {/* Over-Budget Alert */}
      {overBudgetCategories.length > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Ionicons name={'warning-outline' as IoniconName} size={16} color="#F59E0B" />
            <Text style={styles.alertTitle}>Over Budget</Text>
          </View>
          {overBudgetCategories.map(cat => (
            <View key={cat} style={styles.alertRow}>
              <Text style={styles.alertCat}>{cat}</Text>
              <Text style={styles.alertAmount}>
                {fmt(spendByCategory[cat], state.baseCurrency)} / {fmt(budgets[cat], state.baseCurrency)}
                {'  '}
                <Text style={styles.alertOver}>+{fmt((spendByCategory[cat] ?? 0) - budgets[cat], state.baseCurrency)}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Budget Gauges */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Budget Progress</Text>
        {Object.keys(budgets).length > 0 ? (
          Object.keys(budgets).map(cat => {
            const budget = budgets[cat] ?? 0;
            const spent = spendByCategory[cat] ?? 0;
            const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
            const over = spent > budget;
            return (
              <View key={cat} style={styles.gaugeRow}>
                <View style={styles.gaugeLabelRow}>
                  <Text style={styles.gaugeLabel}>{cat}</Text>
                  <Text style={[styles.gaugeAmount, over && styles.gaugeAmountOver]}>
                    {fmt(spent, state.baseCurrency)} / {fmt(budget, state.baseCurrency)}
                  </Text>
                </View>
                <View style={styles.gaugeTrack}>
                  <View
                    style={[
                      styles.gaugeFill,
                      { width: `${pct * 100}%` as unknown as number },
                      over && styles.gaugeFillOver,
                    ]}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>Set budgets in Settings to track progress</Text>
          </View>
        )}
      </View>

      {/* 6-Month Spending Trend */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>6-Month Spending Trend</Text>
        {monthlyTrend.length > 0 ? (
          <BarChart
            data={{
              labels: monthlyTrend.map(t => t.month.slice(5)),
              datasets: [{ data: monthlyTrend.map(t => Math.round(t.amount)) }],
            }}
            width={SCREEN_WIDTH - 64}
            height={160}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
            }}
            yAxisLabel="$"
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>Not enough data yet</Text>
          </View>
        )}
      </View>

      {/* Recent Transactions header */}
      <Text style={styles.sectionHeader}>Recent Transactions</Text>
    </>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          onPress={() => setSearchVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={'search-outline' as IoniconName} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={recentTransactions}
        keyExtractor={item => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={'receipt-outline' as IoniconName} size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>Log an expense or income from the Home tab</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {editingTx && (
        <EditTransactionSheet
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}

      {searchVisible && (
        <SearchSheet onClose={() => setSearchVisible(false)} />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: typeof Colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },

    // Screen header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },

    // Delta badges
    deltaUp: { fontSize: 11, fontWeight: '600', color: '#059669', marginTop: 2 },
    deltaDown: { fontSize: 11, fontWeight: '600', color: '#EF4444', marginTop: 2 },

    // Net Worth
    netWorthCard: {
      backgroundColor: c.primary, margin: 16, borderRadius: 16,
      padding: 20, alignItems: 'center',
    },
    netWorthLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
    netWorthAmount: { color: 'white', fontSize: 36, fontWeight: '700', marginBottom: 12 },
    netWorthRow: { flexDirection: 'row', gap: 24 },
    netWorthSub: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    netWorthSubText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },

    // Period selector
    periodScroll: { paddingHorizontal: 16, marginBottom: 8 },
    periodRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
    periodChip: {
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.surface,
    },
    periodChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    periodChipText: { fontSize: 14, color: c.text },
    periodChipTextActive: { color: 'white', fontWeight: '600' },

    // Custom date range
    customRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 12, marginHorizontal: 16, marginBottom: 8,
    },
    dateBtn: {
      flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 10, padding: 10, alignItems: 'center',
    },
    dateBtnLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 2 },
    dateBtnValue: { fontSize: 14, fontWeight: '600', color: c.text },
    dateSep: { fontSize: 16, color: c.textSecondary },

    // Summary row
    summaryRow: {
      flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 12,
    },
    summaryCard: {
      flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, backgroundColor: c.surface,
    },
    summaryCardIncome: { borderColor: '#D1FAE5' },
    summaryCardExpense: { borderColor: '#FEE2E2' },
    summaryLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginBottom: 4 },
    summaryAmount: { fontSize: 18, fontWeight: '700' },
    summaryAmountIncome: { color: '#059669' },
    summaryAmountExpense: { color: '#EF4444' },

    // Charts
    chartCard: {
      backgroundColor: c.surface, marginHorizontal: 16, marginBottom: 12,
      borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border,
    },
    chartTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 12 },
    chartEmpty: { paddingVertical: 24, alignItems: 'center' },
    chartEmptyText: { fontSize: 14, color: c.textSecondary },

    // Budget gauges
    gaugeRow: { marginBottom: 12 },
    gaugeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    gaugeLabel: { fontSize: 13, fontWeight: '500', color: c.text },
    gaugeAmount: { fontSize: 12, color: c.textSecondary },
    gaugeAmountOver: { color: '#EF4444', fontWeight: '600' },
    gaugeTrack: {
      height: 8, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden',
    },
    gaugeFill: {
      height: 8, backgroundColor: c.primary, borderRadius: 4,
    },
    gaugeFillOver: { backgroundColor: '#EF4444' },

    // Section header
    sectionHeader: {
      fontSize: 17, fontWeight: '700', color: c.text,
      marginHorizontal: 16, marginBottom: 8, marginTop: 4,
    },

    // Transaction rows
    txRow: {
      flexDirection: 'row', backgroundColor: c.surface,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
      alignItems: 'center',
    },
    txLeft: { flex: 1 },
    txMerchant: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 4 },
    txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    badge: {
      backgroundColor: c.primaryLight, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeIncome: { backgroundColor: '#ECFDF5' },
    badgeText: { fontSize: 11, color: c.primary, fontWeight: '500' },
    badgeTextIncome: { color: '#059669' },
    typePill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    typePillIncome: { backgroundColor: '#ECFDF5' },
    typePillExpense: { backgroundColor: '#FEF2F2' },
    typePillText: { fontSize: 10, fontWeight: '600', color: c.textSecondary },
    txDate: { fontSize: 12, color: c.textSecondary },
    txRight: { alignItems: 'flex-end', gap: 6 },
    txAmount: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
    txAmountIncome: { color: '#059669' },

    // Spending pace card
    paceCard: {
      backgroundColor: c.surface, marginHorizontal: 16, marginBottom: 12,
      borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border,
    },
    paceTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    paceTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    paceDays: { fontSize: 13, color: c.textSecondary },
    paceNumbers: { fontSize: 13, color: c.textSecondary, marginBottom: 8 },
    paceTrack: {
      height: 10, backgroundColor: c.border, borderRadius: 5,
      overflow: 'hidden', position: 'relative', marginBottom: 8,
    },
    paceFill: { height: 10, backgroundColor: c.primary, borderRadius: 5 },
    paceFillOver: { backgroundColor: '#EF4444' },
    paceDayMark: {
      position: 'absolute', top: 0, width: 2, height: 10, backgroundColor: c.text, opacity: 0.5,
    },
    paceStatus: { fontSize: 12, fontWeight: '600', color: '#059669' },
    paceStatusOver: { color: '#EF4444' },

    // Over-budget alert card
    alertCard: {
      marginHorizontal: 16, marginBottom: 12,
      borderRadius: 12, padding: 14,
      backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D',
    },
    alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
    alertRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 3,
    },
    alertCat: { fontSize: 13, color: '#92400E' },
    alertAmount: { fontSize: 12, color: '#92400E' },
    alertOver: { fontWeight: '700', color: '#EF4444' },

    // Empty state
    empty: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySub: { fontSize: 14, color: c.textSecondary },
  });
}
