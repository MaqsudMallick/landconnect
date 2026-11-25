import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatArea, formatPrice, landTypeLabels } from '@/lib/format';
import { LISTING_BUCKET, publicImageUrl } from '@/lib/images';
import { colors, radius } from '@/lib/theme';
import type { Listing } from '@/lib/types';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

type Props = { listing: Listing; onPress: () => void };

export function ListingCard({ listing, onPress }: Props) {
  const cover = [...(listing.listing_images ?? [])].sort((a, b) => a.position - b.position)[0];
  const coverUrl = publicImageUrl(LISTING_BUCKET, cover?.storage_path);
  const area = formatArea(listing.area, listing.area_unit);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="image-outline" size={36} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.typePill}>
          <Text style={styles.typeText}>{landTypeLabels[listing.land_type]}</Text>
        </View>
        {listing.status !== 'active' ? (
          <View style={[styles.typePill, styles.statusPill]}>
            <Text style={styles.typeText}>{listing.status === 'sold' ? 'Sold' : 'Hidden'}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.price}>{formatPrice(listing.price)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {[listing.city, area].filter(Boolean).join(' · ') || 'Location on map'}
          </Text>
        </View>
        {listing.owner ? (
          <View style={styles.ownerRow}>
            <Avatar name={listing.owner.full_name} path={listing.owner.avatar_path} size={22} />
            <Text style={styles.owner} numberOfLines={1}>
              {listing.owner.full_name}
            </Text>
            <RoleBadge role={listing.owner.role} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.92 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  typePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(17,27,33,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPill: { left: undefined, right: 10, backgroundColor: colors.warning },
  typeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: 14, gap: 4 },
  price: { fontSize: 20, fontWeight: '700', color: colors.text },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, color: colors.textMuted, flex: 1 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  owner: { fontSize: 13, color: colors.text, flexShrink: 1 },
});
