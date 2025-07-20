import { Redis } from 'ioredis';

interface UserProfile {
  userId?: string;
  sessionId: string;
  attributes: {
    segment: string[];
    preferences: Record<string, any>;
    behavior: {
      totalVisits: number;
      totalPurchases: number;
      totalSpent: number;
      avgOrderValue: number;
      lastVisit: Date;
      lastPurchase?: Date;
      viewedProducts: string[];
      purchasedProducts: string[];
      cartAbandonment: number;
      engagementScore: number;
    };
    demographics?: {
      age?: number;
      gender?: string;
      location?: {
        country: string;
        region: string;
        city?: string;
      };
    };
    device: {
      primary: string;
      all: string[];
    };
  };
  computedMetrics: {
    lifetimeValue: number;
    churnProbability: number;
    nextPurchaseProbability: number;
    recommendationAffinity: Record<string, number>;
  };
  privacySettings: {
    consentLevel: 'full' | 'essential' | 'none';
    dataRetention: number; // days
    anonymized: boolean;
  };
}

export class UserProfiler {
  private redis: Redis;
  private config: any;

  constructor(redis: Redis, config: any) {
    this.redis = redis;
    this.config = config;
  }

  async getProfile(context: any): Promise<UserProfile> {
    const key = this.getProfileKey(context);
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    // Build profile from various sources
    const profile = await this.buildProfile(context);
    
    // Cache profile
    await this.redis.setex(key, 3600, JSON.stringify(profile)); // 1 hour cache

    return profile;
  }

  async updateProfile(context: any, event: any): Promise<void> {
    const profile = await this.getProfile(context);

    // Update based on event type
    switch (event.type) {
      case 'page_view':
        profile.attributes.behavior.totalVisits++;
        profile.attributes.behavior.lastVisit = new Date();
        break;

      case 'product_view':
        if (!profile.attributes.behavior.viewedProducts.includes(event.productId)) {
          profile.attributes.behavior.viewedProducts.push(event.productId);
        }
        await this.updateRecommendationAffinity(profile, event.productId);
        break;

      case 'add_to_cart':
        await this.updateCartBehavior(profile, event);
        break;

      case 'purchase':
        await this.updatePurchaseBehavior(profile, event);
        break;

      case 'search':
        await this.updateSearchPreferences(profile, event);
        break;
    }

    // Recompute metrics
    await this.computeMetrics(profile);

    // Save updated profile
    const key = this.getProfileKey(context);
    await this.redis.setex(key, 3600, JSON.stringify(profile));
  }

  private async buildProfile(context: any): Promise<UserProfile> {
    const userId = context.userId || context.sessionId;

    // Fetch historical data
    const [
      purchaseHistory,
      browsingHistory,
      deviceHistory,
      preferences
    ] = await Promise.all([
      this.getPurchaseHistory(userId),
      this.getBrowsingHistory(userId),
      this.getDeviceHistory(userId),
      this.getPreferences(userId)
    ]);

    const profile: UserProfile = {
      userId: context.userId,
      sessionId: context.sessionId,
      attributes: {
        segment: await this.computeSegments(purchaseHistory, browsingHistory),
        preferences: preferences || {},
        behavior: {
          totalVisits: browsingHistory.length,
          totalPurchases: purchaseHistory.length,
          totalSpent: this.calculateTotalSpent(purchaseHistory),
          avgOrderValue: this.calculateAvgOrderValue(purchaseHistory),
          lastVisit: new Date(),
          lastPurchase: purchaseHistory[0]?.date,
          viewedProducts: browsingHistory.map(h => h.productId),
          purchasedProducts: purchaseHistory.map(p => p.productId),
          cartAbandonment: await this.getCartAbandonmentRate(userId),
          engagementScore: await this.calculateEngagementScore(browsingHistory)
        },
        demographics: context.demographics,
        device: {
          primary: context.device,
          all: deviceHistory
        }
      },
      computedMetrics: {
        lifetimeValue: 0,
        churnProbability: 0,
        nextPurchaseProbability: 0,
        recommendationAffinity: {}
      },
      privacySettings: {
        consentLevel: 'balanced' as any,
        dataRetention: 365,
        anonymized: false
      }
    };

    // Compute advanced metrics
    await this.computeMetrics(profile);

    return profile;
  }

  private async computeMetrics(profile: UserProfile): Promise<void> {
    // Calculate lifetime value
    profile.computedMetrics.lifetimeValue = await this.calculateLTV(profile);

    // Calculate churn probability using simple heuristics
    profile.computedMetrics.churnProbability = await this.calculateChurnProbability(profile);

    // Calculate next purchase probability
    profile.computedMetrics.nextPurchaseProbability = await this.calculatePurchaseProbability(profile);

    // Update recommendation affinities
    profile.computedMetrics.recommendationAffinity = await this.calculateAffinities(profile);
  }

  private async calculateLTV(profile: UserProfile): Promise<number> {
    const { behavior } = profile.attributes;
    
    // Simple LTV calculation
    const avgPurchaseFrequency = behavior.totalPurchases / 12; // Assuming 12 months
    const projectedPurchases = avgPurchaseFrequency * 24; // 24 month projection
    
    return behavior.avgOrderValue * projectedPurchases;
  }

  private async calculateChurnProbability(profile: UserProfile): Promise<number> {
    const { behavior } = profile.attributes;
    
    // Days since last visit
    const daysSinceLastVisit = (Date.now() - behavior.lastVisit.getTime()) / (1000 * 60 * 60 * 24);
    
    // Days since last purchase
    const daysSinceLastPurchase = behavior.lastPurchase
      ? (Date.now() - behavior.lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Simple churn score (0-1)
    let churnScore = 0;
    
    if (daysSinceLastVisit > 30) churnScore += 0.3;
    if (daysSinceLastVisit > 60) churnScore += 0.2;
    if (daysSinceLastPurchase > 90) churnScore += 0.3;
    if (behavior.cartAbandonment > 0.5) churnScore += 0.2;

    return Math.min(churnScore, 1);
  }

  private async calculatePurchaseProbability(profile: UserProfile): Promise<number> {
    const { behavior } = profile.attributes;
    
    // Factors that increase purchase probability
    let score = 0;
    
    // Recent activity
    const daysSinceLastVisit = (Date.now() - behavior.lastVisit.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastVisit < 7) score += 0.3;
    
    // High engagement
    if (behavior.engagementScore > 0.7) score += 0.3;
    
    // Purchase history
    if (behavior.totalPurchases > 0) score += 0.2;
    
    // Recent cart activity
    if (behavior.cartAbandonment < 0.3) score += 0.2;

    return Math.min(score, 1);
  }

  private async calculateAffinities(profile: UserProfile): Promise<Record<string, number>> {
    const affinities: Record<string, number> = {};
    
    // Calculate category affinities based on viewed and purchased products
    const allProducts = [
      ...profile.attributes.behavior.viewedProducts,
      ...profile.attributes.behavior.purchasedProducts
    ];

    // This would normally fetch product categories from a database
    // For now, we'll use a simple mock
    const categories = ['electronics', 'clothing', 'home', 'sports', 'books'];
    
    categories.forEach(category => {
      affinities[category] = Math.random(); // Replace with actual calculation
    });

    return affinities;
  }

  private async updateRecommendationAffinity(profile: UserProfile, productId: string): Promise<void> {
    // Update affinity scores based on product interaction
    // This would normally look up the product category and update scores
  }

  private async updateCartBehavior(profile: UserProfile, event: any): Promise<void> {
    // Track cart additions
    const cartKey = `cart:${profile.userId || profile.sessionId}`;
    await this.redis.sadd(cartKey, event.productId);
    await this.redis.expire(cartKey, 86400); // 24 hour expiry
  }

  private async updatePurchaseBehavior(profile: UserProfile, event: any): Promise<void> {
    const { behavior } = profile.attributes;
    
    behavior.totalPurchases++;
    behavior.totalSpent += event.amount;
    behavior.avgOrderValue = behavior.totalSpent / behavior.totalPurchases;
    behavior.lastPurchase = new Date();
    
    if (!behavior.purchasedProducts.includes(event.productId)) {
      behavior.purchasedProducts.push(event.productId);
    }
  }

  private async updateSearchPreferences(profile: UserProfile, event: any): Promise<void> {
    // Track search terms and categories
    const searchKey = `searches:${profile.userId || profile.sessionId}`;
    await this.redis.lpush(searchKey, event.query);
    await this.redis.ltrim(searchKey, 0, 99); // Keep last 100 searches
  }

  private getProfileKey(context: any): string {
    return `profile:${context.userId || context.sessionId}`;
  }

  private async getPurchaseHistory(userId: string): Promise<any[]> {
    // Mock implementation - would fetch from database
    return [];
  }

  private async getBrowsingHistory(userId: string): Promise<any[]> {
    // Mock implementation - would fetch from database
    return [];
  }

  private async getDeviceHistory(userId: string): Promise<string[]> {
    // Mock implementation - would fetch from database
    return ['desktop', 'mobile'];
  }

  private async getPreferences(userId: string): Promise<any> {
    // Mock implementation - would fetch from database
    return {};
  }

  private calculateTotalSpent(purchases: any[]): number {
    return purchases.reduce((sum, p) => sum + p.amount, 0);
  }

  private calculateAvgOrderValue(purchases: any[]): number {
    if (purchases.length === 0) return 0;
    return this.calculateTotalSpent(purchases) / purchases.length;
  }

  private async getCartAbandonmentRate(userId: string): Promise<number> {
    // Mock implementation
    return 0.3;
  }

  private async calculateEngagementScore(history: any[]): Promise<number> {
    // Simple engagement score based on activity
    const recentActivity = history.filter(h => {
      const daysAgo = (Date.now() - h.timestamp) / (1000 * 60 * 60 * 24);
      return daysAgo < 30;
    });

    return Math.min(recentActivity.length / 10, 1);
  }

  private async computeSegments(purchases: any[], browsing: any[]): Promise<string[]> {
    const segments: string[] = ['all_users'];

    // High value customer
    if (purchases.length > 5) {
      segments.push('high_value');
    }

    // New customer
    if (purchases.length === 0) {
      segments.push('new_user');
    }

    // Frequent browser
    if (browsing.length > 20) {
      segments.push('frequent_browser');
    }

    return segments;
  }
}