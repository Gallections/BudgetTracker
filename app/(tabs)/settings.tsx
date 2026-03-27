import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { SUPPORTED_CURRENCIES } from '../../constants/currencies';
import { CATEGORIES, Category } from '../../constants/categories';
import {
  setBaseCurrency, getBudgets, setBudget, clearBudget,
} from '../../db/userSettings';
import { useApp } from '../../context/AppContext';

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);
}

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgetsState] = useState<Partial<Record<Category, string>>>({});
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const stored = await getBudgets();
    const asStrings: Partial<Record<Category, string>> = {};
    for (const [cat, val] of Object.entries(stored)) {
      asStrings[cat as Category] = val.toString();
    }
    setBudgetsState(asStrings);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (state.dbReady) loadSettings();
  }, [state.dbReady, loadSettings]);

  const handleSelectCurrency = async (code: string) => {
    await setBaseCurrency(code);
    dispatch({ type: 'SET_BASE_CURRENCY', currency: code });
  };

  const handleSaveBudgets = async () => {
    setSaving(true);
    try {
      for (const cat of CATEGORIES) {
        const raw = budgets[cat];
        if (raw === undefined || raw.trim() === '') {
          await clearBudget(cat);
        } else {
          const num = parseFloat(raw);
          if (!isNaN(num) && num > 0) {
            await setBudget(cat, num);
          }
        }
      }
      dispatch({ type: 'REFRESH' });
    Alert.alert('Saved', 'Budget targets updated.');
    } catch {
      Alert.alert('Error', 'Failed to save budgets.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Base Currency */}
        <Text style={styles.sectionHeader}>Base Currency</Text>
        <Text style={styles.sectionSub}>All amounts are displayed in your base currency.</Text>
        <View style={styles.chipGrid}>
          {SUPPORTED_CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.code}
              style={[styles.chip, state.baseCurrency === c.code && styles.chipActive]}
              onPress={() => handleSelectCurrency(c.code)}
            >
              <Text style={[styles.chipCode, state.baseCurrency === c.code && styles.chipCodeActive]}>
                {c.code}
              </Text>
              <Text style={[styles.chipName, state.baseCurrency === c.code && styles.chipNameActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Per-Category Budgets */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Monthly Budgets</Text>
        <Text style={styles.sectionSub}>
          Set a monthly spending limit per category. Leave blank for no limit.
        </Text>

        {CATEGORIES.filter(c => c !== 'Uncategorized').map(cat => (
          <View key={cat} style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>{cat}</Text>
            <View style={styles.budgetInputWrap}>
              <Text style={styles.budgetPrefix}>$</Text>
              <TextInput
                style={styles.budgetInput}
                value={budgets[cat] ?? ''}
                onChangeText={val => setBudgetsState(prev => ({ ...prev, [cat]: val }))}
                keyboardType="decimal-pad"
                placeholder="No limit"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveBudgets}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>Save Budgets</Text>
        </TouchableOpacity>

        {/* App info */}
        <Text style={styles.version}>PocketLedger · Phase 5</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 48 },

  sectionHeader: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#6B7280', marginBottom: 14 },

  // Currency chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'white',
    minWidth: 100,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipCode: { fontSize: 14, fontWeight: '700', color: '#111827' },
  chipCodeActive: { color: 'white' },
  chipName: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  chipNameActive: { color: 'rgba(255,255,255,0.8)' },

  // Budget rows
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  budgetLabel: { fontSize: 15, fontWeight: '500', color: '#111827', flex: 1 },
  budgetInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#F9FAFB', paddingHorizontal: 8,
  },
  budgetPrefix: { fontSize: 15, color: '#6B7280', marginRight: 2 },
  budgetInput: {
    fontSize: 15, color: '#111827', width: 90,
    paddingVertical: 6,
  },

  saveBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },

  version: { fontSize: 12, color: '#D1D5DB', textAlign: 'center', marginTop: 32 },
});
