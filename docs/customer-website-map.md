# Customer Website UX Map — Comfort Sign

| PAGE | PURPOSE | HOW TO REACH | IMPORTANT UI | USER ACTIONS | NEXT DESTINATION | STATE |
|---|---|---|---|---|---|---|
| Home | Discovery / promo | Root /nav | Hero slider, featured grid, top-selling, categories, trust badges, announcements rotator, features | Browse, click product, add to cart | Product / Cart | Working |
| Products | Catalog | /products | Grid, filters, search | View details, add to cart | Product detail | Working |
| Product Detail | Purchase decision | /products/:id | Gallery, color/size selectors, reviews, quantity, add-to-cart, wishlist | Select variant, write review (if auth) | Cart / Account | Working |
| Cart | Checkout prep | /cart | List items, qty, remove, total, email input, payment method (Kashier/Stripe), checkout btn | Update qty, remove, enter email, pay | Checkout success/cancel | Working |
| Checkout Success | Confirm | /checkout/success | Confirmation message | — | Account / Home | Working |
| Checkout Cancel | Fail | /checkout/cancel | Message | — | Cart / Home | Working |
| Account | Profile / orders | /account | Profile info, orders, order tracking links | View orders, verify | Order Tracker | Working |
| Order Tracker | Track | /track-orders | Order status / tracking info | — | — | Working |
| Login | Auth | /login | Email/password or OAuth-style | Login / signup | Account / Home | Working |
| Welcome / Onboarding | First-time | /welcome /onboarding | Intro / setup | Continue | Home | Working |

## Major flows
- Discover → Product → Cart → Checkout (Success/Cancel)
- Account → Orders → Track
- Auth → Account
