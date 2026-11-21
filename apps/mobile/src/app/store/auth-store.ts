import { create } from 'zustand';
import { User } from '../types/api';
import { tokenManager } from '../utils/token-manager';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  hydrateFromStorage: () => boolean;
}

// Check synchronously if a valid offline-eligible session is already persisted
const getInitialState = () => {
  const cachedUser = tokenManager.getUserSession();
  const isEligible = tokenManager.isOfflineSessionEligible();
  if (cachedUser && isEligible) {
    return {
      user: cachedUser,
      isAuthenticated: true,
      isLoading: true, // Still allow AuthProvider to verify or finish startup
    };
  }
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  setAuth: (user) => {
    tokenManager.setUserSession(user);
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    tokenManager.clearSession();
    set({ user: null, isAuthenticated: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  hydrateFromStorage: () => {
    const cachedUser = tokenManager.getUserSession();
    const isEligible = tokenManager.isOfflineSessionEligible();
    if (cachedUser && isEligible) {
      set({ user: cachedUser, isAuthenticated: true });
      return true;
    }
    return false;
  },
}));
