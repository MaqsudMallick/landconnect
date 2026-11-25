import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

type Props = { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string; action?: React.ReactNode };

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, flexGrow: 1 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
