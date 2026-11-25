import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/lib/theme';
import { CallProvider } from '@/providers/CallProvider';

export default function AppLayout() {
  return (
    <CallProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
        <Stack.Screen name="listing/edit" options={{ title: 'Listing', presentation: 'modal' }} />
        <Stack.Screen name="listing/mine" options={{ title: 'My listings' }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
        <Stack.Screen name="meeting/new" options={{ title: 'New meeting room', presentation: 'modal' }} />
        <Stack.Screen name="meeting/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings/profile" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="settings/privacy" options={{ title: 'Privacy' }} />
      </Stack>
    </CallProvider>
  );
}
