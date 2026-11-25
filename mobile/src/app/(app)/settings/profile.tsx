import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { AVATAR_BUCKET, pickImages, uploadImage } from '@/lib/images';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';

export default function EditProfileScreen() {
  const { userId, profile } = useCurrentUser();
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile.full_name);
  const [city, setCity] = useState(profile.city);
  const [bio, setBio] = useState(profile.bio);
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const changePhoto = async () => {
    try {
      const [uri] = await pickImages({ multiple: false });
      if (!uri) return;
      setUploading(true);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      await uploadImage(AVATAR_BUCKET, path, uri, 512);
      if (profile.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
      setAvatarPath(path);
      await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
      await refreshProfile();
    } catch (error) {
      Alert.alert('Photo', errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (fullName.trim().length < 2) return Alert.alert('Profile', 'Enter your name.');
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), city: city.trim(), bio: bio.trim() })
      .eq('id', userId);
    setSaving(false);
    if (error) return Alert.alert('Profile', errorMessage(error));
    await refreshProfile();
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.avatar} onPress={changePhoto} disabled={uploading}>
        <Avatar name={fullName} path={avatarPath} size={96} />
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
        <Text style={styles.change}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
      </Pressable>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} maxLength={80} />
      <TextField label="City" value={city} onChangeText={setCity} maxLength={80} />
      <TextField label="About you" value={bio} onChangeText={setBio} multiline maxLength={280} hint={`${bio.length}/280`} />
      <Text style={styles.note}>Your role cannot be changed after sign-up. It decides whether you can post land.</Text>
      <Button title="Save" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  avatar: { alignItems: 'center', gap: spacing.sm },
  cameraBadge: { position: 'absolute', top: 66, left: '55%', backgroundColor: colors.primary, borderRadius: 14, padding: 6 },
  change: { color: colors.primary, fontWeight: '600' },
  note: { fontSize: 12, color: colors.textMuted },
});
