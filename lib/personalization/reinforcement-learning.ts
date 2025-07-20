/**
 * Reinforcement Learning for Personalization
 * Multi-armed bandit and contextual bandits for optimization
 */

import { Redis } from 'ioredis';

interface RLAction {
  actionId: string;
  actionType: 'recommendation' | 'layout' | 'pricing' | 'content' | 'timing';
  parameters: Record<string, any>;
  expectedReward: number;
  uncertainty: number;
}

interface RLContext {
  userId: string;
  sessionId: string;
  page: string;
  device: string;
  timeOfDay: number;
  dayOfWeek: number;
  userSegments: string[];
  recentBehavior: any[];
  sessionLength: number;
  purchaseHistory: any[];
}

interface RLReward {
  actionId: string;
  reward: number;
  timestamp: Date;
  context: RLContext;
  delayed?: boolean;
}

interface BanditArm {
  actionId: string;
  pulls: number;
  totalReward: number;
  rewardHistory: number[];
  confidence: number;
  lastUpdated: Date;
}

interface ContextualFeatures {
  features: Float32Array;
  featureNames: string[];
}

export class ReinforcementLearning {
  private static instance: ReinforcementLearning;
  private redis: Redis | null = null;
  private bandits: Map<string, Map<string, BanditArm>> = new Map();
  private contextualWeights: Map<string, Float32Array> = new Map();
  private explorationRate: number = 0.1;
  private decayRate: number = 0.995;
  private confidenceLevel: number = 0.95;
  private rewardBuffer: RLReward[] = [];
  private isLearning = false;

  static getInstance(redis?: Redis): ReinforcementLearning {
    if (!ReinforcementLearning.instance) {
      ReinforcementLearning.instance = new ReinforcementLearning();
      if (redis) {
        ReinforcementLearning.instance.redis = redis;
      }
    }
    return ReinforcementLearning.instance;
  }

  constructor() {
    this.initialize();
  }

  /**
   * Get optimal actions for given context using contextual bandits
   */
  async getOptimalActions(
    userId: string,
    context: RLContext,
    options: {
      actionTypes?: string[];
      limit?: number;
      explorationBoost?: number;
    } = {}
  ): Promise<RLAction[]> {
    const actionTypes = options.actionTypes || ['recommendation', 'layout', 'content'];
    const limit = options.limit || 5;
    const explorationBoost = options.explorationBoost || 1.0;

    const actions: RLAction[] = [];

    for (const actionType of actionTypes) {
      const banditKey = `${actionType}:${this.getContextKey(context)}`;
      const bandit = this.bandits.get(banditKey) || new Map();
      
      const action = await this.selectAction(bandit, context, actionType, explorationBoost);
      if (action) {
        actions.push(action);
      }
    }

    // Sort by expected reward and return top actions
    return actions
      .sort((a, b) => b.expectedReward - a.expectedReward)
      .slice(0, limit);
  }

  /**
   * Update model with reward feedback
   */
  async updateWithReward(reward: RLReward): Promise<void> {
    // Add to buffer for batch processing
    this.rewardBuffer.push(reward);

    // Immediate update for critical actions
    await this.updateBanditArm(reward);

    // Batch process if buffer is full
    if (this.rewardBuffer.length >= 100) {
      await this.batchProcessRewards();
    }

    // Store in Redis for persistence
    if (this.redis) {
      await this.redis.lpush('rl:rewards', JSON.stringify(reward));
      await this.redis.ltrim('rl:rewards', 0, 9999); // Keep last 10k
    }
  }

  /**
   * Train contextual bandit with historical data
   */
  async trainContextualBandit(
    trainingData: Array<{ context: RLContext; action: RLAction; reward: number }>
  ): Promise<{
    modelAccuracy: number;
    averageReward: number;
    explorationRate: number;
  }> {
    this.isLearning = true;

    try {
      // Extract features from contexts
      const features = trainingData.map(d => this.extractFeatures(d.context));
      const actions = trainingData.map(d => d.action);
      const rewards = trainingData.map(d => d.reward);

      // Train linear contextual bandit (LinUCB algorithm)
      await this.trainLinUCB(features, actions, rewards);

      // Update exploration rate
      this.explorationRate *= this.decayRate;
      this.explorationRate = Math.max(0.01, this.explorationRate);

      // Calculate metrics
      const modelAccuracy = await this.evaluateModel(trainingData);
      const averageReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;

      // Save model state
      await this.saveModelState();

      return {
        modelAccuracy,
        averageReward,
        explorationRate: this.explorationRate
      };
    } finally {
      this.isLearning = false;
    }
  }

  /**
   * A/B test optimization using Thompson Sampling
   */
  async optimizeABTest(
    testId: string,
    variants: string[],
    context: RLContext
  ): Promise<{
    selectedVariant: string;
    probability: number;
    expectedReward: number;
  }> {
    const banditKey = `ab_test:${testId}`;
    let bandit = this.bandits.get(banditKey);

    if (!bandit) {
      // Initialize bandit for new A/B test
      bandit = new Map();
      for (const variant of variants) {
        bandit.set(variant, {
          actionId: variant,
          pulls: 1,
          totalReward: 0.5, // Prior
          rewardHistory: [0.5],
          confidence: 0.5,
          lastUpdated: new Date()
        });
      }
      this.bandits.set(banditKey, bandit);
    }

    // Thompson Sampling
    const samples = new Map<string, number>();
    for (const [variant, arm] of bandit) {
      // Beta distribution sampling
      const alpha = arm.totalReward + 1;
      const beta = arm.pulls - arm.totalReward + 1;
      const sample = this.sampleBeta(alpha, beta);
      samples.set(variant, sample);
    }

    // Select variant with highest sample
    const selectedVariant = Array.from(samples.entries())
      .reduce((max, current) => current[1] > max[1] ? current : max)[0];

    const selectedSample = samples.get(selectedVariant)!;
    const selectedArm = bandit.get(selectedVariant)!;

    return {
      selectedVariant,
      probability: selectedSample,
      expectedReward: selectedArm.totalReward / selectedArm.pulls
    };
  }

  /**
   * Dynamic pricing optimization
   */
  async optimizePricing(
    productId: string,
    basePrice: number,
    context: RLContext
  ): Promise<{
    optimizedPrice: number;
    expectedRevenue: number;
    confidence: number;
    strategy: string;
  }> {
    const priceMultipliers = [0.8, 0.9, 1.0, 1.1, 1.2]; // Price variations
    const banditKey = `pricing:${productId}`;
    
    let bandit = this.bandits.get(banditKey);
    if (!bandit) {
      bandit = new Map();
      for (const multiplier of priceMultipliers) {
        const actionId = `price_${multiplier}`;
        bandit.set(actionId, {
          actionId,
          pulls: 1,
          totalReward: basePrice * multiplier * 0.1, // Initial revenue estimate
          rewardHistory: [],
          confidence: 0.3,
          lastUpdated: new Date()
        });
      }
      this.bandits.set(banditKey, bandit);
    }

    // UCB1 algorithm for price selection
    const ucbScores = new Map<string, number>();
    const totalPulls = Array.from(bandit.values()).reduce((sum, arm) => sum + arm.pulls, 0);

    for (const [actionId, arm] of bandit) {
      const averageReward = arm.totalReward / arm.pulls;
      const exploration = Math.sqrt((2 * Math.log(totalPulls)) / arm.pulls);
      const ucbScore = averageReward + exploration;
      ucbScores.set(actionId, ucbScore);
    }

    // Select action with highest UCB score
    const selectedAction = Array.from(ucbScores.entries())
      .reduce((max, current) => current[1] > max[1] ? current : max);

    const multiplier = parseFloat(selectedAction[0].replace('price_', ''));
    const optimizedPrice = basePrice * multiplier;
    const selectedArm = bandit.get(selectedAction[0])!;

    return {
      optimizedPrice,
      expectedRevenue: selectedArm.totalReward / selectedArm.pulls,
      confidence: selectedArm.confidence,
      strategy: multiplier < 1 ? 'discount' : multiplier > 1 ? 'premium' : 'standard'
    };
  }

  /**
   * Content timing optimization
   */
  async optimizeContentTiming(
    contentType: string,
    context: RLContext
  ): Promise<{
    optimalTiming: 'immediate' | 'delayed' | 'scheduled';
    delay: number;
    expectedEngagement: number;
  }> {
    const timingOptions = ['immediate', 'delayed', 'scheduled'];
    const banditKey = `timing:${contentType}:${context.timeOfDay}`;
    
    let bandit = this.bandits.get(banditKey);
    if (!bandit) {
      bandit = new Map();
      timingOptions.forEach(timing => {
        bandit!.set(timing, {
          actionId: timing,
          pulls: 1,
          totalReward: 0.5,
          rewardHistory: [],
          confidence: 0.3,
          lastUpdated: new Date()
        });
      });
      this.bandits.set(banditKey, bandit);
    }

    // Epsilon-greedy selection with context
    const contextualBonus = this.calculateContextualBonus(context, contentType);
    let selectedTiming: string;

    if (Math.random() < this.explorationRate) {
      // Exploration
      selectedTiming = timingOptions[Math.floor(Math.random() * timingOptions.length)];
    } else {
      // Exploitation with contextual bonus
      const scores = new Map<string, number>();
      for (const [timing, arm] of bandit) {
        const baseScore = arm.totalReward / arm.pulls;
        const bonus = contextualBonus.get(timing) || 0;
        scores.set(timing, baseScore + bonus);
      }
      
      selectedTiming = Array.from(scores.entries())
        .reduce((max, current) => current[1] > max[1] ? current : max)[0];
    }

    const selectedArm = bandit.get(selectedTiming)!;
    
    // Calculate delay based on timing strategy
    let delay = 0;
    switch (selectedTiming) {
      case 'delayed':
        delay = 300; // 5 minutes
        break;
      case 'scheduled':
        delay = this.calculateOptimalScheduleDelay(context);
        break;
    }

    return {
      optimalTiming: selectedTiming as any,
      delay,
      expectedEngagement: selectedArm.totalReward / selectedArm.pulls
    };
  }

  /**
   * Get reinforcement learning metrics
   */
  async getRLMetrics(): Promise<{
    totalBandits: number;
    totalActions: number;
    averageReward: number;
    explorationRate: number;
    convergenceRate: number;
    topPerformingActions: Array<{
      actionId: string;
      averageReward: number;
      confidence: number;
    }>;
  }> {
    let totalActions = 0;
    let totalReward = 0;
    const allActions: Array<{ actionId: string; averageReward: number; confidence: number }> = [];

    for (const bandit of this.bandits.values()) {
      for (const arm of bandit.values()) {
        totalActions += arm.pulls;
        totalReward += arm.totalReward;
        allActions.push({
          actionId: arm.actionId,
          averageReward: arm.totalReward / arm.pulls,
          confidence: arm.confidence
        });
      }
    }

    const topActions = allActions
      .sort((a, b) => b.averageReward - a.averageReward)
      .slice(0, 10);

    return {
      totalBandits: this.bandits.size,
      totalActions,
      averageReward: totalActions > 0 ? totalReward / totalActions : 0,
      explorationRate: this.explorationRate,
      convergenceRate: await this.calculateConvergenceRate(),
      topPerformingActions: topActions
    };
  }

  // Private methods

  private async initialize(): Promise<void> {
    await this.loadModelState();
    this.startBackgroundLearning();
  }

  private getContextKey(context: RLContext): string {
    return [
      context.page,
      context.device,
      Math.floor(context.timeOfDay / 6), // 4 time periods
      context.dayOfWeek < 5 ? 'weekday' : 'weekend',
      context.userSegments.slice(0, 2).sort().join(',')
    ].join(':');
  }

  private async selectAction(
    bandit: Map<string, BanditArm>,
    context: RLContext,
    actionType: string,
    explorationBoost: number
  ): Promise<RLAction | null> {
    if (bandit.size === 0) {
      // Initialize with default actions
      await this.initializeDefaultActions(bandit, actionType);
    }

    // UCB1 with contextual features
    const contextFeatures = this.extractFeatures(context);
    const ucbScores = new Map<string, number>();
    const totalPulls = Array.from(bandit.values()).reduce((sum, arm) => sum + arm.pulls, 0);

    for (const [actionId, arm] of bandit) {
      const averageReward = arm.totalReward / arm.pulls;
      const exploration = Math.sqrt((2 * Math.log(totalPulls)) / arm.pulls) * explorationBoost;
      const contextualBonus = this.calculateContextualScore(actionId, contextFeatures);
      
      const ucbScore = averageReward + exploration + contextualBonus;
      ucbScores.set(actionId, ucbScore);
    }

    // Select best action
    const selectedAction = Array.from(ucbScores.entries())
      .reduce((max, current) => current[1] > max[1] ? current : max);

    const selectedArm = bandit.get(selectedAction[0])!;

    return {
      actionId: selectedAction[0],
      actionType: actionType as any,
      parameters: await this.getActionParameters(selectedAction[0], context),
      expectedReward: selectedArm.totalReward / selectedArm.pulls,
      uncertainty: 1 / Math.sqrt(selectedArm.pulls)
    };
  }

  private extractFeatures(context: RLContext): ContextualFeatures {
    const features = new Float32Array(20);
    const featureNames: string[] = [];

    let idx = 0;

    // Time features
    features[idx] = context.timeOfDay / 24;
    featureNames[idx++] = 'time_of_day';
    
    features[idx] = context.dayOfWeek / 7;
    featureNames[idx++] = 'day_of_week';

    // Device features
    features[idx] = context.device === 'mobile' ? 1 : 0;
    featureNames[idx++] = 'is_mobile';
    
    features[idx] = context.device === 'desktop' ? 1 : 0;
    featureNames[idx++] = 'is_desktop';

    // Session features
    features[idx] = Math.min(1, context.sessionLength / 1800); // Normalize to 30 minutes
    featureNames[idx++] = 'session_length';
    
    features[idx] = Math.min(1, context.recentBehavior.length / 10);
    featureNames[idx++] = 'recent_activity';

    // User segment features (top 5 segments)
    const topSegments = ['new_user', 'high_value', 'cart_abandoner', 'frequent_buyer', 'price_sensitive'];
    topSegments.forEach(segment => {
      features[idx] = context.userSegments.includes(segment) ? 1 : 0;
      featureNames[idx++] = `segment_${segment}`;
    });

    // Purchase history features
    features[idx] = Math.min(1, context.purchaseHistory.length / 20);
    featureNames[idx++] = 'purchase_frequency';

    // Fill remaining features with zeros if needed
    while (idx < 20) {
      features[idx] = 0;
      featureNames[idx] = `feature_${idx}`;
      idx++;
    }

    return { features, featureNames };
  }

  private async updateBanditArm(reward: RLReward): Promise<void> {
    const contextKey = this.getContextKey(reward.context);
    const banditKey = `${reward.actionId.split(':')[0]}:${contextKey}`;
    
    let bandit = this.bandits.get(banditKey);
    if (!bandit) {
      bandit = new Map();
      this.bandits.set(banditKey, bandit);
    }

    let arm = bandit.get(reward.actionId);
    if (!arm) {
      arm = {
        actionId: reward.actionId,
        pulls: 0,
        totalReward: 0,
        rewardHistory: [],
        confidence: 0,
        lastUpdated: new Date()
      };
    }

    // Update arm statistics
    arm.pulls++;
    arm.totalReward += reward.reward;
    arm.rewardHistory.push(reward.reward);
    arm.lastUpdated = new Date();

    // Calculate confidence interval
    if (arm.rewardHistory.length > 1) {
      const mean = arm.totalReward / arm.pulls;
      const variance = arm.rewardHistory.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / arm.pulls;
      arm.confidence = Math.sqrt(variance / arm.pulls);
    }

    // Keep only recent history for memory efficiency
    if (arm.rewardHistory.length > 100) {
      arm.rewardHistory = arm.rewardHistory.slice(-100);
    }

    bandit.set(reward.actionId, arm);
  }

  private async trainLinUCB(
    features: ContextualFeatures[],
    actions: RLAction[],
    rewards: number[]
  ): Promise<void> {
    // Simplified LinUCB implementation
    const featureDim = features[0].features.length;
    const uniqueActions = [...new Set(actions.map(a => a.actionId))];

    for (const actionId of uniqueActions) {
      // Initialize weights for this action
      let weights = this.contextualWeights.get(actionId);
      if (!weights) {
        weights = new Float32Array(featureDim);
        this.contextualWeights.set(actionId, weights);
      }

      // Find all instances of this action
      const actionIndices = actions
        .map((action, idx) => action.actionId === actionId ? idx : -1)
        .filter(idx => idx !== -1);

      if (actionIndices.length === 0) continue;

      // Simple gradient descent update
      const learningRate = 0.01;
      for (const idx of actionIndices) {
        const feature = features[idx].features;
        const reward = rewards[idx];
        const prediction = this.dotProduct(weights, feature);
        const error = reward - prediction;

        // Update weights
        for (let i = 0; i < featureDim; i++) {
          weights[i] += learningRate * error * feature[i];
        }
      }
    }
  }

  private dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private calculateContextualScore(actionId: string, features: ContextualFeatures): number {
    const weights = this.contextualWeights.get(actionId);
    if (!weights) return 0;

    return this.dotProduct(weights, features.features);
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified beta sampling using rejection method
    let u1, u2, w;
    do {
      u1 = Math.random();
      u2 = Math.random();
      w = u1 * Math.pow(1 - u1, (beta - 1) / (alpha - 1));
    } while (u2 > w);
    
    return u1;
  }

  private calculateContextualBonus(context: RLContext, contentType: string): Map<string, number> {
    const bonuses = new Map<string, number>();
    
    // Time-based bonuses
    if (context.timeOfDay >= 9 && context.timeOfDay <= 17) {
      bonuses.set('immediate', 0.1); // Work hours favor immediate
    } else {
      bonuses.set('delayed', 0.1); // Off hours favor delayed
    }

    // Day of week bonuses
    if (context.dayOfWeek === 0 || context.dayOfWeek === 6) {
      bonuses.set('scheduled', 0.15); // Weekends favor scheduled
    }

    return bonuses;
  }

  private calculateOptimalScheduleDelay(context: RLContext): number {
    // Calculate optimal delay based on context
    const baseDelay = 24 * 60 * 60 * 1000; // 24 hours in ms
    
    // Adjust based on user behavior patterns
    if (context.userSegments.includes('morning_active')) {
      return baseDelay - (context.timeOfDay * 60 * 60 * 1000); // Schedule for morning
    }
    
    if (context.userSegments.includes('evening_active')) {
      return baseDelay + ((18 - context.timeOfDay) * 60 * 60 * 1000); // Schedule for evening
    }
    
    return baseDelay; // Default 24 hour delay
  }

  private async batchProcessRewards(): Promise<void> {
    if (this.rewardBuffer.length === 0) return;

    const rewards = [...this.rewardBuffer];
    this.rewardBuffer = [];

    // Process rewards in batches
    for (const reward of rewards) {
      await this.updateBanditArm(reward);
    }

    // Update contextual weights if enough data
    if (rewards.length >= 50) {
      const contexts = rewards.map(r => this.extractFeatures(r.context));
      const actions = rewards.map(r => ({ actionId: r.actionId, actionType: 'reward' as any, parameters: {}, expectedReward: 0, uncertainty: 0 }));
      const rewardValues = rewards.map(r => r.reward);
      
      await this.trainLinUCB(contexts, actions, rewardValues);
    }
  }

  private async initializeDefaultActions(bandit: Map<string, BanditArm>, actionType: string): Promise<void> {
    const defaultActions = this.getDefaultActionsForType(actionType);
    
    for (const actionId of defaultActions) {
      bandit.set(actionId, {
        actionId,
        pulls: 1,
        totalReward: 0.5, // Neutral prior
        rewardHistory: [],
        confidence: 0.5,
        lastUpdated: new Date()
      });
    }
  }

  private getDefaultActionsForType(actionType: string): string[] {
    switch (actionType) {
      case 'recommendation':
        return ['popular', 'collaborative', 'content_based', 'trending', 'personalized'];
      case 'layout':
        return ['grid', 'list', 'carousel', 'masonry', 'minimal'];
      case 'content':
        return ['promotional', 'educational', 'social_proof', 'urgency', 'value_prop'];
      default:
        return ['default'];
    }
  }

  private async getActionParameters(actionId: string, context: RLContext): Promise<Record<string, any>> {
    // Return action-specific parameters based on context
    const parameters: Record<string, any> = { actionId };
    
    if (actionId.includes('recommendation')) {
      parameters.algorithm = actionId;
      parameters.count = context.device === 'mobile' ? 4 : 8;
    } else if (actionId.includes('layout')) {
      parameters.layout = actionId;
      parameters.responsive = true;
    } else if (actionId.includes('content')) {
      parameters.contentType = actionId;
      parameters.personalized = true;
    }
    
    return parameters;
  }

  private async evaluateModel(testData: Array<{ context: RLContext; action: RLAction; reward: number }>): Promise<number> {
    let correct = 0;
    
    for (const sample of testData) {
      const features = this.extractFeatures(sample.context);
      const predictedScore = this.calculateContextualScore(sample.action.actionId, features);
      const actualReward = sample.reward;
      
      // Simple accuracy: predicted and actual both above/below threshold
      const threshold = 0.5;
      if ((predictedScore > threshold) === (actualReward > threshold)) {
        correct++;
      }
    }
    
    return testData.length > 0 ? correct / testData.length : 0;
  }

  private async calculateConvergenceRate(): Promise<number> {
    // Calculate how stable the bandit arms are (low variance = high convergence)
    let totalVariance = 0;
    let totalArms = 0;
    
    for (const bandit of this.bandits.values()) {
      for (const arm of bandit.values()) {
        if (arm.rewardHistory.length > 10) {
          const mean = arm.totalReward / arm.pulls;
          const variance = arm.rewardHistory.slice(-10).reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / 10;
          totalVariance += variance;
          totalArms++;
        }
      }
    }
    
    if (totalArms === 0) return 0;
    
    const avgVariance = totalVariance / totalArms;
    return Math.max(0, 1 - avgVariance); // Higher convergence = lower variance
  }

  private startBackgroundLearning(): void {
    // Periodic model updates and exploration rate decay
    setInterval(() => {
      if (!this.isLearning && this.rewardBuffer.length > 0) {
        this.batchProcessRewards();
      }
      
      // Decay exploration rate
      this.explorationRate *= this.decayRate;
      this.explorationRate = Math.max(0.01, this.explorationRate);
    }, 60000); // Every minute
  }

  private async saveModelState(): Promise<void> {
    if (!this.redis) return;

    try {
      // Save bandit arms
      const banditData = Array.from(this.bandits.entries()).map(([key, bandit]) => ({
        key,
        arms: Array.from(bandit.entries())
      }));
      
      await this.redis.set('rl:bandits', JSON.stringify(banditData));
      
      // Save contextual weights
      const weightsData = Array.from(this.contextualWeights.entries()).map(([actionId, weights]) => ({
        actionId,
        weights: Array.from(weights)
      }));
      
      await this.redis.set('rl:weights', JSON.stringify(weightsData));
      await this.redis.set('rl:exploration_rate', this.explorationRate.toString());
    } catch (error) {
      console.error('Failed to save RL state:', error);
    }
  }

  private async loadModelState(): Promise<void> {
    if (!this.redis) return;

    try {
      // Load bandit arms
      const banditData = await this.redis.get('rl:bandits');
      if (banditData) {
        const parsed = JSON.parse(banditData);
        for (const { key, arms } of parsed) {
          const bandit = new Map(arms);
          this.bandits.set(key, bandit);
        }
      }

      // Load contextual weights
      const weightsData = await this.redis.get('rl:weights');
      if (weightsData) {
        const parsed = JSON.parse(weightsData);
        for (const { actionId, weights } of parsed) {
          this.contextualWeights.set(actionId, new Float32Array(weights));
        }
      }

      // Load exploration rate
      const explorationRate = await this.redis.get('rl:exploration_rate');
      if (explorationRate) {
        this.explorationRate = parseFloat(explorationRate);
      }
    } catch (error) {
      console.log('No existing RL state found, starting fresh');
    }
  }
}

export const reinforcementLearning = ReinforcementLearning.getInstance();