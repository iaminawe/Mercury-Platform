import { createClient } from '@/lib/supabase/server';

export interface CustomerSegment {
  id: string;
  name: string;
  criteria: Record<string, any>;
  customerCount: number;
}

export interface PersonalizationRule {
  id: string;
  name: string;
  condition: Record<string, any>;
  action: Record<string, any>;
  priority: number;
}

export class PersonalizationEngine {
  /**
   * Segment customers based on behavior, preferences, and purchase history
   */
  async segmentCustomers(): Promise<CustomerSegment[]> {
    const supabase = createClient();
    
    // Get customer data with purchase history
    const { data: customers } = await supabase
      .from('customers')
      .select(`
        *,
        orders(count),
        order_items(
          quantity,
          price,
          products(category, tags)
        )
      `);

    if (!customers) return [];

    const segments: CustomerSegment[] = [];

    // High-value customers (spent > $1000)
    const highValueCustomers = customers.filter(customer => 
      this.calculateCustomerValue(customer) > 1000
    );
    
    segments.push({
      id: 'high-value',
      name: 'High-Value Customers',
      criteria: { totalSpent: { gte: 1000 } },
      customerCount: highValueCustomers.length
    });

    // New customers (less than 30 days, 1-2 orders)
    const newCustomers = customers.filter(customer => {
      const daysSinceSignup = this.daysSince(customer.created_at);
      const orderCount = customer.orders?.length || 0;
      return daysSinceSignup <= 30 && orderCount <= 2;
    });

    segments.push({
      id: 'new-customers',
      name: 'New Customers',
      criteria: { 
        daysSinceSignup: { lte: 30 },
        orderCount: { lte: 2 }
      },
      customerCount: newCustomers.length
    });

    // At-risk customers (no purchase in 60+ days, previously active)
    const atRiskCustomers = customers.filter(customer => {
      const daysSinceLastOrder = this.daysSinceLastOrder(customer);
      const orderCount = customer.orders?.length || 0;
      return daysSinceLastOrder > 60 && orderCount > 0;
    });

    segments.push({
      id: 'at-risk',
      name: 'At-Risk Customers',
      criteria: { 
        daysSinceLastOrder: { gte: 60 },
        orderCount: { gte: 1 }
      },
      customerCount: atRiskCustomers.length
    });

    // Category enthusiasts
    const categorySegments = await this.createCategorySegments(customers);
    segments.push(...categorySegments);

    // Store segments in database
    await this.storeSegments(segments);

    return segments;
  }

  /**
   * Create segments based on product category preferences
   */
  private async createCategorySegments(customers: any[]): Promise<CustomerSegment[]> {
    const categoryMap = new Map<string, any[]>();

    customers.forEach(customer => {
      customer.order_items?.forEach((item: any) => {
        const category = item.products?.category;
        if (category) {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
          }
          categoryMap.get(category)!.push(customer);
        }
      });
    });

    const segments: CustomerSegment[] = [];
    
    categoryMap.forEach((customers, category) => {
      if (customers.length >= 10) { // Only create segments with meaningful size
        segments.push({
          id: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${category} Enthusiasts`,
          criteria: { preferredCategory: category },
          customerCount: customers.length
        });
      }
    });

    return segments;
  }

  /**
   * Get personalized product recommendations for a customer
   */
  async getProductRecommendations(customerId: string, limit = 5): Promise<any[]> {
    const supabase = createClient();
    
    // Get customer's purchase history and preferences
    const { data: customer } = await supabase
      .from('customers')
      .select(`
        *,
        order_items(
          products(id, category, tags, price)
        )
      `)
      .eq('id', customerId)
      .single();

    if (!customer) return [];

    // Analyze customer preferences
    const preferences = this.analyzeCustomerPreferences(customer);
    
    // Get products similar to customer preferences
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('category', preferences.categories)
      .not('id', 'in', `(${preferences.purchasedProductIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (!products) return [];

    // Score and rank products
    const scoredProducts = products
      .map(product => ({
        ...product,
        score: this.calculateRecommendationScore(product, preferences)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredProducts;
  }

  /**
   * Analyze customer preferences from purchase history
   */
  private analyzeCustomerPreferences(customer: any) {
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();
    const priceRanges = [];
    const purchasedProductIds = [];

    customer.order_items?.forEach((item: any) => {
      const product = item.products;
      if (!product) return;

      purchasedProductIds.push(product.id);
      
      // Count categories
      if (product.category) {
        categories.set(product.category, (categories.get(product.category) || 0) + 1);
      }

      // Count tags
      product.tags?.forEach((tag: string) => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });

      // Track price ranges
      if (product.price) {
        priceRanges.push(product.price);
      }
    });

    const sortedCategories = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);

    const sortedTags = Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const avgPrice = priceRanges.length > 0 
      ? priceRanges.reduce((sum, price) => sum + price, 0) / priceRanges.length 
      : 0;

    return {
      categories: sortedCategories,
      tags: sortedTags,
      averagePrice: avgPrice,
      purchasedProductIds
    };
  }

  /**
   * Calculate recommendation score for a product
   */
  private calculateRecommendationScore(product: any, preferences: any): number {
    let score = 0;

    // Category match (highest weight)
    if (preferences.categories.includes(product.category)) {
      const categoryIndex = preferences.categories.indexOf(product.category);
      score += (10 - categoryIndex) * 10; // Higher score for preferred categories
    }

    // Tag matches
    product.tags?.forEach((tag: string) => {
      if (preferences.tags.includes(tag)) {
        const tagIndex = preferences.tags.indexOf(tag);
        score += (5 - tagIndex) * 2;
      }
    });

    // Price similarity
    if (preferences.averagePrice > 0) {
      const priceDifference = Math.abs(product.price - preferences.averagePrice);
      const priceScore = Math.max(0, 10 - (priceDifference / preferences.averagePrice) * 10);
      score += priceScore;
    }

    return score;
  }

  /**
   * Personalize email content based on customer data
   */
  async personalizeContent(template: string, customerId: string): Promise<string> {
    const supabase = createClient();
    
    const { data: customer } = await supabase
      .from('customers')
      .select(`
        *,
        orders(count),
        order_items(
          products(category, price)
        )
      `)
      .eq('id', customerId)
      .single();

    if (!customer) return template;

    // Get customer insights
    const totalSpent = this.calculateCustomerValue(customer);
    const orderCount = customer.orders?.length || 0;
    const preferredCategories = this.getPreferredCategories(customer);
    const recommendations = await this.getProductRecommendations(customerId, 3);

    // Replace placeholders with personalized data
    let personalizedContent = template
      .replace(/\{\{firstName\}\}/g, customer.first_name || 'there')
      .replace(/\{\{lastName\}\}/g, customer.last_name || '')
      .replace(/\{\{email\}\}/g, customer.email || '')
      .replace(/\{\{totalSpent\}\}/g, `$${totalSpent.toFixed(2)}`)
      .replace(/\{\{orderCount\}\}/g, orderCount.toString())
      .replace(/\{\{preferredCategory\}\}/g, preferredCategories[0] || 'our products');

    // Add dynamic product recommendations
    if (recommendations.length > 0) {
      const recommendationHtml = recommendations.map(product => `
        <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px;">
          <h3>${product.title}</h3>
          <p style="font-size: 18px; color: #333;">$${product.price}</p>
          <p>${product.description}</p>
        </div>
      `).join('');

      personalizedContent = personalizedContent.replace(
        /\{\{productRecommendations\}\}/g,
        recommendationHtml
      );
    }

    return personalizedContent;
  }

  /**
   * Get optimal send time for a customer based on their behavior
   */
  async getOptimalSendTime(customerId: string): Promise<{ hour: number; dayOfWeek: number }> {
    const supabase = createClient();
    
    // Get email engagement history
    const { data: emailEvents } = await supabase
      .from('email_sends')
      .select(`
        sent_at,
        opened_at,
        clicked_at
      `)
      .eq('recipient_email', customerId)
      .not('opened_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (!emailEvents || emailEvents.length === 0) {
      // Default optimal times if no history
      return { hour: 10, dayOfWeek: 2 }; // Tuesday 10 AM
    }

    // Analyze engagement patterns
    const hourEngagement = new Map<number, number>();
    const dayEngagement = new Map<number, number>();

    emailEvents.forEach(event => {
      const sentDate = new Date(event.sent_at);
      const openedDate = event.opened_at ? new Date(event.opened_at) : null;
      
      if (openedDate) {
        const hour = openedDate.getHours();
        const dayOfWeek = openedDate.getDay();
        
        hourEngagement.set(hour, (hourEngagement.get(hour) || 0) + 1);
        dayEngagement.set(dayOfWeek, (dayEngagement.get(dayOfWeek) || 0) + 1);
      }
    });

    // Find most engaged hour and day
    const bestHour = this.getMaxKey(hourEngagement) || 10;
    const bestDay = this.getMaxKey(dayEngagement) || 2;

    return { hour: bestHour, dayOfWeek: bestDay };
  }

  /**
   * Utility functions
   */
  private calculateCustomerValue(customer: any): number {
    if (!customer.order_items) return 0;
    
    return customer.order_items.reduce((total: number, item: any) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  private daysSince(date: string): number {
    const then = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  }

  private daysSinceLastOrder(customer: any): number {
    if (!customer.orders || customer.orders.length === 0) return Infinity;
    
    const lastOrderDate = Math.max(...customer.orders.map((order: any) => 
      new Date(order.created_at).getTime()
    ));
    
    return Math.floor((Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24));
  }

  private getPreferredCategories(customer: any): string[] {
    if (!customer.order_items) return [];
    
    const categoryCount = new Map<string, number>();
    
    customer.order_items.forEach((item: any) => {
      const category = item.products?.category;
      if (category) {
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      }
    });

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
  }

  private getMaxKey<T>(map: Map<T, number>): T | undefined {
    let maxKey: T | undefined;
    let maxValue = -1;
    
    map.forEach((value, key) => {
      if (value > maxValue) {
        maxValue = value;
        maxKey = key;
      }
    });
    
    return maxKey;
  }

  private async storeSegments(segments: CustomerSegment[]) {
    const supabase = createClient();
    
    try {
      await supabase.from('customer_segments').upsert(
        segments.map(segment => ({
          id: segment.id,
          name: segment.name,
          criteria: segment.criteria,
          customer_count: segment.customerCount,
          updated_at: new Date().toISOString()
        }))
      );
    } catch (error) {
      console.error('Failed to store segments:', error);
    }
  }
}

export const personalizationEngine = new PersonalizationEngine();