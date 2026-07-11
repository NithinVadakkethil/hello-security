import { useThemeStore } from '../store/theme-store';
import { themeColors } from '../theme';

export const useTheme = () => {
  const theme = useThemeStore((state) => state.theme);
  const colors = themeColors[theme];
  const isDark = theme === 'dark';

  return {
    theme,
    colors,
    isDark,
    toggleTheme: useThemeStore((state) => state.toggleTheme),
    setTheme: useThemeStore((state) => state.setTheme),
  };
};
