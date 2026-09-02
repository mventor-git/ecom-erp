# mventor-ticket-047 — Sidebar Overhaul: Categorized Tree + Collapse + Dark Mode

## Status
Completed (2026-08-22)

## Goal
Modular, sectionized admin sidebar: pages grouped into labeled sections that expand/collapse like a tree; whole-sidebar rail mode; dark mode toggle; site-wide dark theme so no page stays "whitey" (fonts, surfaces, borders, icons/emojis stay legible).

## Changes
- `tailwind.config.js`: `darkMode: 'class'`.
- NEW `src/utils/theme.js`: persisted theme (localStorage `cs-admin-theme`), system-preference default, `initTheme()` pre-paint.
- `src/main.jsx`: init theme before first render (no light flash).
- `src/index.css`: global `.dark` overrides — surfaces, text grays, borders/dividers, hover states, primary tints, status/banner colors, form controls, cards, scrollbars. Emojis/icons unfiltered (natural colors on dark).
- `src/admin/components/Sidebar.jsx` rewritten: 6 sections (Catalog / Sales / Warehouse / Purchasing / Insights / System) as expandable tree with chevrons; open-state persisted (`cs-sidebar-open-sections`); active section auto-expands; rail mode (icons-only, tooltips) via « handle; dark/light toggle button at bottom.
- `src/admin/AdminLayout.jsx`: collapse choice persisted (`cs-sidebar-collapsed`), mobile drawer unchanged.

## Validation
- `npm run build` passes (pre-existing chunk-size warning only).
- Manual checklist for owner: toggle sections, reload (state kept), collapse to rail and back, switch dark/light and reload, verify Products/Orders/Reports pages readable in dark.
