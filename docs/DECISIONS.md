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

## ADR-014: Accounting truth = posted journals; operational modules own operational state (074)
**Context:** Finance domain extraction must not create competing money truths (cf. products.stock vs ledger, JSON vs rows lessons)  
**Decision:** Posted journal entries/lines are the future accounting truth. Inventory owns qty/movements/cost-layers; Accounting owns asset/AP/AR/revenue/COGS/expense/clearing balances. INTEGER-cents money kept (stronger than reference REAL — float money rejected). SmartAccounting used as semantics/test oracle only, never architecture.  
**Consequence:** All future postings derive from journals; idempotency reuses existing event_key/idempotency/bridge-skip infrastructure; period enforcement, CoA, and mappings arrive in Tickets B–G before any posting behavior.

## ADR-015: Supplier payments are their own immutable, applied, posted transaction (088)
**Context:** 087 recognized AP at goods receipt (no supplier-invoice entity exists), leaving payables with no relief path. A payment is real money movement and must not be a silent balance edit.
**Decision:** A payment is persisted as `supplier_payments` (PAY-YYYY-NNNN, full/partial) with explicit `supplier_payment_applications` rows to purchase orders; it posts `Dr 2100 Accounts Payable / Cr 1000 Cash` on the canonical 086/087 journal seam. Posted payments are immutable — corrections are reversals (opposite posted entry + status flip), never edits/deletes. Outstanding AP per PO is DERIVED from posted journals (ADR-014), not a mutable counter. Posting logic lives only in `supplierPaymentService`; the route holds no account codes. Replay-safety reuses `idempotency_key` UNIQUE + the journal `ux_journal_source` UNIQUE. Atomic via the nesting-aware `db.transaction`.
**Alternatives considered:** mutable payable balance column (rejected: competing truth, ADR-014); applying to a supplier-invoice entity (rejected: none exists today — invoice-grain application deferred until that entity lands); hardcoding account IDs in the route (rejected: chart must stay the single home, see 087 `accountChart`).
**Consequences:** Supplier payments relieve AP end-to-end (tested). Bank/transfer methods slot in via `METHOD_ACCOUNTS`; advances/prepayments and invoice-grain application are later slices, not required here.

## ADR-016: AP Aging is recognition-date aging over posted journals (090)
**Context:** First AP aging needed a defined age basis; the canonical model has no supplier-invoice/payment-terms entity (087 recognizes AP at goods receipt), and `po.expected_at` is a commercial ETA, not an accounting due date.
**Decision:** Aging basis = as_of date − the POSTED AP-credit journal's `entry_date` (087 receipt posting). Open item = one posted recognition line; payments are active as-of X iff their posted `payment-recorded` journal entry_date ≤ X and no posted `payment-reversed` journal entry_date ≤ X (payment journal entry_date == paid_at, reversal journal carries reversal day → historical as-of is reconstructable without faking). Applications allocated to a PO's lines FIFO by (entry_date, journal id) — deterministic convention. Buckets non-overlapping: 0 / 1–30 / 31–60 / 61–90 / 91+ (labeled 90+). Totals/summary always computed over the FULL filtered set (items paginated independently).
**Alternatives considered:** due-date aging from expected_at (rejected: not an accounting due date, would fake semantics); PO-grain single age with a weighted average (rejected: mixes different ages, unreconcilable per-line); mutable aging cache (rejected: ADR-014).
**Consequences:** Report is honest (basis + limitations surfaced in the response itself: `aging_basis` field). True contractual due-date aging becomes a future slice when/if supplier invoices land.

**ADDENDUM 2026-09-12 (hardening, follows 05c9a96): causal application invariant.** A payment application may reduce a payable recognition line only if that line EXISTED BY THE PAYMENT'S OWN POSTED ACCOUNTING DATE (journal `entry_date` of the payment vs line `entry_date`). A back-dated payment (e.g., payment journal Jan-10 against a receipt recognized Jan-20) must NEVER be subtracted from the later line; the residual amount it cannot causally apply is carried as `unapplied_advance_cents` (excluded from the open-line calculation — the model has no advances/prepayments entity, so no liability-side asset is invented and totals stay honest: per PO, raw applications(X) = applied-within-lines(X) + unapplied_advance(X); global Σ itemRemaining == buckets == report_total). Payments are consumed oldest-payment-first, lines oldest-first, fully deterministic. Causally-valid sequences behave IDENTICALLY to the original FIFO rule; only back-dated settlement is neutralized. Historical as-of semantics unchanged (recognition-date basis). Control totals are machine-verified; mismatches fail the suite outright.
