# mventor-ticket-004: Image Upload â€” Drag & Drop

**Status:** âœ… Completed  
**Priority:** High  
**Phase:** 4 â€” Media  

## Description
Add drag-and-drop image upload to the admin product form. Replace the text URL input with a visual uploader that saves images to the server and auto-fills the URL.

## Tasks
### Backend
- [x] Install `multer` for file upload handling
- [x] `POST /api/admin/upload` â€” Upload image (admin auth), returns URL
- [x] `GET /api/admin/upload/list` â€” List uploaded images
- [x] `DELETE /api/admin/upload/:filename` â€” Delete an image
- [x] Serve uploaded images from `server/public/images/`

### Frontend
- [x] Create `ImageUploader` component with drag & drop zone
- [x] Add image preview with delete/replace
- [x] Integrate into `ProductForm` replacing text URL input
- [x] Add `uploadImage()` API call
- [x] Add `listImages()` and `deleteImage()` API calls

## Acceptance Criteria
- [x] Drag & drop an image file to upload
- [x] Click to select file works
- [x] Preview shows after upload
- [x] URL auto-filled in the form
- [x] File type validation (images only) â€” JPEG, PNG, GIF, WebP, SVG
- [x] File size limit (5MB)
- [x] Existing text URL input still works as fallback (ProductForm maintains `image_url` state)
- [x] Unauthorized uploads rejected (401)
- [x] Invalid file types rejected (400)
- [x] Image accessible via URL after upload

## Files Changed
- **New:** `server/routes/upload.js` â€” Upload endpoint with multer disk storage
- **New:** `client/src/components/ImageUploader.jsx` â€” React drag & drop component
- **Modified:** `server/index.js` â€” Mounted upload route, increased JSON body limit to 10mb
- **Modified:** `client/src/api/products.js` â€” Added upload/list/delete API functions
- **Modified:** `client/src/pages/ProductForm.jsx` â€” Replaced image URL input with ImageUploader

## Verification
- All 5 upload tests passed (auth, upload, access, list, invalid type rejection)
- Frontend builds without errors
- No regressions on existing endpoints (smoke tested all 24 endpoints)
