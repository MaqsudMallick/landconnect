import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/lib/theme';
import { currentServer, defaultServer, loadSavedServer, switchServer, type ServerConfig } from '@/lib/supabase';

type ServerContextValue = {
  server: ServerConfig;
  usingDefault: boolean;
  changeServer: (server: ServerConfig | null) => Promise<void>;
};

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<ServerConfig | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    loadSavedServer()
      .catch(() => currentServer())
      .then(setServer);
  }, []);

  const changeServer = useCallback(async (next: ServerConfig | null) => {
    const active = await switchServer(next);
    setServer(active);
    setGeneration((value) => value + 1);
  }, []);

  const value = useMemo<ServerContextValue | null>(
    () =>
      server && {
        server,
        usingDefault: server.url === defaultServer.url && server.anonKey === defaultServer.anonKey,
        changeServer,
      },
    [server, changeServer],
  );

  if (!value) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <ServerContext.Provider value={value}>
      <Fragment key={generation}>{children}</Fragment>
    </ServerContext.Provider>
  );
}

export function useServerSettings() {
  const value = useContext(ServerContext);
  if (!value) throw new Error('useServerSettings must be used inside ServerProvider');
  return value;
}
