import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RegularExpense, markExpensePosted } from '../db/regularExpenses';
import { insertTransaction } from '../db/transactions';
import { toBaseCurrency } from '../utils/currencyConvert';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function fmt(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

interface Props {
  expenses: RegularExpense[];
  baseCurrency: string;
  rates: Record<string, number>;
  onClose: () => void;
  onPosted: () => void;
}

export default function DueExpenseSheet({ expenses, baseCurrency, rates, onClose, onPosted }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [checked, setChecked] = useState<Set<string>>(new Set(expenses.map(e => e.id)));
  const [posting, setPosting] = useState(false);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handlePost = async () => {
    if (checked.size === 0) return;
    setPosting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const id of checked) {
        const expense = expenses.find(e => e.id === id);
        if (!expense) continue;
        await insertTransaction({
          amount: expense.amount,
          currency: expense.currency,
          amount_in_base_currency: toBaseCurrency(expense.amount, expense.currency, baseCurrency, rates),
          category: expense.category,
          merchant: expense.name,
          notes: null,
          date: today,
          type: 'expense',
          source_account_id: null,
        });
        await markExpensePosted(id);
      }
      onPosted();
    } finally {
      setPosting(false);
    }
  };

  const renderItem = ({ item }: { item: RegularExpense }) => {
    const isChecked = checked.has(item.id);
    return (
      <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)} activeOpacity={0.7}>
        <View style={styles.rowLeft}>
          <Text style={styles.expenseName}>{item.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{item.category}</Text>
            </View>
            <Text style={styles.amountText}>{fmt(item.amount, item.currency)}</Text>
          </View>
        </View>
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Ionicons name={'checkmark' as IoniconName} size={14} color="white" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name={'calendar-outline' as IoniconName} size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>Bills Due This Month</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={'close' as IoniconName} size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          These recurring expenses haven't been logged yet this month.
        </Text>

        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          style={styles.list}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.logBtn, (checked.size === 0 || posting) && styles.logBtnDisabled]}
            onPress={handlePost}
            disabled={checked.size === 0 || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.logBtnText}>Log Selected ({checked.size})</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: typeof Colors.light) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
      zIndex: 100,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, paddingBottom: 12 },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    rowLeft: { flex: 1 },
    expenseName: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 4 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    catBadge: {
      backgroundColor: '#FEF2F2', borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    catBadgeText: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
    amountText: { fontSize: 13, color: c.textSecondary },
    checkbox: {
      width: 22, height: 22, borderRadius: 6,
      borderWidth: 2, borderColor: c.border,
      justifyContent: 'center', alignItems: 'center',
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    logBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
    },
    logBtnDisabled: { opacity: 0.5 },
    logBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  });
}
