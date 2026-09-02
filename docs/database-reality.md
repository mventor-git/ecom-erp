# Database Reality — Comfort Sign (Phase 2 Audit)

ENGINE: SQLite via sql.js (db.js); file = server/data/store.db
SCHEMA: server/schema.sql (263 lines) + db.js migrations (ALTER TABLE + new tables)
NO MIGRATIONS SYSTEM: migrations are inline try/catch ALTER in db.js init

CORE TABLES (from schema + db):
- categories, brands, products (with cost_price, barcode, sku, default_warehouse_id, min/max/reorder, deleted_at, restore_active, sale_price_list, offer fields, hero colors, bilingual _ar cols, is_packaging, has_variants)
- product_images (with variant_attributes), customers (with google_id, stripe_customer_id, phone, address, city, verified, password_hash), orders (items JSON, total, status, price_list_code, shipping fields, payment_status, proof fields, refund fields, temp_issue, admin_review_at, confirmed_at, delivered_at, subtotal/shipping, order_number), sessions, wishlist, reviews (rating REAL, unique per product/customer)
- warehouses, locations, inventory_movements (type: opening_balance/receipt/issue/adjustment/transfer/return/damage/reservation/release/correction/count; qty_before/qty_after; unit_cost; reference_type/reference_id; note; created_by), product_variants (sku/barcode/qr/serial/lot/batch/expiry; attributes JSON), inventory (snapshot: qty_on_hand/qty_reserved/min/max/reorder; unique on product+variant+warehouse+location)
- supply_orders / supply_order_items (multi-product, distinct from receipts); issue_orders / issue_order_items; purchase_orders / purchase_order_items (supplier + qty_ordered/qty_received + unit_cost)
- price_lists (retail/wholesale/semi_wholesale/offer with discount_percent, is_default) + product_prices (override per product per list)
- financial_periods (open/closed, opening_balance_set, start/end, months); document_sequences (PO/SO/GR/GI/TO/RT/CM/ADJ/ISS/SUP prefixes)
- vip_invites (code unique, invite_name, used_by/used_at, discount_pct, qr_code, signup_url) + vip_customer_policies (customer_id unique, discount_pct, is_active) + customer_invitation_links + vip_cart (customer+product+qty, unique, added_by)
- users + roles + permissions + role_permissions + user_roles (many-to-many) + two_factor_secret/enabled/backup_codes
- suppliers + product_suppliers (supplier_sku, unit_cost, is_preferred, lead_time)
- events (immutable audit: event_type/entity_type/entity_id/user_id/role/payload/metadata/created_at) + indexes
- notifications (notification_rules + notifications log + in_app_notifications) + notification_preferences
- settings (key/value/type/category/is_public/updated_by); announcements (text/icon/is_active/start/end/sort) + hero_slides + welcome_slides
- shipment_providers (employee/contractor/company) + shipments (tracking_number/status/estimated_delivery/shipped/delivered/notes)
- picking_tasks / packing_tasks (assignee/status/items/notes/picked_by/packed_by)
- mobile: cart_items, user_addresses, device_tokens, webhooks / webhook_deliveries, ai_config / ai_conversations
- payments: paymob_links + kashier_orders + kashier_webhook_events
- 2FA, customer_verifications (email/sms, code/status/attempts/expires/verified), document_numbers

DANGER OBSERVED (from code/DB):
- products.stock LEGACY kept for compat but inventory_movements is source of truth; migration creates opening_balance from products.stock
- No historical wholesale cost table per purchase; cost_price on products is current only — multiple purchase prices lost
- orders.items stored as JSON (not normalized); price at sale not snapshotted to separate table (snapshot exists in order_items but only for manual orders?)
- inventory is snapshot; movements are ledger — correct architecture, but need to verify all updates create movements
- No automatic FIFO/weighted-average cost tracking for sold stock in DB; accounting may use current cost_price
- Customer price from price_lists + product_prices; but frontend reads settings (storefront_price_list default 'retail') — server-side enforcement unclear from routes audit
- VIP discount exists (vip_customer_policies + vip_invites) but customer site may not enforce it server-side
- Refund_amount / refunded_at on orders exists but no separate refund ledger
- Receipt/issue receipt numbering via document_sequences; but PDF/QR generation code separate
