import Cookies from 'js-cookie';
import { STORAGE_KEYS } from '../constants';
import { User } from '../types/api';

const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export const getAccessToken = (): string | undefined => {
  return Cookies.get(STORAGE_KEYS.ACCESS_TOKEN);
};

export const setAccessToken = (token: string, expiresDays = 1): void => {
  Cookies.set(STORAGE_KEYS.ACCESS_TOKEN, token, {
    ...COOKIE_OPTIONS,
    expires: expiresDays,
  });
};

export const removeAccessToken = (): void => {
  Cookies.remove(STORAGE_KEYS.ACCESS_TOKEN, { path: '/' });
};

export const getRefreshToken = (): string | undefined => {
  return Cookies.get(STORAGE_KEYS.REFRESH_TOKEN);
};

export const setRefreshToken = (token: string, expiresDays = 7): void => {
  Cookies.set(STORAGE_KEYS.REFRESH_TOKEN, token, {
    ...COOKIE_OPTIONS,
    expires: expiresDays,
  });
};

export const removeRefreshToken = (): void => {
  Cookies.remove(STORAGE_KEYS.REFRESH_TOKEN, { path: '/' });
};

export const clearTokens = (): void => {
  removeAccessToken();
  removeRefreshToken();
};

export interface DecodedJwt {
  sub: string;
  tenantId?: string;
  employeeId?: string;
  email: string;
  role: User['role'];
  exp?: number;
  iat?: number;
}

export const decodeTokenPayload = (token: string): DecodedJwt | null => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const getUserFromToken = (token: string): User | null => {
  const decoded = decodeTokenPayload(token);
  if (!decoded) return null;

  // Check if token has expired
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    return null;
  }

  return {
    id: decoded.sub,
    tenantId: decoded.tenantId,
    employeeId: decoded.employeeId,
    email: decoded.email,
    role: decoded.role,
  };
};

