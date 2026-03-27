import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RegularExpense, getRegularExpenses, softDeleteRegularExpense,
  updateExpensesOrder, FREQUENCY_MONTHLY_MULTIPLIER, Frequency,
} from '../../db/regularExpenses';
import { useApp } from '../../context/AppContext';
import AddEditExpenseSheet from '../../components/AddEditExpenseSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function isOverdue(expense: RegularExpense): boolean {
  if (expense.due_day === null || expense.frequency !== 'monthly') return false;
  return new Date().getDate() > expense.due_day;
}

export default function ExpensesScreen() {
  const { state, dispatch } = useApp();
  const [expenses, setExpenses] = useState<RegularExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RegularExpense | null>(null);

  const loadExpenses = useCallback(async () => {
    try {
      const data = await getRegularExpenses();
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.dbReady) loadExpenses();
  }, [state.dbReady, state.refreshKey, loadExpenses]);

  const monthlyTotal = expenses.reduce((sum, e) => {
    const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[e.frequency as Frequency] ?? 1;
    return sum + e.amount * multiplier;
  }, 0);

  const handleDelete = (expense: RegularExpense) => {
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

  const renderItem = ({ item, index }: { item: RegularExpense; index: number }) => {
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
                <Text style={styles.badgeText}>
                  {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amount}>
              {new Intl.NumberFormat('en-CA', { style: 'currency', currency: item.currency }).format(item.amount)}
            </Text>
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
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name={'trash-outline' as IoniconName} size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Est. Monthly Total</Text>
        <Text style={styles.totalAmount}>
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(monthlyTotal)}
        </Text>
      </View>

      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={'receipt-outline' as IoniconName} size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySub}>Tap + to add your first recurring expense</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name={'add' as IoniconName} size={28} color="white" />
      </TouchableOpacity>

      {sheetVisible && (
        <AddEditExpenseSheet
          expense={editingExpense}
          onClose={handleSheetClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  totalCard: {
    backgroundColor: '#2563EB', margin: 16, borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
  totalAmount: { color: 'white', fontSize: 32, fontWeight: '700' },
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
    alignSelf: 'flex-start', backgroundColor: '#EFF6FF',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  freqBadge: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 11, color: '#2563EB', fontWeight: '500' },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '600', color: '#111827' },
  overdueLabel: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 2 },
  rowActions: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  orderBtn: { padding: 4 },
  orderBtnDisabled: { opacity: 0.3 },
  deleteBtn: { padding: 4, marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    backgroundColor: '#2563EB', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
});
