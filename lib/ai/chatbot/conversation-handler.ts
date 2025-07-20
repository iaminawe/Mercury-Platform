import { OpenAI } from 'openai';
import { Database } from '@/lib/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

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
  };
}

export interface ConversationContext {
  sessionId: string;
  customerId?: string;
  customerEmail?: string;
  orderHistory?: any[];
  preferences?: {
    language: string;
    categories: string[];
  };
  currentOrder?: any;
}

export class ConversationHandler {
  private openai: OpenAI;
  private supabase;
  private systemPrompt: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.supabase = createServerSupabaseClient();
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `You are Mercury, an intelligent e-commerce assistant for a Shopify store. Your mission is to provide exceptional customer service with ≥70% auto-resolution rate.

CORE CAPABILITIES:
- Product search and recommendations
- Order status tracking and updates
- FAQ handling with store knowledge
- Multilingual support (80+ languages)
- Seamless handoff to human support

PERSONALITY:
- Friendly, helpful, and professional
- Empathetic to customer concerns
- Proactive in offering solutions
- Clear and concise communication

CONVERSATION GUIDELINES:
1. Always greet customers warmly
2. Understand intent before responding
3. Provide accurate, helpful information
4. Offer relevant product suggestions
5. Ask clarifying questions when needed
6. Know when to escalate to human support

RESPONSE FORMAT:
- Keep responses under 150 words
- Use bullet points for multiple items
- Include product links when relevant
- Provide order tracking links
- Offer next steps clearly

ESCALATION TRIGGERS:
- Complex product returns/exchanges
- Payment issues or disputes
- Technical problems with the website
- Complaints requiring managerial attention
- Customer explicitly requests human support

Always respond in the customer's preferred language and maintain context throughout the conversation.`;
  }

  async handleMessage(
    message: string,
    context: ConversationContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatMessage> {
    try {
      // Build conversation context
      const messages = [
        { role: 'system' as const, content: this.systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
      ];

      // Add context if available
      if (context.customerId) {
        const customerContext = await this.getCustomerContext(context.customerId);
        messages.splice(1, 0, {
          role: 'system' as const,
          content: `Customer Context: ${JSON.stringify(customerContext)}`
        });
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 500,
        functions: [
          {
            name: 'search_products',
            description: 'Search for products in the store',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                category: { type: 'string' },
                price_range: { 
                  type: 'object',
                  properties: {
                    min: { type: 'number' },
                    max: { type: 'number' }
                  }
                }
              },
              required: ['query']
            }
          },
          {
            name: 'track_order',
            description: 'Get order status and tracking information',
            parameters: {
              type: 'object',
              properties: {
                order_number: { type: 'string' },
                email: { type: 'string' }
              },
              required: ['order_number']
            }
          },
          {
            name: 'escalate_to_human',
            description: 'Transfer conversation to human support',
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['reason']
            }
          }
        ]
      });

      const response = completion.choices[0].message;
      
      // Handle function calls
      if (response.function_call) {
        return await this.handleFunctionCall(response.function_call, context);
      }

      // Create response message
      const responseMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content || 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
        metadata: {
          language: context.preferences?.language || 'en'
        }
      };

      // Save to conversation history
      await this.saveMessage(context.sessionId, responseMessage);

      return responseMessage;

    } catch (error) {
      logger.error('Conversation handler error:', error);
      
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I apologize, but I\'m experiencing technical difficulties. A human agent will assist you shortly.',
        timestamp: new Date(),
        metadata: {
          error: true
        }
      };
    }
  }

  private async handleFunctionCall(
    functionCall: any,
    context: ConversationContext
  ): Promise<ChatMessage> {
    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);

    try {
      switch (name) {
        case 'search_products':
          const products = await this.searchProducts(parsedArgs);
          return {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: this.formatProductResults(products),
            timestamp: new Date(),
            metadata: {
              products,
              intent: 'product_search'
            }
          };

        case 'track_order':
          const orderStatus = await this.trackOrder(parsedArgs.order_number, context);
          return {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: this.formatOrderStatus(orderStatus),
            timestamp: new Date(),
            metadata: {
              order_id: parsedArgs.order_number,
              intent: 'order_tracking'
            }
          };

        case 'escalate_to_human':
          await this.escalateToHuman(context.sessionId, parsedArgs.reason, parsedArgs.priority);
          return {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'I\'ve connected you with a human agent who will assist you shortly. Please wait a moment.',
            timestamp: new Date(),
            metadata: {
              escalated: true,
              reason: parsedArgs.reason
            }
          };

        default:
          throw new Error(`Unknown function: ${name}`);
      }
    } catch (error) {
      logger.error(`Function call error for ${name}:`, error);
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I encountered an issue processing your request. Let me connect you with a human agent.',
        timestamp: new Date(),
        metadata: {
          error: true,
          function: name
        }
      };
    }
  }

  private async searchProducts(params: any) {
    // Integrate with Shopify product search
    const { data: products } = await this.supabase
      .from('products')
      .select('*')
      .ilike('title', `%${params.query}%`)
      .limit(5);

    return products || [];
  }

  private async trackOrder(orderNumber: string, context: ConversationContext) {
    // Integrate with Shopify order tracking
    const { data: order } = await this.supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    return order;
  }

  private async escalateToHuman(sessionId: string, reason: string, priority: string) {
    // Add to human support queue
    await this.supabase
      .from('support_queue')
      .insert({
        session_id: sessionId,
        reason,
        priority,
        status: 'waiting',
        created_at: new Date().toISOString()
      });
  }

  private formatProductResults(products: any[]): string {
    if (!products.length) {
      return "I couldn't find any products matching your search. Could you try different keywords?";
    }

    const formatted = products.map(product => 
      `• **${product.title}** - $${product.price}\n  ${product.description?.substring(0, 100)}...`
    ).join('\n\n');

    return `Here are some products I found:\n\n${formatted}\n\nWould you like more details about any of these?`;
  }

  private formatOrderStatus(order: any): string {
    if (!order) {
      return "I couldn't find an order with that number. Please check the order number and try again.";
    }

    return `**Order #${order.order_number}**\n• Status: ${order.status}\n• Total: $${order.total}\n• Estimated delivery: ${order.estimated_delivery || 'TBD'}\n\nIs there anything else about your order I can help with?`;
  }

  private async getCustomerContext(customerId: string) {
    const { data: customer } = await this.supabase
      .from('customers')
      .select('*, orders(*)')
      .eq('id', customerId)
      .single();

    return customer;
  }

  private async saveMessage(sessionId: string, message: ChatMessage) {
    await this.supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        created_at: message.timestamp.toISOString()
      });
  }

  async getConversationHistory(sessionId: string): Promise<ChatMessage[]> {
    const { data: messages } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return messages?.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      metadata: msg.metadata
    })) || [];
  }

  async detectLanguage(text: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., "en", "es", "fr", "de", etc.)'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      return completion.choices[0].message.content?.trim() || 'en';
    } catch (error) {
      logger.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  async translateMessage(text: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'en') return text;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Translate the following text to ${targetLanguage}. Maintain the tone and context. Respond only with the translation.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      });

      return completion.choices[0].message.content || text;
    } catch (error) {
      logger.error('Translation error:', error);
      return text; // Return original if translation fails
    }
  }
}