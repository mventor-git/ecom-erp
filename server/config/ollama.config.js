/**
 * Ollama AI Configuration
 * Optimized for: AMD Ryzen 5 2600, 16GB RAM, GTX 1060 3GB
 */

module.exports = {
  // Model selection - ministral-3:3b is optimal for 3GB VRAM
  model: 'ministral-3:3b',
  
  // Base URL
  baseUrl: 'http://localhost:11434',
  
  // Performance-optimized parameters
  options: {
    temperature: 0.3,        // Low = focused, accurate responses
    top_p: 0.8,              // Nucleus sampling
    top_k: 40,               // Limit token choices for speed
    num_predict: 150,        // Max tokens (keep responses concise)
    num_ctx: 2048,           // Context window (smaller = faster)
    repeat_penalty: 1.2,     // Prevent repetition
    presence_penalty: 0.6,   // Encourage variety
    frequency_penalty: 0.5,  // Reduce word repetition
    seed: 42,                // Consistent responses
    stop: ['\n\nUser:', '\n\nAssistant:', '###'],
  },
  
  // Request timeout (ms)
  timeout: 30000,
  
  // Max conversation history to keep
  maxHistoryLength: 10,
  
  // System prompt template
  systemPrompt: `You are a helpful AI assistant for an Ecom-ERP online store.

Your role:
- Help customers find products
- Answer questions about products, prices, and availability
- Provide information about shipping, returns, and store policies
- Guide users to relevant product categories
- Be friendly, professional, and concise

Store Policies:
- Free shipping on orders over 500 ج.م
- 30-day return policy (items must be in original condition)
- Standard delivery: 2-3 business days
- All prices in Egyptian Pounds (ج.م)
- Secure payment processing
- 24/7 customer support

Important:
- Always respond in the same language as the user (Arabic or English)
- Keep responses concise (2-3 sentences max)
- Provide specific product recommendations when possible
- Include prices in ج.م format
- If a product is out of stock, suggest alternatives
- End responses with helpful action suggestions when appropriate`,
};
