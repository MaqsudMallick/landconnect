import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '@/lib/theme';

export function ImageCarousel({ urls, height = 260 }: { urls: string[]; height?: number }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  if (urls.length === 0) return <View style={[styles.empty, { height }]} />;
  return (
    <View>
      <FlatList
        data={urls}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(url) => url}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} contentFit="cover" transition={150} />}
      />
      {urls.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1}/{urls.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.border },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
