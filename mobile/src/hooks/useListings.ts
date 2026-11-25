import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LandType, Listing } from '@/lib/types';

export const LISTING_SELECT =
  '*, listing_images(id, listing_id, storage_path, position), owner:profiles!listings_owner_id_fkey(id, full_name, role, avatar_path)';

type Filters = { search?: string; landType?: LandType | 'all'; ownerId?: string; includeInactive?: boolean };

export function useListings(filters: Filters) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('listings').select(LISTING_SELECT).order('created_at', { ascending: false }).limit(200);
    if (!filters.includeInactive) query = query.eq('status', 'active');
    if (filters.ownerId) query = query.eq('owner_id', filters.ownerId);
    if (filters.landType && filters.landType !== 'all') query = query.eq('land_type', filters.landType);
    const term = filters.search?.trim().replace(/[%,()]/g, ' ');
    if (term) query = query.or(`title.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
    const { data, error: loadError } = await query;
    setLoading(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setError(null);
    setListings((data ?? []) as Listing[]);
  }, [filters.search, filters.landType, filters.ownerId, filters.includeInactive]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { listings, loading, error, reload: load };
}
