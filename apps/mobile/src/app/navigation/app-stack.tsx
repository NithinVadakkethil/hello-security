import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppTabParamList } from './types';
import { useTheme } from '../hooks/useTheme';
import { DashboardSelector } from '../../modules/dashboard/screens/DashboardSelector';
import { TodayAssignmentScreen } from '../../modules/assignment/screens/TodayAssignmentScreen';
import { AssignmentDetailsScreen } from '../../modules/assignment/screens/AssignmentDetailsScreen';
import { ShiftDetailsScreen } from '../../modules/assignment/screens/ShiftDetailsScreen';
import { PatrolRouteScreen } from '../../modules/assignment/screens/PatrolRouteScreen';
import { AssignedGatesScreen } from '../../modules/assignment/screens/AssignedGatesScreen';
import { MapPreviewScreen } from '../../modules/assignment/screens/MapPreviewScreen';
import { PatrolScreen } from '../../modules/patrol/screens/PatrolScreen';
import { ScannerScreen } from '../../modules/scanner/screens/ScannerScreen';
import { ReportIncidentScreen } from '../../modules/incident/screens/ReportIncidentScreen';
import { ReportSnagScreen } from '../../modules/snag/screens/ReportSnagScreen';
import { ProfileScreen } from '../../modules/profile/screens/ProfileScreen';
import { PatrolDetailsScreen } from '../../modules/dashboard/screens/PatrolDetailsScreen';
import { HistoryScreen } from '../../modules/history/screens/HistoryScreen';
import { AssignedMaintenanceScreen } from '../../modules/maintenance/screens/AssignedMaintenanceScreen';
import { Home, ShieldAlert, Camera, Clipboard, User, History as HistoryIcon, Wrench } from 'lucide-react-native';

export type MainTabParamList = {
  HomeTab: undefined;
  PatrolTab: undefined;
  ScannerTab: undefined;
  HistoryTab: undefined;
  MaintenanceTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<AppTabParamList>();

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: '800',
          color: colors.text,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardSelector}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="PatrolTab"
        component={PatrolScreen}
        options={{
          title: 'Checkpoint Patrol',
          tabBarLabel: 'Patrol',
          tabBarIcon: ({ color, size }) => <Clipboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="ScannerTab"
        component={ScannerScreen}
        options={{
          title: 'QR Scanner',
          tabBarLabel: 'Scanner',
          tabBarIcon: ({ color, size }) => <Camera size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          title: 'Work History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <HistoryIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="MaintenanceTab"
        component={AssignedMaintenanceScreen}
        options={{
          title: 'Assigned Work',
          tabBarLabel: 'Jobs',
          tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Root Tabs */}
      <Stack.Screen name="Dashboard" component={MainTabs} />

      {/* Sub-screens (Hides Bottom Tabs automatically) */}
      <Stack.Screen name="Shifts" component={TodayAssignmentScreen} options={{ headerShown: true, title: 'My Assignment' }} />
      <Stack.Screen name="Patrol" component={PatrolScreen} options={{ headerShown: true, title: 'Checkpoint Patrol' }} />
      <Stack.Screen name="Reports" component={ReportIncidentScreen} options={{ headerShown: true, title: 'Incidents & Reports' }} />
      <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} options={{ headerShown: true, title: 'Report Security Incident' }} />
      <Stack.Screen name="ReportSnag" component={ReportSnagScreen} options={{ headerShown: true, title: 'Report Maintenance Snag' }} />
      <Stack.Screen name="AssignmentDetails" component={AssignmentDetailsScreen} options={{ headerShown: true, title: 'Assignment Details' }} />
      <Stack.Screen name="ShiftDetails" component={ShiftDetailsScreen} options={{ headerShown: true, title: 'Shift Details' }} />
      <Stack.Screen name="PatrolRoute" component={PatrolRouteScreen} options={{ headerShown: true, title: 'Patrol Route' }} />
      <Stack.Screen name="AssignedGates" component={AssignedGatesScreen} options={{ headerShown: true, title: 'Assigned Gates' }} />
      <Stack.Screen name="MapPreview" component={MapPreviewScreen} options={{ headerShown: true, title: 'Map Preview' }} />
      <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: true, title: 'QR Scanner' }} />
      <Stack.Screen name="PatrolDetails" component={PatrolDetailsScreen} options={{ headerShown: true, title: 'Patrol Details & Verification' }} />
    </Stack.Navigator>
  );
}
