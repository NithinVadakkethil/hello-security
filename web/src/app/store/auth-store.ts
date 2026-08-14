import { create } from 'zustand';
import { User } from '../types/api';
import { setStoredUser, removeStoredUser } from '../utils/token';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user) => {
    setStoredUser(user);
    set({ user, isAuthenticated: true, isLoading: false });
  },
  clearAuth: () => {
    removeStoredUser();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
