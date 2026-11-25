import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { formatClock, formatPrice, roleLabels } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { Listing, Message, Profile } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useCalls } from '@/providers/CallProvider';

type Conversation = { id: string; kind: 'direct' | 'meeting'; title: string | null; listing_id: string | null; created_by: string };
type Member = Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_path'>;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useCurrentUser();
  const { startCall } = useCalls();
  const insets = useSafeAreaInsets();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [listing, setListing] = useState<Pick<Listing, 'id' | 'title' | 'price'> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const list = useRef<FlatList<Message>>(null);

  const markRead = useCallback(() => {
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .then(() => undefined);
  }, [id, userId]);

  const load = useCallback(async () => {
    const [{ data: room }, { data: memberRows }, { data: messageRows }] = await Promise.all([
      supabase.from('conversations').select('id, kind, title, listing_id, created_by').eq('id', id).maybeSingle(),
      supabase.from('conversation_members').select('profiles(id, full_name, role, avatar_path)').eq('conversation_id', id),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(200),
    ]);
    setConversation(room as Conversation | null);
    setMembers(((memberRows ?? []) as unknown as { profiles: Member }[]).map((row) => row.profiles).filter(Boolean));
    setMessages((messageRows ?? []) as Message[]);
    if (room?.listing_id) {
      const { data: listingRow } = await supabase.from('listings').select('id, title, price').eq('id', room.listing_id).maybeSingle();
      setListing(listingRow as Pick<Listing, 'id' | 'title' | 'price'> | null);
    }
    setLoading(false);
    markRead();
  }, [id, markRead]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`conversation-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const incoming = payload.new as Message;
        setMessages((current) => (current.some((message) => message.id === incoming.id) ? current : [incoming, ...current]));
        markRead();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, markRead]);

  const other = useMemo(() => members.find((member) => member.id !== userId), [members, userId]);
  const names = useMemo(() => Object.fromEntries(members.map((member) => [member.id, member.full_name])), [members]);
  const isMeeting = conversation?.kind === 'meeting';

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({ conversation_id: id, body }).select('*').single();
    setSending(false);
    if (error) return Alert.alert('Message not sent', errorMessage(error));
    setDraft('');
    setMessages((current) => (current.some((message) => message.id === data.id) ? current : [data as Message, ...current]));
  };

  const leaveRoom = () =>
    Alert.alert('Leave meeting room', 'You will stop receiving its messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('leave_meeting_room', { target_conversation: id });
          if (error) return Alert.alert('Meeting room', errorMessage(error));
          router.back();
        },
      },
    ]);

  if (loading) return <ActivityIndicator style={styles.loading} color={colors.primary} />;
  if (!conversation) {
    return (
      <View style={styles.loading}>
        <Text style={styles.muted}>This chat is not available.</Text>
      </View>
    );
  }

  const headerTitle = () => (
    <Pressable
      style={styles.headerTitle}
      onPress={() => (isMeeting ? undefined : other && router.push(`/user/${other.id}`))}
    >
      <Avatar
        name={isMeeting ? conversation.title : other?.full_name}
        path={isMeeting ? null : other?.avatar_path}
        size={36}
        icon={isMeeting ? <Ionicons name="people" size={18} color="#fff" /> : undefined}
      />
      <View style={styles.headerText}>
        <Text style={styles.headerName} numberOfLines={1}>
          {isMeeting ? conversation.title : other?.full_name ?? 'Chat'}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {isMeeting ? members.map((member) => (member.id === userId ? 'You' : member.full_name.split(' ')[0])).join(', ') : other ? roleLabels[other.role] : ''}
        </Text>
      </View>
    </Pressable>
  );

  const headerRight = () => (
    <View style={styles.headerActions}>
      {isMeeting ? (
        <>
          <Pressable hitSlop={8} accessibilityLabel="Join video meeting" onPress={() => router.push(`/meeting/${id}`)}>
            <Ionicons name="videocam" size={22} color="#fff" />
          </Pressable>
          {conversation.created_by === userId ? (
            <Pressable hitSlop={8} accessibilityLabel="Add people" onPress={() => router.push(`/meeting/new?roomId=${id}`)}>
              <Ionicons name="person-add" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable hitSlop={8} accessibilityLabel="Leave room" onPress={leaveRoom}>
            <Ionicons name="exit-outline" size={22} color="#fff" />
          </Pressable>
        </>
      ) : other ? (
        <>
          <Pressable hitSlop={8} accessibilityLabel="Video call" onPress={() => startCall(other.id, 'video')}>
            <Ionicons name="videocam" size={22} color="#fff" />
          </Pressable>
          <Pressable hitSlop={8} accessibilityLabel="Voice call" onPress={() => startCall(other.id, 'audio')}>
            <Ionicons name="call" size={20} color="#fff" />
          </Pressable>
        </>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen options={{ headerTitle, headerRight, headerBackVisible: true }} />
      {listing ? (
        <Pressable style={styles.listingBanner} onPress={() => router.push(`/listing/${listing.id}`)}>
          <Ionicons name="pricetag" size={16} color={colors.primary} />
          <Text style={styles.listingText} numberOfLines={1}>
            {listing.title} · {formatPrice(Number(listing.price))}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {isMeeting ? (
        <Pressable style={styles.joinBanner} onPress={() => router.push(`/meeting/${id}`)}>
          <Ionicons name="videocam" size={18} color="#fff" />
          <Text style={styles.joinText}>Join the video meeting</Text>
        </Pressable>
      ) : null}
      <FlatList
        ref={list}
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === userId;
          const older = messages[index + 1];
          const showName = isMeeting && !mine && older?.sender_id !== item.sender_id;
          return (
            <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {showName ? <Text style={styles.sender}>{names[item.sender_id] ?? 'Member'}</Text> : null}
                <Text style={styles.messageText}>{item.body}</Text>
                <Text style={styles.messageTime}>{formatClock(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyCard}>
              <Ionicons name="lock-closed" size={14} color={colors.warning} />
              <Text style={styles.emptyText}>
                Messages and calls stay inside LandConnect. Your phone number is never shared.
              </Text>
            </View>
          </View>
        }
      />
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={4000}
        />
        <Pressable accessibilityLabel="Send" style={[styles.send, !draft.trim() && styles.sendDisabled]} onPress={send} disabled={!draft.trim() || sending}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.chatBackground },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 220 },
  headerText: { flexShrink: 1 },
  headerName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerSub: { color: '#cde7dd', fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 20, alignItems: 'center', paddingRight: 4 },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listingText: { flex: 1, color: colors.text, fontSize: 14 },
  joinBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, paddingVertical: 10 },
  joinText: { color: '#fff', fontWeight: '700' },
  messages: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderTopRightRadius: 2 },
  bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderTopLeftRadius: 2 },
  sender: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  messageText: { fontSize: 15, color: colors.text, lineHeight: 20 },
  messageTime: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 2 },
  emptyWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', transform: Platform.OS === 'android' ? [{ scale: -1 }] : [{ scaleY: -1 }] },
  emptyCard: { flexDirection: 'row', gap: 6, backgroundColor: '#FFF5C4', padding: spacing.md, borderRadius: radius.md, maxWidth: 300 },
  emptyText: { flex: 1, fontSize: 12, color: '#54656F', textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    color: colors.text,
  },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },
});
