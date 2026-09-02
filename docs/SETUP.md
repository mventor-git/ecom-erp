# Deployment Setup Guide

## Overview
This guide walks through exposing your store to the internet using **ngrok** — a free HTTP tunnel that gives you a public HTTPS URL instantly.

**Zero cost. No credit card required. No account needed.**

**Architecture:**
```
[Customer] → https://xxxx.ngrok-free.app → [ngrok Tunnel] → http://localhost:5172 → [Your PC]
```

---

## Step 1: Install ngrok

Download ngrok (free, no credit card required):

- **Option A — Download:** https://ngrok.com/download
- **Option B — WinGet:**
  ```cmd
  winget install ngrok
  ```

Verify installation:
```cmd
ngrok --version
```

> **Note:** You can use ngrok without signing up. The free tier gives you random URLs (`xxxx.ngrok-free.app`), 1 GB/month bandwidth, and 40 connections/minute — plenty for testing and low-traffic use.

---

## Step 2: Start Your Backend

Make sure your store backend is running:

```cmd
start.bat
```

Or manually:
```cmd
cd server
node index.js
```

Your backend is now running at `http://localhost:5172`.

---

## Step 3: Start ngrok

### Option A: One-click (using start.bat)
```cmd
start.bat tunnel
```

### Option B: Direct command
```cmd
ngrok http 5172
```

### Option C: Production mode (build + backend + tunnel)
```cmd
start.bat prod
```

---

## Step 4: Get Your URL

ngrok opens a terminal window showing:

```
Forwarding  https://a1b2c3d4.ngrok-free.app -> http://localhost:5172
```

Your public URL is `https://a1b2c3d4.ngrok-free.app`.

Visit it in any browser — your store is live!

---

## Step 5: Update Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. URL: `https://YOUR_NGROK_URL.ngrok-free.app/webhook`
4. Select events: `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Update `server/.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_new_secret
   ```

---

## Step 6: Verify Everything

1. Visit `https://YOUR_NGROK_URL.ngrok-free.app` — you should see your store
2. Visit `https://YOUR_NGROK_URL.ngrok-free.app/api/health` — should return `{"status":"ok"}`
3. Place a test order through the store
4. Check the admin panel at `https://YOUR_NGROK_URL.ngrok-free.app/admin`
5. Stripe webhook should fire and update the order status

---

## Using ngrok Web Interface

ngrok includes a local web UI at `http://127.0.0.1:4040` where you can:

- Inspect all incoming requests (method, path, headers, body)
- Replay any request (useful for testing webhooks)
- View response status codes and timing
- See raw request/response data

This is invaluable for debugging Stripe webhooks and API calls.

---

## Common Commands

```cmd
:: Basic tunnel (random URL)
ngrok http 5172

:: Tunnel with custom subdomain (requires free account)
ngrok http 5172 --subdomain=my-store

:: Inspect traffic at http://127.0.0.1:4040
ngrok http 5172

:: Tunnel with basic auth
ngrok http 5172 --basic-auth="admin:secret"
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `ngrok: command not found` | Not installed or not in PATH | Reinstall, restart terminal, or use full path |
| Tunnel starts but 502 Bad Gateway | Backend not running on port 5172 | Run `node index.js` in `server/` folder |
| Site loads but no products | Backend DB not seeded | Run `cd server && npm run seed` |
| Stripe checkout fails | Webhook URL wrong | Update Stripe dashboard with ngrok URL |
| Too many connections | Free tier rate limit | Wait a minute; reduce concurrent requests |
| 404 on all routes | Wrong port | Make sure ngrok points to `5172`, not `5173` |

---

## Cost Breakdown

| Item | Cost |
|------|------|
| ngrok (free tier) | **$0** |
| No account required | **$0** |
| No credit card needed | **$0** |
| Stripe fees | 2.9% + $0.30 per transaction |
| **Total monthly** | **$0** |

---

## How It Works

ngrok creates an outbound connection from your PC to ngrok's servers. When a customer visits your ngrok URL, ngrok forwards the request through the tunnel to your local backend. No firewall configuration or port forwarding needed — your PC doesn't need a public IP address.

The free tier gives you a new random URL each time you restart ngrok. If you want a permanent URL, create a free ngrok account (still no credit card) and use a reserved subdomain.
