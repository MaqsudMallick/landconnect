import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { LandMap, type Coordinates } from '@/components/LandMap';
import { TextField } from '@/components/TextField';
import { LISTING_BUCKET, pickImages, publicImageUrl, randomId, takePhoto, uploadImage } from '@/lib/images';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { AreaUnit, LandType, Listing, ListingImage } from '@/lib/types';
import { useCurrentUser } from '@/providers/AuthProvider';

const MAX_PHOTOS = 8;

const landTypes: { value: LandType; label: string }[] = [
  { value: 'residential', label: 'Residential' },
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
];

const areaUnits: { value: AreaUnit; label: string }[] = [
  { value: 'sqft', label: 'sq ft' },
  { value: 'sqm', label: 'sq m' },
  { value: 'acre', label: 'acre' },
  { value: 'cent', label: 'cent' },
  { value: 'guntha', label: 'guntha' },
  { value: 'hectare', label: 'hectare' },
];

type Photo = { key: string; uri: string; existing?: ListingImage };

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { userId, profile } = useCurrentUser();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('sqft');
  const [landType, setLandType] = useState<LandType>('residential');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(profile.city ?? '');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState<ListingImage[]>([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('listings')
      .select('*, listing_images(id, listing_id, storage_path, position)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error || !data) {
          Alert.alert('Listing', 'Could not load this listing.');
          router.back();
          return;
        }
        const listing = data as Listing;
        setTitle(listing.title);
        setDescription(listing.description);
        setPrice(String(Number(listing.price)));
        setArea(listing.area ? String(Number(listing.area)) : '');
        setAreaUnit(listing.area_unit);
        setLandType(listing.land_type);
        setAddress(listing.address);
        setCity(listing.city);
        setLocation({ latitude: listing.latitude, longitude: listing.longitude });
        setPhotos(
          [...(listing.listing_images ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((image) => ({ key: image.id, uri: publicImageUrl(LISTING_BUCKET, image.storage_path) ?? '', existing: image })),
        );
      });
  }, [id]);

  const fillAddress = async (coordinates: Coordinates) => {
    try {
      const [place] = await Location.reverseGeocodeAsync(coordinates);
      if (!place) return;
      const line = [place.name, place.street, place.district, place.subregion].filter(Boolean).join(', ');
      if (line && !address) setAddress(line);
      if (place.city && !city) setCity(place.city);
    } catch {
      return;
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location', 'Allow location access, or tap the map to place the pin.');
        return;
      }
      const position =
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ??
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(coordinates);
      fillAddress(coordinates);
    } catch {
      Alert.alert('Location', 'Could not get your location. Turn on location in your phone settings, or tap the map to place the pin.');
    } finally {
      setLocating(false);
    }
  };

  const addPhotos = async (source: 'library' | 'camera') => {
    try {
      const room = MAX_PHOTOS - photos.length;
      if (room <= 0) return Alert.alert('Photos', `You can add up to ${MAX_PHOTOS} photos.`);
      const uris = source === 'camera' ? [await takePhoto()].filter((uri): uri is string => !!uri) : await pickImages({ multiple: true, limit: room });
      setPhotos((current) => [...current, ...uris.slice(0, room).map((uri) => ({ key: randomId(), uri }))]);
    } catch (error) {
      Alert.alert('Photos', errorMessage(error));
    }
  };

  const removePhoto = (photo: Photo) => {
    setPhotos((current) => current.filter((item) => item.key !== photo.key));
    if (photo.existing) setRemoved((current) => [...current, photo.existing as ListingImage]);
  };

  const makeCover = (photo: Photo) => setPhotos((current) => [photo, ...current.filter((item) => item.key !== photo.key)]);

  const save = async () => {
    const priceValue = Number(price.replace(/[^0-9.]/g, ''));
    const areaValue = area ? Number(area.replace(/[^0-9.]/g, '')) : null;
    if (title.trim().length < 3) return Alert.alert('Listing', 'Give the listing a title of at least 3 characters.');
    if (!priceValue || priceValue <= 0) return Alert.alert('Listing', 'Enter the asking price in rupees.');
    if (areaValue !== null && !(areaValue > 0)) return Alert.alert('Listing', 'Enter a valid area or leave it empty.');
    if (!location) return Alert.alert('Listing', 'Place the land on the map: tap the map or use your location.');

    setSaving(true);
    let createdId: string | null = null;
    try {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        price: priceValue,
        area: areaValue,
        area_unit: areaUnit,
        land_type: landType,
        address: address.trim(),
        city: city.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      };
      let listingId = id;
      if (listingId) {
        const { error } = await supabase.from('listings').update(fields).eq('id', listingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('listings').insert(fields).select('id').single();
        if (error) throw error;
        listingId = data.id as string;
        createdId = listingId;
      }

      if (removed.length) {
        await supabase.from('listing_images').delete().in('id', removed.map((image) => image.id));
        await supabase.storage.from(LISTING_BUCKET).remove(removed.map((image) => image.storage_path));
      }

      for (const [position, photo] of photos.entries()) {
        if (photo.existing) {
          if (photo.existing.position !== position) {
            await supabase.from('listing_images').update({ position }).eq('id', photo.existing.id);
          }
          continue;
        }
        const path = `${userId}/${listingId}/${randomId()}.jpg`;
        await uploadImage(LISTING_BUCKET, path, photo.uri);
        const { error } = await supabase.from('listing_images').insert({ listing_id: listingId, storage_path: path, position });
        if (error) throw error;
      }

      router.replace(`/listing/${listingId}`);
    } catch (error) {
      if (createdId) await supabase.from('listings').delete().eq('id', createdId);
      Alert.alert('Could not save', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.center} color={colors.primary} />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Edit listing' : 'Post land' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((photo, index) => (
            <Pressable key={photo.key} onLongPress={() => makeCover(photo)} style={styles.photo}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {index === 0 ? (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              ) : null}
              <Pressable hitSlop={8} style={styles.removePhoto} onPress={() => removePhoto(photo)}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <>
              <Pressable style={[styles.photo, styles.addPhoto]} onPress={() => addPhotos('library')}>
                <Ionicons name="images-outline" size={26} color={colors.primary} />
                <Text style={styles.addText}>Gallery</Text>
              </Pressable>
              <Pressable style={[styles.photo, styles.addPhoto]} onPress={() => addPhotos('camera')}>
                <Ionicons name="camera-outline" size={26} color={colors.primary} />
                <Text style={styles.addText}>Camera</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
        <Text style={styles.hint}>Long-press a photo to make it the cover.</Text>

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. 30x40 plot near Sarjapur Road" maxLength={120} />
        <TextField label="Asking price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="4500000" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Area" value={area} onChangeText={setArea} keyboardType="numeric" placeholder="1200" />
          </View>
        </View>
        <Chips options={areaUnits} value={areaUnit} onChange={setAreaUnit} scrollable />

        <Text style={styles.heading}>Land type</Text>
        <Chips options={landTypes} value={landType} onChange={setLandType} scrollable />

        <TextField label="Description" value={description} onChangeText={setDescription} multiline placeholder="Road access, water, documents, nearby landmarks…" maxLength={4000} />

        <Text style={styles.heading}>Location</Text>
        <LandMap
          selectable
          selected={location}
          center={location ?? undefined}
          onSelect={(coordinates) => {
            setLocation(coordinates);
            fillAddress(coordinates);
          }}
          style={styles.map}
        />
        <Text style={styles.hint}>{location ? `Pin at ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Tap the map to drop a pin.'}</Text>
        <Button title="Use my current location" variant="secondary" loading={locating} onPress={useMyLocation} icon={<Ionicons name="locate" size={18} color={colors.primary} />} />
        <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Survey number, village or street" maxLength={300} />
        <TextField label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" maxLength={80} />

        <Button title={id ? 'Save changes' : 'Publish listing'} onPress={save} loading={saving} style={styles.save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted },
  photos: { gap: spacing.sm },
  photo: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.border },
  addPhoto: { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  addText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  coverBadge: { position: 'absolute', left: 4, bottom: 4, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  coverText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  map: { height: 240, borderRadius: radius.md },
  save: { marginTop: spacing.lg },
});
