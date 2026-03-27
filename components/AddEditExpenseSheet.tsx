import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RegularExpense, upsertRegularExpense, FREQUENCIES, Frequency } from '../db/regularExpenses';
import { CATEGORIES, Category } from '../constants/categories';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '../constants/currencies';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  expense: RegularExpense | null;
  onClose: () => void;
}

export default function AddEditExpenseSheet({ expense, onClose }: Props) {
  const [name, setName] = useState(expense?.name ?? '');
  const [category, setCategory] = useState<Category>((expense?.category as Category) ?? 'Uncategorized');
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(expense?.currency ?? DEFAULT_CURRENCY);
  const [frequency, setFrequency] = useState<Frequency>((expense?.frequency as Frequency) ?? 'monthly');
  const [dueDay, setDueDay] = useState(expense?.due_day?.toString() ?? '');
  const [outstandingBalance, setOutstandingBalance] = useState(expense?.outstanding_balance?.toString() ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const isEditing = expense !== null;

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Expense name is required.'); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { Alert.alert('Required', 'Enter a valid amount.'); return; }

    const dueDayNum = dueDay.trim() ? parseInt(dueDay, 10) : null;
    if (dueDayNum !== null && (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      Alert.alert('Invalid', 'Due day must be between 1 and 31.');
      return;
    }

    const outstandingNum = outstandingBalance.trim() ? parseFloat(outstandingBalance) : null;

    setSaving(true);
    try {
      await upsertRegularExpense({
        id: expense?.id,
        name: name.trim(),
        category,
        amount: amountNum,
        currency,
        frequency,
        due_day: dueDayNum,
        outstanding_balance: outstandingNum,
        notes: notes.trim() || null,
        sort_order: expense?.sort_order ?? 9999,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name={'close' as IoniconName} size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Expense Name *">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Netflix" />
          </Field>

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

          <Field label="Frequency">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {FREQUENCIES.map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.chip, frequency === freq && styles.chipActive]}
                    onPress={() => setFrequency(freq)}
                  >
                    <Text style={[styles.chipText, frequency === freq && styles.chipTextActive]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          <Field label="Due Day (1–31, optional)">
            <TextInput
              style={styles.input} value={dueDay} onChangeText={setDueDay}
              keyboardType="number-pad" placeholder="e.g. 15"
            />
          </Field>

          <Field label="Outstanding Balance (optional)">
            <TextInput
              style={styles.input} value={outstandingBalance} onChangeText={setOutstandingBalance}
              keyboardType="decimal-pad" placeholder="0.00"
            />
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes} onChangeText={setNotes}
              multiline numberOfLines={3}
              placeholder="Optional notes..."
            />
          </Field>
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
});
