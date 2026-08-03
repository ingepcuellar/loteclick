/**
 * White-Label Theme Definitions
 * 
 * CSS variable overrides per brand.
 * The `predioclick` theme matches the current default CSS in index.css.
 * New themes only need to override the variables they want to change.
 * 
 * To add a new theme:
 * 1. Add a new entry with the same key as in brandConfig.js
 * 2. Override only the CSS variables you want to change
 */

const themes = {
  // Default theme — matches current index.css :root values
  predioclick: {
    // No overrides needed: index.css already has these as defaults
  },

  // ─── J.V.J. Constructores — Light Mode (Blanco, Negro, Naranja) ──
  jvj: {
    // Primary Colors — Orange (from logo)
    '--color-primary-50': '#fff7ed',
    '--color-primary-100': '#ffedd5',
    '--color-primary-200': '#fed7aa',
    '--color-primary-300': '#fdba74',
    '--color-primary-400': '#fb923c',
    '--color-primary-500': '#f97316',
    '--color-primary-600': '#ea580c',
    '--color-primary-700': '#c2410c',
    '--color-primary-800': '#9a3412',
    '--color-primary-900': '#7c2d12',

    // Accent Colors — Amber/Gold
    '--color-accent-400': '#fbbf24',
    '--color-accent-500': '#f59e0b',
    '--color-accent-600': '#d97706',

    // Background Colors — LIGHT MODE
    '--bg-primary': '#f8f9fa',
    '--bg-secondary': '#ffffff',
    '--bg-tertiary': '#f1f3f5',
    '--bg-card': 'rgba(255, 255, 255, 0.95)',
    '--bg-glass': 'rgba(0, 0, 0, 0.03)',

    // Text Colors — Dark on light
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#4a4a4a',
    '--text-muted': '#7a7a7a',
    '--text-inverse': '#ffffff',

    // Border Colors
    '--border-color': 'rgba(0, 0, 0, 0.1)',
    '--border-color-strong': 'rgba(0, 0, 0, 0.2)',

    // Shadows — lighter for light mode
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
    '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
    '--shadow-glow': '0 0 20px rgba(249, 115, 22, 0.3)',

    // Semantic
    '--color-success': '#22c55e',
    '--color-warning': '#f59e0b',
    '--color-error': '#ef4444',
    '--color-info': '#3b82f6',
  },

  // ─── El Diamante Campestre — Dark Mode (Silver/Black) ──
  diamante: {
    // Primary Colors — Silver / Neutral Grays
    '--color-primary-50': '#f8fafc',
    '--color-primary-100': '#f1f5f9',
    '--color-primary-200': '#e2e8f0',
    '--color-primary-300': '#cbd5e1',
    '--color-primary-400': '#94a3b8',
    '--color-primary-500': '#64748b', // Slate/Silver
    '--color-primary-600': '#475569',
    '--color-primary-700': '#334155',
    '--color-primary-800': '#1e293b',
    '--color-primary-900': '#0f172a',

    // Accent Colors — Silver / White
    '--color-accent-400': '#e2e8f0',
    '--color-accent-500': '#cbd5e1',
    '--color-accent-600': '#94a3b8',

    // Background Colors — Elegant Light Mode (Silver/White)
    '--bg-primary': '#f8fafc', // Slate 50
    '--bg-secondary': '#ffffff', // White
    '--bg-tertiary': '#f1f5f9', // Slate 100
    '--bg-card': 'rgba(255, 255, 255, 0.95)',
    '--bg-glass': 'rgba(0, 0, 0, 0.03)',

    // Text Colors — Dark on light
    '--text-primary': '#0f172a', // Slate 900
    '--text-secondary': '#334155', // Slate 700
    '--text-muted': '#64748b', // Slate 500
    '--text-inverse': '#ffffff',

    // Border Colors
    '--border-color': 'rgba(15, 23, 42, 0.1)',
    '--border-color-strong': 'rgba(15, 23, 42, 0.2)',

    // Shadows
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
    '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
    '--shadow-glow': '0 0 20px rgba(100, 116, 139, 0.2)',
  },
};

/**
 * Apply a theme by injecting CSS custom properties into :root.
 * Call this once at app startup from main.jsx.
 * 
 * @param {string} brandKey - The brand key matching themes and brandConfig
 */
export function applyTheme(brandKey) {
  const theme = themes[brandKey];
  if (!theme || Object.keys(theme).length === 0) {
    // No overrides needed (default theme from CSS)
    return;
  }

  const root = document.documentElement;
  Object.entries(theme).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

/**
 * Get the body background gradient colors for a brand.
 * Used to update the body::before pseudo-element gradient.
 * Returns null if using default theme.
 */
export function getGradientColors(brandKey) {
  const theme = themes[brandKey];
  if (!theme || !theme['--color-primary-500']) return null;

  // Extract the RGB values from the primary color for gradients
  return {
    primary: theme['--color-primary-500'],
    accent: theme['--color-accent-500'] || theme['--color-primary-400'],
  };
}

export default themes;
