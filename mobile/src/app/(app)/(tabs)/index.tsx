import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { useListings } from '@/hooks/useListings';
import { colors, radius, spacing } from '@/lib/theme';
import type { LandType } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';

const filters: { value: LandType | 'all'; label: string }[] = [
  { value: 'all', label: 'All land' },
  { value: 'residential', label: 'Residential' },
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
];

export default function CommunityScreen() {
  const { profile } = useCurrentUser();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [landType, setLandType] = useState<LandType | 'all'>('all');
  const { listings, loading, error, reload } = useListings({ search, landType });
  const canList = profile.role === 'seller' || profile.role === 'broker';

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search by title, city or area"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searchInput ? (
                <Pressable onPress={() => setSearchInput('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Chips options={filters} value={landType} onChange={setLandType} scrollable />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState
              icon="leaf-outline"
              title={search || landType !== 'all' ? 'No land matches your search' : 'No listings yet'}
              message={canList ? 'Tap + to post the first one.' : 'Sellers and brokers will post land here.'}
            />
          )
        }
      />
      {canList ? (
        <Pressable accessibilityLabel="Post land" style={styles.fab} onPress={() => router.push('/listing/edit')}>
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 100, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  error: { color: colors.danger },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
