import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AppTabParamList } from './types';
import {
  DashboardPlaceholderScreen,
  ShiftsPlaceholderScreen,
  PatrolPlaceholderScreen,
  ReportsPlaceholderScreen,
} from './placeholder-screens';

const Stack = createStackNavigator<AppTabParamList>();

export function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={DashboardPlaceholderScreen} options={{ title: 'Guard Dashboard' }} />
      <Stack.Screen name="Shifts" component={ShiftsPlaceholderScreen} options={{ title: 'My Shifts' }} />
      <Stack.Screen name="Patrol" component={PatrolPlaceholderScreen} options={{ title: 'Checkpoint Patrol' }} />
      <Stack.Screen name="Reports" component={ReportsPlaceholderScreen} options={{ title: 'Incidents & Reports' }} />
    </Stack.Navigator>
  );
}
