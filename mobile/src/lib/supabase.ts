import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

export type ServerConfig = { url: string; anonKey: string };

const SAVED_SERVER_KEY = 'landconnect.server';

export const defaultServer: ServerConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

let activeServer = defaultServer;
let client = buildClient(activeServer);

function buildClient(server: ServerConfig) {
  return createClient(server.url || 'http://localhost', server.anonKey || 'missing-key', {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export function currentServer() {
  return activeServer;
}

export function isServerConfigured(server: ServerConfig = activeServer) {
  return server.url.length > 0 && server.anonKey.length > 0;
}

export async function loadSavedServer() {
  const saved = await AsyncStorage.getItem(SAVED_SERVER_KEY);
  if (saved) {
    const parsed = JSON.parse(saved) as ServerConfig;
    if (isServerConfigured(parsed)) {
      activeServer = parsed;
      client = buildClient(activeServer);
    }
  }
  return activeServer;
}

export async function switchServer(server: ServerConfig | null) {
  client.auth.stopAutoRefresh();
  if (server) {
    await AsyncStorage.setItem(SAVED_SERVER_KEY, JSON.stringify(server));
  } else {
    await AsyncStorage.removeItem(SAVED_SERVER_KEY);
  }
  activeServer = server ?? defaultServer;
  client = buildClient(activeServer);
  return activeServer;
}

export async function checkServer(server: ServerConfig) {
  const response = await fetch(`${server.url.replace(/\/+$/, '')}/auth/v1/health`, {
    headers: { apikey: server.anonKey },
  });
  if (!response.ok) {
    throw new Error(`The server answered with HTTP ${response.status}. Check the URL and the anon key.`);
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
