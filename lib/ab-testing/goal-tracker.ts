import { ExperimentEvent, Goal, EventType } from './types';
import { createClient } from '@/lib/supabase/client';

export interface GoalMetrics {
  goalId: string;
  goalName: string;
  variantId: string;
  totalEvents: number;
  uniqueUsers: number;
  conversionRate: number;
  averageValue: number;
  totalValue: number;
  firstConversionTime?: Date;
  lastConversionTime?: Date;
}

export interface ExperimentGoalResults {
  experimentId: string;
  goals: Map<string, Map<string, GoalMetrics>>; // goalId -> variantId -> metrics
  overallMetrics: {
    totalUsers: number;
    totalConversions: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
}

export class GoalTracker {
  private supabase;
  private realtimeMetrics: Map<string, ExperimentGoalResults> = new Map();

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Initialize tracking for an experiment
   */
  async initializeExperiment(experimentId: string): Promise<void> {
    // Create initial tracking structure
    this.realtimeMetrics.set(experimentId, {
      experimentId,
      goals: new Map(),
      overallMetrics: {
        totalUsers: 0,
        totalConversions: 0,
        totalRevenue: 0,
        averageOrderValue: 0
      }
    });

    // Load existing data from database
    await this.loadExistingMetrics(experimentId);
  }

  /**
   * Track a conversion event
   */
  async trackConversion(event: ExperimentEvent): Promise<void> {
    // Validate event
    if (!this.isConversionEvent(event)) {
      throw new Error('Event must be a conversion type');
    }

    // Store event in database
    const { error } = await this.supabase
      .from('experiment_events')
      .insert(event);

    if (error) throw error;

    // Update real-time metrics
    await this.updateRealtimeMetrics(event);

    // Check for goal completion
    await this.checkGoalCompletion(event);
  }

  /**
   * Track a custom goal event
   */
  async trackCustomGoal(
    experimentId: string,
    variantId: string,
    userId: string,
    goalId: string,
    value?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: ExperimentEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      experiment_id: experimentId,
      variant_id: variantId,
      user_id: userId,
      session_id: metadata?.session_id || 'unknown',
      event_type: EventType.GOAL,
      event_name: `goal_${goalId}`,
      value,
      properties: {
        goal_id: goalId,
        ...metadata
      },
      timestamp: new Date()
    };

    await this.trackConversion(event);
  }

  /**
   * Get real-time results for an experiment
   */
  async getResults(experimentId: string): Promise<ExperimentGoalResults> {
    const cached = this.realtimeMetrics.get(experimentId);
    if (cached) {
      return cached;
    }

    // Load from database if not cached
    await this.loadExistingMetrics(experimentId);
    return this.realtimeMetrics.get(experimentId)!;
  }

  /**
   * Get goal metrics for a specific variant
   */
  async getGoalMetrics(
    experimentId: string,
    goalId: string,
    variantId: string
  ): Promise<GoalMetrics | null> {
    const results = await this.getResults(experimentId);
    return results.goals.get(goalId)?.get(variantId) || null;
  }

  /**
   * Update results based on new event
   */
  async updateResults(event: ExperimentEvent): Promise<void> {
    await this.updateRealtimeMetrics(event);
  }

  /**
   * Calculate funnel metrics for multi-step goals
   */
  async calculateFunnelMetrics(
    experimentId: string,
    funnelSteps: string[]
  ): Promise<Map<string, {
    variantId: string;
    stepMetrics: {
      step: string;
      users: number;
      dropoffRate: number;
      conversionRate: number;
    }[];
    overallConversion: number;
  }>> {
    const { data: events, error } = await this.supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId)
      .in('event_name', funnelSteps)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const variantFunnels = new Map<string, Map<string, Set<string>>>();
    
    // Group events by variant and step
    for (const event of events || []) {
      if (!variantFunnels.has(event.variant_id)) {
        variantFunnels.set(event.variant_id, new Map());
      }
      
      const variantData = variantFunnels.get(event.variant_id)!;
      if (!variantData.has(event.event_name)) {
        variantData.set(event.event_name, new Set());
      }
      
      variantData.get(event.event_name)!.add(event.user_id);
    }

    // Calculate funnel metrics for each variant
    const results = new Map();
    
    for (const [variantId, stepData] of variantFunnels) {
      const stepMetrics = [];
      let previousStepUsers = new Set<string>();
      
      for (let i = 0; i < funnelSteps.length; i++) {
        const step = funnelSteps[i];
        const users = stepData.get(step) || new Set();
        
        if (i === 0) {
          previousStepUsers = users;
        }
        
        const dropoffRate = previousStepUsers.size > 0
          ? 1 - (users.size / previousStepUsers.size)
          : 0;
        
        const conversionRate = previousStepUsers.size > 0
          ? users.size / previousStepUsers.size
          : 0;
        
        stepMetrics.push({
          step,
          users: users.size,
          dropoffRate,
          conversionRate
        });
        
        // Only count users who completed previous step
        const completedBoth = new Set([...users].filter(u => previousStepUsers.has(u)));
        previousStepUsers = completedBoth;
      }
      
      const firstStepUsers = stepData.get(funnelSteps[0])?.size || 0;
      const lastStepUsers = stepData.get(funnelSteps[funnelSteps.length - 1])?.size || 0;
      const overallConversion = firstStepUsers > 0 ? lastStepUsers / firstStepUsers : 0;
      
      results.set(variantId, {
        variantId,
        stepMetrics,
        overallConversion
      });
    }

    return results;
  }

  /**
   * Get time-based metrics (conversion over time)
   */
  async getTimeBasedMetrics(
    experimentId: string,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Map<string, {
    timestamp: Date;
    conversions: Map<string, number>;
    revenue: Map<string, number>;
  }[]>> {
    const { data: events, error } = await this.supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId)
      .eq('event_type', EventType.CONVERSION)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const timeSeriesData = new Map<string, Map<string, { conversions: number; revenue: number }>>();
    
    for (const event of events || []) {
      const timeKey = this.getTimeKey(event.timestamp, interval);
      
      if (!timeSeriesData.has(timeKey)) {
        timeSeriesData.set(timeKey, new Map());
      }
      
      const timeData = timeSeriesData.get(timeKey)!;
      if (!timeData.has(event.variant_id)) {
        timeData.set(event.variant_id, { conversions: 0, revenue: 0 });
      }
      
      const variantData = timeData.get(event.variant_id)!;
      variantData.conversions += 1;
      variantData.revenue += event.value || 0;
    }

    // Convert to array format
    const results = [];
    for (const [timeKey, variantData] of timeSeriesData) {
      const conversions = new Map<string, number>();
      const revenue = new Map<string, number>();
      
      for (const [variantId, metrics] of variantData) {
        conversions.set(variantId, metrics.conversions);
        revenue.set(variantId, metrics.revenue);
      }
      
      results.push({
        timestamp: new Date(timeKey),
        conversions,
        revenue
      });
    }

    return new Map([['timeSeries', results]]);
  }

  /**
   * Get cohort analysis data
   */
  async getCohortAnalysis(
    experimentId: string,
    cohortType: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<Map<string, {
    cohortDate: Date;
    variantId: string;
    retention: Map<number, number>; // period -> retention rate
  }[]>> {
    const { data: events, error } = await this.supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Group users by cohort and track their activity
    const cohorts = new Map<string, Map<string, Set<string>>>();
    const userFirstSeen = new Map<string, Date>();
    
    for (const event of events || []) {
      if (!userFirstSeen.has(event.user_id)) {
        userFirstSeen.set(event.user_id, event.timestamp);
      }
      
      const cohortKey = this.getTimeKey(userFirstSeen.get(event.user_id)!, cohortType);
      const periodsSinceFirst = this.getPeriodsSince(
        userFirstSeen.get(event.user_id)!,
        event.timestamp,
        cohortType
      );
      
      const key = `${cohortKey}:${event.variant_id}`;
      if (!cohorts.has(key)) {
        cohorts.set(key, new Map());
      }
      
      const cohortData = cohorts.get(key)!;
      if (!cohortData.has(periodsSinceFirst)) {
        cohortData.set(periodsSinceFirst, new Set());
      }
      
      cohortData.get(periodsSinceFirst)!.add(event.user_id);
    }

    // Calculate retention rates
    const results = [];
    for (const [key, periodData] of cohorts) {
      const [cohortDate, variantId] = key.split(':');
      const baselineUsers = periodData.get(0)?.size || 0;
      const retention = new Map<number, number>();
      
      for (const [period, users] of periodData) {
        const retentionRate = baselineUsers > 0 ? users.size / baselineUsers : 0;
        retention.set(period, retentionRate);
      }
      
      results.push({
        cohortDate: new Date(cohortDate),
        variantId,
        retention
      });
    }

    return new Map([['cohorts', results]]);
  }

  // Private helper methods
  private async loadExistingMetrics(experimentId: string): Promise<void> {
    const { data: events, error } = await this.supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', experimentId);

    if (error) throw error;

    const results: ExperimentGoalResults = {
      experimentId,
      goals: new Map(),
      overallMetrics: {
        totalUsers: 0,
        totalConversions: 0,
        totalRevenue: 0,
        averageOrderValue: 0
      }
    };

    const uniqueUsers = new Set<string>();
    const variantUsers = new Map<string, Set<string>>();
    
    for (const event of events || []) {
      uniqueUsers.add(event.user_id);
      
      if (!variantUsers.has(event.variant_id)) {
        variantUsers.set(event.variant_id, new Set());
      }
      variantUsers.get(event.variant_id)!.add(event.user_id);
      
      if (this.isConversionEvent(event)) {
        const goalId = event.properties?.goal_id || 'primary';
        
        if (!results.goals.has(goalId)) {
          results.goals.set(goalId, new Map());
        }
        
        if (!results.goals.get(goalId)!.has(event.variant_id)) {
          results.goals.get(goalId)!.set(event.variant_id, {
            goalId,
            goalName: event.event_name,
            variantId: event.variant_id,
            totalEvents: 0,
            uniqueUsers: 0,
            conversionRate: 0,
            averageValue: 0,
            totalValue: 0
          });
        }
        
        const metrics = results.goals.get(goalId)!.get(event.variant_id)!;
        metrics.totalEvents += 1;
        metrics.totalValue += event.value || 0;
        
        results.overallMetrics.totalConversions += 1;
        results.overallMetrics.totalRevenue += event.value || 0;
      }
    }

    // Calculate unique users and conversion rates
    for (const [goalId, variantMap] of results.goals) {
      for (const [variantId, metrics] of variantMap) {
        const variantUserCount = variantUsers.get(variantId)?.size || 0;
        metrics.uniqueUsers = variantUserCount;
        metrics.conversionRate = variantUserCount > 0 ? metrics.totalEvents / variantUserCount : 0;
        metrics.averageValue = metrics.totalEvents > 0 ? metrics.totalValue / metrics.totalEvents : 0;
      }
    }

    results.overallMetrics.totalUsers = uniqueUsers.size;
    results.overallMetrics.averageOrderValue = 
      results.overallMetrics.totalConversions > 0
        ? results.overallMetrics.totalRevenue / results.overallMetrics.totalConversions
        : 0;

    this.realtimeMetrics.set(experimentId, results);
  }

  private async updateRealtimeMetrics(event: ExperimentEvent): Promise<void> {
    const results = this.realtimeMetrics.get(event.experiment_id);
    if (!results) return;

    if (this.isConversionEvent(event)) {
      const goalId = event.properties?.goal_id || 'primary';
      
      if (!results.goals.has(goalId)) {
        results.goals.set(goalId, new Map());
      }
      
      if (!results.goals.get(goalId)!.has(event.variant_id)) {
        results.goals.get(goalId)!.set(event.variant_id, {
          goalId,
          goalName: event.event_name,
          variantId: event.variant_id,
          totalEvents: 0,
          uniqueUsers: 0,
          conversionRate: 0,
          averageValue: 0,
          totalValue: 0
        });
      }
      
      const metrics = results.goals.get(goalId)!.get(event.variant_id)!;
      metrics.totalEvents += 1;
      metrics.totalValue += event.value || 0;
      metrics.averageValue = metrics.totalValue / metrics.totalEvents;
      
      if (!metrics.firstConversionTime) {
        metrics.firstConversionTime = event.timestamp;
      }
      metrics.lastConversionTime = event.timestamp;
      
      results.overallMetrics.totalConversions += 1;
      results.overallMetrics.totalRevenue += event.value || 0;
      results.overallMetrics.averageOrderValue = 
        results.overallMetrics.totalRevenue / results.overallMetrics.totalConversions;
    }
  }

  private async checkGoalCompletion(event: ExperimentEvent): Promise<void> {
    // Check if any goals have been completed
    const { data: experiment, error } = await this.supabase
      .from('experiments')
      .select('goals')
      .eq('id', event.experiment_id)
      .single();

    if (error || !experiment) return;

    const goals = experiment.goals as Goal[];
    for (const goal of goals) {
      if (goal.target && event.event_name === goal.target) {
        // Goal completed - could trigger notifications or auto-stop
        console.log(`Goal "${goal.name}" completed for experiment ${event.experiment_id}`);
      }
    }
  }

  private isConversionEvent(event: ExperimentEvent): boolean {
    return event.event_type === EventType.CONVERSION || 
           event.event_type === EventType.GOAL ||
           event.event_type === EventType.REVENUE;
  }

  private getTimeKey(date: Date, interval: string): string {
    const d = new Date(date);
    switch (interval) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
    }
    return d.toISOString();
  }

  private getPeriodsSince(startDate: Date, currentDate: Date, periodType: string): number {
    const diff = currentDate.getTime() - startDate.getTime();
    switch (periodType) {
      case 'daily':
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'weekly':
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
      case 'monthly':
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
      default:
        return 0;
    }
  }
}

export default GoalTracker;