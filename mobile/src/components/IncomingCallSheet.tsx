import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { roleLabels } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { CallKind, UserRole } from '@/lib/types';
import { Avatar } from './Avatar';

type Props = {
  callerName: string;
  callerRole: UserRole;
  avatarPath: string | null;
  kind: CallKind;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallSheet({ callerName, callerRole, avatarPath, kind, busy, onAccept, onDecline }: Props) {
  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onDecline}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <Text style={styles.caption}>
            <Ionicons name="lock-closed" size={12} color="#cfe" /> LandConnect {kind === 'video' ? 'video' : 'voice'} call
          </Text>
          <Avatar name={callerName} path={avatarPath} size={120} />
          <Text style={styles.name}>{callerName}</Text>
          <Text style={styles.role}>{roleLabels[callerRole]} · Incoming</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Pressable
              accessibilityLabel="Decline call"
              disabled={busy}
              onPress={onDecline}
              style={[styles.round, { backgroundColor: colors.danger }]}
            >
              <Ionicons name="call" size={30} color="#fff" style={styles.hangupIcon} />
            </Pressable>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>
          <View style={styles.action}>
            <Pressable
              accessibilityLabel="Accept call"
              disabled={busy}
              onPress={onAccept}
              style={[styles.round, { backgroundColor: colors.accent }]}
            >
              <Ionicons name={kind === 'video' ? 'videocam' : 'call'} size={30} color="#fff" />
            </Pressable>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.callBackground, justifyContent: 'space-between', paddingVertical: 96 },
  top: { alignItems: 'center', gap: 14 },
  caption: { color: '#cfe', fontSize: 13, marginBottom: 20 },
  name: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: 8 },
  role: { color: '#a9c4bb', fontSize: 15 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40 },
  action: { alignItems: 'center', gap: 10 },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: '#fff', fontSize: 14 },
});
