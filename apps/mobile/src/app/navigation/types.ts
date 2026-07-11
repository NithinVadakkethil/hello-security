export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Shifts: undefined;
  Patrol: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppStack: { screen: keyof AppTabParamList } | undefined;
};
