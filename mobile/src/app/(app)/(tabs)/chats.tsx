import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { RoleBadge } from '@/components/RoleBadge';
import { formatChatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import type { ConversationSummary } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';

export default function ChatsScreen() {
  const { userId } = useCurrentUser();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_conversations');
    setConversations((data ?? []) as ConversationSummary[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = supabase
      .channel(`chat-list-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const name = item.kind === 'meeting' ? item.title ?? 'Meeting room' : item.other_user_name ?? 'Unknown user';
          const preview = item.last_message
            ? `${item.last_sender_id === userId ? 'You: ' : ''}${item.last_message}`
            : item.kind === 'meeting'
              ? `${item.member_count} members · tap to open`
              : item.listing_title
                ? `About ${item.listing_title}`
                : 'Say hello';
          return (
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push(`/chat/${item.id}`)}>
              <Avatar
                name={name}
                path={item.kind === 'direct' ? item.other_user_avatar : null}
                size={52}
                icon={item.kind === 'meeting' ? <Ionicons name="people" size={24} color="#fff" /> : undefined}
              />
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.time, item.unread_count > 0 && styles.timeUnread]}>{formatChatTime(item.last_message_at)}</Text>
                </View>
                <View style={styles.bottomLine}>
                  {item.kind === 'direct' && item.other_user_role ? <RoleBadge role={item.other_user_role} /> : null}
                  <Text style={styles.preview} numberOfLines={1}>
                    {preview}
                  </Text>
                  {item.unread_count > 0 ? (
                    <View style={styles.unread}>
                      <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState icon="chatbubbles-outline" title="No chats yet" message="Open a listing and tap Message to talk to the seller or broker." />
          )
        }
      />
      <Pressable accessibilityLabel="New meeting room" style={styles.fab} onPress={() => router.push('/meeting/new')}>
        <Ionicons name="people" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  list: { flexGrow: 1, paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 80 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  pressed: { backgroundColor: colors.background },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  timeUnread: { color: colors.accent, fontWeight: '600' },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { flex: 1, fontSize: 14, color: colors.textMuted },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
