import { registerGlobals } from '@livekit/react-native';
import { setLogLevel } from 'livekit-client';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ServerProvider } from '@/providers/ServerProvider';

registerGlobals();
setLogLevel('error');

function RootNavigator() {
  const { session, profile, initializing, profileFailed, refreshProfile, signOut } = useAuth();

  if (session && !profile && profileFailed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: colors.primary }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>Could not load your account. Check your connection and try again.</Text>
        <Pressable onPress={refreshProfile} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff' }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Try again</Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={{ color: '#fff', textDecorationLine: 'underline' }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (initializing || (session && !profile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ServerProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ServerProvider>
    </SafeAreaProvider>
  );
}
