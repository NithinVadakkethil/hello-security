import { Platform } from 'react-native';

const LOCAL_API_URL = Platform.select({
  ios: 'http://localhost:3001/api/v1',
  // For Android Emulator, use 'http://10.0.2.2:3001/api/v1'
  // For Physical Android device via USB, run `adb reverse tcp:3001 tcp:3001` and use 'http://127.0.0.1:3001/api/v1'
  android: 'http://10.0.2.2:3001/api/v1',
  default: 'http://10.0.2.2:3001/api/v1',
});

const PRODUCTION_API_URL = 'https://orbit.helloentry.com/api/v1';

export const Config = {
  API_URL: __DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL,
  // API_URL: PRODUCTION_API_URL,
  TIMEOUT: 60000,
};
