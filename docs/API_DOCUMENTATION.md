# Ecom-ERP API Documentation

**Version:** 1.0.0  
**Base URL:** `https://your-domain.com/api/v1`  
**Last Updated:** July 29, 2026

---

## Overview

The Ecom-ERP API is a RESTful API designed for both web and mobile (Android/iOS) applications. This documentation provides comprehensive guidance for integrating with our e-commerce and ERP platform.

### Key Features

- ✅ RESTful architecture
- ✅ JWT authentication for mobile apps
- ✅ Session-based authentication for web
- ✅ API versioning (v1)
- ✅ Comprehensive error handling
- ✅ Rate limiting
- ✅ CORS support for mobile apps
- ✅ Image optimization endpoints
- ✅ Push notification support
- ✅ Deep linking support

---

## Authentication

### Web Authentication (Session-Based)

Web applications use cookie-based session authentication.

**Login:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### Mobile Authentication (JWT)

Mobile apps use JWT (JSON Web Token) authentication.

**Login:**
```http
POST /api/v1/auth/mobile/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400,
  "user": {
    "id": 1,
    "email": "customer@example.com",
    "name": "Customer Name",
    "phone": "+201234567890"
  }
}
```

**Using JWT Token:**
```http
GET /api/v1/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Refresh Token:**
```http
POST /api/v1/auth/mobile/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

---

## API Endpoints

### Products

#### Get All Products

```http
GET /api/v1/products
```

**Query Parameters:**
- `page` (integer) - Page number (default: 1)
- `limit` (integer) - Items per page (default: 20, max: 100)
- `category` (string) - Filter by category ID
- `search` (string) - Search in name and description
- `sort` (string) - Sort field (price, name, created_at)
- `order` (string) - Sort order (asc, desc)
- `min_price` (integer) - Minimum price in cents
- `max_price` (integer) - Maximum price in cents
- `in_stock` (boolean) - Filter by stock availability

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "description": "Product description",
      "price": 29900,
      "price_formatted": "299.00 ج.م",
      "image_url": "https://example.com/image.jpg",
      "category_id": 1,
      "category_name": "Exercise & Fitness",
      "stock": 50,
      "featured": true,
      "created_at": "2026-01-15T10:30:00Z",
      "variants": [
        {
          "id": 1,
          "color": "Red",
          "size": "M",
          "stock": 25
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### Get Single Product

```http
GET /api/v1/products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Product Name",
    "description": "Full product description",
    "price": 29900,
    "price_formatted": "299.00 ج.م",
    "compare_at_price": 39900,
    "image_url": "https://example.com/image.jpg",
    "gallery": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "category_id": 1,
    "category_name": "Exercise & Fitness",
    "brand_id": 1,
    "brand_name": "Ecom-ERP",
    "stock": 50,
    "featured": true,
    "sizes": ["S", "M", "L", "XL"],
    "colors": [
      {"name": "Red", "hex": "#FF0000"},
      {"name": "Blue", "hex": "#0000FF"}
    ],
    "variants": [
      {
        "id": 1,
        "color": "Red",
        "size": "M",
        "stock": 25,
        "sku": "PROD-RED-M"
      }
    ],
    "related_products": [
      {
        "id": 2,
        "name": "Related Product",
        "price": 19900,
        "image_url": "https://example.com/related.jpg"
      }
    ],
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-07-29T15:45:00Z"
  }
}
```

#### Get Featured Products

```http
GET /api/v1/products/featured
```

**Query Parameters:**
- `limit` (integer) - Number of products (default: 10, max: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Featured Product",
      "price": 29900,
      "price_formatted": "299.00 ج.م",
      "image_url": "https://example.com/featured.jpg",
      "featured_order": 1
    }
  ]
}
```

#### Get Categories

```http
GET /api/v1/categories
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Exercise & Fitness",
      "product_count": 25,
      "icon": "💪"
    }
  ]
}
```

#### Get Brands

```http
GET /api/v1/brands
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Ecom-ERP",
      "icon_url": "https://example.com/brand-icon.png",
      "product_count": 45
    }
  ]
}
```

---

### Cart

#### Get Cart

```http
GET /api/v1/cart
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "product_id": 1,
        "product_name": "Product Name",
        "product_image": "https://example.com/image.jpg",
        "price": 29900,
        "price_formatted": "299.00 ج.م",
        "quantity": 2,
        "subtotal": 59800,
        "subtotal_formatted": "598.00 ج.م",
        "variant": {
          "color": "Red",
          "size": "M"
        }
      }
    ],
    "total_items": 2,
    "subtotal": 59800,
    "subtotal_formatted": "598.00 ج.م",
    "shipping": 5000,
    "shipping_formatted": "50.00 ج.م",
    "total": 64800,
    "total_formatted": "648.00 ج.م"
  }
}
```

#### Add to Cart

```http
POST /api/v1/cart/items
Authorization: Bearer {token}
Content-Type: application/json

{
  "product_id": 1,
  "quantity": 2,
  "variant": {
    "color": "Red",
    "size": "M"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "data": {
    "cart_id": 1,
    "total_items": 3
  }
}
```

#### Update Cart Item

```http
PUT /api/v1/cart/items/:itemId
Authorization: Bearer {token}
Content-Type: application/json

{
  "quantity": 3
}
```

#### Remove from Cart

```http
DELETE /api/v1/cart/items/:itemId
Authorization: Bearer {token}
```

---

### Orders

#### Create Order

```http
POST /api/v1/orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "shipping_address": {
    "name": "John Doe",
    "phone": "+201234567890",
    "address": "123 Main Street",
    "city": "Cairo",
    "governorate": "Cairo",
    "postal_code": "11511"
  },
  "payment_method": "stripe",
  "notes": "Please deliver before 5 PM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "order_number": "ORD-2026-0123",
    "status": "pending",
    "total": 64800,
    "total_formatted": "648.00 ج.م",
    "payment_url": "https://<payment-host>/pay/..."
  }
}
```

#### Get Order History

```http
GET /api/v1/orders
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer) - Page number
- `limit` (integer) - Items per page
- `status` (string) - Filter by status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "order_number": "ORD-2026-0123",
      "status": "delivered",
      "total": 64800,
      "total_formatted": "648.00 ج.م",
      "items_count": 2,
      "created_at": "2026-07-29T10:30:00Z",
      "delivered_at": "2026-07-30T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "total_pages": 1
  }
}
```

#### Get Order Details

```http
GET /api/v1/orders/:id
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "order_number": "ORD-2026-0123",
    "status": "delivered",
    "items": [
      {
        "product_id": 1,
        "product_name": "Product Name",
        "product_image": "https://example.com/image.jpg",
        "price": 29900,
        "quantity": 2,
        "variant": {
          "color": "Red",
          "size": "M"
        }
      }
    ],
    "shipping_address": {
      "name": "John Doe",
      "phone": "+201234567890",
      "address": "123 Main Street",
      "city": "Cairo",
      "governorate": "Cairo",
      "postal_code": "11511"
    },
    "subtotal": 59800,
    "shipping": 5000,
    "total": 64800,
    "payment_method": "stripe",
    "notes": "Please deliver before 5 PM",
    "created_at": "2026-07-29T10:30:00Z",
    "delivered_at": "2026-07-30T15:45:00Z"
  }
}
```

---

### User Account

#### Get Profile

```http
GET /api/v1/user/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "customer@example.com",
    "name": "John Doe",
    "phone": "+201234567890",
    "addresses": [
      {
        "id": 1,
        "name": "Home",
        "address": "123 Main Street",
        "city": "Cairo",
        "governorate": "Cairo",
        "postal_code": "11511",
        "is_default": true
      }
    ],
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

#### Update Profile

```http
PUT /api/v1/user/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+201234567890"
}
```

#### Add Address

```http
POST /api/v1/user/addresses
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Work",
  "address": "456 Business Ave",
  "city": "Giza",
  "governorate": "Giza",
  "postal_code": "12345",
  "is_default": false
}
```

---

### Images

#### Get Optimized Image

```http
GET /api/v1/images/:filename
```

**Query Parameters:**
- `width` (integer) - Desired width
- `height` (integer) - Desired height
- `quality` (integer) - Image quality 1-100 (default: 80)
- `format` (string) - Output format (webp, jpg, png)

**Example:**
```http
GET /api/v1/images/product-123.jpg?width=400&height=400&quality=80&format=webp
```

**Response:** Binary image data with appropriate Content-Type header

#### Get Image Thumbnails

```http
GET /api/v1/images/:filename/thumbnails
```

**Response:**
```json
{
  "success": true,
  "data": {
    "thumbnail": "https://example.com/api/v1/images/product-123.jpg?width=100&height=100",
    "small": "https://example.com/api/v1/images/product-123.jpg?width=300&height=300",
    "medium": "https://example.com/api/v1/images/product-123.jpg?width=600&height=600",
    "large": "https://example.com/api/v1/images/product-123.jpg?width=1200&height=1200",
    "original": "https://example.com/api/v1/images/product-123.jpg"
  }
}
```

---

### Push Notifications

#### Register Device

```http
POST /api/v1/notifications/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_token": "fcm_device_token_here",
  "platform": "android",
  "app_version": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device registered successfully"
}
```

#### Unregister Device

```http
DELETE /api/v1/notifications/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_token": "fcm_device_token_here"
}
```

#### Get Notification Preferences

```http
GET /api/v1/notifications/preferences
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_updates": true,
    "promotions": true,
    "new_arrivals": false,
    "price_alerts": true
  }
}
```

#### Update Notification Preferences

```http
PUT /api/v1/notifications/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "order_updates": true,
  "promotions": false,
  "new_arrivals": true,
  "price_alerts": true
}
```

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Public endpoints:** 100 requests per minute per IP
- **Authenticated endpoints:** 300 requests per minute per user
- **Login endpoints:** 5 requests per minute per IP

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627564800
```

---

## Deep Linking

The API supports deep linking for mobile apps:

### Product Deep Link
```
ecomerp://product/123
```

### Category Deep Link
```
ecomerp://category/1
```

### Order Deep Link
```
ecomerp://order/ORD-2026-0123
```

### Cart Deep Link
```
ecomerp://cart
```

### Profile Deep Link
```
ecomerp://profile
```

---

## Webhooks

The API can send webhooks for real-time updates:

### Order Status Update
```json
{
  "event": "order.status_updated",
  "timestamp": "2026-07-29T15:45:00Z",
  "data": {
    "order_id": 123,
    "order_number": "ORD-2026-0123",
    "status": "shipped",
    "tracking_number": "TRK123456789"
  }
}
```

### Low Stock Alert
```json
{
  "event": "inventory.low_stock",
  "timestamp": "2026-07-29T15:45:00Z",
  "data": {
    "product_id": 1,
    "product_name": "Product Name",
    "current_stock": 5,
    "threshold": 10
  }
}
```

---

## SDK Examples

### Android (Kotlin)

```kotlin
// Initialize API client
val apiClient = EcomerpApiClient(
    baseUrl = "https://your-domain.com/api/v1",
    apiKey = "your-api-key"
)

// Login
val loginResponse = apiClient.auth.login(
    email = "customer@example.com",
    password = "password"
)

// Get products
val products = apiClient.products.getAll(
    page = 1,
    limit = 20,
    category = "1"
)

// Add to cart
apiClient.cart.addItem(
    productId = 1,
    quantity = 2,
    variant = Variant(color = "Red", size = "M")
)
```

### iOS (Swift)

```swift
// Initialize API client
let apiClient = EcomerpApiClient(
    baseUrl: "https://your-domain.com/api/v1",
    apiKey: "your-api-key"
)

// Login
let loginResponse = try await apiClient.auth.login(
    email: "customer@example.com",
    password: "password"
)

// Get products
let products = try await apiClient.products.getAll(
    page: 1,
    limit: 20,
    category: "1"
)
```

---

## Changelog

### v1.0.0 (2026-07-29)
- Initial API release
- Product catalog endpoints
- Cart management
- Order processing
- User account management
- JWT authentication
- Image optimization
- Push notification support
- Deep linking support

---

## Support

For API support, contact:
- Email: api-support@example.com
- Documentation: <docs-url>

---

## License

© 2026 Ecom-ERP. All rights reserved.
