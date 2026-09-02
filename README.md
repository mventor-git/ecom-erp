# 💪 Comfort Sign - Physical Therapy & Sports Equipment

A fully functional e-commerce landing page that runs entirely from your **local PC with zero monthly hosting costs**. Built with React, Node.js, SQLite, and Stripe.

## ✨ Features

- **Landing Page** — Hero section, featured products, categories
- **Product Catalog** — Search, filter by category, product details
- **Shopping Cart** — Add/remove items, quantity controls, persistent (localStorage)
- **Stripe Checkout** — Secure credit card payments (PCI-compliant)
- **Admin Panel** — CRUD products, manage categories, toggle active/inactive
- **Dynamic Inventory** — Add/edit/delete products without touching code
- **Free HTTPS** — ngrok exposes your local server (no CC, no account)

## 📋 Requirements

- [Node.js](https://nodejs.org/) 18+ 
- [Stripe account](https://stripe.com/) (free to sign up)
- [ngrok](https://ngrok.com/) (free, no credit card needed)

## 🚀 Quick Start

### 1. Configure Environment

Edit `server/.env` and set your Stripe keys:

```
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=random_string_here
```

### 2. Install & Run

Double-click **`start.bat`** — or run manually:

```bash
# Terminal 1: Backend
cd server
npm install
npm start          # Runs on http://localhost:5172

# Terminal 2: Frontend
cd client
npm install
npm run dev        # Runs on http://localhost:5173
```

### 3. Open Your Store

- **Storefront:** http://localhost:5173
- **Admin Panel:** http://localhost:5173/admin
- **API Health:** http://localhost:5172/api/health

### 4. Expose to the Internet (Free)

```bash
start.bat tunnel
```

Or directly:
```bash
ngrok http 5172
```

Gives you a public HTTPS URL instantly — **no hosting costs, no credit card, no account**.

> **Tip:** `start.bat prod` builds the frontend, starts the backend, and launches ngrok in one command.

### 5. Add Products

1. Go to http://localhost:5173/admin
2. Log in (default: `admin` / `change_this_password` — change these in `.env`!)
3. Click "Add Product" and fill in the details

## 🏗️ Project Structure

```
D:\Projects\on-dev\comfort-sign-deploy\
├── VISION.MD          # Architecture blueprint
├── start.bat          # One-click launcher
├── README.md          # This file
│
├── server/            # Backend
│   ├── index.js       # Express entry point
│   ├── db.js          # SQLite database setup
│   ├── schema.sql     # Database schema reference
│   ├── .env           # Configuration (secrets)
│   ├── data/          # SQLite database file
│   ├── public/images/ # Product images
│   ├── routes/        # API routes
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── admin.js
│   │   └── stripe.js
│   └── middleware/
│       └── adminAuth.js
│
├── client/            # Frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── api/       # Axios API client
│   │   ├── context/   # CartContext (React)
│   │   ├── components/# Reusable components
│   │   └── pages/     # Route pages
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docs/              # Documentation
├── tickets/           # Ticket tracking
└── .codex/            # CODEX internal files
```

## 💳 Payments (Stripe)

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Get your keys from Dashboard → Developers → API Keys
3. For webhooks: use your ngrok URL + `/webhook` as the endpoint
4. Select events: `checkout.session.completed`

## 🔒 Security

- Stripe handles all credit card data — your server never sees card numbers
- Environment variables for all secrets
- Admin session-based authentication
- SQL injection prevention (parameterized queries)
- HTTPS via tunnel service

## 💰 Cost Breakdown

| Item | Cost |
|------|------|
| Backend (Node.js) | Free |
| Database (SQLite) | Free |
| Frontend (React/Vite) | Free |
| Tunnel (Cloudflare) | Free |
| Stripe fees | 2.9% + $0.30/transaction |
| **Monthly total** | **$0 + Stripe fees** |

## 🧪 Testing the Setup

```bash
# Health check
curl http://localhost:5172/api/health

# List products
curl http://localhost:5172/api/products

# List categories
curl http://localhost:5172/api/products/categories/list
```

## 📝 License

MIT
