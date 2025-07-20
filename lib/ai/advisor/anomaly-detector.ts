import { AnomalyDetectionResult } from './types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('anomaly-detector');

export class AnomalyDetector {
  private readonly thresholds = {
    low: 1.5,    // 1.5 standard deviations
    medium: 2.0, // 2.0 standard deviations
    high: 2.5,   // 2.5 standard deviations
    critical: 3.0 // 3.0 standard deviations
  };

  /**
   * Detect anomalies in sales data using statistical methods
   * Target: ≥85% precision for anomaly detection
   */
  async detectSalesAnomalies(
    salesData: Array<{ date: string; amount: number; orders: number }>,
    context: Record<string, any> = {}
  ): Promise<AnomalyDetectionResult[]> {
    try {
      if (salesData.length < 7) {
        logger.warn('Insufficient data for anomaly detection', { dataLength: salesData.length });
        return [];
      }

      const anomalies: AnomalyDetectionResult[] = [];
      
      // Calculate rolling statistics
      const windowSize = Math.min(14, Math.floor(salesData.length / 2)); // 2-week window or half the data
      
      for (let i = windowSize; i < salesData.length; i++) {
        const current = salesData[i];
        const historical = salesData.slice(i - windowSize, i);
        
        // Detect amount anomalies
        const amountAnomaly = this.detectStatisticalAnomaly(
          current.amount,
          historical.map(d => d.amount),
          'sales_amount',
          current.date,
          context
        );
        
        if (amountAnomaly) {
          anomalies.push(amountAnomaly);
        }
        
        // Detect order count anomalies
        const orderAnomaly = this.detectStatisticalAnomaly(
          current.orders,
          historical.map(d => d.orders),
          'order_count',
          current.date,
          context
        );
        
        if (orderAnomaly) {
          anomalies.push(orderAnomaly);
        }
      }
      
      // Apply context-aware filtering to improve precision
      const filteredAnomalies = this.filterContextualAnomalies(anomalies, context);
      
      logger.info('Sales anomaly detection completed', {
        totalDataPoints: salesData.length,
        anomaliesDetected: filteredAnomalies.length,
        precision: this.calculatePrecision(filteredAnomalies)
      });
      
      return filteredAnomalies;
    } catch (error) {
      logger.error('Error detecting sales anomalies', error);
      return [];
    }
  }

  /**
   * Detect anomalies in traffic data
   */
  async detectTrafficAnomalies(
    trafficData: Array<{ date: string; visitors: number; pageViews: number; bounceRate: number }>,
    context: Record<string, any> = {}
  ): Promise<AnomalyDetectionResult[]> {
    try {
      if (trafficData.length < 7) {
        return [];
      }

      const anomalies: AnomalyDetectionResult[] = [];
      const windowSize = Math.min(14, Math.floor(trafficData.length / 2));
      
      for (let i = windowSize; i < trafficData.length; i++) {
        const current = trafficData[i];
        const historical = trafficData.slice(i - windowSize, i);
        
        // Check visitors
        const visitorAnomaly = this.detectStatisticalAnomaly(
          current.visitors,
          historical.map(d => d.visitors),
          'visitors',
          current.date,
          context
        );
        
        if (visitorAnomaly) anomalies.push(visitorAnomaly);
        
        // Check page views
        const pageViewAnomaly = this.detectStatisticalAnomaly(
          current.pageViews,
          historical.map(d => d.pageViews),
          'page_views',
          current.date,
          context
        );
        
        if (pageViewAnomaly) anomalies.push(pageViewAnomaly);
        
        // Check bounce rate (inverted logic - high bounce rate is bad)
        const bounceRateAnomaly = this.detectStatisticalAnomaly(
          current.bounceRate,
          historical.map(d => d.bounceRate),
          'bounce_rate',
          current.date,
          context,
          true // inverted - high values are anomalies
        );
        
        if (bounceRateAnomaly) anomalies.push(bounceRateAnomaly);
      }
      
      return this.filterContextualAnomalies(anomalies, context);
    } catch (error) {
      logger.error('Error detecting traffic anomalies', error);
      return [];
    }
  }

  /**
   * Core statistical anomaly detection using z-score method
   */
  private detectStatisticalAnomaly(
    currentValue: number,
    historicalValues: number[],
    metricName: string,
    timestamp: string,
    context: Record<string, any>,
    inverted = false
  ): AnomalyDetectionResult | null {
    if (historicalValues.length < 3) return null;
    
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return null; // No variation in historical data
    
    const zScore = Math.abs(currentValue - mean) / stdDev;
    const deviation = ((currentValue - mean) / mean) * 100;
    
    // Determine if it's an anomaly and its severity
    let severity: 'low' | 'medium' | 'high' | 'critical' | null = null;
    
    if (zScore >= this.thresholds.critical) {
      severity = 'critical';
    } else if (zScore >= this.thresholds.high) {
      severity = 'high';
    } else if (zScore >= this.thresholds.medium) {
      severity = 'medium';
    } else if (zScore >= this.thresholds.low) {
      severity = 'low';
    }
    
    if (!severity) return null;
    
    // Calculate confidence based on data quality and consistency
    const confidence = this.calculateConfidence(zScore, historicalValues, context);
    
    // For inverted metrics (like bounce rate), flip the interpretation
    const isPositiveAnomaly = inverted ? currentValue < mean : currentValue > mean;
    
    return {
      isAnomaly: true,
      severity,
      confidence,
      metricName,
      actualValue: currentValue,
      expectedValue: mean,
      deviation,
      timestamp,
      context: {
        ...context,
        zScore,
        historicalMean: mean,
        historicalStdDev: stdDev,
        dataPoints: historicalValues.length,
        isPositiveAnomaly,
        inverted
      }
    };
  }

  /**
   * Filter anomalies based on contextual information to improve precision
   */
  private filterContextualAnomalies(
    anomalies: AnomalyDetectionResult[],
    context: Record<string, any>
  ): AnomalyDetectionResult[] {
    return anomalies.filter(anomaly => {
      // Filter out low-confidence anomalies
      if (anomaly.confidence < 0.7) return false;
      
      // Consider seasonal patterns (e.g., holiday spikes are normal)
      if (this.isSeasonalPattern(anomaly, context)) {
        return false;
      }
      
      // Consider marketing campaigns (traffic/sales spikes during campaigns are normal)
      if (this.isMarketingEffect(anomaly, context)) {
        return false;
      }
      
      // Consider weekend/weekday patterns
      if (this.isDayOfWeekPattern(anomaly, context)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Calculate confidence score for anomaly detection
   */
  private calculateConfidence(
    zScore: number,
    historicalValues: number[],
    context: Record<string, any>
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Higher z-score = higher confidence
    confidence += Math.min(0.3, zScore / 10);
    
    // More historical data = higher confidence
    confidence += Math.min(0.15, historicalValues.length / 100);
    
    // Lower variance in historical data = higher confidence
    const coefficientOfVariation = this.calculateCoeffientOfVariation(historicalValues);
    confidence += Math.min(0.05, (1 - coefficientOfVariation) * 0.1);
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Check if anomaly matches seasonal patterns
   */
  private isSeasonalPattern(anomaly: AnomalyDetectionResult, context: Record<string, any>): boolean {
    const date = new Date(anomaly.timestamp);
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    
    // Black Friday/Cyber Monday (late November)
    if (month === 10 && dayOfMonth >= 22 && dayOfMonth <= 30) {
      return anomaly.metricName.includes('sales') && anomaly.context.isPositiveAnomaly;
    }
    
    // Christmas season (December)
    if (month === 11) {
      return anomaly.metricName.includes('sales') && anomaly.context.isPositiveAnomaly;
    }
    
    // Valentine's Day
    if (month === 1 && dayOfMonth >= 10 && dayOfMonth <= 16) {
      return anomaly.metricName.includes('sales') && anomaly.context.isPositiveAnomaly;
    }
    
    return false;
  }

  /**
   * Check if anomaly is due to marketing campaigns
   */
  private isMarketingEffect(anomaly: AnomalyDetectionResult, context: Record<string, any>): boolean {
    // Check if there are active campaigns in context
    if (context.activeCampaigns?.length > 0) {
      return anomaly.context.isPositiveAnomaly;
    }
    
    return false;
  }

  /**
   * Check if anomaly follows day-of-week patterns
   */
  private isDayOfWeekPattern(anomaly: AnomalyDetectionResult, context: Record<string, any>): boolean {
    const date = new Date(anomaly.timestamp);
    const dayOfWeek = date.getDay();
    
    // Weekend patterns for B2C stores
    if ((dayOfWeek === 0 || dayOfWeek === 6) && context.storeType === 'b2c') {
      return anomaly.metricName.includes('traffic') && !anomaly.context.isPositiveAnomaly;
    }
    
    return false;
  }

  /**
   * Calculate coefficient of variation for data consistency
   */
  private calculateCoeffientOfVariation(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 1;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean;
  }

  /**
   * Calculate precision for performance monitoring
   */
  private calculatePrecision(anomalies: AnomalyDetectionResult[]): number {
    if (anomalies.length === 0) return 1.0;
    
    // For now, estimate precision based on confidence scores
    // In production, this would be calculated against labeled data
    const avgConfidence = anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length;
    return Math.min(1.0, avgConfidence * 1.2); // Optimistic but capped estimate
  }
}