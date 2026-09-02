# Admin Rate Limiting Fix

## Problem
The admin website was frequently hitting "Too many requests" errors because admin routes were using the same rate limiter as public API routes (200 requests per 15 minutes).

Admin operations require many more API calls:
- Loading products list
- Loading categories
- Loading brands
- Loading product images
- Loading product variants
- Saving changes
- Uploading images
- Reordering items
- etc.

## Solution
Created a separate, more permissive rate limiter specifically for admin routes.

### Changes Made

**File: `D:\Projects\comfort-sign\server\index.js`**

Added new `adminLimiter`:
```javascript
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // 1000 requests per 15 minutes (5x higher)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests, please try again later.' },
});
```

Applied to admin routes:
```javascript
app.use('/api/admin', adminLimiter); // Apply higher limit for admin routes
```

### Rate Limit Comparison

| Route Type | Limit | Window | Use Case |
|------------|-------|--------|----------|
| Public API | 200 requests | 15 minutes | Customer browsing |
| Admin API | 1000 requests | 15 minutes | Admin operations |
| Login | 20 requests | 15 minutes | Authentication |
| Checkout | 30 requests | 15 minutes | Payment processing |

## Why This Works

1. **Admin users are authenticated**: Only logged-in admins can access `/api/admin` routes
2. **Admin operations are intensive**: Managing products, images, and variants requires many API calls
3. **5x higher limit**: 1000 requests per 15 minutes provides ample headroom for admin work
4. **Still protected**: Rate limiting is still in place to prevent abuse

## Testing

After restarting the backend server:
1. Go to http://localhost:5174 (admin panel)
2. Login with admin/admin123
3. Navigate between products, categories, brands
4. Edit products and upload images
5. **Expected**: No more "Too many requests" errors

## Future Improvements

If needed, we can further optimize by:
1. **Implementing request caching**: Cache frequently accessed data
2. **Batch API calls**: Combine multiple operations into single requests
3. **Lazy loading**: Load data only when needed
4. **WebSocket for real-time updates**: Reduce polling requests
5. **Per-user rate limiting**: Track limits per admin user instead of IP

## Summary

✅ **Fixed**: Admin rate limiting issue
✅ **Increased**: Admin API limit from 200 to 1000 requests per 15 minutes
✅ **Maintained**: Security with rate limiting still in place
✅ **Improved**: Admin panel usability

The admin panel should now work smoothly without rate limiting errors!
