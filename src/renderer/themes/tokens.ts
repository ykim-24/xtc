// Design tokens - easily customizable theme values
// These get converted to CSS custom properties

export interface ThemeTokens {
  name: string;
  colors: {
    bg: {
      primary: string;
      secondary: string;
      tertiary: string;
      hover: string;
      active: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
      accent: string;
    };
    border: {
      primary: string;
      secondary: string;
    };
    accent: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      error: string;
    };
  };
  fonts: {
    sans: string;
    mono: string;
  };
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
  };
  spacing: {
    panel: string;
    section: string;
  };
  radius: {
    panel: string;
    button: string;
    input: string;
  };
}

export const darkTheme: ThemeTokens = {
  name: 'dark',
  colors: {
    bg: {
      primary: '#0d1117',
      secondary: '#161b22',
      tertiary: '#21262d',
      hover: '#30363d',
      active: '#484f58',
    },
    text: {
      primary: '#e6edf3',
      secondary: '#8b949e',
      muted: '#6e7681',
      accent: '#58a6ff',
    },
    border: {
      primary: '#30363d',
      secondary: '#21262d',
    },
    accent: {
      primary: '#58a6ff',
      secondary: '#1f6feb',
      success: '#3fb950',
      warning: '#d29922',
      error: '#f85149',
    },
  },
  fonts: {
    sans: 'Inter, SF Pro, Helvetica Neue, sans-serif',
    mono: 'Monaco, Menlo, monospace',
  },
  fontSizes: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    lg: '14px',
    xl: '16px',
  },
  spacing: {
    panel: '12px',
    section: '8px',
  },
  radius: {
    panel: '8px',
    button: '6px',
    input: '4px',
  },
};

export const lightTheme: ThemeTokens = {
  name: 'light',
  colors: {
    bg: {
      primary: '#ffffff',
      secondary: '#f6f8fa',
      tertiary: '#eaeef2',
      hover: '#d8dee4',
      active: '#ced5dc',
    },
    text: {
      primary: '#1f2328',
      secondary: '#656d76',
      muted: '#8c959f',
      accent: '#0969da',
    },
    border: {
      primary: '#d0d7de',
      secondary: '#e6e8eb',
    },
    accent: {
      primary: '#0969da',
      secondary: '#0550ae',
      success: '#1a7f37',
      warning: '#9a6700',
      error: '#cf222e',
    },
  },
  fonts: {
    sans: 'Inter, SF Pro, Helvetica Neue, sans-serif',
    mono: 'Monaco, Menlo, monospace',
  },
  fontSizes: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    lg: '14px',
    xl: '16px',
  },
  spacing: {
    panel: '12px',
    section: '8px',
  },
  radius: {
    panel: '8px',
    button: '6px',
    input: '4px',
  },
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeName = keyof typeof themes;
