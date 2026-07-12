import { useAuthStore } from '../../../app/store/auth-store';
import { tokenManager } from '../../../app/utils/token-manager';
import { AuthData } from '../../../app/types/api';

export const authService = {
  handleLoginSuccess: (authData: AuthData) => {
    tokenManager.setAccessToken(authData.accessToken);
    tokenManager.setRefreshToken(authData.refreshToken);
    useAuthStore.getState().setAuth(authData.user);
  },

  handleLogout: () => {
    tokenManager.clearTokens();
    useAuthStore.getState().clearAuth();
  },
};
