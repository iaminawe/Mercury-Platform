import { OpenAI } from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  type: 'faq' | 'policy' | 'guide' | 'product_info' | 'troubleshooting';
  category: string;
  tags: string[];
  priority: number;
  lastUpdated: Date;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface SearchResult {
  document: KnowledgeDocument;
  relevanceScore: number;
  matchedSections: string[];
  context: string;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  followUpQuestions: string[];
}

export class KnowledgeBase {
  private openai: OpenAI;
  private supabase;
  private embeddingModel = 'text-embedding-3-small';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.supabase = createServerSupabaseClient();
  }

  async search(
    query: string,
    category?: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector similarity search
      let supabaseQuery = this.supabase.rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        similarity_threshold: threshold,
        match_count: limit
      });

      if (category) {
        supabaseQuery = supabaseQuery.eq('category', category);
      }

      const { data: results, error } = await supabaseQuery;

      if (error) {
        logger.error('Knowledge base search error:', error);
        return this.fallbackSearch(query, category, limit);
      }

      return results?.map((result: any) => ({
        document: {
          id: result.id,
          title: result.title,
          content: result.content,
          type: result.type,
          category: result.category,
          tags: result.tags || [],
          priority: result.priority || 0,
          lastUpdated: new Date(result.updated_at),
          metadata: result.metadata
        },
        relevanceScore: result.similarity,
        matchedSections: this.extractMatchedSections(result.content, query),
        context: this.generateContext(result.content, query)
      })) || [];

    } catch (error) {
      logger.error('Knowledge base search failed:', error);
      return this.fallbackSearch(query, category, limit);
    }
  }

  async generateResponse(
    query: string,
    category?: string,
    conversationHistory?: any[]
  ): Promise<RAGResponse> {
    try {
      // Search for relevant documents
      const searchResults = await this.search(query, category, 5, 0.6);
      
      if (searchResults.length === 0) {
        return {
          answer: "I don't have specific information about that topic in my knowledge base. Would you like me to connect you with a human agent who can help?",
          sources: [],
          confidence: 0.1,
          followUpQuestions: [
            "Would you like to speak with a human agent?",
            "Is there something else I can help you with?",
            "Would you like to browse our FAQ section?"
          ]
        };
      }

      // Build context from search results
      const context = searchResults
        .map(result => `[Source: ${result.document.title}]\n${result.context}`)
        .join('\n\n');

      // Generate response using RAG
      const systemPrompt = `You are Mercury, a helpful e-commerce assistant. Use the provided knowledge base context to answer customer questions accurately and helpfully.

GUIDELINES:
- Answer directly and concisely based on the context provided
- If the context doesn't fully answer the question, say so honestly
- Include relevant details like policies, procedures, or specifications
- Maintain a friendly, professional tone
- Suggest next steps when appropriate
- If multiple sources mention the same information, synthesize it naturally

CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationHistory ? JSON.stringify(conversationHistory.slice(-3)) : 'No previous conversation'}

Answer the customer's question using this context.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 400,
        functions: [
          {
            name: 'generate_response',
            description: 'Generate a response with confidence score and follow-up questions',
            parameters: {
              type: 'object',
              properties: {
                answer: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                follow_up_questions: {
                  type: 'array',
                  items: { type: 'string' },
                  maxItems: 3
                }
              },
              required: ['answer', 'confidence']
            }
          }
        ],
        function_call: { name: 'generate_response' }
      });

      const functionCall = completion.choices[0].message.function_call;
      if (!functionCall?.arguments) {
        throw new Error('No function call result');
      }

      const result = JSON.parse(functionCall.arguments);

      return {
        answer: result.answer,
        sources: searchResults,
        confidence: result.confidence,
        followUpQuestions: result.follow_up_questions || []
      };

    } catch (error) {
      logger.error('RAG response generation failed:', error);
      return {
        answer: "I'm experiencing technical difficulties. Let me connect you with a human agent who can assist you properly.",
        sources: [],
        confidence: 0.2,
        followUpQuestions: ["Would you like to speak with a human agent?"]
      };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.replace(/\n/g, ' ').trim()
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw error;
    }
  }

  private async fallbackSearch(
    query: string,
    category?: string,
    limit: number
  ): Promise<SearchResult[]> {
    // Text-based search as fallback
    let supabaseQuery = this.supabase
      .from('knowledge_base')
      .select('*')
      .or(`title.ilike.%${query}%, content.ilike.%${query}%, tags.cs.{${query}}`)
      .order('priority', { ascending: false })
      .limit(limit);

    if (category) {
      supabaseQuery = supabaseQuery.eq('category', category);
    }

    const { data: results } = await supabaseQuery;

    return results?.map((result: any) => ({
      document: {
        id: result.id,
        title: result.title,
        content: result.content,
        type: result.type,
        category: result.category,
        tags: result.tags || [],
        priority: result.priority || 0,
        lastUpdated: new Date(result.updated_at),
        metadata: result.metadata
      },
      relevanceScore: 0.5, // Default score for text search
      matchedSections: this.extractMatchedSections(result.content, query),
      context: this.generateContext(result.content, query)
    })) || [];
  }

  private extractMatchedSections(content: string, query: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return sentences.filter(sentence => {
      const sentenceLower = sentence.toLowerCase();
      return queryWords.some(word => sentenceLower.includes(word));
    }).slice(0, 3);
  }

  private generateContext(content: string, query: string): string {
    // Extract most relevant paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const scoredParagraphs = paragraphs.map(paragraph => {
      const paragraphLower = paragraph.toLowerCase();
      const score = queryWords.reduce((acc, word) => {
        const count = (paragraphLower.match(new RegExp(word, 'g')) || []).length;
        return acc + count;
      }, 0);
      
      return { paragraph, score };
    });

    return scoredParagraphs
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(item => item.paragraph)
      .join('\n\n')
      .substring(0, 1000);
  }

  async addDocument(document: Omit<KnowledgeDocument, 'id' | 'lastUpdated' | 'embedding'>): Promise<string> {
    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(
        `${document.title} ${document.content}`
      );

      const { data, error } = await this.supabase
        .from('knowledge_base')
        .insert({
          title: document.title,
          content: document.content,
          type: document.type,
          category: document.category,
          tags: document.tags,
          priority: document.priority,
          embedding: embedding,
          metadata: document.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info(`Knowledge document added: ${document.title}`);
      return data.id;

    } catch (error) {
      logger.error('Failed to add knowledge document:', error);
      throw error;
    }
  }

  async updateDocument(
    id: string,
    updates: Partial<Omit<KnowledgeDocument, 'id' | 'lastUpdated'>>
  ): Promise<boolean> {
    try {
      let updateData: any = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Regenerate embedding if content or title changed
      if (updates.content || updates.title) {
        const { data: currentDoc } = await this.supabase
          .from('knowledge_base')
          .select('title, content')
          .eq('id', id)
          .single();

        const newTitle = updates.title || currentDoc?.title || '';
        const newContent = updates.content || currentDoc?.content || '';
        
        updateData.embedding = await this.generateEmbedding(`${newTitle} ${newContent}`);
      }

      const { error } = await this.supabase
        .from('knowledge_base')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      logger.info(`Knowledge document updated: ${id}`);
      return true;

    } catch (error) {
      logger.error('Failed to update knowledge document:', error);
      return false;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (error) throw error;

      logger.info(`Knowledge document deleted: ${id}`);
      return true;

    } catch (error) {
      logger.error('Failed to delete knowledge document:', error);
      return false;
    }
  }

  async bulkImport(documents: Omit<KnowledgeDocument, 'id' | 'lastUpdated' | 'embedding'>[]): Promise<string[]> {
    const imported: string[] = [];
    
    for (const doc of documents) {
      try {
        const id = await this.addDocument(doc);
        imported.push(id);
      } catch (error) {
        logger.error(`Failed to import document: ${doc.title}`, error);
      }
    }

    logger.info(`Bulk import completed: ${imported.length}/${documents.length} documents`);
    return imported;
  }

  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    try {
      const { data } = await this.supabase
        .from('knowledge_base')
        .select('category')
        .not('category', 'is', null);

      const categoryCount = (data || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(categoryCount).map(([category, count]) => ({
        category,
        count: count as number
      }));

    } catch (error) {
      logger.error('Failed to get categories:', error);
      return [];
    }
  }

  async getPopularSearches(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<Array<{ query: string; count: number }>> {
    try {
      const timeframeDays = { '24h': 1, '7d': 7, '30d': 30 };
      const since = new Date(Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000);

      const { data } = await this.supabase
        .from('knowledge_searches')
        .select('query')
        .gte('created_at', since.toISOString());

      const searchCount = (data || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.query] = (acc[item.query] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(searchCount)
        .map(([query, count]) => ({ query, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    } catch (error) {
      logger.error('Failed to get popular searches:', error);
      return [];
    }
  }

  async trackSearch(query: string, sessionId: string, foundResults: boolean): Promise<void> {
    try {
      await this.supabase
        .from('knowledge_searches')
        .insert({
          query,
          session_id: sessionId,
          found_results: foundResults,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to track search:', error);
    }
  }

  async getAnalytics(timeframe: '24h' | '7d' | '30d' = '7d') {
    try {
      const timeframeDays = { '24h': 1, '7d': 7, '30d': 30 };
      const since = new Date(Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000);

      const { data: analytics } = await this.supabase.rpc(
        'get_knowledge_base_analytics',
        { since_date: since.toISOString() }
      );

      return analytics;
    } catch (error) {
      logger.error('Failed to get knowledge base analytics:', error);
      return null;
    }
  }

  // Initialize with default knowledge base content
  async initializeDefaultContent(): Promise<void> {
    const defaultDocs: Omit<KnowledgeDocument, 'id' | 'lastUpdated' | 'embedding'>[] = [
      {
        title: 'Shipping Information',
        content: `We offer several shipping options:

Standard Shipping (5-7 business days): Free on orders over $50
Express Shipping (2-3 business days): $9.99
Overnight Shipping (1 business day): $19.99

International shipping is available to most countries. Rates are calculated at checkout based on destination and package weight.

All orders are processed within 1-2 business days. You'll receive a tracking number once your order ships.`,
        type: 'policy',
        category: 'shipping',
        tags: ['shipping', 'delivery', 'international', 'tracking'],
        priority: 5
      },
      {
        title: 'Return Policy',
        content: `We accept returns within 30 days of delivery for a full refund.

Return Requirements:
- Items must be unused and in original packaging
- Original receipt or order number required
- Return shipping costs are covered by us for defective items

To start a return:
1. Contact our support team with your order number
2. Print the prepaid return label we'll email you
3. Package items securely and attach the label
4. Drop off at any authorized shipping location

Refunds are processed within 5-7 business days after we receive your return.`,
        type: 'policy',
        category: 'returns',
        tags: ['returns', 'refund', 'exchange', 'policy'],
        priority: 5
      },
      {
        title: 'Account Management',
        content: `Managing your account is easy:

Creating an Account:
- Click 'Sign Up' and provide your email and password
- Verify your email address
- Complete your profile with shipping information

Account Benefits:
- Order history and tracking
- Saved addresses and payment methods
- Wishlist and favorites
- Exclusive member offers

Forgot your password? Click 'Forgot Password' on the login page and follow the instructions.

To update your account information, log in and visit 'My Account' > 'Profile Settings'.`,
        type: 'guide',
        category: 'account',
        tags: ['account', 'login', 'password', 'profile'],
        priority: 4
      },
      {
        title: 'Payment Methods',
        content: `We accept the following payment methods:

Credit Cards: Visa, MasterCard, American Express, Discover
Digital Wallets: PayPal, Apple Pay, Google Pay
Buy Now Pay Later: Klarna, Afterpay

All payments are processed securely using SSL encryption. We never store your full credit card information.

For international orders, your bank may charge foreign transaction fees. All prices are displayed in USD unless otherwise noted.

If your payment is declined, please contact your bank or try a different payment method.`,
        type: 'policy',
        category: 'payment',
        tags: ['payment', 'credit card', 'paypal', 'security'],
        priority: 4
      }
    ];

    try {
      await this.bulkImport(defaultDocs);
      logger.info('Default knowledge base content initialized');
    } catch (error) {
      logger.error('Failed to initialize default content:', error);
    }
  }
}