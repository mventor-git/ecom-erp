# Pricing Reality — Comfort Sign (Audit Only)

PRICE STORAGE: products.price (retail, integer cents) + cost_price (wholesale current). price_lists (retail/wholesale/semi_wholesale/offer with discount_percent). product_prices (override per product per list).
PRICE LIST: default 'retail'; storefront uses setting 'storefront_price_list'. Pricing engine (admin) can derive retail from cost * (1 + default_markup_percent/100) where default_markup_percent=20 per settings.
MULTIPLE COSTS: NO. Only products.cost_price (current). Purchase orders have item-level unit_cost but no historical linkage to product cost; can't trace which purchase cost applies to sold stock.
VARIANT PRICE: not separate; same product price for all variants.
CUSTOMER-SPECIFIC PRICE: vip_customer_policies (discount_pct per customer) + price_lists + product_prices. No server-side enforcement verified in audit.
ORDER PRICE SNAPSHOT: orders.items JSON (includes price at sale?) + order_items (for manual/orders with price column). Need to verify if website checkout writes price into order_items.
NO PYTHON USED.
