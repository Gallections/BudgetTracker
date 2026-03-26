import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name={'mic-circle-outline' as IoniconName} size={96} color="#2563EB" />
      <Text style={styles.label}>Tap to record expense</Text>
      <Text style={styles.sub}>Voice entry coming in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', gap: 12 },
  label: { fontSize: 18, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 14, color: '#6B7280' },
});
