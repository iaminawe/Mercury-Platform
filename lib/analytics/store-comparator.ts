import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';

const logger = createLogger('store-comparator');

export interface StoreComparisonMetric {
  metric: string;
  unit: 'currency' | 'percentage' | 'number' | 'time';
  values: Record<string, number>;
  winner?: string;
  average: number;
  variance: number;
}

export interface StoreComparisonResult {
  metrics: StoreComparisonMetric[];
  rankings: Array<{
    storeId: string;
    storeName: string;
    overallScore: number;
    rank: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  insights: Array<{
    type: 'benchmark' | 'outlier' | 'trend';
    description: string;
    affectedStores: string[];
    recommendation: string;
  }>;
  correlations: Array<{
    metric1: string;
    metric2: string;
    correlation: number;
    interpretation: string;
  }>;
}

export class StoreComparator {
  constructor(private supabase: SupabaseClient<Database>) {}

  async compareStores(
    storeIds: string[],
    dateRange: { from: Date; to: Date },
    metrics?: string[]
  ): Promise<StoreComparisonResult> {
    try {
      // Fetch store data
      const { data: stores } = await this.supabase
        .from('stores')
        .select('id, shop_name, shop_domain')
        .in('id', storeIds);

      if (!stores || stores.length === 0) {
        throw new Error('No stores found');
      }

      // Fetch analytics data
      const { data: snapshots } = await this.supabase
        .from('analytics_snapshots')
        .select('*')
        .in('store_id', storeIds)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

      if (!snapshots || snapshots.length === 0) {
        throw new Error('No analytics data found');
      }

      // Calculate comparison metrics
      const comparisonMetrics = this.calculateMetrics(snapshots, stores, metrics);
      
      // Generate rankings
      const rankings = this.generateRankings(comparisonMetrics, stores);
      
      // Generate insights
      const insights = this.generateInsights(comparisonMetrics, rankings, stores);
      
      // Calculate correlations
      const correlations = this.calculateCorrelations(comparisonMetrics);

      return {
        metrics: comparisonMetrics,
        rankings,
        insights,
        correlations
      };
    } catch (error) {
      logger.error('Failed to compare stores', error);
      throw error;
    }
  }

  private calculateMetrics(
    snapshots: any[],
    stores: any[],
    selectedMetrics?: string[]
  ): StoreComparisonMetric[] {
    const metricDefinitions = [
      { key: 'revenue', name: 'Total Revenue', unit: 'currency' as const },
      { key: 'orders', name: 'Total Orders', unit: 'number' as const },
      { key: 'avgOrderValue', name: 'Average Order Value', unit: 'currency' as const },
      { key: 'conversionRate', name: 'Conversion Rate', unit: 'percentage' as const },
      { key: 'visitors', name: 'Unique Visitors', unit: 'number' as const },
      { key: 'pageViews', name: 'Page Views', unit: 'number' as const },
      { key: 'bounceRate', name: 'Bounce Rate', unit: 'percentage' as const },
      { key: 'cartAbandonment', name: 'Cart Abandonment Rate', unit: 'percentage' as const },
      { key: 'returnVisitorRate', name: 'Return Visitor Rate', unit: 'percentage' as const },
      { key: 'avgSessionDuration', name: 'Avg Session Duration', unit: 'time' as const }
    ];

    const metricsToCalculate = selectedMetrics 
      ? metricDefinitions.filter(m => selectedMetrics.includes(m.key))
      : metricDefinitions;

    return metricsToCalculate.map(metricDef => {
      const values: Record<string, number> = {};
      
      stores.forEach(store => {
        const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
        
        switch (metricDef.key) {
          case 'revenue':
            values[store.id] = storeSnapshots.reduce((sum, s) => sum + s.revenue, 0);
            break;
          case 'orders':
            values[store.id] = storeSnapshots.reduce((sum, s) => sum + s.orders_count, 0);
            break;
          case 'avgOrderValue':
            const totalRevenue = storeSnapshots.reduce((sum, s) => sum + s.revenue, 0);
            const totalOrders = storeSnapshots.reduce((sum, s) => sum + s.orders_count, 0);
            values[store.id] = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            break;
          case 'conversionRate':
            const orders = storeSnapshots.reduce((sum, s) => sum + s.orders_count, 0);
            const visitors = storeSnapshots.reduce((sum, s) => sum + s.unique_visitors, 0);
            values[store.id] = visitors > 0 ? (orders / visitors) * 100 : 0;
            break;
          case 'visitors':
            values[store.id] = storeSnapshots.reduce((sum, s) => sum + s.unique_visitors, 0);
            break;
          case 'pageViews':
            values[store.id] = storeSnapshots.reduce((sum, s) => sum + s.page_views, 0);
            break;
          case 'bounceRate':
            const avgBounceRate = storeSnapshots.reduce((sum, s, _, arr) => 
              sum + (s.bounce_rate || 0) / arr.length, 0);
            values[store.id] = avgBounceRate;
            break;
          case 'cartAbandonment':
            values[store.id] = 30 + Math.random() * 20; // Placeholder
            break;
          case 'returnVisitorRate':
            values[store.id] = 20 + Math.random() * 30; // Placeholder
            break;
          case 'avgSessionDuration':
            values[store.id] = 120 + Math.random() * 180; // Placeholder (seconds)
            break;
        }
      });

      const valuesArray = Object.values(values);
      const average = valuesArray.reduce((sum, v) => sum + v, 0) / valuesArray.length;
      const variance = valuesArray.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / valuesArray.length;
      
      const winner = Object.entries(values).reduce((best, [storeId, value]) => {
        if (!best || (metricDef.key === 'bounceRate' || metricDef.key === 'cartAbandonment' 
          ? value < values[best] 
          : value > values[best])) {
          return storeId;
        }
        return best;
      }, '');

      return {
        metric: metricDef.name,
        unit: metricDef.unit,
        values,
        winner,
        average,
        variance: Math.sqrt(variance)
      };
    });
  }

  private generateRankings(
    metrics: StoreComparisonMetric[],
    stores: any[]
  ): StoreComparisonResult['rankings'] {
    const storeScores = stores.map(store => {
      let totalScore = 0;
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      metrics.forEach(metric => {
        const value = metric.values[store.id];
        const isNegativeMetric = metric.metric.includes('Abandonment') || metric.metric.includes('Bounce');
        
        // Calculate normalized score (0-100)
        const maxValue = Math.max(...Object.values(metric.values));
        const minValue = Math.min(...Object.values(metric.values));
        const range = maxValue - minValue;
        
        let normalizedScore: number;
        if (range === 0) {
          normalizedScore = 50;
        } else if (isNegativeMetric) {
          normalizedScore = ((maxValue - value) / range) * 100;
        } else {
          normalizedScore = ((value - minValue) / range) * 100;
        }

        totalScore += normalizedScore;

        // Identify strengths and weaknesses
        if (normalizedScore >= 80) {
          strengths.push(metric.metric);
        } else if (normalizedScore <= 20) {
          weaknesses.push(metric.metric);
        }
      });

      return {
        storeId: store.id,
        storeName: store.shop_name,
        overallScore: totalScore / metrics.length,
        rank: 0, // Will be set after sorting
        strengths,
        weaknesses
      };
    });

    // Sort by score and assign ranks
    storeScores.sort((a, b) => b.overallScore - a.overallScore);
    storeScores.forEach((store, index) => {
      store.rank = index + 1;
    });

    return storeScores;
  }

  private generateInsights(
    metrics: StoreComparisonMetric[],
    rankings: StoreComparisonResult['rankings'],
    stores: any[]
  ): StoreComparisonResult['insights'] {
    const insights: StoreComparisonResult['insights'] = [];

    // Find outliers
    metrics.forEach(metric => {
      const values = Object.values(metric.values);
      const mean = metric.average;
      const stdDev = metric.variance;
      
      Object.entries(metric.values).forEach(([storeId, value]) => {
        const zScore = Math.abs((value - mean) / stdDev);
        if (zScore > 2) {
          const store = stores.find(s => s.id === storeId);
          const isPositiveOutlier = metric.metric.includes('Abandonment') || metric.metric.includes('Bounce')
            ? value < mean
            : value > mean;
          
          insights.push({
            type: 'outlier',
            description: `${store?.shop_name} is an outlier for ${metric.metric} (${this.formatValue(value, metric.unit)})`,
            affectedStores: [storeId],
            recommendation: isPositiveOutlier
              ? `Study ${store?.shop_name}'s practices for ${metric.metric} and replicate across other stores`
              : `Investigate why ${store?.shop_name} is underperforming in ${metric.metric} and implement improvements`
          });
        }
      });
    });

    // Benchmark insights
    const topPerformer = rankings[0];
    const bottomPerformer = rankings[rankings.length - 1];
    
    if (topPerformer.overallScore - bottomPerformer.overallScore > 30) {
      insights.push({
        type: 'benchmark',
        description: `Significant performance gap between top store (${topPerformer.storeName}) and bottom store (${bottomPerformer.storeName})`,
        affectedStores: [topPerformer.storeId, bottomPerformer.storeId],
        recommendation: 'Implement a mentorship program where top-performing stores share best practices with underperforming ones'
      });
    }

    // Trend insights
    const conversionMetric = metrics.find(m => m.metric === 'Conversion Rate');
    if (conversionMetric) {
      const avgConversion = conversionMetric.average;
      if (avgConversion < 2) {
        insights.push({
          type: 'trend',
          description: 'Overall conversion rates across all stores are below industry average',
          affectedStores: Object.keys(conversionMetric.values),
          recommendation: 'Consider implementing a company-wide conversion optimization initiative'
        });
      }
    }

    return insights;
  }

  private calculateCorrelations(
    metrics: StoreComparisonMetric[]
  ): StoreComparisonResult['correlations'] {
    const correlations: StoreComparisonResult['correlations'] = [];
    
    // Calculate correlations between pairs of metrics
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];
        
        const correlation = this.pearsonCorrelation(
          Object.values(metric1.values),
          Object.values(metric2.values)
        );
        
        if (Math.abs(correlation) > 0.5) {
          correlations.push({
            metric1: metric1.metric,
            metric2: metric2.metric,
            correlation,
            interpretation: this.interpretCorrelation(metric1.metric, metric2.metric, correlation)
          });
        }
      }
    }
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private interpretCorrelation(metric1: string, metric2: string, correlation: number): string {
    const strength = Math.abs(correlation) > 0.7 ? 'strong' : 'moderate';
    const direction = correlation > 0 ? 'positive' : 'negative';
    
    if (metric1 === 'Total Revenue' && metric2 === 'Total Orders') {
      return `${strength} ${direction} correlation: Higher order volume ${direction === 'positive' ? 'drives' : 'reduces'} revenue`;
    } else if (metric1.includes('Conversion') && metric2.includes('Revenue')) {
      return `${strength} ${direction} correlation: Better conversion rates ${direction === 'positive' ? 'increase' : 'decrease'} revenue`;
    } else if (metric1.includes('Bounce') && metric2.includes('Conversion')) {
      return `${strength} ${direction} correlation: ${direction === 'negative' ? 'Lower' : 'Higher'} bounce rates improve conversion`;
    }
    
    return `${strength} ${direction} correlation between ${metric1} and ${metric2}`;
  }

  private formatValue(value: number, unit: StoreComparisonMetric['unit']): string {
    switch (unit) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'time':
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      case 'number':
      default:
        return value.toLocaleString('en-US');
    }
  }

  async generateComparisonReport(
    storeIds: string[],
    dateRange: { from: Date; to: Date }
  ): Promise<string> {
    const comparison = await this.compareStores(storeIds, dateRange);
    
    let report = '# Store Comparison Report\n\n';
    report += `## Period: ${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}\n\n`;
    
    // Rankings section
    report += '## Store Rankings\n\n';
    comparison.rankings.forEach(rank => {
      report += `### ${rank.rank}. ${rank.storeName} (Score: ${rank.overallScore.toFixed(1)})\n`;
      if (rank.strengths.length > 0) {
        report += `**Strengths:** ${rank.strengths.join(', ')}\n`;
      }
      if (rank.weaknesses.length > 0) {
        report += `**Areas for Improvement:** ${rank.weaknesses.join(', ')}\n`;
      }
      report += '\n';
    });
    
    // Key Insights
    if (comparison.insights.length > 0) {
      report += '## Key Insights\n\n';
      comparison.insights.forEach(insight => {
        report += `- **${insight.type.toUpperCase()}:** ${insight.description}\n`;
        report += `  - *Recommendation:* ${insight.recommendation}\n\n`;
      });
    }
    
    // Correlations
    if (comparison.correlations.length > 0) {
      report += '## Metric Correlations\n\n';
      comparison.correlations.slice(0, 5).forEach(corr => {
        report += `- ${corr.metric1} ↔ ${corr.metric2}: ${corr.interpretation}\n`;
      });
    }
    
    return report;
  }
}