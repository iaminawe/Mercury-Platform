// Core A/B Testing Engine
import { 
  Experiment, 
  ExperimentEvent, 
  UserSegment, 
  Variant, 
  TargetingRule,
  ExperimentStatus,
  EventType,
  StatisticalConfig
} from './types';
import { StatisticalAnalyzer } from './statistical-analyzer';
import { SegmentAllocator } from './segment-allocator';
import { ResultTracker } from './result-tracker';
import { createClient } from '@/lib/supabase/client';

export class ExperimentEngine {
  private statisticalAnalyzer: StatisticalAnalyzer;
  private segmentAllocator: SegmentAllocator;
  private resultTracker: ResultTracker;
  private supabase;

  constructor() {
    this.statisticalAnalyzer = new StatisticalAnalyzer();
    this.segmentAllocator = new SegmentAllocator();
    this.resultTracker = new ResultTracker();
    this.supabase = createClient();
  }

  /**
   * Initialize a new A/B test experiment
   */
  async initializeExperiment(experiment: Omit<Experiment, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      // Validate experiment configuration
      this.validateExperimentConfig(experiment);
      
      // Calculate required sample size
      const sampleSize = this.statisticalAnalyzer.calculateSampleSize(
        experiment.statistical_config.minimum_detectable_effect,
        experiment.statistical_config.confidence_level,
        experiment.statistical_config.power
      );

      const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const fullExperiment: Experiment = {
        ...experiment,
        id: experimentId,
        created_at: new Date(),
        updated_at: new Date(),
        statistical_config: {
          ...experiment.statistical_config,
          minimum_sample_size: sampleSize
        }
      };

      // Store experiment in database
      const { error } = await this.supabase
        .from('experiments')
        .insert(fullExperiment);

      if (error) throw error;

      // Initialize tracking tables
      await this.resultTracker.initializeExperiment(experimentId);

      return experimentId;
    } catch (error) {
      console.error('Failed to initialize experiment:', error);
      throw error;
    }
  }

  /**
   * Assign user to experiment variant
   */
  async assignUserToVariant(
    experimentId: string, 
    userId: string, 
    userProperties: Record<string, any> = {},
    sessionProperties: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      // Get experiment configuration
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
        return null;
      }

      // Check if user already assigned (sticky bucketing)
      const existingSegment = await this.getUserSegment(experimentId, userId);
      if (existingSegment) {
        return existingSegment.variant_id;
      }

      // Check targeting rules
      if (!this.evaluateTargetingRules(experiment.targeting_rules, userProperties, sessionProperties)) {
        return null;
      }

      // Check traffic allocation
      if (!this.shouldIncludeInExperiment(experiment.traffic_allocation)) {
        return null;
      }

      // Assign to variant using segment allocator
      const variantId = this.segmentAllocator.assignToVariant(
        experimentId,
        userId,
        experiment.variants
      );

      // Store user segment
      const userSegment: UserSegment = {
        user_id: userId,
        experiment_id: experimentId,
        variant_id: variantId,
        assigned_at: new Date(),
        sticky_bucketing: true,
        user_properties,
        session_properties
      };

      await this.storeUserSegment(userSegment);

      // Track exposure event
      await this.trackEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        experiment_id: experimentId,
        variant_id: variantId,
        user_id: userId,
        session_id: sessionProperties.session_id || 'unknown',
        event_type: EventType.EXPOSURE,
        event_name: 'experiment_exposure',
        properties: { experiment_name: experiment.name },
        timestamp: new Date()
      });

      return variantId;
    } catch (error) {
      console.error('Failed to assign user to variant:', error);
      return null;
    }
  }

  /**
   * Track experiment event
   */
  async trackEvent(event: ExperimentEvent): Promise<void> {
    try {
      // Store event
      const { error } = await this.supabase
        .from('experiment_events')
        .insert(event);

      if (error) throw error;

      // Update real-time results
      await this.resultTracker.updateResults(event);

      // Check if experiment should auto-stop
      const experiment = await this.getExperiment(event.experiment_id);
      if (experiment && experiment.statistical_config.sequential_testing) {
        await this.checkForEarlyStopping(event.experiment_id);
      }
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  /**
   * Get experiment variant configuration for user
   */
  async getVariantConfig(experimentId: string, userId: string): Promise<any> {
    try {
      const variantId = await this.assignUserToVariant(experimentId, userId);
      if (!variantId) return null;

      const { data, error } = await this.supabase
        .from('experiment_variants')
        .select('config')
        .eq('experiment_id', experimentId)
        .eq('id', variantId)
        .single();

      if (error) throw error;
      return data?.config;
    } catch (error) {
      console.error('Failed to get variant config:', error);
      return null;
    }
  }

  /**
   * Start experiment
   */
  async startExperiment(experimentId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('experiments')
        .update({ 
          status: ExperimentStatus.RUNNING,
          start_date: new Date(),
          updated_at: new Date()
        })
        .eq('id', experimentId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to start experiment:', error);
      throw error;
    }
  }

  /**
   * Stop experiment
   */
  async stopExperiment(experimentId: string, reason: string = 'Manual stop'): Promise<void> {
    try {
      // Perform final analysis
      const analysis = await this.statisticalAnalyzer.analyzeExperiment(experimentId);
      
      const { error } = await this.supabase
        .from('experiments')
        .update({ 
          status: ExperimentStatus.COMPLETED,
          end_date: new Date(),
          updated_at: new Date(),
          results: analysis
        })
        .eq('id', experimentId);

      if (error) throw error;

      // Store final analysis
      await this.supabase
        .from('experiment_analyses')
        .insert({
          experiment_id: experimentId,
          analysis_type: 'frequentist',
          results: analysis,
          generated_at: new Date()
        });
    } catch (error) {
      console.error('Failed to stop experiment:', error);
      throw error;
    }
  }

  /**
   * Check for early stopping conditions
   */
  private async checkForEarlyStopping(experimentId: string): Promise<void> {
    try {
      const analysis = await this.statisticalAnalyzer.analyzeExperiment(experimentId);
      
      // Check if we have statistical significance and sufficient sample size
      if (analysis.statistical_significance.is_significant && 
          analysis.statistical_significance.sample_size_reached) {
        
        // Check if effect size is practically significant
        const primaryMetric = analysis.results.find(r => r.metric_name === 'primary_metric');
        if (primaryMetric && Math.abs(primaryMetric.effect_size) > 0.05) { // 5% practical significance threshold
          await this.stopExperiment(experimentId, 'Early stopping - statistical significance reached');
        }
      }

      // Check for futility (very low probability of reaching significance)
      const futilityThreshold = 0.1; // 10% chance of reaching significance
      if (analysis.sample_size_analysis.power_achieved < futilityThreshold) {
        await this.stopExperiment(experimentId, 'Early stopping - futility analysis');
      }
    } catch (error) {
      console.error('Failed to check early stopping:', error);
    }
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<any> {
    try {
      return await this.statisticalAnalyzer.analyzeExperiment(experimentId);
    } catch (error) {
      console.error('Failed to get experiment results:', error);
      throw error;
    }
  }

  /**
   * Get all active experiments for user
   */
  async getActiveExperimentsForUser(
    userId: string, 
    userProperties: Record<string, any> = {},
    sessionProperties: Record<string, any> = {}
  ): Promise<Record<string, string>> {
    try {
      const { data: experiments, error } = await this.supabase
        .from('experiments')
        .select('*')
        .eq('status', ExperimentStatus.RUNNING);

      if (error) throw error;

      const assignments: Record<string, string> = {};

      for (const experiment of experiments || []) {
        const variantId = await this.assignUserToVariant(
          experiment.id, 
          userId, 
          userProperties, 
          sessionProperties
        );
        if (variantId) {
          assignments[experiment.id] = variantId;
        }
      }

      return assignments;
    } catch (error) {
      console.error('Failed to get active experiments:', error);
      return {};
    }
  }

  // Private helper methods
  private validateExperimentConfig(experiment: any): void {
    if (!experiment.name || !experiment.variants || experiment.variants.length < 2) {
      throw new Error('Experiment must have a name and at least 2 variants');
    }

    const totalTraffic = experiment.variants.reduce((sum: number, v: Variant) => sum + v.traffic_percentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.1) {
      throw new Error('Variant traffic percentages must sum to 100%');
    }

    const controlVariants = experiment.variants.filter((v: Variant) => v.is_control);
    if (controlVariants.length !== 1) {
      throw new Error('Experiment must have exactly one control variant');
    }
  }

  private async getExperiment(experimentId: string): Promise<Experiment | null> {
    try {
      const { data, error } = await this.supabase
        .from('experiments')
        .select('*')
        .eq('id', experimentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get experiment:', error);
      return null;
    }
  }

  private async getUserSegment(experimentId: string, userId: string): Promise<UserSegment | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_segments')
        .select('*')
        .eq('experiment_id', experimentId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    } catch (error) {
      console.error('Failed to get user segment:', error);
      return null;
    }
  }

  private async storeUserSegment(userSegment: UserSegment): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_segments')
        .insert(userSegment);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to store user segment:', error);
      throw error;
    }
  }

  private evaluateTargetingRules(
    rules: TargetingRule[], 
    userProperties: Record<string, any>, 
    sessionProperties: Record<string, any>
  ): boolean {
    if (!rules || rules.length === 0) return true;

    return rules.every(rule => {
      const properties = rule.condition_type.includes('user') ? userProperties : sessionProperties;
      const value = properties[rule.property_name];
      
      let matches = false;
      
      switch (rule.operator) {
        case 'equals':
          matches = value === rule.property_value;
          break;
        case 'not_equals':
          matches = value !== rule.property_value;
          break;
        case 'contains':
          matches = String(value).includes(String(rule.property_value));
          break;
        case 'greater_than':
          matches = Number(value) > Number(rule.property_value);
          break;
        case 'less_than':
          matches = Number(value) < Number(rule.property_value);
          break;
        case 'in':
          matches = Array.isArray(rule.property_value) && rule.property_value.includes(value);
          break;
        case 'not_in':
          matches = Array.isArray(rule.property_value) && !rule.property_value.includes(value);
          break;
        default:
          matches = false;
      }

      return rule.inclusion ? matches : !matches;
    });
  }

  private shouldIncludeInExperiment(trafficAllocation: number): boolean {
    return Math.random() * 100 < trafficAllocation;
  }
}