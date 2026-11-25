import { AndroidAudioTypePresets, AudioSession } from '@livekit/react-native';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { LiveKitGrant } from '@/lib/types';

export async function requestCallPermissions(video: boolean) {
  if (Platform.OS !== 'android') return true;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(video ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export function useAudioSession(enabled: boolean, speakerFirst: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const start = async () => {
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: speakerFirst ? ['bluetooth', 'headset', 'speaker', 'earpiece'] : ['bluetooth', 'headset', 'earpiece', 'speaker'],
          audioTypeOptions: AndroidAudioTypePresets.communication,
        },
        ios: { defaultOutput: speakerFirst ? 'speaker' : 'earpiece' },
      });
      if (!stopped) await AudioSession.startAudioSession();
    };
    start();
    return () => {
      stopped = true;
      AudioSession.stopAudioSession();
    };
  }, [enabled, speakerFirst]);
}

export function useLiveKitGrant(target: { kind: 'call' | 'meeting'; id: string } | null) {
  const [grant, setGrant] = useState<LiveKitGrant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = target?.kind;
  const id = target?.id;

  useEffect(() => {
    if (!kind || !id) return;
    const request = kind === 'call' ? { callId: id } : { conversationId: id };
    let active = true;
    setError(null);
    supabase.functions.invoke('livekit-token', { body: request }).then(async ({ data, error: invokeError }) => {
      if (!active) return;
      if (invokeError) {
        const detail = await (invokeError as { context?: Response }).context?.json?.().catch(() => null);
        setError(detail?.error ?? invokeError.message);
        return;
      }
      setGrant(data as LiveKitGrant);
    });
    return () => {
      active = false;
    };
  }, [kind, id]);

  return { grant, error };
}
