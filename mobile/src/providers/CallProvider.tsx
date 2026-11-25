import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Vibration } from 'react-native';
import { IncomingCallSheet } from '@/components/IncomingCallSheet';
import { errorMessage, supabase } from '@/lib/supabase';
import type { Call, CallKind, Profile } from '@/lib/types';
import { useAuth } from './AuthProvider';

export const RING_TIMEOUT_MS = 45_000;

type IncomingCall = { call: Call; caller: Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_path'> };

type CallContextValue = {
  startCall: (calleeId: string, kind: CallKind) => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [responding, setResponding] = useState(false);
  const incomingRef = useRef<IncomingCall | null>(null);
  incomingRef.current = incoming;

  const showIncoming = useCallback(async (call: Call) => {
    if (call.status !== 'ringing') return;
    if (Date.now() - new Date(call.created_at).getTime() > RING_TIMEOUT_MS) return;
    if (incomingRef.current?.call.id === call.id) return;
    const { data: caller } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_path')
      .eq('id', call.caller_id)
      .single();
    if (caller) setIncoming({ call, caller });
  }, []);

  const checkPendingCalls = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - RING_TIMEOUT_MS).toISOString();
    const { data } = await supabase
      .from('calls')
      .select('*')
      .eq('callee_id', userId)
      .eq('status', 'ringing')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = (data as Call[] | null)?.[0];
    if (latest) showIncoming(latest);
  }, [userId, showIncoming]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` },
        (payload) => showIncoming(payload.new as Call),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Call;
          if (incomingRef.current?.call.id === updated.id && updated.status !== 'ringing') {
            setIncoming(null);
          }
        },
      )
      .subscribe();

    checkPendingCalls();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPendingCalls();
    });

    return () => {
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [userId, showIncoming, checkPendingCalls]);

  useEffect(() => {
    if (!incoming) {
      Vibration.cancel();
      return;
    }
    Vibration.vibrate([0, 900, 700], true);
    const remaining = RING_TIMEOUT_MS - (Date.now() - new Date(incoming.call.created_at).getTime());
    const timer = setTimeout(() => setIncoming(null), Math.max(remaining, 0));
    return () => {
      clearTimeout(timer);
      Vibration.cancel();
    };
  }, [incoming]);

  const respond = useCallback(async (accept: boolean) => {
    const current = incomingRef.current;
    if (!current) return;
    setResponding(true);
    const { error } = await supabase.rpc('respond_to_call', { target_call: current.call.id, accept });
    setResponding(false);
    setIncoming(null);
    if (error) {
      Alert.alert('Call', errorMessage(error));
      return;
    }
    if (accept) router.push(`/call/${current.call.id}`);
  }, []);

  const startCall = useCallback(async (calleeId: string, kind: CallKind) => {
    const { data, error } = await supabase.rpc('start_call', { callee: calleeId, call_type: kind });
    if (error) {
      Alert.alert('Could not start the call', errorMessage(error));
      return;
    }
    router.push(`/call/${(data as Call).id}`);
  }, []);

  const value = useMemo(() => ({ startCall }), [startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      {incoming ? (
        <IncomingCallSheet
          callerName={incoming.caller.full_name}
          callerRole={incoming.caller.role}
          avatarPath={incoming.caller.avatar_path}
          kind={incoming.call.kind}
          busy={responding}
          onAccept={() => respond(true)}
          onDecline={() => respond(false)}
        />
      ) : null}
    </CallContext.Provider>
  );
}

export function useCalls() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCalls must be used inside CallProvider');
  return value;
}
