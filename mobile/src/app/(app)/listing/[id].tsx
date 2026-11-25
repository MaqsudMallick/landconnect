import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ImageCarousel } from '@/components/ImageCarousel';
import { LandMap } from '@/components/LandMap';
import { RoleBadge } from '@/components/RoleBadge';
import { LISTING_SELECT } from '@/hooks/useListings';
import { formatArea, formatPrice, landTypeLabels } from '@/lib/format';
import { LISTING_BUCKET, publicImageUrl } from '@/lib/images';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { Listing, ListingStatus } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useCalls } from '@/providers/CallProvider';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useCurrentUser();
  const { startCall } = useCalls();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).maybeSingle();
    setListing((data as Listing | null) ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <ActivityIndicator style={styles.center} color={colors.primary} />;
  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>This listing is no longer available.</Text>
      </View>
    );
  }

  const isOwner = listing.owner_id === userId;
  const images = [...(listing.listing_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((image) => publicImageUrl(LISTING_BUCKET, image.storage_path))
    .filter((url): url is string => !!url);
  const area = formatArea(listing.area, listing.area_unit);

  const openChat = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('start_direct_conversation', { other_user: listing.owner_id, about_listing: listing.id });
    setBusy(false);
    if (error) return Alert.alert('Message', errorMessage(error));
    router.push(`/chat/${data as string}`);
  };

  const startMeeting = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('create_meeting_room', {
      room_title: `Visit: ${listing.title}`.slice(0, 80),
      member_ids: [listing.owner_id],
      about_listing: listing.id,
    });
    setBusy(false);
    if (error) return Alert.alert('Meeting room', errorMessage(error));
    router.push(`/chat/${data as string}`);
  };

  const setStatus = async (status: ListingStatus) => {
    const { error } = await supabase.from('listings').update({ status }).eq('id', listing.id);
    if (error) return Alert.alert('Listing', errorMessage(error));
    load();
  };

  const remove = () =>
    Alert.alert('Delete listing', 'This removes the listing and its photos for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const paths = (listing.listing_images ?? []).map((image) => image.storage_path);
          const { error } = await supabase.from('listings').delete().eq('id', listing.id);
          if (error) return Alert.alert('Delete failed', errorMessage(error));
          if (paths.length) await supabase.storage.from(LISTING_BUCKET).remove(paths);
          router.back();
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: listing.title,
          headerRight: isOwner
            ? () => (
                <Pressable hitSlop={10} onPress={() => router.push(`/listing/edit?id=${listing.id}`)}>
                  <Ionicons name="create-outline" size={22} color="#fff" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: isOwner ? spacing.xl : 120 + insets.bottom }}>
        {images.length ? (
          <ImageCarousel urls={images} />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={42} color={colors.textMuted} />
            <Text style={styles.muted}>No photos yet</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.price}>{formatPrice(listing.price)}</Text>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.tags}>
            <Tag icon="pricetag-outline" text={landTypeLabels[listing.land_type]} />
            {area ? <Tag icon="resize-outline" text={area} /> : null}
            {listing.city ? <Tag icon="business-outline" text={listing.city} /> : null}
            {listing.status !== 'active' ? <Tag icon="eye-off-outline" text={listing.status === 'sold' ? 'Sold' : 'Hidden'} /> : null}
          </View>
        </View>

        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.heading}>About this land</Text>
            <Text style={styles.body}>{listing.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Location</Text>
          {listing.address ? <Text style={styles.body}>{listing.address}</Text> : null}
          <LandMap
            pins={[{ id: listing.id, latitude: listing.latitude, longitude: listing.longitude, label: formatPrice(listing.price) }]}
            center={{ latitude: listing.latitude, longitude: listing.longitude }}
            zoom={15}
            style={styles.map}
          />
          <Pressable
            style={styles.directions}
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`)}
          >
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.directionsText}>Open in maps</Text>
          </Pressable>
        </View>

        {listing.owner ? (
          <Pressable style={[styles.section, styles.ownerRow]} onPress={() => router.push(`/user/${listing.owner_id}`)}>
            <Avatar name={listing.owner.full_name} path={listing.owner.avatar_path} size={48} />
            <View style={styles.ownerText}>
              <Text style={styles.ownerName}>{isOwner ? 'You' : listing.owner.full_name}</Text>
              <RoleBadge role={listing.owner.role} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {isOwner ? (
          <View style={[styles.section, styles.ownerActions]}>
            <Button title="Edit listing" onPress={() => router.push(`/listing/edit?id=${listing.id}`)} />
            {listing.status === 'active' ? (
              <>
                <Button title="Mark as sold" variant="secondary" onPress={() => setStatus('sold')} />
                <Button title="Hide from buyers" variant="secondary" onPress={() => setStatus('archived')} />
              </>
            ) : (
              <Button title="Show to buyers again" variant="secondary" onPress={() => setStatus('active')} />
            )}
            <Button title="Delete listing" variant="ghost" onPress={remove} />
          </View>
        ) : (
          <Text style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={12} /> Phone numbers stay private. Chat and calls happen inside LandConnect.
          </Text>
        )}
      </ScrollView>

      {!isOwner ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <ActionButton icon="chatbubble-ellipses" label="Message" onPress={openChat} disabled={busy} />
          <ActionButton icon="call" label="Voice call" onPress={() => startCall(listing.owner_id, 'audio')} disabled={busy} />
          <ActionButton icon="videocam" label="Video call" onPress={() => startCall(listing.owner_id, 'video')} disabled={busy} />
          <ActionButton icon="people" label="Meeting" onPress={startMeeting} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

function Tag({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]} onPress={onPress} disabled={disabled}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  noImage: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.border },
  section: { backgroundColor: colors.surface, padding: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
  price: { fontSize: 26, fontWeight: '800', color: colors.text },
  title: { fontSize: 18, fontWeight: '500', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  tagText: { color: colors.primaryDark, fontSize: 13, fontWeight: '500' },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  map: { height: 200, borderRadius: radius.md },
  directions: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  directionsText: { color: colors.primary, fontWeight: '600' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ownerText: { flex: 1, gap: 4 },
  ownerName: { fontSize: 16, fontWeight: '600', color: colors.text },
  ownerActions: { gap: spacing.sm },
  privacyNote: { fontSize: 12, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  action: { alignItems: 'center', gap: 4, width: 76 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, color: colors.text, fontWeight: '500' },
});
