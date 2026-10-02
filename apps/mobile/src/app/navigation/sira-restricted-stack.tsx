import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SiraExpiredScreen } from '../../modules/auth/screens/SiraExpiredScreen';
import { ProfileScreen } from '../../modules/profile/screens/ProfileScreen';

export type SiraRestrictedStackParamList = {
  SiraExpired: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<SiraRestrictedStackParamList>();

export function SiraRestrictedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SiraExpired" component={SiraExpiredScreen} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          title: 'My Profile',
        }}
      />
    </Stack.Navigator>
  );
}
