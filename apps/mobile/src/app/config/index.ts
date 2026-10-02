import { Platform } from 'react-native';

//For Android Emulator, use 'http://10.0.2.2:3001/api/v1'
//For Android Physical Device, use 'http://127.0.0.1:3001/api/v1'

const LOCAL_API_URL = Platform.select({
  ios: 'http://localhost:3001/api/v1',
  android: 'http://127.0.0.1:3001/api/v1',
  default: 'http://127.0.0.1:3001/api/v1',
});

const PRODUCTION_API_URL = 'https://demoorbit.helloentry.com/api/v1';

export const Config = {
  API_URL: __DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL,
  // API_URL: PRODUCTION_API_URL,
  TIMEOUT: 60000,
};
