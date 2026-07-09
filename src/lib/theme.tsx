import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSetting, saveSetting } from './db';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  primaryForeground: string;
}

export const PRESET_THEMES: Record<string, ThemeColors> = {
  default: {
    primary: '#6366f1',
    secondary: '#a78bfa',
    accent: '#818cf8',
    primaryForeground: '#ffffff',
  },
  ocean: {
    primary: '#0891b2',
    secondary: '#06b6d4',
    accent: '#22d3ee',
    primaryForeground: '#ffffff',
  },
  forest: {
    primary: '#059669',
    secondary: '#10b981',
    accent: '#34d399',
    primaryForeground: '#ffffff',
  },
  sunset: {
    primary: '#ea580c',
    secondary: '#f97316',
    accent: '#fb923c',
    primaryForeground: '#ffffff',
  },
  midnight: {
    primary: '#7c3aed',
    secondary: '#8b5cf6',
    accent: '#a78bfa',
    primaryForeground: '#ffffff',
  },
  rose: {
    primary: '#e11d48',
    secondary: '#f43f5e',
    accent: '#fb7185',
    primaryForeground: '#ffffff',
  },
};

interface ThemeContextType {
  theme: ThemeColors;
  setTheme: (theme: ThemeColors) => void;
  themeName: string;
  setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(colors: ThemeColors) {
  const root = document.documentElement;
  
  // Convert hex to HSL for shadcn compatibility
  const hexToHSL = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  root.style.setProperty('--primary', hexToHSL(colors.primary));
  root.style.setProperty('--secondary', hexToHSL(colors.secondary));
  root.style.setProperty('--accent', hexToHSL(colors.accent));
  root.style.setProperty('--primary-foreground', hexToHSL(colors.primaryForeground));
  
  // Also set raw hex values for gradient usage
  root.style.setProperty('--primary-hex', colors.primary);
  root.style.setProperty('--secondary-hex', colors.secondary);
  root.style.setProperty('--accent-hex', colors.accent);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColors>(PRESET_THEMES.default);
  const [themeName, setThemeNameState] = useState('default');

  useEffect(() => {
    // Load saved theme
    getSetting<{ name: string; colors: ThemeColors }>('theme', { name: 'default', colors: PRESET_THEMES.default })
      .then((saved) => {
        setThemeState(saved.colors);
        setThemeNameState(saved.name);
        applyTheme(saved.colors);
      });
  }, []);

  const setTheme = (colors: ThemeColors) => {
    setThemeState(colors);
    applyTheme(colors);
    saveSetting('theme', { name: themeName, colors });
  };

  const setThemeName = (name: string) => {
    setThemeNameState(name);
    if (PRESET_THEMES[name]) {
      setTheme(PRESET_THEMES[name]);
    }
    saveSetting('theme', { name, colors: PRESET_THEMES[name] || theme });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeName, setThemeName }}>
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
