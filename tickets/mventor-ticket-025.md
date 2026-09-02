# mventor-ticket-025: Warehouse & Location Management

**Status:** Planned
**Priority:** High
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement full warehouse and location management. Track WHERE stock lives â€” not just HOW MUCH exists.

---

## Current State

- No warehouse concept
- No location tracking
- Stock is a single number per product

---

## Target State

### Warehouse CRUD

- Create warehouse (name, code, address)
- Update warehouse
- Deactivate warehouse (soft delete)
- List warehouses with stock summary

### Location CRUD

- Create location within warehouse (name, barcode)
- Update location
- Deactivate location
- List locations within warehouse

### Admin UI

- Warehouse list page with stock totals
- Location list page per warehouse
- Transfer stock between warehouses/locations
- Set default warehouse per product

---

## Acceptance Criteria

- [ ] API: `GET /api/admin/warehouses` (list)
- [ ] API: `POST /api/admin/warehouses` (create)
- [ ] API: `PUT /api/admin/warehouses/:id` (update)
- [ ] API: `DELETE /api/admin/warehouses/:id` (deactivate)
- [ ] API: `GET /api/admin/warehouses/:id/locations` (list locations)
- [ ] API: `POST /api/admin/warehouses/:id/locations` (create location)
- [ ] API: `PUT /api/admin/locations/:id` (update location)
- [ ] API: `DELETE /api/admin/locations/:id` (deactivate location)
- [ ] API: `POST /api/admin/inventory/transfer` (move stock between locations)
- [ ] Admin UI: Warehouse list page
- [ ] Admin UI: Location list page per warehouse
- [ ] Admin UI: Transfer stock page
- [ ] Default warehouse seeded (WH-MAIN)
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-024 (Inventory Movement Engine)

---

## Notes

- Physical therapy equipment is bulky â€” knowing WHERE things are matters
- Transfer creates two movements: issue from source + receipt at destination
- Single atomic transaction (both succeed or both fail)
