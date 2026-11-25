import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { RoleBadge } from '@/components/RoleBadge';
import { TextField } from '@/components/TextField';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { ConversationSummary, Profile } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';

type Person = Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_path'>;

export default function NewMeetingScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const { userId } = useCurrentUser();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Person[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Map<string, Person>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc('my_conversations').then(({ data }) => {
      const people = ((data ?? []) as ConversationSummary[])
        .filter((row) => row.kind === 'direct' && row.other_user_id)
        .map((row) => ({ id: row.other_user_id as string, full_name: row.other_user_name ?? '', role: row.other_user_role ?? 'buyer', avatar_path: row.other_user_avatar }));
      setContacts(people);
    });
    if (roomId) {
      supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', roomId)
        .then(({ data }) => setExisting(new Set((data ?? []).map((row) => row.user_id as string))));
    }
  }, [roomId]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_path')
        .ilike('full_name', `%${term.replace(/[%_]/g, '')}%`)
        .neq('id', userId)
        .limit(20);
      setResults((data ?? []) as Person[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userId]);

  const toggle = (person: Person) =>
    setChosen((current) => {
      const next = new Map(current);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });

  const submit = async () => {
    const memberIds = [...chosen.keys()];
    if (roomId) {
      if (!memberIds.length) return Alert.alert('Add people', 'Choose at least one person.');
      setSaving(true);
      const { error } = await supabase.rpc('add_meeting_members', { target_conversation: roomId, member_ids: memberIds });
      setSaving(false);
      if (error) return Alert.alert('Add people', errorMessage(error));
      router.back();
      return;
    }
    if (!title.trim()) return Alert.alert('Meeting room', 'Give the room a name.');
    if (!memberIds.length) return Alert.alert('Meeting room', 'Invite at least one person.');
    setSaving(true);
    const { data, error } = await supabase.rpc('create_meeting_room', { room_title: title.trim(), member_ids: memberIds });
    setSaving(false);
    if (error) return Alert.alert('Meeting room', errorMessage(error));
    router.replace(`/chat/${data as string}`);
  };

  const people = (query.trim().length >= 2 ? results : contacts).filter((person) => !existing.has(person.id));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: roomId ? 'Add people' : 'New meeting room' }} />
      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            {!roomId ? (
              <TextField label="Room name" value={title} onChangeText={setTitle} placeholder="e.g. Sarjapur plot site visit" maxLength={80} />
            ) : null}
            <Text style={styles.label}>Invite people</Text>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            {chosen.size ? (
              <Text style={styles.chosen}>{[...chosen.values()].map((person) => person.full_name).join(', ')}</Text>
            ) : null}
            <Text style={styles.sectionTitle}>{query.trim().length >= 2 ? 'Search results' : 'People you have chatted with'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = chosen.has(item.id);
          return (
            <Pressable style={styles.row} onPress={() => toggle(item)}>
              <Avatar name={item.full_name} path={item.avatar_path} size={42} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.full_name}</Text>
                <RoleBadge role={item.role} />
              </View>
              <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.accent : colors.textMuted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{query.trim().length >= 2 ? 'Nobody found.' : 'Search for people by name.'}</Text>}
      />
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Button title={roomId ? `Add ${chosen.size || ''} people`.replace('  ', ' ') : 'Create room'} onPress={submit} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  chosen: { fontSize: 13, color: colors.primary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: 3 },
  name: { fontSize: 16, color: colors.text, fontWeight: '500' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
