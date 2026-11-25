import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { checkServer, defaultServer, errorMessage, isServerConfigured } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { useServerSettings } from '@/providers/ServerProvider';

export default function ServerScreen() {
  const { server, usingDefault, changeServer } = useServerSettings();
  const [url, setUrl] = useState(server.url);
  const [anonKey, setAnonKey] = useState(server.anonKey);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = { url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() };
    if (!/^https?:\/\/.+/.test(next.url) || !next.anonKey) {
      Alert.alert('Server', 'Enter the Supabase URL (starting with http:// or https://) and its anon key.');
      return;
    }
    setSaving(true);
    try {
      await checkServer(next);
      await changeServer(next);
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not reach the server', errorMessage(error));
    }
  };

  const reset = async () => {
    setSaving(true);
    await changeServer(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Server</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            The app talks to a Supabase backend. To use your own, for example one started with the Supabase CLI on a laptop on the same Wi-Fi, enter its URL and anon key.
          </Text>
          <TextField label="Supabase URL" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.20:54321" />
          <TextField label="Anon key" value={anonKey} onChangeText={setAnonKey} autoCapitalize="none" autoCorrect={false} placeholder="eyJhbGciOi..." multiline />
          <Button title="Save and connect" onPress={save} loading={saving} />
          {!usingDefault && isServerConfigured(defaultServer) ? (
            <Button title="Use the built-in server" variant="secondary" onPress={reset} disabled={saving} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  content: { padding: spacing.xl, gap: spacing.lg },
  intro: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
