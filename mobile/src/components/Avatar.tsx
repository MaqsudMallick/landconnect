import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { initials } from '@/lib/format';
import { AVATAR_BUCKET, publicImageUrl } from '@/lib/images';
import { colors } from '@/lib/theme';

const palette = ['#0F6E56', '#1D4ED8', '#B45309', '#7C3AED', '#BE185D', '#0E7490'];

function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

type Props = { name: string | null | undefined; path?: string | null; size?: number; icon?: React.ReactNode };

export function Avatar({ name, path, size = 44, icon }: Props) {
  const url = publicImageUrl(AVATAR_BUCKET, path);
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={[styles.image, dimension]} contentFit="cover" />;
  return (
    <View style={[styles.fallback, dimension, { backgroundColor: icon ? colors.primary : colorFor(name ?? '?') }]}>
      {icon ?? <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '700' },
});
