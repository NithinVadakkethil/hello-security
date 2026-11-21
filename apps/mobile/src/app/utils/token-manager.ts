import { storage } from './mmkv-storage';
import { User } from '../types/api';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_SESSION_KEY = 'user_session';
const OFFLINE_METADATA_KEY = 'offline_session_metadata';

// 30 days default offline grace period
export const DEFAULT_OFFLINE_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export interface OfflineSessionMetadata {
  lastOnlineTimestamp: number;
  offlineGracePeriodMs: number;
  isRevoked: boolean;
  cachedAt: number;
}

export const tokenManager = {
  // Access Token
  getAccessToken: (): string | null => storage.getString(ACCESS_TOKEN_KEY) || null,
  setAccessToken: (token: string): void => storage.set(ACCESS_TOKEN_KEY, token),
  removeAccessToken: (): void => storage.delete(ACCESS_TOKEN_KEY),

  // Refresh Token
  getRefreshToken: (): string | null => storage.getString(REFRESH_TOKEN_KEY) || null,
  setRefreshToken: (token: string): void => storage.set(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: (): void => storage.delete(REFRESH_TOKEN_KEY),

  // Unified Tokens
  getTokens: (): { accessToken: string | null; refreshToken: string | null } => ({
    accessToken: storage.getString(ACCESS_TOKEN_KEY) || null,
    refreshToken: storage.getString(REFRESH_TOKEN_KEY) || null,
  }),

  // User Profile Session
  getUserSession: (): User | null => {
    try {
      const raw = storage.getString(USER_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as User;
    } catch (e) {
      console.warn('[tokenManager] Failed to parse cached user session:', e);
      return null;
    }
  },
  setUserSession: (user: User): void => {
    try {
      storage.set(USER_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('[tokenManager] Failed to cache user session:', e);
    }
  },
  removeUserSession: (): void => storage.delete(USER_SESSION_KEY),

  // Offline Session Metadata & Policy
  getOfflineMetadata: (): OfflineSessionMetadata | null => {
    try {
      const raw = storage.getString(OFFLINE_METADATA_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OfflineSessionMetadata;
    } catch {
      return null;
    }
  },
  setOfflineMetadata: (meta: Partial<OfflineSessionMetadata>): void => {
    try {
      const current = tokenManager.getOfflineMetadata() || {
        lastOnlineTimestamp: Date.now(),
        offlineGracePeriodMs: DEFAULT_OFFLINE_GRACE_PERIOD_MS,
        isRevoked: false,
        cachedAt: Date.now(),
      };
      const updated: OfflineSessionMetadata = {
        ...current,
        ...meta,
        cachedAt: Date.now(),
      };
      storage.set(OFFLINE_METADATA_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[tokenManager] Failed to set offline metadata:', e);
    }
  },
  updateOnlineTimestamp: (): void => {
    tokenManager.setOfflineMetadata({
      lastOnlineTimestamp: Date.now(),
      isRevoked: false,
    });
  },

  // Authoritative Offline Eligibility Check
  isOfflineSessionEligible: (): boolean => {
    const user = tokenManager.getUserSession();
    if (!user || !user.id || !user.role) {
      return false;
    }

    const hasTokens = !!(tokenManager.getAccessToken() || tokenManager.getRefreshToken());
    if (!hasTokens) {
      return false;
    }

    const meta = tokenManager.getOfflineMetadata();
    if (!meta) {
      // If legacy session has user + token but no meta, initialize meta
      tokenManager.updateOnlineTimestamp();
      return true;
    }

    if (meta.isRevoked) {
      return false;
    }

    const elapsed = Date.now() - meta.lastOnlineTimestamp;
    const gracePeriod = meta.offlineGracePeriodMs || DEFAULT_OFFLINE_GRACE_PERIOD_MS;
    if (elapsed > gracePeriod) {
      console.warn('[tokenManager] Offline grace period expired:', { elapsed, gracePeriod });
      return false;
    }

    return true;
  },

  // Save Complete Authorized Session
  saveSession: (
    data: { accessToken: string; refreshToken?: string; user?: User },
    userParam?: User
  ): void => {
    tokenManager.setAccessToken(data.accessToken);
    if (data.refreshToken) {
      tokenManager.setRefreshToken(data.refreshToken);
    }
    const targetUser = data.user || userParam;
    if (targetUser) {
      tokenManager.setUserSession(targetUser);
    }
    tokenManager.updateOnlineTimestamp();
  },

  // Clear Session On Explicit Logout or Authoritative Server Revocation
  clearTokens: (): void => {
    storage.delete(ACCESS_TOKEN_KEY);
    storage.delete(REFRESH_TOKEN_KEY);
  },

  clearSession: (): void => {
    storage.delete(ACCESS_TOKEN_KEY);
    storage.delete(REFRESH_TOKEN_KEY);
    storage.delete(USER_SESSION_KEY);
    tokenManager.setOfflineMetadata({ isRevoked: true });
  },
};
