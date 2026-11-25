import { StyleSheet, Text, View } from 'react-native';
import { roleLabels } from '@/lib/format';
import { radius, roleColors } from '@/lib/theme';
import type { UserRole } from '@/lib/types';

export function RoleBadge({ role }: { role: UserRole }) {
  const palette = roleColors[role];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.text }]}>{roleLabels[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
