# mventor-ticket-032: Reporting Engine Foundation

**Status:** Planned
**Priority:** Medium
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement the reporting engine foundation â€” a framework for generating reports without embedding business logic. Reports read data; business rules belong elsewhere.

---

## Current State

- Basic order stats endpoint (`/api/admin/orders/stats`)
- No structured reporting system
- No charts or visualizations
- No export capability

---

## Target State

### Report Types

| Report | Description |
|--------|-------------|
| **Inventory Value** | qty_on_hand Ã— cost_price per product/category |
| **Stock Aging** | How long items have been sitting |
| **Dead Stock** | Products with zero sales in 90 days |
| **Low Stock** | Products below reorder point |
| **Out of Stock** | Products with zero availability |
| **ABC Analysis** | 80/20: which products drive revenue |
| **Turnover Rate** | COGS / avg_inventory |
| **Stockout Frequency** | How often products hit zero |
| **Sales Report** | Revenue by product/category/time |
| **Purchase Report** | Spending by supplier/time |
| **Supplier Performance** | On-time delivery %, lead time |

### Report Service

```javascript
// server/services/reportService.js
const reportService = {
  async generate(reportType, filters = {}) {
    // 1. Validate report type
    // 2. Apply filters (date range, category, warehouse)
    // 3. Execute report query
    // 4. Format results
    // 5. Return structured data
  },
  
  async export(reportType, format = 'csv', filters = {}) {
    // Generate CSV/Excel export
  }
};
```

### Admin UI

- Reports dashboard with report cards
- Each report has filters (date range, category, warehouse)
- Charts: line, bar, pie (using Recharts or Chart.js)
- Export to CSV/Excel

---

## Acceptance Criteria

- [ ] Report service implemented
- [ ] Inventory value report
- [ ] Stock aging report
- [ ] Dead stock report
- [ ] Low stock report
- [ ] Out of stock report
- [ ] ABC analysis report
- [ ] Sales report
- [ ] API: `GET /api/admin/reports/:reportType` (generate)
- [ ] API: `GET /api/admin/reports/:reportType/export` (CSV/Excel)
- [ ] Admin UI: Reports dashboard
- [ ] Admin UI: Individual report pages with charts
- [ ] Admin UI: Export buttons
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-024 (Inventory Movement Engine)
- mventor-ticket-025 (Warehouse Management)

---

## Notes

- Reports never contain business logic
- Reports read data â€” business rules belong elsewhere
- Charts: use Recharts (React) or Chart.js
- Export: CSV first, Excel later
- Foundation for future AI-powered insights
