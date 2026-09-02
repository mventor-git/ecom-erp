# mventor-ticket-015: Seed Comfort-Sign Database from Excel Data

**Status:** âœ… Completed  
**Priority:** High  
**Phase:** 2 â€” Data Migration  
**Started:** July 24, 2026  

## Description
Populate the Comfort-Sign database with real products from the Excel seed data file. The fork from website-for-selling (mventor-ticket-014) was completed but the project still has the original general-store seed data (electronics, clothing, etc.) and branding ("My Store"). This ticket replaces all placeholder content with the actual Comfort-Sign product data from `D:\Comfort-Sign-Seed-Data\Work Sheet-1.xlsx`.

## Tasks

### 1. Database Schema Changes
- [x] Design variant strategy: flatten size+color combos into separate products with size in name
- [x] Create medical equipment categories (Exercise & Fitness, Orthopedic Support, Insoles & Foot Care, Massage & Therapy, Baby & Child, Mobility Aids, Health Accessories)

### 2. Seed Script (`server/seed-comfort-sign.js`)
- [ ] Read Excel file with `xlsx` module
- [ ] Group rows by product name (handling Size + Color variants)
- [ ] For color-only variants: use existing `colors` JSON array
- [ ] For size variants: create separate product entries with size in name
- [ ] For both size + color: create per-size products with colors array
- [ ] Map image folders to products
- [ ] Generate placeholder images for products without image folders
- [ ] Map 32 image folders â†’ product IDs

### 3. Image Migration
- [ ] Copy all product images from `D:\Comfort-Sign-Seed-Data\Products Images\` to `server/public/images/comfort-sign/`
- [ ] Organize by product name subfolders

### 4. Rebranding
- [ ] Update HomePage hero text from "My Store" â†’ "Comfort-Sign"
- [ ] Update .env `STORE_NAME` to "Comfort-Sign"
- [ ] Update email templates to say "Comfort-Sign"
- [ ] Update all customer-facing page titles/metadata

### 5. Testing
- [x] Run `npm run test:all` â€” all 49 tests pass (28 unit + 21 integration)
- [x] Verify seed works: `cd server && node seed-comfort-sign.js`
- [x] Verify frontend builds (both customer + admin)
- [x] Verify images copied correctly (34/51 products)

## Acceptance Criteria
- [x] Database no longer has old general-store products
- [x] 51 Comfort-Sign products in database with real EGP prices
- [x] Products have correct categories, colors, sizes
- [x] Product images display on the storefront (34/51 products)
- [x] All 49 tests pass
- [x] Storefront shows "Comfort-Sign" branding everywhere

## Product Structure
See `D:\Comfort-Sign-Seed-Data\Work Sheet-1.xlsx` for full data. Key groups:
- **GymBall**: 14 rows (sizes 85/75/65/55 Ã— colors Pink/Silver/Blue/Red/Purple)
- **Yoga Mat**: 5 rows (10mm Ã— 5 colors)
- **Silicone Insoles**: Multiple variants (3/4 size, Ø¹Ø§Ø¯ÙŠ regular, ÙÙ„Ø§Øª ÙÙˆØª flat foot)
- **Memory Gel Foam Pillow**: 2 sizes (Large/Medium)
- **Ø±Ù‚Ø¨Ø© Ø¹Ø§Ø¯ÙŠØ© / Ø±Ù‚Ø¨Ø© ÙƒØ¨Ø³ÙˆÙ„Ø©**: Multiple color variants
- **Single-row products**: Mini Bike, Stepper, Bosu Ball, etc.
