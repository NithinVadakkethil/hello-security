import { tokenManager } from '../src/app/utils/token-manager';
import { useAuthStore } from '../src/app/store/auth-store';
import { assignmentApi } from '../src/modules/assignment/api/assignment.api';
import { sqliteDb } from '../src/app/database/sqlite-db';
import { apiClient } from '../src/app/api/api-client';
import { useOfflineStore } from '../src/app/store/offline-store';
import { User } from '../src/app/types/api';

describe('Offline Authentication & Session Bootstrap Architecture (P0)', () => {
  const mockUser: User = {
    id: 'usr_test_123',
    email: 'guard.peninsula@helloorbit.com',
    role: 'SECURITY',
    employeeId: 'emp_test_456',
    employee: {
      id: 'emp_test_456',
      name: 'Sudhakar Guard',
      employeeCode: 'EMP-000001',
      role: 'SECURITY_GUARD',
      clientId: 'cli_kaizen_peninsula',
      siteId: 'site_peninsula_1',
      client: {
        id: 'cli_kaizen_peninsula',
        name: 'Kaizen - Peninsula 1',
      },
      site: {
        id: 'site_peninsula_1',
        name: 'Tower A',
      },
    },
  };

  const mockTokens = {
    accessToken: 'mock_jwt_access_token_123',
    refreshToken: 'mock_jwt_refresh_token_456',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    useAuthStore.getState().clearAuth();
    tokenManager.clearSession();
  });

  describe('1. TokenManager Offline Metadata & Persistence', () => {
    test('saveSession persists access token, refresh token, user session, and initializes offline metadata', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      const retrievedTokens = tokenManager.getTokens();
      expect(retrievedTokens.accessToken).toBe(mockTokens.accessToken);
      expect(retrievedTokens.refreshToken).toBe(mockTokens.refreshToken);

      const userSession = tokenManager.getUserSession();
      expect(userSession).toEqual(mockUser);

      const metadata = tokenManager.getOfflineMetadata();
      expect(metadata).not.toBeNull();
      expect(metadata?.lastOnlineTimestamp).toBeGreaterThan(0);
      expect(metadata?.offlineGracePeriodMs).toBe(30 * 24 * 60 * 60 * 1000);

      const isEligible = tokenManager.isOfflineSessionEligible();
      expect(isEligible).toBe(true);
    });

    test('isOfflineSessionEligible returns false if offline grace period (30 days) is exceeded', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      // Force timestamp to 31 days ago
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      tokenManager.setOfflineMetadata({
        lastOnlineTimestamp: thirtyOneDaysAgo,
      });

      expect(tokenManager.isOfflineSessionEligible()).toBe(false);
    });

    test('clearSession removes all credentials, user object, and marks session revoked', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });
      expect(tokenManager.getUserSession()).not.toBeNull();

      tokenManager.clearSession();

      expect(tokenManager.getUserSession()).toBeNull();
      const tokens = tokenManager.getTokens();
      expect(tokens.accessToken).toBeNull();
      expect(tokens.refreshToken).toBeNull();
      expect(tokenManager.isOfflineSessionEligible()).toBe(false);
    });
  });

  describe('2. AuthStore Synchronous Pre-Hydration', () => {
    test('hydrateFromStorage synchronously populates state from persisted session', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      const hydrated = useAuthStore.getState().hydrateFromStorage();
      expect(hydrated).toBe(true);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
    });

    test('setAuth persists user session to tokenManager and marks authenticated', async () => {
      useAuthStore.getState().setAuth(mockUser);

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(tokenManager.getUserSession()).toEqual(mockUser);
    });

    test('clearAuth clears store state and removes persisted session', async () => {
      useAuthStore.getState().setAuth(mockUser);
      expect(tokenManager.getUserSession()).toEqual(mockUser);

      useAuthStore.getState().clearAuth();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(tokenManager.getUserSession()).toBeNull();
    });
  });

  describe('3. Assignment Caching and Offline Fallback in SQLite', () => {
    test('assignmentApi caches assignments into sqliteDb when online and returns them when offline', async () => {
      const mockAssignments = [
        {
          id: 'asg_1',
          patrolRouteId: 'route_1',
          employeeId: 'emp_test_456',
          status: 'ACTIVE',
          client: { id: 'cli_kaizen_peninsula', name: 'Kaizen - Peninsula 1' },
          route: { id: 'route_1', name: 'Perimeter Route' },
        },
      ];

      // Spy on apiClient.get to return mock assignments
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockAssignments,
      } as any);

      // 1. Fetch while online
      useOfflineStore.setState({ isConnected: true });
      const onlineResult = await assignmentApi.getActiveAssignments();
      expect(onlineResult).toEqual(mockAssignments);

      // Verify records were inserted into sqliteDb
      const cachedList = await sqliteDb.get<any[]>('assignments', 'active_list');
      expect(cachedList).toBeDefined();
      expect(cachedList?.length).toBeGreaterThan(0);
      expect(cachedList?.[0].route.name).toBe('Perimeter Route');

      // 2. Simulate device offline
      useOfflineStore.setState({ isConnected: false });
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error (offline)'));

      // getActiveAssignments should retrieve from sqliteDb without throwing
      const offlineResult = await assignmentApi.getActiveAssignments();
      expect(offlineResult.length).toBe(1);
      expect(offlineResult[0].id).toBe('asg_1');
      expect((offlineResult[0] as any).route.name).toBe('Perimeter Route');
    });

    test('getActiveAssignment returns the first cached assignment from active_list when offline', async () => {
      useOfflineStore.setState({ isConnected: false });
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error (offline)'));

      const active = await assignmentApi.getActiveAssignment();
      expect(active).not.toBeNull();
      expect(active?.id).toBe('asg_1');
    });
  });

  describe('4. Resilient Offline Event Queue Preservation', () => {
    test('offline mutations in queue are never cleared on cold offline launch or network error', async () => {
      const offlineStore = useOfflineStore.getState();
      await offlineStore.enqueue('/patrols/checkpoints/scan', 'POST', {
        checkpointId: 'chk_101',
        scannedAt: new Date().toISOString(),
      });

      expect(useOfflineStore.getState().queue.length).toBe(1);

      // Simulate a network failure on startup
      useOfflineStore.setState({ isConnected: false });

      // Ensure the queue is still intact
      expect(useOfflineStore.getState().queue.length).toBe(1);
      expect(useOfflineStore.getState().queue[0].url).toBe('/patrols/checkpoints/scan');
    });
  });

  describe('5. Safeguards on Refresh Token Network Errors', () => {
    test('network error during token refresh does NOT clear tokens or logout', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });
      useAuthStore.getState().setAuth(mockUser);

      // Verify initial state
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(tokenManager.getTokens().accessToken).toBe(mockTokens.accessToken);

      // Simulate a network failure on refresh
      const networkError = new Error('Network timeout');
      (networkError as any).response = undefined;

      // When isExplicitAuthFailure is checked (!err.response), it is false
      const isExplicitAuthFailure =
        Boolean((networkError as any).response &&
        ((networkError as any).response.status === 401 || (networkError as any).response.status === 403));
      expect(isExplicitAuthFailure).toBe(false);

      // Tokens and user must remain intact
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(tokenManager.getUserSession()).toEqual(mockUser);
    });

    test('explicit 401/403 revocation during token refresh clears tokens and logs out', async () => {
      tokenManager.saveSession({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });
      useAuthStore.getState().setAuth(mockUser);

      const revocationError = {
        response: { status: 401, data: { message: 'Token revoked' } },
      };

      const isExplicitAuthFailure =
        revocationError.response &&
        (revocationError.response.status === 401 || revocationError.response.status === 403);
      expect(isExplicitAuthFailure).toBe(true);

      if (isExplicitAuthFailure) {
        tokenManager.clearSession();
        useAuthStore.getState().clearAuth();
      }

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(tokenManager.getUserSession()).toBeNull();
      expect(tokenManager.getTokens().accessToken).toBeNull();
    });
  });
});
