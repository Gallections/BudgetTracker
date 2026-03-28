import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, FlatList, ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { SavingsAccount, getSavingsAccounts, softDeleteSavingsAccount, updateSavingsOrder } from '../../db/savings';
import { Transaction, getTransactions } from '../../db/transactions';
import { useApp } from '../../context/AppContext';
import AddEditAccountSheet from '../../components/AddEditAccountSheet';
import EditTransactionSheet from '../../components/EditTransactionSheet';
import { Period, getDateRange } from '../../utils/dateRanges';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function fmt(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

const INCOME_PERIODS: { key: Period; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3_months', label: '3 Months' },
];

export default function SavingsScreen() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [incomePeriod, setIncomePeriod] = useState<Period>('this_month');

  const loadData = useCallback(async () => {
    try {
      const { dateFrom, dateTo } = getDateRange(incomePeriod);
      const [accts, txns] = await Promise.all([
        getSavingsAccounts(),
        getTransactions({ type: 'income', dateFrom, dateTo }),
      ]);
      setAccounts(accts);
      setIncomeTransactions(txns);
    } finally {
      setLoading(false);
    }
  }, [incomePeriod]);

  useEffect(() => {
    if (state.dbReady) loadData();
  }, [state.dbReady, state.refreshKey, loadData]);

  useFocusEffect(useCallback(() => {
    if (state.dbReady) loadData();
  }, [state.dbReady, loadData]));

  const totalBalanceCAD = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

  const handleDelete = (account: SavingsAccount) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${account.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await softDeleteSavingsAccount(account.id);
            dispatch({ type: 'REFRESH' });
          },
        },
      ]
    );
  };

  const moveAccount = async (index: number, direction: 'up' | 'down') => {
    const newAccounts = [...accounts];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newAccounts.length) return;
    [newAccounts[index], newAccounts[swapIndex]] = [newAccounts[swapIndex], newAccounts[index]];
    setAccounts(newAccounts);
    await updateSavingsOrder(newAccounts.map(a => a.id));
  };

  const openAdd = () => {
    setEditingAccount(null);
    setSheetVisible(true);
  };

  const openEdit = (account: SavingsAccount) => {
    setEditingAccount(account);
    setSheetVisible(true);
  };

  const handleSheetClose = () => {
    setSheetVisible(false);
    setEditingAccount(null);
    dispatch({ type: 'REFRESH' });
  };

  const renderAccount = ({ item, index }: { item: SavingsAccount; index: number }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)} activeOpacity={0.7}>
        <View style={styles.rowLeft}>
          <Text style={styles.accountName}>{item.name}</Text>
          {item.institution ? <Text style={styles.institution}>{item.institution}</Text> : null}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.account_type}</Text>
          </View>
        </View>
        <Text style={styles.balance}>
          {fmt(item.balance, item.currency)}
        </Text>
      </TouchableOpacity>

      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
          onPress={() => moveAccount(index, 'up')}
          disabled={index === 0}
        >
          <Ionicons name={'chevron-up' as IoniconName} size={16} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.orderBtn, index === accounts.length - 1 && styles.orderBtnDisabled]}
          onPress={() => moveAccount(index, 'down')}
          disabled={index === accounts.length - 1}
        >
          <Ionicons name={'chevron-down' as IoniconName} size={16} color={index === accounts.length - 1 ? '#D1D5DB' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name={'trash-outline' as IoniconName} size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderIncomeTx = ({ item }: { item: Transaction }) => (
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

  const ListHeader = () => (
    <>
      {/* Accounts section */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Accounts</Text>
        <Text style={styles.totalAmount}>{fmt(totalBalanceCAD, state.baseCurrency)}</Text>
      </View>
      <Text style={styles.sectionHeader}>Accounts</Text>

      {accounts.length === 0 && (
        <View style={styles.inlineEmpty}>
          <Text style={styles.inlineEmptyText}>No accounts yet — tap + to add one</Text>
        </View>
      )}

      {accounts.map((item, index) => (
        <React.Fragment key={item.id}>{renderAccount({ item, index })}</React.Fragment>
      ))}

      {/* Income History section */}
      <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Income History</Text>

      {/* Period chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
        <View style={styles.periodRow}>
          {INCOME_PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, incomePeriod === p.key && styles.periodChipActive]}
              onPress={() => setIncomePeriod(p.key)}
            >
              <Text style={[styles.periodChipText, incomePeriod === p.key && styles.periodChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Income total card */}
      <View style={styles.incomeCard}>
        <Text style={styles.incomeLabel}>
          {INCOME_PERIODS.find(p => p.key === incomePeriod)?.label} Income
        </Text>
        <Text style={styles.incomeAmount}>{fmt(totalIncome, state.baseCurrency)}</Text>
      </View>
    </>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={incomeTransactions}
        keyExtractor={item => item.id}
        renderItem={renderIncomeTx}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={'cash-outline' as IoniconName} size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No income recorded</Text>
            <Text style={styles.emptySub}>Log income from the Home tab</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name={'add' as IoniconName} size={28} color="white" />
      </TouchableOpacity>

      {sheetVisible && (
        <AddEditAccountSheet
          account={editingAccount}
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

function makeStyles(c: typeof Colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
    totalCard: {
      backgroundColor: '#059669', margin: 16, borderRadius: 16,
      padding: 20, alignItems: 'center',
    },
    totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
    totalAmount: { color: 'white', fontSize: 32, fontWeight: '700' },
    sectionHeader: {
      fontSize: 16, fontWeight: '700', color: c.text,
      marginHorizontal: 16, marginBottom: 8,
    },
    inlineEmpty: { paddingHorizontal: 16, paddingVertical: 12 },
    inlineEmptyText: { fontSize: 14, color: c.textSecondary },
    row: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, paddingLeft: 16, paddingRight: 8, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 8 },
    rowLeft: { flex: 1 },
    accountName: { fontSize: 16, fontWeight: '600', color: c.text },
    institution: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    typeBadge: {
      alignSelf: 'flex-start', backgroundColor: '#ECFDF5',
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
    },
    typeBadgeText: { fontSize: 11, color: '#059669', fontWeight: '500' },
    balance: { fontSize: 16, fontWeight: '600', color: c.text, marginLeft: 8 },
    rowActions: { flexDirection: 'column', alignItems: 'center', gap: 2 },
    orderBtn: { padding: 4 },
    orderBtnDisabled: { opacity: 0.3 },
    deleteBtn: { padding: 4, marginTop: 4 },
    periodScroll: { paddingHorizontal: 16, marginBottom: 8 },
    periodRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
    periodChip: {
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.surface,
    },
    periodChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    periodChipText: { fontSize: 14, color: c.text },
    periodChipTextActive: { color: 'white', fontWeight: '600' },
    incomeCard: {
      backgroundColor: c.surface, marginHorizontal: 16, marginBottom: 8,
      borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    incomeLabel: { fontSize: 15, color: c.textSecondary, fontWeight: '500' },
    incomeAmount: { fontSize: 20, fontWeight: '700', color: '#059669' },
    txRow: {
      flexDirection: 'row', backgroundColor: c.surface,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
      alignItems: 'center',
    },
    txLeft: { flex: 1 },
    txMerchant: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 4 },
    txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 11, color: '#059669', fontWeight: '500' },
    txDate: { fontSize: 12, color: c.textSecondary },
    txAmount: { fontSize: 15, fontWeight: '600', color: '#059669' },
    empty: { alignItems: 'center', gap: 8, paddingTop: 24, paddingBottom: 24 },
    emptyText: { fontSize: 16, fontWeight: '600', color: c.text },
    emptySub: { fontSize: 14, color: c.textSecondary },
    fab: {
      position: 'absolute', bottom: 32, right: 24,
      backgroundColor: '#059669', width: 56, height: 56,
      borderRadius: 28, justifyContent: 'center', alignItems: 'center',
      elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 4,
    },
  });
}
