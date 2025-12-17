/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Base colors - easily customizable
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          hover: 'var(--color-bg-hover)',
          active: 'var(--color-bg-active)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          accent: 'var(--color-text-accent)',
        },
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
          success: 'var(--color-accent-success)',
          warning: 'var(--color-accent-warning)',
          error: 'var(--color-accent-error)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
      },
      spacing: {
        panel: 'var(--spacing-panel)',
        section: 'var(--spacing-section)',
      },
      borderRadius: {
        panel: 'var(--radius-panel)',
        button: 'var(--radius-button)',
        input: 'var(--radius-input)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
