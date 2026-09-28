/**
 * KJIHC brand constants — navy/gold club identity shared across staff screens.
 * The club logo is the flaming-puck "K" mark (same asset as the web app header).
 */

export const NAVY = '#001f3d';
export const NAVY_LIGHT = '#003060';
export const GOLD = '#f6a800';
export const ICE = '#7eb4d8';

export const CLUB_LOGO = require('@/assets/images/club-logo.png');

/** Original logo aspect ratio is 3000x1432 (~2.09:1) */
export const LOGO_RATIO = 3000 / 1432;

/** Accent colour per age group — used for card stripes, chips, avatars */
export const AGE_GROUP_COLORS: Record<string, string> = {
  LTP: '#7eb4d8',       // ice blue
  u10: '#22c55e',       // green
  u12: '#f6a800',       // gold
  u14: '#f97316',       // orange
  u16: '#a855f7',       // purple
  u19: '#ef4444',       // red
  lightning: '#06b6d4', // cyan
};

export function ageGroupColor(group?: string | null): string {
  return AGE_GROUP_COLORS[group ?? ''] ?? '#7eb4d8';
}
