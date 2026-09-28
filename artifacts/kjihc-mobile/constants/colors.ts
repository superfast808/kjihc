/**
 * KJIHC color palette — derived from the sibling web artifact (artifacts/kjihc/src/index.css).
 * Navy primary, ice-blue secondary, coral accent.
 * Conversion: HSL values from web CSS → hex.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#001f3d',
    tint: '#001f3d',

    // Surfaces
    background: '#f7f9fb',  // HSL 210 17% 98%
    foreground: '#001f3d',  // HSL 210 100% 12%

    // Cards
    card: '#ffffff',
    cardForeground: '#001f3d',

    // Primary — deep navy
    primary: '#001f3d',
    primaryForeground: '#ffffff',

    // Secondary — ice blue
    secondary: '#7eb4d8',  // HSL 204 53% 67%
    secondaryForeground: '#001f3d',

    // Muted
    muted: '#eaeff1',     // HSL 210 16% 93%
    mutedForeground: '#697589',  // HSL 215 16% 47%

    // Accent — coral/orange
    accent: '#f53416',   // HSL 3 100% 61%
    accentForeground: '#ffffff',

    // Destructive
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders & inputs
    border: '#e1e7ef',   // HSL 214 32% 91%
    input: '#e1e7ef',
  },

  dark: {
    text: '#e8edf2',
    tint: '#7eb4d8',

    background: '#00132a',  // HSL 210 100% 8%
    foreground: '#e8edf2',

    card: '#001a38',
    cardForeground: '#e8edf2',

    // In dark mode the coral becomes the primary CTA
    primary: '#f53416',
    primaryForeground: '#ffffff',

    secondary: '#7eb4d8',
    secondaryForeground: '#001f3d',

    muted: '#002447',
    mutedForeground: '#8faabb',

    accent: '#f53416',
    accentForeground: '#ffffff',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#0a3055',
    input: '#0a3055',
  },

  // Matches the web app's --radius: 0.5rem = 8px
  radius: 8,
};

export default colors;
