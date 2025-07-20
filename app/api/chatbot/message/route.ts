import { NextRequest, NextResponse } from 'next/server';
import { ConversationHandler, ConversationContext } from '@/lib/ai/chatbot/conversation-handler';
import { IntentClassifier } from '@/lib/ai/chatbot/intent-classifier';
import { ProductRecommender, RecommendationContext } from '@/lib/ai/chatbot/product-recommender';
import { KnowledgeBase } from '@/lib/ai/chatbot/knowledge-base';
import { logger } from '@/lib/logger';

interface ChatRequest {
  message: string;
  sessionId: string;
  customerId?: string;
  customerEmail?: string;
  conversationHistory?: any[];
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, sessionId, customerId, customerEmail, conversationHistory = [], language } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Message and sessionId are required' },
        { status: 400 }
      );
    }

    // Initialize AI components
    const conversationHandler = new ConversationHandler();
    const intentClassifier = new IntentClassifier();
    const productRecommender = new ProductRecommender();
    const knowledgeBase = new KnowledgeBase();

    // Detect language if not provided
    const detectedLanguage = language || await conversationHandler.detectLanguage(message);

    // Classify intent
    const intentResult = await intentClassifier.classifyIntent(message, {
      conversationHistory,
      customerId,
      language: detectedLanguage
    });

    logger.info('Intent classified:', {
      sessionId,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      language: detectedLanguage
    });

    // Build conversation context
    const context: ConversationContext = {
      sessionId,
      customerId,
      customerEmail,
      preferences: {
        language: detectedLanguage,
        categories: [] // Could be loaded from customer profile
      }
    };

    // Handle different intents with specialized responses
    let response;
    let products = [];

    switch (intentResult.intent) {
      case 'product_search':
        // Get product recommendations
        const recommendationContext: RecommendationContext = {
          sessionId,
          customerId,
          query: message,
          intent: intentResult.intent,
          currentCart: [], // Could be loaded from session
          browsedProducts: [] // Could be loaded from session
        };
        
        products = await productRecommender.getRecommendations(recommendationContext, 3);
        
        // Generate response with products
        response = await conversationHandler.handleMessage(message, context, conversationHistory);
        if (products.length > 0) {
          response.metadata = {
            ...response.metadata,
            products: products
          };
        }
        break;

      case 'general_inquiry':
      case 'product_question':
        // Use knowledge base for FAQ-type questions
        const ragResponse = await knowledgeBase.generateResponse(
          message,
          intentResult.intent === 'product_question' ? 'product_info' : undefined,
          conversationHistory
        );
        
        if (ragResponse.confidence > 0.7) {
          response = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: ragResponse.answer,
            timestamp: new Date(),
            metadata: {
              intent: intentResult.intent,
              confidence: ragResponse.confidence,
              sources: ragResponse.sources,
              followUpQuestions: ragResponse.followUpQuestions,
              language: detectedLanguage
            }
          };
        } else {
          // Fall back to general conversation handler
          response = await conversationHandler.handleMessage(message, context, conversationHistory);
        }
        
        // Track knowledge base search
        await knowledgeBase.trackSearch(message, sessionId, ragResponse.sources.length > 0);
        break;

      default:
        // Use general conversation handler for other intents
        response = await conversationHandler.handleMessage(message, context, conversationHistory);
        break;
    }

    // Translate response if needed
    if (detectedLanguage !== 'en' && response.content) {
      response.content = await conversationHandler.translateMessage(response.content, detectedLanguage);
    }

    // Add intent metadata to response
    response.metadata = {
      ...response.metadata,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      language: detectedLanguage
    };

    // Track conversation metrics
    await trackConversationMetrics(sessionId, intentResult, response, detectedLanguage);

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Chatbot API error:', error);
    
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm experiencing technical difficulties. Please try again or contact our support team.",
        timestamp: new Date(),
        metadata: {
          error: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    );
  }
}

async function trackConversationMetrics(
  sessionId: string,
  intentResult: any,
  response: any,
  language: string
) {
  try {
    // In a real implementation, this would save to your analytics database
    const metrics = {
      sessionId,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      responseTime: Date.now(), // You'd calculate actual response time
      language,
      resolved: !response.metadata?.escalated,
      timestamp: new Date().toISOString()
    };

    // Save metrics (implement your analytics storage here)
    logger.info('Conversation metrics:', metrics);
  } catch (error) {
    logger.error('Failed to track metrics:', error);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      status: 'Chatbot API is running',
      version: '1.0.0',
      capabilities: [
        'Multilingual support (80+ languages)',
        'Intent classification',
        'Product recommendations',
        'Knowledge base search',
        'Order tracking',
        'Human escalation'
      ]
    },
    { status: 200 }
  );
}