# mventor-ticket-030: QR Code System

**Status:** Planned
**Priority:** Medium
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement a QR code system that identifies resources (products, variants, shipments, orders, locations). QR codes resolve to different information depending on user permissions.

---

## Current State

- No QR code system
- No barcode support
- No scanning capability

---

## Target State

### QR Code Philosophy

- QR Codes identify resources
- Never hardcode behavior
- Scanning a QR resolves the resource
- Same QR displays different info based on permissions

### QR Resolution

| QR Contains | Resolves To |
|-------------|-------------|
| `PROD-42` | Product detail |
| `VAR-42-1` | Product variant |
| `PO-2026-0001` | Purchase order |
| `SO-2026-0001` | Sales order |
| `WH-MAIN-A-03-12` | Warehouse location |
| `SN-ABC123` | Serial number |
| `SHP-2026-0001` | Shipment |

### QR Generation

```javascript
// server/services/qrService.js
const qrService = {
  generate(entityType, entityId) {
    // Generate QR code image (PNG/SVG)
    // Encode: entityType:entityId
  },
  
  resolve(qrData, userPermissions) {
    // Parse QR data
    // Fetch entity
    // Filter response based on permissions
    // Return appropriate view
  }
};
```

### Admin UI

- Generate QR for products
- Generate QR for locations
- Print QR labels
- Scan QR via webcam (quagga.js or html5-qrcode)

---

## Acceptance Criteria

- [ ] QR generation service implemented
- [ ] QR resolution service implemented
- [ ] API: `GET /api/qr/:entityType/:entityId` (generate QR)
- [ ] API: `POST /api/qr/resolve` (scan & resolve QR)
- [ ] QR codes generated for products
- [ ] QR codes generated for locations
- [ ] QR codes generated for documents (PO, SO)
- [ ] Permission-based resolution (customer vs warehouse vs admin)
- [ ] Admin UI: Generate QR button on product page
- [ ] Admin UI: Print QR labels
- [ ] Admin UI: Scan QR via webcam
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-023 (RBAC â€” for permission-based resolution)

---

## Notes

- QR Codes identify resources â€” never hardcode behavior
- The same QR may display different information depending on user permissions
- Customer sees customer data, warehouse sees warehouse data, admin sees everything
- Use `qrcode` npm package for generation
- Use `html5-qrcode` for webcam scanning
