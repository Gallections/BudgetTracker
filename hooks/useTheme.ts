import { useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';
import { useApp } from '../context/AppContext';

export function useTheme() {
  const { state } = useApp();
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  const isDark =
    state.theme === 'dark' ||
    (state.theme === 'system' && systemScheme === 'dark');

  const colors = isDark ? Colors.dark : Colors.light;

  return { colors, isDark };
}
