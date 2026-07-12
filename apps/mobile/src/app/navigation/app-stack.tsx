import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AppTabParamList } from './types';
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

const Stack = createStackNavigator<AppTabParamList>();

export function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={DashboardSelector} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Shifts" component={TodayAssignmentScreen} options={{ title: 'My Assignment' }} />
      <Stack.Screen name="Patrol" component={PatrolScreen} options={{ title: 'Checkpoint Patrol' }} />
      <Stack.Screen name="Reports" component={ReportIncidentScreen} options={{ title: 'Incidents & Reports' }} />
      
      <Stack.Screen name="AssignmentDetails" component={AssignmentDetailsScreen} options={{ title: 'Assignment Details' }} />
      <Stack.Screen name="ShiftDetails" component={ShiftDetailsScreen} options={{ title: 'Shift Details' }} />
      <Stack.Screen name="PatrolRoute" component={PatrolRouteScreen} options={{ title: 'Patrol Route' }} />
      <Stack.Screen name="AssignedGates" component={AssignedGatesScreen} options={{ title: 'Assigned Gates' }} />
      <Stack.Screen name="MapPreview" component={MapPreviewScreen} options={{ title: 'Map Preview' }} />
      <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'QR Scanner' }} />
    </Stack.Navigator>
  );
}
