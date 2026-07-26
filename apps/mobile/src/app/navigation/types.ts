export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Shifts: undefined;
  Patrol: undefined;
  Reports: undefined;
  AssignmentDetails: { assignment: any };
  ShiftDetails: { shift: any };
  PatrolRoute: { route: any };
  AssignedGates: { route: any };
  MapPreview: { site: any; route: any };
  Scanner: undefined;
  ReportIncident: undefined;
  PatrolDetails: { patrolId: string };
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppStack: { screen: keyof AppTabParamList } | undefined;
};
