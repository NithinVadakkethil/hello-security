import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from './src/app/providers/query-provider';
import { AuthProvider } from './src/app/providers/auth-provider';
import { OfflineProvider } from './src/app/providers/offline-provider';
import { AppNavigationContainer } from './src/app/navigation/navigation-container';
import { StatusBar } from 'react-native';
import { useTheme } from './src/app/hooks/useTheme';

function AppContent() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppNavigationContainer />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <OfflineProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </OfflineProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
