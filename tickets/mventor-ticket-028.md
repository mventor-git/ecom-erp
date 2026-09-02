# mventor-ticket-028: Document Numbering System

**Status:** Planned
**Priority:** High
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement a configurable document numbering system that generates unique, sequential numbers for all document types (PO, SO, GR, GI, TO, etc.).

---

## Current State

- No document numbering system
- Orders use auto-increment IDs
- No human-readable document numbers

---

## Target State

### Document Numbering Table

```sql
CREATE TABLE document_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_type TEXT NOT NULL UNIQUE, -- PO, SO, GR, GI, TO, RT, CM, ADJ
  prefix TEXT NOT NULL, -- e.g., "PO"
  separator TEXT DEFAULT '-',
  year_format TEXT DEFAULT 'YYYY', -- YYYY or YY
  current_number INTEGER DEFAULT 0,
  padding INTEGER DEFAULT 4, -- e.g., 4 â†’ 0001
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Document Types

| Code | Document | Example |
|------|----------|---------|
| PO | Purchase Order | PO-2026-0001 |
| SO | Sales Order | SO-2026-0001 |
| GR | Goods Receipt | GR-2026-0001 |
| GI | Goods Issue | GI-2026-0001 |
| TO | Transfer Order | TO-2026-0001 |
| RT | Return | RT-2026-0001 |
| CM | Complaint | CM-2026-0001 |
| ADJ | Adjustment | ADJ-2026-0001 |

### Number Generation

```javascript
// server/services/documentNumberService.js
const documentNumberService = {
  generate(docType) {
    // 1. Get sequence for doc_type
    // 2. Increment current_number
    // 3. Format: PREFIX-YYYY-NNNN
    // 4. Save sequence
    // 5. Return formatted number
  }
};
```

---

## Acceptance Criteria

- [ ] Document sequences table created
- [ ] Default sequences seeded for all document types
- [ ] Number generation service implemented
- [ ] Thread-safe (no duplicate numbers under concurrent access)
- [ ] API: `GET /api/admin/settings/document-numbering` (view sequences)
- [ ] API: `PUT /api/admin/settings/document-numbering/:docType` (configure)
- [ ] Configurable: prefix, separator, year format, padding
- [ ] Integrated with Purchase Orders (mventor-ticket-027)
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)

---

## Notes

- Every configurable value belongs in Settings
- Document numbering is configurable (prefix, format, padding)
- Thread-safe number generation is critical
- Used by all document types in the ERP
