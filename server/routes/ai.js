/**
 * AI Chat Routes
 * Provides AI-powered product assistance
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const config = require('../config/ollama.config');

const OLLAMA_BASE_URL = config.baseUrl;
const OLLAMA_MODEL = config.model;

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Get AI response
    const response = await aiService.chat(message, history);

    // Parse product mentions from response
    const productMentions = aiService.parseProductMentions(response);

    // Generate navigation actions
    const actions = aiService.generateActions(response, message);

    res.json({
      success: true,
      data: {
        message: response,
        actions: actions,
        products: productMentions,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    
    // Handle timeout errors
    if (error.message.includes('timeout')) {
      return res.status(504).json({
        success: false,
        error: 'AI response timeout',
        message: 'The AI took too long to respond. Please try again.',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to get AI response',
      message: error.message,
    });
  }
});

/**
 * GET /api/ai/models
 * List available Ollama models
 */
router.get('/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await response.json();
    
    res.json({
      success: true,
      data: data.models || [],
      currentModel: OLLAMA_MODEL,
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

module.exports = router;
