import { createHash } from 'crypto';
import { Variant } from './types';

export class TrafficSplitter {
  /**
   * Deterministically assign a user to a variant based on consistent hashing
   * This ensures the same user always gets the same variant (sticky bucketing)
   */
  assignVariant(
    variants: Variant[],
    userId: string,
    experimentId: string
  ): string {
    // Create a deterministic hash based on user ID and experiment ID
    const hashInput = `${userId}:${experimentId}`;
    const hash = createHash('md5').update(hashInput).digest('hex');
    
    // Convert first 8 characters of hash to a number between 0 and 1
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const bucketValue = (hashValue / 0xffffffff) * 100;
    
    // Find the variant based on traffic percentages
    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      if (bucketValue < cumulativePercentage) {
        return variant.id;
      }
    }
    
    // Fallback to control variant (should never reach here if percentages sum to 100)
    const controlVariant = variants.find(v => v.is_control);
    return controlVariant?.id || variants[0].id;
  }

  /**
   * Advanced traffic splitting with multiple algorithms
   */
  assignVariantAdvanced(
    variants: Variant[],
    userId: string,
    experimentId: string,
    algorithm: 'hash' | 'random' | 'weighted-random' | 'sequential' = 'hash',
    userAttributes?: Record<string, any>
  ): string {
    switch (algorithm) {
      case 'random':
        return this.assignVariantRandom(variants);
      
      case 'weighted-random':
        return this.assignVariantWeightedRandom(variants);
      
      case 'sequential':
        return this.assignVariantSequential(variants, userId, experimentId);
      
      case 'hash':
      default:
        return this.assignVariant(variants, userId, experimentId);
    }
  }

  /**
   * Pure random assignment (not recommended for most use cases)
   */
  private assignVariantRandom(variants: Variant[]): string {
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex].id;
  }

  /**
   * Weighted random assignment based on traffic percentages
   */
  private assignVariantWeightedRandom(variants: Variant[]): string {
    const random = Math.random() * 100;
    let cumulativePercentage = 0;
    
    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      if (random < cumulativePercentage) {
        return variant.id;
      }
    }
    
    return variants[variants.length - 1].id;
  }

  /**
   * Sequential assignment for precise traffic distribution
   * Useful for small sample sizes
   */
  private assignVariantSequential(
    variants: Variant[],
    userId: string,
    experimentId: string
  ): string {
    // This would typically use a counter stored in database
    // For demo purposes, we'll use a hash-based approach
    const sequenceHash = createHash('md5')
      .update(`${experimentId}:sequence`)
      .digest('hex');
    
    const sequenceNumber = parseInt(sequenceHash.substring(0, 8), 16) % 100;
    
    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      if (sequenceNumber < cumulativePercentage) {
        return variant.id;
      }
    }
    
    return variants[0].id;
  }

  /**
   * Multi-armed bandit algorithm for dynamic traffic allocation
   * Adjusts traffic based on performance
   */
  assignVariantBandit(
    variants: Variant[],
    userId: string,
    experimentId: string,
    variantPerformance: Map<string, { conversions: number; impressions: number }>
  ): string {
    // Calculate upper confidence bounds for each variant
    const ucbScores = new Map<string, number>();
    const totalImpressions = Array.from(variantPerformance.values())
      .reduce((sum, perf) => sum + perf.impressions, 0);
    
    for (const variant of variants) {
      const perf = variantPerformance.get(variant.id) || { conversions: 0, impressions: 1 };
      const conversionRate = perf.conversions / Math.max(perf.impressions, 1);
      const explorationBonus = Math.sqrt(2 * Math.log(totalImpressions + 1) / Math.max(perf.impressions, 1));
      
      ucbScores.set(variant.id, conversionRate + explorationBonus);
    }
    
    // Select variant with highest UCB score
    let bestVariant = variants[0];
    let bestScore = -Infinity;
    
    for (const variant of variants) {
      const score = ucbScores.get(variant.id) || 0;
      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant;
      }
    }
    
    return bestVariant.id;
  }

  /**
   * Contextual bandit for personalized variant assignment
   */
  assignVariantContextual(
    variants: Variant[],
    userId: string,
    experimentId: string,
    userContext: Record<string, any>,
    contextualModel?: any // ML model for context-based assignment
  ): string {
    // If we have a trained model, use it for assignment
    if (contextualModel) {
      try {
        const prediction = contextualModel.predict(userContext);
        const variantIndex = Math.floor(prediction * variants.length);
        return variants[Math.min(variantIndex, variants.length - 1)].id;
      } catch (error) {
        console.error('Contextual model prediction failed:', error);
      }
    }
    
    // Fallback to hash-based assignment with context
    const contextString = JSON.stringify(userContext);
    const contextHash = createHash('md5')
      .update(`${userId}:${experimentId}:${contextString}`)
      .digest('hex');
    
    const hashValue = parseInt(contextHash.substring(0, 8), 16);
    const bucketValue = (hashValue / 0xffffffff) * 100;
    
    let cumulativePercentage = 0;
    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      if (bucketValue < cumulativePercentage) {
        return variant.id;
      }
    }
    
    return variants[0].id;
  }

  /**
   * Validate traffic split configuration
   */
  validateTrafficSplit(variants: Variant[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if we have at least 2 variants
    if (variants.length < 2) {
      errors.push('At least 2 variants are required for A/B testing');
    }
    
    // Check if traffic percentages sum to 100
    const totalPercentage = variants.reduce((sum, v) => sum + v.traffic_percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.push(`Traffic percentages must sum to 100%, got ${totalPercentage}%`);
    }
    
    // Check for negative percentages
    const negativePercentages = variants.filter(v => v.traffic_percentage < 0);
    if (negativePercentages.length > 0) {
      errors.push('Traffic percentages cannot be negative');
    }
    
    // Check for exactly one control variant
    const controlVariants = variants.filter(v => v.is_control);
    if (controlVariants.length !== 1) {
      errors.push('Exactly one control variant is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Rebalance traffic percentages proportionally
   */
  rebalanceTraffic(variants: Variant[], targetTotal: number = 100): Variant[] {
    const currentTotal = variants.reduce((sum, v) => sum + v.traffic_percentage, 0);
    
    if (currentTotal === 0) {
      // Equal distribution if all are zero
      const equalPercentage = targetTotal / variants.length;
      return variants.map(v => ({ ...v, traffic_percentage: equalPercentage }));
    }
    
    // Proportional rebalancing
    const scaleFactor = targetTotal / currentTotal;
    return variants.map(v => ({
      ...v,
      traffic_percentage: v.traffic_percentage * scaleFactor
    }));
  }
}

export default TrafficSplitter;