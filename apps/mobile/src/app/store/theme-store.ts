import { create } from 'zustand';
import { storage } from '../utils/mmkv-storage';
import { STORAGE_KEYS } from '../constants';

interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
  const cached = storage.getString(STORAGE_KEYS.THEME);
  return cached === 'dark' ? 'dark' : 'light';
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    storage.set(STORAGE_KEYS.THEME, theme);
    set({ theme });
  },
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    storage.set(STORAGE_KEYS.THEME, nextTheme);
    return { theme: nextTheme };
  }),
}));
