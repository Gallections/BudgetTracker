import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, updateTransaction, softDeleteTransaction } from '../db/transactions';
import { CATEGORIES, Category } from '../constants/categories';
import { SUPPORTED_CURRENCIES } from '../constants/currencies';
import { useApp } from '../context/AppContext';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { toBaseCurrency } from '../utils/currencyConvert';
import { getSavingsAccounts, SavingsAccount, adjustAccountBalance } from '../db/savings';
import { setMerchantOverride } from '../db/userSettings';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

export default function EditTransactionSheet({ transaction, onClose }: Props) {
  const { state, dispatch } = useApp();
  const { rates, stale: ratesStale } = useExchangeRates(state.baseCurrency);

  const [amount, setAmount] = useState(transaction.amount.toString());
  const [currency, setCurrency] = useState(transaction.currency);
  const [category, setCategory] = useState<Category>(transaction.category as Category);
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [date, setDate] = useState(new Date(transaction.date + 'T12:00:00'));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState(transaction.notes ?? '');
  const [txType, setTxType] = useState<'income' | 'expense'>(transaction.type ?? 'expense');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(transaction.source_account_id ?? null);

  useEffect(() => {
    getSavingsAccounts().then(setAccounts);
  }, []);

  const handleSave = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Required', 'Enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      const newAmountInBase = toBaseCurrency(amountNum, currency, state.baseCurrency, rates);

      // Save merchant override if category was manually changed
      const trimmedMerchant = merchant.trim();
      if (trimmedMerchant && category !== transaction.category) {
        await setMerchantOverride(trimmedMerchant, category);
      }

      // Reverse old balance deduction
      if (transaction.type === 'expense' && transaction.source_account_id) {
        await adjustAccountBalance(transaction.source_account_id, +transaction.amount_in_base_currency);
      }
      // Apply new balance deduction
      if (txType === 'expense' && sourceAccountId) {
        await adjustAccountBalance(sourceAccountId, -newAmountInBase);
      }

      await updateTransaction({
        id: transaction.id,
        amount: amountNum,
        currency,
        amount_in_base_currency: newAmountInBase,
        category,
        merchant: merchant.trim(),
        notes: notes.trim() || null,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        type: txType,
        source_account_id: txType === 'expense' ? sourceAccountId : null,
        regular_expense_id: transaction.regular_expense_id ?? null,
      });
      dispatch({ type: 'REFRESH' });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      `Delete this transaction?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (transaction.type === 'expense' && transaction.source_account_id) {
              await adjustAccountBalance(transaction.source_account_id, +transaction.amount_in_base_currency);
            }
            await softDeleteTransaction(transaction.id);
            dispatch({ type: 'REFRESH' });
            onClose();
          },
        },
      ]
    );
  };

  const formattedDate = date.toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name={'close' as IoniconName} size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Transaction</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Type">
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'expense' && styles.typeBtnExpense]}
                onPress={() => setTxType('expense')}
              >
                <Text style={[styles.typeBtnText, txType === 'expense' && styles.typeBtnTextActive]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'income' && styles.typeBtnIncome]}
                onPress={() => setTxType('income')}
              >
                <Text style={[styles.typeBtnText, txType === 'income' && styles.typeBtnTextActive]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>
          </Field>

          <Field label="Amount *">
            <TextInput
              style={styles.input} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" placeholder="0.00"
            />
          </Field>

          <Field label="Currency">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {SUPPORTED_CURRENCIES.map(c => (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.chip, currency === c.code && styles.chipActive]}
                    onPress={() => setCurrency(c.code)}
                  >
                    <Text style={[styles.chipText, currency === c.code && styles.chipTextActive]}>
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          {ratesStale && currency !== state.baseCurrency && (
            <View style={styles.rateWarning}>
              <Ionicons name={'warning-outline' as IoniconName} size={14} color="#92400E" />
              <Text style={styles.rateWarningText}>
                Exchange rates unavailable — amount stored at 1:1
              </Text>
            </View>
          )}

          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          <Field label="Merchant">
            <TextInput
              style={styles.input} value={merchant} onChangeText={setMerchant}
              placeholder="e.g. Tim Hortons"
            />
          </Field>

          <Field label="Date">
            <TouchableOpacity
              style={[styles.input, styles.dateButton]}
              onPress={() => setShowDatePicker(v => !v)}
            >
              <Text style={styles.dateText}>{formattedDate}</Text>
              <Ionicons name={'calendar-outline' as IoniconName} size={18} color="#6B7280" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes} onChangeText={setNotes}
              multiline numberOfLines={3}
              placeholder="Optional notes..."
            />
          </Field>

          {txType === 'expense' && accounts.length > 0 && (
            <Field label="From account">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, sourceAccountId === null && styles.chipActive]}
                    onPress={() => setSourceAccountId(null)}
                  >
                    <Text style={[styles.chipText, sourceAccountId === null && styles.chipTextActive]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {accounts.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.chip, sourceAccountId === a.id && styles.chipActive]}
                      onPress={() => setSourceAccountId(a.id)}
                    >
                      <Text style={[styles.chipText, sourceAccountId === a.id && styles.chipTextActive]}>
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Field>
          )}

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name={'trash-outline' as IoniconName} size={18} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete Transaction</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#111827' },
  saveBtn: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  form: { flex: 1, paddingHorizontal: 20 },
  field: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#111827',
  },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 16, color: '#111827' },
  multiline: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', paddingBottom: 4 },
  chip: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: '#F9FAFB',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 32, marginBottom: 16, padding: 14,
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  typeBtnExpense: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  typeBtnIncome: { backgroundColor: '#059669', borderColor: '#059669' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive: { color: 'white' },
  rateWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  rateWarningText: { fontSize: 12, color: '#92400E', flex: 1 },
});
