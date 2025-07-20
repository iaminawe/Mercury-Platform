import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ai-metrics');

export interface AIMetricsData {
  id?: string;
  service: 'advisor' | 'chatbot' | 'email_generator' | 'vector_search';
  operation: string;
  start_time: Date;
  end_time: Date;
  response_time: number;
  success: boolean;
  error_message?: string;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost?: {
    amount: number;
    currency: string;
  };
  accuracy_score?: number;
  confidence_score?: number;
  user_satisfaction?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export interface AIPerformanceMetrics {
  service: string;
  timeframe: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  total_tokens: number;
  total_cost: number;
  average_accuracy: number;
  average_confidence: number;
  error_rate: number;
  uptime_percentage: number;
}

export interface AIHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: Date;
  response_time: number;
  error_count: number;
  uptime: number;
  issues: string[];
}

export class AIMetricsCollector {
  private supabase: any;
  private metricsBuffer: AIMetricsData[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.startBufferFlush();
  }

  /**
   * Record AI operation metrics
   */
  async recordMetrics(metrics: Omit<AIMetricsData, 'id' | 'created_at'>): Promise<void> {
    try {
      const metricsWithTimestamp: AIMetricsData = {
        ...metrics,
        created_at: new Date()
      };

      // Add to buffer for batch processing
      this.metricsBuffer.push(metricsWithTimestamp);

      // Flush buffer if it's full
      if (this.metricsBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      logger.info('AI metrics recorded', {
        service: metrics.service,
        operation: metrics.operation,
        responseTime: metrics.response_time,
        success: metrics.success
      });
    } catch (error) {
      logger.error('Failed to record AI metrics', error);
    }
  }

  /**
   * Start an AI operation timer
   */
  startTimer(service: AIMetricsData['service'], operation: string): AIOperationTimer {
    return new AIOperationTimer(service, operation, this);
  }

  /**
   * Get performance metrics for a service
   */
  async getPerformanceMetrics(
    service: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<AIPerformanceMetrics> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: metrics, error } = await this.supabase
        .from('ai_metrics')
        .select('*')
        .eq('service', service)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      return this.calculatePerformanceMetrics(metrics, service, timeframe);
    } catch (error) {
      logger.error('Failed to get performance metrics', error);
      throw error;
    }
  }

  /**
   * Get health status for all AI services
   */
  async getHealthStatus(): Promise<AIHealthStatus[]> {
    try {
      const services = ['advisor', 'chatbot', 'email_generator', 'vector_search'];
      const healthStatuses: AIHealthStatus[] = [];

      for (const service of services) {
        const status = await this.getServiceHealthStatus(service);
        healthStatuses.push(status);
      }

      return healthStatuses;
    } catch (error) {
      logger.error('Failed to get health status', error);
      throw error;
    }
  }

  /**
   * Get accuracy trends for a service
   */
  async getAccuracyTrends(
    service: string,
    timeframe: '24h' | '7d' | '30d' = '7d'
  ): Promise<{ date: string; accuracy: number; confidence: number }[]> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: metrics, error } = await this.supabase
        .from('ai_metrics')
        .select('created_at, accuracy_score, confidence_score')
        .eq('service', service)
        .gte('created_at', startDate.toISOString())
        .not('accuracy_score', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day and calculate averages
      const groupedData = this.groupMetricsByDay(metrics);
      return Object.entries(groupedData).map(([date, values]) => ({
        date,
        accuracy: values.accuracy / values.count,
        confidence: values.confidence / values.count
      }));
    } catch (error) {
      logger.error('Failed to get accuracy trends', error);
      throw error;
    }
  }

  /**
   * Get cost breakdown by service
   */
  async getCostBreakdown(timeframe: '24h' | '7d' | '30d' = '30d'): Promise<{
    service: string;
    total_cost: number;
    total_tokens: number;
    avg_cost_per_request: number;
  }[]> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: metrics, error } = await this.supabase
        .from('ai_metrics')
        .select('service, cost, token_usage')
        .gte('created_at', startDate.toISOString())
        .not('cost', 'is', null);

      if (error) throw error;

      // Group by service and calculate totals
      const costBreakdown = metrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.service]) {
          acc[metric.service] = {
            service: metric.service,
            total_cost: 0,
            total_tokens: 0,
            request_count: 0
          };
        }

        acc[metric.service].total_cost += metric.cost?.amount || 0;
        acc[metric.service].total_tokens += metric.token_usage?.total_tokens || 0;
        acc[metric.service].request_count += 1;

        return acc;
      }, {});

      return Object.values(costBreakdown).map((breakdown: any) => ({
        ...breakdown,
        avg_cost_per_request: breakdown.total_cost / breakdown.request_count
      }));
    } catch (error) {
      logger.error('Failed to get cost breakdown', error);
      throw error;
    }
  }

  /**
   * Get error patterns and analysis
   */
  async getErrorAnalysis(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<{
    error_type: string;
    count: number;
    services: string[];
    sample_messages: string[];
  }[]> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: errors, error } = await this.supabase
        .from('ai_metrics')
        .select('service, error_message, metadata')
        .eq('success', false)
        .gte('created_at', startDate.toISOString())
        .not('error_message', 'is', null);

      if (error) throw error;

      // Analyze and group errors
      const errorPatterns = this.analyzeErrorPatterns(errors);
      return errorPatterns;
    } catch (error) {
      logger.error('Failed to get error analysis', error);
      throw error;
    }
  }

  /**
   * Set up real-time alerts for critical metrics
   */
  async setupAlerts(): Promise<void> {
    try {
      // Monitor for high error rates
      setInterval(async () => {
        await this.checkErrorRateAlerts();
      }, 60000); // Every minute

      // Monitor for performance degradation
      setInterval(async () => {
        await this.checkPerformanceAlerts();
      }, 300000); // Every 5 minutes

      // Monitor for cost overruns
      setInterval(async () => {
        await this.checkCostAlerts();
      }, 3600000); // Every hour

      logger.info('AI metrics alerts set up successfully');
    } catch (error) {
      logger.error('Failed to setup alerts', error);
    }
  }

  /**
   * Private helper methods
   */
  private startBufferFlush(): void {
    setInterval(async () => {
      if (this.metricsBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.flushInterval);
  }

  private async flushBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      const { error } = await this.supabase
        .from('ai_metrics')
        .insert(metrics);

      if (error) throw error;

      logger.info(`Flushed ${metrics.length} AI metrics to database`);
    } catch (error) {
      logger.error('Failed to flush metrics buffer', error);
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  private getTimeframeDuration(timeframe: string): number {
    const durations = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return durations[timeframe as keyof typeof durations] || durations['24h'];
  }

  private calculatePerformanceMetrics(
    metrics: AIMetricsData[],
    service: string,
    timeframe: string
  ): AIPerformanceMetrics {
    const successfulMetrics = metrics.filter(m => m.success);
    const failedMetrics = metrics.filter(m => !m.success);
    
    const responseTimes = successfulMetrics.map(m => m.response_time).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const totalTokens = metrics.reduce((sum, m) => sum + (m.token_usage?.total_tokens || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost?.amount || 0), 0);
    
    const accuracyScores = metrics.filter(m => m.accuracy_score !== undefined).map(m => m.accuracy_score!);
    const confidenceScores = metrics.filter(m => m.confidence_score !== undefined).map(m => m.confidence_score!);

    return {
      service,
      timeframe,
      total_requests: metrics.length,
      successful_requests: successfulMetrics.length,
      failed_requests: failedMetrics.length,
      average_response_time: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      p95_response_time: responseTimes[p95Index] || 0,
      p99_response_time: responseTimes[p99Index] || 0,
      total_tokens: totalTokens,
      total_cost: totalCost,
      average_accuracy: accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length || 0,
      average_confidence: confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length || 0,
      error_rate: metrics.length > 0 ? failedMetrics.length / metrics.length : 0,
      uptime_percentage: metrics.length > 0 ? successfulMetrics.length / metrics.length * 100 : 100
    };
  }

  private async getServiceHealthStatus(service: string): Promise<AIHealthStatus> {
    try {
      // Get recent metrics (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const { data: recentMetrics, error } = await this.supabase
        .from('ai_metrics')
        .select('*')
        .eq('service', service)
        .gte('created_at', oneHourAgo.toISOString());

      if (error) throw error;

      const successfulRequests = recentMetrics.filter(m => m.success);
      const failedRequests = recentMetrics.filter(m => !m.success);
      
      const errorRate = recentMetrics.length > 0 ? failedRequests.length / recentMetrics.length : 0;
      const averageResponseTime = successfulRequests.reduce((sum, m) => sum + m.response_time, 0) / successfulRequests.length || 0;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];

      // Determine health status
      if (errorRate > 0.1) {
        status = 'unhealthy';
        issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
      } else if (errorRate > 0.05) {
        status = 'degraded';
        issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
      }

      if (averageResponseTime > 5000) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`Slow response time: ${averageResponseTime.toFixed(0)}ms`);
      }

      if (recentMetrics.length === 0) {
        status = 'unhealthy';
        issues.push('No recent activity');
      }

      return {
        service,
        status,
        last_check: new Date(),
        response_time: averageResponseTime,
        error_count: failedRequests.length,
        uptime: successfulRequests.length / Math.max(recentMetrics.length, 1) * 100,
        issues
      };
    } catch (error) {
      logger.error(`Failed to get health status for ${service}`, error);
      return {
        service,
        status: 'unhealthy',
        last_check: new Date(),
        response_time: 0,
        error_count: 0,
        uptime: 0,
        issues: ['Failed to check health status']
      };
    }
  }

  private groupMetricsByDay(metrics: any[]): Record<string, { accuracy: number; confidence: number; count: number }> {
    return metrics.reduce((groups, metric) => {
      const date = new Date(metric.created_at).toISOString().split('T')[0];
      
      if (!groups[date]) {
        groups[date] = { accuracy: 0, confidence: 0, count: 0 };
      }
      
      groups[date].accuracy += metric.accuracy_score || 0;
      groups[date].confidence += metric.confidence_score || 0;
      groups[date].count += 1;
      
      return groups;
    }, {});
  }

  private analyzeErrorPatterns(errors: any[]): any[] {
    const patterns: Record<string, { count: number; services: Set<string>; messages: string[] }> = {};

    errors.forEach(error => {
      const errorType = this.categorizeError(error.error_message);
      
      if (!patterns[errorType]) {
        patterns[errorType] = {
          count: 0,
          services: new Set(),
          messages: []
        };
      }
      
      patterns[errorType].count += 1;
      patterns[errorType].services.add(error.service);
      
      if (patterns[errorType].messages.length < 5) {
        patterns[errorType].messages.push(error.error_message);
      }
    });

    return Object.entries(patterns).map(([errorType, data]) => ({
      error_type: errorType,
      count: data.count,
      services: Array.from(data.services),
      sample_messages: data.messages
    }));
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'Rate Limit';
    } else if (message.includes('timeout') || message.includes('timed out')) {
      return 'Timeout';
    } else if (message.includes('unauthorized') || message.includes('api key')) {
      return 'Authentication';
    } else if (message.includes('invalid') || message.includes('bad request')) {
      return 'Invalid Request';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'Network Error';
    } else if (message.includes('model') || message.includes('embedding')) {
      return 'Model Error';
    } else {
      return 'Unknown Error';
    }
  }

  private async checkErrorRateAlerts(): Promise<void> {
    try {
      const services = ['advisor', 'chatbot', 'email_generator', 'vector_search'];
      
      for (const service of services) {
        const metrics = await this.getPerformanceMetrics(service, '1h');
        
        if (metrics.error_rate > 0.1) { // 10% error rate threshold
          await this.sendAlert({
            type: 'error_rate',
            service,
            severity: 'critical',
            message: `${service} has error rate of ${(metrics.error_rate * 100).toFixed(2)}%`,
            data: metrics
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check error rate alerts', error);
    }
  }

  private async checkPerformanceAlerts(): Promise<void> {
    try {
      const services = ['advisor', 'chatbot', 'email_generator', 'vector_search'];
      const thresholds = {
        advisor: 10000, // 10 seconds
        chatbot: 5000,  // 5 seconds
        email_generator: 3000, // 3 seconds
        vector_search: 2000    // 2 seconds
      };

      for (const service of services) {
        const metrics = await this.getPerformanceMetrics(service, '1h');
        const threshold = thresholds[service as keyof typeof thresholds];
        
        if (metrics.p95_response_time > threshold) {
          await this.sendAlert({
            type: 'performance',
            service,
            severity: 'warning',
            message: `${service} P95 response time is ${metrics.p95_response_time.toFixed(0)}ms (threshold: ${threshold}ms)`,
            data: metrics
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check performance alerts', error);
    }
  }

  private async checkCostAlerts(): Promise<void> {
    try {
      const costBreakdown = await this.getCostBreakdown('24h');
      const totalDailyCost = costBreakdown.reduce((sum, service) => sum + service.total_cost, 0);
      
      const monthlyProjection = totalDailyCost * 30;
      const costThreshold = 1000; // $1000 monthly threshold
      
      if (monthlyProjection > costThreshold) {
        await this.sendAlert({
          type: 'cost',
          service: 'all',
          severity: 'warning',
          message: `Monthly AI cost projection: $${monthlyProjection.toFixed(2)} (threshold: $${costThreshold})`,
          data: { totalDailyCost, monthlyProjection, costBreakdown }
        });
      }
    } catch (error) {
      logger.error('Failed to check cost alerts', error);
    }
  }

  private async sendAlert(alert: {
    type: string;
    service: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    data: any;
  }): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('ai_alerts')
        .insert({
          alert_type: alert.type,
          service: alert.service,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          created_at: new Date().toISOString()
        });

      logger.warn('AI Alert triggered', alert);
      
      // Could integrate with external alerting systems here
      // (Slack, PagerDuty, email, etc.)
    } catch (error) {
      logger.error('Failed to send alert', error);
    }
  }
}

/**
 * Timer class for measuring AI operations
 */
export class AIOperationTimer {
  private startTime: Date;
  private service: AIMetricsData['service'];
  private operation: string;
  private metricsCollector: AIMetricsCollector;
  private metadata: Record<string, any> = {};

  constructor(
    service: AIMetricsData['service'],
    operation: string,
    metricsCollector: AIMetricsCollector
  ) {
    this.service = service;
    this.operation = operation;
    this.metricsCollector = metricsCollector;
    this.startTime = new Date();
  }

  /**
   * Add metadata to the operation
   */
  addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * End the timer and record metrics
   */
  async end(
    success: boolean,
    options: {
      error?: string;
      tokenUsage?: AIMetricsData['token_usage'];
      cost?: AIMetricsData['cost'];
      accuracyScore?: number;
      confidenceScore?: number;
      userSatisfaction?: number;
    } = {}
  ): Promise<void> {
    const endTime = new Date();
    const responseTime = endTime.getTime() - this.startTime.getTime();

    await this.metricsCollector.recordMetrics({
      service: this.service,
      operation: this.operation,
      start_time: this.startTime,
      end_time: endTime,
      response_time: responseTime,
      success,
      error_message: options.error,
      token_usage: options.tokenUsage,
      cost: options.cost,
      accuracy_score: options.accuracyScore,
      confidence_score: options.confidenceScore,
      user_satisfaction: options.userSatisfaction,
      metadata: this.metadata
    });
  }
}

// Singleton instance
export const aiMetricsCollector = new AIMetricsCollector();