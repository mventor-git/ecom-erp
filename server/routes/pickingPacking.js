const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const pickingPackingService = require('../services/pickingPackingService');

// ── Picking ──

// GET /api/admin/picking/tasks?status=&assignee_id=
router.get('/picking/tasks', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const tasks = pickingPackingService.listPickingTasks({
      status: req.query.status || undefined,
      assigneeId: req.query.assignee_id ? parseInt(req.query.assignee_id) : undefined,
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/picking/tasks/:id/assign - { assignee_id } (PICK-B14/14.6B)
router.post('/picking/tasks/:id/assign', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { assignee_id } = req.body || {};
    const task = db.prepare('SELECT * FROM picking_tasks WHERE id = ?').get(parseInt(req.params.id));
    if (!task) return res.status(404).json({ error: 'Picking task not found' });
    db.prepare('UPDATE picking_tasks SET assignee_id = ? WHERE id = ?').run(assignee_id ? parseInt(assignee_id) : null, parseInt(req.params.id));
    res.json({ ...task, assignee_id: assignee_id ? parseInt(assignee_id) : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/picking/tasks/:id/status - { status: pending|in_progress|picked, notes }
router.post('/picking/tasks/:id/status', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const task = pickingPackingService.updatePickingStatus(parseInt(req.params.id), status, {
      userId: req.session.username || req.user?.email || 'admin',
      notes: notes || '',
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Packing ──

// GET /api/admin/packing/tasks?status=&assignee_id=&mine=1
router.get('/packing/tasks', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const mine = req.query.mine === '1' ? (req.user?.id || null) : false;
    const tasks = pickingPackingService.listPackingTasks({
      status: req.query.status || undefined,
      assigneeId: req.query.assignee_id ? parseInt(req.query.assignee_id) : undefined,
      mine,
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/packing/tasks/:id/assign - { assignee_id }
router.post('/packing/tasks/:id/assign', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { assignee_id } = req.body || {};
    const task = pickingPackingService.assignPackingTask(parseInt(req.params.id), assignee_id ? parseInt(assignee_id) : null, {
      userId: req.session.username || 'admin',
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/packing/tasks/:id/status - { status, notes }
router.post('/packing/tasks/:id/status', adminAuth, requirePermission('inventory.packing'), (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const task = pickingPackingService.updatePackingStatus(parseInt(req.params.id), status, {
      userId: req.session.username || req.user?.email || 'packer',
      notes: notes || '',
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/packing/stats - counts per status for the dashboard
router.get('/packing/stats', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const rows = db.prepare('SELECT status, COUNT(*) as count FROM packing_tasks GROUP BY status').all();
    const stats = { pending: 0, in_progress: 0, packed: 0, problem: 0, completed: 0 };
    rows.forEach(r => { stats[r.status] = r.count; });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
