// Statistical Analysis Engine for A/B Testing
import { 
  ExperimentAnalysis, 
  AnalysisResult, 
  StatisticalSignificance, 
  ConfidenceInterval,
  Recommendation,
  RiskAssessment,
  SampleSizeAnalysis
} from './types';
import { createClient } from '@/lib/supabase/client';

export class StatisticalAnalyzer {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Calculate required sample size for experiment
   */
  calculateSampleSize(
    minimumDetectableEffect: number, 
    confidenceLevel: number = 0.95, 
    power: number = 0.8,
    baselineConversionRate: number = 0.05
  ): number {
    const alpha = 1 - confidenceLevel;
    const beta = 1 - power;
    
    // Convert to z-scores
    const zAlpha = this.getZScore(1 - alpha / 2);
    const zBeta = this.getZScore(1 - beta);
    
    // Calculate effect size
    const p1 = baselineConversionRate;
    const p2 = p1 * (1 + minimumDetectableEffect / 100);
    
    // Sample size formula for two-proportion z-test
    const pooledP = (p1 + p2) / 2;
    const pooledSE = Math.sqrt(2 * pooledP * (1 - pooledP));
    const effectSE = Math.abs(p2 - p1);
    
    const n = Math.pow(zAlpha * pooledSE + zBeta * effectSE, 2) / Math.pow(effectSE, 2);
    
    return Math.ceil(n);
  }

  /**
   * Perform comprehensive experiment analysis
   */
  async analyzeExperiment(experimentId: string): Promise<ExperimentAnalysis> {
    try {
      // Get experiment data
      const experiment = await this.getExperimentData(experimentId);
      const events = await this.getExperimentEvents(experimentId);
      const segments = await this.getUserSegments(experimentId);

      // Calculate conversion rates for each variant
      const conversionData = this.calculateConversions(events, segments, experiment.variants);
      
      // Perform statistical tests
      const analysisResults = await this.performStatisticalTests(conversionData, experiment.success_metrics);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analysisResults, conversionData);
      
      // Assess risk
      const riskAssessment = this.assessRisk(analysisResults, conversionData);
      
      // Analyze sample size
      const sampleSizeAnalysis = this.analyzeSampleSize(conversionData, experiment.statistical_config);

      return {
        experiment_id: experimentId,
        analysis_type: 'frequentist',
        results: analysisResults,
        recommendations,
        risk_assessment: riskAssessment,
        sample_size_analysis: sampleSizeAnalysis,
        generated_at: new Date()
      };
    } catch (error) {
      console.error('Failed to analyze experiment:', error);
      throw error;
    }
  }

  /**
   * Perform Bayesian analysis
   */
  async performBayesianAnalysis(experimentId: string): Promise<ExperimentAnalysis> {
    try {
      const experiment = await this.getExperimentData(experimentId);
      const events = await this.getExperimentEvents(experimentId);
      const segments = await this.getUserSegments(experimentId);

      const conversionData = this.calculateConversions(events, segments, experiment.variants);
      
      // Bayesian analysis using Beta-Binomial conjugate prior
      const bayesianResults = this.performBayesianTests(conversionData);
      
      const recommendations = this.generateBayesianRecommendations(bayesianResults);
      const riskAssessment = this.assessBayesianRisk(bayesianResults);
      const sampleSizeAnalysis = this.analyzeSampleSize(conversionData, experiment.statistical_config);

      return {
        experiment_id: experimentId,
        analysis_type: 'bayesian',
        results: bayesianResults,
        recommendations,
        risk_assessment: riskAssessment,
        sample_size_analysis: sampleSizeAnalysis,
        generated_at: new Date()
      };
    } catch (error) {
      console.error('Failed to perform Bayesian analysis:', error);
      throw error;
    }
  }

  /**
   * Calculate statistical significance using two-proportion z-test
   */
  calculateStatisticalSignificance(
    controlConversions: number,
    controlParticipants: number,
    treatmentConversions: number,
    treatmentParticipants: number,
    confidenceLevel: number = 0.95
  ): StatisticalSignificance {
    const p1 = controlConversions / controlParticipants;
    const p2 = treatmentConversions / treatmentParticipants;
    
    // Pooled proportion
    const pooledP = (controlConversions + treatmentConversions) / (controlParticipants + treatmentParticipants);
    
    // Standard error
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/controlParticipants + 1/treatmentParticipants));
    
    // Z-score
    const z = (p2 - p1) / se;
    
    // P-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    const alpha = 1 - confidenceLevel;
    const isSignificant = pValue < alpha;
    
    return {
      is_significant: isSignificant,
      confidence_level: confidenceLevel,
      p_value: pValue,
      test_type: 'two_tailed',
      sample_size_reached: (controlParticipants + treatmentParticipants) >= 100, // Minimum threshold
      minimum_runtime_met: true // This should check actual runtime
    };
  }

  /**
   * Calculate confidence intervals
   */
  calculateConfidenceInterval(
    conversions: number,
    participants: number,
    confidenceLevel: number = 0.95
  ): ConfidenceInterval {
    const p = conversions / participants;
    const alpha = 1 - confidenceLevel;
    const z = this.getZScore(1 - alpha / 2);
    
    const se = Math.sqrt((p * (1 - p)) / participants);
    const margin = z * se;
    
    return {
      lower_bound: Math.max(0, p - margin),
      upper_bound: Math.min(1, p + margin),
      confidence_level: confidenceLevel
    };
  }

  /**
   * Calculate effect size (Cohen's h for proportions)
   */
  calculateEffectSize(p1: number, p2: number): number {
    return 2 * (Math.asin(Math.sqrt(p2)) - Math.asin(Math.sqrt(p1)));
  }

  /**
   * Perform sequential testing for early stopping
   */
  performSequentialTest(
    controlConversions: number,
    controlParticipants: number,
    treatmentConversions: number,
    treatmentParticipants: number,
    alpha: number = 0.05,
    beta: number = 0.2
  ): { shouldStop: boolean; decision: 'continue' | 'stop_for_efficacy' | 'stop_for_futility' } {
    // Simplified Sequential Probability Ratio Test (SPRT)
    const p1 = controlConversions / controlParticipants;
    const p2 = treatmentConversions / treatmentParticipants;
    
    if (controlParticipants < 50 || treatmentParticipants < 50) {
      return { shouldStop: false, decision: 'continue' };
    }
    
    // Log likelihood ratio
    const logLR = this.calculateLogLikelihoodRatio(
      controlConversions, controlParticipants,
      treatmentConversions, treatmentParticipants,
      p1, p2
    );
    
    const upperBound = Math.log((1 - beta) / alpha);
    const lowerBound = Math.log(beta / (1 - alpha));
    
    if (logLR >= upperBound) {
      return { shouldStop: true, decision: 'stop_for_efficacy' };
    } else if (logLR <= lowerBound) {
      return { shouldStop: true, decision: 'stop_for_futility' };
    } else {
      return { shouldStop: false, decision: 'continue' };
    }
  }

  /**
   * Multiple comparisons correction
   */
  applyMultipleComparisons(
    pValues: number[], 
    method: 'bonferroni' | 'benjamini_hochberg' | 'none' = 'benjamini_hochberg'
  ): number[] {
    if (method === 'none') return pValues;
    
    const n = pValues.length;
    
    if (method === 'bonferroni') {
      return pValues.map(p => Math.min(1, p * n));
    }
    
    if (method === 'benjamini_hochberg') {
      // Benjamini-Hochberg procedure
      const sortedIndices = pValues
        .map((p, i) => ({ p, i }))
        .sort((a, b) => a.p - b.p);
      
      const adjustedP = new Array(n);
      
      for (let k = n - 1; k >= 0; k--) {
        const { p, i } = sortedIndices[k];
        const adjustment = (n / (k + 1)) * p;
        adjustedP[i] = k === n - 1 ? adjustment : Math.min(adjustment, adjustedP[sortedIndices[k + 1].i]);
      }
      
      return adjustedP.map(p => Math.min(1, p));
    }
    
    return pValues;
  }

  // Private helper methods
  private async getExperimentData(experimentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single();
    
    if (error) throw error;
    return data;
  }

  private async getExperimentEvents(experimentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId);
    
    if (error) throw error;
    return data || [];
  }

  private async getUserSegments(experimentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('user_segments')
      .select('*')
      .eq('experiment_id', experimentId);
    
    if (error) throw error;
    return data || [];
  }

  private calculateConversions(events: any[], segments: any[], variants: any[]): Record<string, any> {
    const conversionData: Record<string, any> = {};
    
    variants.forEach(variant => {
      const variantSegments = segments.filter(s => s.variant_id === variant.id);
      const variantEvents = events.filter(e => e.variant_id === variant.id);
      
      const participants = variantSegments.length;
      const conversions = variantEvents.filter(e => e.event_type === 'conversion').length;
      const revenue = variantEvents
        .filter(e => e.revenue)
        .reduce((sum, e) => sum + (e.revenue || 0), 0);
      
      conversionData[variant.id] = {
        variant_id: variant.id,
        participants,
        conversions,
        conversion_rate: participants > 0 ? conversions / participants : 0,
        revenue,
        average_order_value: conversions > 0 ? revenue / conversions : 0
      };
    });
    
    return conversionData;
  }

  private async performStatisticalTests(conversionData: Record<string, any>, metrics: any[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const variants = Object.keys(conversionData);
    const controlVariant = variants[0]; // Assuming first variant is control
    
    for (let i = 1; i < variants.length; i++) {
      const treatmentVariant = variants[i];
      
      const controlData = conversionData[controlVariant];
      const treatmentData = conversionData[treatmentVariant];
      
      const significance = this.calculateStatisticalSignificance(
        controlData.conversions,
        controlData.participants,
        treatmentData.conversions,
        treatmentData.participants
      );
      
      const lift = ((treatmentData.conversion_rate - controlData.conversion_rate) / controlData.conversion_rate) * 100;
      
      const confidenceInterval = this.calculateConfidenceInterval(
        treatmentData.conversions,
        treatmentData.participants
      );
      
      const effectSize = this.calculateEffectSize(
        controlData.conversion_rate,
        treatmentData.conversion_rate
      );
      
      results.push({
        metric_id: 'conversion_rate',
        metric_name: 'Conversion Rate',
        control_value: controlData.conversion_rate,
        treatment_values: { [treatmentVariant]: treatmentData.conversion_rate },
        lift: { [treatmentVariant]: lift },
        p_value: significance.p_value,
        confidence_interval: confidenceInterval,
        is_significant: significance.is_significant,
        effect_size: effectSize,
        practical_significance: Math.abs(lift) > 5 // 5% practical significance threshold
      });
    }
    
    return results;
  }

  private performBayesianTests(conversionData: Record<string, any>): AnalysisResult[] {
    // Bayesian analysis using Beta-Binomial model
    const results: AnalysisResult[] = [];
    const variants = Object.keys(conversionData);
    const controlVariant = variants[0];
    
    // Prior parameters (uninformative prior)
    const alpha_prior = 1;
    const beta_prior = 1;
    
    for (let i = 1; i < variants.length; i++) {
      const treatmentVariant = variants[i];
      
      const controlData = conversionData[controlVariant];
      const treatmentData = conversionData[treatmentVariant];
      
      // Posterior parameters
      const control_alpha = alpha_prior + controlData.conversions;
      const control_beta = beta_prior + controlData.participants - controlData.conversions;
      
      const treatment_alpha = alpha_prior + treatmentData.conversions;
      const treatment_beta = beta_prior + treatmentData.participants - treatmentData.conversions;
      
      // Probability that treatment > control
      const prob_better = this.calculateBayesianProbability(
        treatment_alpha, treatment_beta,
        control_alpha, control_beta
      );
      
      // Credible interval (Bayesian confidence interval)
      const credibleInterval = this.calculateBayesianCredibleInterval(
        treatment_alpha, treatment_beta, 0.95
      );
      
      const lift = ((treatmentData.conversion_rate - controlData.conversion_rate) / controlData.conversion_rate) * 100;
      
      results.push({
        metric_id: 'conversion_rate',
        metric_name: 'Conversion Rate',
        control_value: controlData.conversion_rate,
        treatment_values: { [treatmentVariant]: treatmentData.conversion_rate },
        lift: { [treatmentVariant]: lift },
        p_value: 1 - prob_better, // Convert to p-value equivalent
        confidence_interval: {
          lower_bound: credibleInterval.lower,
          upper_bound: credibleInterval.upper,
          confidence_level: 0.95
        },
        is_significant: prob_better > 0.95, // 95% probability threshold
        effect_size: Math.abs(lift) / 100,
        practical_significance: Math.abs(lift) > 5
      });
    }
    
    return results;
  }

  private generateRecommendations(results: AnalysisResult[], conversionData: Record<string, any>): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    const significantResults = results.filter(r => r.is_significant && r.practical_significance);
    
    if (significantResults.length === 0) {
      recommendations.push({
        type: 'continue',
        reason: 'No statistically significant results found',
        confidence: 0.7,
        suggested_action: 'Continue running experiment or increase sample size',
        impact_estimate: 0
      });
    } else {
      const bestResult = significantResults.reduce((best, current) => 
        Math.abs(current.effect_size) > Math.abs(best.effect_size) ? current : best
      );
      
      const winningVariant = Object.keys(bestResult.treatment_values)[0];
      const lift = bestResult.lift[winningVariant];
      
      recommendations.push({
        type: 'winner',
        reason: `Variant ${winningVariant} shows significant improvement`,
        confidence: bestResult.p_value < 0.01 ? 0.99 : 0.95,
        suggested_action: `Implement variant ${winningVariant} to all users`,
        impact_estimate: lift
      });
    }
    
    return recommendations;
  }

  private generateBayesianRecommendations(results: AnalysisResult[]): Recommendation[] {
    // Similar to frequentist but using Bayesian probability thresholds
    return this.generateRecommendations(results, {});
  }

  private assessRisk(results: AnalysisResult[], conversionData: Record<string, any>): RiskAssessment {
    const significantResults = results.filter(r => r.is_significant);
    const minPValue = Math.min(...results.map(r => r.p_value));
    
    return {
      current_risk: minPValue,
      estimated_loss: 0, // Would need business context to calculate
      confidence_in_result: significantResults.length > 0 ? 0.9 : 0.3,
      sample_size_adequacy: results.every(r => r.is_significant) ? 'excellent' : 'adequate'
    };
  }

  private assessBayesianRisk(results: AnalysisResult[]): RiskAssessment {
    return this.assessRisk(results, {});
  }

  private analyzeSampleSize(conversionData: Record<string, any>, config: any): SampleSizeAnalysis {
    const totalSampleSize = Object.values(conversionData).reduce((sum: number, data: any) => sum + data.participants, 0);
    
    return {
      current_sample_size: totalSampleSize,
      required_sample_size: config.minimum_sample_size || 1000,
      days_to_significance: Math.max(0, Math.ceil((config.minimum_sample_size - totalSampleSize) / 100)), // Assume 100 users per day
      power_achieved: totalSampleSize >= config.minimum_sample_size ? 0.8 : (totalSampleSize / config.minimum_sample_size) * 0.8,
      mde_achieved: config.minimum_detectable_effect
    };
  }

  // Statistical utility functions
  private getZScore(p: number): number {
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
      return -this.getZScore(1 - p);
    }
    
    const t = Math.sqrt(-2 * Math.log(p));
    
    return t - ((c0 + c1 * t + c2 * t * t + c3 * t * t * t + c4 * t * t * t * t + 
                 c5 * t * t * t * t * t + c6 * t * t * t * t * t * t + 
                 c7 * t * t * t * t * t * t * t + c8 * t * t * t * t * t * t * t * t) / 
                (1 + c1 * t + c2 * t * t + c3 * t * t * t + c4 * t * t * t * t + 
                 c5 * t * t * t * t * t + c6 * t * t * t * t * t * t + 
                 c7 * t * t * t * t * t * t * t + c8 * t * t * t * t * t * t * t * t));
  }

  private normalCDF(x: number): number {
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

  private calculateLogLikelihoodRatio(
    x1: number, n1: number, x2: number, n2: number, p1: number, p2: number
  ): number {
    const likelihood1 = this.binomialLogLikelihood(x1, n1, p1) + this.binomialLogLikelihood(x2, n2, p1);
    const likelihood2 = this.binomialLogLikelihood(x1, n1, p1) + this.binomialLogLikelihood(x2, n2, p2);
    
    return likelihood2 - likelihood1;
  }

  private binomialLogLikelihood(x: number, n: number, p: number): number {
    if (p === 0 || p === 1) return -Infinity;
    return x * Math.log(p) + (n - x) * Math.log(1 - p);
  }

  private calculateBayesianProbability(alpha1: number, beta1: number, alpha2: number, beta2: number): number {
    // Monte Carlo approximation of P(p1 > p2) for Beta distributions
    const samples = 10000;
    let count = 0;
    
    for (let i = 0; i < samples; i++) {
      const p1 = this.betaRandom(alpha1, beta1);
      const p2 = this.betaRandom(alpha2, beta2);
      
      if (p1 > p2) count++;
    }
    
    return count / samples;
  }

  private betaRandom(alpha: number, beta: number): number {
    // Simple rejection sampling for Beta distribution
    let x, y;
    do {
      x = Math.random();
      y = Math.random();
    } while (y > Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1));
    
    return x;
  }

  private calculateBayesianCredibleInterval(alpha: number, beta: number, confidence: number): { lower: number, upper: number } {
    // Approximation using quantiles
    const tail = (1 - confidence) / 2;
    
    // For Beta distribution, use approximation
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1));
    const std = Math.sqrt(variance);
    
    return {
      lower: Math.max(0, mean - 1.96 * std),
      upper: Math.min(1, mean + 1.96 * std)
    };
  }
}