# mventor-ticket-038: API Integrations Management (Admin Panel)

**Status:** Completed âœ…  
**Priority:** High  
**Phase:** Platform Expansion  
**Created:** 2026-07-31  
**Completed:** 2026-07-31  
**Author:** CODEX

---

## Objective

Let the store admin manage ALL external API integrations from the admin panel â€” mail (SMTP), SendGrid, Paymob, Stripe, and AI â€” changing keys and settings **anytime, without editing `.env` or restarting the server**.

---

## Scope

### 1. Backend â€” Integration Settings (category `integrations`)
- [ ] Seed integration settings keys in `server/db.js` (works on existing databases)
  - **Mail:** `mail_provider` (smtp|sendgrid), `mail_smtp_host`, `mail_smtp_port`, `mail_smtp_user`, `mail_smtp_pass`, `mail_from`, `mail_admin_email`
  - **SendGrid:** `sendgrid_api_key`, `sendgrid_from_email`
  - **Paymob:** `paymob_secret_key`, `paymob_public_key`, `paymob_hmac`, `paymob_card_integration_id`, `paymob_wallet_integration_id`
  - **Stripe:** `stripe_publishable_key`, `stripe_secret_key`, `stripe_webhook_secret`
  - **AI:** `ai_provider` (ollama|openai), `ai_base_url`, `ai_model`, `ai_api_key`, `ai_timeout`
  - **Custom:** `custom_api_keys` (JSON object â€” admin-defined key/value pairs)

### 2. Backend â€” Runtime Configuration (services read settings live)
- [ ] `server/email.js` â€” dynamic SMTP config from settings (env fallback), SendGrid HTTP API provider (no new dependency)
- [ ] `server/services/aiService.js` â€” read provider/base/model/key from settings at call time
- [ ] `server/routes/stripe.js` â€” lazy Stripe client initialized from settings (env fallback)

### 3. Backend â€” Admin Routes (`server/routes/integrations.js`)
- [ ] `GET /api/admin/integrations` â€” all integration settings grouped; **secrets masked** (is_set + last-4 + prefix)
- [ ] `PUT /api/admin/integrations` â€” batch save (blank secret = keep existing; explicit null = clear)
- [ ] `POST /api/admin/integrations/test` â€” live connectivity tests:
  - mail/sendgrid â†’ send test email to admin inbox
  - paymob â†’ auth token request (accept.paymob.com/api/auth/tokens)
  - stripe â†’ balance retrieve
  - ai â†’ chat ping
- [ ] Mount in `server/index.js`

### 4. Frontend (client-admin)
- [ ] `IntegrationsPage.jsx` â€” 5 cards (Mail, SendGrid, Paymob, Stripe, AI) + custom keys rows
  - Each card: status badge (Configured / Not configured), password-style masked inputs, Save, Test Connection
- [ ] Register route in `App.jsx` + sidebar item in `Sidebar.jsx`

---

## Acceptance Criteria

- [x] Admin can view status and masked values of all integrations without leaking secrets
- [x] Admin can save new keys and services use them immediately (no restart)
- [x] Test Connection endpoints return honest success/failure with error detail
- [x] Existing email/Stripe/AI behavior unchanged when settings are empty (env fallback)
- [x] Existing 28 unit tests still pass
- [x] Server starts without errors
- [x] Both frontends build successfully

---

## Notes

- Secrets are stored in the local settings table (file-based SQLite, server-local). Values are masked in API responses.
- No new npm dependencies.
- Related: mventor-ticket-031 (settings engine), mventor-ticket-011 (Paymob gateway â€” keys stored here, ready for integration)
