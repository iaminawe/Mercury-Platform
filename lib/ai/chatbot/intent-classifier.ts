import { OpenAI } from 'openai';
import { logger } from '@/lib/logger';

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  suggestedResponse?: string;
}

export interface Intent {
  name: string;
  description: string;
  examples: string[];
  entities: string[];
  requiresEscalation: boolean;
  autoResolvable: boolean;
}

export class IntentClassifier {
  private openai: OpenAI;
  private intents: Intent[];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.intents = this.defineIntents();
  }

  private defineIntents(): Intent[] {
    return [
      {
        name: 'product_search',
        description: 'Customer is looking for specific products',
        examples: [
          'I need a red dress',
          'Do you have iPhone cases?',
          'Show me winter coats',
          'Looking for yoga mats'
        ],
        entities: ['product_type', 'color', 'size', 'brand', 'price_range'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'order_status',
        description: 'Customer wants to check order status',
        examples: [
          'Where is my order?',
          'Track order #12345',
          'When will my package arrive?',
          'Order status for john@email.com'
        ],
        entities: ['order_number', 'email', 'tracking_number'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'return_exchange',
        description: 'Customer wants to return or exchange items',
        examples: [
          'I want to return this item',
          'Can I exchange for a different size?',
          'How do I start a return?',
          'Return policy questions'
        ],
        entities: ['order_number', 'item_id', 'reason'],
        requiresEscalation: true,
        autoResolvable: false
      },
      {
        name: 'payment_issue',
        description: 'Customer has payment-related problems',
        examples: [
          'My payment was declined',
          'I was charged twice',
          'Refund status',
          'Payment method issues'
        ],
        entities: ['order_number', 'payment_method', 'amount'],
        requiresEscalation: true,
        autoResolvable: false
      },
      {
        name: 'product_question',
        description: 'Customer has questions about product features',
        examples: [
          'What are the dimensions?',
          'Is this waterproof?',
          'What materials is this made of?',
          'Size chart information'
        ],
        entities: ['product_id', 'feature', 'specification'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'shipping_info',
        description: 'Customer wants shipping information',
        examples: [
          'What are your shipping options?',
          'How much is shipping?',
          'Do you ship internationally?',
          'Express delivery available?'
        ],
        entities: ['location', 'shipping_method', 'urgency'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'account_help',
        description: 'Customer needs help with their account',
        examples: [
          'I forgot my password',
          'How do I update my profile?',
          'Delete my account',
          'Login issues'
        ],
        entities: ['email', 'account_action'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'complaint',
        description: 'Customer has a complaint or negative feedback',
        examples: [
          'I am not satisfied',
          'This is terrible service',
          'I want to file a complaint',
          'Very disappointed'
        ],
        entities: ['complaint_type', 'severity'],
        requiresEscalation: true,
        autoResolvable: false
      },
      {
        name: 'general_inquiry',
        description: 'General questions about the store or policies',
        examples: [
          'What are your store hours?',
          'Do you have a physical location?',
          'What is your return policy?',
          'How can I contact you?'
        ],
        entities: ['topic'],
        requiresEscalation: false,
        autoResolvable: true
      },
      {
        name: 'technical_issue',
        description: 'Customer experiencing website or technical problems',
        examples: [
          'The website is not working',
          'Cart is not updating',
          'Images not loading',
          'Checkout broken'
        ],
        entities: ['issue_type', 'browser', 'device'],
        requiresEscalation: true,
        autoResolvable: false
      }
    ];
  }

  async classifyIntent(message: string, context?: any): Promise<IntentResult> {
    try {
      const prompt = this.buildClassificationPrompt(message, context);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        functions: [
          {
            name: 'classify_intent',
            description: 'Classify the customer intent and extract entities',
            parameters: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  enum: this.intents.map(i => i.name)
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1
                },
                entities: {
                  type: 'object',
                  additionalProperties: true
                },
                reasoning: {
                  type: 'string'
                }
              },
              required: ['intent', 'confidence', 'entities']
            }
          }
        ],
        function_call: { name: 'classify_intent' }
      });

      const functionCall = completion.choices[0].message.function_call;
      if (!functionCall?.arguments) {
        throw new Error('No function call result');
      }

      const result = JSON.parse(functionCall.arguments);
      const intent = this.intents.find(i => i.name === result.intent);

      // Log classification for analytics
      logger.info('Intent classified:', {
        message: message.substring(0, 100),
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities
      });

      return {
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities,
        suggestedResponse: this.generateSuggestedResponse(intent, result.entities)
      };

    } catch (error) {
      logger.error('Intent classification error:', error);
      
      // Fallback to rule-based classification
      return this.fallbackClassification(message);
    }
  }

  private buildClassificationPrompt(message: string, context?: any): string {
    const intentDescriptions = this.intents.map(intent => 
      `- ${intent.name}: ${intent.description}\n  Examples: ${intent.examples.join(', ')}`
    ).join('\n');

    return `You are an expert intent classifier for an e-commerce chatbot. Analyze customer messages and classify them into predefined intents.

AVAILABLE INTENTS:
${intentDescriptions}

CLASSIFICATION GUIDELINES:
1. Choose the most specific intent that matches the customer's primary need
2. Extract relevant entities mentioned in the message
3. Provide confidence score (0.0 - 1.0) based on clarity and match quality
4. Consider context from previous messages if provided

ENTITY EXTRACTION:
- product_type: specific product categories mentioned
- order_number: any order/transaction numbers
- email: email addresses mentioned
- price_range: price constraints or budgets
- color, size, brand: product attributes
- urgency: time-sensitive requests
- complaint_type: nature of complaints
- issue_type: technical problems described

Analyze the customer message and classify it accurately.${context ? `\n\nPREVIOUS CONTEXT:\n${JSON.stringify(context)}` : ''}`;
  }

  private fallbackClassification(message: string): IntentResult {
    const lowerMessage = message.toLowerCase();
    
    // Simple keyword-based fallback
    const patterns = [
      { intent: 'order_status', keywords: ['order', 'track', 'delivery', 'shipping', 'where is'] },
      { intent: 'product_search', keywords: ['looking for', 'need', 'want', 'buy', 'purchase'] },
      { intent: 'return_exchange', keywords: ['return', 'exchange', 'refund'] },
      { intent: 'payment_issue', keywords: ['payment', 'charged', 'billing', 'credit card'] },
      { intent: 'complaint', keywords: ['terrible', 'horrible', 'disappointed', 'complaint'] },
      { intent: 'technical_issue', keywords: ['website', 'error', 'broken', 'not working'] }
    ];

    for (const pattern of patterns) {
      const matchCount = pattern.keywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      if (matchCount > 0) {
        return {
          intent: pattern.intent,
          confidence: Math.min(0.7, matchCount * 0.3),
          entities: {},
        };
      }
    }

    // Default to general inquiry
    return {
      intent: 'general_inquiry',
      confidence: 0.5,
      entities: {},
    };
  }

  private generateSuggestedResponse(intent?: Intent, entities?: Record<string, any>): string {
    if (!intent) return '';

    const responses = {
      product_search: "I'd be happy to help you find the perfect product! Let me search our inventory for you.",
      order_status: "I can help you track your order. Let me look up the latest information for you.",
      return_exchange: "I understand you need help with a return or exchange. Let me connect you with a specialist who can assist you.",
      payment_issue: "I see you're having a payment concern. Let me connect you with our billing team who can resolve this quickly.",
      product_question: "Great question! Let me find the detailed product information for you.",
      shipping_info: "I can provide you with all our shipping options and rates.",
      account_help: "I'm here to help with your account. What specifically do you need assistance with?",
      complaint: "I sincerely apologize for any inconvenience. Let me connect you with a manager who can address your concerns properly.",
      general_inquiry: "I'm here to help! What would you like to know about our store?",
      technical_issue: "I apologize for the technical difficulties. Let me connect you with our technical support team."
    };

    return responses[intent.name as keyof typeof responses] || "How can I assist you today?";
  }

  async batchClassify(messages: string[]): Promise<IntentResult[]> {
    const results = await Promise.allSettled(
      messages.map(message => this.classifyIntent(message))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Batch classification failed for message ${index}:`, result.reason);
        return this.fallbackClassification(messages[index]);
      }
    });
  }

  getIntentMetadata(intentName: string): Intent | undefined {
    return this.intents.find(i => i.name === intentName);
  }

  shouldEscalate(intentResult: IntentResult): boolean {
    const intent = this.getIntentMetadata(intentResult.intent);
    return intent?.requiresEscalation || intentResult.confidence < 0.5;
  }

  isAutoResolvable(intentResult: IntentResult): boolean {
    const intent = this.getIntentMetadata(intentResult.intent);
    return intent?.autoResolvable && intentResult.confidence >= 0.7;
  }

  getTopIntents(limit: number = 5): Intent[] {
    // Could be enhanced with actual usage analytics
    return this.intents.slice(0, limit);
  }
}