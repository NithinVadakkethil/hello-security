'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { STORAGE_KEYS, THEMES, Theme } from '../constants';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check cookie first (for SSR consistency)
    const savedTheme = Cookies.get(STORAGE_KEYS.THEME) as Theme | undefined;
    if (savedTheme === THEMES.LIGHT || savedTheme === THEMES.DARK) {
      return savedTheme;
    }
    return THEMES.DARK; // default theme
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
      Cookies.set(STORAGE_KEYS.THEME, next, { expires: 365, path: '/' });
      return next;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === THEMES.DARK) {
      root.classList.add(THEMES.DARK);
      root.classList.remove(THEMES.LIGHT);
    } else {
      root.classList.add(THEMES.LIGHT);
      root.classList.remove(THEMES.DARK);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
