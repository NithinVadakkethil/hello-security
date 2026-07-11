import { Platform } from 'react-native';

const LOCAL_API_URL = Platform.select({
  ios: 'http://localhost:3000/api/v1',
  android: 'http://10.0.2.2:3000/api/v1',
  default: 'http://localhost:3000/api/v1',
});

export const Config = {
  API_URL: LOCAL_API_URL,
  TIMEOUT: 10000,
};
