import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, FlatList, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RegularExpense, getRegularExpenses, softDeleteRegularExpense,
  updateExpensesOrder, FREQUENCY_MONTHLY_MULTIPLIER, Frequency,
} from '../../db/regularExpenses';
import { Transaction, getTransactions } from '../../db/transactions';
import { useApp } from '../../context/AppContext';
import AddEditExpenseSheet from '../../components/AddEditExpenseSheet';
import EditTransactionSheet from '../../components/EditTransactionSheet';
import { Period, getDateRange } from '../../utils/dateRanges';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type SubTab = 'one_time' | 'recurring';

function fmt(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function isOverdue(expense: RegularExpense): boolean {
  if (expense.due_day === null || expense.frequency !== 'monthly') return false;
  return new Date().getDate() > expense.due_day;
}

const EXPENSE_PERIODS: { key: Period; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: '3 Months' },
];

export default function ExpensesScreen() {
  const { state, dispatch } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('one_time');

  // One-time expenses state
  const [oneTimeTxns, setOneTimeTxns] = useState<Transaction[]>([]);
  const [oneTimePeriod, setOneTimePeriod] = useState<Period>('this_month');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Recurring expenses state
  const [expenses, setExpenses] = useState<RegularExpense[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RegularExpense | null>(null);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { dateFrom, dateTo } = getDateRange(oneTimePeriod);
      const [txns, recurring] = await Promise.all([
        getTransactions({ type: 'expense', dateFrom, dateTo }),
        getRegularExpenses(),
      ]);
      setOneTimeTxns(txns);
      setExpenses(recurring);
    } finally {
      setLoading(false);
    }
  }, [oneTimePeriod]);

  useEffect(() => {
    if (state.dbReady) loadData();
  }, [state.dbReady, state.refreshKey, loadData]);

  const oneTimeTotal = oneTimeTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyTotal = expenses.reduce((sum, e) => {
    const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[e.frequency as Frequency] ?? 1;
    return sum + e.amount * multiplier;
  }, 0);

  // ─── Recurring handlers ──────────────────────────────────────────────────────

  const handleDeleteExpense = (expense: RegularExpense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await softDeleteRegularExpense(expense.id);
            dispatch({ type: 'REFRESH' });
          },
        },
      ]
    );
  };

  const moveExpense = async (index: number, direction: 'up' | 'down') => {
    const newExpenses = [...expenses];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newExpenses.length) return;
    [newExpenses[index], newExpenses[swapIndex]] = [newExpenses[swapIndex], newExpenses[index]];
    setExpenses(newExpenses);
    await updateExpensesOrder(newExpenses.map(e => e.id));
  };

  const openAdd = () => {
    setEditingExpense(null);
    setSheetVisible(true);
  };

  const openEdit = (expense: RegularExpense) => {
    setEditingExpense(expense);
    setSheetVisible(true);
  };

  const handleSheetClose = () => {
    setSheetVisible(false);
    setEditingExpense(null);
    dispatch({ type: 'REFRESH' });
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderOneTimeTx = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={styles.txRow} onPress={() => setEditingTx(item)} activeOpacity={0.7}>
      <View style={styles.txLeft}>
        <Text style={styles.txMerchant}>{item.merchant || '—'}</Text>
        <View style={styles.txMeta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
          <Text style={styles.txDate}>{item.date}</Text>
        </View>
      </View>
      <Text style={styles.txAmount}>{fmt(item.amount, item.currency)}</Text>
    </TouchableOpacity>
  );

  const renderRecurring = ({ item, index }: { item: RegularExpense; index: number }) => {
    const overdue = isOverdue(item);
    return (
      <View style={[styles.row, overdue && styles.rowOverdue]}>
        {overdue && <View style={styles.overdueBar} />}
        <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Text style={styles.expenseName}>{item.name}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.category}</Text>
              </View>
              <View style={[styles.badge, styles.freqBadge]}>
                <Text style={[styles.badgeText, styles.freqBadgeText]}>
                  {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amount}>{fmt(item.amount, item.currency)}</Text>
            {overdue && <Text style={styles.overdueLabel}>Overdue</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
            onPress={() => moveExpense(index, 'up')}
            disabled={index === 0}
          >
            <Ionicons name={'chevron-up' as IoniconName} size={16} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.orderBtn, index === expenses.length - 1 && styles.orderBtnDisabled]}
            onPress={() => moveExpense(index, 'down')}
            disabled={index === expenses.length - 1}
          >
            <Ionicons
              name={'chevron-down' as IoniconName}
              size={16}
              color={index === expenses.length - 1 ? '#D1D5DB' : '#6B7280'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteExpense(item)}>
            <Ionicons name={'trash-outline' as IoniconName} size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Sub-tab headers ─────────────────────────────────────────────────────────

  const OneTimeHeader = () => (
    <>
      <View style={styles.spendCard}>
        <Text style={styles.spendLabel}>
          {EXPENSE_PERIODS.find(p => p.key === oneTimePeriod)?.label} Spend
        </Text>
        <Text style={styles.spendAmount}>{fmt(oneTimeTotal)}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
        <View style={styles.periodRow}>
          {EXPENSE_PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, oneTimePeriod === p.key && styles.periodChipActive]}
              onPress={() => setOneTimePeriod(p.key)}
            >
              <Text style={[styles.periodChipText, oneTimePeriod === p.key && styles.periodChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </>
  );

  const RecurringHeader = () => (
    <View style={styles.spendCard}>
      <Text style={styles.spendLabel}>Est. Monthly Total</Text>
      <Text style={styles.spendAmount}>{fmt(monthlyTotal)}</Text>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#EF4444" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Sub-tab bar */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'one_time' && styles.subTabActive]}
          onPress={() => setSubTab('one_time')}
        >
          <Text style={[styles.subTabText, subTab === 'one_time' && styles.subTabTextActive]}>
            One-Time
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'recurring' && styles.subTabActive]}
          onPress={() => setSubTab('recurring')}
        >
          <Text style={[styles.subTabText, subTab === 'recurring' && styles.subTabTextActive]}>
            Recurring
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'one_time' ? (
        <FlatList
          data={oneTimeTxns}
          keyExtractor={item => item.id}
          renderItem={renderOneTimeTx}
          ListHeaderComponent={<OneTimeHeader />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={'receipt-outline' as IoniconName} size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No expenses this period</Text>
              <Text style={styles.emptySub}>Log an expense from the Home tab</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      ) : (
        <>
          <FlatList
            data={expenses}
            keyExtractor={item => item.id}
            renderItem={renderRecurring}
            ListHeaderComponent={<RecurringHeader />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name={'repeat-outline' as IoniconName} size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>No recurring expenses</Text>
                <Text style={styles.emptySub}>Tap + to add a recurring expense</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 100 }}
          />

          <TouchableOpacity style={styles.fab} onPress={openAdd}>
            <Ionicons name={'add' as IoniconName} size={28} color="white" />
          </TouchableOpacity>
        </>
      )}

      {sheetVisible && (
        <AddEditExpenseSheet
          expense={editingExpense}
          onClose={handleSheetClose}
        />
      )}

      {editingTx && (
        <EditTransactionSheet
          transaction={editingTx}
          onClose={() => { setEditingTx(null); dispatch({ type: 'REFRESH' }); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Sub-tab bar
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  subTab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: '#EF4444' },
  subTabText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  subTabTextActive: { color: '#EF4444' },

  // Period selector
  periodScroll: { paddingHorizontal: 16, marginBottom: 8 },
  periodRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  periodChip: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'white',
  },
  periodChipActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  periodChipText: { fontSize: 14, color: '#374151' },
  periodChipTextActive: { color: 'white', fontWeight: '600' },

  // Spend card
  spendCard: {
    backgroundColor: 'white', margin: 16,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  spendLabel: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  spendAmount: { fontSize: 20, fontWeight: '700', color: '#EF4444' },

  // One-time transaction rows
  txRow: {
    flexDirection: 'row', backgroundColor: 'white',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDate: { fontSize: 12, color: '#9CA3AF' },
  txAmount: { fontSize: 15, fontWeight: '600', color: '#111827' },

  // Recurring expense rows
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', paddingRight: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  rowOverdue: { backgroundColor: '#FFFBEB' },
  overdueBar: { width: 4, alignSelf: 'stretch', backgroundColor: '#F59E0B', borderRadius: 2, marginLeft: 4 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 12, marginRight: 8 },
  rowLeft: { flex: 1 },
  expenseName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  badgeRow: { flexDirection: 'row', marginTop: 4, gap: 6 },
  badge: {
    alignSelf: 'flex-start', backgroundColor: '#FEF2F2',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  freqBadge: { backgroundColor: '#F3F4F6' },
  freqBadgeText: { color: '#6B7280' },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '600', color: '#111827' },
  overdueLabel: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 2 },
  rowActions: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  orderBtn: { padding: 4 },
  orderBtnDisabled: { opacity: 0.3 },
  deleteBtn: { padding: 4, marginTop: 4 },

  // Empty states
  empty: { alignItems: 'center', gap: 8, paddingTop: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    backgroundColor: '#EF4444', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
});
