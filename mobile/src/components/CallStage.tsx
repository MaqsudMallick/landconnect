import { Ionicons } from '@expo/vector-icons';
import {
  AudioSession,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/react-native';
import { ConnectionState, LocalVideoTrack, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration } from '@/lib/format';
import { colors } from '@/lib/theme';
import { Avatar } from './Avatar';

const GRID_TOP = 76;
const GRID_BOTTOM = 124;
const TILE_MARGIN = 4;

type Props = {
  title: string;
  subtitle?: string;
  startedAt?: string | null;
  defaultSpeaker: boolean;
  onHangUp: () => void;
  layout: 'one-to-one' | 'grid';
};

export function CallStage({ title, subtitle, startedAt, defaultSpeaker, onHangUp, layout }: Props) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const insets = useSafeAreaInsets();
  const [speakerOn, setSpeakerOn] = useState(defaultSpeaker);
  const [frontCamera, setFrontCamera] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed((Date.now() - new Date(startedAt).getTime()) / 1000);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    AudioSession.selectAudioOutput(speakerOn ? 'speaker' : 'earpiece').catch(() => undefined);
  }, [speakerOn]);

  const flipCamera = async () => {
    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.videoTrack;
    if (!(track instanceof LocalVideoTrack)) return;
    const next = !frontCamera;
    await track.restartTrack({ facingMode: next ? 'user' : 'environment' });
    setFrontCamera(next);
  };

  const remoteTracks = tracks.filter((ref) => ref.participant.identity !== localParticipant.identity);
  const localTrack = tracks.find((ref) => ref.participant.identity === localParticipant.identity);
  const status =
    connection === ConnectionState.Connected
      ? startedAt
        ? formatDuration(elapsed)
        : 'Connected'
      : connection === ConnectionState.Reconnecting
        ? 'Reconnecting…'
        : 'Connecting…';

  return (
    <View style={styles.screen}>
      {layout === 'one-to-one' ? (
        <OneToOne remote={remoteTracks[0]} local={localTrack} mirror={frontCamera} partnerName={title} />
      ) : (
        <Grid tracks={tracks} localIdentity={localParticipant.identity} mirror={frontCamera} />
      )}

      <View style={[styles.header, { paddingTop: insets.top + 12 }]} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>
          {subtitle ? `${subtitle} · ` : ''}
          {status}
          {layout === 'grid' ? ` · ${participants.length} in room` : ''}
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        <ControlButton
          icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
          label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          active={!isMicrophoneEnabled}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <ControlButton
          icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
          label={isCameraEnabled ? 'Camera off' : 'Camera on'}
          active={!isCameraEnabled}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <ControlButton icon="camera-reverse" label="Flip" disabled={!isCameraEnabled} onPress={flipCamera} />
        <ControlButton
          icon={speakerOn ? 'volume-high' : 'ear'}
          label={speakerOn ? 'Speaker' : 'Earpiece'}
          active={speakerOn}
          onPress={() => setSpeakerOn((value) => !value)}
        />
        <ControlButton
          icon="call"
          label="End"
          danger
          onPress={() => {
            room.disconnect();
            onHangUp();
          }}
        />
      </View>
    </View>
  );
}

function OneToOne({
  remote,
  local,
  mirror,
  partnerName,
}: {
  remote?: TrackReferenceOrPlaceholder;
  local?: TrackReferenceOrPlaceholder;
  mirror: boolean;
  partnerName: string;
}) {
  const remoteVideo = remote && isTrackReference(remote) && !remote.publication.isMuted ? remote : null;
  const localVideo = local && isTrackReference(local) && !local.publication.isMuted ? local : null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {remoteVideo ? (
        <VideoTrack trackRef={remoteVideo} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={styles.waiting}>
          <Avatar name={remote?.participant.name || partnerName} size={128} />
          <Text style={styles.waitingText}>
            {remote ? `${remote.participant.name ?? 'They'} ${remote.publication ? 'turned the camera off' : 'is on audio'}` : `Connecting to ${partnerName}…`}
          </Text>
        </View>
      )}
      {localVideo ? (
        <View style={styles.selfView}>
          <VideoTrack trackRef={localVideo} style={StyleSheet.absoluteFill} objectFit="cover" mirror={mirror} />
        </View>
      ) : null}
    </View>
  );
}

function Grid({
  tracks,
  localIdentity,
  mirror,
}: {
  tracks: TrackReferenceOrPlaceholder[];
  localIdentity: string;
  mirror: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = tracks.length <= 2 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(tracks.length / columns));
  const top = insets.top + GRID_TOP;
  const bottom = insets.bottom + GRID_BOTTOM;
  const visibleRows = Math.min(rows, 3);
  const tileHeight = Math.max(140, (height - top - bottom) / visibleRows - TILE_MARGIN * 2);
  return (
    <FlatList
      style={StyleSheet.absoluteFill}
      contentContainerStyle={[styles.grid, { paddingTop: top, paddingBottom: bottom }]}
      data={tracks}
      numColumns={columns}
      key={columns}
      keyExtractor={(ref) => `${ref.participant.identity}-${ref.source}`}
      renderItem={({ item }) => {
        const isLocal = item.participant.identity === localIdentity;
        const video = isTrackReference(item) && !item.publication.isMuted ? item : null;
        return (
          <View style={[styles.tile, { width: width / columns - TILE_MARGIN * 2 - 4, height: tileHeight }]}>
            {video ? (
              <VideoTrack trackRef={video} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isLocal && mirror} />
            ) : (
              <View style={styles.tilePlaceholder}>
                <Avatar name={item.participant.name || item.participant.identity} size={72} />
              </View>
            )}
            <View style={styles.tileLabel}>
              <Text style={styles.tileLabelText} numberOfLines={1}>
                {isLocal ? 'You' : item.participant.name || 'Guest'}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.control}>
      <Pressable
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.controlButton,
          active && styles.controlActive,
          danger && styles.controlDanger,
          disabled && styles.controlDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={active && !danger ? colors.callBackground : '#fff'}
          style={danger ? styles.hangupIcon : undefined}
        />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.callBackground },
  header: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24, gap: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  subtitle: { color: '#d4e6df', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  waitingText: { color: '#a9c4bb', fontSize: 15, textAlign: 'center' },
  selfView: {
    position: 'absolute',
    right: 16,
    bottom: 150,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: '#000',
  },
  grid: { paddingHorizontal: 2 },
  tile: { margin: TILE_MARGIN, borderRadius: 14, overflow: 'hidden', backgroundColor: '#163a30' },
  tilePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileLabel: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: '85%',
  },
  tileLabelText: { color: '#fff', fontSize: 12 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 16,
    backgroundColor: 'rgba(5,15,12,0.6)',
  },
  control: { alignItems: 'center', gap: 6, width: 64 },
  controlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: '#fff' },
  controlDanger: { backgroundColor: colors.danger },
  controlDisabled: { opacity: 0.4 },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  controlLabel: { color: '#e5efe9', fontSize: 11 },
});
