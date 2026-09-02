# Feature Reality Matrix — Comfort Sign (Audit)
A=REAL/WORKING B=REAL/PARTIAL C=UI ONLY D=BACKEND ONLY E=MOCKED F=BROKEN G=DUPLICATED H=MISSING

| FEATURE | CUSTOMER | ADMIN | FRONTEND | BACKEND | DB | FUNCTIONAL | STATUS | NOTE |
|---|---|---|---|---|---|---|---|---|
| Product catalog | Y | Y | Y | Y | Y | B | Price lists + variants; JSON orders; cost only current |
| Inventory / stock | — | Y | Y | Y | Y | B | Source=movements; snapshot=inventory; legacy products.stock |
| Warehouse/locations | — | Y | Y | Y | Y | B | Full schema + seed; default WH-MAIN |
| Orders / checkout | Y | Y | Y | Y | Y | B | Kashier/Stripe; JSON items; no full webhook idempotency | |
| Pricing engine | — | Y | Y | Y | Y | B | Retail derived from cost+markup; price_lists exist |
| VIP / invitations | — | Y | — | Y | Y | C/B | UI exists; server-side enforcement unclear |
| Receipts / issue orders | — | Y | — | Y | Y | B | Document sequences + issue_order_items |
| Reports / accounting | — | Y | Y | Y | Y | B | Periods + schedules; COGS uses current cost |
| Notifications | — | Y | — | Y | Y | B | Rules + log + in-app; channels partial |
| QR / invitation codes | — | Y | — | Y | Y | B | vip_invites + product_variants.qr_code; receipt QR via routes |
| Picking / packing | — | Y | — | Y | Y | B | Tables + workflow service |
| Shipping / delivery | — | Y | — | Y | Y | B | Providers + shipments; tracking URLs |
| Users / RBAC | — | Y | — | Y | Y | B | Roles/perms/user_roles + 2FA + JWT + session |
| Mobile API v1 | — | — | — | Y | Y | B | Routes exist (auth/cart/orders/wishlist) |
| AI config / assistant | — | Y | — | Y | Y | B | ai_config + ai_conversations + adminAI route |

NO PYTHON. NODE ONLY.
