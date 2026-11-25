import { Ionicons } from '@expo/vector-icons';
import { LiveKitRoom } from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CallStage } from '@/components/CallStage';
import { requestCallPermissions, useAudioSession, useLiveKitGrant } from '@/hooks/useCallMedia';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function MeetingCallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('Meeting room');
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const leaving = useRef(false);
  const { grant, error } = useLiveKitGrant(permissionsReady ? { kind: 'meeting', id } : null);
  useAudioSession(permissionsReady, true);

  useEffect(() => {
    supabase
      .from('conversations')
      .select('title')
      .eq('id', id)
      .single()
      .then(({ data }) => data?.title && setTitle(data.title));
    requestCallPermissions(true).then((granted) => {
      setPermissionsReady(granted);
      setPermissionError(!granted);
    });
  }, [id]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    router.back();
  }, []);

  if (grant) {
    return (
      <LiveKitRoom
        serverUrl={grant.serverUrl}
        token={grant.token}
        connect
        audio
        video
        options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
        onDisconnected={leave}
      >
        <CallStage title={title} subtitle="Meeting room" defaultSpeaker layout="grid" onHangUp={leave} />
      </LiveKitRoom>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Ionicons name="people" size={56} color="#cfe" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>
        {permissionError ? 'Allow microphone and camera access to join' : error ? error : 'Joining the meeting…'}
      </Text>
      {!permissionError && !error ? <ActivityIndicator color="#fff" /> : null}
      <Pressable style={styles.back} onPress={leave}>
        <Text style={styles.backText}>Back to chat</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.callBackground, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '600', textAlign: 'center' },
  status: { color: '#d4e6df', fontSize: 15, textAlign: 'center' },
  back: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#5c7d72' },
  backText: { color: '#fff' },
});
