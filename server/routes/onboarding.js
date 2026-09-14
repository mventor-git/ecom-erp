/**
 * Onboarding import routes (mventor-ticket-095) â€” thin HTTP over
 * onboardingImport. Files are streamed via multer memory storage; ALL
 * parsing/validation/duplication/business semantics live in the service.
 * RBAC is resolved PER TYPE from the spec (never the caller's choice).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const permissionService = require('../services/permissionService');
const onboarding = require('../services/onboardingImport');
const eventService = require('../services/eventService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Permission for a type comes from ITS spec â€” adding a type cannot smuggle
// in a weaker guard.
function guardFor(type) {
  const spec = onboarding.specFor(type);
  if (!spec) return null;
  return spec.permission;
}

function actor(req) {
  return req.session?.username || req.user?.email || String(req.session?.userId ?? 'admin');
}

// Archive every submitted file (audit of what the operator loaded)
const IMPORT_ARCHIVE_DIR = path.join(__dirname, '..', 'data', 'imports');
function archiveFile(req, phase) {
  try {
    fs.mkdirSync(IMPORT_ARCHIVE_DIR, { recursive: true });
    const safeName = String(req.file.originalname || 'import').replace(/[^A-Za-z0-9._-]/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(IMPORT_ARCHIVE_DIR, `${stamp}-${phase}-${safeName}`), req.file.buffer);
    return `data/imports/${stamp}-${phase}-${safeName}`;
  } catch (e) {
    console.error('onboarding archive failed:', e.message);
    return null;
  }
}

// GET /api/admin/onboarding/types -> available datasets + required permission
router.get('/types', adminAuth, (req, res) => {
  try {
    res.json({ success: true, data: onboarding.TYPES.map((t) => ({ type: t, ...onboarding.specFor(t) })) });
  } catch (err) { res.status(500).json({ error: 'Failed to list import types' }); }
});

// GET /api/admin/onboarding/template?type=products -> column header line
router.get('/template', adminAuth, (req, res) => {
  try {
    const type = String(req.query.type || '');
    const permission = guardFor(type);
    if (!permission) return res.status(400).json({ error: `Unknown import type "${type}"` });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="onboarding-${type}-template.csv"`);
    res.send(onboarding.template(type));
  } catch (err) { res.status(500).json({ error: 'Template failed' }); }
});

// Shared: resolve + permission-check a multipart type request
function accepted(req, res) {
  const type = String(req.body.type || '');
  const permission = guardFor(type);
  if (!permission) { res.status(400).json({ error: `Unknown import type "${type || '(missing)'}" â€” supported: ${onboarding.TYPES.join(', ')}` }); return null; }
if (req.session && req.session.isAdmin && !req.session.userId) return { type }; // env-admin bootstrap
  const uid = req.session?.userId ?? req.user?.id;
  if (uid == null) { res.status(401).json({ error: 'Authentication required' }); return null; }
  if (!permissionService.hasPermission(uid, permission) && !permissionService.userPermissions(uid).includes('*')) {
    res.status(403).json({ error: 'Insufficient permissions', required: permission });
    return null;
  }
  return { type };
}

// POST /api/admin/onboarding/preview  (multipart: type + file)  -> plan, ZERO writes
router.post('/preview', adminAuth, upload.single('file'), (req, res) => {
  const ok = accepted(req, res);
  if (!ok) return;
  if (!req.file) return res.status(400).json({ error: 'Upload a CSV or XLSX file with a data row' });
  try {
    const allowNew = ['1', 'true', 'yes'].includes(String(req.body.allow_new_categories ?? '1').toLowerCase());
    const plan = onboarding.preview({ type: ok.type, buffer: req.file.buffer, filename: req.file.originalname, opts: { allow_new_categories: allowNew } });
    res.json({ success: true, data: plan });
  } catch (err) {
    const msg = String(err && err.message || err);
    const status = /row|File|sheet|Too many|Unknown|exceeds|required|valid|must|duplicate|does not exist/i.test(msg) ? 400 : 500;
    if (status === 500) console.error('onboarding preview error:', msg);
    res.status(status).json({ error: msg });
  }
});

// POST /api/admin/onboarding/commit  (multipart: type + file)  -> ALL-or-NOTHING transaction
router.post('/commit', adminAuth, upload.single('file'), async (req, res) => {
  const ok = accepted(req, res);
  if (!ok) return;
  if (!req.file) return res.status(400).json({ error: 'Upload a CSV or XLSX file with a data row' });
  try {
    const allowNew = ['1', 'true', 'yes'].includes(String(req.body.allow_new_categories ?? '1').toLowerCase());
    const outcome = onboarding.commit({ type: ok.type, buffer: req.file.buffer, filename: req.file.originalname, opts: { allow_new_categories: allowNew }, userId: actor(req) });
    const saved_path = archiveFile(req, 'commit');
    let images_landed = 0;
    if (ok.type === 'products' && outcome._image_jobs && outcome._image_jobs.length) {
      try { images_landed = await onboarding.landImages(outcome); } catch { /* never fails the commit */ }
    }
    try { require('../cache').invalidatePrefix('products:'); } catch {}
    res.json({ success: true, data: { ...outcome, images_landed, saved_path } });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/commit aborted|invalid row|i?nvalid|required|must|duplicate|Unknown|exceeds|does not exist|max/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    console.error('onboarding commit error:', msg);
    res.status(500).json({ error: 'Import failed â€” nothing was written' });
  }
});

module.exports = router;


