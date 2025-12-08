import { createContext, useContext, useEffect, ReactNode } from 'react';
import { themes, ThemeName, ThemeTokens } from './tokens';
import { useSettingsStore } from '@/stores/settingsStore';

interface ThemeContextValue {
  theme: ThemeName;
  tokens: ThemeTokens;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeTokens(tokens: ThemeTokens) {
  const root = document.documentElement;

  // Colors
  root.style.setProperty('--color-bg-primary', tokens.colors.bg.primary);
  root.style.setProperty('--color-bg-secondary', tokens.colors.bg.secondary);
  root.style.setProperty('--color-bg-tertiary', tokens.colors.bg.tertiary);
  root.style.setProperty('--color-bg-hover', tokens.colors.bg.hover);
  root.style.setProperty('--color-bg-active', tokens.colors.bg.active);

  root.style.setProperty('--color-text-primary', tokens.colors.text.primary);
  root.style.setProperty('--color-text-secondary', tokens.colors.text.secondary);
  root.style.setProperty('--color-text-muted', tokens.colors.text.muted);
  root.style.setProperty('--color-text-accent', tokens.colors.text.accent);

  root.style.setProperty('--color-border-primary', tokens.colors.border.primary);
  root.style.setProperty('--color-border-secondary', tokens.colors.border.secondary);

  root.style.setProperty('--color-accent-primary', tokens.colors.accent.primary);
  root.style.setProperty('--color-accent-secondary', tokens.colors.accent.secondary);
  root.style.setProperty('--color-accent-success', tokens.colors.accent.success);
  root.style.setProperty('--color-accent-warning', tokens.colors.accent.warning);
  root.style.setProperty('--color-accent-error', tokens.colors.accent.error);

  // Fonts
  root.style.setProperty('--font-sans', tokens.fonts.sans);
  root.style.setProperty('--font-mono', tokens.fonts.mono);

  // Font sizes
  root.style.setProperty('--font-size-xs', tokens.fontSizes.xs);
  root.style.setProperty('--font-size-sm', tokens.fontSizes.sm);
  root.style.setProperty('--font-size-base', tokens.fontSizes.base);
  root.style.setProperty('--font-size-lg', tokens.fontSizes.lg);
  root.style.setProperty('--font-size-xl', tokens.fontSizes.xl);

  // Spacing
  root.style.setProperty('--spacing-panel', tokens.spacing.panel);
  root.style.setProperty('--spacing-section', tokens.spacing.section);

  // Radius
  root.style.setProperty('--radius-panel', tokens.radius.panel);
  root.style.setProperty('--radius-button', tokens.radius.button);
  root.style.setProperty('--radius-input', tokens.radius.input);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, setTheme } = useSettingsStore();
  const tokens = themes[theme];

  useEffect(() => {
    applyThemeTokens(tokens);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, tokens]);

  return (
    <ThemeContext.Provider value={{ theme, tokens, setTheme }}>
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
