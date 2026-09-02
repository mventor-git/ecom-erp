# mventor-ticket-052 — Dashboard Redesign: Formal UI System + Charts

## Status
Completed (2026-08-23)

## Goal
Rebuild /dashboard with a formal, professional design system (shadcn/ui-style), a custom brand
palette (Clinical Teal + warm stone neutrals replacing Tailwind defaults), animated charts with
in-card controls, click-through to a full revenue detail page, and guaranteed text visibility.
Mobile responsiveness intentionally on hold (owner decision).

## Changes
- **Palette:** tailwind.config.js — custom `primary` Clinical Teal ramp; `gray` overridden with
  warm stone ramp (re-skins every existing page globally). Dark theme retuned to warm stone.
- **UI kit:** NEW src/components/ui/ — card.jsx, badge.jsx (status→variant map), select.jsx,
  skeleton.jsx, utils.js (cn).
- **Icons:** lucide-react replaces emojis across the dashboard surface.
- **Charts:** recharts added. NEW backend endpoint GET /api/admin/reports/sales-daily?days=N
  (zero-filled daily series, cancelled excluded). Animated AreaChart (900ms ease-out draw-in)
  + animated status Donut with center total and readable legend.
- **Dashboard (Overview.jsx):** page header w/ actions; 6 KPI StatCards; RevenueTrendCard
  controlled by metric+range selects IN the card header; StatusDonutCard; Recent Orders card;
  Quick Actions grid. Skeleton loading states throughout.
- **Drill-down:** clicking the trend card opens NEW RevenueDetail page (/dashboard-detail/revenue):
  same animated chart (larger) + same controls + summary KPIs + full daily breakdown table.
- **StatCard.jsx** restyled to the formal system (used by detail pages too).
- **Bug fix:** reports.js used permission 'reports.view' (not seeded) → locked for staff roles;
  corrected to 'reports.read' on all 4 routes.

## Validation
- npm run build passes. Server syntax checked. Text contrast: secondary text ≥ gray-500,
  values gray-900, chart ticks #78716c at 11px — readable in light and dark themes.
