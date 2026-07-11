import { storage } from './mmkv-storage';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenManager = {
  getAccessToken: () => storage.getString(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => storage.set(ACCESS_TOKEN_KEY, token),
  removeAccessToken: () => storage.delete(ACCESS_TOKEN_KEY),

  getRefreshToken: () => storage.getString(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => storage.set(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: () => storage.delete(REFRESH_TOKEN_KEY),

  clearTokens: () => {
    storage.delete(ACCESS_TOKEN_KEY);
    storage.delete(REFRESH_TOKEN_KEY);
  },
};
