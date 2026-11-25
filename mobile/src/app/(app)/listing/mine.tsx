import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { useListings } from '@/hooks/useListings';
import { colors, spacing } from '@/lib/theme';
import { useCurrentUser } from '@/providers/AuthProvider';

export default function MyListingsScreen() {
  const { userId } = useCurrentUser();
  const { listings, loading, reload } = useListings({ ownerId: userId, includeInactive: true });

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} colors={[colors.primary]} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}`)} />}
      ListEmptyComponent={
        loading ? undefined : (
          <EmptyState
            icon="albums-outline"
            title="You have not posted any land yet"
            action={<Button title="Post land" onPress={() => router.push('/listing/edit')} />}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
});
