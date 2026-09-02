# mventor-ticket-049 — RBAC Enforcement on ERP Routers

## Status
Completed (2026-08-22)

## Goal
Close the privilege gap: any staff role could previously perform warehouse/PO/settings actions because those routers only checked `adminAuth` (isAdmin), which is set for every active login.

## Changes
- `middleware/rbac.js`: env-bootstrap admin (ADMIN_USERNAME/PASSWORD session without a users row)
  bypasses permission checks as super admin — owner can never be locked out.
- Wired `requirePermission` into 9 routers (37 routes):
  - warehouses.js — read: warehouses.read · manage/delete: warehouses.manage · transfer: inventory.transfer
  - inventory.js — reads: inventory.read · movements POST: inventory.adjust
  - purchaseOrders.js — reads: purchase_orders.read · create/edit: purchase_orders.create · status/receive/cancel: purchase_orders.update
  - suppliers.js — suppliers.read / suppliers.manage
  - settings.js + documentNumbers.js + integrations.js — settings.read / settings.manage
  - invoices.js — reports.read (movement generation: inventory.adjust)
  - events.js — reports.read

## Validation
- Automated script applied 37/37 rules; node --check passes on all touched files.
- Full suite green (16 suites / 118 tests) including existing rbacMultiRole tests.
