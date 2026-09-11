import { useAuthStore } from '../../../app/store/auth-store';
import { tokenManager } from '../../../app/utils/token-manager';
import { AuthData } from '../../../app/types/api';
import { authApi } from '../api/auth.api';
import { offlineSyncEngine } from '../../../app/services/offline-sync-engine';
import { useOfflineStore } from '../../../app/store/offline-store';

export const authService = {
  handleLoginSuccess: async (authData: AuthData) => {
    tokenManager.setAccessToken(authData.accessToken);
    tokenManager.setRefreshToken(authData.refreshToken);
    useAuthStore.getState().setAuth(authData.user);
    await useOfflineStore.getState().loadQueue();
    offlineSyncEngine.sync();
  },

  handleLogout: async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.log('[authService] Logout API failed, performing local logout:', e);
    }
    tokenManager.clearTokens();
    useAuthStore.getState().clearAuth();
    useOfflineStore.setState({ queue: [] });
  },
};
