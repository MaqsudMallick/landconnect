import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { CallPermission, Profile } from '@/lib/types';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';

const callOptions: { value: CallPermission; title: string; description: string }[] = [
  { value: 'everyone', title: 'Everyone', description: 'Any signed-in user can call you' },
  { value: 'contacts', title: 'People I have replied to', description: 'Only people you have sent a message to' },
  { value: 'nobody', title: 'Nobody', description: 'Turn off incoming calls' },
];

type Blocked = { blocked_id: string; profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_path'> | null };

export default function PrivacyScreen() {
  const { userId, profile } = useCurrentUser();
  const { refreshProfile } = useAuth();
  const [permission, setPermission] = useState<CallPermission>(profile.call_permission);
  const [phone, setPhone] = useState('');
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [savingPhone, setSavingPhone] = useState(false);

  const load = useCallback(async () => {
    const [{ data: privateRow }, { data: blockRows }] = await Promise.all([
      supabase.from('profile_private').select('phone').eq('id', userId).maybeSingle(),
      supabase.from('blocks').select('blocked_id, profiles!blocks_blocked_id_fkey(id, full_name, avatar_path)').eq('blocker_id', userId),
    ]);
    setPhone(privateRow?.phone ?? '');
    setBlocked((blockRows ?? []) as unknown as Blocked[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const choose = async (value: CallPermission) => {
    setPermission(value);
    const { error } = await supabase.from('profiles').update({ call_permission: value }).eq('id', userId);
    if (error) {
      setPermission(profile.call_permission);
      return Alert.alert('Privacy', errorMessage(error));
    }
    refreshProfile();
  };

  const savePhone = async () => {
    setSavingPhone(true);
    const { error } = await supabase.from('profile_private').update({ phone: phone.trim() || null }).eq('id', userId);
    setSavingPhone(false);
    if (error) return Alert.alert('Phone', errorMessage(error));
    Alert.alert('Saved', 'Only you can see this number.');
  };

  const unblock = async (blockedId: string) => {
    await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
    load();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Who can call you</Text>
      <View style={styles.group}>
        {callOptions.map((option) => (
          <Pressable key={option.value} style={styles.option} onPress={() => choose(option.value)}>
            <View style={[styles.radio, permission === option.value && styles.radioOn]} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Phone number</Text>
      <View style={[styles.group, styles.padded]}>
        <TextField
          label="Private phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91 98765 43210"
          hint="Stored for your account only. Other users never see it; they reach you through in-app chat and calls."
        />
        <Button title="Save number" variant="secondary" onPress={savePhone} loading={savingPhone} />
      </View>

      <Text style={styles.heading}>Blocked users</Text>
      <View style={styles.group}>
        {blocked.length === 0 ? <Text style={[styles.optionDescription, styles.padded]}>You have not blocked anyone.</Text> : null}
        {blocked.map((row) => (
          <View key={row.blocked_id} style={styles.option}>
            <Avatar name={row.profiles?.full_name} path={row.profiles?.avatar_path} size={36} />
            <Text style={[styles.optionTitle, styles.optionText]}>{row.profiles?.full_name ?? 'User'}</Text>
            <Button title="Unblock" variant="ghost" onPress={() => unblock(row.blocked_id)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  heading: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: spacing.lg, gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  optionDescription: { fontSize: 13, color: colors.textMuted },
});
