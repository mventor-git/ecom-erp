import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../i18n';

/**
 * AIAssistant - AI chatbot component with file attachment support
 * 
 * Features:
 * - Chat interface with message history
 * - File attachment support (images, documents)
 * - Typing indicator
 * - Expandable/collapsible interface
 * - Page navigation from AI responses
 * - Future-ready for AI integration
 */

export default function AIAssistant() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: t('Hello! I\'m your AI assistant. How can I help you today?'),
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputText.trim() && attachments.length === 0) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputText,
      attachments: attachments,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setAttachments([]);
    setIsTyping(true);

    try {
      // Call AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          history: messages.slice(-10).map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(t('Failed to get AI response'));
      }

      const data = await response.json();

      if (data.success) {
        const botMessage = {
          id: messages.length + 2,
          type: 'bot',
          text: data.data.message,
          actions: data.data.actions || [],
          products: data.data.products || [],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error(data.error || t('Unknown error'));
      }
    } catch (error) {
      console.error('AI chat error:', error);
      
      // Fallback to placeholder response
      const aiResponse = getAIResponse(currentInput);
      const botMessage = {
        id: messages.length + 2,
        type: 'bot',
        text: aiResponse.text,
        actions: aiResponse.actions || [],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const getAIResponse = (userInput) => {
    // Placeholder responses with navigation actions - will be replaced with actual AI integration
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return {
        text: t('Hello! How can I assist you with your shopping today?'),
        actions: [
          { label: t('Browse Products'), path: '/products' },
          { label: t('View Categories'), path: '/products' }
        ]
      };
    } else if (lowerInput.includes('product') || lowerInput.includes('item')) {
      return {
        text: t('I can help you find the perfect product. What type of item are you looking for?'),
        actions: [
          { label: t('All Products'), path: '/products' },
          { label: t('Featured Items'), path: '/products?featured=true' }
        ]
      };
    } else if (lowerInput.includes('audio') || lowerInput.includes('speaker') || lowerInput.includes('headphone')) {
      return {
        text: t('We have great audio gear! Here are some options:'),
        actions: [
          { label: t('View Electronics'), path: '/products?search=speaker' },
          { label: t('Browse Categories'), path: '/products' }
        ]
      };
    } else if (lowerInput.includes('shirt') || lowerInput.includes('shoe') || lowerInput.includes('fashion')) {
      return {
        text: t('Fresh fashion picks just for you. Want to see them?'),
        actions: [
          { label: t('View Fashion'), path: '/products?search=shirt' },
          { label: t('Electronics'), path: '/products?category=electronics' }
        ]
      };
    } else if (lowerInput.includes('price') || lowerInput.includes('cost')) {
      return {
        text: t('Our products range from affordable to premium. Would you like me to show you products in a specific price range?'),
        actions: [
          { label: t('Budget Friendly'), path: '/products?max_price=30000' },
          { label: t('Premium Items'), path: '/products?min_price=50000' },
          { label: t('All Products'), path: '/products' }
        ]
      };
    } else if (lowerInput.includes('shipping') || lowerInput.includes('delivery')) {
      return {
        text: t(`We offer free shipping on orders over ${format(50000, 0)}. Standard delivery takes 2-3 business days.`),
        actions: [
          { label: t('Shop Now'), path: '/products' }
        ]
      };
    } else if (lowerInput.includes('return') || lowerInput.includes('refund')) {
      return {
        text: t('We have a 30-day return policy. Items must be in original condition with tags attached.'),
        actions: [
          { label: t('View Products'), path: '/products' }
        ]
      };
    } else if (lowerInput.includes('cart') || lowerInput.includes('checkout')) {
      return {
        text: t('Ready to checkout? Let me take you to your cart.'),
        actions: [
          { label: t('Go to Cart'), path: '/cart' }
        ]
      };
    } else if (lowerInput.includes('account') || lowerInput.includes('order')) {
      return {
        text: t('You can view your account and order history here.'),
        actions: [
          { label: t('My Account'), path: '/account' },
          { label: t('Order History'), path: '/account' }
        ]
      };
    } else {
      return {
        text: t('I\'m here to help! You can ask me about products, pricing, shipping, returns, or any other questions you have.'),
        actions: [
          { label: t('Browse Products'), path: '/products' },
          { label: t('View Cart'), path: '/cart' }
        ]
      };
    }
  };

  const handleActionClick = (path) => {
    navigate(path);
    setIsOpen(false); // Close chat after navigation
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Parse markdown links in text
  const parseMarkdownLinks = (text) => {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the link
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <button
          key={match.index}
          onClick={() => handleActionClick(linkUrl)}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline font-medium"
        >
          {linkText}
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <>
      {/* Floating Chat Button — translucent until hovered/focused, visible on every page */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 bg-primary-600/60 hover:bg-primary-600/90 focus:bg-primary-600/90 text-white rounded-full shadow-lg backdrop-blur-md border border-white/20 hover:shadow-glow transition-all hover:scale-110 z-50 flex items-center justify-center"
          aria-label={t('Open AI Assistant')}
        >
          <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:max-w-[calc(100vw-3rem)] sm:h-[600px] sm:max-h-[calc(100vh-6rem)] bg-white dark:bg-dark-800 sm:rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 dark:border-dark-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-3 sm:p-4 sm:rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">{t('AI Assistant')}</h3>
                <p className="text-xs text-primary-100">{t('Always here to help')}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label={t('Close chat')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-dark-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'
                  }`}
                >
                  <div className="text-xs sm:text-sm whitespace-pre-wrap">
                    {parseMarkdownLinks(message.text)}
                  </div>
                  
                  {/* Action Buttons */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 sm:mt-3 space-y-2">
                      {message.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(action.path)}
                          className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-between group"
                        >
                          <span>{action.label}</span>
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="truncate">{attachment.name}</span>
                          <span className="text-white/60">({formatFileSize(attachment.size)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-dark-700 rounded-2xl rounded-bl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="border-t border-gray-200 dark:border-dark-700 p-2 sm:p-3 bg-white dark:bg-dark-800">
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-dark-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px] sm:max-w-[150px]">{attachment.name}</span>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      aria-label={t('Remove attachment')}
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="border-t border-gray-200 dark:border-dark-700 p-3 sm:p-4 bg-white dark:bg-dark-800 sm:rounded-b-2xl">
            <div className="flex items-end gap-2">
              {/* File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                aria-label={t('Attach file')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
              />

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('Type your message...')}
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-xs sm:text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() && attachments.length === 0}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:cursor-not-allowed transition-colors"
                aria-label={t('Send message')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
