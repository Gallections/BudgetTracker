import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsAccount, upsertSavingsAccount, ACCOUNT_TYPES, AccountType } from '../db/savings';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '../constants/currencies';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  account: SavingsAccount | null;
  onClose: () => void;
}

export default function AddEditAccountSheet({ account, onClose }: Props) {
  const [name, setName] = useState(account?.name ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? '' as string);
  const [balance, setBalance] = useState(account?.balance?.toString() ?? '');
  const [currency, setCurrency] = useState(account?.currency ?? DEFAULT_CURRENCY);
  const [accountType, setAccountType] = useState<AccountType>((account?.account_type as AccountType) ?? 'Savings');
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const isEditing = account !== null;

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Account name is required.'); return; }
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) { Alert.alert('Required', 'Enter a valid balance.'); return; }

    setSaving(true);
    try {
      await upsertSavingsAccount({
        id: account?.id,
        name: name.trim(),
        institution: institution.trim() || null,
        balance: balanceNum,
        currency,
        account_type: accountType,
        notes: notes.trim() || null,
        sort_order: account?.sort_order ?? 9999,
      });
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save account.');
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
          <Text style={styles.title}>{isEditing ? 'Edit Account' : 'Add Account'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Account Name *">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. TD Chequing" />
          </Field>
          <Field label="Institution">
            <TextInput style={styles.input} value={institution} onChangeText={setInstitution} placeholder="e.g. TD Bank" />
          </Field>
          <Field label="Balance *">
            <TextInput
              style={styles.input} value={balance} onChangeText={setBalance}
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
          <Field label="Account Type">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {ACCOUNT_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, accountType === type && styles.chipActive]}
                    onPress={() => setAccountType(type)}
                  >
                    <Text style={[styles.chipText, accountType === type && styles.chipTextActive]}>
                      {type}
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
