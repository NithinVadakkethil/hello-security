import { useAuthStore } from '../../../app/store/auth-store';
import { tokenManager } from '../../../app/utils/token-manager';
import { AuthData } from '../../../app/types/api';
import { authApi } from '../api/auth.api';
import { offlineSyncEngine } from '../../../app/services/offline-sync-engine';
import { useOfflineStore } from '../../../app/store/offline-store';
import { assignmentApi } from '../../assignment/api/assignment.api';
import { performLogout } from '../../../app/utils/logout';

export const authService = {
  handleLoginSuccess: async (authData: AuthData) => {
    // 1. Securely persist tokens, user profile metadata, and offline session authorization
    tokenManager.saveSession(authData);

    // 2. Hydrate global authentication store
    useAuthStore.getState().setAuth(authData.user);

    // 3. Load user-scoped offline queue & sync pending items
    await useOfflineStore.getState().loadQueue();
    offlineSyncEngine.sync();

    // 4. Pre-cache active assignments, routes, and checkpoints for offline resilience
    try {
      await assignmentApi.getActiveAssignments();
    } catch (e) {
      console.warn('[authService] Pre-caching assignments failed on login:', e);
    }
  },

  handleLogout: async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.log('[authService] Logout API failed, performing local logout:', e);
    }
    // Unified enterprise logout: clear tokens, session, SQLite cache, and memory state
    await performLogout();
  },
};
