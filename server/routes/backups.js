/**
 * Backup Management Routes (Admin Only)
 *
 * Endpoints for database backup management:
 * - GET    /api/admin/backups         - List all backups
 * - POST   /api/admin/backups         - Create manual backup
 * - POST   /api/admin/backups/restore - Restore from backup
 * - DELETE /api/admin/backups/clean   - Clean old backups
 *
 * Created: 2026-08-24 (mventor critical security improvements)
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission: checkPermission } = require('../middleware/rbac');
const backupService = require('../services/backupService');

/**
 * GET /api/admin/backups
 * List all available backups
 */
router.get('/', adminAuth, checkPermission('settings.manage'), (req, res) => {
  try {
    const backups = backupService.listBackups();

    res.json({
      backups,
      retentionDays: backupService.RETENTION_DAYS,
      backupDir: backupService.BACKUP_DIR
    });
  } catch (err) {
    console.error('[backups] Failed to list backups:', err.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * POST /api/admin/backups
 * Create a manual backup
 */
router.post('/', adminAuth, checkPermission('settings.manage'), async (req, res) => {
  try {
    const backupPath = await backupService.createBackup();

    res.json({
      message: 'Backup created successfully',
      filename: require('path').basename(backupPath),
      path: backupPath
    });
  } catch (err) {
    console.error('[backups] Failed to create backup:', err.message);
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

/**
 * POST /api/admin/backups/restore
 * Restore database from a backup
 * Body: { filename: 'db-2026-08-24-020000.sqlite' }
 */
router.post('/restore', adminAuth, checkPermission('settings.manage'), async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Backup filename is required' });
  }

  try {
    await backupService.restoreBackup(filename);

    res.json({
      message: 'Database restored successfully',
      filename,
      warning: 'Server restart recommended to reload database in memory'
    });
  } catch (err) {
    console.error('[backups] Failed to restore backup:', err.message);
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

/**
 * DELETE /api/admin/backups/clean
 * Clean old backups (keeps last 30 days)
 */
router.delete('/clean', adminAuth, checkPermission('settings.manage'), (req, res) => {
  try {
    backupService.cleanOldBackups();

    const remaining = backupService.listBackups();

    res.json({
      message: 'Old backups cleaned successfully',
      remainingBackups: remaining.length
    });
  } catch (err) {
    console.error('[backups] Failed to clean backups:', err.message);
    res.status(500).json({ error: 'Failed to clean backups: ' + err.message });
  }
});

module.exports = router;
