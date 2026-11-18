import { offlineSyncEngine } from '../src/app/services/offline-sync-engine';
import { useOfflineStore } from '../src/app/store/offline-store';
import { useAuthStore } from '../src/app/store/auth-store';
import { tokenManager } from '../src/app/utils/token-manager';
import { apiClient } from '../src/app/api/api-client';
import { usePatrolStore } from '../src/modules/patrol/store/patrol-store';

jest.mock('../src/app/api/api-client');

describe('OfflineSyncEngine P0 Critical Regression Tests', () => {
  const mockUser = {
    id: 'cmuwpqz5l01xmhp87s6242s6w',
    email: 'binyapalsing.101@helloorbit.com',
    role: 'SECURITY',
    employeeId: 'cmuwpqz5g01xkhp87mi8wnydh',
    employee: {
      id: 'cmuwpqz5g01xkhp87mi8wnydh',
      name: 'Binyapal Singh',
      clientId: 'cmuckz7o1051ghpt04rm8z5wf',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await useOfflineStore.getState().clearQueue();
    useOfflineStore.setState({ sessionMappings: {}, isConnected: true });
    tokenManager.saveSession({
      accessToken: 'valid-test-jwt-token',
      refreshToken: 'valid-refresh-token',
      user: mockUser as any,
    });
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      user: mockUser as any,
    });
  });

  afterEach(async () => {
    await useOfflineStore.getState().clearQueue();
  });

  test('1. Checkpoint complete mutation maps offline ID in URL to server CUID', async () => {
    const offlineSessionId = 'offline-session-1794026574949-735';
    const serverSessionId = 'cmw8psnua6a82hpxu8zid97p9';

    // Simulate already saved mapping from previous start
    await useOfflineStore.getState().setSessionMapping(offlineSessionId, serverSessionId);

    // Enqueue complete mutation with offline session ID in URL
    await useOfflineStore.getState().enqueue(
      `/patrol-sessions/${offlineSessionId}/complete`,
      'PATCH',
      { remarks: 'Completed Patrol Sweep.', offlineSessionId },
      offlineSessionId,
    );

    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { id: serverSessionId, status: 'COMPLETED' },
    });

    await offlineSyncEngine.sync();

    // Verify the URL was replaced with server session ID
    expect(apiClient.request).toHaveBeenCalledTimes(1);
    expect(apiClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/patrol-sessions/${serverSessionId}/complete`,
        method: 'PATCH',
      }),
    );

    // Verify queue was drained
    expect(useOfflineStore.getState().queue.length).toBe(0);
  });

  test('2. 409 Conflict with activePatrolSessionId recovers session mapping and dequeues duplicate START', async () => {
    const offlineSessionId = 'offline-session-start-duplicate';
    const serverSessionId = 'cmw8psnua6a82hpxu8zid97p9';

    await useOfflineStore.getState().enqueue(
      '/patrol-sessions/start',
      'POST',
      { assignmentId: 'assign-1', offlineSessionId },
      offlineSessionId,
    );

    // Mock 409 Conflict returning activePatrolSessionId
    const conflictError: any = new Error('You already have a patrol in progress.');
    conflictError.response = {
      status: 409,
      data: {
        error: {
          code: 'ACTIVE_PATROL_EXISTS',
          message: 'You already have a patrol in progress.',
          details: { activePatrolSessionId: serverSessionId },
        },
      },
    };

    (apiClient.request as jest.Mock).mockRejectedValueOnce(conflictError);

    await offlineSyncEngine.sync();

    // Duplicate START should be dequeued, NOT stuck in loop
    expect(useOfflineStore.getState().queue.length).toBe(0);
    // Session mapping should be persisted
    expect(useOfflineStore.getState().sessionMappings[offlineSessionId]).toBe(serverSessionId);
  });

  test('3. hasUnfinishedEarlierSession strictly checks earlier items and does not block when newer items exist', async () => {
    const session1Offline = 'offline-session-1';
    const session2Offline = 'offline-session-2';

    // Enqueue session 2 START
    await useOfflineStore.getState().enqueue(
      '/patrol-sessions/start',
      'POST',
      { assignmentId: 'assign-2', offlineSessionId: session2Offline },
      session2Offline,
    );

    // Enqueue a subsequent scan for session 2
    await useOfflineStore.getState().enqueue(
      '/patrol-checkpoints/scan',
      'POST',
      { gateId: 'gate-2', patrolSessionId: session2Offline, offlineSessionId: session2Offline },
      session2Offline,
    );

    // Both belong to session 2, but notice no earlier session 1 exists.
    // If start gets 409, it should recover and not falsely consider session 2 scans as "earlier unfinished sessions"
    const conflictError: any = new Error('Conflict');
    conflictError.response = {
      status: 409,
      data: {
        error: {
          code: 'ACTIVE_PATROL_EXISTS',
          details: { activePatrolSessionId: 'server-session-2' },
        },
      },
    };

    (apiClient.request as jest.Mock).mockRejectedValueOnce(conflictError);

    await offlineSyncEngine.sync();

    // START should be dequeued as duplicate, and mapping created
    expect(useOfflineStore.getState().sessionMappings[session2Offline]).toBe('server-session-2');
  });
});

