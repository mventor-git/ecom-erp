# Current Business Concepts — Ecom-ERP

| NAME | MEANING FROM CURRENT UI | WHERE IT APPEARS | RELATED CONCEPTS | OPEN QUESTIONS |
|---|---|---|---|---|
| Product / SKU | Catalog item with image, description, variant options (color/size) | Customer product list/detail; Admin products/categories/brands | Category, Brand, Warehouse, Stock | Variant image switching logic? |
| Variant (Color/Size) | Product attribute selection (swatches + size picker) | Product detail page | Product, SKU | Are variants child SKUs or product-level? |
| Category | Grouping of products (showcased on home) | Customer categories / Admin categories | Product, Featured | Admin category management full? |
| Brand | Brand label / filter | Admin brands; customer filter | Product | Customer-facing brand filter active? |
| Warehouse | Storage location | Admin warehouses; inventory | Stock, Movement | Multi-warehouse logic full? |
| Stock / Inventory | Quantity on hand | Admin stock / movement / warehouses | Product, Movement, Supply Orders | Real-time sync with customer? |
| Supplier | Vendor for purchasing | Admin suppliers / POs | Purchase Orders, Supply Orders | Full procurement flow? |
| Price List / Pricing | Retail pricing rules (+20% from wholesale per memory) | Admin pricing engine / price lists | Product, Retail/Wholesale | Pricing algorithm exact formula? |
| Order / Issue Orders | Customer purchase / receipt generation | Admin orders / issue orders | Customer, Receipt, VIP Invitations | Does issue-orders = print receipts? |
| Customer | End user / buyer | Admin customers; customer login/account | Order, VIP Invitations | Customer segmentation details? |
| VIP Invitation | Reward / loyalty invitation | Admin VIP Invitations; Sales section | Customer | Business rules for VIP? |
| Announcement | Promotional banner / rotator | Customer home; admin-configurable via settings? | Site Config | Persisted via settings? |
| Review | Customer feedback (rating + comment) | Product detail page | Product, Customer | Review moderation? |
| Receipt / Issue Receipts | Document / proof of purchase | Admin /erp/issue-orders; customer checkout | Order | Same as issue orders? |
| Driver / Delivery | Shipping / fulfillment | Admin /erp/shipping; delivery | Order, Operations | Actual delivery tracking? |
| Currency / Price List Code | Active currency / pricing tier (retail/wholesale) | Admin site settings; customer price display | Product, Order, Checkout | Multi-currency supported? |
