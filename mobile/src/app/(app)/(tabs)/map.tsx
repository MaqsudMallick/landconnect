import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LandMap } from '@/components/LandMap';
import { useListings } from '@/hooks/useListings';
import { formatArea, formatPrice } from '@/lib/format';
import { LISTING_BUCKET, publicImageUrl } from '@/lib/images';
import { colors, radius, spacing } from '@/lib/theme';

export default function MapScreen() {
  const { listings, loading } = useListings({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pins = useMemo(
    () =>
      listings.map((listing) => ({
        id: listing.id,
        latitude: listing.latitude,
        longitude: listing.longitude,
        label: formatPrice(listing.price),
      })),
    [listings],
  );
  const selected = listings.find((listing) => listing.id === selectedId);
  const cover = selected?.listing_images?.slice().sort((a, b) => a.position - b.position)[0];

  return (
    <View style={styles.screen}>
      <LandMap pins={pins} onPinPress={setSelectedId} style={StyleSheet.absoluteFill} />
      {loading ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Loading listings…</Text>
        </View>
      ) : null}
      {selected ? (
        <Pressable style={styles.card} onPress={() => router.push(`/listing/${selected.id}`)}>
          {cover ? (
            <Image source={{ uri: publicImageUrl(LISTING_BUCKET, cover.storage_path) ?? undefined }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.price}>{formatPrice(selected.price)}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {selected.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[selected.city, formatArea(selected.area, selected.area_unit)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={() => setSelectedId(null)} style={styles.close}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  bannerText: { color: colors.text, fontSize: 13 },
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, justifyContent: 'center', gap: 2 },
  price: { fontSize: 18, fontWeight: '700', color: colors.text },
  title: { fontSize: 14, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  close: { position: 'absolute', top: 8, right: 8 },
});
