const settingsService = require('../services/settingsService');
/**
 * AI Management Routes
 * Admin endpoints for AI configuration and model management
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config/ollama.config');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');

const OLLAMA_BASE_URL = config.baseUrl;

/**
 * GET /api/admin/ai/models
 * Get list of available Ollama models
 */
router.get('/models', adminAuth, requirePermission('settings.read'), async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await response.json();
    
    // Get current selected model
    const currentModel = db.prepare('SELECT value FROM ai_config WHERE key = ?').get('selected_model');
    
    res.json({
      success: true,
      data: {
        models: data.models || [],
        currentModel: currentModel ? currentModel.value : config.model,
      },
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/ai/models/select
 * Select which model to use
 */
router.post('/models/select', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required',
      });
    }

    // Update or insert selected model
    const existing = db.prepare('SELECT id FROM ai_config WHERE key = ?').get('selected_model');
    
    if (existing) {
      db.prepare('UPDATE ai_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
        .run(model, 'selected_model');
    } else {
      db.prepare('INSERT INTO ai_config (key, value) VALUES (?, ?)')
        .run('selected_model', model);
    }

    res.json({
      success: true,
      message: `Model changed to ${model}`,
      data: { model },
    });
  } catch (error) {
    console.error('Error selecting model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to select model',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/ai/settings
 * Get AI personality and configuration settings
 */
router.get('/settings', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM ai_config').all();
    const settingsMap = {};
    
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    // Return with defaults if not set
    res.json({
      success: true,
      data: {
        model: settingsMap.selected_model || config.model,
        personality: settingsMap.ai_personality || getDefaultPersonality(),
        temperature: parseFloat(settingsMap.ai_temperature || '0.3'),
        maxTokens: parseInt(settingsMap.ai_max_tokens || '150'),
        timeout: parseInt(settingsMap.ai_timeout || '15000'),
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/ai/settings
 * Update AI personality and configuration settings
 */
router.put('/settings', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { personality, temperature, maxTokens, timeout } = req.body;

    const updates = [];

    if (personality !== undefined) {
      updates.push({ key: 'ai_personality', value: personality });
    }
    if (temperature !== undefined) {
      updates.push({ key: 'ai_temperature', value: String(temperature) });
    }
    if (maxTokens !== undefined) {
      updates.push({ key: 'ai_max_tokens', value: String(maxTokens) });
    }
    if (timeout !== undefined) {
      updates.push({ key: 'ai_timeout', value: String(timeout) });
    }

    // Update or insert each setting
    for (const update of updates) {
      const existing = db.prepare('SELECT id FROM ai_config WHERE key = ?').get(update.key);
      
      if (existing) {
        db.prepare('UPDATE ai_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
          .run(update.value, update.key);
      } else {
        db.prepare('INSERT INTO ai_config (key, value) VALUES (?, ?)')
          .run(update.key, update.value);
      }
    }

    res.json({
      success: true,
      message: 'AI settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/ai/stats
 * Get AI usage statistics
 */
router.get('/stats', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const totalConversations = db.prepare('SELECT COUNT(*) as count FROM ai_conversations').get();
    const avgResponseTime = db.prepare('SELECT AVG(response_time_ms) as avg FROM ai_conversations').get();
    const recentConversations = db.prepare(
      'SELECT * FROM ai_conversations ORDER BY created_at DESC LIMIT 10'
    ).all();

    res.json({
      success: true,
      data: {
        totalConversations: totalConversations.count,
        avgResponseTime: Math.round(avgResponseTime.avg || 0),
        recentConversations,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message,
    });
  }
});

/**
 * Helper: Get default personality — fully config-driven (mventor-ticket-056).
 * The store's niche/description comes from settings, never from code.
 */
function getDefaultPersonality() {
  const identity = settingsService.siteIdentity();
  const description = settingsService.get('store_description', '')
    || 'an online store';
  return `You are the AI assistant for ${identity.name} — ${description}.

YOUR SOUL:
- You are warm, knowledgeable, and genuinely helpful
- You know this store's catalog deeply and speak confidently about it
- You understand Egyptian culture and communicate in both Arabic and English
- You prioritize customer satisfaction over sales

YOUR VISION:
- Help every customer find the perfect product for their needs
- Educate customers about proper product usage and benefits
- Build trust through honest, accurate information

YOUR CONSTITUTION:
1. Always prioritize customer safety and satisfaction
2. Provide accurate product information and specifications
3. Be honest about product limitations and alternatives
4. Respect customer privacy and data
5. Respond quickly and efficiently
6. Use simple, clear language
7. Include prices in ج.م format
8. Suggest related products when relevant

COMMUNICATION STYLE:
- Friendly but professional
- Concise (2-3 sentences max for most responses)
- Always end with helpful next steps

When unsure, admit it and suggest contacting human support.`;
}

module.exports = router;
