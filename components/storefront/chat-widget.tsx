'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatBubble } from './chat-bubble';
import { ChatInput } from './chat-input';
import { ProductSuggestions } from './product-suggestions';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    products?: any[];
    order_id?: string;
    language?: string;
    escalated?: boolean;
  };
}

interface ChatWidgetProps {
  initialMessages?: ChatMessage[];
  customerId?: string;
  customerEmail?: string;
  onClose?: () => void;
  theme?: 'light' | 'dark';
}

export function ChatWidget({ 
  initialMessages = [], 
  customerId, 
  customerEmail,
  onClose,
  theme = 'light'
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Hi! 👋 I'm Mercury, your shopping assistant. I'm here 24/7 to help you with:

• Finding the perfect products
• Tracking your orders  
• Answering questions about our store
• Connecting you with human support

How can I help you today?`,
        timestamp: new Date(),
        metadata: {
          intent: 'greeting',
          confidence: 1.0
        }
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  // Handle new messages when widget is closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Call chatbot API
      const response = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          customerId,
          customerEmail,
          conversationHistory: messages.slice(-5) // Last 5 messages for context
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: data.id || crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(data.timestamp),
        metadata: data.metadata
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again or contact our support team directly.",
        timestamp: new Date(),
        metadata: { error: true }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleProductClick = (productId: string) => {
    // Track product interaction
    fetch('/api/chatbot/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        event: 'product_click',
        data: { productId }
      })
    }).catch(console.error);

    // Open product page
    window.open(`/products/${productId}`, '_blank');
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const minimizeWidget = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={toggleWidget}
          className={`rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300 ${
            theme === 'dark' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white relative`}
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={widgetRef}
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        isMinimized ? 'w-80 h-12' : 'w-96 h-[32rem]'
      }`}
    >
      <Card className={`h-full flex flex-col shadow-2xl border-0 ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-blue-500'
        } rounded-t-lg`}>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full bg-green-400 animate-pulse`} />
            <div>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                Mercury AI Assistant
              </h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-blue-100'}`}>
                Online • Usually replies instantly
              </p>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={minimizeWidget}
              className={`text-white hover:bg-white/10 p-1 h-8 w-8`}
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className={`text-white hover:bg-white/10 p-1 h-8 w-8`}
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
            }`}>
              {messages.map((message) => (
                <div key={message.id}>
                  <ChatBubble
                    message={message}
                    theme={theme}
                    onProductClick={handleProductClick}
                  />
                  
                  {/* Product suggestions */}
                  {message.metadata?.products && message.metadata.products.length > 0 && (
                    <div className="mt-3">
                      <ProductSuggestions
                        products={message.metadata.products}
                        onProductClick={handleProductClick}
                        theme={theme}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-center space-x-2">
                  <div className={`rounded-full p-3 max-w-xs ${
                    theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                  } shadow`}>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={`border-t p-4 ${
              theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isTyping}
                theme={theme}
                placeholder="Type your message..."
              />
              
              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 mt-2">
                {messages.length <= 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage("Track my order")}
                      className="text-xs"
                    >
                      Track Order
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage("Show me new arrivals")}
                      className="text-xs"
                    >
                      New Arrivals
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage("Help with returns")}
                      className="text-xs"
                    >
                      Returns
                    </Button>
                  </>
                )}
              </div>

              <p className={`text-xs mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Powered by AI • Available in 80+ languages
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}