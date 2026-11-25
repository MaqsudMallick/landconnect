import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export const LISTING_BUCKET = 'listing-images';
export const AVATAR_BUCKET = 'avatars';

export function publicImageUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function pickImages(options: { multiple: boolean; limit?: number }) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to add pictures.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options.multiple,
    selectionLimit: options.limit ?? 0,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => asset.uri);
}

export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Allow camera access to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

async function compressToJpeg(uri: string, maxWidth: number) {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: maxWidth }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('Could not read the image.');
  return saved.base64;
}

export async function uploadImage(bucket: string, path: string, localUri: string, maxWidth = 1440) {
  const base64 = await compressToJpeg(localUri, maxWidth);
  const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
    contentType: 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
