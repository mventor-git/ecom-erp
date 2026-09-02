const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const documentNumberService = require('../services/documentNumberService');

router.get('/', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const sequences = documentNumberService.getAll();
    res.json(sequences);
  } catch (err) {
    console.error('Error fetching document sequences:', err);
    res.status(500).json({ error: 'Failed to fetch document sequences' });
  }
});

router.get('/types', adminAuth, requirePermission('settings.read'), (req, res) => {
  res.json(documentNumberService.VALID_DOC_TYPES);
});

router.get('/:docType', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const { docType } = req.params;
    const current = documentNumberService.getCurrent(docType.toUpperCase());
    res.json(current);
  } catch (err) {
    console.error('Error fetching document sequence:', err);
    res.status(err.message.includes('Invalid') || err.message.includes('No sequence') ? 400 : 500).json({ error: err.message });
  }
});

router.post('/:docType/generate', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { docType } = req.params;
    const result = documentNumberService.generate(docType.toUpperCase());
    res.status(201).json(result);
  } catch (err) {
    console.error('Error generating document number:', err);
    res.status(err.message.includes('Invalid') || err.message.includes('No sequence') ? 400 : 500).json({ error: err.message });
  }
});

router.post('/:docType/reset', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { docType } = req.params;
    const result = documentNumberService.reset(docType.toUpperCase());
    res.json(result);
  } catch (err) {
    console.error('Error resetting document sequence:', err);
    res.status(err.message.includes('Invalid') || err.message.includes('No sequence') ? 400 : 500).json({ error: err.message });
  }
});

router.put('/:docType/configure', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { docType } = req.params;
    const result = documentNumberService.configure(docType.toUpperCase(), req.body);
    res.json(result);
  } catch (err) {
    console.error('Error configuring document sequence:', err);
    res.status(err.message.includes('Invalid') || err.message.includes('No valid') || err.message.includes('No sequence') || err.message.includes('Padding') ? 400 : 500).json({ error: err.message });
  }
});

module.exports = router;
