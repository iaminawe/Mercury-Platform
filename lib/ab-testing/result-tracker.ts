// Real-time Experiment Result Tracking
import { 
  ExperimentEvent, 
  ConversionResult, 
  ExperimentResults,
  EventType 
} from './types';
import { createClient } from '@/lib/supabase/client';

export class ResultTracker {
  private supabase;
  private cache: Map<string, any> = new Map();
  private batchQueue: Map<string, ExperimentEvent[]> = new Map();
  private batchTimeout: number = 5000; // 5 seconds
  private maxBatchSize: number = 100;

  constructor() {
    this.supabase = createClient();
    this.startBatchProcessor();
  }

  /**
   * Initialize tracking tables for experiment
   */
  async initializeExperiment(experimentId: string): Promise<void> {
    try {
      // Create experiment results entry
      const initialResults: ExperimentResults = {
        total_participants: 0,
        conversion_rates: {},
        statistical_significance: {
          is_significant: false,
          confidence_level: 0.95,
          p_value: 1.0,
          test_type: 'two_tailed',
          sample_size_reached: false,
          minimum_runtime_met: false
        },
        confidence_intervals: {},
        p_values: {},
        effect_sizes: {},
        recommendations: [],
        lift: {},
        revenue_impact: 0,
        last_updated: new Date()
      };

      await this.supabase
        .from('experiment_results')
        .upsert({
          experiment_id: experimentId,
          results: initialResults,
          last_updated: new Date()
        });

      // Initialize cache
      this.cache.set(`results_${experimentId}`, initialResults);
    } catch (error) {
      console.error('Failed to initialize experiment tracking:', error);
      throw error;
    }
  }

  /**
   * Track experiment event with batching for performance
   */
  async trackEvent(event: ExperimentEvent): Promise<void> {
    try {
      // Add to batch queue
      if (!this.batchQueue.has(event.experiment_id)) {
        this.batchQueue.set(event.experiment_id, []);
      }
      
      this.batchQueue.get(event.experiment_id)!.push(event);
      
      // Process batch if it reaches max size
      const batch = this.batchQueue.get(event.experiment_id)!;
      if (batch.length >= this.maxBatchSize) {
        await this.processBatch(event.experiment_id);
      }
      
      // Update real-time metrics for critical events
      if (event.event_type === EventType.CONVERSION || event.event_type === EventType.PURCHASE) {
        await this.updateRealTimeMetrics(event);
      }
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  /**
   * Update experiment results in real-time
   */
  async updateResults(event: ExperimentEvent): Promise<void> {
    try {
      const cacheKey = `results_${event.experiment_id}`;
      let results = this.cache.get(cacheKey);
      
      if (!results) {
        results = await this.getExperimentResults(event.experiment_id);
        this.cache.set(cacheKey, results);
      }
      
      // Update metrics based on event type
      switch (event.event_type) {
        case EventType.EXPOSURE:
          await this.updateParticipantCount(event.experiment_id, event.variant_id);
          break;
        case EventType.CONVERSION:
          await this.updateConversionMetrics(event);
          break;
        case EventType.PURCHASE:
          await this.updateRevenueMetrics(event);
          break;
      }
      
      // Update last_updated timestamp
      results.last_updated = new Date();
      this.cache.set(cacheKey, results);
      
      // Persist to database (throttled)
      await this.throttledPersist(event.experiment_id, results);
    } catch (error) {
      console.error('Failed to update results:', error);
      throw error;
    }
  }

  /**
   * Get real-time experiment results
   */
  async getExperimentResults(experimentId: string): Promise<ExperimentResults> {
    try {
      const cacheKey = `results_${experimentId}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      // Fetch from database
      const { data, error } = await this.supabase
        .from('experiment_results')
        .select('results')
        .eq('experiment_id', experimentId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      const results = data?.results || this.getDefaultResults();
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Failed to get experiment results:', error);
      return this.getDefaultResults();
    }
  }

  /**
   * Calculate conversion funnel analysis
   */
  async calculateConversionFunnel(
    experimentId: string,
    funnelSteps: string[]
  ): Promise<Record<string, { step: string; conversions: number; dropoff: number }[]>> {
    try {
      const { data: events, error } = await this.supabase
        .from('experiment_events')
        .select('variant_id, event_name, user_id, timestamp')
        .eq('experiment_id', experimentId)
        .in('event_name', funnelSteps)
        .order('timestamp');
      
      if (error) throw error;
      
      const funnelData: Record<string, { step: string; conversions: number; dropoff: number }[]> = {};
      
      // Group events by variant
      const variantEvents: Record<string, any[]> = {};
      events?.forEach(event => {
        if (!variantEvents[event.variant_id]) {
          variantEvents[event.variant_id] = [];
        }
        variantEvents[event.variant_id].push(event);
      });
      
      // Calculate funnel for each variant
      Object.keys(variantEvents).forEach(variantId => {
        const events = variantEvents[variantId];
        const userJourney: Record<string, string[]> = {};
        
        // Track user journey through funnel
        events.forEach(event => {
          if (!userJourney[event.user_id]) {
            userJourney[event.user_id] = [];
          }
          userJourney[event.user_id].push(event.event_name);
        });
        
        // Calculate funnel metrics
        const funnelMetrics = funnelSteps.map((step, index) => {
          const usersAtStep = Object.values(userJourney).filter(journey => 
            journey.includes(step)
          ).length;
          
          const usersAtPreviousStep = index === 0 ? 
            Object.keys(userJourney).length : 
            Object.values(userJourney).filter(journey => 
              journey.includes(funnelSteps[index - 1])
            ).length;
          
          const dropoff = index === 0 ? 0 : 
            ((usersAtPreviousStep - usersAtStep) / usersAtPreviousStep) * 100;
          
          return {
            step,
            conversions: usersAtStep,
            dropoff
          };
        });
        
        funnelData[variantId] = funnelMetrics;
      });
      
      return funnelData;
    } catch (error) {
      console.error('Failed to calculate conversion funnel:', error);
      return {};
    }
  }

  /**
   * Generate cohort analysis for experiment
   */
  async generateCohortAnalysis(
    experimentId: string,
    cohortPeriod: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<Record<string, any>> {
    try {
      const { data: segments, error: segmentError } = await this.supabase
        .from('user_segments')
        .select('user_id, variant_id, assigned_at')
        .eq('experiment_id', experimentId);
      
      if (segmentError) throw segmentError;
      
      const { data: events, error: eventError } = await this.supabase
        .from('experiment_events')
        .select('user_id, variant_id, event_type, timestamp, revenue')
        .eq('experiment_id', experimentId);
      
      if (eventError) throw eventError;
      
      // Group users by cohort (assignment period)
      const cohorts: Record<string, Record<string, any>> = {};
      
      segments?.forEach(segment => {
        const cohortKey = this.getCohortKey(new Date(segment.assigned_at), cohortPeriod);
        
        if (!cohorts[cohortKey]) {
          cohorts[cohortKey] = {};
        }
        
        if (!cohorts[cohortKey][segment.variant_id]) {
          cohorts[cohortKey][segment.variant_id] = {
            users: [],
            total_users: 0,
            conversions: 0,
            revenue: 0
          };
        }
        
        cohorts[cohortKey][segment.variant_id].users.push(segment.user_id);
        cohorts[cohortKey][segment.variant_id].total_users++;
      });
      
      // Add event data to cohorts
      events?.forEach(event => {
        const userSegment = segments?.find(s => s.user_id === event.user_id);
        if (!userSegment) return;
        
        const cohortKey = this.getCohortKey(new Date(userSegment.assigned_at), cohortPeriod);
        const cohortData = cohorts[cohortKey]?.[event.variant_id];
        
        if (cohortData && event.event_type === 'conversion') {
          cohortData.conversions++;
        }
        
        if (cohortData && event.revenue) {
          cohortData.revenue += event.revenue;
        }
      });
      
      // Calculate metrics for each cohort
      Object.keys(cohorts).forEach(cohortKey => {
        Object.keys(cohorts[cohortKey]).forEach(variantId => {
          const cohortData = cohorts[cohortKey][variantId];
          cohortData.conversion_rate = cohortData.total_users > 0 ? 
            (cohortData.conversions / cohortData.total_users) * 100 : 0;
          cohortData.revenue_per_user = cohortData.total_users > 0 ? 
            cohortData.revenue / cohortData.total_users : 0;
        });
      });
      
      return cohorts;
    } catch (error) {
      console.error('Failed to generate cohort analysis:', error);
      return {};
    }
  }

  /**
   * Track custom metrics
   */
  async trackCustomMetric(
    experimentId: string,
    variantId: string,
    metricName: string,
    value: number,
    userId?: string
  ): Promise<void> {
    try {
      const customEvent: ExperimentEvent = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        experiment_id: experimentId,
        variant_id: variantId,
        user_id: userId || 'anonymous',
        session_id: 'custom_metric',
        event_type: EventType.CUSTOM,
        event_name: metricName,
        properties: { value },
        timestamp: new Date()
      };
      
      await this.trackEvent(customEvent);
    } catch (error) {
      console.error('Failed to track custom metric:', error);
      throw error;
    }
  }

  /**
   * Get experiment performance summary
   */
  async getPerformanceSummary(experimentId: string): Promise<{
    overview: any;
    variants: Record<string, any>;
    trends: any;
    alerts: string[];
  }> {
    try {
      const results = await this.getExperimentResults(experimentId);
      const alerts: string[] = [];
      
      // Check for performance alerts
      Object.entries(results.conversion_rates).forEach(([variantId, data]) => {
        const conversionData = data as ConversionResult;
        if (conversionData.conversion_rate < 0.01) {
          alerts.push(`Low conversion rate detected for variant ${variantId}`);
        }
        
        if (conversionData.participants < 100) {
          alerts.push(`Low sample size for variant ${variantId}`);
        }
      });
      
      // Get trend data
      const trends = await this.calculateTrends(experimentId);
      
      return {
        overview: {
          total_participants: results.total_participants,
          is_significant: results.statistical_significance.is_significant,
          confidence_level: results.statistical_significance.confidence_level,
          revenue_impact: results.revenue_impact,
          last_updated: results.last_updated
        },
        variants: results.conversion_rates,
        trends,
        alerts
      };
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      throw error;
    }
  }

  // Private helper methods
  private async processBatch(experimentId: string): Promise<void> {
    const batch = this.batchQueue.get(experimentId);
    if (!batch || batch.length === 0) return;
    
    try {
      // Store events in batch
      const { error } = await this.supabase
        .from('experiment_events')
        .insert(batch);
      
      if (error) throw error;
      
      // Clear batch
      this.batchQueue.set(experimentId, []);
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics(experimentId, batch);
    } catch (error) {
      console.error('Failed to process batch:', error);
    }
  }

  private startBatchProcessor(): void {
    setInterval(() => {
      this.batchQueue.forEach(async (batch, experimentId) => {
        if (batch.length > 0) {
          await this.processBatch(experimentId);
        }
      });
    }, this.batchTimeout);
  }

  private async updateRealTimeMetrics(event: ExperimentEvent): Promise<void> {
    const cacheKey = `realtime_${event.experiment_id}`;
    let metrics = this.cache.get(cacheKey) || {
      conversions: {},
      revenue: {},
      last_updated: new Date()
    };
    
    if (!metrics.conversions[event.variant_id]) {
      metrics.conversions[event.variant_id] = 0;
    }
    
    if (!metrics.revenue[event.variant_id]) {
      metrics.revenue[event.variant_id] = 0;
    }
    
    if (event.event_type === EventType.CONVERSION) {
      metrics.conversions[event.variant_id]++;
    }
    
    if (event.revenue) {
      metrics.revenue[event.variant_id] += event.revenue;
    }
    
    metrics.last_updated = new Date();
    this.cache.set(cacheKey, metrics);
  }

  private async updateParticipantCount(experimentId: string, variantId: string): Promise<void> {
    const cacheKey = `participants_${experimentId}`;
    let counts = this.cache.get(cacheKey) || {};
    
    counts[variantId] = (counts[variantId] || 0) + 1;
    this.cache.set(cacheKey, counts);
  }

  private async updateConversionMetrics(event: ExperimentEvent): Promise<void> {
    const cacheKey = `conversions_${event.experiment_id}`;
    let conversions = this.cache.get(cacheKey) || {};
    
    conversions[event.variant_id] = (conversions[event.variant_id] || 0) + 1;
    this.cache.set(cacheKey, conversions);
  }

  private async updateRevenueMetrics(event: ExperimentEvent): Promise<void> {
    if (!event.revenue) return;
    
    const cacheKey = `revenue_${event.experiment_id}`;
    let revenue = this.cache.get(cacheKey) || {};
    
    revenue[event.variant_id] = (revenue[event.variant_id] || 0) + event.revenue;
    this.cache.set(cacheKey, revenue);
  }

  private async throttledPersist(experimentId: string, results: ExperimentResults): Promise<void> {
    const lastPersist = this.cache.get(`last_persist_${experimentId}`) || 0;
    const now = Date.now();
    
    // Only persist every 30 seconds to avoid database overload
    if (now - lastPersist > 30000) {
      try {
        await this.supabase
          .from('experiment_results')
          .upsert({
            experiment_id: experimentId,
            results,
            last_updated: new Date()
          });
        
        this.cache.set(`last_persist_${experimentId}`, now);
      } catch (error) {
        console.error('Failed to persist results:', error);
      }
    }
  }

  private async updateAggregatedMetrics(experimentId: string, events: ExperimentEvent[]): Promise<void> {
    const aggregated: Record<string, any> = {};
    
    events.forEach(event => {
      if (!aggregated[event.variant_id]) {
        aggregated[event.variant_id] = {
          exposures: 0,
          conversions: 0,
          revenue: 0
        };
      }
      
      if (event.event_type === EventType.EXPOSURE) {
        aggregated[event.variant_id].exposures++;
      } else if (event.event_type === EventType.CONVERSION) {
        aggregated[event.variant_id].conversions++;
      }
      
      if (event.revenue) {
        aggregated[event.variant_id].revenue += event.revenue;
      }
    });
    
    // Update cached results
    const results = await this.getExperimentResults(experimentId);
    
    Object.keys(aggregated).forEach(variantId => {
      const data = aggregated[variantId];
      
      if (!results.conversion_rates[variantId]) {
        results.conversion_rates[variantId] = {
          variant_id: variantId,
          participants: 0,
          conversions: 0,
          conversion_rate: 0,
          revenue: 0,
          average_order_value: 0,
          sessions: 0,
          bounce_rate: 0
        };
      }
      
      const variantData = results.conversion_rates[variantId] as ConversionResult;
      variantData.participants += data.exposures;
      variantData.conversions += data.conversions;
      variantData.revenue += data.revenue;
      variantData.conversion_rate = variantData.participants > 0 ? 
        (variantData.conversions / variantData.participants) * 100 : 0;
      variantData.average_order_value = variantData.conversions > 0 ? 
        variantData.revenue / variantData.conversions : 0;
    });
    
    this.cache.set(`results_${experimentId}`, results);
  }

  private getCohortKey(date: Date, period: 'daily' | 'weekly' | 'monthly'): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    switch (period) {
      case 'daily':
        return `${year}-${month + 1}-${day}`;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(day - date.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      case 'monthly':
        return `${year}-${month + 1}`;
      default:
        return `${year}-${month + 1}-${day}`;
    }
  }

  private async calculateTrends(experimentId: string): Promise<any> {
    try {
      const { data: events, error } = await this.supabase
        .from('experiment_events')
        .select('variant_id, event_type, timestamp')
        .eq('experiment_id', experimentId)
        .order('timestamp');
      
      if (error) throw error;
      
      // Group events by day and variant
      const dailyMetrics: Record<string, Record<string, { exposures: number; conversions: number }>> = {};
      
      events?.forEach(event => {
        const day = event.timestamp.split('T')[0];
        
        if (!dailyMetrics[day]) {
          dailyMetrics[day] = {};
        }
        
        if (!dailyMetrics[day][event.variant_id]) {
          dailyMetrics[day][event.variant_id] = { exposures: 0, conversions: 0 };
        }
        
        if (event.event_type === 'exposure') {
          dailyMetrics[day][event.variant_id].exposures++;
        } else if (event.event_type === 'conversion') {
          dailyMetrics[day][event.variant_id].conversions++;
        }
      });
      
      return dailyMetrics;
    } catch (error) {
      console.error('Failed to calculate trends:', error);
      return {};
    }
  }

  private getDefaultResults(): ExperimentResults {
    return {
      total_participants: 0,
      conversion_rates: {},
      statistical_significance: {
        is_significant: false,
        confidence_level: 0.95,
        p_value: 1.0,
        test_type: 'two_tailed',
        sample_size_reached: false,
        minimum_runtime_met: false
      },
      confidence_intervals: {},
      p_values: {},
      effect_sizes: {},
      recommendations: [],
      lift: {},
      revenue_impact: 0,
      last_updated: new Date()
    };
  }
}