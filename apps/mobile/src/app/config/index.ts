import { Platform } from 'react-native';

const LOCAL_API_URL = Platform.select({
  ios: 'http://localhost:3001/api/v1',
  android: 'http://10.0.2.2:3001/api/v1',
  default: 'http://localhost:3001/api/v1',
});

const PRODUCTION_API_URL = 'https://orbit.helloentry.com/api/v1';

export const Config = {
  API_URL: __DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL,
  TIMEOUT: 10000,
};
