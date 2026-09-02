/**
 * Database Backup Service
 *
 * Automated backup system for SQLite database with:
 * - Daily scheduled backups
 * - Timestamp-based naming
 * - Retention policy (keeps last 30 days)
 * - Manual backup trigger
 * - Backup verification
 *
 * Created: 2026-08-24 (mventor critical security improvements)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const DB_PATH = path.join(__dirname, '..', 'data', 'store.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 30; // Keep backups for 30 days

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('[backup] Created backup directory:', BACKUP_DIR);
  }
}

/**
 * Generate timestamped backup filename
 * Format: db-YYYY-MM-DD-HHmmss.sqlite
 */
function getBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `db-${year}-${month}-${day}-${hours}${minutes}${seconds}.sqlite`;
}

/**
 * Create database backup
 * @returns {Promise<string>} Path to backup file
 */
async function createBackup() {
  ensureBackupDir();

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database file not found: ${DB_PATH}`);
  }

  const backupFilename = getBackupFilename();
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  try {
    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);

    // Verify backup was created and has content
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }

    const sizeKB = Math.round(stats.size / 1024);
    console.log(`[backup] ✅ Created backup: ${backupFilename} (${sizeKB} KB)`);

    // Log backup event
    const eventService = require('./eventService');
    eventService.logEvent('BACKUP_CREATED', null, 'system', {
      filename: backupFilename,
      size: stats.size,
      path: backupPath
    });

    return backupPath;
  } catch (err) {
    console.error('[backup] ❌ Failed to create backup:', err.message);

    // Log backup failure
    const eventService = require('./eventService');
    eventService.logEvent('BACKUP_FAILED', null, 'system', {
      error: err.message
    });

    throw err;
  }
}

/**
 * Clean up old backups (keep only last RETENTION_DAYS)
 */
function cleanOldBackups() {
  ensureBackupDir();

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('db-') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Keep only last RETENTION_DAYS backups
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    let deletedCount = 0;
    backupFiles.forEach(file => {
      if (file.mtime < cutoffDate) {
        fs.unlinkSync(file.path);
        deletedCount++;
        console.log(`[backup] 🗑️  Deleted old backup: ${file.name}`);
      }
    });

    if (deletedCount > 0) {
      console.log(`[backup] Cleaned ${deletedCount} old backup(s)`);
    }
  } catch (err) {
    console.error('[backup] Failed to clean old backups:', err.message);
  }
}

/**
 * Get list of all backups
 * @returns {Array} Array of backup info objects
 */
function listBackups() {
  ensureBackupDir();

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('db-') && f.endsWith('.sqlite'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          path: filePath,
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024),
          created: stats.mtime,
          age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)) // days
        };
      })
      .sort((a, b) => b.created - a.created); // newest first

    return backupFiles;
  } catch (err) {
    console.error('[backup] Failed to list backups:', err.message);
    return [];
  }
}

/**
 * Restore database from backup
 * @param {string} backupFilename - Name of backup file to restore
 * @returns {Promise<boolean>} Success status
 */
async function restoreBackup(backupFilename) {
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // Verify backup file exists
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupFilename}`);
  }

  try {
    // Create a backup of current database before restoring
    const currentBackup = await createBackup();
    console.log(`[backup] Created safety backup before restore: ${path.basename(currentBackup)}`);

    // Copy backup file to database location
    fs.copyFileSync(backupPath, DB_PATH);

    console.log(`[backup] ✅ Restored database from: ${backupFilename}`);

    // Log restore event
    const eventService = require('./eventService');
    eventService.logEvent('BACKUP_RESTORED', null, 'system', {
      filename: backupFilename,
      safetyBackup: path.basename(currentBackup)
    });

    return true;
  } catch (err) {
    console.error('[backup] ❌ Failed to restore backup:', err.message);

    // Log restore failure
    const eventService = require('./eventService');
    eventService.logEvent('BACKUP_RESTORE_FAILED', null, 'system', {
      filename: backupFilename,
      error: err.message
    });

    throw err;
  }
}

/**
 * Schedule daily backups
 * Runs at 2:00 AM every day
 */
function scheduleDailyBackup() {
  // Calculate milliseconds until next 2:00 AM
  function getNextBackupTime() {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0); // 2:00 AM

    // If we've passed 2 AM today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const msUntilNext = getNextBackupTime();
    const hours = Math.floor(msUntilNext / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));

    console.log(`[backup] Next backup scheduled in ${hours}h ${minutes}m`);

    setTimeout(async () => {
      try {
        await createBackup();
        cleanOldBackups();
      } catch (err) {
        console.error('[backup] Scheduled backup failed:', err.message);
      }

      // Schedule next backup
      scheduleNext();
    }, msUntilNext);
  }

  scheduleNext();
  console.log('[backup] Daily backup scheduler initialized (runs at 2:00 AM)');
}

/**
 * Initialize backup service on server startup
 */
function initialize() {
  ensureBackupDir();
  scheduleDailyBackup();

  // Create initial backup on startup
  createBackup()
    .then(() => {
      console.log('[backup] Initial backup completed');
      cleanOldBackups();
    })
    .catch(err => {
      console.error('[backup] Initial backup failed:', err.message);
    });
}

module.exports = {
  createBackup,
  cleanOldBackups,
  listBackups,
  restoreBackup,
  initialize,
  BACKUP_DIR,
  RETENTION_DAYS
};
