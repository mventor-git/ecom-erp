# 🔍 MONITORING & ERROR TRACKING SETUP GUIDE
**Date:** August 24, 2026  
**Status:** Ready for Implementation  
**Priority:** High

---

## 📊 OVERVIEW

This guide provides step-by-step instructions for setting up production monitoring and error tracking for the Comfort Sign admin panel. We'll cover:

1. **Error Tracking** with Sentry (free tier: 5K events/month)
2. **Uptime Monitoring** with Uptime Robot (free tier: 50 monitors)
3. **Performance Monitoring** with built-in metrics
4. **Log Aggregation** (already implemented with Morgan)

---

## 1️⃣ ERROR TRACKING: SENTRY

### Why Sentry?
- Real-time error notifications
- Stack traces with source maps
- User context (which admin triggered the error)
- Performance monitoring (APM)
- Free tier: 5,000 errors/month

### Setup Steps

#### A. Create Sentry Account
1. Go to https://sentry.io/signup/
2. Sign up with email (free tier)
3. Create a new project:
   - Platform: **Node.js**
   - Project name: **comfort-sign-backend**

#### B. Get Your DSN
After creating the project, Sentry will show you a DSN like:
```
https://abc123def456@o123456.ingest.sentry.io/789012
```

Copy this DSN.

#### C. Install Sentry SDK
```bash
cd server
npm install @sentry/node @sentry/profiling-node
```

#### D. Add to package.json
Your `server/package.json` dependencies should now include:
```json
{
  "dependencies": {
    "@sentry/node": "^7.80.0",
    "@sentry/profiling-node": "^1.3.0"
  }
}
```

#### E. Add DSN to .env
Edit `server/.env`:
```env
# Sentry Error Tracking
SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/789012
SENTRY_ENVIRONMENT=production  # or development, staging
```

#### F. Initialize Sentry in server/index.js
Add at the **very top** of `server/index.js` (before any other imports):

```javascript
// Sentry must be initialized FIRST (before any other imports)
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  const { ProfilingIntegration } = require('@sentry/profiling-node');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: 0.1, // 10% of requests (adjust based on traffic)
    profilesSampleRate: 0.1, // 10% profiling
    integrations: [
      new ProfilingIntegration(),
    ],
  });

  console.log('🔍 Sentry error tracking initialized');
}

// NOW continue with other imports
require('dotenv').config();
const express = require('express');
// ... rest of your code
```

#### G. Add Sentry Request Handler
After creating the Express app, add Sentry request handler:

```javascript
const app = express();

// Sentry request handler (must be before routes)
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ... rest of your middleware
```

#### H. Add Sentry Error Handler
Right **before** your custom error handler, add Sentry's error handler:

```javascript
// Sentry error handler (must be before your error handler, but after all routes)
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  app.use(Sentry.Handlers.errorHandler());
}

// Your custom error handler (existing code)
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err.message);
  // ... rest of your error handler
});
```

#### I. Add User Context (Optional but Recommended)
To track which admin user triggered errors, add this middleware after authentication:

```javascript
// In server/middleware/adminAuth.js or after authentication
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  
  // Add user context to Sentry
  Sentry.setUser({
    id: req.session.adminUser?.id,
    email: req.session.adminUser?.email,
    username: req.session.adminUser?.username,
    role: req.session.adminUser?.role
  });
}
```

#### J. Test Sentry
Add a test endpoint to verify Sentry works:

```javascript
// Test endpoint (remove in production)
app.get('/api/admin/test-sentry', (req, res) => {
  throw new Error('Sentry test error - this should appear in your Sentry dashboard');
});
```

Visit: `http://localhost:5172/api/admin/test-sentry`

Check your Sentry dashboard at https://sentry.io/ — you should see the error within seconds.

---

## 2️⃣ UPTIME MONITORING: UPTIME ROBOT

### Why Uptime Robot?
- Free tier: 50 monitors
- 5-minute check intervals
- Email/SMS/Slack alerts
- Public status page
- No credit card required

### Setup Steps

#### A. Create Account
1. Go to https://uptimerobot.com/signUp
2. Sign up with email (free tier)
3. Verify your email

#### B. Add HTTP(S) Monitor
1. Click **"+ Add New Monitor"**
2. Monitor Type: **HTTP(s)**
3. Friendly Name: **Comfort Sign API**
4. URL: `https://your-domain.com/api/health`  
   (or `http://your-ip:5172/api/health` for testing)
5. Monitoring Interval: **5 minutes** (free tier)
6. Click **"Create Monitor"**

#### C. Add Alert Contacts
1. Go to **My Settings** → **Alert Contacts**
2. Add your email address
3. Add Slack webhook (optional - see Slack section below)
4. Add SMS (optional - requires phone verification)

#### D. Configure Alert Thresholds
1. Edit your monitor
2. Set **"Alert When Down"** → **After 2 failures** (10 minutes)
3. Save

#### E. Create Public Status Page (Optional)
1. Go to **Status Pages** → **Add Status Page**
2. Choose monitors to include
3. Get public URL: `https://stats.uptimerobot.com/XXXXX`
4. Share with your team or customers

---

## 3️⃣ SLACK NOTIFICATIONS (Optional)

### Setup Slack Webhook
1. Go to https://api.slack.com/messaging/webhooks
2. Click **"Create your Slack app"**
3. Choose **"From scratch"**
4. App Name: **Comfort Sign Alerts**
5. Workspace: Select your workspace
6. Go to **Incoming Webhooks** → Enable
7. Click **"Add New Webhook to Workspace"**
8. Select channel (e.g., `#alerts`)
9. Copy the webhook URL

### Add to .env
```env
# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### Create Notification Service
Create `server/services/notificationService.js`:

```javascript
const axios = require('axios');

async function sendSlackAlert(message, severity = 'info') {
  if (!process.env.SLACK_WEBHOOK_URL) return;

  const colors = {
    info: '#36a64f',
    warning: '#ff9800',
    error: '#f44336',
    critical: '#9c27b0'
  };

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      attachments: [{
        color: colors[severity] || colors.info,
        text: message,
        ts: Math.floor(Date.now() / 1000)
      }]
    });
  } catch (err) {
    console.error('Slack notification failed:', err.message);
  }
}

module.exports = { sendSlackAlert };
```

### Use in Your Code
```javascript
const { sendSlackAlert } = require('./services/notificationService');

// Example: Alert on critical errors
app.use((err, req, res, next) => {
  if (err.status >= 500) {
    sendSlackAlert(`🚨 Server Error: ${err.message}`, 'error');
  }
  // ... rest of error handler
});
```

---

## 4️⃣ PERFORMANCE MONITORING (Built-in)

### Endpoint Response Time Tracking
Morgan already logs response times. To track slow endpoints, add this middleware:

Create `server/middleware/performanceMonitor.js`:

```javascript
const SLOW_THRESHOLD_MS = 1000; // 1 second

function performanceMonitor(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (duration > SLOW_THRESHOLD_MS) {
      console.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms`);

      // Optional: Send to Sentry
      if (process.env.SENTRY_DSN) {
        const Sentry = require('@sentry/node');
        Sentry.captureMessage(`Slow endpoint: ${req.method} ${req.path} (${duration}ms)`, {
          level: 'warning',
          extra: { duration, method: req.method, path: req.path }
        });
      }
    }
  });

  next();
}

module.exports = performanceMonitor;
```

Add to `server/index.js`:
```javascript
const performanceMonitor = require('./middleware/performanceMonitor');
app.use(performanceMonitor);
```

---

## 5️⃣ HEALTH CHECK ENDPOINT (Already Exists)

Your health check at `/api/health` is already perfect:

```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

Consider enhancing it with database connectivity:

```javascript
app.get('/api/health', (req, res) => {
  try {
    // Test database
    const dbTest = db.prepare('SELECT 1').get();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbTest ? 'connected' : 'disconnected',
      version: require('./package.json').version
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: 'Database connection failed'
    });
  }
});
```

---

## 6️⃣ LOG ROTATION (Recommended)

Your Morgan logs will grow indefinitely. Add log rotation:

### Install winston-daily-rotate-file
```bash
npm install winston winston-daily-rotate-file
```

### Update Logging (Alternative to Morgan for production)
Create `server/utils/logger.js`:

```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d' // Keep 14 days
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d' // Keep 30 days
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

---

## 7️⃣ DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Set `NODE_ENV=production` in environment variables
- [ ] Add Sentry DSN to environment variables
- [ ] Configure Uptime Robot monitor with production URL
- [ ] Set up Slack webhook (optional)
- [ ] Enable log rotation
- [ ] Test health check endpoint
- [ ] Test Sentry by triggering a test error
- [ ] Verify email alerts work from Uptime Robot
- [ ] Set up SSL certificate (Let's Encrypt or Cloudflare)
- [ ] Configure firewall (only allow ports 80, 443)

---

## 8️⃣ MONITORING DASHBOARD

### Quick Monitoring Dashboard URLs

After setup, bookmark these:

1. **Sentry Dashboard:** https://sentry.io/organizations/YOUR_ORG/issues/
2. **Uptime Robot:** https://uptimerobot.com/dashboard
3. **Public Status:** https://stats.uptimerobot.com/XXXXX
4. **Server Logs:** `tail -f logs/access.log`
5. **Error Logs:** `tail -f logs/error*.log`

---

## 9️⃣ COST BREAKDOWN

| Service | Free Tier | Paid Tier | Recommended |
|---------|-----------|-----------|-------------|
| **Sentry** | 5K events/month | $26/month (50K events) | Free tier sufficient for small-medium |
| **Uptime Robot** | 50 monitors, 5min interval | $7/month (unlimited, 1min) | Free tier sufficient |
| **Slack** | Free | Free | Free forever |
| **Cloudflare** | Free SSL + DDoS | $20/month (advanced) | Free tier sufficient |

**Total Monthly Cost (Recommended):** **$0/month** (free tiers)

---

## 🔟 TESTING YOUR SETUP

### Test Error Tracking
```bash
curl http://localhost:5172/api/admin/test-sentry
# Check Sentry dashboard — error should appear within 5 seconds
```

### Test Uptime Monitoring
```bash
# Stop your server
npm stop

# Wait 10 minutes — you should receive an email alert
```

### Test Health Check
```bash
curl http://localhost:5172/api/health
# Should return: {"status":"ok", "uptime":123, ...}
```

### Test Performance Monitoring
```bash
# Make a slow request (if you have one)
curl http://localhost:5172/api/admin/reports
# Check logs for [SLOW] warnings
```

---

## ✅ SUMMARY

After completing this guide, you'll have:

- ✅ Real-time error tracking with Sentry
- ✅ 24/7 uptime monitoring with email alerts
- ✅ Slack notifications for critical issues
- ✅ Performance monitoring for slow endpoints
- ✅ Structured logging with Morgan
- ✅ Health check endpoint for status pages
- ✅ Log rotation to prevent disk overflow

**Total Setup Time:** ~30 minutes  
**Monthly Cost:** $0 (free tiers)

---

**Report Generated:** August 24, 2026 at 15:02 UTC  
**Author:** Claude (AI Agent)  
**Status:** Ready for Implementation