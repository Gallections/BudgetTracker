import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  FlatList, SafeAreaView, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTransactions, Transaction } from '../db/transactions';
import { CATEGORIES } from '../constants/categories';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../constants/colors';
import EditTransactionSheet from './EditTransactionSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type TypeFilter = 'all' | 'income' | 'expense';

interface Props {
  onClose: () => void;
}

function fmt(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

export default function SearchSheet({ onClose }: Props) {
  const { state } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTransactions({
      search: query.trim() || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      category: categoryFilter ?? undefined,
    }).then(txns => {
      if (!cancelled) {
        setResults(txns);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [query, typeFilter, categoryFilter, state.refreshKey]);

  const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expense' },
  ];

  const renderRow = ({ item }: { item: Transaction }) => {
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
            <Text style={styles.txDate}>{item.date}</Text>
          </View>
        </View>
        <Text style={[styles.txAmount, isIncome && styles.txAmountIncome]}>
          {isIncome ? '+' : '-'}{fmt(item.amount, item.currency)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={'arrow-back' as IoniconName} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search input */}
        <View style={styles.searchRow}>
          <Ionicons name={'search-outline' as IoniconName} size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Merchant or notes..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={'close-circle' as IoniconName} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter */}
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.typeChip, typeFilter === opt.key && styles.typeChipActive]}
              onPress={() => setTypeFilter(opt.key)}
            >
              <Text style={[styles.typeChipText, typeFilter === opt.key && styles.typeChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          <View style={styles.catRow}>
            <TouchableOpacity
              style={[styles.catChip, categoryFilter === null && styles.catChipActive]}
              onPress={() => setCategoryFilter(null)}
            >
              <Text style={[styles.catChipText, categoryFilter === null && styles.catChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, categoryFilter === cat && styles.catChipActive]}
                onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                <Text style={[styles.catChipText, categoryFilter === cat && styles.catChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Results */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={renderRow}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name={'search-outline' as IoniconName} size={40} color={colors.border} />
                <Text style={styles.emptyText}>No transactions found</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>

      {editingTx && (
        <EditTransactionSheet
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}
    </View>
  );
}

function makeStyles(c: typeof Colors.light) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.background,
      zIndex: 100,
    },
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 10, marginHorizontal: 16, marginVertical: 12,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: c.text },
    typeRow: {
      flexDirection: 'row', gap: 8,
      paddingHorizontal: 16, marginBottom: 8,
    },
    typeChip: {
      flex: 1, paddingVertical: 7, alignItems: 'center',
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface,
    },
    typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeChipText: { fontSize: 13, fontWeight: '600', color: c.text },
    typeChipTextActive: { color: 'white' },
    catScroll: { paddingHorizontal: 16, marginBottom: 4 },
    catRow: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
    catChip: {
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.surface,
    },
    catChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    catChipText: { fontSize: 12, color: c.text },
    catChipTextActive: { color: 'white', fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    txRow: {
      flexDirection: 'row', backgroundColor: c.surface,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
      alignItems: 'center',
    },
    txLeft: { flex: 1 },
    txMerchant: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 4 },
    txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge: { backgroundColor: c.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    badgeIncome: { backgroundColor: '#ECFDF5' },
    badgeText: { fontSize: 11, color: c.primary, fontWeight: '500' },
    badgeTextIncome: { color: '#059669' },
    txDate: { fontSize: 12, color: c.textSecondary },
    txAmount: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
    txAmountIncome: { color: '#059669' },
    empty: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyText: { fontSize: 15, color: c.textSecondary },
  });
}
