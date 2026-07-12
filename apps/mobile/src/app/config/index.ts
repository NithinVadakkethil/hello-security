import { Platform } from 'react-native';

const LOCAL_API_URL = Platform.select({
  ios: 'http://localhost:3000/api/v1',
  // Use 127.0.0.1 to avoid IPv6 localhost resolution mismatch on some Android devices
  // Make sure to run: adb reverse tcp:3000 tcp:3000
  android: 'http://192.168.1.34:3000/api/v1',
  default: 'http://localhost:3000/api/v1',
});

export const Config = {
  API_URL: LOCAL_API_URL,
  TIMEOUT: 10000,
};
