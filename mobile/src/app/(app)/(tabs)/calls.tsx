import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { describeCall, formatCallTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import type { CallHistoryEntry } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useCalls } from '@/providers/CallProvider';

export default function CallsScreen() {
  const { userId } = useCurrentUser();
  const { startCall } = useCalls();
  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_call_history');
    setEntries((data ?? []) as CallHistoryEntry[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = supabase
      .channel(`call-history-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `caller_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return (
    <FlatList
      style={styles.screen}
      data={entries}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const failed = item.status === 'missed' || item.status === 'rejected' || item.status === 'cancelled';
        const arrow = item.outgoing ? 'arrow-up' : 'arrow-down';
        return (
          <View style={styles.row}>
            <Avatar name={item.other_user_name} path={item.other_user_avatar} size={48} />
            <View style={styles.body}>
              <Text style={[styles.name, failed && !item.outgoing && styles.missed]} numberOfLines={1}>
                {item.other_user_name}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name={arrow} size={14} color={failed ? colors.danger : colors.accent} style={styles.arrow} />
                <Text style={styles.meta}>
                  {formatCallTime(item.created_at)} · {describeCall(item)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel={`Call ${item.other_user_name} back`}
              hitSlop={10}
              onPress={() => startCall(item.other_user_id, item.kind)}
            >
              <Ionicons name={item.kind === 'video' ? 'videocam' : 'call'} size={22} color={colors.primary} />
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        loading ? undefined : <EmptyState icon="call-outline" title="No calls yet" message="Calls happen inside the app, so nobody sees your phone number." />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  list: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 76 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  missed: { color: colors.danger },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrow: { transform: [{ rotate: '45deg' }] },
  meta: { fontSize: 13, color: colors.textMuted },
});
