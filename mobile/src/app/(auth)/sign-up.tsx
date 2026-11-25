import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';
import type { UserRole } from '@/lib/types';

const roles: { value: UserRole; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'buyer', title: 'Buyer', description: 'Browse land, chat and call owners', icon: 'search' },
  { value: 'seller', title: 'Seller', description: 'List your own land for sale', icon: 'home' },
  { value: 'broker', title: 'Broker', description: 'List and manage land for clients', icon: 'briefcase' },
];

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (fullName.trim().length < 2) return Alert.alert('Sign up', 'Enter your name.');
    if (!email.includes('@')) return Alert.alert('Sign up', 'Enter a valid email.');
    if (password.length < 8) return Alert.alert('Sign up', 'Use a password of at least 8 characters.');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), role, city: city.trim() } },
    });
    setLoading(false);
    if (error) return Alert.alert('Sign up failed', errorMessage(error));
    if (!data.session) {
      Alert.alert('Check your email', 'Confirm your email address, then sign in.');
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose how you will use LandConnect. Your role decides what you can do.</Text>

          <View style={styles.roles}>
            {roles.map((option) => {
              const selected = option.value === role;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setRole(option.value)}
                  style={[styles.role, selected && styles.roleSelected]}
                >
                  <Ionicons name={option.icon} size={22} color={selected ? '#fff' : colors.primary} />
                  <View style={styles.roleText}>
                    <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{option.title}</Text>
                    <Text style={[styles.roleDescription, selected && styles.roleDescriptionSelected]}>{option.description}</Text>
                  </View>
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? '#fff' : colors.textMuted} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="Your name" />
            <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
            <TextField label="City (optional)" value={city} onChangeText={setCity} placeholder="Bengaluru" />
            <Button title="Create account" onPress={signUp} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  back: { alignSelf: 'flex-start', padding: 4 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  roles: { gap: spacing.sm },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { flex: 1, gap: 2 },
  roleTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  roleTitleSelected: { color: '#fff' },
  roleDescription: { fontSize: 13, color: colors.textMuted },
  roleDescriptionSelected: { color: '#d4efe5' },
  form: { gap: spacing.lg, marginTop: spacing.sm },
});
