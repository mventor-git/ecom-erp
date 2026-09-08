# Admin Panel Information Architecture — Ecom-ERP

Sidebar sections (collapsible, persisted):

- Sales: Orders, Customers, Issue Receipts, VIP Invitations
- Inventory: Products, Categories, Brands, Stock, Movements, Warehouses, Stock In, Stock Out, Opening Balance, Featured
- Purchasing: Suppliers, Purchase Orders
- Operations: Picking / Packing, Delivery
- Pricing: Retail Pricing, Price Lists, Pricing Insights
- Finance: Accounting (Dashboard Detail Revenue), Financial Insights (Reports), Periods
- Website: Site Config
- System: Users / Roles, Audit Log, Notifications, Integrations, Settings, Payments (Kashier)

Notes:
- Module grouping is logical (ERP-style).
- Some items link to same route (e.g., Issue Receipts and Issue Orders both point to /erp/issue-orders; Stock In / Stock Out may overlap).
- Pricing Engine is a flagship top-level entry.
- Dark mode theme toggle present (AdminThemeToggle).
- Sidebar rail mode supported (AdminLayout).

Observed state: functional navigation; modules present; some pages have tabs/forms/data tables. Broken/empty/placeholder status noted separately.
