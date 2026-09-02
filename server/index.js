require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const clientDist = path.join(__dirname, "..", "client", "dist");
const passport = require('passport');
const morgan = require('morgan');
const fs = require('fs');
const db = require('./db');
const cache = require('./cache');
const { csrfProtection } = require('./middleware/csrf');

const app = express();
const PORT = process.env.PORT || 5172;
const isProduction = process.env.NODE_ENV === 'production';

// Fail fast in production with insecure defaults (mventor-ticket-050)
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-secret-change-in-production')) {
  console.error('SESSION_SECRET must be set to a strong random value in production.');
  process.exit(1);
}

// SECURITY: refuse to start in production with a weak / known-default admin
// credential. The admin password must be an environment-provided strong value
// (or a bcrypt hash); never ship a known default like "admin123".
if (isProduction) {
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const knownDefaults = ['admin123', 'password', 'admin', 'changeme', 'change_this_password', 'letmein'];
  const weak = !adminPass || adminPass.length < 8 || knownDefaults.includes(adminPass.toLowerCase());
  if (weak) {
    console.error('ADMIN_PASSWORD must be a strong, non-default env-provided value (min 8 chars, not a known default) in production.');
    process.exit(1);
  }
}

// Trust proxy — needed when behind ngrok/reverse proxy
// This ensures req.protocol and req.hostname use the forwarded values
app.set('trust proxy', 1);

// --------------- Security Headers (helmet) ---------------

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // needed for React dev
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'], // allow external product/hero images
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for Vite dev
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // images need this
}));

// Hide Express header
app.disable('x-powered-by');

// --------------- Compression ---------------

app.use(compression());

// --------------- Request Logging ---------------

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write stream for access logs (append mode)
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

// Custom token for correlation ID (helps track requests across services)
morgan.token('correlation-id', (req) => req.headers['x-correlation-id'] || req.session?.id || '-');

// Custom token for user ID (helps track actions by user)
morgan.token('user-id', (req) => {
  if (req.session?.isAdmin) return `admin:${req.session.adminUser?.username || 'unknown'}`;
  if (req.session?.userId) return `customer:${req.session.userId}`;
  if (req.user?.id) return `mobile:${req.user.id}`;
  return '-';
});

// Log format: combined + correlation ID + user ID
// Example: ::1 - customer:123 [24/Aug/2026:14:30:00 +0000] corr-xyz "GET /api/products HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
const logFormat = ':remote-addr - :user-id [:date[clf]] :correlation-id ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// Apply logging middleware
if (isProduction) {
  // Production: log to file only (don't clutter console)
  app.use(morgan(logFormat, { stream: accessLogStream }));
} else {
  // Development: log to both console and file
  app.use(morgan('dev')); // colored console output
  app.use(morgan(logFormat, { stream: accessLogStream }));
}

console.log(`📝  Request logging enabled (${isProduction ? 'file only' : 'console + file'})`);
console.log(`📂  Logs directory: ${logsDir}`);

// --------------- Rate Limiting ---------------

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Admin requests are handled by adminLimiter (1000/15min) — don't double-count
  skip: (req) => req.originalUrl.startsWith('/api/admin'),
  message: { error: 'Too many requests, please try again later.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // higher limit for admin operations (1000 requests per 15 min)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // limit login attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // limit checkout attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts, please try again later.' },
});

// Apply rate limiters
app.use('/api', apiLimiter);
app.use('/api/admin', adminLimiter); // Apply higher limit for admin routes
app.use('/api/admin/login', authLimiter);
app.use('/create-checkout-session', checkoutLimiter);

// --------------- CORS ---------------

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      process.env.CLIENT_URL,
    ].filter(Boolean);
    // Strict allowlist (mventor-ticket-050): requests with an Origin header
    // must come from a known frontend; no-origin requests (curl, mobile apps,
    // server-to-server) pass through.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      if (!isProduction) console.warn(`[cors] blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));

// --------------- Body Parsing ---------------

app.use(express.json({
  limit: '10mb',
  // Preserve raw body for webhook HMAC signature verification (mventor-ticket-061)
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --------------- Static Files ---------------

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// Serve built frontend (production only)
if (isProduction) {
  if (require("fs").existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }
}
// --------------- Sessions ---------------

app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 86400, // 24 hours
    reapInterval: 3600, // Cleanup every hour
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'store_sid', // custom name, not default 'connect.sid'
  cookie: {
    httpOnly: true,
    // Express detects HTTPS through ngrok's forwarded protocol while still
    // allowing the separate admin frontend to authenticate over localhost.
    secure: 'auto',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --------------- Passport (Google OAuth) ---------------

app.use(passport.initialize());
app.use(passport.session());

// --------------- CSRF Protection ---------------

app.use(csrfProtection);

// --------------- Routes ---------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CSRF token endpoint (for authenticated admin users)
app.get('/api/admin/csrf-token', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ csrfToken: req.session.csrfToken || '' });
});

// Mount route modules
// Product trash routes MUST be mounted before /api/admin (admin.js) so that
// /api/admin/products/trash* is not captured by admin.js '/products/:id' patterns.
app.use('/api/admin/products', require('./routes/productTrash'));
app.use('/api/admin/products', require('./routes/bulkProducts'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use("/api/admin-sale", require("./routes/adminSale"));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/events', require('./routes/events'));
app.use('/api/admin/notifications', require('./routes/notifications'));
app.use('/api/admin/users', require('./routes/users'));
app.use('/api/admin/upload', require('./routes/upload'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/admin/inventory', require('./routes/inventory'));
app.use('/api/admin/settings', require('./routes/settings'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin/document-numbers', require('./routes/documentNumbers'));
app.use('/api/admin/suppliers', require('./routes/suppliers'));
app.use('/api/admin', require('./routes/warehouses'));
app.use('/api/admin/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/admin/reports', require('./routes/reports'));
app.use('/api/admin/integrations', require('./routes/integrations'));
app.use('/api/admin/invoices', require('./routes/invoices'));
app.use('/api/admin', require('./routes/warehouseOrders'));
app.use('/api/admin/view', require('./routes/views'));
app.use('/api/admin/price-lists', require('./routes/priceLists'));
app.use('/api/admin', require('./routes/pickingPacking'));
app.use('/api/admin/pricing', require('./routes/pricingManager'));
app.use('/api/admin/kashier', require('./routes/kashier'));
app.use('/api/kashier/checkout', require('./routes/kashierCheckout'));
app.use('/api/kashier', require('./routes/kashierWebhook'));
app.use('/api/admin/shipping', require('./routes/shipping'));
app.use('/api/admin/products', require('./routes/productsImportExport'));
app.use('/api/admin/customers', require('./routes/customers'));
app.use('/api/admin/system', require('./routes/systemReset'));
app.use('/api/customer', require('./routes/customerProfile'));
app.use('/api/admin/backups', require('./routes/backups'));
app.use('/api/admin/2fa', require('./routes/twoFactor'));

// Mobile API v1 routes (for Android/iOS apps)
app.use('/api/v1/auth/mobile', require('./routes/mobileAuth'));
app.use('/api/v1/auth/customer', require('./routes/mobileCustomerAuth'));
app.use('/api/v1/products', require('./routes/mobileProducts'));
app.use('/api/v1/cart', require('./routes/mobileCart'));
app.use('/api/v1/orders', require('./routes/mobileOrders'));
app.use('/api/v1/wishlist', require('./routes/mobileWishlist'));
// AI Assistant routes
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin/ai', require('./routes/adminAI'));
app.use('/api/v1/user', require('./routes/mobileUser'));
app.use('/api/v1/images', require('./routes/mobileImages'));
app.use('/api/v1/notifications', require('./routes/mobileNotifications'));
app.use('/api/v1/webhooks', require('./routes/webhooks'));
app.use('/api/v1/worker', require('./routes/worker'));

// Announcements routes
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/admin/announcements', require('./routes/announcements'));

// Hero slides routes
app.use('/api/hero-slides', require('./routes/heroSlides'));
app.use('/api/admin/hero-slides', require('./routes/heroSlides'));

// Welcome slides routes
app.use('/api/welcome-slides', require('./routes/welcomeSlides'));

// Customer auth routes (Google OAuth + order history)
const { router: authRouter } = require('./routes/auth');
app.use('/auth', authRouter);
app.use('/api/wishlist', require('./routes/wishlist'));

// --------------- SPA Fallback ---------------
// Serve index.html for all non-API, non-static routes (must be after all API routes)
if (isProduction && require("fs").existsSync(clientDist)) {
  const indexPath = path.join(clientDist, 'index.html');
  app.get('*', (req, res, next) => {
    // Skip API routes, auth routes, webhook, etc.
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') ||
        req.path.startsWith('/images/') || req.path.startsWith('/create-checkout-session') ||
        req.path === '/webhook') {
      return next();
    }
    res.sendFile(indexPath);
  });
}

// --------------- Error Handler ---------------
app.use((err, req, res, next) => {
  // Log all errors
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err.message);
  if (!isProduction) {
    console.error(err.stack);
  }

  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// --------------- Start Server ---------------
// Wait for database initialization, then start
db.initPromise.then(() => {
  // Initialize backup service (creates initial backup + schedules daily backups at 2 AM)
  const backupService = require('./services/backupService');
  backupService.initialize();

  // Scheduled report generation (daily / weekly / monthly, settings-driven)
  const reportService = require('./services/reportService');
  // Auto-approval sweep for the quadruple confirmation engine
  const orderWorkflowService = require('./services/orderWorkflowService');
  setInterval(() => {
    try {
      reportService.generateScheduledReports();
    } catch (err) {
      console.error('[scheduler] report error:', err.message);
    }
    try {
      orderWorkflowService.checkAutoApprovals();
    } catch (err) {
      console.error('[scheduler] auto-approval error:', err.message);
    }
  }, 60 * 1000); // check every minute

  app.listen(PORT, () => {
    console.log(`🛒  Store backend running at http://localhost:${PORT}`);
    console.log(`🔍  Health check: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// VIP invitation routes (must be mounted BEFORE module.exports — was dead code)
app.use('/api/admin/vip', require('./routes/vipInvitations'));
app.use('/api/admin/recommendations', require('./routes/recommendations'));

module.exports = app;
