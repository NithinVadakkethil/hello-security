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
  Scanner:
    | {
        checkpointId?: string;
        checkpointCode?: string;
        checkpointName?: string;
        sequenceOrder?: number;
      }
    | undefined;
  ReportIncident: undefined;
  ReportSnag: { gateId?: string; patrolSessionId?: string } | undefined;
  History: undefined;
  AssignedMaintenance: undefined;
  PatrolDetails: { patrolId: string };
  FaceVerificationPrototype: undefined;
  FaceRegistration: undefined;
  FaceVerification: {
    mode?: 'MARK_ATTENDANCE' | 'VERIFY_ONLY' | 'CHECKPOINT_UNLOCK';
    assignment?: any;
    checkpointParams?: {
      checkpointId?: string;
      checkpointCode?: string;
      checkpointName?: string;
      sequenceOrder?: number;
    };
  } | undefined;
  Attendance: { assignment?: any } | undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppStack: { screen: keyof AppTabParamList } | undefined;
  SiraRestrictedStack: undefined;
};
