# mventor-ticket-011: Paymob Payment Gateway (Vodafone Cash + Instapay)

**Status:** ðŸ“‹ Planned  
**Priority:** High  
**Phase:** 10 â€” Payments  

## Description
Add Paymob as a second payment option alongside Stripe. Paymob supports **Vodafone Cash**, **Instapay**, and card payments in Egypt.

## Why Paymob
- Supports Vodafone Cash, Instapay, cards â€” all in one gateway
- Egyptian customers can pay locally without international cards
- Paymob handles the transaction; we just need API keys

## What Needs to Change

### Backend
| File | What to Add |
|------|------------|
| `server/.env` | `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_ID` |
| `server/routes/paymob.js` | NEW: Paymob payment flow (create order â†’ get payment key â†’ iframe/webhook) |
| `server/index.js` | Mount Paymob routes |

### Frontend
| File | What to Add |
|------|------------|
| `client/src/pages/CartPage.jsx` | Add "Pay with Vodafone Cash / Instapay" button alongside Stripe |

### Flow
1. Customer chooses Paymob at checkout
2. Backend creates a Paymob payment order â†’ gets a payment key
3. Frontend opens Paymob's iframe/redirect
4. Customer pays with Vodafone Cash or Instapay
5. Paymob webhook notifies our server â†’ order marked as paid

### Environment Variables to Add
```
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_INTEGRATION_ID=your_integration_id
```

## Prerequisites (manual setup)
1. Sign up at https://paymob.com
2. Get API keys from dashboard
3. Set webhook URL to `https://YOUR_NGROK_URL.ngrok-free.dev/api/paymob/webhook`

## Acceptance Criteria
- [ ] Customers can pay with Vodafone Cash
- [ ] Customers can pay with Instapay
- [ ] Orders are marked as paid on successful payment
- [ ] Works alongside existing Stripe payment

## Files Changed (estimated)
```
Modified:
  server/.env
  server/index.js
  client/src/pages/CartPage.jsx

New:
  server/routes/paymob.js
```
