import { Ionicons } from '@expo/vector-icons';
import { LiveKitRoom } from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { CallStage } from '@/components/CallStage';
import { requestCallPermissions, useAudioSession, useLiveKitGrant } from '@/hooks/useCallMedia';
import { roleLabels } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { Call, Profile } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';
import { RING_TIMEOUT_MS } from '@/providers/CallProvider';

type Party = Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_path'>;

const endedLabels: Record<string, string> = {
  rejected: 'Call declined',
  missed: 'No answer',
  cancelled: 'Call cancelled',
  ended: 'Call ended',
};

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useCurrentUser();
  const [call, setCall] = useState<Call | null>(null);
  const [other, setOther] = useState<Party | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const leaving = useRef(false);

  const isCaller = call?.caller_id === userId;
  const isVideo = call?.kind === 'video';
  const accepted = call?.status === 'accepted';
  const finished = call ? ['rejected', 'missed', 'cancelled', 'ended'].includes(call.status) : false;

  const { grant, error: grantError } = useLiveKitGrant(accepted && permissionsReady ? { kind: 'call', id } : null);
  useAudioSession(accepted && permissionsReady, isVideo);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const hangUp = useCallback(async () => {
    await supabase.rpc('finish_call', { target_call: id });
    leave();
  }, [id, leave]);

  useEffect(() => {
    supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) return leave();
        const row = data as Call;
        setCall(row);
        const otherId = row.caller_id === userId ? row.callee_id : row.caller_id;
        const { data: party } = await supabase.from('profiles').select('id, full_name, role, avatar_path').eq('id', otherId).single();
        setOther(party as Party);
      });

    const channel = supabase
      .channel(`call-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, (payload) => setCall(payload.new as Call))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, userId, leave]);

  useEffect(() => {
    if (!call) return;
    requestCallPermissions(call.kind === 'video').then((granted) => {
      setPermissionsReady(granted);
      setPermissionError(!granted);
    });
  }, [call?.kind]);

  useEffect(() => {
    if (!call || !isCaller || call.status !== 'ringing') return;
    const remaining = RING_TIMEOUT_MS - (Date.now() - new Date(call.created_at).getTime());
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('finish_call', { target_call: id });
      if (data) setCall(data as Call);
    }, Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [call, isCaller, id]);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(leave, 1500);
    return () => clearTimeout(timer);
  }, [finished, leave]);

  if (accepted && grant && permissionsReady) {
    return (
      <LiveKitRoom
        serverUrl={grant.serverUrl}
        token={grant.token}
        connect
        audio
        video={isVideo}
        options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
        onDisconnected={() => {
          if (!leaving.current) hangUp();
        }}
      >
        <CallStage
          title={other?.full_name ?? 'Call'}
          subtitle={isVideo ? 'Video call' : 'Voice call'}
          startedAt={call?.answered_at}
          defaultSpeaker={isVideo}
          layout="one-to-one"
          onHangUp={hangUp}
        />
      </LiveKitRoom>
    );
  }

  let status = 'Connecting…';
  if (!call) status = 'Loading…';
  else if (finished) status = endedLabels[call.status] ?? 'Call ended';
  else if (permissionError) status = 'Allow microphone and camera access to join';
  else if (grantError) status = grantError;
  else if (call.status === 'ringing') status = isCaller ? 'Ringing…' : 'Answering…';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.caption}>
          <Ionicons name="lock-closed" size={12} color="#cfe" /> {isVideo ? 'Video' : 'Voice'} call inside LandConnect
        </Text>
        <Avatar name={other?.full_name} path={other?.avatar_path} size={120} />
        <Text style={styles.name}>{other?.full_name ?? ' '}</Text>
        {other ? <Text style={styles.role}>{roleLabels[other.role]}</Text> : null}
        <Text style={styles.status}>{status}</Text>
        {!finished && !grantError && call?.status !== 'ringing' ? <ActivityIndicator color="#fff" /> : null}
      </View>
      {!finished ? (
        <View style={styles.bottom}>
          <Pressable accessibilityLabel="End call" style={styles.hangup} onPress={hangUp}>
            <Ionicons name="call" size={30} color="#fff" style={styles.hangupIcon} />
          </Pressable>
          <Text style={styles.hangupLabel}>{call?.status === 'ringing' && isCaller ? 'Cancel' : 'End'}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.callBackground, justifyContent: 'space-between', paddingVertical: 64 },
  top: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  caption: { color: '#cfe', fontSize: 13, marginBottom: 24 },
  name: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  role: { color: '#a9c4bb', fontSize: 15 },
  status: { color: '#d4e6df', fontSize: 16, marginTop: 8, textAlign: 'center' },
  bottom: { alignItems: 'center', gap: 10 },
  hangup: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  hangupLabel: { color: '#fff', fontSize: 14 },
});
