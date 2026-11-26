import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('drive_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('drive_theme', theme);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
