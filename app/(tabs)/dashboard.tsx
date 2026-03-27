import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard } from '../../hooks/useDashboard';
import { softDeleteTransaction, Transaction } from '../../db/transactions';
import { useApp } from '../../context/AppContext';
import { Period } from '../../utils/dateRanges';
import EditTransactionSheet from '../../components/EditTransactionSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: '3 Months' },
  { key: 'custom', label: 'Custom' },
];

function fmt(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function DashboardScreen() {
  const { dispatch } = useApp();
  const [period, setPeriod] = useState<Period>('this_month');
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const customRange = period === 'custom'
    ? { from: toYMD(customFrom), to: toYMD(customTo) }
    : undefined;

  const { totalSavings, netWorth, recentTransactions, periodSpend, periodIncome, loading } =
    useDashboard(period, customRange);

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
        <Text style={styles.netWorthAmount}>{fmt(netWorth)}</Text>
        <View style={styles.netWorthRow}>
          <View style={styles.netWorthSub}>
            <Ionicons name={'wallet-outline' as IoniconName} size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.netWorthSubText}>Accounts {fmt(totalSavings)}</Text>
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
          <Text style={[styles.summaryAmount, styles.summaryAmountIncome]}>{fmt(periodIncome)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardExpense]}>
          <Text style={styles.summaryLabel}>Spend</Text>
          <Text style={[styles.summaryAmount, styles.summaryAmountExpense]}>{fmt(periodSpend)}</Text>
        </View>
      </View>

      {/* Recent Transactions header */}
      <Text style={styles.sectionHeader}>Recent Transactions</Text>
    </>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Net Worth
  netWorthCard: {
    backgroundColor: '#2563EB', margin: 16, borderRadius: 16,
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
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'white',
  },
  periodChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  periodChipText: { fontSize: 14, color: '#374151' },
  periodChipTextActive: { color: 'white', fontWeight: '600' },

  // Custom date range
  customRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginHorizontal: 16, marginBottom: 8,
  },
  dateBtn: {
    flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  dateBtnLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  dateBtnValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dateSep: { fontSize: 16, color: '#9CA3AF' },

  // Summary row
  summaryRow: {
    flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 8,
  },
  summaryCard: {
    flex: 1, borderRadius: 12, padding: 14, borderWidth: 1,
    backgroundColor: 'white',
  },
  summaryCardIncome: { borderColor: '#D1FAE5' },
  summaryCardExpense: { borderColor: '#FEE2E2' },
  summaryLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  summaryAmount: { fontSize: 18, fontWeight: '700' },
  summaryAmountIncome: { color: '#059669' },
  summaryAmountExpense: { color: '#EF4444' },

  // Section header
  sectionHeader: {
    fontSize: 17, fontWeight: '700', color: '#111827',
    marginHorizontal: 16, marginBottom: 8, marginTop: 4,
  },

  // Transaction rows
  txRow: {
    flexDirection: 'row', backgroundColor: 'white',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeIncome: { backgroundColor: '#ECFDF5' },
  badgeText: { fontSize: 11, color: '#2563EB', fontWeight: '500' },
  badgeTextIncome: { color: '#059669' },
  typePill: {
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  typePillIncome: { backgroundColor: '#ECFDF5' },
  typePillExpense: { backgroundColor: '#FEF2F2' },
  typePillText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  txDate: { fontSize: 12, color: '#9CA3AF' },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  txAmountIncome: { color: '#059669' },

  // Empty state
  empty: { alignItems: 'center', gap: 8, paddingTop: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
});
