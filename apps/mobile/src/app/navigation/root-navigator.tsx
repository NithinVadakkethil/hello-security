import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/auth-store';
import { RootStackParamList } from './types';
import { AuthStack } from './auth-stack';
import { AppStack } from './app-stack';
import { SiraRestrictedStack } from './sira-restricted-stack';
import { useTheme } from '../hooks/useTheme';
import { View, ActivityIndicator } from 'react-native';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isSecuritySiraExpired = user?.role === 'SECURITY' && Boolean(user?.isSiraExpired);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : isSecuritySiraExpired ? (
        <Stack.Screen name="SiraRestrictedStack" component={SiraRestrictedStack} />
      ) : (
        <Stack.Screen name="AppStack" component={AppStack} />
      )}
    </Stack.Navigator>
  );
}
