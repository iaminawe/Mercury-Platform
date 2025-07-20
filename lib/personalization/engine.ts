import { Redis } from 'ioredis';
import { UserProfiler } from './user-profiler';
import { ContentPersonalizer } from './content-personalizer';
import { RecommendationEngine } from './recommendation-engine';
import { SegmentMatcher } from './segment-matcher';
import { MLModels } from './ml-models';
import { RealTimeEngine } from './real-time-engine';
import { BehaviorTracker } from './behavior-tracker';
import { PreferenceEngine } from './preference-engine';
import { analytics } from '@/lib/analytics';
import { neuralCollaborativeFiltering } from './neural-cf';
import { reinforcementLearning } from './reinforcement-learning';
import { crossDeviceTracking } from './cross-device';
import { abTestFramework } from './ab-testing';

interface PersonalizationConfig {
  redis: Redis;
  enableRealTime?: boolean;
  cacheTimeout?: number;
  privacyMode?: 'strict' | 'balanced' | 'full';
  mlThreshold?: number;
  enableMultiArmedBandit?: boolean;
  enableColdStartOptimization?: boolean;
  enableDeepLearning?: boolean;
  enableCollaborativeFiltering?: boolean;
  abTestingEnabled?: boolean;
  performanceThreshold?: number;
  enableNeuralCF?: boolean;
  enableReinforcementLearning?: boolean;
  enableCrossDevice?: boolean;
  enableAutoOptimization?: boolean;
  neuralThreshold?: number;
  rlExplorationRate?: number;
  crossDeviceWindow?: number;
}

interface PersonalizationContext {
  userId?: string;
  sessionId: string;
  device: string;
  location?: {
    country: string;
    region: string;
    city?: string;
  };
  referrer?: string;
  currentPage: string;
  timestamp: number;
}

interface PersonalizationResult {
  segments: string[];
  recommendations: any[];
  personalizedContent: Record<string, any>;
  experiments: Record<string, string>;
  decisionTime: number;
  mlPredictions?: {
    purchaseIntent: number;
    churnRisk: number;
    lifetimeValue: number;
    nextPurchaseDate?: Date;
    categoryAffinities: Record<string, number>;
  };
  realTimeSignals?: {
    sessionIntent: string;
    urgency: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
  confidenceScore: number;
  reasoning: string[];
}

export class PersonalizationEngine {
  private redis: Redis;
  private userProfiler: UserProfiler;
  private contentPersonalizer: ContentPersonalizer;
  private recommendationEngine: RecommendationEngine;
  private segmentMatcher: SegmentMatcher;
  private mlModels: MLModels;
  private realTimeEngine: RealTimeEngine;
  private behaviorTracker: BehaviorTracker;
  private preferenceEngine: PreferenceEngine;
  private config: PersonalizationConfig;
  private neuralCF: any;
  private reinforcementLearner: any;
  private crossDeviceTracker: any;
  private abTester: any;

  constructor(config: PersonalizationConfig) {
    this.config = {
      enableRealTime: true,
      cacheTimeout: 300, // 5 minutes
      privacyMode: 'balanced',
      mlThreshold: 0.7,
      enableMultiArmedBandit: true,
      enableColdStartOptimization: true,
      enableDeepLearning: true,
      enableCollaborativeFiltering: true,
      abTestingEnabled: true,
      performanceThreshold: 100, // 100ms target
      enableNeuralCF: true,
      enableReinforcementLearning: true,
      enableCrossDevice: true,
      enableAutoOptimization: true,
      neuralThreshold: 0.8,
      rlExplorationRate: 0.1,
      crossDeviceWindow: 7,
      ...config
    };

    this.redis = config.redis;
    this.userProfiler = new UserProfiler(this.redis, this.config);
    this.contentPersonalizer = new ContentPersonalizer(this.redis, this.config);
    this.recommendationEngine = new RecommendationEngine(this.redis, this.config);
    this.segmentMatcher = new SegmentMatcher(this.redis, this.config);
    this.mlModels = new MLModels();
    this.realTimeEngine = RealTimeEngine.getInstance();
    this.behaviorTracker = BehaviorTracker.getInstance();
    this.preferenceEngine = PreferenceEngine.getInstance();
    
    // Initialize advanced ML components
    if (this.config.enableNeuralCF) {
      this.neuralCF = neuralCollaborativeFiltering.getInstance();
    }
    if (this.config.enableReinforcementLearning) {
      this.reinforcementLearner = reinforcementLearning.getInstance();
    }
    if (this.config.enableCrossDevice) {
      this.crossDeviceTracker = crossDeviceTracking.getInstance();
    }
    if (this.config.abTestingEnabled) {
      this.abTester = abTestFramework.getInstance();
    }
  }

  async personalize(context: PersonalizationContext): Promise<PersonalizationResult> {
    const startTime = Date.now();
    const reasoning: string[] = [];

    try {
      // Check cache first if not in real-time mode
      const cacheKey = this.getCacheKey(context);
      const cached = await this.getCachedResult(cacheKey);
      if (cached && !this.config.enableRealTime) {
        return {
          ...cached,
          decisionTime: Date.now() - startTime
        };
      }

      // Start real-time session if enabled
      let sessionId = context.sessionId;
      if (this.config.enableRealTime && context.userId) {
        sessionId = await this.realTimeEngine.startSession(
          context.userId,
          context.device,
          context.currentPage
        );
        reasoning.push('Real-time session tracking enabled');
      }

      // Enhanced parallel execution with advanced ML models
      const [
        userProfile,
        segments,
        mlPredictions,
        personalizedContent,
        realTimeSignals,
        neuralRecommendations,
        crossDeviceProfile,
        rlRecommendations
      ] = await Promise.all([
        this.userProfiler.getProfile(context),
        this.segmentMatcher.match(context),
        this.config.enableDeepLearning 
          ? this.mlModels.predict(await this.userProfiler.getProfile(context), context)
          : Promise.resolve(null),
        this.contentPersonalizer.personalizeContent(context),
        this.config.enableRealTime 
          ? this.realTimeEngine.detectPurchaseIntent(context.userId!, sessionId)
          : Promise.resolve(null),
        this.config.enableNeuralCF && context.userId
          ? this.neuralCF.getNeuralRecommendations(context.userId, context)
          : Promise.resolve(null),
        this.config.enableCrossDevice && context.userId
          ? this.crossDeviceTracker.getCrossDeviceProfile(context.userId)
          : Promise.resolve(null),
        this.config.enableReinforcementLearning && context.userId
          ? this.reinforcementLearner.getOptimalActions(context.userId, context)
          : Promise.resolve(null)
      ]);

      // Advanced recommendations with multiple algorithms including neural networks
      const recommendations = await this.getAdvancedRecommendations(
        context, 
        userProfile, 
        segments, 
        mlPredictions,
        neuralRecommendations,
        crossDeviceProfile,
        rlRecommendations
      );

      // Multi-armed bandit for A/B testing
      const experiments = await this.getOptimizedExperiments(
        context, 
        segments, 
        mlPredictions
      );

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        userProfile,
        segments,
        mlPredictions,
        realTimeSignals
      );

      // Build reasoning
      reasoning.push(...this.buildReasoning(userProfile, segments, mlPredictions, realTimeSignals));

      const result: PersonalizationResult = {
        segments,
        recommendations,
        personalizedContent,
        experiments,
        decisionTime: Date.now() - startTime,
        mlPredictions: mlPredictions || undefined,
        realTimeSignals: realTimeSignals ? {
          sessionIntent: realTimeSignals.intent > 0.7 ? 'purchase' : 'browse',
          urgency: realTimeSignals.urgency,
          recommendations: realTimeSignals.recommendations
        } : undefined,
        confidenceScore,
        reasoning
      };

      // Cache result only if performance is good
      if (result.decisionTime <= this.config.performanceThreshold!) {
        await this.cacheResult(cacheKey, result);
      }

      // Track performance and learn
      await Promise.all([
        this.trackPerformance(result.decisionTime),
        this.updateLearningModels(context, result),
        this.trackPersonalizationMetrics(result, context)
      ]);

      return result;
    } catch (error) {
      console.error('Personalization error:', error);
      reasoning.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return enhanced default personalization
      return this.getEnhancedDefaultPersonalization(startTime, reasoning);
    }
  }

  async trackEvent(context: PersonalizationContext, event: any): Promise<void> {
    // Update user profile
    await this.userProfiler.updateProfile(context, event);

    // Update ML models
    if (this.config.enableRealTime) {
      await this.recommendationEngine.updateModel(context, event);
    }

    // Track for analytics
    await analytics.track({
      userId: context.userId || context.sessionId,
      event: 'personalization_event',
      properties: {
        ...event,
        context
      }
    });
  }

  async getPersonalizationMetrics(): Promise<any> {
    const [
      avgDecisionTime,
      cacheHitRate,
      conversionLift,
      engagementMetrics
    ] = await Promise.all([
      this.getAverageDecisionTime(),
      this.getCacheHitRate(),
      this.getConversionLift(),
      this.getEngagementMetrics()
    ]);

    return {
      performance: {
        avgDecisionTime,
        cacheHitRate,
        throughput: await this.getThroughput()
      },
      impact: {
        conversionLift,
        revenueImpact: await this.getRevenueImpact(),
        engagementMetrics
      },
      segments: await this.segmentMatcher.getSegmentStats(),
      recommendations: await this.recommendationEngine.getPerformanceStats()
    };
  }

  private getCacheKey(context: PersonalizationContext): string {
    const parts = [
      context.userId || context.sessionId,
      context.currentPage,
      context.device,
      context.location?.country
    ].filter(Boolean);
    
    return `personalization:${parts.join(':')}`;
  }

  private async getCachedResult(key: string): Promise<PersonalizationResult | null> {
    if (!this.config.enableRealTime) return null;
    
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheResult(key: string, result: PersonalizationResult): Promise<void> {
    await this.redis.setex(
      key,
      this.config.cacheTimeout!,
      JSON.stringify(result)
    );
  }

  private async getExperimentAssignments(
    context: PersonalizationContext,
    segments: string[]
  ): Promise<Record<string, string>> {
    // Simple experiment assignment based on user hash
    const experiments: Record<string, string> = {};
    const userId = context.userId || context.sessionId;
    const userHash = this.hashUserId(userId);

    // Example experiments
    if (segments.includes('high_value')) {
      experiments.premium_features = userHash % 2 === 0 ? 'variant_a' : 'control';
    }

    if (segments.includes('new_user')) {
      experiments.onboarding_flow = userHash % 3 === 0 ? 'guided' : 'self_serve';
    }

    return experiments;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getEnhancedDefaultPersonalization(startTime: number, reasoning: string[]): PersonalizationResult {
    return {
      segments: ['all_users'],
      recommendations: [],
      personalizedContent: {},
      experiments: {},
      decisionTime: Date.now() - startTime,
      confidenceScore: 0.3,
      reasoning: [...reasoning, 'Using default personalization due to insufficient data']
    };
  }

  /**
   * Advanced recommendations using multiple ML algorithms
   */
  private async getAdvancedRecommendations(
    context: PersonalizationContext,
    userProfile: any,
    segments: string[],
    mlPredictions: any
  ): Promise<any[]> {
    const recommendations = [];

    // Get base recommendations
    const baseRecs = await this.recommendationEngine.getRecommendations(context);
    recommendations.push(...baseRecs);

    // Enhance with collaborative filtering if enabled
    if (this.config.enableCollaborativeFiltering && mlPredictions) {
      const collaborativeRecs = await this.mlModels.getCollaborativeFilteringRecs(
        context.userId || context.sessionId
      );
      recommendations.push(...collaborativeRecs.products.map(productId => ({
        productId,
        score: collaborativeRecs.confidence,
        method: 'collaborative_filtering',
        reason: 'Based on users with similar preferences'
      })));
    }

    // Add content-based filtering
    const contentRecs = await this.mlModels.getContentBasedRecs(userProfile);
    recommendations.push(...contentRecs.products.map((productId, index) => ({
      productId,
      score: 0.9 - (index * 0.1),
      method: 'content_based',
      reason: contentRecs.reasons[index] || 'Matches your preferences'
    })));

    // Apply multi-armed bandit for optimization
    if (this.config.enableMultiArmedBandit) {
      return this.applyMultiArmedBandit(recommendations, context, segments);
    }

    // Remove duplicates and sort by score
    const uniqueRecs = this.deduplicateRecommendations(recommendations);
    return uniqueRecs.sort((a, b) => b.score - a.score).slice(0, 12);
  }

  /**
   * Optimized A/B testing using multi-armed bandit
   */
  private async getOptimizedExperiments(
    context: PersonalizationContext,
    segments: string[],
    mlPredictions: any
  ): Promise<Record<string, string>> {
    const experiments: Record<string, string> = {};

    if (!this.config.abTestingEnabled) return experiments;

    const userId = context.userId || context.sessionId;
    
    // Dynamic experiment assignment based on ML predictions
    if (mlPredictions?.purchaseIntent > 0.8) {
      experiments.checkout_optimization = await this.getBanditVariant(
        'checkout_optimization',
        userId,
        ['express_checkout', 'standard_checkout', 'one_click_checkout']
      );
    }

    if (segments.includes('new_user')) {
      experiments.onboarding_flow = await this.getBanditVariant(
        'onboarding_flow',
        userId,
        ['guided_tour', 'minimal_intro', 'gamified_onboarding']
      );
    }

    if (mlPredictions?.churnRisk > 0.6) {
      experiments.retention_strategy = await this.getBanditVariant(
        'retention_strategy',
        userId,
        ['discount_offer', 'loyalty_program', 'personalized_content']
      );
    }

    return experiments;
  }

  /**
   * Multi-armed bandit variant selection
   */
  private async getBanditVariant(
    experimentId: string,
    userId: string,
    variants: string[]
  ): Promise<string> {
    // Get historical performance for each variant
    const variantPerformance = await Promise.all(
      variants.map(async variant => {
        const clicks = await this.redis.get(`experiment:${experimentId}:${variant}:clicks`) || '0';
        const conversions = await this.redis.get(`experiment:${experimentId}:${variant}:conversions`) || '0';
        const impressions = await this.redis.get(`experiment:${experimentId}:${variant}:impressions`) || '1';
        
        const ctr = parseInt(clicks) / parseInt(impressions);
        const conversionRate = parseInt(conversions) / parseInt(clicks) || 0;
        
        return {
          variant,
          ctr,
          conversionRate,
          score: ctr * 0.3 + conversionRate * 0.7 // Weight conversion higher
        };
      })
    );

    // Apply epsilon-greedy strategy with UCB (Upper Confidence Bound)
    const epsilon = 0.1; // 10% exploration
    const totalImpressions = variantPerformance.reduce(
      (sum, v) => sum + parseInt(await this.redis.get(`experiment:${experimentId}:${v.variant}:impressions`) || '1'),
      0
    );

    if (Math.random() < epsilon) {
      // Exploration: random selection
      return variants[Math.floor(Math.random() * variants.length)];
    } else {
      // Exploitation: select best performing variant with confidence interval
      const bestVariant = variantPerformance.reduce((best, current) => {
        const confidence = Math.sqrt((2 * Math.log(totalImpressions)) / 
          parseInt(await this.redis.get(`experiment:${experimentId}:${current.variant}:impressions`) || '1'));
        current.ucb = current.score + confidence;
        
        return current.ucb > best.ucb ? current : best;
      });

      return bestVariant.variant;
    }
  }

  /**
   * Calculate overall confidence in personalization result
   */
  private calculateConfidenceScore(
    userProfile: any,
    segments: string[],
    mlPredictions: any,
    realTimeSignals: any
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data availability
    if (userProfile?.behavior?.purchaseCount > 5) confidence += 0.2;
    if (userProfile?.behavior?.visitCount > 10) confidence += 0.1;
    if (segments.length > 2) confidence += 0.1;
    
    // ML predictions boost confidence
    if (mlPredictions) {
      confidence += mlPredictions.purchaseIntent * 0.15;
      confidence += (1 - mlPredictions.churnRisk) * 0.1;
    }

    // Real-time signals boost confidence
    if (realTimeSignals?.intent > 0.7) confidence += 0.1;

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Build reasoning for personalization decisions
   */
  private buildReasoning(
    userProfile: any,
    segments: string[],
    mlPredictions: any,
    realTimeSignals: any
  ): string[] {
    const reasoning: string[] = [];

    // Segment-based reasoning
    if (segments.includes('high_value')) {
      reasoning.push('High-value customer - showing premium products');
    }
    if (segments.includes('new_user')) {
      reasoning.push('New user - focusing on onboarding and discovery');
    }
    if (segments.includes('cart_abandoner')) {
      reasoning.push('Cart abandoner - using retention strategies');
    }

    // ML predictions reasoning
    if (mlPredictions) {
      if (mlPredictions.purchaseIntent > 0.8) {
        reasoning.push('High purchase intent detected - optimizing for conversion');
      }
      if (mlPredictions.churnRisk > 0.6) {
        reasoning.push('Churn risk detected - applying retention tactics');
      }
      if (mlPredictions.lifetimeValue > 500) {
        reasoning.push('High predicted lifetime value - premium experience enabled');
      }
    }

    // Real-time reasoning
    if (realTimeSignals) {
      if (realTimeSignals.urgency === 'high') {
        reasoning.push('High urgency session - showing immediate action prompts');
      }
      reasoning.push(`Session intent: ${realTimeSignals.intent > 0.7 ? 'purchase' : 'browse'}`);
    }

    return reasoning;
  }

  /**
   * Apply multi-armed bandit to recommendation ordering
   */
  private async applyMultiArmedBandit(
    recommendations: any[],
    context: PersonalizationContext,
    segments: string[]
  ): Promise<any[]> {
    // Track performance of different recommendation methods
    const methodPerformance = new Map<string, number>();
    
    for (const rec of recommendations) {
      const method = rec.method || 'default';
      const clicks = await this.redis.get(`rec_method:${method}:clicks`) || '0';
      const impressions = await this.redis.get(`rec_method:${method}:impressions`) || '1';
      const ctr = parseInt(clicks) / parseInt(impressions);
      methodPerformance.set(method, ctr);
    }

    // Boost recommendations from best performing methods
    return recommendations.map(rec => ({
      ...rec,
      score: rec.score * (1 + (methodPerformance.get(rec.method || 'default') || 0))
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Remove duplicate recommendations while preserving highest scores
   */
  private deduplicateRecommendations(recommendations: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    recommendations
      .sort((a, b) => b.score - a.score) // Sort by score first
      .forEach(rec => {
        if (!seen.has(rec.productId)) {
          seen.add(rec.productId);
          unique.push(rec);
        }
      });

    return unique;
  }

  /**
   * Update ML models with new interaction data
   */
  private async updateLearningModels(
    context: PersonalizationContext,
    result: PersonalizationResult
  ): Promise<void> {
    // Update ML models with personalization performance
    if (context.userId && result.mlPredictions) {
      await this.mlModels.updateWithConversion(
        context.userId,
        'personalization_view',
        result.confidenceScore
      );
    }

    // Update preference engine
    if (context.userId) {
      await this.preferenceEngine.learnFromSignal({
        userId: context.userId,
        signal: 'positive',
        strength: result.confidenceScore,
        context: {
          timeOfDay: this.getTimeOfDay(),
          deviceType: context.device as any
        },
        timestamp: new Date()
      });
    }
  }

  /**
   * Track comprehensive personalization metrics
   */
  private async trackPersonalizationMetrics(
    result: PersonalizationResult,
    context: PersonalizationContext
  ): Promise<void> {
    // Track decision latency
    await this.redis.lpush('personalization:latency', result.decisionTime);
    await this.redis.ltrim('personalization:latency', 0, 999);

    // Track confidence scores
    await this.redis.lpush('personalization:confidence', result.confidenceScore);
    await this.redis.ltrim('personalization:confidence', 0, 999);

    // Track segment distribution
    for (const segment of result.segments) {
      await this.redis.incr(`segments:${segment}:count`);
    }

    // Track recommendation methods
    for (const rec of result.recommendations) {
      if (rec.method) {
        await this.redis.incr(`rec_method:${rec.method}:impressions`);
      }
    }
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private async trackPerformance(decisionTime: number): Promise<void> {
    await this.redis.lpush('personalization:decision_times', decisionTime);
    await this.redis.ltrim('personalization:decision_times', 0, 999); // Keep last 1000
  }

  private async getAverageDecisionTime(): Promise<number> {
    const times = await this.redis.lrange('personalization:decision_times', 0, -1);
    if (times.length === 0) return 0;
    
    const sum = times.reduce((acc, time) => acc + parseInt(time), 0);
    return sum / times.length;
  }

  private async getCacheHitRate(): Promise<number> {
    const hits = await this.redis.get('personalization:cache_hits') || '0';
    const misses = await this.redis.get('personalization:cache_misses') || '0';
    const total = parseInt(hits) + parseInt(misses);
    
    return total > 0 ? (parseInt(hits) / total) * 100 : 0;
  }

  private async getConversionLift(): Promise<number> {
    // This would compare conversion rates between personalized and control groups
    // Simplified example
    const personalized = await this.redis.get('conversions:personalized') || '0';
    const control = await this.redis.get('conversions:control') || '0';
    
    if (parseInt(control) === 0) return 0;
    
    return ((parseInt(personalized) - parseInt(control)) / parseInt(control)) * 100;
  }

  private async getEngagementMetrics(): Promise<any> {
    return {
      clickThroughRate: await this.getMetric('ctr'),
      timeOnSite: await this.getMetric('time_on_site'),
      pagesPerSession: await this.getMetric('pages_per_session'),
      bounceRate: await this.getMetric('bounce_rate')
    };
  }

  private async getThroughput(): Promise<number> {
    // Requests per second
    const recentRequests = await this.redis.llen('personalization:requests');
    return recentRequests / 60; // Assuming we track last minute
  }

  private async getRevenueImpact(): Promise<number> {
    // Calculate revenue difference between personalized and non-personalized
    const personalizedRevenue = await this.redis.get('revenue:personalized') || '0';
    const controlRevenue = await this.redis.get('revenue:control') || '0';
    
    return parseFloat(personalizedRevenue) - parseFloat(controlRevenue);
  }

  private async getMetric(metric: string): Promise<number> {
    const value = await this.redis.get(`metrics:${metric}`) || '0';
    return parseFloat(value);
  }
}

// Export singleton instance
export const createPersonalizationEngine = (redis: Redis) => {
  return new PersonalizationEngine({ redis });
};