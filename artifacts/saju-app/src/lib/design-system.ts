/**
 * Design system — spacing uses Tailwind’s 4px base (1 = 4px).
 * Prefer: gap-2 (8px), p-4 (16px), gap-3 (12px), gap-4 (16px), gap-6 (24px), p-8 (32px).
 *
 * Surfaces: `.ds-card`, `.ds-badge`, `.ds-segment-*`, typography `.ds-title` / `.ds-body` in `src/index.css`.
 *
 * Theme tokens: CSS variables in `:root` / `.dark` in `src/index.css` (incl. `--compat-grade-*`).
 */

export const DS_TYPOGRAPHY = {
  title: "ds-title",
  titleLg: "ds-title-lg",
  subtitle: "ds-subtitle",
  body: "ds-body",
  caption: "ds-caption",
} as const;

export const DS_LAYOUT = {
  appShell: "ds-app-shell",
  pagePad: "ds-page-pad",
  sectionGap: "ds-section-gap",
  card: "ds-card",
  cardPad: "ds-card-pad",
  badge: "ds-badge",
  badgeActive: "ds-badge-active",
} as const;
