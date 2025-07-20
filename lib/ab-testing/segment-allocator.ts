// User Segment Allocation Engine
import { Variant, UserSegment } from './types';
import crypto from 'crypto';

export class SegmentAllocator {
  /**
   * Assign user to variant using deterministic hashing
   */
  assignToVariant(experimentId: string, userId: string, variants: Variant[]): string {
    // Create deterministic hash from experiment ID and user ID
    const hash = this.createDeterministicHash(experimentId, userId);
    
    // Convert hash to number between 0-100
    const bucketValue = this.hashToPercentage(hash);
    
    // Allocate based on traffic percentages
    let cumulativePercentage = 0;
    
    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      
      if (bucketValue <= cumulativePercentage) {
        return variant.id;
      }
    }
    
    // Fallback to control variant
    const controlVariant = variants.find(v => v.is_control);
    return controlVariant?.id || variants[0].id;
  }

  /**
   * Assign user to multiple experiments simultaneously
   */
  assignToMultipleExperiments(
    experiments: Array<{ id: string; variants: Variant[] }>,
    userId: string
  ): Record<string, string> {
    const assignments: Record<string, string> = {};
    
    for (const experiment of experiments) {
      assignments[experiment.id] = this.assignToVariant(
        experiment.id,
        userId,
        experiment.variants
      );
    }
    
    return assignments;
  }

  /**
   * Check for allocation conflicts across experiments
   */
  detectAllocationConflicts(
    assignments: Record<string, string>,
    experimentConfigs: Record<string, any>
  ): Array<{ experiment1: string; experiment2: string; conflict: string }> {
    const conflicts: Array<{ experiment1: string; experiment2: string; conflict: string }> = [];
    const experimentIds = Object.keys(assignments);
    
    for (let i = 0; i < experimentIds.length; i++) {
      for (let j = i + 1; j < experimentIds.length; j++) {
        const exp1 = experimentIds[i];
        const exp2 = experimentIds[j];
        
        const conflict = this.checkExperimentConflict(
          exp1,
          exp2,
          assignments[exp1],
          assignments[exp2],
          experimentConfigs
        );
        
        if (conflict) {
          conflicts.push({
            experiment1: exp1,
            experiment2: exp2,
            conflict
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Rebalance traffic allocation for running experiment
   */
  rebalanceTrafficAllocation(
    experimentId: string,
    newVariants: Variant[],
    existingSegments: UserSegment[]
  ): {
    toReassign: UserSegment[];
    toKeep: UserSegment[];
    newAssignments: Record<string, string>;
  } {
    const toReassign: UserSegment[] = [];
    const toKeep: UserSegment[] = [];
    const newAssignments: Record<string, string> = {};
    
    // Check which users need reassignment
    for (const segment of existingSegments) {
      const currentVariant = newVariants.find(v => v.id === segment.variant_id);
      
      if (!currentVariant) {
        // Variant no longer exists, need to reassign
        toReassign.push(segment);
        const newVariantId = this.assignToVariant(experimentId, segment.user_id, newVariants);
        newAssignments[segment.user_id] = newVariantId;
      } else {
        // Re-check if user should stay in current variant based on new traffic allocation
        const shouldStay = this.shouldKeepInVariant(
          experimentId,
          segment.user_id,
          segment.variant_id,
          newVariants
        );
        
        if (shouldStay) {
          toKeep.push(segment);
        } else {
          toReassign.push(segment);
          const newVariantId = this.assignToVariant(experimentId, segment.user_id, newVariants);
          newAssignments[segment.user_id] = newVariantId;
        }
      }
    }
    
    return { toReassign, toKeep, newAssignments };
  }

  /**
   * Calculate optimal traffic allocation using multi-armed bandit
   */
  calculateOptimalAllocation(
    variants: Variant[],
    conversionData: Record<string, { conversions: number; participants: number }>,
    exploration: number = 0.1
  ): Record<string, number> {
    const allocation: Record<string, number> = {};
    
    // Thompson Sampling for multi-armed bandit
    const arms = variants.map(variant => {
      const data = conversionData[variant.id] || { conversions: 0, participants: 1 };
      const alpha = 1 + data.conversions; // Success count + prior
      const beta = 1 + (data.participants - data.conversions); // Failure count + prior
      
      return {
        id: variant.id,
        is_control: variant.is_control,
        sampled_rate: this.betaSample(alpha, beta)
      };
    });
    
    // Sort by sampled conversion rate
    arms.sort((a, b) => b.sampled_rate - a.sampled_rate);
    
    // Allocate traffic (ensure control gets minimum allocation)
    const controlArm = arms.find(arm => arm.is_control);
    const minControlAllocation = 20; // Minimum 20% for control
    
    if (controlArm) {
      allocation[controlArm.id] = Math.max(minControlAllocation, exploration * 100 / arms.length);
    }
    
    // Distribute remaining traffic based on performance
    const remainingTraffic = 100 - (allocation[controlArm?.id || ''] || 0);
    const nonControlArms = arms.filter(arm => !arm.is_control);
    
    let totalWeight = 0;
    const weights: Record<string, number> = {};
    
    nonControlArms.forEach(arm => {
      weights[arm.id] = Math.pow(arm.sampled_rate, 2); // Square to emphasize differences
      totalWeight += weights[arm.id];
    });
    
    nonControlArms.forEach(arm => {
      const baseAllocation = (weights[arm.id] / totalWeight) * remainingTraffic;
      const explorationBonus = (exploration * 100) / arms.length;
      allocation[arm.id] = Math.max(5, baseAllocation + explorationBonus); // Minimum 5%
    });
    
    // Normalize to 100%
    const total = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    Object.keys(allocation).forEach(variantId => {
      allocation[variantId] = (allocation[variantId] / total) * 100;
    });
    
    return allocation;
  }

  /**
   * Segment users for targeted experiments
   */
  segmentUsers(
    users: Array<{ id: string; properties: Record<string, any> }>,
    segmentationRules: Array<{
      name: string;
      conditions: Array<{ property: string; operator: string; value: any }>;
    }>
  ): Record<string, string[]> {
    const segments: Record<string, string[]> = {};
    
    // Initialize segments
    segmentationRules.forEach(rule => {
      segments[rule.name] = [];
    });
    
    // Segment each user
    users.forEach(user => {
      segmentationRules.forEach(rule => {
        if (this.evaluateSegmentConditions(user.properties, rule.conditions)) {
          segments[rule.name].push(user.id);
        }
      });
    });
    
    return segments;
  }

  /**
   * Calculate segment overlap analysis
   */
  analyzeSegmentOverlap(
    segments: Record<string, string[]>
  ): {
    overlaps: Array<{ segments: string[]; users: string[]; percentage: number }>;
    exclusivity: Record<string, number>;
  } {
    const segmentNames = Object.keys(segments);
    const overlaps: Array<{ segments: string[]; users: string[]; percentage: number }> = [];
    const exclusivity: Record<string, number> = {};
    
    // Calculate all possible overlaps
    for (let i = 0; i < segmentNames.length; i++) {
      for (let j = i + 1; j < segmentNames.length; j++) {
        const segment1 = segmentNames[i];
        const segment2 = segmentNames[j];
        
        const overlap = segments[segment1].filter(user => 
          segments[segment2].includes(user)
        );
        
        if (overlap.length > 0) {
          const percentage = (overlap.length / Math.min(
            segments[segment1].length,
            segments[segment2].length
          )) * 100;
          
          overlaps.push({
            segments: [segment1, segment2],
            users: overlap,
            percentage
          });
        }
      }
    }
    
    // Calculate exclusivity (users only in one segment)
    segmentNames.forEach(segmentName => {
      const exclusiveUsers = segments[segmentName].filter(user => {
        return !segmentNames.some(otherSegment => 
          otherSegment !== segmentName && segments[otherSegment].includes(user)
        );
      });
      
      exclusivity[segmentName] = (exclusiveUsers.length / segments[segmentName].length) * 100;
    });
    
    return { overlaps, exclusivity };
  }

  /**
   * Implement stratified sampling for balanced experiments
   */
  stratifiedSampling(
    users: Array<{ id: string; stratum: string }>,
    variants: Variant[],
    stratumWeights?: Record<string, number>
  ): Record<string, Array<{ userId: string; variantId: string }>> {
    const stratifiedAssignments: Record<string, Array<{ userId: string; variantId: string }>> = {};
    
    // Group users by stratum
    const strata: Record<string, string[]> = {};
    users.forEach(user => {
      if (!strata[user.stratum]) {
        strata[user.stratum] = [];
      }
      strata[user.stratum].push(user.id);
    });
    
    // Assign users within each stratum
    Object.keys(strata).forEach(stratum => {
      stratifiedAssignments[stratum] = [];
      const stratumUsers = strata[stratum];
      
      // If weights provided, adjust variant allocation for this stratum
      let adjustedVariants = variants;
      if (stratumWeights && stratumWeights[stratum]) {
        adjustedVariants = this.adjustVariantWeights(variants, stratumWeights[stratum]);
      }
      
      stratumUsers.forEach(userId => {
        const variantId = this.assignToVariant(`stratum_${stratum}`, userId, adjustedVariants);
        stratifiedAssignments[stratum].push({ userId, variantId });
      });
    });
    
    return stratifiedAssignments;
  }

  // Private helper methods
  private createDeterministicHash(experimentId: string, userId: string): string {
    const input = `${experimentId}:${userId}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  private hashToPercentage(hash: string): number {
    // Take first 8 characters and convert to number
    const hexValue = parseInt(hash.substring(0, 8), 16);
    const maxValue = parseInt('ffffffff', 16);
    return (hexValue / maxValue) * 100;
  }

  private checkExperimentConflict(
    exp1: string,
    exp2: string,
    variant1: string,
    variant2: string,
    configs: Record<string, any>
  ): string | null {
    const config1 = configs[exp1];
    const config2 = configs[exp2];
    
    if (!config1 || !config2) return null;
    
    // Check for feature flag conflicts
    if (config1.feature_flags && config2.feature_flags) {
      const conflictingFlags = Object.keys(config1.feature_flags).filter(flag =>
        config2.feature_flags.hasOwnProperty(flag)
      );
      
      if (conflictingFlags.length > 0) {
        return `Feature flag conflict: ${conflictingFlags.join(', ')}`;
      }
    }
    
    // Check for UI element conflicts
    if (config1.ui_elements && config2.ui_elements) {
      const conflictingElements = Object.keys(config1.ui_elements).filter(element =>
        config2.ui_elements.hasOwnProperty(element)
      );
      
      if (conflictingElements.length > 0) {
        return `UI element conflict: ${conflictingElements.join(', ')}`;
      }
    }
    
    // Check for page conflicts
    if (config1.target_pages && config2.target_pages) {
      const pageOverlap = config1.target_pages.some((page: string) =>
        config2.target_pages.includes(page)
      );
      
      if (pageOverlap) {
        return 'Page targeting conflict';
      }
    }
    
    return null;
  }

  private shouldKeepInVariant(
    experimentId: string,
    userId: string,
    currentVariantId: string,
    newVariants: Variant[]
  ): boolean {
    const newAssignment = this.assignToVariant(experimentId, userId, newVariants);
    return newAssignment === currentVariantId;
  }

  private betaSample(alpha: number, beta: number): number {
    // Simple approximation using normal distribution for large alpha + beta
    if (alpha + beta > 50) {
      const mean = alpha / (alpha + beta);
      const variance = (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1));
      const std = Math.sqrt(variance);
      
      // Box-Muller transform for normal random
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      return Math.max(0, Math.min(1, mean + z * std));
    }
    
    // For small alpha + beta, use simple approximation
    const x = Math.random();
    const y = Math.random();
    
    // Rejection sampling approximation
    if (y <= Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) {
      return x;
    }
    
    return alpha / (alpha + beta); // Fallback to mean
  }

  private evaluateSegmentConditions(
    properties: Record<string, any>,
    conditions: Array<{ property: string; operator: string; value: any }>
  ): boolean {
    return conditions.every(condition => {
      const propertyValue = properties[condition.property];
      
      switch (condition.operator) {
        case 'equals':
          return propertyValue === condition.value;
        case 'not_equals':
          return propertyValue !== condition.value;
        case 'greater_than':
          return Number(propertyValue) > Number(condition.value);
        case 'less_than':
          return Number(propertyValue) < Number(condition.value);
        case 'contains':
          return String(propertyValue).includes(String(condition.value));
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(propertyValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(propertyValue);
        default:
          return false;
      }
    });
  }

  private adjustVariantWeights(variants: Variant[], weight: number): Variant[] {
    return variants.map(variant => ({
      ...variant,
      traffic_percentage: variant.traffic_percentage * weight
    }));
  }
}