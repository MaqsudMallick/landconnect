import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { RoleBadge } from '@/components/RoleBadge';
import { colors, radius, spacing } from '@/lib/theme';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';

type Row = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void };

export default function ProfileScreen() {
  const { profile } = useCurrentUser();
  const { signOut, session } = useAuth();
  const canList = profile.role === 'seller' || profile.role === 'broker';

  const rows: Row[] = [
    { icon: 'create-outline', title: 'Edit profile', subtitle: 'Name, photo, city and bio', onPress: () => router.push('/settings/profile') },
    ...(canList
      ? [{ icon: 'albums-outline' as const, title: 'My listings', subtitle: 'Edit, mark sold or hide your land', onPress: () => router.push('/listing/mine') }]
      : []),
    { icon: 'shield-checkmark-outline', title: 'Privacy', subtitle: 'Who can call you, blocked users, phone number', onPress: () => router.push('/settings/privacy') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Avatar name={profile.full_name} path={profile.avatar_path} size={84} />
        <Text style={styles.name}>{profile.full_name}</Text>
        <RoleBadge role={profile.role} />
        <Text style={styles.email}>{session?.user.email}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={styles.group}>
        {rows.map((row) => (
          <Pressable key={row.title} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={row.onPress}>
            <Ionicons name={row.icon} size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        onPress={() =>
          Alert.alert('Sign out', 'Sign out of LandConnect?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
          ])
        }
      >
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  email: { fontSize: 14, color: colors.textMuted },
  bio: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  pressed: { backgroundColor: colors.background },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  signOutText: { fontSize: 16, fontWeight: '600', color: colors.danger },
});
