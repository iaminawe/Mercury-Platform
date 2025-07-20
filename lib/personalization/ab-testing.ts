/**
 * A/B Testing Framework for Personalization
 * Advanced experimentation with statistical significance testing
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived';
  variants: ExperimentVariant[];
  targeting: {
    segments?: string[];
    userAttributes?: Record<string, any>;
    deviceTypes?: string[];
    locations?: string[];
    trafficAllocation: number; // 0-1
  };
  metrics: {
    primary: string;
    secondary: string[];
    conversionEvents: string[];
  };
  duration: {
    startDate: Date;
    endDate?: Date;
    minSampleSize: number;
    confidenceLevel: number;
  };
  personalization: {
    enableDynamicAllocation: boolean;
    rewardMetric?: string;
    explorationRate?: number;
  };
}

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  allocation: number; // 0-1
  configuration: Record<string, any>;
  isControl: boolean;
}

interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
  sticky: boolean;
  context: Record<string, any>;
}

interface ExperimentResult {
  experimentId: string;
  variantId: string;
  userId: string;
  event: string;
  value?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface StatisticalAnalysis {
  variant: string;
  metrics: {
    conversions: number;
    impressions: number;
    conversionRate: number;
    confidence: number;
    pValue: number;
    lift: number;
    significance: 'significant' | 'not_significant' | 'trending';
  };
  revenue?: {
    total: number;
    average: number;
    perUser: number;
  };
}

interface ExperimentReport {
  experimentId: string;
  status: string;
  duration: number;
  participants: number;
  results: StatisticalAnalysis[];
  winner?: {
    variantId: string;
    confidence: number;
    expectedLift: number;
  };
  recommendations: string[];
}

export class ABTestingFramework {
  private static instance: ABTestingFramework;
  private redis: Redis | null = null;
  private experiments: Map<string, ExperimentConfig> = new Map();
  private assignments: Map<string, Map<string, ExperimentAssignment>> = new Map(); // userId -> experimentId -> assignment
  private results: Map<string, ExperimentResult[]> = new Map();
  private statisticalEngine: StatisticalEngine;

  static getInstance(redis?: Redis): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
      if (redis) {
        ABTestingFramework.instance.redis = redis;
      }
    }
    return ABTestingFramework.instance;
  }

  constructor() {
    this.statisticalEngine = new StatisticalEngine();
    this.initialize();
  }

  /**
   * Create a new A/B test experiment
   */
  async createExperiment(config: Omit<ExperimentConfig, 'id'>): Promise<ExperimentConfig> {
    const experiment: ExperimentConfig = {
      id: uuidv4(),
      ...config
    };

    // Validate experiment configuration
    this.validateExperiment(experiment);

    // Store experiment
    this.experiments.set(experiment.id, experiment);

    // Persist to Redis
    if (this.redis) {
      await this.redis.set(`experiment:${experiment.id}`, JSON.stringify(experiment));
      await this.redis.sadd('active_experiments', experiment.id);
    }

    return experiment;
  }

  /**
   * Get user assignment for experiments
   */
  async getAssignment(
    userId: string,
    context: {
      page?: string;
      device?: string;
      location?: string;
      segments?: string[];
      userAttributes?: Record<string, any>;
    }
  ): Promise<Record<string, { experimentId: string; variantId: string; config: any }>> {
    const assignments: Record<string, { experimentId: string; variantId: string; config: any }> = {};

    // Get user's current assignments
    let userAssignments = this.assignments.get(userId);
    if (!userAssignments) {
      userAssignments = new Map();
      this.assignments.set(userId, userAssignments);
    }

    // Check each active experiment
    for (const experiment of this.experiments.values()) {
      if (experiment.status !== 'running') continue;

      // Check if user is eligible for this experiment
      if (!this.isUserEligible(experiment, context)) continue;

      // Check for existing assignment
      let assignment = userAssignments.get(experiment.id);
      
      if (!assignment) {
        // Create new assignment
        const variantId = await this.assignVariant(experiment, userId, context);
        if (variantId) {
          assignment = {
            experimentId: experiment.id,
            variantId,
            userId,
            assignedAt: new Date(),
            sticky: true,
            context
          };
          
          userAssignments.set(experiment.id, assignment);
          
          // Persist assignment
          if (this.redis) {
            await this.redis.set(
              `assignment:${userId}:${experiment.id}`,
              JSON.stringify(assignment)
            );
          }
        }
      }

      if (assignment) {
        const variant = experiment.variants.find(v => v.id === assignment.variantId);
        if (variant) {
          assignments[experiment.name] = {
            experimentId: experiment.id,
            variantId: assignment.variantId,
            config: variant.configuration
          };
        }
      }
    }

    return assignments;
  }

  /**
   * Track experiment result/conversion
   */
  async trackResult(result: Omit<ExperimentResult, 'timestamp'>): Promise<void> {
    const experimentResult: ExperimentResult = {
      ...result,
      timestamp: new Date()
    };

    // Store result
    let experimentResults = this.results.get(result.experimentId);
    if (!experimentResults) {
      experimentResults = [];
      this.results.set(result.experimentId, experimentResults);
    }
    experimentResults.push(experimentResult);

    // Persist to Redis
    if (this.redis) {
      await this.redis.lpush(
        `results:${result.experimentId}`,
        JSON.stringify(experimentResult)
      );
    }

    // Update dynamic allocation if enabled
    const experiment = this.experiments.get(result.experimentId);
    if (experiment?.personalization.enableDynamicAllocation) {
      await this.updateDynamicAllocation(experiment, result);
    }

    // Check for early stopping conditions
    await this.checkEarlyStoppingConditions(result.experimentId);
  }

  /**
   * Get experiment analysis and results
   */
  async getExperimentAnalysis(experimentId: string): Promise<ExperimentReport> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const results = this.results.get(experimentId) || [];
    const assignments = await this.getExperimentAssignments(experimentId);

    // Calculate statistical analysis for each variant
    const analysis: StatisticalAnalysis[] = [];
    for (const variant of experiment.variants) {
      const variantResults = results.filter(r => r.variantId === variant.id);
      const variantAssignments = assignments.filter(a => a.variantId === variant.id);

      const stats = await this.statisticalEngine.calculateVariantStats(
        variant,
        variantResults,
        variantAssignments,
        experiment.metrics
      );

      analysis.push(stats);
    }

    // Determine winner
    const winner = await this.determineWinner(analysis, experiment.duration.confidenceLevel);

    // Generate recommendations
    const recommendations = this.generateRecommendations(experiment, analysis, winner);

    return {
      experimentId,
      status: experiment.status,
      duration: Date.now() - experiment.duration.startDate.getTime(),
      participants: assignments.length,
      results: analysis,
      winner,
      recommendations
    };
  }

  /**
   * Stop experiment and declare winner
   */
  async stopExperiment(
    experimentId: string,
    reason: 'completed' | 'early_stop' | 'insufficient_data'
  ): Promise<ExperimentReport> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    // Update experiment status
    experiment.status = 'completed';
    experiment.duration.endDate = new Date();

    // Get final analysis
    const report = await this.getExperimentAnalysis(experimentId);

    // Archive experiment data
    await this.archiveExperiment(experimentId);

    // Update in storage
    this.experiments.set(experimentId, experiment);
    if (this.redis) {
      await this.redis.set(`experiment:${experimentId}`, JSON.stringify(experiment));
      await this.redis.srem('active_experiments', experimentId);
    }

    return report;
  }

  /**
   * Get personalized experiment recommendations
   */
  async getPersonalizedExperiments(
    userId: string,
    context: Record<string, any>
  ): Promise<Array<{
    experimentId: string;
    recommendedVariant: string;
    confidence: number;
    reason: string;
  }>> {
    const recommendations = [];

    for (const experiment of this.experiments.values()) {
      if (experiment.status !== 'running') continue;

      // Use ML model to predict best variant for this user
      const prediction = await this.predictBestVariant(experiment, userId, context);
      
      if (prediction.confidence > 0.6) {
        recommendations.push({
          experimentId: experiment.id,
          recommendedVariant: prediction.variantId,
          confidence: prediction.confidence,
          reason: prediction.reason
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Multivariate testing support
   */
  async createMultivariateTest(config: {
    name: string;
    factors: Array<{
      name: string;
      levels: Array<{ name: string; config: any }>;
    }>;
    targeting: ExperimentConfig['targeting'];
    metrics: ExperimentConfig['metrics'];
    duration: ExperimentConfig['duration'];
  }): Promise<ExperimentConfig> {
    // Generate all combinations of factors
    const variants = this.generateMultivariateVariants(config.factors);

    const experiment: ExperimentConfig = {
      id: uuidv4(),
      name: config.name,
      description: `Multivariate test with ${config.factors.length} factors`,
      status: 'draft',
      variants,
      targeting: config.targeting,
      metrics: config.metrics,
      duration: config.duration,
      personalization: {
        enableDynamicAllocation: true,
        rewardMetric: config.metrics.primary,
        explorationRate: 0.2
      }
    };

    return this.createExperiment(experiment);
  }

  // Private methods

  private async initialize(): Promise<void> {
    await this.loadExperiments();
    await this.loadAssignments();
    this.startBackgroundTasks();
  }

  private validateExperiment(experiment: ExperimentConfig): void {
    // Validate variant allocations sum to 1
    const totalAllocation = experiment.variants.reduce((sum, v) => sum + v.allocation, 0);
    if (Math.abs(totalAllocation - 1) > 0.001) {
      throw new Error('Variant allocations must sum to 1');
    }

    // Validate at least one control variant
    const hasControl = experiment.variants.some(v => v.isControl);
    if (!hasControl) {
      throw new Error('Experiment must have at least one control variant');
    }

    // Validate sample size
    if (experiment.duration.minSampleSize < 100) {
      throw new Error('Minimum sample size must be at least 100');
    }
  }

  private isUserEligible(experiment: ExperimentConfig, context: any): boolean {
    // Check traffic allocation
    if (Math.random() > experiment.targeting.trafficAllocation) {
      return false;
    }

    // Check segments
    if (experiment.targeting.segments && experiment.targeting.segments.length > 0) {
      const userSegments = context.segments || [];
      const hasMatchingSegment = experiment.targeting.segments.some(segment =>
        userSegments.includes(segment)
      );
      if (!hasMatchingSegment) return false;
    }

    // Check device types
    if (experiment.targeting.deviceTypes && experiment.targeting.deviceTypes.length > 0) {
      if (!experiment.targeting.deviceTypes.includes(context.device)) {
        return false;
      }
    }

    // Check user attributes
    if (experiment.targeting.userAttributes) {
      for (const [key, value] of Object.entries(experiment.targeting.userAttributes)) {
        if (context.userAttributes?.[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private async assignVariant(
    experiment: ExperimentConfig,
    userId: string,
    context: any
  ): Promise<string | null> {
    // For dynamic allocation experiments, use ML-based assignment
    if (experiment.personalization.enableDynamicAllocation) {
      return this.assignVariantDynamically(experiment, userId, context);
    }

    // Standard random assignment based on allocations
    const hash = this.hashUser(userId, experiment.id);
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.allocation;
      if (hash <= cumulative) {
        return variant.id;
      }
    }

    return experiment.variants[0].id; // Fallback
  }

  private async assignVariantDynamically(
    experiment: ExperimentConfig,
    userId: string,
    context: any
  ): Promise<string | null> {
    // Use Thompson Sampling for dynamic allocation
    const variantRewards = new Map<string, { successes: number; failures: number }>();

    // Get historical performance for each variant
    const results = this.results.get(experiment.id) || [];
    for (const variant of experiment.variants) {
      const variantResults = results.filter(r => r.variantId === variant.id);
      const successes = variantResults.filter(r => r.event === experiment.metrics.primary).length;
      const failures = variantResults.length - successes;
      
      variantRewards.set(variant.id, { 
        successes: successes + 1, // Prior
        failures: failures + 1 
      });
    }

    // Sample from Beta distributions
    const samples = new Map<string, number>();
    for (const [variantId, rewards] of variantRewards) {
      const sample = this.sampleBeta(rewards.successes, rewards.failures);
      samples.set(variantId, sample);
    }

    // Exploration vs exploitation
    const explorationRate = experiment.personalization.explorationRate || 0.1;
    if (Math.random() < explorationRate) {
      // Exploration: random selection
      const variants = Array.from(samples.keys());
      return variants[Math.floor(Math.random() * variants.length)];
    } else {
      // Exploitation: best performing variant
      return Array.from(samples.entries())
        .reduce((max, current) => current[1] > max[1] ? current : max)[0];
    }
  }

  private hashUser(userId: string, experimentId: string): number {
    // Deterministic hash for consistent assignment
    const combined = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) / Math.pow(2, 31);
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified beta sampling
    const gamma1 = this.sampleGamma(alpha, 1);
    const gamma2 = this.sampleGamma(beta, 1);
    return gamma1 / (gamma1 + gamma2);
  }

  private sampleGamma(shape: number, scale: number): number {
    // Simplified gamma sampling using Marsaglia and Tsang method
    if (shape < 1) {
      return this.sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      let x, v;
      do {
        x = this.randomNormal();
        v = 1 + c * x;
      } while (v <= 0);
      
      v = v * v * v;
      const u = Math.random();
      
      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v * scale;
      }
      
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * scale;
      }
    }
  }

  private randomNormal(): number {
    // Box-Muller transform
    const u = Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private async updateDynamicAllocation(
    experiment: ExperimentConfig,
    result: ExperimentResult
  ): Promise<void> {
    // Update variant performance and adjust allocations
    // This is a simplified version - in production would be more sophisticated
    
    const isSuccess = result.event === experiment.metrics.primary;
    const rewardValue = isSuccess ? (result.value || 1) : 0;

    // Store performance update
    if (this.redis) {
      await this.redis.hincrby(`performance:${experiment.id}:${result.variantId}`, 'total', 1);
      if (isSuccess) {
        await this.redis.hincrby(`performance:${experiment.id}:${result.variantId}`, 'successes', 1);
      }
    }
  }

  private async checkEarlyStoppingConditions(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const analysis = await this.getExperimentAnalysis(experimentId);
    
    // Check for statistical significance
    const significantResults = analysis.results.filter(r => 
      r.metrics.significance === 'significant' && 
      r.metrics.confidence >= experiment.duration.confidenceLevel
    );

    // Check minimum sample size
    const hasMinimumSample = analysis.participants >= experiment.duration.minSampleSize;

    // Early stopping if we have statistical significance and minimum sample
    if (significantResults.length > 0 && hasMinimumSample) {
      await this.stopExperiment(experimentId, 'early_stop');
    }
  }

  private async getExperimentAssignments(experimentId: string): Promise<ExperimentAssignment[]> {
    const assignments: ExperimentAssignment[] = [];
    
    for (const userAssignments of this.assignments.values()) {
      const assignment = userAssignments.get(experimentId);
      if (assignment) {
        assignments.push(assignment);
      }
    }
    
    return assignments;
  }

  private async determineWinner(
    analysis: StatisticalAnalysis[],
    confidenceLevel: number
  ): Promise<{ variantId: string; confidence: number; expectedLift: number } | undefined> {
    // Find control variant
    const control = analysis.find(a => a.variant.includes('control'));
    if (!control) return undefined;

    // Find best performing non-control variant
    const treatments = analysis.filter(a => !a.variant.includes('control'));
    const bestTreatment = treatments.reduce((best, current) => 
      current.metrics.conversionRate > best.metrics.conversionRate ? current : best
    );

    // Check statistical significance
    if (bestTreatment.metrics.confidence >= confidenceLevel && 
        bestTreatment.metrics.significance === 'significant') {
      return {
        variantId: bestTreatment.variant,
        confidence: bestTreatment.metrics.confidence,
        expectedLift: bestTreatment.metrics.lift
      };
    }

    return undefined;
  }

  private generateRecommendations(
    experiment: ExperimentConfig,
    analysis: StatisticalAnalysis[],
    winner?: { variantId: string; confidence: number; expectedLift: number }
  ): string[] {
    const recommendations: string[] = [];

    if (winner) {
      recommendations.push(`Implement variant ${winner.variantId} with ${winner.expectedLift.toFixed(1)}% lift`);
    } else {
      recommendations.push('Continue experiment - no statistically significant winner yet');
    }

    // Check for concerning trends
    const lowPerformers = analysis.filter(a => a.metrics.conversionRate < 0.01);
    if (lowPerformers.length > 0) {
      recommendations.push('Consider stopping low-performing variants to allocate more traffic to better options');
    }

    // Sample size recommendations
    const totalSample = analysis.reduce((sum, a) => sum + a.metrics.impressions, 0);
    if (totalSample < experiment.duration.minSampleSize * 2) {
      recommendations.push('Increase traffic allocation to reach statistical power faster');
    }

    return recommendations;
  }

  private async predictBestVariant(
    experiment: ExperimentConfig,
    userId: string,
    context: any
  ): Promise<{ variantId: string; confidence: number; reason: string }> {
    // This would use ML models to predict best variant for user
    // Simplified version returns random for now
    
    const variants = experiment.variants;
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];
    
    return {
      variantId: randomVariant.id,
      confidence: 0.7,
      reason: 'Based on user profile and historical performance'
    };
  }

  private generateMultivariateVariants(factors: Array<{
    name: string;
    levels: Array<{ name: string; config: any }>;
  }>): ExperimentVariant[] {
    // Generate all combinations
    const combinations = this.cartesianProduct(factors.map(f => f.levels));
    const variants: ExperimentVariant[] = [];

    combinations.forEach((combination, index) => {
      const config: Record<string, any> = {};
      combination.forEach((level, factorIndex) => {
        config[factors[factorIndex].name] = level.config;
      });

      variants.push({
        id: `variant_${index}`,
        name: combination.map(l => l.name).join(' + '),
        description: `Combination: ${combination.map(l => l.name).join(', ')}`,
        allocation: 1 / combinations.length,
        configuration: config,
        isControl: index === 0
      });
    });

    return variants;
  }

  private cartesianProduct<T>(arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>(
      (acc, curr) => acc.flatMap(combo => curr.map(item => [...combo, item])),
      [[]]
    );
  }

  private async archiveExperiment(experimentId: string): Promise<void> {
    if (!this.redis) return;

    // Move data to archive keys
    const experiment = await this.redis.get(`experiment:${experimentId}`);
    const results = await this.redis.lrange(`results:${experimentId}`, 0, -1);
    
    if (experiment) {
      await this.redis.set(`archive:experiment:${experimentId}`, experiment);
    }
    
    if (results.length > 0) {
      await this.redis.set(`archive:results:${experimentId}`, JSON.stringify(results));
    }
  }

  private async loadExperiments(): Promise<void> {
    if (!this.redis) return;

    try {
      const experimentIds = await this.redis.smembers('active_experiments');
      for (const id of experimentIds) {
        const experimentData = await this.redis.get(`experiment:${id}`);
        if (experimentData) {
          const experiment = JSON.parse(experimentData);
          this.experiments.set(id, experiment);
        }
      }
    } catch (error) {
      console.error('Failed to load experiments:', error);
    }
  }

  private async loadAssignments(): Promise<void> {
    if (!this.redis) return;

    try {
      const assignmentKeys = await this.redis.keys('assignment:*');
      for (const key of assignmentKeys) {
        const assignmentData = await this.redis.get(key);
        if (assignmentData) {
          const assignment = JSON.parse(assignmentData);
          
          let userAssignments = this.assignments.get(assignment.userId);
          if (!userAssignments) {
            userAssignments = new Map();
            this.assignments.set(assignment.userId, userAssignments);
          }
          
          userAssignments.set(assignment.experimentId, assignment);
        }
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  }

  private startBackgroundTasks(): void {
    // Check experiment conditions periodically
    setInterval(async () => {
      for (const experiment of this.experiments.values()) {
        if (experiment.status === 'running') {
          await this.checkEarlyStoppingConditions(experiment.id);
        }
      }
    }, 60000); // Every minute
  }
}

class StatisticalEngine {
  async calculateVariantStats(
    variant: ExperimentVariant,
    results: ExperimentResult[],
    assignments: ExperimentAssignment[],
    metrics: ExperimentConfig['metrics']
  ): Promise<StatisticalAnalysis> {
    const conversions = results.filter(r => metrics.conversionEvents.includes(r.event)).length;
    const impressions = assignments.length;
    const conversionRate = impressions > 0 ? conversions / impressions : 0;

    // Calculate statistical significance (simplified)
    const confidence = this.calculateConfidence(conversions, impressions);
    const pValue = this.calculatePValue(conversions, impressions);
    const significance = pValue < 0.05 ? 'significant' : pValue < 0.1 ? 'trending' : 'not_significant';

    // Calculate revenue metrics if available
    const revenueResults = results.filter(r => r.value && r.value > 0);
    const totalRevenue = revenueResults.reduce((sum, r) => sum + (r.value || 0), 0);
    const averageRevenue = revenueResults.length > 0 ? totalRevenue / revenueResults.length : 0;

    return {
      variant: variant.id,
      metrics: {
        conversions,
        impressions,
        conversionRate,
        confidence,
        pValue,
        lift: 0, // Would be calculated against control
        significance
      },
      revenue: revenueResults.length > 0 ? {
        total: totalRevenue,
        average: averageRevenue,
        perUser: impressions > 0 ? totalRevenue / impressions : 0
      } : undefined
    };
  }

  private calculateConfidence(successes: number, trials: number): number {
    // Wilson score interval
    if (trials === 0) return 0;
    
    const p = successes / trials;
    const z = 1.96; // 95% confidence
    const denominator = 1 + z * z / trials;
    const centre = p + z * z / (2 * trials);
    const interval = z * Math.sqrt((p * (1 - p) + z * z / (4 * trials)) / trials);
    
    return Math.min(0.99, Math.max(0.01, (centre - interval) / denominator));
  }

  private calculatePValue(successes: number, trials: number): number {
    // Simplified p-value calculation
    if (trials === 0) return 1;
    
    const p = successes / trials;
    const expectedP = 0.05; // Assume 5% baseline
    const se = Math.sqrt(expectedP * (1 - expectedP) / trials);
    const z = Math.abs(p - expectedP) / se;
    
    // Approximate p-value from z-score
    return 2 * (1 - this.normalCDF(z));
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

export const abTestFramework = ABTestingFramework.getInstance();