/**
 * AI Service - Ollama Integration
 * Provides AI-powered product assistance with database context
 * Optimized for: AMD Ryzen 5 2600, 16GB RAM, GTX 1060 3GB
 */

const db = require('../db');
const config = require('../config/ollama.config');
const settingsService = require('./settingsService');

// Use configuration (settings override, config file as fallback)
const OLLAMA_BASE_URL = config.baseUrl;
const OLLAMA_MODEL = config.model;
const MODEL_CONFIG = config.options;

/**
 * Live AI configuration — read from settings (mventor-ticket-038) with fallbacks,
 * so the admin can change the AI endpoint/model/key from the admin panel
 * at any time without a restart.
 */
function getAIConfig() {
  return {
    provider: settingsService.get('ai_provider') || 'ollama',
    baseUrl: settingsService.get('ai_base_url') || OLLAMA_BASE_URL,
    model: settingsService.get('ai_model') || OLLAMA_MODEL,
    apiKey: settingsService.get('ai_api_key') || process.env.AI_API_KEY || '',
    timeout: parseInt(settingsService.get('ai_timeout') || process.env.AI_TIMEOUT || '15000', 10),
  };
}

/**
 * Extract product IDs from user message
 * Matches patterns like: "product 123", "item #456", "product ID 789", "#123"
 */
function extractProductIds(message) {
  const patterns = [
    /product\s*(?:id|#)?\s*(\d+)/gi,
    /item\s*(?:id|#)?\s*(\d+)/gi,
    /#(\d+)/g,
    /\b(\d{2,4})\b/g, // Standalone numbers (2-4 digits)
  ];
  
  const ids = new Set();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const id = parseInt(match[1]);
      if (id > 0 && id < 10000) { // Reasonable product ID range
        ids.add(id);
      }
    }
  }
  
  return Array.from(ids);
}

/**
 * Search products by IDs and keywords
 */
function searchProducts(query, productIds = []) {
  const results = [];
  
  // Search by product IDs first
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',');
    const productsById = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        c.name as category_name,
        b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id IN (${placeholders}) AND p.active = 1
    `).all(...productIds);
    
    results.push(...productsById);
  }
  
  // Search by keywords
  if (query && query.trim()) {
    const searchQuery = `%${query.trim()}%`;
    const productsByKeyword = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        c.name as category_name,
        b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.active = 1 
        AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ? OR b.name LIKE ?)
      LIMIT 10
    `).all(searchQuery, searchQuery, searchQuery, searchQuery);
    
    // Add only products not already in results
    for (const product of productsByKeyword) {
      if (!results.find(r => r.id === product.id)) {
        results.push(product);
      }
    }
  }
  
  return results.slice(0, 10); // Limit to 10 products
}

/**
 * Get product context from database
 */
function getProductContext(query) {
  try {
    // Extract product IDs from query
    const productIds = extractProductIds(query);
    
    // Search for products
    const products = searchProducts(query, productIds);

    if (products.length === 0) {
      return 'No specific products found. You can help the user browse categories or search for different terms.';
    }

    // Format product context with links
    const productInfo = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: `${(p.price / 100).toFixed(2)} ج.م`,
      stock: p.stock,
      category: p.category_name,
      brand: p.brand_name,
      inStock: p.stock > 0,
      link: `/products/${p.id}`,
      image: p.image_url,
    }));

    return `Available products matching the query:
${JSON.stringify(productInfo, null, 2)}

IMPORTANT: When recommending products, include the direct link in this format:
"Check out [Product Name](/products/ID)"

Use this information to help the user. Reference specific products by name and provide their prices in EGP (ج.م).`;
  } catch (error) {
    console.error('Error getting product context:', error);
    return 'Unable to retrieve product information at this time.';
  }
}

/**
 * Get category context
 */
function getCategoryContext() {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.active = 1
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    return `Store categories:
${categories.map(c => `- ${c.name} (${c.product_count} products)`).join('\n')}

Help users navigate to the right category based on their needs.`;
  } catch (error) {
    console.error('Error getting category context:', error);
    return '';
  }
}

/**
 * Get store policies context
 */
function getStorePolicies() {
  return `Store Policies:
- Free shipping on orders over 500 ج.م
- 30-day return policy (items must be in original condition)
- Standard delivery: 2-3 business days
- All prices in Egyptian Pounds (ج.م)
- Secure payment processing
- 24/7 customer support

When users ask about shipping, returns, or policies, use this information.`;
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(userQuery) {
  const productContext = getProductContext(userQuery);
  const categoryContext = getCategoryContext();
  const policiesContext = getStorePolicies();

  return `You are a helpful AI assistant for ${settingsService.siteIdentity().name} � ${settingsService.get('store_description','an online store')}.

Your role:
- Help customers find products
- Answer questions about products, prices, and availability
- Provide information about shipping, returns, and store policies
- Guide users to relevant product categories
- Be friendly, professional, and concise

${policiesContext}

${categoryContext}

${productContext}

IMPORTANT INSTRUCTIONS:
1. When recommending products, ALWAYS use markdown links in this exact format:
   "Check out [Product Name](/products/ID)"
   
   Example: "I recommend the [Professional Yoga Mat](/products/1) for your needs."

2. You can recommend multiple products:
   "Here are some options:
   - [Product 1](/products/1) - 450.00 ج.م
   - [Product 2](/products/2) - 350.00 ج.م"

3. Always respond in the same language as the user (Arabic or English)
4. Keep responses concise (2-3 sentences max)
5. Provide specific product recommendations when possible
6. Include prices in ج.م format
7. If a product is out of stock, suggest alternatives
8. End responses with helpful action suggestions when appropriate`;
}

/**
 * Chat with AI (Ollama or OpenAI-compatible API)
 */
async function chat(userMessage, conversationHistory = []) {
  try {
    const systemPrompt = buildSystemPrompt(userMessage);
    const aiConfig = getAIConfig();
    const isOpenAI = aiConfig.provider === 'openai';

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage },
    ];

    // Get timeout from config or use default
    const timeout = aiConfig.timeout;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      let response;

      if (isOpenAI) {
        // OpenAI-compatible chat completions API
        response = await fetch(`${aiConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(aiConfig.apiKey ? { 'Authorization': `Bearer ${aiConfig.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: aiConfig.model,
            messages,
            temperature: MODEL_CONFIG.temperature,
            max_tokens: MODEL_CONFIG.num_predict,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`AI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content ||
          'I apologize, but I could not generate a response at this time.';
        return aiResponse;
      }

      // Ollama chat API
      response = await fetch(`${aiConfig.baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: messages,
          stream: false, // Use non-streaming for simpler handling
          options: MODEL_CONFIG,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract the response message
      const aiResponse = data.message?.content || 'I apologize, but I could not generate a response at this time.';
      
      return aiResponse;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('AI response timeout - please try again');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in AI chat:', error);
    throw error;
  }
}

/**
 * Parse AI response to extract product mentions
 */
function parseProductMentions(response) {
  const mentions = [];
  const linkPattern = /\[([^\]]+)\]\(\/products\/(\d+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(response)) !== null) {
    mentions.push({
      name: match[1],
      id: parseInt(match[2]),
      link: `/products/${match[2]}`
    });
  }
  
  return mentions;
}

/**
 * Generate navigation actions based on AI response
 */
function generateActions(response, userQuery) {
  const actions = [];
  const lowerResponse = response.toLowerCase();
  const lowerQuery = userQuery.toLowerCase();

  // Extract product links from response
  const linkPattern = /\[([^\]]+)\]\(\/products\/(\d+)\)/g;
  let match;
  while ((match = linkPattern.exec(response)) !== null) {
    const productName = match[1];
    const productId = match[2];
    actions.push({ 
      label: `View ${productName}`, 
      path: `/products/${productId}`,
      type: 'product'
    });
  }

  // Product-related actions (if no specific product links found)
  if (actions.length === 0 && (lowerResponse.includes('product') || lowerQuery.includes('product'))) {
    actions.push({ label: 'Browse Products', path: '/products' });
  }

  // Category-specific actions
  const categoryKeywords = {
    'yoga': '/products?category=exercise-fitness',
    'fitness': '/products?category=exercise-fitness',
    'exercise': '/products?category=exercise-fitness',
    'knee': '/products?category=orthopedic-support',
    'brace': '/products?category=orthopedic-support',
    'support': '/products?category=orthopedic-support',
    'insole': '/products?category=insoles-foot-care',
    'foot': '/products?category=insoles-foot-care',
    'massage': '/products?category=massage-therapy',
    'therapy': '/products?category=massage-therapy',
    'mobility': '/products?category=mobility-rehabilitation',
    'rehabilitation': '/products?category=mobility-rehabilitation',
  };

  for (const [keyword, path] of Object.entries(categoryKeywords)) {
    if (lowerResponse.includes(keyword) || lowerQuery.includes(keyword)) {
      const categoryName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      actions.push({ label: `View ${categoryName} Products`, path });
      break;
    }
  }

  // Cart/checkout actions
  if (lowerResponse.includes('cart') || lowerResponse.includes('checkout') || lowerQuery.includes('cart')) {
    actions.push({ label: 'Go to Cart', path: '/cart' });
  }

  // Account actions
  if (lowerResponse.includes('account') || lowerResponse.includes('order') || lowerQuery.includes('account')) {
    actions.push({ label: 'My Account', path: '/account' });
  }

  // Default actions if none matched
  if (actions.length === 0) {
    actions.push(
      { label: 'Browse Products', path: '/products' },
      { label: 'View Categories', path: '/products' }
    );
  }

  return actions.slice(0, 5); // Max 5 actions
}

module.exports = {
  chat,
  generateActions,
  parseProductMentions,
  extractProductIds,
  searchProducts,
  OLLAMA_MODEL,
  MODEL_CONFIG,
};
