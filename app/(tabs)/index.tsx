import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isSpeechRecognitionSupported } from '../../hooks/useSpeechRecognition';
import { parseExpense } from '../../utils/nlpParser';
import ConfirmationSheet from '../../components/ConfirmationSheet';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen() {
  const [text, setText] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [frozenText, setFrozenText] = useState('');

  const handleParse = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setFrozenText(trimmed);
    setSheetVisible(true);
  };

  const handleSheetClose = () => {
    setSheetVisible(false);
    setText('');
    setFrozenText('');
  };

  // Voice entry (development build only)
  if (isSpeechRecognitionSupported) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.heading}>PocketLedger</Text>
          <Text style={styles.sub}>Tap the mic to log an expense</Text>
          <TouchableOpacity style={styles.micBtn} activeOpacity={0.8}>
            <Ionicons name={'mic-outline' as IoniconName} size={48} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Text input fallback (Expo Go)
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Ionicons name={'mic-circle-outline' as IoniconName} size={72} color="#2563EB" />
        <Text style={styles.heading}>Log an Expense</Text>
        <Text style={styles.sub}>
          Describe your expense in plain English
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder='e.g. "spent 45 at Starbucks"'
            placeholderTextColor="#9CA3AF"
            returnKeyType="done"
            onSubmitEditing={handleParse}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.parseBtn, !text.trim() && styles.parseBtnDisabled]}
          onPress={handleParse}
          disabled={!text.trim()}
        >
          <Text style={styles.parseBtnText}>Parse &amp; Confirm</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Voice entry available in development build
        </Text>
      </KeyboardAvoidingView>

      {sheetVisible && (
        <ConfirmationSheet
          transcript={frozenText}
          parsed={parseExpense(frozenText)}
          onClose={handleSheetClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 16, paddingHorizontal: 24,
  },
  heading: { fontSize: 26, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  inputRow: { width: '100%' },
  textInput: {
    width: '100%',
    backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  parseBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14, width: '100%', alignItems: 'center',
  },
  parseBtnDisabled: { backgroundColor: '#93C5FD' },
  parseBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  micBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
});
