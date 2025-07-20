// A/B Testing Framework Main Export
export { ExperimentEngine } from './experiment-engine';
export { StatisticalAnalyzer } from './statistical-analyzer';
export { SegmentAllocator } from './segment-allocator';
export { ResultTracker } from './result-tracker';
export { ConversionOptimizer } from './conversion-optimizer';

// Export all types
export * from './types';

// Utility functions for A/B testing
export const ABTestingUtils = {
  /**
   * Calculate sample size for A/B test
   */
  calculateSampleSize: (
    baselineRate: number,
    minimumDetectableEffect: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number => {
    const zAlpha = getZScore(1 - alpha / 2);
    const zBeta = getZScore(power);
    
    const p1 = baselineRate;
    const p2 = p1 * (1 + minimumDetectableEffect);
    
    const pooledP = (p1 + p2) / 2;
    const pooledSE = Math.sqrt(2 * pooledP * (1 - pooledP));
    const effectSE = Math.abs(p2 - p1);
    
    const n = Math.pow(zAlpha * pooledSE + zBeta * effectSE, 2) / Math.pow(effectSE, 2);
    
    return Math.ceil(n);
  },

  /**
   * Calculate statistical significance
   */
  calculateSignificance: (
    controlConversions: number,
    controlParticipants: number,
    treatmentConversions: number,
    treatmentParticipants: number
  ): { pValue: number; isSignificant: boolean; zScore: number } => {
    const p1 = controlConversions / controlParticipants;
    const p2 = treatmentConversions / treatmentParticipants;
    
    const pooledP = (controlConversions + treatmentConversions) / 
                   (controlParticipants + treatmentParticipants);
    
    const se = Math.sqrt(pooledP * (1 - pooledP) * 
                        (1/controlParticipants + 1/treatmentParticipants));
    
    const zScore = (p2 - p1) / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
    
    return {
      pValue,
      isSignificant: pValue < 0.05,
      zScore
    };
  },

  /**
   * Calculate confidence interval
   */
  calculateConfidenceInterval: (
    conversions: number,
    participants: number,
    confidenceLevel: number = 0.95
  ): { lower: number; upper: number } => {
    const p = conversions / participants;
    const alpha = 1 - confidenceLevel;
    const z = getZScore(1 - alpha / 2);
    
    const se = Math.sqrt((p * (1 - p)) / participants);
    const margin = z * se;
    
    return {
      lower: Math.max(0, p - margin),
      upper: Math.min(1, p + margin)
    };
  },

  /**
   * Calculate effect size (Cohen's h)
   */
  calculateEffectSize: (p1: number, p2: number): number => {
    return 2 * (Math.asin(Math.sqrt(p2)) - Math.asin(Math.sqrt(p1)));
  },

  /**
   * Validate experiment configuration
   */
  validateExperiment: (experiment: any): string[] => {
    const errors: string[] = [];

    if (!experiment.name?.trim()) {
      errors.push('Experiment name is required');
    }

    if (!experiment.variants || experiment.variants.length < 2) {
      errors.push('At least 2 variants are required');
    }

    if (experiment.variants) {
      const totalTraffic = experiment.variants.reduce(
        (sum: number, v: any) => sum + (v.traffic_percentage || 0), 0
      );
      if (Math.abs(totalTraffic - 100) > 0.1) {
        errors.push('Variant traffic percentages must sum to 100%');
      }

      const controlVariants = experiment.variants.filter((v: any) => v.is_control);
      if (controlVariants.length !== 1) {
        errors.push('Exactly one control variant is required');
      }
    }

    if (!experiment.success_metrics || experiment.success_metrics.length === 0) {
      errors.push('At least one success metric is required');
    }

    return errors;
  },

  /**
   * Generate experiment ID
   */
  generateExperimentId: (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `exp_${timestamp}_${random}`;
  },

  /**
   * Calculate experiment duration estimate
   */
  estimateDuration: (
    requiredSampleSize: number,
    trafficPerDay: number,
    trafficAllocation: number
  ): number => {
    const effectiveTrafficPerDay = trafficPerDay * (trafficAllocation / 100);
    return Math.ceil(requiredSampleSize / effectiveTrafficPerDay);
  },

  /**
   * Calculate minimum detectable effect
   */
  calculateMDE: (
    sampleSize: number,
    baselineRate: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number => {
    const zAlpha = getZScore(1 - alpha / 2);
    const zBeta = getZScore(power);
    
    const p1 = baselineRate;
    const se1 = Math.sqrt((p1 * (1 - p1)) / sampleSize);
    
    // Iterative solution for MDE
    let mde = 0.01; // Start with 1%
    let iterations = 0;
    const maxIterations = 1000;
    
    while (iterations < maxIterations) {
      const p2 = p1 * (1 + mde);
      const pooledP = (p1 + p2) / 2;
      const pooledSE = Math.sqrt(2 * pooledP * (1 - pooledP) / sampleSize);
      const effectSE = Math.abs(p2 - p1);
      
      const calculatedPower = normalCDF((effectSE / pooledSE) - zAlpha);
      
      if (Math.abs(calculatedPower - power) < 0.001) {
        break;
      }
      
      if (calculatedPower < power) {
        mde += 0.001;
      } else {
        mde -= 0.0001;
      }
      
      iterations++;
    }
    
    return mde;
  }
};

// Helper functions
function getZScore(p: number): number {
  // Approximation of inverse normal CDF
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  
  const a0 = 2.50662823884;
  const a1 = -18.61500062529;
  const a2 = 41.39119773534;
  const a3 = -25.44106049637;
  
  const b0 = -8.47351093090;
  const b1 = 23.08336743743;
  const b2 = -21.06224101826;
  const b3 = 3.13082909833;
  
  const c0 = 0.3374754822726147;
  const c1 = 0.9761690190917186;
  const c2 = 0.1607979714918209;
  const c3 = 0.0276438810333863;
  const c4 = 0.0038405729373609;
  const c5 = 0.0003951896511919;
  const c6 = 0.0000321767881768;
  const c7 = 0.0000002888167364;
  const c8 = 0.0000003960315187;
  
  if (p > 0.5) {
    return -getZScore(1 - p);
  }
  
  const t = Math.sqrt(-2 * Math.log(p));
  
  return t - ((c0 + c1 * t + c2 * t * t + c3 * t * t * t + c4 * t * t * t * t + 
               c5 * t * t * t * t * t + c6 * t * t * t * t * t * t + 
               c7 * t * t * t * t * t * t * t + c8 * t * t * t * t * t * t * t * t) / 
              (1 + c1 * t + c2 * t * t + c3 * t * t * t + c4 * t * t * t * t + 
               c5 * t * t * t * t * t + c6 * t * t * t * t * t * t + 
               c7 * t * t * t * t * t * t * t + c8 * t * t * t * t * t * t * t * t));
}

function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x: number): number {
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

// A/B Testing Factory Functions
export const createExperiment = async (config: any) => {
  const engine = new ExperimentEngine();
  return await engine.initializeExperiment(config);
};

export const getExperimentResults = async (experimentId: string) => {
  const analyzer = new StatisticalAnalyzer();
  return await analyzer.analyzeExperiment(experimentId);
};

export const optimizeExperiment = async (experimentId: string, algorithm: string = 'thompson_sampling') => {
  const optimizer = new ConversionOptimizer();
  return await optimizer.optimizeWithBandit(experimentId, algorithm as any);
};

// Feature-specific experiment helpers
export const createProductPageTest = (config: {
  name: string;
  elements: string[];
  variants: Array<{ name: string; changes: Record<string, any> }>;
}) => {
  return {
    ...config,
    type: 'ab_test',
    success_metrics: [
      {
        id: 'add_to_cart',
        name: 'Add to Cart Rate',
        type: 'conversion',
        event_name: 'add_to_cart',
        is_primary: true,
        goal_direction: 'increase',
        minimum_detectable_effect: 5
      },
      {
        id: 'purchase_rate',
        name: 'Purchase Rate',
        type: 'conversion',
        event_name: 'purchase',
        is_primary: false,
        goal_direction: 'increase',
        minimum_detectable_effect: 3
      }
    ]
  };
};

export const createEmailCampaignTest = (config: {
  name: string;
  elements: string[];
  variants: Array<{ name: string; template_id: string; changes: Record<string, any> }>;
}) => {
  return {
    ...config,
    type: 'ab_test',
    success_metrics: [
      {
        id: 'open_rate',
        name: 'Email Open Rate',
        type: 'engagement',
        event_name: 'email_open',
        is_primary: true,
        goal_direction: 'increase',
        minimum_detectable_effect: 10
      },
      {
        id: 'click_rate',
        name: 'Click Through Rate',
        type: 'engagement',
        event_name: 'email_click',
        is_primary: false,
        goal_direction: 'increase',
        minimum_detectable_effect: 15
      }
    ]
  };
};

export const createCheckoutFlowTest = (config: {
  name: string;
  flow_changes: string[];
  variants: Array<{ name: string; flow_config: Record<string, any> }>;
}) => {
  return {
    ...config,
    type: 'ab_test',
    success_metrics: [
      {
        id: 'checkout_completion',
        name: 'Checkout Completion Rate',
        type: 'conversion',
        event_name: 'checkout_complete',
        is_primary: true,
        goal_direction: 'increase',
        minimum_detectable_effect: 8
      },
      {
        id: 'cart_abandonment',
        name: 'Cart Abandonment Rate',
        type: 'conversion',
        event_name: 'cart_abandon',
        is_primary: false,
        goal_direction: 'decrease',
        minimum_detectable_effect: 5
      }
    ]
  };
};

export const createPricingStrategyTest = (config: {
  name: string;
  pricing_elements: string[];
  variants: Array<{ name: string; pricing_config: Record<string, any> }>;
}) => {
  return {
    ...config,
    type: 'ab_test',
    success_metrics: [
      {
        id: 'purchase_rate',
        name: 'Purchase Rate',
        type: 'conversion',
        event_name: 'purchase',
        is_primary: true,
        goal_direction: 'increase',
        minimum_detectable_effect: 5
      },
      {
        id: 'average_order_value',
        name: 'Average Order Value',
        type: 'revenue',
        event_name: 'purchase',
        is_primary: false,
        goal_direction: 'increase',
        minimum_detectable_effect: 10
      }
    ]
  };
};

// Advanced A/B Testing Features
export const MultiVariateTestBuilder = {
  /**
   * Create multivariate test configuration
   */
  createMultiVariateTest: (factors: Array<{
    name: string;
    levels: string[];
  }>) => {
    const variants = [];
    
    // Generate all combinations
    const generateCombinations = (factorIndex: number, currentCombination: Record<string, string>): void => {
      if (factorIndex >= factors.length) {
        variants.push({
          id: `variant_${variants.length}`,
          name: Object.values(currentCombination).join(' + '),
          is_control: variants.length === 0,
          config: { ...currentCombination }
        });
        return;
      }
      
      const factor = factors[factorIndex];
      for (const level of factor.levels) {
        generateCombinations(factorIndex + 1, {
          ...currentCombination,
          [factor.name]: level
        });
      }
    };
    
    generateCombinations(0, {});
    
    return {
      type: 'multivariate',
      factors,
      variants,
      traffic_percentage: Math.floor(100 / variants.length)
    };
  },

  /**
   * Analyze interaction effects
   */
  analyzeInteractions: (results: any) => {
    // Implementation for factorial analysis
    return {
      main_effects: {},
      interaction_effects: {},
      significance: {}
    };
  }
};

export const BanditOptimizer = {
  /**
   * Thompson Sampling implementation
   */
  thompsonSampling: (arms: Array<{ alpha: number; beta: number }>) => {
    const samples = arms.map(arm => {
      // Beta distribution sampling approximation
      const mean = arm.alpha / (arm.alpha + arm.beta);
      const variance = (arm.alpha * arm.beta) / 
                      ((arm.alpha + arm.beta) ** 2 * (arm.alpha + arm.beta + 1));
      
      // Use normal approximation for large alpha + beta
      if (arm.alpha + arm.beta > 50) {
        const std = Math.sqrt(variance);
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return Math.max(0, Math.min(1, mean + z * std));
      }
      
      return mean; // Fallback to mean
    });
    
    return samples.indexOf(Math.max(...samples));
  },

  /**
   * UCB (Upper Confidence Bound) implementation
   */
  upperConfidenceBound: (
    arms: Array<{ successes: number; trials: number }>,
    totalTrials: number,
    c: number = 2
  ) => {
    const ucbValues = arms.map(arm => {
      if (arm.trials === 0) return Infinity;
      
      const mean = arm.successes / arm.trials;
      const confidence = Math.sqrt((c * Math.log(totalTrials)) / arm.trials);
      
      return mean + confidence;
    });
    
    return ucbValues.indexOf(Math.max(...ucbValues));
  }
};

// Integration helpers
export const ShopifyABTesting = {
  /**
   * Create Shopify-specific product test
   */
  createProductTest: (productId: string, variants: any[]) => {
    return createProductPageTest({
      name: `Product ${productId} Optimization`,
      elements: ['product_images', 'description', 'pricing', 'add_to_cart_button'],
      variants
    });
  },

  /**
   * Create collection page test
   */
  createCollectionTest: (collectionId: string, variants: any[]) => {
    return {
      name: `Collection ${collectionId} Optimization`,
      type: 'ab_test',
      targeting_rules: [
        {
          condition_type: 'session_property',
          property_name: 'collection_id',
          operator: 'equals',
          property_value: collectionId,
          inclusion: true
        }
      ],
      variants,
      success_metrics: [
        {
          id: 'product_clicks',
          name: 'Product Click Rate',
          type: 'engagement',
          event_name: 'product_click',
          is_primary: true,
          goal_direction: 'increase'
        }
      ]
    };
  },

  /**
   * Create cart optimization test
   */
  createCartTest: (variants: any[]) => {
    return {
      name: 'Shopping Cart Optimization',
      type: 'ab_test',
      targeting_rules: [
        {
          condition_type: 'session_property',
          property_name: 'has_cart_items',
          operator: 'equals',
          property_value: 'true',
          inclusion: true
        }
      ],
      variants,
      success_metrics: [
        {
          id: 'checkout_initiation',
          name: 'Checkout Initiation Rate',
          type: 'conversion',
          event_name: 'checkout_start',
          is_primary: true,
          goal_direction: 'increase'
        }
      ]
    };
  }
};