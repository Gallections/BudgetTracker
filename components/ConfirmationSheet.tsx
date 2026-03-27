import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { insertTransaction } from '../db/transactions';
import { ParsedExpense } from '../utils/nlpParser';
import { CATEGORIES } from '../constants/categories';
import { SUPPORTED_CURRENCIES } from '../constants/currencies';
import { useApp } from '../context/AppContext';
import { setMerchantOverride } from '../db/userSettings';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  transcript: string;
  parsed: ParsedExpense;
  onClose: () => void;
  type?: 'income' | 'expense';
  customCategories?: { name: string }[];
}

export default function ConfirmationSheet({ transcript, parsed, onClose, type = 'expense', customCategories = [] }: Props) {
  const { dispatch } = useApp();

  const [amount, setAmount] = useState(parsed.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(parsed.currency);
  const [category, setCategory] = useState<string>(parsed.category);
  const [merchant, setMerchant] = useState(parsed.merchant);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Required', 'Enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      // Save merchant override if user manually changed the category
      const trimmedMerchant = merchant.trim();
      if (trimmedMerchant && category !== parsed.category) {
        await setMerchantOverride(trimmedMerchant, category);
      }

      await insertTransaction({
        amount: amountNum,
        currency,
        amount_in_base_currency: amountNum, // placeholder — Phase 5 adds real conversion
        category,
        merchant: trimmedMerchant,
        notes: notes.trim() || null,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        type,
      });
      dispatch({ type: 'REFRESH' });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
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
          <Text style={styles.title}>{type === 'income' ? 'Confirm Income' : 'Confirm Expense'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          {transcript ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Heard</Text>
              <Text style={styles.transcriptText}>"{transcript}"</Text>
            </View>
          ) : null}

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

          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {[...CATEGORIES, ...customCategories.map(c => c.name)].map(cat => (
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
  transcriptBox: {
    marginTop: 20, backgroundColor: '#F0FDF4', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#BBF7D0',
  },
  transcriptLabel: { fontSize: 11, fontWeight: '600', color: '#16A34A', marginBottom: 4 },
  transcriptText: { fontSize: 14, color: '#374151', fontStyle: 'italic' },
  field: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#111827',
  },
  dateButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
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
});
