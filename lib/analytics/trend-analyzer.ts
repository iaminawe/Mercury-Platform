import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay, endOfDay, subDays, addDays, differenceInDays, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const logger = createLogger('trend-analyzer');

export interface TrendPoint {
  date: string;
  value: number;
  change: number;
  changePercent: number;
  volatility: number;
  isOutlier: boolean;
  confidence: number;
}

export interface TrendAnalysis {
  metric: string;
  timeframe: string;
  direction: 'upward' | 'downward' | 'stable' | 'volatile';
  strength: number; // 0-1 scale
  confidence: number; // 0-1 scale
  data: TrendPoint[];
  statistics: {
    mean: number;
    median: number;
    standardDeviation: number;
    variance: number;
    correlation: number;
    seasonality: number;
    volatility: number;
  };
  forecast: Array<{
    date: string;
    predicted: number;
    confidence: number;
    lower: number;
    upper: number;
  }>;
  insights: {
    patterns: string[];
    anomalies: Array<{
      date: string;
      type: 'spike' | 'drop' | 'unusual';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;
    recommendations: string[];
  };
  storeBreakdown: Array<{
    storeId: string;
    storeName: string;
    trend: TrendAnalysis;
    correlation: number;
  }>;
}

export interface CrossStoreTrends {
  globalTrends: TrendAnalysis[];
  storeComparisons: Array<{
    stores: string[];
    similarity: number;
    divergencePoints: string[];
    correlations: Record<string, number>;
  }>;
  seasonalPatterns: {
    weekly: Record<string, number>; // day of week patterns
    monthly: Record<string, number>; // day of month patterns
    yearly: Record<string, number>; // month of year patterns
  };
  cyclicalAnalysis: {
    detected: boolean;
    period: number; // days
    amplitude: number;
    phase: number;
    confidence: number;
  };
  predictiveInsights: {
    nextPeriodForecast: Record<string, number>;
    riskFactors: string[];
    opportunities: string[];
    recommendedActions: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      timeframe: string;
      expectedImpact: number;
    }>;
  };
}

export interface TrendAlert {
  id: string;
  type: 'trend_change' | 'anomaly' | 'forecast_warning' | 'opportunity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  storeId?: string;
  storeName?: string;
  message: string;
  details: string;
  timestamp: string;
  actionRequired: boolean;
  suggestedActions: string[];
  confidence: number;
}

export class TrendAnalyzer {
  constructor(private supabase: SupabaseClient<Database>) {}

  async analyzeCrossStoreTrends(
    ownerId: string,
    dateRange: { from: Date; to: Date },
    metrics: string[] = ['revenue', 'orders', 'visitors', 'conversion_rate']
  ): Promise<CrossStoreTrends> {
    const stores = await this.getStoresList(ownerId);
    const storeIds = stores.map(s => s.id);

    // Get extended date range for better trend analysis
    const extendedFrom = subDays(dateRange.from, 90); // 90 days of history
    
    const { data: snapshots, error } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(extendedFrom, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    if (error) {
      logger.error('Failed to fetch analytics snapshots for trend analysis', error);
      throw new Error('Failed to fetch analytics data');
    }

    const globalTrends = await this.calculateGlobalTrends(snapshots || [], metrics, stores);
    const storeComparisons = this.analyzeStoreCorrelations(snapshots || [], stores);
    const seasonalPatterns = this.detectSeasonalPatterns(snapshots || []);
    const cyclicalAnalysis = this.analyzeCyclicalPatterns(snapshots || []);
    const predictiveInsights = this.generatePredictiveInsights(globalTrends, seasonalPatterns);

    return {
      globalTrends,
      storeComparisons,
      seasonalPatterns,
      cyclicalAnalysis,
      predictiveInsights
    };
  }

  async analyzeStoreTrend(
    storeId: string,
    metric: string,
    dateRange: { from: Date; to: Date },
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<TrendAnalysis> {
    const { data: snapshots, error } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    if (error) {
      logger.error('Failed to fetch store analytics for trend analysis', error);
      throw new Error('Failed to fetch store analytics data');
    }

    const store = await this.getStoreInfo(storeId);
    const aggregatedData = this.aggregateDataByGranularity(snapshots || [], granularity);
    const trendData = this.calculateTrendPoints(aggregatedData, metric);
    const statistics = this.calculateStatistics(trendData);
    const forecast = this.generateForecast(trendData, 7); // 7 periods ahead
    const insights = this.generateInsights(trendData, statistics);

    return {
      metric,
      timeframe: `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`,
      direction: this.determineTrendDirection(trendData),
      strength: this.calculateTrendStrength(trendData),
      confidence: this.calculateTrendConfidence(trendData, statistics),
      data: trendData,
      statistics,
      forecast,
      insights,
      storeBreakdown: [] // Single store analysis
    };
  }

  async detectTrendAlerts(
    ownerId: string,
    sensitivity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<TrendAlert[]> {
    const stores = await this.getStoresList(ownerId);
    const alerts: TrendAlert[] = [];

    for (const store of stores) {
      const dateRange = {
        from: subDays(new Date(), 30),
        to: new Date()
      };

      try {
        // Analyze key metrics for alerts
        const metrics = ['revenue', 'orders_count', 'unique_visitors', 'conversion_rate'];
        
        for (const metric of metrics) {
          const trend = await this.analyzeStoreTrend(store.id, metric, dateRange);
          const storeAlerts = this.generateAlertsFromTrend(trend, store, sensitivity);
          alerts.push(...storeAlerts);
        }
      } catch (error) {
        logger.error(`Failed to analyze trends for store ${store.shop_name}`, error);
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  private async calculateGlobalTrends(
    snapshots: any[],
    metrics: string[],
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>
  ): Promise<TrendAnalysis[]> {
    const globalTrends: TrendAnalysis[] = [];

    for (const metric of metrics) {
      // Aggregate all stores by date
      const dateAggregation: Record<string, number> = {};
      
      snapshots.forEach(snapshot => {
        const date = snapshot.date;
        const value = this.getMetricValue(snapshot, metric);
        dateAggregation[date] = (dateAggregation[date] || 0) + value;
      });

      // Convert to time series data
      const timeSeriesData = Object.entries(dateAggregation)
        .map(([date, value]) => ({ date, [metric]: value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const trendData = this.calculateTrendPoints(timeSeriesData, metric);
      const statistics = this.calculateStatistics(trendData);
      const forecast = this.generateForecast(trendData, 7);
      const insights = this.generateInsights(trendData, statistics);

      // Calculate store breakdown
      const storeBreakdown = await Promise.all(
        stores.map(async store => {
          const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
          const storeData = storeSnapshots.map(s => ({ date: s.date, [metric]: this.getMetricValue(s, metric) }));
          const storeTrendData = this.calculateTrendPoints(storeData, metric);
          const storeStatistics = this.calculateStatistics(storeTrendData);
          
          return {
            storeId: store.id,
            storeName: store.shop_name,
            trend: {
              metric,
              timeframe: 'store-specific',
              direction: this.determineTrendDirection(storeTrendData),
              strength: this.calculateTrendStrength(storeTrendData),
              confidence: this.calculateTrendConfidence(storeTrendData, storeStatistics),
              data: storeTrendData,
              statistics: storeStatistics,
              forecast: this.generateForecast(storeTrendData, 7),
              insights: this.generateInsights(storeTrendData, storeStatistics),
              storeBreakdown: []
            } as TrendAnalysis,
            correlation: this.calculateCorrelation(trendData, storeTrendData)
          };
        })
      );

      globalTrends.push({
        metric,
        timeframe: 'cross-store',
        direction: this.determineTrendDirection(trendData),
        strength: this.calculateTrendStrength(trendData),
        confidence: this.calculateTrendConfidence(trendData, statistics),
        data: trendData,
        statistics,
        forecast,
        insights,
        storeBreakdown
      });
    }

    return globalTrends;
  }

  private analyzeStoreCorrelations(
    snapshots: any[],
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>
  ) {
    const storeComparisons = [];

    for (let i = 0; i < stores.length; i++) {
      for (let j = i + 1; j < stores.length; j++) {
        const store1 = stores[i];
        const store2 = stores[j];

        const store1Data = snapshots.filter(s => s.store_id === store1.id);
        const store2Data = snapshots.filter(s => s.store_id === store2.id);

        // Calculate correlations for different metrics
        const correlations: Record<string, number> = {};
        const metrics = ['revenue', 'orders_count', 'unique_visitors'];

        metrics.forEach(metric => {
          const series1 = store1Data.map(s => this.getMetricValue(s, metric));
          const series2 = store2Data.map(s => this.getMetricValue(s, metric));
          correlations[metric] = this.calculateSeriesCorrelation(series1, series2);
        });

        const avgCorrelation = Object.values(correlations).reduce((sum, cor) => sum + cor, 0) / metrics.length;

        if (Math.abs(avgCorrelation) > 0.3) { // Only include meaningful correlations
          storeComparisons.push({
            stores: [store1.shop_name, store2.shop_name],
            similarity: Math.abs(avgCorrelation),
            divergencePoints: this.findDivergencePoints(store1Data, store2Data),
            correlations
          });
        }
      }
    }

    return storeComparisons.sort((a, b) => b.similarity - a.similarity);
  }

  private detectSeasonalPatterns(snapshots: any[]) {
    const weeklyPatterns: Record<string, number[]> = {
      'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [],
      'Friday': [], 'Saturday': [], 'Sunday': []
    };
    
    const monthlyPatterns: Record<string, number[]> = {};
    const yearlyPatterns: Record<string, number[]> = {};

    snapshots.forEach(snapshot => {
      const date = new Date(snapshot.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dayOfMonth = date.getDate().toString();
      const month = date.toLocaleDateString('en-US', { month: 'long' });

      weeklyPatterns[dayOfWeek].push(snapshot.revenue);
      
      if (!monthlyPatterns[dayOfMonth]) monthlyPatterns[dayOfMonth] = [];
      monthlyPatterns[dayOfMonth].push(snapshot.revenue);
      
      if (!yearlyPatterns[month]) yearlyPatterns[month] = [];
      yearlyPatterns[month].push(snapshot.revenue);
    });

    return {
      weekly: this.calculatePatternAverages(weeklyPatterns),
      monthly: this.calculatePatternAverages(monthlyPatterns),
      yearly: this.calculatePatternAverages(yearlyPatterns)
    };
  }

  private analyzeCyclicalPatterns(snapshots: any[]) {
    if (snapshots.length < 30) {
      return {
        detected: false,
        period: 0,
        amplitude: 0,
        phase: 0,
        confidence: 0
      };
    }

    const values = snapshots.map(s => s.revenue);
    const period = this.detectDominantPeriod(values);
    const amplitude = this.calculateAmplitude(values, period);
    const phase = this.calculatePhase(values, period);
    const confidence = this.calculateCyclicalConfidence(values, period);

    return {
      detected: confidence > 0.5,
      period,
      amplitude,
      phase,
      confidence
    };
  }

  private generatePredictiveInsights(
    globalTrends: TrendAnalysis[],
    seasonalPatterns: any
  ) {
    const nextPeriodForecast: Record<string, number> = {};
    const riskFactors: string[] = [];
    const opportunities: string[] = [];
    const recommendedActions: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      timeframe: string;
      expectedImpact: number;
    }> = [];

    globalTrends.forEach(trend => {
      // Generate forecast for next period
      if (trend.forecast.length > 0) {
        nextPeriodForecast[trend.metric] = trend.forecast[0].predicted;
      }

      // Identify risk factors
      if (trend.direction === 'downward' && trend.strength > 0.7) {
        riskFactors.push(`Declining ${trend.metric} trend with high confidence`);
      }
      
      if (trend.statistics.volatility > 0.5) {
        riskFactors.push(`High volatility in ${trend.metric}`);
      }

      // Identify opportunities
      if (trend.direction === 'upward' && trend.strength > 0.6) {
        opportunities.push(`Growing ${trend.metric} trend`);
      }

      // Generate action recommendations
      if (trend.direction === 'downward' && trend.confidence > 0.7) {
        recommendedActions.push({
          action: `Investigate and address declining ${trend.metric}`,
          priority: 'high',
          timeframe: 'immediate',
          expectedImpact: trend.strength * 100
        });
      }

      if (trend.direction === 'upward' && trend.strength > 0.6) {
        recommendedActions.push({
          action: `Scale strategies driving ${trend.metric} growth`,
          priority: 'medium',
          timeframe: '1-2 weeks',
          expectedImpact: trend.strength * 80
        });
      }
    });

    return {
      nextPeriodForecast,
      riskFactors,
      opportunities,
      recommendedActions: recommendedActions.sort((a, b) => b.expectedImpact - a.expectedImpact)
    };
  }

  // Helper methods
  private async getStoresList(ownerId: string) {
    const { data: stores, error } = await this.supabase
      .from('stores')
      .select('id, shop_name, shop_domain')
      .eq('owner_id', ownerId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to fetch stores list', error);
      throw new Error('Failed to fetch stores');
    }

    return stores || [];
  }

  private async getStoreInfo(storeId: string) {
    const { data: store, error } = await this.supabase
      .from('stores')
      .select('shop_name, shop_domain')
      .eq('id', storeId)
      .single();

    if (error) {
      logger.error('Failed to fetch store info', error);
      return { shop_name: 'Unknown', shop_domain: 'unknown' };
    }

    return store;
  }

  private getMetricValue(snapshot: any, metric: string): number {
    const metricMap: Record<string, string> = {
      'revenue': 'revenue',
      'orders': 'orders_count',
      'visitors': 'unique_visitors',
      'conversion_rate': 'conversion_rate',
      'page_views': 'page_views',
      'average_order_value': 'average_order_value'
    };

    const field = metricMap[metric] || metric;
    return snapshot[field] || 0;
  }

  private aggregateDataByGranularity(snapshots: any[], granularity: 'daily' | 'weekly' | 'monthly') {
    if (granularity === 'daily') return snapshots;

    const aggregated: Record<string, any> = {};

    snapshots.forEach(snapshot => {
      const date = new Date(snapshot.date);
      let key: string;

      if (granularity === 'weekly') {
        const weekStart = startOfWeek(date);
        key = format(weekStart, 'yyyy-MM-dd');
      } else { // monthly
        const monthStart = startOfMonth(date);
        key = format(monthStart, 'yyyy-MM-dd');
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          date: key,
          revenue: 0,
          orders_count: 0,
          unique_visitors: 0,
          page_views: 0,
          average_order_value: 0,
          conversion_rate: 0,
          count: 0
        };
      }

      aggregated[key].revenue += snapshot.revenue;
      aggregated[key].orders_count += snapshot.orders_count;
      aggregated[key].unique_visitors += snapshot.unique_visitors;
      aggregated[key].page_views += snapshot.page_views;
      aggregated[key].average_order_value += snapshot.average_order_value;
      aggregated[key].conversion_rate += snapshot.conversion_rate;
      aggregated[key].count += 1;
    });

    // Calculate averages for rates
    Object.values(aggregated).forEach((agg: any) => {
      agg.average_order_value = agg.average_order_value / agg.count;
      agg.conversion_rate = agg.conversion_rate / agg.count;
    });

    return Object.values(aggregated).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }

  private calculateTrendPoints(data: any[], metric: string): TrendPoint[] {
    return data.map((point, index) => {
      const value = this.getMetricValue(point, metric);
      const prevValue = index > 0 ? this.getMetricValue(data[index - 1], metric) : value;
      
      const change = value - prevValue;
      const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;
      
      // Calculate volatility (simplified)
      const windowSize = Math.min(5, index + 1);
      const window = data.slice(Math.max(0, index - windowSize + 1), index + 1);
      const windowValues = window.map(p => this.getMetricValue(p, metric));
      const volatility = this.calculateVolatility(windowValues);
      
      // Detect outliers
      const mean = windowValues.reduce((sum, v) => sum + v, 0) / windowValues.length;
      const stdDev = Math.sqrt(windowValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / windowValues.length);
      const isOutlier = Math.abs(value - mean) > 2 * stdDev;

      return {
        date: point.date,
        value,
        change,
        changePercent,
        volatility,
        isOutlier,
        confidence: this.calculatePointConfidence(value, mean, stdDev)
      };
    });
  }

  private calculateStatistics(trendData: TrendPoint[]) {
    const values = trendData.map(p => p.value);
    const changes = trendData.slice(1).map(p => p.changePercent);

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues.length % 2 === 0 
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];

    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    const correlation = this.calculateTimeCorrelation(values);
    const seasonality = this.detectSeasonality(values);
    const volatility = this.calculateVolatility(values);

    return {
      mean,
      median,
      standardDeviation,
      variance,
      correlation,
      seasonality,
      volatility
    };
  }

  private generateForecast(trendData: TrendPoint[], periods: number) {
    if (trendData.length < 3) return [];

    const forecast = [];
    const values = trendData.map(p => p.value);
    
    // Simple linear regression for trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate confidence intervals
    const residuals = y.map((val, i) => val - (slope * i + intercept));
    const mse = residuals.reduce((sum, res) => sum + res * res, 0) / (n - 2);
    const stdError = Math.sqrt(mse);

    for (let i = 1; i <= periods; i++) {
      const x_val = n + i - 1;
      const predicted = slope * x_val + intercept;
      const confidence = Math.max(0.5, 1 - (i * 0.1)); // Decrease confidence over time
      
      const margin = 1.96 * stdError * Math.sqrt(1 + 1/n + Math.pow(x_val - sumX/n, 2) / (sumXX - sumX*sumX/n));
      
      const nextDate = new Date(trendData[trendData.length - 1].date);
      nextDate.setDate(nextDate.getDate() + i);

      forecast.push({
        date: format(nextDate, 'yyyy-MM-dd'),
        predicted: Math.max(0, predicted),
        confidence,
        lower: Math.max(0, predicted - margin),
        upper: predicted + margin
      });
    }

    return forecast;
  }

  private generateInsights(trendData: TrendPoint[], statistics: any) {
    const patterns = [];
    const anomalies = [];
    const recommendations = [];

    // Detect patterns
    if (statistics.correlation > 0.7) {
      patterns.push('Strong positive trend detected');
    } else if (statistics.correlation < -0.7) {
      patterns.push('Strong negative trend detected');
    }

    if (statistics.seasonality > 0.6) {
      patterns.push('Seasonal pattern identified');
    }

    if (statistics.volatility > 0.5) {
      patterns.push('High volatility observed');
    }

    // Detect anomalies
    trendData.forEach(point => {
      if (point.isOutlier) {
        const severity = Math.abs(point.changePercent) > 50 ? 'high' : 
                        Math.abs(point.changePercent) > 20 ? 'medium' : 'low';
        
        anomalies.push({
          date: point.date,
          type: point.changePercent > 0 ? 'spike' : 'drop' as const,
          severity: severity as 'low' | 'medium' | 'high',
          description: `${point.changePercent > 0 ? 'Spike' : 'Drop'} of ${Math.abs(point.changePercent).toFixed(1)}%`
        });
      }
    });

    // Generate recommendations
    if (statistics.correlation < -0.5) {
      recommendations.push('Investigate factors causing decline');
      recommendations.push('Implement corrective measures');
    }

    if (statistics.volatility > 0.7) {
      recommendations.push('Stabilize operations to reduce volatility');
      recommendations.push('Implement risk management strategies');
    }

    if (patterns.includes('Seasonal pattern identified')) {
      recommendations.push('Plan for seasonal fluctuations');
      recommendations.push('Optimize inventory for seasonal demands');
    }

    return {
      patterns,
      anomalies,
      recommendations
    };
  }

  private generateAlertsFromTrend(
    trend: TrendAnalysis,
    store: { id: string; shop_name: string; shop_domain: string },
    sensitivity: 'low' | 'medium' | 'high'
  ): TrendAlert[] {
    const alerts: TrendAlert[] = [];
    const thresholds = {
      low: { change: 20, volatility: 0.8, confidence: 0.8 },
      medium: { change: 15, volatility: 0.6, confidence: 0.7 },
      high: { change: 10, volatility: 0.4, confidence: 0.6 }
    };

    const threshold = thresholds[sensitivity];

    // Trend change alerts
    if (trend.direction === 'downward' && trend.strength > 0.6 && trend.confidence > threshold.confidence) {
      alerts.push({
        id: `trend_${store.id}_${trend.metric}_${Date.now()}`,
        type: 'trend_change',
        severity: trend.strength > 0.8 ? 'high' : 'medium',
        metric: trend.metric,
        storeId: store.id,
        storeName: store.shop_name,
        message: `Declining ${trend.metric} trend detected`,
        details: `${trend.metric} has been declining with ${(trend.strength * 100).toFixed(1)}% confidence`,
        timestamp: new Date().toISOString(),
        actionRequired: true,
        suggestedActions: [
          'Analyze root causes of decline',
          'Review recent changes in strategy',
          'Implement corrective measures'
        ],
        confidence: trend.confidence
      });
    }

    // Volatility alerts
    if (trend.statistics.volatility > threshold.volatility) {
      alerts.push({
        id: `volatility_${store.id}_${trend.metric}_${Date.now()}`,
        type: 'anomaly',
        severity: trend.statistics.volatility > 0.8 ? 'high' : 'medium',
        metric: trend.metric,
        storeId: store.id,
        storeName: store.shop_name,
        message: `High volatility in ${trend.metric}`,
        details: `Volatility level: ${(trend.statistics.volatility * 100).toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        actionRequired: false,
        suggestedActions: [
          'Monitor for stabilization',
          'Review operational consistency'
        ],
        confidence: 0.8
      });
    }

    // Anomaly alerts
    trend.insights.anomalies.forEach(anomaly => {
      if (anomaly.severity === 'high' || (anomaly.severity === 'medium' && sensitivity === 'high')) {
        alerts.push({
          id: `anomaly_${store.id}_${trend.metric}_${anomaly.date}`,
          type: 'anomaly',
          severity: anomaly.severity === 'high' ? 'critical' : 'high',
          metric: trend.metric,
          storeId: store.id,
          storeName: store.shop_name,
          message: `${anomaly.type} detected in ${trend.metric}`,
          details: anomaly.description,
          timestamp: new Date().toISOString(),
          actionRequired: true,
          suggestedActions: [
            'Investigate cause of anomaly',
            'Check for data quality issues',
            'Review business operations for that period'
          ],
          confidence: 0.9
        });
      }
    });

    return alerts;
  }

  // Statistical helper methods
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0;
  }

  private calculatePointConfidence(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 1;
    const zScore = Math.abs(value - mean) / stdDev;
    return Math.max(0.1, 1 - (zScore / 3)); // Normalize to 0.1-1 range
  }

  private calculateTimeCorrelation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    
    if (denomX === 0 || denomY === 0) return 0;
    return numerator / (denomX * denomY);
  }

  private detectSeasonality(values: number[]): number {
    // Simple seasonality detection using autocorrelation
    if (values.length < 14) return 0;
    
    const periodsToCheck = [7, 14, 30]; // weekly, bi-weekly, monthly
    let maxSeasonality = 0;
    
    periodsToCheck.forEach(period => {
      if (values.length >= period * 2) {
        const seasonality = this.calculateAutocorrelation(values, period);
        maxSeasonality = Math.max(maxSeasonality, Math.abs(seasonality));
      }
    });
    
    return maxSeasonality;
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;
    
    const n = values.length - lag;
    const x1 = values.slice(0, n);
    const x2 = values.slice(lag);
    
    const mean1 = x1.reduce((sum, v) => sum + v, 0) / n;
    const mean2 = x2.reduce((sum, v) => sum + v, 0) / n;
    
    const numerator = x1.reduce((sum, val, i) => sum + (val - mean1) * (x2[i] - mean2), 0);
    const denom1 = Math.sqrt(x1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0));
    const denom2 = Math.sqrt(x2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0));
    
    if (denom1 === 0 || denom2 === 0) return 0;
    return numerator / (denom1 * denom2);
  }

  private determineTrendDirection(trendData: TrendPoint[]): 'upward' | 'downward' | 'stable' | 'volatile' {
    if (trendData.length < 2) return 'stable';
    
    const values = trendData.map(p => p.value);
    const correlation = this.calculateTimeCorrelation(values);
    const volatility = this.calculateVolatility(values);
    
    if (volatility > 0.7) return 'volatile';
    if (correlation > 0.3) return 'upward';
    if (correlation < -0.3) return 'downward';
    return 'stable';
  }

  private calculateTrendStrength(trendData: TrendPoint[]): number {
    if (trendData.length < 2) return 0;
    
    const values = trendData.map(p => p.value);
    const correlation = Math.abs(this.calculateTimeCorrelation(values));
    const volatility = this.calculateVolatility(values);
    
    // Stronger trends have high correlation and low volatility
    return Math.max(0, correlation - volatility * 0.5);
  }

  private calculateTrendConfidence(trendData: TrendPoint[], statistics: any): number {
    if (trendData.length < 3) return 0.1;
    
    const dataQuality = 1 - statistics.volatility;
    const sampleSize = Math.min(1, trendData.length / 30); // More data = higher confidence
    const consistency = 1 - (trendData.filter(p => p.isOutlier).length / trendData.length);
    
    return (dataQuality + sampleSize + consistency) / 3;
  }

  private calculateCorrelation(series1: TrendPoint[], series2: TrendPoint[]): number {
    const values1 = series1.map(p => p.value);
    const values2 = series2.map(p => p.value);
    
    return this.calculateSeriesCorrelation(values1, values2);
  }

  private calculateSeriesCorrelation(series1: number[], series2: number[]): number {
    const minLength = Math.min(series1.length, series2.length);
    if (minLength < 2) return 0;
    
    const x = series1.slice(0, minLength);
    const y = series2.slice(0, minLength);
    
    const n = minLength;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    
    if (denomX === 0 || denomY === 0) return 0;
    return numerator / (denomX * denomY);
  }

  private findDivergencePoints(store1Data: any[], store2Data: any[]): string[] {
    // Simplified divergence detection
    const divergencePoints = [];
    const minLength = Math.min(store1Data.length, store2Data.length);
    
    for (let i = 1; i < minLength; i++) {
      const growth1 = store1Data[i].revenue / (store1Data[i-1].revenue || 1) - 1;
      const growth2 = store2Data[i].revenue / (store2Data[i-1].revenue || 1) - 1;
      
      if (Math.abs(growth1 - growth2) > 0.2) { // 20% difference in growth rates
        divergencePoints.push(store1Data[i].date);
      }
    }
    
    return divergencePoints;
  }

  private calculatePatternAverages(patterns: Record<string, number[]>): Record<string, number> {
    const averages: Record<string, number> = {};
    
    Object.entries(patterns).forEach(([key, values]) => {
      if (values.length > 0) {
        averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      } else {
        averages[key] = 0;
      }
    });
    
    return averages;
  }

  private detectDominantPeriod(values: number[]): number {
    // Simple period detection using FFT concept (simplified)
    const periods = [7, 14, 30, 90]; // Common business periods
    let maxCorrelation = 0;
    let dominantPeriod = 0;
    
    periods.forEach(period => {
      if (values.length >= period * 2) {
        const correlation = Math.abs(this.calculateAutocorrelation(values, period));
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          dominantPeriod = period;
        }
      }
    });
    
    return dominantPeriod;
  }

  private calculateAmplitude(values: number[], period: number): number {
    if (period === 0 || values.length < period) return 0;
    
    const cycles = Math.floor(values.length / period);
    if (cycles < 1) return 0;
    
    let totalAmplitude = 0;
    
    for (let cycle = 0; cycle < cycles; cycle++) {
      const cycleStart = cycle * period;
      const cycleEnd = Math.min(cycleStart + period, values.length);
      const cycleValues = values.slice(cycleStart, cycleEnd);
      
      const max = Math.max(...cycleValues);
      const min = Math.min(...cycleValues);
      totalAmplitude += (max - min);
    }
    
    return totalAmplitude / cycles;
  }

  private calculatePhase(values: number[], period: number): number {
    // Simplified phase calculation
    if (period === 0 || values.length < period) return 0;
    
    const firstCycle = values.slice(0, period);
    const maxIndex = firstCycle.indexOf(Math.max(...firstCycle));
    
    return maxIndex / period; // Phase as fraction of period
  }

  private calculateCyclicalConfidence(values: number[], period: number): number {
    if (period === 0) return 0;
    
    const autocorrelation = Math.abs(this.calculateAutocorrelation(values, period));
    const consistency = this.calculateCyclicalConsistency(values, period);
    
    return (autocorrelation + consistency) / 2;
  }

  private calculateCyclicalConsistency(values: number[], period: number): number {
    if (period === 0 || values.length < period * 2) return 0;
    
    const cycles = Math.floor(values.length / period);
    const cycleCorrelations = [];
    
    for (let i = 0; i < cycles - 1; i++) {
      const cycle1 = values.slice(i * period, (i + 1) * period);
      const cycle2 = values.slice((i + 1) * period, (i + 2) * period);
      
      if (cycle2.length === period) {
        const correlation = this.calculateSeriesCorrelation(cycle1, cycle2);
        cycleCorrelations.push(Math.abs(correlation));
      }
    }
    
    if (cycleCorrelations.length === 0) return 0;
    
    return cycleCorrelations.reduce((sum, cor) => sum + cor, 0) / cycleCorrelations.length;
  }
}