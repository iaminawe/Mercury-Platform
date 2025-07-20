import { OpenAI } from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface ProductRecommendation {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  handle: string;
  confidence: number;
  reason: string;
  category: string;
  tags: string[];
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    available: boolean;
  }>;
}

export interface RecommendationContext {
  customerId?: string;
  sessionId: string;
  query?: string;
  intent: string;
  currentCart?: any[];
  browsedProducts?: string[];
  orderHistory?: any[];
  preferences?: {
    categories: string[];
    priceRange: { min: number; max: number };
    brands: string[];
    style: string;
  };
  demographics?: {
    age?: number;
    gender?: string;
    location?: string;
  };
}

export class ProductRecommender {
  private openai: OpenAI;
  private supabase;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.supabase = createServerSupabaseClient();
  }

  async getRecommendations(
    context: RecommendationContext,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    try {
      const strategies = [
        this.getQueryBasedRecommendations,
        this.getCollaborativeRecommendations,
        this.getContentBasedRecommendations,
        this.getTrendingRecommendations,
        this.getCrossSellRecommendations
      ];

      const results = await Promise.allSettled(
        strategies.map(strategy => strategy.call(this, context, limit))
      );

      // Combine and rank results
      const allRecommendations: ProductRecommendation[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allRecommendations.push(...result.value);
        } else {
          logger.error(`Recommendation strategy ${index} failed:`, result.reason);
        }
      });

      // Remove duplicates and rank by confidence
      const uniqueRecommendations = this.deduplicateAndRank(allRecommendations);
      
      // Apply AI enhancement for better matching
      const enhancedRecommendations = await this.enhanceWithAI(
        uniqueRecommendations.slice(0, limit * 2),
        context
      );

      return enhancedRecommendations.slice(0, limit);

    } catch (error) {
      logger.error('Product recommendation error:', error);
      return this.getFallbackRecommendations(limit);
    }
  }

  private async getQueryBasedRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<ProductRecommendation[]> {
    if (!context.query) return [];

    // Use vector search if available, otherwise text search
    const { data: products } = await this.supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .or(`title.ilike.%${context.query}%, description.ilike.%${context.query}%, tags.cs.{${context.query}}`)
      .eq('status', 'active')
      .limit(limit);

    return this.formatProductRecommendations(products || [], 'query_match', context);
  }

  private async getCollaborativeRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<ProductRecommendation[]> {
    if (!context.customerId) return [];

    // Find similar customers based on purchase history
    const { data: similarCustomers } = await this.supabase.rpc(
      'find_similar_customers',
      { 
        customer_id: context.customerId,
        limit: 20
      }
    );

    if (!similarCustomers?.length) return [];

    // Get products bought by similar customers
    const customerIds = similarCustomers.map((c: any) => c.similar_customer_id);
    const { data: products } = await this.supabase
      .from('order_line_items')
      .select(`
        product_id,
        products!inner (*, product_variants (*))
      `)
      .in('order.customer_id', customerIds)
      .not('product_id', 'in', `(${context.orderHistory?.map(o => o.product_id).join(',') || ''})`)
      .limit(limit);

    return this.formatProductRecommendations(
      products?.map((p: any) => p.products) || [],
      'collaborative_filtering',
      context
    );
  }

  private async getContentBasedRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<ProductRecommendation[]> {
    // Base on browsed products or cart items
    const referenceProducts = [
      ...(context.browsedProducts || []),
      ...(context.currentCart?.map(item => item.product_id) || [])
    ];

    if (!referenceProducts.length) return [];

    // Get similar products based on categories, tags, and attributes
    const { data: products } = await this.supabase.rpc(
      'find_similar_products',
      {
        reference_product_ids: referenceProducts,
        limit: limit
      }
    );

    return this.formatProductRecommendations(products || [], 'content_based', context);
  }

  private async getTrendingRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<ProductRecommendation[]> {
    // Get trending products based on recent sales
    const { data: products } = await this.supabase
      .from('products')
      .select(`
        *,
        product_variants (*),
        order_line_items!inner (quantity)
      `)
      .gte('order_line_items.created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'active')
      .order('order_line_items.quantity', { ascending: false })
      .limit(limit);

    return this.formatProductRecommendations(products || [], 'trending', context);
  }

  private async getCrossSellRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<ProductRecommendation[]> {
    if (!context.currentCart?.length) return [];

    const cartProductIds = context.currentCart.map(item => item.product_id);
    
    // Find frequently bought together products
    const { data: products } = await this.supabase.rpc(
      'find_frequently_bought_together',
      {
        product_ids: cartProductIds,
        limit: limit
      }
    );

    return this.formatProductRecommendations(products || [], 'cross_sell', context);
  }

  private formatProductRecommendations(
    products: any[],
    strategy: string,
    context: RecommendationContext
  ): ProductRecommendation[] {
    return products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description || '',
      price: product.price || 0,
      image_url: product.image_url || '/placeholder-product.jpg',
      handle: product.handle,
      confidence: this.calculateConfidence(product, strategy, context),
      reason: this.generateReason(product, strategy, context),
      category: product.product_type || 'General',
      tags: product.tags || [],
      variants: product.product_variants?.map((variant: any) => ({
        id: variant.id,
        title: variant.title,
        price: variant.price,
        available: variant.inventory_quantity > 0
      }))
    }));
  }

  private calculateConfidence(product: any, strategy: string, context: RecommendationContext): number {
    let confidence = 0.5; // Base confidence

    // Strategy-specific confidence adjustments
    switch (strategy) {
      case 'query_match':
        confidence = context.query ? 0.9 : 0.3;
        break;
      case 'collaborative_filtering':
        confidence = 0.8;
        break;
      case 'content_based':
        confidence = 0.7;
        break;
      case 'trending':
        confidence = 0.6;
        break;
      case 'cross_sell':
        confidence = 0.85;
        break;
    }

    // Adjust based on product attributes
    if (product.rating && product.rating > 4.0) confidence += 0.1;
    if (product.review_count && product.review_count > 50) confidence += 0.05;
    if (product.sale_price && product.sale_price < product.price) confidence += 0.1;

    // Adjust based on user preferences
    if (context.preferences?.categories?.includes(product.product_type)) {
      confidence += 0.15;
    }
    
    if (context.preferences?.priceRange) {
      const inRange = product.price >= context.preferences.priceRange.min &&
                     product.price <= context.preferences.priceRange.max;
      if (inRange) confidence += 0.1;
      else confidence -= 0.2;
    }

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private generateReason(product: any, strategy: string, context: RecommendationContext): string {
    const reasons = {
      query_match: `Matches your search for "${context.query}"`,
      collaborative_filtering: 'Customers like you also bought this',
      content_based: 'Similar to items you viewed',
      trending: 'Popular right now',
      cross_sell: 'Pairs well with items in your cart'
    };

    let reason = reasons[strategy as keyof typeof reasons] || 'Recommended for you';

    // Add specific attributes
    if (product.rating && product.rating > 4.0) {
      reason += ` • ${product.rating}⭐ rating`;
    }
    if (product.sale_price && product.sale_price < product.price) {
      const discount = Math.round((1 - product.sale_price / product.price) * 100);
      reason += ` • ${discount}% off`;
    }

    return reason;
  }

  private deduplicateAndRank(recommendations: ProductRecommendation[]): ProductRecommendation[] {
    const seen = new Set<string>();
    const unique: ProductRecommendation[] = [];

    // Sort by confidence first
    recommendations.sort((a, b) => b.confidence - a.confidence);

    for (const rec of recommendations) {
      if (!seen.has(rec.id)) {
        seen.add(rec.id);
        unique.push(rec);
      }
    }

    return unique;
  }

  private async enhanceWithAI(
    recommendations: ProductRecommendation[],
    context: RecommendationContext
  ): Promise<ProductRecommendation[]> {
    try {
      const prompt = `Analyze and rerank these product recommendations for better relevance:

Context:
- Customer query: ${context.query || 'General browsing'}
- Intent: ${context.intent}
- Preferences: ${JSON.stringify(context.preferences || {})}
- Cart items: ${context.currentCart?.length || 0}

Products:
${recommendations.map((p, i) => 
  `${i + 1}. ${p.title} ($${p.price}) - ${p.reason} (confidence: ${p.confidence})`
).join('\n')}

Rerank these products 1-${recommendations.length} based on customer fit and provide enhanced reasons.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert e-commerce product recommendation system. Analyze customer context and product attributes to provide optimal rankings and compelling reasons.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        functions: [
          {
            name: 'rerank_products',
            description: 'Rerank products with enhanced reasons',
            parameters: {
              type: 'object',
              properties: {
                rankings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      product_index: { type: 'number' },
                      new_confidence: { type: 'number', minimum: 0, maximum: 1 },
                      enhanced_reason: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        ],
        function_call: { name: 'rerank_products' }
      });

      const functionCall = completion.choices[0].message.function_call;
      if (functionCall?.arguments) {
        const { rankings } = JSON.parse(functionCall.arguments);
        
        // Apply AI enhancements
        rankings.forEach((ranking: any) => {
          const index = ranking.product_index - 1;
          if (index >= 0 && index < recommendations.length) {
            recommendations[index].confidence = ranking.new_confidence;
            recommendations[index].reason = ranking.enhanced_reason;
          }
        });

        // Re-sort by new confidence
        recommendations.sort((a, b) => b.confidence - a.confidence);
      }

    } catch (error) {
      logger.error('AI enhancement error:', error);
    }

    return recommendations;
  }

  private async getFallbackRecommendations(limit: number): Promise<ProductRecommendation[]> {
    // Get popular products as fallback
    const { data: products } = await this.supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    return this.formatProductRecommendations(products || [], 'fallback', {
      sessionId: 'fallback',
      intent: 'general_inquiry'
    });
  }

  async getPersonalizedRecommendations(
    customerId: string,
    sessionId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    // Get customer profile and history
    const { data: customer } = await this.supabase
      .from('customers')
      .select(`
        *,
        orders (
          *,
          order_line_items (*)
        )
      `)
      .eq('id', customerId)
      .single();

    if (!customer) {
      return this.getFallbackRecommendations(limit);
    }

    const context: RecommendationContext = {
      customerId,
      sessionId,
      intent: 'product_search',
      orderHistory: customer.orders?.flatMap((o: any) => o.order_line_items) || [],
      preferences: customer.preferences || {}
    };

    return this.getRecommendations(context, limit);
  }

  async trackRecommendationClick(
    sessionId: string,
    productId: string,
    recommendationStrategy: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('recommendation_clicks')
        .insert({
          session_id: sessionId,
          product_id: productId,
          strategy: recommendationStrategy,
          clicked_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to track recommendation click:', error);
    }
  }

  async getRecommendationAnalytics(timeframe: '24h' | '7d' | '30d' = '7d') {
    const timeframeDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30
    };

    const since = new Date(Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000);

    const { data: analytics } = await this.supabase.rpc(
      'get_recommendation_analytics',
      {
        since_date: since.toISOString()
      }
    );

    return analytics;
  }
}