import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { userProfiler, UserProfile } from './user-profiler';
import { behaviorTracker } from './behavior-tracker';

// Preference schemas
export const PreferenceSchema = z.object({
  userId: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  preferenceType: z.enum(['explicit', 'implicit', 'inferred']),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  source: z.enum(['survey', 'behavior', 'purchase', 'feedback', 'ml_inference']),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional()
});

export const PreferenceContextSchema = z.object({
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter']).optional(),
  weather: z.enum(['sunny', 'rainy', 'cloudy', 'snowy']).optional(),
  location: z.string().optional(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  channel: z.enum(['website', 'mobile_app', 'email', 'social']).optional()
});

export type Preference = z.infer<typeof PreferenceSchema>;
export type PreferenceContext = z.infer<typeof PreferenceContextSchema>;

interface LearningSignal {
  userId: string;
  signal: 'positive' | 'negative' | 'neutral';
  strength: number; // 0-1
  context: PreferenceContext;
  productId?: string;
  category?: string;
  attributes?: Record<string, any>;
  timestamp: Date;
}

export class PreferenceEngine {
  private static instance: PreferenceEngine;
  private learningQueue: LearningSignal[] = [];
  private preferenceCache: Map<string, Map<string, Preference[]>> = new Map();
  private modelWeights: Map<string, number> = new Map();

  static getInstance(): PreferenceEngine {
    if (!PreferenceEngine.instance) {
      PreferenceEngine.instance = new PreferenceEngine();
      PreferenceEngine.instance.initializeModels();
    }
    return PreferenceEngine.instance;
  }

  /**
   * Learn user preferences from behavior signals
   */
  async learnFromSignal(signal: LearningSignal): Promise<void> {
    this.learningQueue.push(signal);
    
    // Process immediately for strong signals
    if (signal.strength >= 0.8) {
      await this.processLearningSignal(signal);
    }

    // Batch process periodically
    if (this.learningQueue.length >= 50) {
      await this.processBatchLearning();
    }
  }

  /**
   * Get user preferences with context
   */
  async getUserPreferences(
    userId: string, 
    context?: PreferenceContext
  ): Promise<Preference[]> {
    const cacheKey = this.getCacheKey(userId, context);
    const cached = this.preferenceCache.get(userId)?.get(cacheKey);
    
    if (cached) return cached;

    const preferences = await this.buildContextualPreferences(userId, context);
    
    // Cache preferences
    if (!this.preferenceCache.has(userId)) {
      this.preferenceCache.set(userId, new Map());
    }
    this.preferenceCache.get(userId)!.set(cacheKey, preferences);

    return preferences;
  }

  /**
   * Update explicit user preferences
   */
  async updateExplicitPreferences(
    userId: string,
    preferences: Array<{
      category: string;
      subcategory?: string;
      weight: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    const updates = preferences.map(pref => ({
      userId,
      category: pref.category,
      subcategory: pref.subcategory,
      preferenceType: 'explicit' as const,
      weight: pref.weight,
      confidence: 1.0, // Explicit preferences have full confidence
      source: 'survey' as const,
      metadata: pref.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await this.savePreferences(updates);
    this.invalidateCache(userId);
  }

  /**
   * Infer preferences from user behavior
   */
  async inferFromBehavior(userId: string): Promise<Preference[]> {
    const profile = await userProfiler.getProfile(userId);
    const patterns = await behaviorTracker.detectPatterns(userId);
    
    const inferred: Preference[] = [];

    // Infer from purchase history
    const categoryPrefs = this.inferCategoryPreferences(profile);
    inferred.push(...categoryPrefs);

    // Infer from browsing patterns
    const browsingPrefs = this.inferBrowsingPreferences(profile);
    inferred.push(...browsingPrefs);

    // Infer from behavioral patterns
    const patternPrefs = this.inferPatternPreferences(patterns);
    inferred.push(...patternPrefs);

    // Infer from time-based behavior
    const temporalPrefs = this.inferTemporalPreferences(profile);
    inferred.push(...temporalPrefs);

    await this.savePreferences(inferred);
    return inferred;
  }

  /**
   * Get preference affinity for specific items
   */
  async getAffinityScore(
    userId: string,
    itemAttributes: Record<string, any>,
    context?: PreferenceContext
  ): Promise<number> {
    const preferences = await this.getUserPreferences(userId, context);
    
    let totalScore = 0;
    let weightSum = 0;

    for (const preference of preferences) {
      const relevance = this.calculateRelevance(preference, itemAttributes);
      const contextualWeight = this.applyContextualWeighting(preference, context);
      
      totalScore += preference.weight * preference.confidence * relevance * contextualWeight;
      weightSum += preference.confidence * contextualWeight;
    }

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Predict user satisfaction for an item
   */
  async predictSatisfaction(
    userId: string,
    productId: string,
    context?: PreferenceContext
  ): Promise<{ score: number; confidence: number; reasons: string[] }> {
    const product = await this.getProductAttributes(productId);
    const affinity = await this.getAffinityScore(userId, product, context);
    const profile = await userProfiler.getProfile(userId);
    
    // Factor in past satisfaction with similar items
    const similarSatisfaction = await this.getSimilarItemSatisfaction(userId, product);
    
    // Combine scores
    const score = (affinity * 0.7) + (similarSatisfaction * 0.3);
    const confidence = this.calculatePredictionConfidence(profile, product);
    
    const reasons = this.generateSatisfactionReasons(affinity, similarSatisfaction, product);

    return { score, confidence, reasons };
  }

  /**
   * Get personalized recommendations based on preferences
   */
  async getPersonalizedRecommendations(
    userId: string,
    options: {
      limit?: number;
      categories?: string[];
      excludeViewed?: boolean;
      context?: PreferenceContext;
    } = {}
  ): Promise<Array<{ productId: string; score: number; reasons: string[] }>> {
    const preferences = await this.getUserPreferences(userId, options.context);
    const profile = await userProfiler.getProfile(userId);
    
    // Get candidate products
    const candidates = await this.getCandidateProducts({
      categories: options.categories,
      excludeUserId: options.excludeViewed ? userId : undefined,
      limit: (options.limit || 10) * 5 // Get more candidates for better filtering
    });

    // Score each candidate
    const scored = await Promise.all(
      candidates.map(async (product) => {
        const affinityScore = await this.getAffinityScore(userId, product.attributes, options.context);
        const noveltyScore = this.calculateNoveltyScore(profile, product);
        const popularityScore = product.popularityScore || 0;
        
        // Combine scores with weights
        const finalScore = (affinityScore * 0.6) + (noveltyScore * 0.2) + (popularityScore * 0.2);
        
        const reasons = this.generateRecommendationReasons(
          affinityScore,
          noveltyScore,
          popularityScore,
          preferences,
          product
        );

        return {
          productId: product.id,
          score: finalScore,
          reasons
        };
      })
    );

    // Sort and limit results
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }

  /**
   * Learn from user feedback on recommendations
   */
  async learnFromFeedback(
    userId: string,
    productId: string,
    feedback: 'like' | 'dislike' | 'neutral' | 'purchase' | 'ignore',
    context?: PreferenceContext
  ): Promise<void> {
    const product = await this.getProductAttributes(productId);
    
    let signal: 'positive' | 'negative' | 'neutral';
    let strength: number;

    switch (feedback) {
      case 'purchase':
        signal = 'positive';
        strength = 1.0;
        break;
      case 'like':
        signal = 'positive';
        strength = 0.8;
        break;
      case 'dislike':
        signal = 'negative';
        strength = 0.9;
        break;
      case 'ignore':
        signal = 'negative';
        strength = 0.3;
        break;
      default:
        signal = 'neutral';
        strength = 0.1;
    }

    await this.learnFromSignal({
      userId,
      signal,
      strength,
      context: context || {},
      productId,
      category: product.category,
      attributes: product,
      timestamp: new Date()
    });
  }

  // Private methods

  private async initializeModels(): Promise<void> {
    // Initialize ML model weights
    this.modelWeights.set('category_affinity', 0.3);
    this.modelWeights.set('attribute_matching', 0.25);
    this.modelWeights.set('temporal_patterns', 0.2);
    this.modelWeights.set('social_signals', 0.15);
    this.modelWeights.set('novelty_factor', 0.1);
  }

  private async processLearningSignal(signal: LearningSignal): Promise<void> {
    // Extract learnings from the signal
    const learnings = this.extractLearnings(signal);
    
    // Update or create preferences
    for (const learning of learnings) {
      await this.updatePreference(signal.userId, learning);
    }

    // Invalidate relevant caches
    this.invalidateCache(signal.userId);
  }

  private async processBatchLearning(): Promise<void> {
    const signals = this.learningQueue.splice(0, 50);
    
    // Group by user for efficient processing
    const userSignals = new Map<string, LearningSignal[]>();
    signals.forEach(signal => {
      if (!userSignals.has(signal.userId)) {
        userSignals.set(signal.userId, []);
      }
      userSignals.get(signal.userId)!.push(signal);
    });

    // Process each user's signals
    for (const [userId, userSignalList] of userSignals.entries()) {
      await this.processUserSignals(userId, userSignalList);
    }
  }

  private async processUserSignals(userId: string, signals: LearningSignal[]): Promise<void> {
    // Aggregate signals for more robust learning
    const aggregated = this.aggregateSignals(signals);
    
    for (const agg of aggregated) {
      await this.processLearningSignal(agg);
    }
  }

  private extractLearnings(signal: LearningSignal): Array<{
    category: string;
    subcategory?: string;
    weight: number;
    confidence: number;
    source: string;
  }> {
    const learnings: any[] = [];

    if (signal.category) {
      learnings.push({
        category: signal.category,
        weight: signal.signal === 'positive' ? signal.strength : -signal.strength * 0.5,
        confidence: signal.strength,
        source: 'behavior'
      });
    }

    // Extract attribute-based learnings
    if (signal.attributes) {
      Object.entries(signal.attributes).forEach(([attr, value]) => {
        if (typeof value === 'string' && value.length < 50) {
          learnings.push({
            category: `attribute_${attr}`,
            subcategory: value,
            weight: signal.signal === 'positive' ? signal.strength * 0.7 : -signal.strength * 0.3,
            confidence: signal.strength * 0.8,
            source: 'behavior'
          });
        }
      });
    }

    return learnings;
  }

  private async buildContextualPreferences(
    userId: string,
    context?: PreferenceContext
  ): Promise<Preference[]> {
    // Get base preferences
    const base = await this.getStoredPreferences(userId);
    
    // Apply contextual adjustments
    const contextual = context ? this.applyContextualAdjustments(base, context) : base;
    
    // Apply temporal decay
    const decayed = this.applyTemporalDecay(contextual);
    
    // Merge with inferred preferences
    const inferred = await this.inferFromBehavior(userId);
    const merged = this.mergePreferences(decayed, inferred);

    return merged;
  }

  private inferCategoryPreferences(profile: UserProfile): Preference[] {
    const preferences: Preference[] = [];
    
    profile.preferences.categories.forEach((category, index) => {
      const weight = Math.max(0.1, 1 - (index * 0.1)); // Diminishing weights
      
      preferences.push({
        userId: profile.userId,
        category: 'product_category',
        subcategory: category,
        preferenceType: 'inferred',
        weight,
        confidence: 0.8,
        source: 'behavior',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    return preferences;
  }

  private inferBrowsingPreferences(profile: UserProfile): Preference[] {
    const preferences: Preference[] = [];
    
    // Analyze browsing patterns
    const categoryViews = new Map<string, number>();
    profile.behavior.browsingHistory.forEach(view => {
      categoryViews.set(view.category, (categoryViews.get(view.category) || 0) + 1);
    });

    const totalViews = profile.behavior.browsingHistory.length;
    
    categoryViews.forEach((views, category) => {
      const weight = views / totalViews;
      if (weight > 0.05) { // Only include categories with >5% of views
        preferences.push({
          userId: profile.userId,
          category: 'browsing_interest',
          subcategory: category,
          preferenceType: 'inferred',
          weight,
          confidence: 0.6,
          source: 'behavior',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    return preferences;
  }

  private inferPatternPreferences(patterns: any[]): Preference[] {
    const preferences: Preference[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.pattern.includes('prefers_category_')) {
        const category = pattern.pattern.replace('prefers_category_', '');
        preferences.push({
          userId: '', // Will be set by caller
          category: 'behavioral_pattern',
          subcategory: category,
          preferenceType: 'inferred',
          weight: pattern.confidence,
          confidence: pattern.confidence,
          source: 'ml_inference',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    return preferences;
  }

  private inferTemporalPreferences(profile: UserProfile): Preference[] {
    const preferences: Preference[] = [];
    
    // Analyze time-based purchase patterns
    const hourlyPurchases = new Array(24).fill(0);
    profile.behavior.purchaseHistory.forEach(purchase => {
      const hour = purchase.timestamp.getHours();
      hourlyPurchases[hour]++;
    });

    const totalPurchases = profile.behavior.purchaseHistory.length;
    
    hourlyPurchases.forEach((count, hour) => {
      if (count / totalPurchases > 0.15) { // Active hour
        preferences.push({
          userId: profile.userId,
          category: 'temporal_pattern',
          subcategory: `active_hour_${hour}`,
          preferenceType: 'inferred',
          weight: count / totalPurchases,
          confidence: 0.7,
          source: 'behavior',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    return preferences;
  }

  private calculateRelevance(preference: Preference, itemAttributes: Record<string, any>): number {
    if (preference.category === 'product_category') {
      return itemAttributes.category === preference.subcategory ? 1.0 : 0.0;
    }
    
    if (preference.category.startsWith('attribute_')) {
      const attr = preference.category.replace('attribute_', '');
      return itemAttributes[attr] === preference.subcategory ? 1.0 : 0.0;
    }

    // Default relevance calculation
    return 0.5;
  }

  private applyContextualWeighting(preference: Preference, context?: PreferenceContext): number {
    if (!context) return 1.0;

    let weight = 1.0;

    // Time-based adjustments
    if (preference.category === 'temporal_pattern' && preference.subcategory) {
      const currentHour = new Date().getHours();
      if (preference.subcategory === `active_hour_${currentHour}`) {
        weight *= 1.5; // Boost preferences for current time
      }
    }

    // Device-based adjustments
    if (context.deviceType === 'mobile' && preference.category === 'browsing_interest') {
      weight *= 1.2; // Boost browsing preferences on mobile
    }

    return weight;
  }

  private async getProductAttributes(productId: string): Promise<Record<string, any>> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true
      }
    });

    if (!product) return {};

    return {
      id: product.id,
      category: product.category?.name || 'unknown',
      price: product.price,
      brand: product.brand,
      color: product.variants[0]?.color,
      size: product.variants[0]?.size,
      style: product.style,
      tags: product.tags
    };
  }

  private async getSimilarItemSatisfaction(userId: string, product: Record<string, any>): Promise<number> {
    // Get user's ratings for similar products
    const similarProducts = await prisma.orderItem.findMany({
      where: {
        order: { userId },
        product: {
          category: {
            name: product.category
          }
        },
        rating: { not: null }
      },
      select: { rating: true }
    });

    if (similarProducts.length === 0) return 0.5; // Neutral if no data

    const avgRating = similarProducts.reduce((sum, item) => sum + (item.rating || 0), 0) / similarProducts.length;
    return avgRating / 5; // Normalize to 0-1
  }

  private calculatePredictionConfidence(profile: UserProfile, product: Record<string, any>): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data availability
    if (profile.behavior.purchaseHistory.length > 10) confidence += 0.2;
    if (profile.behavior.browsingHistory.length > 50) confidence += 0.1;
    if (profile.scores.engagementScore > 50) confidence += 0.1;

    // Decrease confidence for new or unusual products
    if (!product.category || product.category === 'unknown') confidence -= 0.2;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateSatisfactionReasons(
    affinity: number,
    similarSatisfaction: number,
    product: Record<string, any>
  ): string[] {
    const reasons: string[] = [];

    if (affinity > 0.7) reasons.push('Matches your preferences well');
    if (affinity > 0.8) reasons.push('Very similar to items you\'ve liked');
    if (similarSatisfaction > 0.7) reasons.push('You\'ve enjoyed similar products');
    if (product.category) reasons.push(`Popular in ${product.category}`);

    return reasons;
  }

  private calculateNoveltyScore(profile: UserProfile, product: Record<string, any>): number {
    // Check if user has seen this category before
    const seenCategories = new Set(profile.behavior.browsingHistory.map(b => b.category));
    
    if (!seenCategories.has(product.category)) {
      return 1.0; // High novelty for new categories
    }

    // Check if user has seen this specific product
    const seenProducts = new Set(profile.behavior.browsingHistory.map(b => b.productId));
    
    if (seenProducts.has(product.id)) {
      return 0.0; // No novelty for seen products
    }

    return 0.5; // Medium novelty for new products in known categories
  }

  private async getCandidateProducts(options: {
    categories?: string[];
    excludeUserId?: string;
    limit?: number;
  }): Promise<Array<{ id: string; attributes: Record<string, any>; popularityScore: number }>> {
    const where: any = {};
    
    if (options.categories?.length) {
      where.category = { name: { in: options.categories } };
    }

    if (options.excludeUserId) {
      // Exclude products already viewed by user
      where.NOT = {
        views: {
          some: { userId: options.excludeUserId }
        }
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
        _count: { select: { views: true, orderItems: true } }
      },
      take: options.limit || 50
    });

    return products.map(product => ({
      id: product.id,
      attributes: {
        id: product.id,
        category: product.category?.name || 'unknown',
        price: product.price,
        brand: product.brand,
        color: product.variants[0]?.color,
        size: product.variants[0]?.size,
        style: product.style,
        tags: product.tags
      },
      popularityScore: (product._count.views + product._count.orderItems * 5) / 100
    }));
  }

  private generateRecommendationReasons(
    affinity: number,
    novelty: number,
    popularity: number,
    preferences: Preference[],
    product: any
  ): string[] {
    const reasons: string[] = [];

    if (affinity > 0.8) reasons.push('Perfect match for your style');
    else if (affinity > 0.6) reasons.push('Matches your preferences');

    if (novelty > 0.8) reasons.push('New discovery for you');
    else if (novelty > 0.5) reasons.push('Similar to items you like');

    if (popularity > 0.7) reasons.push('Trending and popular');

    // Add specific preference matches
    const categoryPref = preferences.find(p => 
      p.category === 'product_category' && p.subcategory === product.attributes.category
    );
    if (categoryPref && categoryPref.weight > 0.6) {
      reasons.push(`Popular in ${product.attributes.category} - your favorite category`);
    }

    return reasons.slice(0, 3); // Limit to top 3 reasons
  }

  private getCacheKey(userId: string, context?: PreferenceContext): string {
    if (!context) return 'default';
    
    const contextStr = Object.entries(context)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    
    return contextStr;
  }

  private async getStoredPreferences(userId: string): Promise<Preference[]> {
    const stored = await prisma.userPreference.findMany({
      where: { userId }
    });

    return stored.map(pref => ({
      userId: pref.userId,
      category: pref.category,
      subcategory: pref.subcategory || undefined,
      preferenceType: pref.preferenceType as any,
      weight: pref.weight,
      confidence: pref.confidence,
      source: pref.source as any,
      metadata: pref.metadata ? JSON.parse(pref.metadata) : undefined,
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
      expiresAt: pref.expiresAt || undefined
    }));
  }

  private applyContextualAdjustments(preferences: Preference[], context: PreferenceContext): Preference[] {
    return preferences.map(pref => ({
      ...pref,
      weight: pref.weight * this.applyContextualWeighting(pref, context)
    }));
  }

  private applyTemporalDecay(preferences: Preference[]): Preference[] {
    const now = Date.now();
    
    return preferences.map(pref => {
      const ageInDays = (now - pref.updatedAt.getTime()) / (24 * 60 * 60 * 1000);
      const decayFactor = Math.exp(-ageInDays / 30); // 30-day half-life
      
      return {
        ...pref,
        weight: pref.weight * decayFactor,
        confidence: pref.confidence * decayFactor
      };
    });
  }

  private mergePreferences(base: Preference[], inferred: Preference[]): Preference[] {
    const merged = new Map<string, Preference>();
    
    // Add base preferences
    base.forEach(pref => {
      const key = `${pref.category}:${pref.subcategory || ''}`;
      merged.set(key, pref);
    });

    // Merge inferred preferences
    inferred.forEach(pref => {
      const key = `${pref.category}:${pref.subcategory || ''}`;
      const existing = merged.get(key);
      
      if (existing) {
        // Combine weights and confidences
        merged.set(key, {
          ...existing,
          weight: (existing.weight + pref.weight) / 2,
          confidence: Math.max(existing.confidence, pref.confidence),
          updatedAt: new Date()
        });
      } else {
        merged.set(key, pref);
      }
    });

    return Array.from(merged.values());
  }

  private aggregateSignals(signals: LearningSignal[]): LearningSignal[] {
    const aggregated = new Map<string, LearningSignal>();
    
    signals.forEach(signal => {
      const key = `${signal.category || 'unknown'}:${signal.productId || 'unknown'}`;
      const existing = aggregated.get(key);
      
      if (existing) {
        // Average the signals
        const combinedStrength = (existing.strength + signal.strength) / 2;
        aggregated.set(key, {
          ...existing,
          strength: combinedStrength,
          timestamp: new Date()
        });
      } else {
        aggregated.set(key, signal);
      }
    });

    return Array.from(aggregated.values());
  }

  private async updatePreference(userId: string, learning: any): Promise<void> {
    await prisma.userPreference.upsert({
      where: {
        userId_category_subcategory: {
          userId,
          category: learning.category,
          subcategory: learning.subcategory || ''
        }
      },
      update: {
        weight: learning.weight,
        confidence: learning.confidence,
        updatedAt: new Date()
      },
      create: {
        userId,
        category: learning.category,
        subcategory: learning.subcategory,
        preferenceType: 'inferred',
        weight: learning.weight,
        confidence: learning.confidence,
        source: learning.source,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  private async savePreferences(preferences: Preference[]): Promise<void> {
    for (const pref of preferences) {
      await this.updatePreference(pref.userId, {
        category: pref.category,
        subcategory: pref.subcategory,
        weight: pref.weight,
        confidence: pref.confidence,
        source: pref.source
      });
    }
  }

  private invalidateCache(userId: string): void {
    this.preferenceCache.delete(userId);
  }
}

export const preferenceEngine = PreferenceEngine.getInstance();