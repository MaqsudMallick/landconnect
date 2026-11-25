import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ListingCard } from '@/components/ListingCard';
import { RoleBadge } from '@/components/RoleBadge';
import { useListings } from '@/hooks/useListings';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useCalls } from '@/providers/CallProvider';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useCurrentUser();
  const { startCall } = useCalls();
  const [person, setPerson] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState(false);
  const { listings } = useListings({ ownerId: id });
  const isMe = id === userId;

  const load = useCallback(async () => {
    const [{ data }, { data: block }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId).eq('blocked_id', id).maybeSingle(),
    ]);
    setPerson(data as Profile | null);
    setBlocked(!!block);
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const message = async () => {
    const { data, error } = await supabase.rpc('start_direct_conversation', { other_user: id });
    if (error) return Alert.alert('Message', errorMessage(error));
    router.push(`/chat/${data as string}`);
  };

  const toggleBlock = () => {
    if (blocked) {
      supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', id).then(load);
      return;
    }
    Alert.alert('Block user', `${person?.full_name} will not be able to message or call you, and you will not be able to contact them.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('blocks').insert({ blocked_id: id });
          if (error) return Alert.alert('Block', errorMessage(error));
          load();
        },
      },
    ]);
  };

  if (!person) return <View style={styles.screen} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={listings}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Stack.Screen options={{ title: person.full_name }} />
          <View style={styles.card}>
            <Avatar name={person.full_name} path={person.avatar_path} size={88} />
            <Text style={styles.name}>{person.full_name}</Text>
            <RoleBadge role={person.role} />
            {person.city ? <Text style={styles.muted}>{person.city}</Text> : null}
            {person.bio ? <Text style={styles.bio}>{person.bio}</Text> : null}
            <Text style={styles.muted}>Member since {new Date(person.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          </View>
          {!isMe ? (
            <View style={styles.actions}>
              <Button title="Message" onPress={message} disabled={blocked} style={styles.flex} />
              <Button title="Voice" variant="secondary" onPress={() => startCall(id, 'audio')} disabled={blocked} style={styles.flex} />
              <Button title="Video" variant="secondary" onPress={() => startCall(id, 'video')} disabled={blocked} style={styles.flex} />
            </View>
          ) : null}
          {!isMe ? <Button title={blocked ? 'Unblock' : 'Block'} variant="ghost" onPress={toggleBlock} /> : null}
          {listings.length ? <Text style={styles.section}>Listings</Text> : null}
        </View>
      }
      renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}`)} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  bio: { color: colors.text, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
