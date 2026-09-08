# VISION NEXT — Ecom-ERP: The Open General System

> **Project:** Ecom-ERP — first fully open-source ecom-erp (MIT)
> **Date:** 2026-09-06
> **Author:** MUSE (user-approved direction)
> **Version:** 3.0 — generalization: neutral core, setup wizard, accounting, community

---

## 0. Why This Document Exists

Prior vision proved the engine (movement ledger, immutable events, RBAC, modular ERP).
This chapter generalizes it for small business: any shop, any vertical, any country — one neutral core,
configured per deploy, operable by a non-technical owner, built in the open. Supersedes vertical-specific storefront ideas
in v2 (journeys, clubs, partner networks become optional vertical packs, not core).

> **Status key:** ✅ built · 🔜 v1-required · 💡 post-v1

---

## 1. CUSTOMER — Sell Anything, Anywhere

1. 🔜 **Setup wizard output** — store identity, currency, locale, payments, taxes; demo seed per vertical.
2. 🔜 **Express checkout** — saved methods, one-tap reorder, guest-first.
3. 💡 **Guided selling packs** — optional finders/wizards per vertical (size, fit, compatibility), never core.
4. 💡 **Loyalty core** — points, referrals, campaigns; verticals skin it.
5. 💡 **Customer PWA** — installable catalog, offline browse, push.

**Built ✅:** catalog, variants, cart (web + server mobile), COD + online checkout, orders, wishlist, push, Google OAuth, mail.

---

## 2. ADMIN — Command Center + Ledger

1. 🔜 **Accounting module** — small-business books: sales invoices, receivables/payables, honest cash-basis reports. No enterprise GL in v1. The v1 claim depends on this.
2. 🔜 **Operations cockpit** — live orders, stock heatmap, delivery dots, revenue pulse, anomaly pings from the event stream.
3. 💡 **AI Business Copilot** — natural-language reports, draft POs, dead-stock detection. Advisor only, never owns logic.
4. 💡 **Paperless warehouse** — scan-driven pick→pack→ship, offline-first queue, every scan a movement event.
5. 💡 **Supplier portal** — confirm POs, upload invoices; admin approves.
6. 💡 **Customer 360 + CRM** — timelines, segments, campaigns.

**Built ✅:** dashboard, inventory + movements + warehouses, suppliers, PO lifecycle, doc numbering, QR, notifications, settings, reports + CSV, events/audit, RBAC, integrations, webhooks.

---

## 3. MOBILE — Field Force Platform

1. 🔜 **Stable connectivity** — fixed tunnel + domain so apps stop breaking on restart.
2. 🔜 **Finish APKs** — EAS builds, Android OAuth, biometrics, geofencing, offline queues.
3. 💡 **Admin pocket approvals** — PO approvals, holds, deliveries from a phone (role-based).
4. 💡 **Offline stock counting** — dead-zone counting, sync-on-reconnect, discrepancy events.

**Built ✅:** customer app (browse, variants, cart, COD, history, wishlist, push); worker v1 (orders, status flow, photo proof, COD auto-pay).

---

## 4. OPEN SOURCE — Built in Public

1. 🔜 **MIT repo public** — README, contributor guide, code of conduct, issue templates.
2. 🔜 **Neutral seed + docs** — no brand, no vertical, no secrets, no machine paths anywhere.
3. 💡 **Provider/locale marketplace** — payments, shipping, tax packs as swappable modules.
4. 💡 **Vertical packs** — fashion, grocery, electronics, pharmacy templates over the neutral core.
5. 💡 **Multi-store + API-first** — public API, webhooks, headless storefronts.

---

## 5. SEQUENCE

> **Phase A (v1 core):** accounting module + setup wizard + neutral seed. An owner installs in the morning and sells by evening. Claim "fully" only after this.
> **Phase B (reach):** stable tunnel, APKs, PWA, supplier portal, cockpit.
> **Phase C (moat):** copilot, vertical packs, multi-store, marketplace.

---

## 6. Guardrails (inviolable)

- Movements-only inventory; no-delete documents; immutable events; services-only modules.
- Settings-driven everything; neutral core — no vertical/locale in core logic.
- Money in cents; RBAC backend-enforced; tests green per ticket.
- MIT stays; contributor docs stay current; demo data stays generic.
- Small-biz bar: every feature must be learnable in minutes by a non-technical owner — otherwise it ships as a pack, not core.

---

*Owned by MUSE. Execution via tickets by the execution agent.*
