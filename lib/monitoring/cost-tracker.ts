import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('cost-tracker');

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelPricing {
  model: string;
  input_cost_per_token: number;  // Cost per 1K tokens
  output_cost_per_token: number; // Cost per 1K tokens
  embedding_cost_per_token?: number;
}

export interface CostEntry {
  id?: string;
  service: 'advisor' | 'chatbot' | 'email_generator' | 'vector_search';
  operation: string;
  model: string;
  token_usage: TokenUsage;
  cost: number;
  currency: string;
  request_id?: string;
  user_id?: string;
  store_id?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export interface CostSummary {
  total_cost: number;
  total_tokens: number;
  cost_by_service: Record<string, number>;
  cost_by_model: Record<string, number>;
  tokens_by_service: Record<string, number>;
  average_cost_per_request: number;
  period: string;
}

export interface CostAlert {
  type: 'daily' | 'monthly' | 'per_request' | 'service_specific';
  threshold: number;
  current_value: number;
  currency: string;
  triggered_at: Date;
  service?: string;
  message: string;
}

export interface BudgetLimit {
  id?: string;
  name: string;
  service?: string;
  limit_type: 'daily' | 'weekly' | 'monthly';
  amount: number;
  currency: string;
  alert_threshold: number; // Percentage (e.g., 80 for 80%)
  enabled: boolean;
  created_at?: Date;
}

export class CostTracker {
  private supabase: any;
  private modelPricing: Map<string, ModelPricing> = new Map();
  private costBuffer: CostEntry[] = [];
  private bufferSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.initializeModelPricing();
    this.startBufferFlush();
  }

  /**
   * Initialize model pricing data
   */
  private initializeModelPricing(): void {
    // OpenAI pricing as of 2024 (prices per 1K tokens)
    const pricingData: ModelPricing[] = [
      {
        model: 'gpt-4-turbo-preview',
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03
      },
      {
        model: 'gpt-4-1106-preview',
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03
      },
      {
        model: 'gpt-4',
        input_cost_per_token: 0.03,
        output_cost_per_token: 0.06
      },
      {
        model: 'gpt-3.5-turbo',
        input_cost_per_token: 0.0015,
        output_cost_per_token: 0.002
      },
      {
        model: 'gpt-3.5-turbo-1106',
        input_cost_per_token: 0.001,
        output_cost_per_token: 0.002
      },
      {
        model: 'text-embedding-3-small',
        input_cost_per_token: 0.00002,
        output_cost_per_token: 0,
        embedding_cost_per_token: 0.00002
      },
      {
        model: 'text-embedding-3-large',
        input_cost_per_token: 0.00013,
        output_cost_per_token: 0,
        embedding_cost_per_token: 0.00013
      },
      {
        model: 'text-embedding-ada-002',
        input_cost_per_token: 0.0001,
        output_cost_per_token: 0,
        embedding_cost_per_token: 0.0001
      }
    ];

    pricingData.forEach(pricing => {
      this.modelPricing.set(pricing.model, pricing);
    });

    logger.info('Model pricing initialized', {
      models: Array.from(this.modelPricing.keys())
    });
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(model: string, tokenUsage: TokenUsage): number {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      logger.warn(`No pricing data for model: ${model}`);
      return 0;
    }

    let cost = 0;

    // For embedding models
    if (pricing.embedding_cost_per_token) {
      cost = (tokenUsage.total_tokens / 1000) * pricing.embedding_cost_per_token;
    } else {
      // For chat/completion models
      cost = 
        (tokenUsage.prompt_tokens / 1000) * pricing.input_cost_per_token +
        (tokenUsage.completion_tokens / 1000) * pricing.output_cost_per_token;
    }

    return Math.round(cost * 100000) / 100000; // Round to 5 decimal places
  }

  /**
   * Track cost for an AI operation
   */
  async trackCost(costEntry: Omit<CostEntry, 'id' | 'created_at' | 'cost'>): Promise<void> {
    try {
      const cost = this.calculateCost(costEntry.model, costEntry.token_usage);
      
      const fullCostEntry: CostEntry = {
        ...costEntry,
        cost,
        currency: 'USD',
        created_at: new Date()
      };

      // Add to buffer for batch processing
      this.costBuffer.push(fullCostEntry);

      // Flush buffer if it's full
      if (this.costBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      logger.info('Cost tracked', {
        service: costEntry.service,
        operation: costEntry.operation,
        model: costEntry.model,
        cost,
        tokens: costEntry.token_usage.total_tokens
      });

      // Check for real-time alerts
      await this.checkRealtimeAlerts(fullCostEntry);
    } catch (error) {
      logger.error('Failed to track cost', error);
    }
  }

  /**
   * Get cost summary for a time period
   */
  async getCostSummary(
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h',
    filters?: {
      service?: string;
      store_id?: string;
      user_id?: string;
    }
  ): Promise<CostSummary> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      let query = this.supabase
        .from('ai_costs')
        .select('*')
        .gte('created_at', startDate.toISOString());

      // Apply filters
      if (filters?.service) {
        query = query.eq('service', filters.service);
      }
      if (filters?.store_id) {
        query = query.eq('store_id', filters.store_id);
      }
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      const { data: costs, error } = await query;
      if (error) throw error;

      return this.calculateCostSummary(costs, timeframe);
    } catch (error) {
      logger.error('Failed to get cost summary', error);
      throw error;
    }
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(
    timeframe: '7d' | '30d' | '90d' = '30d',
    granularity: 'hour' | 'day' = 'day'
  ): Promise<{ date: string; cost: number; tokens: number; requests: number }[]> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: costs, error } = await this.supabase
        .from('ai_costs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      return this.groupCostsByTime(costs, granularity);
    } catch (error) {
      logger.error('Failed to get cost trends', error);
      throw error;
    }
  }

  /**
   * Get top cost drivers
   */
  async getTopCostDrivers(
    timeframe: '24h' | '7d' | '30d' = '7d',
    limit = 10
  ): Promise<{
    category: 'service' | 'model' | 'operation';
    name: string;
    cost: number;
    percentage: number;
    requests: number;
  }[]> {
    try {
      const summary = await this.getCostSummary(timeframe);
      const totalCost = summary.total_cost;

      const drivers: any[] = [];

      // Add service drivers
      Object.entries(summary.cost_by_service).forEach(([service, cost]) => {
        drivers.push({
          category: 'service',
          name: service,
          cost,
          percentage: (cost / totalCost) * 100,
          requests: 0 // Would need separate query for request counts
        });
      });

      // Add model drivers
      Object.entries(summary.cost_by_model).forEach(([model, cost]) => {
        drivers.push({
          category: 'model',
          name: model,
          cost,
          percentage: (cost / totalCost) * 100,
          requests: 0
        });
      });

      return drivers
        .sort((a, b) => b.cost - a.cost)
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to get top cost drivers', error);
      throw error;
    }
  }

  /**
   * Set up budget limits and alerts
   */
  async setBudgetLimit(budgetLimit: Omit<BudgetLimit, 'id' | 'created_at'>): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('budget_limits')
        .insert({
          ...budgetLimit,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info('Budget limit set', budgetLimit);
      return data.id;
    } catch (error) {
      logger.error('Failed to set budget limit', error);
      throw error;
    }
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<{
    budget: BudgetLimit;
    current_spend: number;
    percentage_used: number;
    remaining_budget: number;
    status: 'safe' | 'warning' | 'critical' | 'exceeded';
  }[]> {
    try {
      const { data: budgets, error } = await this.supabase
        .from('budget_limits')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      const budgetStatuses = [];

      for (const budget of budgets) {
        const currentSpend = await this.getCurrentSpendForBudget(budget);
        const percentageUsed = (currentSpend / budget.amount) * 100;
        const remainingBudget = budget.amount - currentSpend;

        let status: 'safe' | 'warning' | 'critical' | 'exceeded';
        if (percentageUsed >= 100) {
          status = 'exceeded';
        } else if (percentageUsed >= 95) {
          status = 'critical';
        } else if (percentageUsed >= budget.alert_threshold) {
          status = 'warning';
        } else {
          status = 'safe';
        }

        budgetStatuses.push({
          budget,
          current_spend: currentSpend,
          percentage_used: percentageUsed,
          remaining_budget: remainingBudget,
          status
        });
      }

      return budgetStatuses;
    } catch (error) {
      logger.error('Failed to get budget status', error);
      throw error;
    }
  }

  /**
   * Optimize costs by analyzing usage patterns
   */
  async getCostOptimizationSuggestions(): Promise<{
    type: 'model_optimization' | 'usage_optimization' | 'batching_opportunity';
    description: string;
    potential_savings: number;
    implementation_effort: 'low' | 'medium' | 'high';
  }[]> {
    try {
      const suggestions = [];
      const costSummary = await this.getCostSummary('30d');

      // Analyze model usage for optimization opportunities
      const modelAnalysis = await this.analyzeModelUsage();
      
      // Check for expensive model usage that could be optimized
      for (const [model, usage] of Object.entries(modelAnalysis)) {
        if (model.includes('gpt-4') && usage.cost > 100) {
          const gpt35Savings = usage.cost * 0.8; // Estimate 80% savings
          suggestions.push({
            type: 'model_optimization',
            description: `Consider using GPT-3.5-Turbo for ${usage.requests} ${model} requests where high accuracy isn't critical`,
            potential_savings: gpt35Savings,
            implementation_effort: 'low'
          });
        }
      }

      // Check for batching opportunities
      const batchingOpportunities = await this.analyzeBatchingOpportunities();
      if (batchingOpportunities.embedding_requests > 100) {
        suggestions.push({
          type: 'batching_opportunity',
          description: `Batch ${batchingOpportunities.embedding_requests} embedding requests to reduce API overhead`,
          potential_savings: batchingOpportunities.potential_savings,
          implementation_effort: 'medium'
        });
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to get cost optimization suggestions', error);
      throw error;
    }
  }

  /**
   * Export cost data for analysis
   */
  async exportCostData(
    timeframe: '7d' | '30d' | '90d' = '30d',
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    try {
      const costSummary = await this.getCostSummary(timeframe);
      const costTrends = await this.getCostTrends(timeframe);
      const topDrivers = await this.getTopCostDrivers(timeframe);

      const exportData = {
        summary: costSummary,
        trends: costTrends,
        top_drivers: topDrivers,
        export_date: new Date().toISOString(),
        timeframe
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else {
        // Convert to CSV format
        return this.convertToCsv(exportData);
      }
    } catch (error) {
      logger.error('Failed to export cost data', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private startBufferFlush(): void {
    setInterval(async () => {
      if (this.costBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.flushInterval);
  }

  private async flushBuffer(): Promise<void> {
    if (this.costBuffer.length === 0) return;

    try {
      const costs = [...this.costBuffer];
      this.costBuffer = [];

      const { error } = await this.supabase
        .from('ai_costs')
        .insert(costs);

      if (error) throw error;

      logger.info(`Flushed ${costs.length} cost entries to database`);
    } catch (error) {
      logger.error('Failed to flush cost buffer', error);
      // Re-add costs to buffer for retry
      this.costBuffer.unshift(...this.costBuffer);
    }
  }

  private getTimeframeDuration(timeframe: string): number {
    const durations = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };
    return durations[timeframe as keyof typeof durations] || durations['24h'];
  }

  private calculateCostSummary(costs: CostEntry[], period: string): CostSummary {
    const totalCost = costs.reduce((sum, cost) => sum + cost.cost, 0);
    const totalTokens = costs.reduce((sum, cost) => sum + cost.token_usage.total_tokens, 0);

    const costByService = costs.reduce((acc, cost) => {
      acc[cost.service] = (acc[cost.service] || 0) + cost.cost;
      return acc;
    }, {} as Record<string, number>);

    const costByModel = costs.reduce((acc, cost) => {
      acc[cost.model] = (acc[cost.model] || 0) + cost.cost;
      return acc;
    }, {} as Record<string, number>);

    const tokensByService = costs.reduce((acc, cost) => {
      acc[cost.service] = (acc[cost.service] || 0) + cost.token_usage.total_tokens;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_cost: Math.round(totalCost * 100) / 100,
      total_tokens: totalTokens,
      cost_by_service: costByService,
      cost_by_model: costByModel,
      tokens_by_service: tokensByService,
      average_cost_per_request: costs.length > 0 ? totalCost / costs.length : 0,
      period
    };
  }

  private groupCostsByTime(
    costs: CostEntry[],
    granularity: 'hour' | 'day'
  ): { date: string; cost: number; tokens: number; requests: number }[] {
    const groups: Record<string, { cost: number; tokens: number; requests: number }> = {};

    costs.forEach(cost => {
      let dateKey: string;
      const date = new Date(cost.created_at!);
      
      if (granularity === 'hour') {
        dateKey = date.toISOString().substring(0, 13) + ':00:00Z'; // Hour precision
      } else {
        dateKey = date.toISOString().split('T')[0]; // Day precision
      }

      if (!groups[dateKey]) {
        groups[dateKey] = { cost: 0, tokens: 0, requests: 0 };
      }

      groups[dateKey].cost += cost.cost;
      groups[dateKey].tokens += cost.token_usage.total_tokens;
      groups[dateKey].requests += 1;
    });

    return Object.entries(groups)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getCurrentSpendForBudget(budget: BudgetLimit): Promise<number> {
    const timeframeDuration = this.getTimeframeDuration(
      budget.limit_type === 'daily' ? '24h' :
      budget.limit_type === 'weekly' ? '7d' : '30d'
    );
    
    const startDate = new Date(Date.now() - timeframeDuration);

    let query = this.supabase
      .from('ai_costs')
      .select('cost')
      .gte('created_at', startDate.toISOString());

    if (budget.service) {
      query = query.eq('service', budget.service);
    }

    const { data: costs, error } = await query;
    if (error) throw error;

    return costs.reduce((sum: number, cost: any) => sum + cost.cost, 0);
  }

  private async checkRealtimeAlerts(costEntry: CostEntry): Promise<void> {
    try {
      // Check for high-cost single requests
      if (costEntry.cost > 1.0) { // $1 per request threshold
        await this.sendCostAlert({
          type: 'per_request',
          threshold: 1.0,
          current_value: costEntry.cost,
          currency: 'USD',
          triggered_at: new Date(),
          service: costEntry.service,
          message: `High-cost request: $${costEntry.cost.toFixed(4)} for ${costEntry.service} ${costEntry.operation}`
        });
      }

      // Check budget limits
      const budgetStatuses = await this.getBudgetStatus();
      for (const status of budgetStatuses) {
        if (status.status === 'critical' || status.status === 'exceeded') {
          await this.sendCostAlert({
            type: status.budget.limit_type,
            threshold: status.budget.amount,
            current_value: status.current_spend,
            currency: status.budget.currency,
            triggered_at: new Date(),
            service: status.budget.service,
            message: `Budget ${status.status}: ${status.percentage_used.toFixed(1)}% of ${status.budget.name} budget used`
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check realtime alerts', error);
    }
  }

  private async sendCostAlert(alert: CostAlert): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('cost_alerts')
        .insert({
          alert_type: alert.type,
          threshold: alert.threshold,
          current_value: alert.current_value,
          currency: alert.currency,
          service: alert.service,
          message: alert.message,
          created_at: alert.triggered_at.toISOString()
        });

      logger.warn('Cost alert triggered', alert);
      
      // Could integrate with external alerting systems here
    } catch (error) {
      logger.error('Failed to send cost alert', error);
    }
  }

  private async analyzeModelUsage(): Promise<Record<string, { cost: number; requests: number; tokens: number }>> {
    const { data: costs, error } = await this.supabase
      .from('ai_costs')
      .select('model, cost, token_usage')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    return costs.reduce((acc: any, cost: any) => {
      if (!acc[cost.model]) {
        acc[cost.model] = { cost: 0, requests: 0, tokens: 0 };
      }
      acc[cost.model].cost += cost.cost;
      acc[cost.model].requests += 1;
      acc[cost.model].tokens += cost.token_usage.total_tokens;
      return acc;
    }, {});
  }

  private async analyzeBatchingOpportunities(): Promise<{ embedding_requests: number; potential_savings: number }> {
    // Analyze single embedding requests that could be batched
    const { data: embeddingCosts, error } = await this.supabase
      .from('ai_costs')
      .select('*')
      .like('model', '%embedding%')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const singleRequests = embeddingCosts.filter(
      (cost: any) => cost.token_usage.total_tokens < 1000 // Small requests that could be batched
    );

    const potentialSavings = singleRequests.length * 0.001; // Estimate $0.001 savings per request

    return {
      embedding_requests: singleRequests.length,
      potential_savings: potentialSavings
    };
  }

  private convertToCsv(data: any): string {
    // Simple CSV conversion for trends data
    const trends = data.trends;
    const header = 'Date,Cost,Tokens,Requests\n';
    const rows = trends.map((trend: any) => 
      `${trend.date},${trend.cost},${trend.tokens},${trend.requests}`
    ).join('\n');
    
    return header + rows;
  }
}

// Singleton instance
export const costTracker = new CostTracker();