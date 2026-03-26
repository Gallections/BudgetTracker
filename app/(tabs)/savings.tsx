import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsAccount, getSavingsAccounts, softDeleteSavingsAccount, updateSavingsOrder } from '../../db/savings';
import { useApp } from '../../context/AppContext';
import AddEditAccountSheet from '../../components/AddEditAccountSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function SavingsScreen() {
  const { state, dispatch } = useApp();
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await getSavingsAccounts();
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.dbReady) loadAccounts();
  }, [state.dbReady, state.refreshKey, loadAccounts]);

  const totalBalanceCAD = accounts.reduce((sum, a) => sum + a.balance, 0);

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

  const renderItem = ({ item, index }: { item: SavingsAccount; index: number }) => (
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
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: item.currency }).format(item.balance)}
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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Savings</Text>
        <Text style={styles.totalAmount}>
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(totalBalanceCAD)}
        </Text>
      </View>

      {accounts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={'wallet-outline' as IoniconName} size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No accounts yet</Text>
          <Text style={styles.emptySub}>Tap + to add your first account</Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name={'add' as IoniconName} size={28} color="white" />
      </TouchableOpacity>

      {sheetVisible && (
        <AddEditAccountSheet
          account={editingAccount}
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
    backgroundColor: 'white', paddingLeft: 16, paddingRight: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 8 },
  rowLeft: { flex: 1 },
  accountName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  institution: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  typeBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EFF6FF',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  typeBadgeText: { fontSize: 11, color: '#2563EB', fontWeight: '500' },
  balance: { fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 },
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
