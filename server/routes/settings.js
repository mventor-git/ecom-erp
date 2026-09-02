const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const settingsService = require('../services/settingsService');

router.get('/public', (req, res) => {
  try {
    res.json(settingsService.getPublic());
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      return res.json(settingsService.getByCategory(category));
    }
    res.json(settingsService.getAll());
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/:key', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const value = settingsService.get(req.params.key);
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: req.params.key, value });
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

router.put('/:key', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    const userId = req.session.userId || req.session.username || 'admin';
    const updated = settingsService.set(req.params.key, value, userId);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error updating setting:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

router.post('/batch', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'settings array is required' });
    }
    const userId = req.session.userId || req.session.username || 'admin';
    const results = [];
    settings.forEach(({ key, value }) => {
      try {
        const updated = settingsService.set(key, value, userId);
        results.push(updated);
      } catch (err) {
        results.push({ key, error: err.message });
      }
    });
    res.json(results);
  } catch (err) {
    console.error('Error batch updating settings:', err);
    res.status(500).json({ error: 'Failed to batch update settings' });
  }
});

router.post('/invalidate-cache', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    settingsService.invalidateCache();
    res.json({ success: true, message: 'Cache invalidated' });
  } catch (err) {
    console.error('Error invalidating cache:', err);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

module.exports = router;
