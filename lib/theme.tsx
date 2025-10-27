import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = '@imageloader:darkMode';

type AppTheme = {
  dark: boolean;
  bg: string;
  fg: string;
  setDark: (v: boolean) => void;
  toggle: () => void;
};

const defaultTheme: AppTheme = {
  dark: true,
  bg: '#149ddd',
  fg: '#ffffff',
  setDark: () => {},
  toggle: () => {},
};

const ThemeContext = createContext<AppTheme>(defaultTheme);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dark, setDarkState] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_KEY);
        if (raw !== null) setDarkState(raw === 'true');
      } catch (e) {}
    })();
  }, []);

  const setDark = async (v: boolean) => {
    setDarkState(v);
    try {
      await AsyncStorage.setItem(THEME_KEY, v ? 'true' : 'false');
    } catch (e) {}
  };

  const toggle = () => setDark(!dark);

  const value: AppTheme = {
    dark,
    bg: dark ? '#01334aff' : '#f6efd9ff',
    fg: dark ? '#ffffff' : '#000000',
    setDark,
    toggle,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
