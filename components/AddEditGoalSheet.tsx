import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SavingsGoal, upsertSavingsGoal } from '../db/savingsGoals';
import { SavingsAccount } from '../db/savings';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  goal: SavingsGoal | null;
  accounts: SavingsAccount[];
  onClose: () => void;
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function AddEditGoalSheet({ goal, accounts, onClose }: Props) {
  const [name, setName] = useState(goal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount?.toString() ?? '');
  const [targetDate, setTargetDate] = useState<Date | null>(
    goal?.target_date ? new Date(goal.target_date + 'T00:00:00') : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(
    goal?.linked_account_id ?? null
  );
  const [notes, setNotes] = useState(goal?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const isEditing = goal !== null;

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Goal name is required.'); return; }
    const amountNum = parseFloat(targetAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Required', 'Enter a valid target amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await upsertSavingsGoal({
        id: goal?.id,
        name: name.trim(),
        target_amount: amountNum,
        target_date: targetDate ? toYMD(targetDate) : null,
        linked_account_id: linkedAccountId,
        notes: notes.trim() || null,
        sort_order: goal?.sort_order ?? 9999,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save goal.');
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
          <Text style={styles.title}>{isEditing ? 'Edit Goal' : 'Add Goal'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Goal Name *">
            <TextInput
              style={styles.input} value={name} onChangeText={setName}
              placeholder="e.g. Emergency Fund"
            />
          </Field>

          <Field label="Target Amount *">
            <TextInput
              style={styles.input} value={targetAmount} onChangeText={setTargetAmount}
              keyboardType="decimal-pad" placeholder="0.00"
            />
          </Field>

          <Field label="Target Date (optional)">
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.input, styles.dateTrigger]}
                onPress={() => setShowDatePicker(v => !v)}
              >
                <Text style={targetDate ? styles.dateValue : styles.datePlaceholder}>
                  {targetDate ? toYMD(targetDate) : 'No date set'}
                </Text>
              </TouchableOpacity>
              {targetDate !== null && (
                <TouchableOpacity style={styles.clearDate} onPress={() => setTargetDate(null)}>
                  <Ionicons name={'close-circle' as IoniconName} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={targetDate ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setTargetDate(d);
                }}
              />
            )}
          </Field>

          <Field label="Linked Account">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, linkedAccountId === null && styles.chipActive]}
                  onPress={() => setLinkedAccountId(null)}
                >
                  <Text style={[styles.chipText, linkedAccountId === null && styles.chipTextActive]}>
                    None
                  </Text>
                </TouchableOpacity>
                {accounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.chip, linkedAccountId === a.id && styles.chipActive]}
                    onPress={() => setLinkedAccountId(a.id)}
                  >
                    <Text style={[styles.chipText, linkedAccountId === a.id && styles.chipTextActive]}>
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes} onChangeText={setNotes}
              multiline numberOfLines={3}
              placeholder="Optional notes..."
            />
          </Field>

          <View style={{ height: 40 }} />
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTrigger: { flex: 1 },
  dateValue: { fontSize: 16, color: '#111827' },
  datePlaceholder: { fontSize: 16, color: '#9CA3AF' },
  clearDate: { padding: 4 },
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
