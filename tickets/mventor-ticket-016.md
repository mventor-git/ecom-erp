# mventor-ticket-016: Variant Indicator UI + Admin Featured Products

**Status:** ðŸš§ In Progress
**Priority:** High
**Phase:** 3 â€” Variant System + Featured Products
**Started:** July 24, 2026

## Description
Add size+color variant indicator system to the customer product detail page and admin product editor. Also add admin "Featured" page to select products for the homepage and PhotoStack. Sizes and colors serve as visual indicators â€” no images required. Admin can assign featured status to products.

## Tasks

### 1. Database: Add columns
- [ ] `sizes TEXT DEFAULT '[]'` â€” JSON array of `{name}` objects
- [ ] `featured INTEGER DEFAULT 0` â€” boolean flag for featured products
- [ ] `featured_order INTEGER DEFAULT 0` â€” sort order for featured products

### 2. Customer: SizeSelector component
- [ ] New file: `client/src/components/SizeSelector.jsx`
- [ ] Shows size buttons with selected state
- [ ] Calls `onSizeChange` with selected size object
- [ ] No images â€” just text labels
- [ ] Responsive: wraps on small screens

### 3. Customer: Update ProductDetailPage
- [ ] Import and render SizeSelector above ColorSwatches
- [ ] Size state management (selectedSize + selectedColor)
- [ ] Image logic: gallery > color-specific > main > placeholder
- [ ] Cart integration: pass size+color to addToCart

### 4. Admin: SizePicker component
- [ ] New file: `client-admin/src/admin/components/SizePicker.jsx`
- [ ] Add/remove/reorder sizes (just names for now)
- [ ] Toggle enable/disable sizes on product

### 5. Admin: Update ProductEdit
- [ ] Add SizePicker section (mirrors ColorPicker section)
- [ ] Toggle switch: enable sizes
- [ ] Include `sizes` in product create/update payload

### 6. Admin: Featured Products page
- [ ] New file: `client-admin/src/admin/pages/FeaturedList.jsx`
- [ ] Grid of products with toggle to feature/unfeature
- [ ] Drag-to-reorder or arrow buttons for featured order
- [ ] Shows currently featured products in order

### 7. Server: Update routes
- [ ] `GET /api/products/featured` â€” return featured products ordered by `featured_order`
- [ ] `GET /api/products/:id` â€” include `sizes` and `featured` fields
- [ ] `POST /api/admin/products` â€” accept `sizes` JSON
- [ ] `PUT /api/admin/products/:id` â€” accept `sizes`, `featured`, `featured_order`
- [ ] `PUT /api/admin/products/:id/feature` â€” toggle featured status
- [ ] `GET /api/admin/products` â€” include `sizes` and `featured` fields

### 8. HomePage: Use featured products
- [ ] Replace `.slice(0,8)` with `getFeatured()` API call
- [ ] Pass featured products to PhotoStack instead of topSelling

### 9. Sidebar: Add Featured nav item
- [ ] Add "Featured" with â­ icon to admin sidebar

### 10. Admin API client
- [ ] Add `featuredProducts` and `toggleFeature` methods

### 11. Testing & Documentation
- [ ] Run full test suite
- [ ] Verify both frontends build
- [ ] Update PROJECT_STATE.md, BACKLOG.md, HANDOVER.md, CHANGELOG.md
- [ ] Update REVIEW_REPORT.md

## Acceptance Criteria
- [ ] Product detail page shows size selector when product has sizes
- [ ] Product detail page shows color swatches when product has colors
- [ ] Both selectors work independently and together without images
- [ ] Admin can add/remove/reorder sizes on product edit
- [ ] Admin can toggle sizes on/off per product
- [ ] Admin can feature/unfeature products from dedicated page
- [ ] Featured products show on homepage and PhotoStack
- [ ] Server API returns `sizes` and `featured` fields on product endpoints
- [ ] All tests pass
- [ ] Frontends build without errors
