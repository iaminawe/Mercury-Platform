import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('accuracy-tracker');

export interface AccuracyMetric {
  id?: string;
  service: 'advisor' | 'chatbot' | 'email_generator' | 'vector_search';
  operation: string;
  metric_type: 'accuracy' | 'precision' | 'recall' | 'f1_score' | 'confidence' | 'user_satisfaction';
  value: number;
  ground_truth?: any;
  prediction?: any;
  user_feedback?: number; // 1-5 rating
  auto_validation?: boolean;
  validation_method?: string;
  context?: Record<string, any>;
  created_at?: Date;
}

export interface AccuracyTrend {
  date: string;
  accuracy: number;
  confidence: number;
  sample_size: number;
  trend_direction: 'improving' | 'degrading' | 'stable';
}

export interface AccuracyBenchmark {
  service: string;
  operation: string;
  target_accuracy: number;
  current_accuracy: number;
  sample_size: number;
  last_updated: Date;
  status: 'meeting' | 'below' | 'exceeding';
}

export interface ValidationResult {
  is_correct: boolean;
  confidence: number;
  explanation?: string;
  validation_method: 'automatic' | 'manual' | 'user_feedback' | 'ground_truth';
}

export class AccuracyTracker {
  private supabase: any;
  private metricsBuffer: AccuracyMetric[] = [];
  private bufferSize = 50;
  private flushInterval = 30000; // 30 seconds

  // Target accuracy thresholds
  private accuracyTargets = {
    advisor: 0.85,      // 85% accuracy for AI advisor
    chatbot: 0.70,      // 70% auto-resolution rate for chatbot
    email_generator: 0.80, // 80% relevance for email generation
    vector_search: 0.75    // 75% relevance for search results
  };

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.startBufferFlush();
  }

  /**
   * Record accuracy metrics for an AI operation
   */
  async recordAccuracy(metric: Omit<AccuracyMetric, 'id' | 'created_at'>): Promise<void> {
    try {
      const metricWithTimestamp: AccuracyMetric = {
        ...metric,
        created_at: new Date()
      };

      // Add to buffer for batch processing
      this.metricsBuffer.push(metricWithTimestamp);

      // Flush buffer if it's full
      if (this.metricsBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      logger.info('Accuracy metric recorded', {
        service: metric.service,
        operation: metric.operation,
        metricType: metric.metric_type,
        value: metric.value
      });

      // Check for accuracy alerts
      await this.checkAccuracyAlerts(metricWithTimestamp);
    } catch (error) {
      logger.error('Failed to record accuracy metric', error);
    }
  }

  /**
   * Validate AI prediction against ground truth
   */
  async validatePrediction(
    service: AccuracyMetric['service'],
    operation: string,
    prediction: any,
    groundTruth: any,
    validationMethod: string = 'automatic'
  ): Promise<ValidationResult> {
    try {
      let isCorrect = false;
      let confidence = 0;
      let explanation = '';

      // Perform validation based on service type
      switch (service) {
        case 'advisor':
          ({ isCorrect, confidence, explanation } = await this.validateAdvisorPrediction(
            prediction, groundTruth, operation
          ));
          break;
        
        case 'chatbot':
          ({ isCorrect, confidence, explanation } = await this.validateChatbotResponse(
            prediction, groundTruth, operation
          ));
          break;
        
        case 'email_generator':
          ({ isCorrect, confidence, explanation } = await this.validateEmailGeneration(
            prediction, groundTruth, operation
          ));
          break;
        
        case 'vector_search':
          ({ isCorrect, confidence, explanation } = await this.validateSearchResults(
            prediction, groundTruth, operation
          ));
          break;
      }

      // Record the validation result
      await this.recordAccuracy({
        service,
        operation,
        metric_type: 'accuracy',
        value: isCorrect ? 1 : 0,
        ground_truth: groundTruth,
        prediction,
        auto_validation: validationMethod === 'automatic',
        validation_method: validationMethod,
        context: { explanation }
      });

      return {
        is_correct: isCorrect,
        confidence,
        explanation,
        validation_method: validationMethod as any
      };
    } catch (error) {
      logger.error('Failed to validate prediction', error);
      throw error;
    }
  }

  /**
   * Get accuracy trends over time
   */
  async getAccuracyTrends(
    service: string,
    timeframe: '24h' | '7d' | '30d' = '7d',
    operation?: string
  ): Promise<AccuracyTrend[]> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      let query = this.supabase
        .from('accuracy_metrics')
        .select('created_at, value, metric_type')
        .eq('service', service)
        .eq('metric_type', 'accuracy')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (operation) {
        query = query.eq('operation', operation);
      }

      const { data: metrics, error } = await query;
      if (error) throw error;

      // Group by day and calculate trends
      const dailyMetrics = this.groupMetricsByDay(metrics);
      const trends: AccuracyTrend[] = [];
      
      const dates = Object.keys(dailyMetrics).sort();
      
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dayMetrics = dailyMetrics[date];
        
        const accuracy = dayMetrics.accuracy / dayMetrics.count;
        const confidence = dayMetrics.confidence / dayMetrics.count;
        
        let trendDirection: 'improving' | 'degrading' | 'stable' = 'stable';
        
        if (i > 0) {
          const prevAccuracy = trends[i - 1].accuracy;
          if (accuracy > prevAccuracy + 0.05) {
            trendDirection = 'improving';
          } else if (accuracy < prevAccuracy - 0.05) {
            trendDirection = 'degrading';
          }
        }
        
        trends.push({
          date,
          accuracy,
          confidence,
          sample_size: dayMetrics.count,
          trend_direction: trendDirection
        });
      }

      return trends;
    } catch (error) {
      logger.error('Failed to get accuracy trends', error);
      throw error;
    }
  }

  /**
   * Get current accuracy benchmarks
   */
  async getAccuracyBenchmarks(): Promise<AccuracyBenchmark[]> {
    try {
      const services = ['advisor', 'chatbot', 'email_generator', 'vector_search'] as const;
      const benchmarks: AccuracyBenchmark[] = [];

      for (const service of services) {
        // Get recent accuracy metrics (last 7 days)
        const { data: metrics, error } = await this.supabase
          .from('accuracy_metrics')
          .select('operation, value')
          .eq('service', service)
          .eq('metric_type', 'accuracy')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        // Group by operation
        const operationMetrics = metrics.reduce((acc: any, metric: any) => {
          if (!acc[metric.operation]) {
            acc[metric.operation] = [];
          }
          acc[metric.operation].push(metric.value);
          return acc;
        }, {});

        // Calculate benchmarks for each operation
        for (const [operation, values] of Object.entries(operationMetrics)) {
          const accuracyValues = values as number[];
          const currentAccuracy = accuracyValues.reduce((sum: number, val: number) => sum + val, 0) / accuracyValues.length;
          const targetAccuracy = this.accuracyTargets[service];
          
          let status: 'meeting' | 'below' | 'exceeding' = 'meeting';
          if (currentAccuracy < targetAccuracy * 0.95) {
            status = 'below';
          } else if (currentAccuracy > targetAccuracy * 1.05) {
            status = 'exceeding';
          }

          benchmarks.push({
            service,
            operation,
            target_accuracy: targetAccuracy,
            current_accuracy: currentAccuracy,
            sample_size: accuracyValues.length,
            last_updated: new Date(),
            status
          });
        }
      }

      return benchmarks;
    } catch (error) {
      logger.error('Failed to get accuracy benchmarks', error);
      throw error;
    }
  }

  /**
   * Collect user feedback for accuracy validation
   */
  async collectUserFeedback(
    service: AccuracyMetric['service'],
    operation: string,
    prediction: any,
    userRating: number, // 1-5 scale
    feedback?: string
  ): Promise<void> {
    try {
      // Convert user rating to accuracy score (1-2: 0, 3: 0.5, 4-5: 1)
      let accuracyScore = 0;
      if (userRating >= 4) {
        accuracyScore = 1;
      } else if (userRating === 3) {
        accuracyScore = 0.5;
      }

      await this.recordAccuracy({
        service,
        operation,
        metric_type: 'user_satisfaction',
        value: accuracyScore,
        prediction,
        user_feedback: userRating,
        validation_method: 'user_feedback',
        context: { feedback, originalRating: userRating }
      });

      logger.info('User feedback collected', {
        service,
        operation,
        rating: userRating,
        accuracyScore
      });
    } catch (error) {
      logger.error('Failed to collect user feedback', error);
    }
  }

  /**
   * Run automated accuracy tests
   */
  async runAccuracyTests(
    service: AccuracyMetric['service'],
    testSuite: {
      name: string;
      inputs: any[];
      expectedOutputs: any[];
      operation: string;
    }
  ): Promise<{ passed: number; failed: number; accuracy: number; details: any[] }> {
    try {
      const results = [];
      let passed = 0;
      let failed = 0;

      for (let i = 0; i < testSuite.inputs.length; i++) {
        const input = testSuite.inputs[i];
        const expected = testSuite.expectedOutputs[i];

        try {
          // This would call the actual AI service
          // For now, we'll simulate the prediction
          const prediction = await this.simulatePrediction(service, testSuite.operation, input);
          
          const validation = await this.validatePrediction(
            service,
            testSuite.operation,
            prediction,
            expected,
            'automatic'
          );

          if (validation.is_correct) {
            passed++;
          } else {
            failed++;
          }

          results.push({
            input,
            expected,
            prediction,
            correct: validation.is_correct,
            confidence: validation.confidence,
            explanation: validation.explanation
          });
        } catch (error) {
          failed++;
          results.push({
            input,
            expected,
            prediction: null,
            correct: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const accuracy = testSuite.inputs.length > 0 ? passed / testSuite.inputs.length : 0;

      logger.info('Accuracy test completed', {
        service,
        testSuite: testSuite.name,
        passed,
        failed,
        accuracy
      });

      return { passed, failed, accuracy, details: results };
    } catch (error) {
      logger.error('Failed to run accuracy tests', error);
      throw error;
    }
  }

  /**
   * Get accuracy insights and recommendations
   */
  async getAccuracyInsights(service: string): Promise<{
    current_performance: {
      accuracy: number;
      trend: string;
      benchmark_status: string;
    };
    improvement_opportunities: string[];
    recommendations: string[];
  }> {
    try {
      const trends = await this.getAccuracyTrends(service, '30d');
      const benchmarks = await this.getAccuracyBenchmarks();
      
      const serviceBenchmarks = benchmarks.filter(b => b.service === service);
      const currentAccuracy = serviceBenchmarks.length > 0 
        ? serviceBenchmarks.reduce((sum, b) => sum + b.current_accuracy, 0) / serviceBenchmarks.length
        : 0;

      const recentTrend = trends.length > 0 ? trends[trends.length - 1].trend_direction : 'stable';
      const benchmarkStatus = serviceBenchmarks.every(b => b.status === 'meeting') ? 'meeting' :
                              serviceBenchmarks.some(b => b.status === 'below') ? 'below' : 'mixed';

      const improvementOpportunities = [];
      const recommendations = [];

      // Analyze for improvement opportunities
      if (currentAccuracy < this.accuracyTargets[service as keyof typeof this.accuracyTargets]) {
        improvementOpportunities.push('Overall accuracy below target');
        recommendations.push('Review training data quality and model parameters');
      }

      if (recentTrend === 'degrading') {
        improvementOpportunities.push('Accuracy trend is degrading');
        recommendations.push('Investigate recent changes and consider model retraining');
      }

      const lowPerformingOperations = serviceBenchmarks.filter(b => b.status === 'below');
      if (lowPerformingOperations.length > 0) {
        improvementOpportunities.push(`${lowPerformingOperations.length} operations below target`);
        recommendations.push('Focus optimization on underperforming operations');
      }

      return {
        current_performance: {
          accuracy: currentAccuracy,
          trend: recentTrend,
          benchmark_status: benchmarkStatus
        },
        improvement_opportunities: improvementOpportunities,
        recommendations: recommendations
      };
    } catch (error) {
      logger.error('Failed to get accuracy insights', error);
      throw error;
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
        .from('accuracy_metrics')
        .insert(metrics);

      if (error) throw error;

      logger.info(`Flushed ${metrics.length} accuracy metrics to database`);
    } catch (error) {
      logger.error('Failed to flush metrics buffer', error);
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  private getTimeframeDuration(timeframe: string): number {
    const durations = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return durations[timeframe as keyof typeof durations] || durations['7d'];
  }

  private groupMetricsByDay(metrics: any[]): Record<string, { accuracy: number; confidence: number; count: number }> {
    return metrics.reduce((groups, metric) => {
      const date = new Date(metric.created_at).toISOString().split('T')[0];
      
      if (!groups[date]) {
        groups[date] = { accuracy: 0, confidence: 0, count: 0 };
      }
      
      groups[date].accuracy += metric.value;
      groups[date].confidence += metric.confidence || 0;
      groups[date].count += 1;
      
      return groups;
    }, {});
  }

  private async validateAdvisorPrediction(
    prediction: any,
    groundTruth: any,
    operation: string
  ): Promise<{ isCorrect: boolean; confidence: number; explanation: string }> {
    // Advisor validation logic
    if (operation === 'anomaly_detection') {
      const predictionHasAnomaly = prediction?.anomalies?.length > 0;
      const truthHasAnomaly = groundTruth?.hasAnomaly;
      
      return {
        isCorrect: predictionHasAnomaly === truthHasAnomaly,
        confidence: 0.9,
        explanation: `Anomaly detection ${predictionHasAnomaly === truthHasAnomaly ? 'correct' : 'incorrect'}`
      };
    }

    if (operation === 'recommendation_generation') {
      const predictionRecommendations = prediction?.recommendations?.length || 0;
      const expectedRecommendations = groundTruth?.expectedCount || 0;
      
      const accuracy = Math.abs(predictionRecommendations - expectedRecommendations) <= 2;
      
      return {
        isCorrect: accuracy,
        confidence: 0.8,
        explanation: `Generated ${predictionRecommendations} recommendations, expected ${expectedRecommendations}`
      };
    }

    return { isCorrect: true, confidence: 0.5, explanation: 'No validation method implemented' };
  }

  private async validateChatbotResponse(
    prediction: any,
    groundTruth: any,
    operation: string
  ): Promise<{ isCorrect: boolean; confidence: number; explanation: string }> {
    // Chatbot validation logic
    if (operation === 'intent_classification') {
      const predictedIntent = prediction?.intent;
      const expectedIntent = groundTruth?.intent;
      
      return {
        isCorrect: predictedIntent === expectedIntent,
        confidence: prediction?.confidence || 0.5,
        explanation: `Predicted ${predictedIntent}, expected ${expectedIntent}`
      };
    }

    if (operation === 'response_generation') {
      // Check if response addresses the query appropriately
      const responseQuality = prediction?.content?.length > 20 && !prediction?.content?.includes('error');
      
      return {
        isCorrect: responseQuality,
        confidence: 0.7,
        explanation: 'Response quality assessment based on length and error content'
      };
    }

    return { isCorrect: true, confidence: 0.5, explanation: 'No validation method implemented' };
  }

  private async validateEmailGeneration(
    prediction: any,
    groundTruth: any,
    operation: string
  ): Promise<{ isCorrect: boolean; confidence: number; explanation: string }> {
    // Email generation validation logic
    const hasSubject = prediction?.subject?.length > 0;
    const hasContent = prediction?.content?.length > 50;
    const hasPersonalization = prediction?.content?.includes(groundTruth?.customerName);
    
    const qualityScore = (hasSubject ? 1 : 0) + (hasContent ? 1 : 0) + (hasPersonalization ? 1 : 0);
    
    return {
      isCorrect: qualityScore >= 2,
      confidence: qualityScore / 3,
      explanation: `Email quality score: ${qualityScore}/3 (subject: ${hasSubject}, content: ${hasContent}, personalization: ${hasPersonalization})`
    };
  }

  private async validateSearchResults(
    prediction: any,
    groundTruth: any,
    operation: string
  ): Promise<{ isCorrect: boolean; confidence: number; explanation: string }> {
    // Vector search validation logic
    const results = prediction?.results || [];
    const expectedIds = groundTruth?.expectedIds || [];
    
    if (expectedIds.length === 0) {
      return { isCorrect: true, confidence: 0.5, explanation: 'No ground truth provided' };
    }

    const returnedIds = results.map((r: any) => r.metadata?.id).filter(Boolean);
    const intersection = returnedIds.filter((id: string) => expectedIds.includes(id));
    const precision = intersection.length / Math.max(returnedIds.length, 1);
    const recall = intersection.length / expectedIds.length;
    
    const isCorrect = precision >= 0.5 && recall >= 0.3; // Reasonable thresholds
    
    return {
      isCorrect,
      confidence: (precision + recall) / 2,
      explanation: `Precision: ${precision.toFixed(2)}, Recall: ${recall.toFixed(2)}`
    };
  }

  private async simulatePrediction(
    service: AccuracyMetric['service'],
    operation: string,
    input: any
  ): Promise<any> {
    // This would normally call the actual AI service
    // For testing purposes, we'll return a mock prediction
    switch (service) {
      case 'advisor':
        return {
          recommendations: [
            { id: 'rec1', title: 'Test Recommendation 1' },
            { id: 'rec2', title: 'Test Recommendation 2' }
          ]
        };
      
      case 'chatbot':
        return {
          intent: 'product_search',
          confidence: 0.8,
          content: 'I can help you find products. What are you looking for?'
        };
      
      case 'email_generator':
        return {
          subject: 'Welcome to our store!',
          content: `Dear ${input.customerName}, welcome to our store! We're excited to have you.`
        };
      
      case 'vector_search':
        return {
          results: [
            { metadata: { id: 'product1' }, score: 0.9 },
            { metadata: { id: 'product2' }, score: 0.8 }
          ]
        };
      
      default:
        return {};
    }
  }

  private async checkAccuracyAlerts(metric: AccuracyMetric): Promise<void> {
    try {
      const target = this.accuracyTargets[metric.service];
      
      if (metric.metric_type === 'accuracy' && metric.value < target * 0.8) {
        await this.sendAccuracyAlert({
          service: metric.service,
          operation: metric.operation,
          current_accuracy: metric.value,
          target_accuracy: target,
          severity: metric.value < target * 0.6 ? 'critical' : 'warning',
          message: `${metric.service} ${metric.operation} accuracy (${(metric.value * 100).toFixed(1)}%) below target (${(target * 100).toFixed(1)}%)`
        });
      }
    } catch (error) {
      logger.error('Failed to check accuracy alerts', error);
    }
  }

  private async sendAccuracyAlert(alert: {
    service: string;
    operation: string;
    current_accuracy: number;
    target_accuracy: number;
    severity: 'warning' | 'critical';
    message: string;
  }): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('accuracy_alerts')
        .insert({
          service: alert.service,
          operation: alert.operation,
          current_accuracy: alert.current_accuracy,
          target_accuracy: alert.target_accuracy,
          severity: alert.severity,
          message: alert.message,
          created_at: new Date().toISOString()
        });

      logger.warn('Accuracy alert triggered', alert);
    } catch (error) {
      logger.error('Failed to send accuracy alert', error);
    }
  }
}

// Singleton instance
export const accuracyTracker = new AccuracyTracker();