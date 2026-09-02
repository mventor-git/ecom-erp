# Architecture Decisions

## ADR-001: SQL.js instead of better-sqlite3
**Context:** Native module compilation failed on Windows  
**Decision:** Use `sql.js` (pure JavaScript SQLite implementation)  
**Consequence:** No native compilation needed, works everywhere. Slightly higher memory usage (loads DB into RAM). Good for small-to-medium stores.

## ADR-002: File-based sessions instead of SQLite session store
**Context:** Session store packages required native SQLite  
**Decision:** Use `session-file-store`  
**Consequence:** Sessions stored as JSON files. No native deps. Fine for single-admin use case.

## ADR-003: ngrok for zero-cost HTTPS tunnel
**Context:** Need stable, free HTTPS tunnel with no budget and no credit card  
**Decision:** Use ngrok (free tier)  
**Consequence:** No account or credit card required. Random URL on each start. 1 GB/month bandwidth, 40 connections/min free tier limits. Local inspection UI at `http://127.0.0.1:4040` for debugging.

## ADR-004: Stripe Checkout instead of custom payment form
**Context:** PCI compliance, security  
**Decision:** Use Stripe Checkout (hosted payment page)  
**Consequence:** No credit card data touches our server; Stripe handles PCI compliance. Simpler integration.

## ADR-005: Vite instead of Create React App
**Context:** Modern React tooling  
**Decision:** Use Vite  
**Consequence:** Faster dev server, faster builds, smaller bundle. CRA is deprecated.

## ADR-006: Plain admin session instead of JWT
**Context:** Single admin user on local PC  
**Decision:** Use express-session with file store  
**Consequence:** Simple, no token management needed. Only one admin.

## ADR-007: Multer for file uploads
**Context:** Need to handle multipart/form-data for image uploads in admin panel  
**Decision:** Use multer middleware with disk storage  
**Consequence:** Handles streaming, file type validation, size limits. Stores files to `server/public/images/` with unique random filenames. No native dependencies required (pure JS).

## ADR-008: Nodemailer for email notifications
**Context:** Need to send order confirmation emails to customers and admin notifications  
**Decision:** Use nodemailer with configurable SMTP (not a third-party API service)  
**Consequence:** Works with any SMTP provider (SendGrid, Gmail, Mailgun, etc.). No API key vendor lock-in. Graceful degradation: emails logged when SMTP not configured. User must bring their own SMTP credentials.

## ADR-009: In-memory TTL cache for product listings
**Context:** Product listing endpoint is the most frequently hit; repeated DB queries for the same data  
**Decision:** Use a lightweight in-memory Map cache with TTL (30 seconds) for product listings  
**Consequence:** Repeated product page loads hit cache instead of DB. Automatically invalidated when admin creates/updates/deletes products. Simple, zero-dependency solution. Not suitable for multi-process deployment (each process has its own cache).

## ADR-010: Compression middleware
**Context:** API responses include product data and images; bandwidth optimization  
**Decision:** Use `compression` middleware (zlib-based Gzip) applied globally  
**Consequence:** ~70% bandwidth reduction on JSON responses. Minimal CPU overhead. Node.js `http` module auto-decompresses on the client side.

## ADR-011: Rate limiting with express-rate-limit
**Context:** Public API endpoints vulnerable to abuse; login endpoint needs brute-force protection  
**Decision:** Use `express-rate-limit` with tiered limits (API: 200/15min, login: 20/15min, checkout: 30/15min)  
**Consequence:** Prevents abuse while being generous enough for normal usage. Standard RateLimit headers sent. Limits adjustable in code.

## ADR-012: Helmet for security headers
**Context:** Production deployment needs security headers to protect against common web vulnerabilities  
**Decision:** Use `helmet` middleware with custom CSP configuration tailored for React SPA  
**Consequence:** CSP allows React dev tools (`'unsafe-inline'`, `'unsafe-eval'`), Google Fonts, and blob/data URLs for images. HSTS enabled in production. X-Frame-Options prevents clickjacking.

## ADR-013: Custom CSRF middleware (session-based token)
**Context:** SPA admin panel needs CSRF protection on state-changing requests  
**Decision:** Custom CSRF middleware using session-stored tokens. Token generated on login, retrieved via `GET /api/admin/csrf-token`, sent as `X-CSRF-Token` header  
**Consequence:** No additional dependencies. Works with SPA pattern (no form-hidden fields). Token rotates on re-login. Exempts public routes (login, health, webhook, checkout).
