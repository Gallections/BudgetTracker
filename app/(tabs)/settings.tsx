import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_CURRENCIES } from '../../constants/currencies';
import { CATEGORIES } from '../../constants/categories';
import { Colors } from '../../constants/colors';
import {
  setBaseCurrency, getBudgets, setBudget, clearBudget,
  setThemePreference, getThemePreference,
  getDefaultAccountId, setDefaultAccountId,
} from '../../db/userSettings';
import { getSavingsAccounts, SavingsAccount } from '../../db/savings';
import {
  getCustomCategories, upsertCustomCategory, softDeleteCustomCategory, CustomCategory,
} from '../../db/customCategories';
import { exportTransactionsCSV, exportFullBackup, importBackup } from '../../utils/exportData';
import { useApp, ThemePreference } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [budgets, setBudgetsState] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [defaultAccountId, setDefaultAccountIdState] = useState<string | null>(null);

  // Category edit modal state
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<CustomCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catKeywords, setCatKeywords] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadSettings = useCallback(async () => {
    const [stored, cats, accts, defaultId] = await Promise.all([
      getBudgets(), getCustomCategories(), getSavingsAccounts(), getDefaultAccountId(),
    ]);
    const asStrings: Record<string, string> = {};
    for (const [cat, val] of Object.entries(stored)) {
      asStrings[cat] = val.toString();
    }
    setBudgetsState(asStrings);
    setCustomCategories(cats);
    setAccounts(accts);
    setDefaultAccountIdState(defaultId);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (state.dbReady) loadSettings();
  }, [state.dbReady, state.refreshKey, loadSettings]);

  const handleSelectCurrency = async (code: string) => {
    await setBaseCurrency(code);
    dispatch({ type: 'SET_BASE_CURRENCY', currency: code });
  };

  const handleSelectTheme = async (theme: ThemePreference) => {
    await setThemePreference(theme);
    dispatch({ type: 'SET_THEME', theme });
  };

  const handleSetDefaultAccount = async (id: string | null) => {
    await setDefaultAccountId(id);
    setDefaultAccountIdState(id);
  };

  const handleSaveBudgets = async () => {
    setSaving(true);
    try {
      const allCategories = [...CATEGORIES, ...customCategories.map(c => c.name)];
      for (const cat of allCategories) {
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

  // ─── Export & Backup ──────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await exportTransactionsCSV();
    } catch {
      Alert.alert('Export Failed', 'Could not export transactions.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      await exportFullBackup();
    } catch {
      Alert.alert('Export Failed', 'Could not create backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async () => {
    setImporting(true);
    try {
      const result = await importBackup();
      if (result.imported === 0 && result.skipped === 0) return; // user cancelled
      dispatch({ type: 'REFRESH' });
      Alert.alert(
        'Import Complete',
        `Imported ${result.imported} records. Skipped ${result.skipped} duplicates.`
      );
    } catch (e) {
      Alert.alert('Import Failed', e instanceof Error ? e.message : 'Could not read backup file.');
    } finally {
      setImporting(false);
    }
  };

  // ─── Custom category modal ────────────────────────────────────────────────────

  const openAddCat = () => {
    setEditingCat(null);
    setCatName('');
    setCatKeywords('');
    setCatModalVisible(true);
  };

  const openEditCat = (cat: CustomCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatKeywords(cat.keywords.join(', '));
    setCatModalVisible(true);
  };

  const handleSaveCat = async () => {
    const name = catName.trim();
    if (!name) { Alert.alert('Required', 'Category name cannot be empty.'); return; }
    const keywords = catKeywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    setCatSaving(true);
    try {
      await upsertCustomCategory({
        id: editingCat?.id,
        name,
        keywords,
        sort_order: editingCat?.sort_order ?? customCategories.length,
      });
      dispatch({ type: 'REFRESH' });
      setCatModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to save category. Name may already be in use.');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = (cat: CustomCategory) => {
    Alert.alert(
      'Delete Category',
      `Delete "${cat.name}"? Existing transactions will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await softDeleteCustomCategory(cat.id);
            dispatch({ type: 'REFRESH' });
          },
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const THEME_OPTIONS: { key: ThemePreference; label: string; icon: IoniconName }[] = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

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

        {/* Appearance */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Appearance</Text>
        <Text style={styles.sectionSub}>Choose light, dark, or follow the system setting.</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.themeBtn, state.theme === opt.key && styles.themeBtnActive]}
              onPress={() => handleSelectTheme(opt.key)}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={state.theme === opt.key ? 'white' : colors.textSecondary}
              />
              <Text style={[styles.themeBtnText, state.theme === opt.key && styles.themeBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Default Spending Account */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Default Spending Account</Text>
        <Text style={styles.sectionSub}>
          New expenses automatically deduct from this account. Override per transaction in the confirm sheet.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.accountChipRow}>
            <TouchableOpacity
              style={[styles.accountChip, defaultAccountId === null && styles.accountChipActive]}
              onPress={() => handleSetDefaultAccount(null)}
            >
              <Text style={[styles.accountChipText, defaultAccountId === null && styles.accountChipTextActive]}>
                None
              </Text>
            </TouchableOpacity>
            {accounts.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[styles.accountChip, defaultAccountId === a.id && styles.accountChipActive]}
                onPress={() => handleSetDefaultAccount(a.id)}
              >
                <Text style={[styles.accountChipText, defaultAccountId === a.id && styles.accountChipTextActive]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Per-Category Budgets */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Monthly Budgets</Text>
        <Text style={styles.sectionSub}>
          Set a monthly spending limit per category. Leave blank for no limit.
        </Text>

        {[...CATEGORIES.filter(c => c !== 'Uncategorized'), ...customCategories.map(c => c.name)].map(cat => (
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
                placeholderTextColor={colors.textSecondary}
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

        {/* Categories */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Categories</Text>
        <Text style={styles.sectionSub}>
          Built-in categories and your custom ones. Add keywords to trigger auto-categorization.
        </Text>

        {CATEGORIES.map(cat => (
          <View key={cat} style={styles.catRow}>
            <Text style={styles.catName}>{cat}</Text>
            <View style={styles.builtInBadge}>
              <Text style={styles.builtInBadgeText}>Built-in</Text>
            </View>
          </View>
        ))}

        {customCategories.map(cat => (
          <View key={cat.id} style={styles.catRow}>
            <View style={styles.catRowLeft}>
              <Text style={styles.catName}>{cat.name}</Text>
              {cat.keywords.length > 0 && (
                <Text style={styles.catKeywordsSub}>
                  {cat.keywords.slice(0, 3).join(', ')}{cat.keywords.length > 3 ? ` +${cat.keywords.length - 3}` : ''}
                </Text>
              )}
            </View>
            <View style={styles.catRowActions}>
              <TouchableOpacity style={styles.catEditBtn} onPress={() => openEditCat(cat)}>
                <Ionicons name={'pencil-outline' as IoniconName} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.catDeleteBtn} onPress={() => handleDeleteCat(cat)}>
                <Ionicons name={'trash-outline' as IoniconName} size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addCatBtn} onPress={openAddCat}>
          <Ionicons name={'add-circle-outline' as IoniconName} size={18} color={colors.primary} />
          <Text style={styles.addCatBtnText}>Add Custom Category</Text>
        </TouchableOpacity>

        {/* Export & Backup */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Export & Backup</Text>
        <Text style={styles.sectionSub}>
          Export your data as CSV or create a full backup to restore later.
        </Text>

        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          <Ionicons name={'document-text-outline' as IoniconName} size={18} color={colors.primary} />
          <Text style={styles.exportBtnText}>Export Transactions (CSV)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { marginTop: 8 }, exporting && { opacity: 0.6 }]}
          onPress={handleExportBackup}
          disabled={exporting}
        >
          <Ionicons name={'cloud-download-outline' as IoniconName} size={18} color={colors.primary} />
          <Text style={styles.exportBtnText}>Export Full Backup (JSON)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { marginTop: 8 }, importing && { opacity: 0.6 }]}
          onPress={handleImportBackup}
          disabled={importing}
        >
          <Ionicons name={'cloud-upload-outline' as IoniconName} size={18} color={colors.success} />
          <Text style={[styles.exportBtnText, { color: colors.success }]}>Import Backup (JSON)</Text>
        </TouchableOpacity>

        {/* App info */}
        <Text style={styles.version}>PocketLedger · Phase 6</Text>
      </ScrollView>

      {/* Custom Category Modal */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCatModalVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCatModalVisible(false)}>
              <Ionicons name={'close' as IoniconName} size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCat ? 'Edit Category' : 'New Category'}
            </Text>
            <TouchableOpacity onPress={handleSaveCat} disabled={catSaving}>
              <Text style={[styles.modalSave, catSaving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalLabel}>Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={catName}
              onChangeText={setCatName}
              placeholder="e.g. Entertainment"
              placeholderTextColor={colors.textSecondary}
              autoFocus={!editingCat}
            />

            <Text style={[styles.modalLabel, { marginTop: 20 }]}>Keywords</Text>
            <Text style={styles.modalLabelSub}>
              Comma-separated words or merchant names that auto-assign this category.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={catKeywords}
              onChangeText={setCatKeywords}
              placeholder="e.g. cineplex, amc, movie, concert"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c: typeof Colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
    scroll: { padding: 20, paddingBottom: 48 },

    sectionHeader: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4 },
    sectionSub: { fontSize: 13, color: c.textSecondary, marginBottom: 14 },

    // Currency chips
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface,
      minWidth: 100,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipCode: { fontSize: 14, fontWeight: '700', color: c.text },
    chipCodeActive: { color: 'white' },
    chipName: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
    chipNameActive: { color: 'rgba(255,255,255,0.8)' },

    // Theme selector
    themeRow: { flexDirection: 'row', gap: 8 },
    themeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    themeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    themeBtnTextActive: { color: 'white' },

    // Budget rows
    budgetRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: c.border, marginBottom: 8,
    },
    budgetLabel: { fontSize: 15, fontWeight: '500', color: c.text, flex: 1 },
    budgetInputWrap: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.border, borderRadius: 8,
      backgroundColor: c.background, paddingHorizontal: 8,
    },
    budgetPrefix: { fontSize: 15, color: c.textSecondary, marginRight: 2 },
    budgetInput: { fontSize: 15, color: c.text, width: 90, paddingVertical: 6 },

    saveBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 20,
    },
    saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },

    // Category rows
    catRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: c.border, marginBottom: 8,
    },
    catRowLeft: { flex: 1 },
    catName: { fontSize: 15, fontWeight: '500', color: c.text },
    catKeywordsSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    builtInBadge: { backgroundColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    builtInBadgeText: { fontSize: 11, color: c.textSecondary, fontWeight: '500' },
    catRowActions: { flexDirection: 'row', gap: 8 },
    catEditBtn: { padding: 4 },
    catDeleteBtn: { padding: 4 },

    addCatBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: c.primary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, marginTop: 4, marginBottom: 8,
      justifyContent: 'center',
    },
    addCatBtnText: { fontSize: 15, fontWeight: '600', color: c.primary },

    // Default spending account chips
    accountChipRow: { flexDirection: 'row', paddingBottom: 4, gap: 8 },
    accountChip: {
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.surface,
    },
    accountChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    accountChipText: { fontSize: 14, fontWeight: '500', color: c.text },
    accountChipTextActive: { color: 'white', fontWeight: '600' },

    // Export buttons
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: c.border,
    },
    exportBtnText: { fontSize: 15, fontWeight: '500', color: c.primary },

    // Category modal
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    modalTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    modalSave: { fontSize: 16, fontWeight: '600', color: c.primary },
    modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: c.background },
    modalLabel: { fontSize: 13, fontWeight: '500', color: c.textSecondary, marginBottom: 6 },
    modalLabelSub: { fontSize: 12, color: c.textSecondary, marginBottom: 8, marginTop: -2 },
    modalInput: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 16, color: c.text,
    },
    modalInputMulti: { height: 90, textAlignVertical: 'top' },

    version: { fontSize: 12, color: c.border, textAlign: 'center', marginTop: 32 },
  });
}
