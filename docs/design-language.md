# Design Language — Existing Comfort Sign

## Customer (5173)
- Theme: Warm prestige / comfort — cream (#f6f2e8 body), gold accent (#a8811f / #e9d9a8 selection), near-black text (#26231d)
- Dark mode: deep navy (#101c2c) with warm cream text (#fdf3d0); selection gold (#8a6a18)
- Typography: clean sans-serif via Tailwind; headings use large bold; Arabic/English bilingual (RTL aware via i18n)
- Cards: cream/white (#fffdf7) with subtle borders (#efe9da / #e7e0cf); no pure white in light mode
- Buttons: gold/amber fills with white text; rounded; hover scale on slider thumb
- Forms: glass/cream inputs; consistent spacing
- Icons: custom stroke icons (AdminIcon / Icon component), no emoji
- Layout: responsive; hero slider; product grid; drawer navigation (cart); glass navbar (#f6f2e8 at 88% opacity)

## Admin (5174)
- Sidebar: modular sections, collapsible, rail mode, custom stroke icons, dark mode toggle, sound mute
- Tables: DataTable component with sorting/filters/status badges
- Cards: StatCard, RevenueTrendCard, StatusDonutCard
- Theme: shares customer dark mode; uses cream/gold palette; professional ERP aesthetic
- No pure redesign — documentation only.

## Consistency
Both use Tailwind + React; bilingual structure present; dark mode switch present; icons consistent (no emoji); brand gold/cream consistent.
