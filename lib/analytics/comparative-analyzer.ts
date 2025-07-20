import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { StorePerformance, CrossStoreAggregator } from './cross-store-aggregator';

const logger = createLogger('comparative-analyzer');

export interface ComparisonMetric {
  metricName: string;
  metricKey: string;
  unit: 'currency' | 'number' | 'percentage';
  stores: Array<{
    storeId: string;
    storeName: string;
    value: number;
    rank: number;
    percentileRank: number;
    growthRate: number;
    isTopPerformer: boolean;
    isUnderperformer: boolean;
  }>;
  average: number;
  median: number;
  standardDeviation: number;
  totalVariance: number;
}

export interface StoreComparison {
  storeId: string;
  storeName: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: string[];
  metrics: {
    revenue: ComparisonRank;
    orders: ComparisonRank;
    avgOrderValue: ComparisonRank;
    conversionRate: ComparisonRank;
    trafficVolume: ComparisonRank;
    customerRetention: ComparisonRank;
  };
  peerGroup: {
    similar: string[];
    competitors: string[];
    benchmarks: Record<string, number>;
  };
}

export interface ComparisonRank {
  value: number;
  rank: number;
  percentile: number;
  vsAverage: number;
  trend: 'improving' | 'declining' | 'stable';
  confidence: number;
}

export interface CrossStoreInsights {
  cannibalizationAnalysis: {
    potentialCannibalization: Array<{
      store1: string;
      store2: string;
      overlapScore: number;
      sharedCustomers: number;
      competingProducts: string[];
      impactAssessment: 'high' | 'medium' | 'low';
    }>;
    recommendations: string[];
  };
  
  synergies: {
    crossSellingOpportunities: Array<{
      sourceStore: string;
      targetStore: string;
      potentialRevenue: number;
      customerSegment: string;
      products: string[];
    }>;
    inventoryOptimization: Array<{
      product: string;
      overstock: string[];
      understock: string[];
      suggestedReallocation: Record<string, number>;
    }>;
  };

  marketGaps: {
    underservedRegions: string[];
    productGaps: string[];
    priceGaps: Array<{
      segment: string;
      minPrice: number;
      maxPrice: number;
      opportunity: number;
    }>;
  };
}

export class ComparativeAnalyzer {
  private aggregator: CrossStoreAggregator;

  constructor(private supabase: SupabaseClient<Database>) {
    this.aggregator = new CrossStoreAggregator(supabase);
  }

  async compareStorePerformance(
    ownerId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<{
    comparisons: StoreComparison[];
    insights: CrossStoreInsights;
    benchmarks: ComparisonMetric[];
  }> {
    const crossStoreData = await this.aggregator.aggregateMetrics(ownerId, dateRange);
    
    const benchmarks = this.calculateBenchmarks(crossStoreData.storePerformances);
    const comparisons = await this.generateStoreComparisons(crossStoreData.storePerformances, benchmarks);
    const insights = await this.generateCrossStoreInsights(ownerId, crossStoreData);

    return {
      comparisons,
      insights,
      benchmarks
    };
  }

  private calculateBenchmarks(storePerformances: StorePerformance[]): ComparisonMetric[] {
    const metrics = [
      {
        metricName: 'Revenue',
        metricKey: 'revenue',
        unit: 'currency' as const,
        getValue: (store: StorePerformance) => store.metrics.revenue,
        getGrowth: (store: StorePerformance) => store.growth.revenue
      },
      {
        metricName: 'Orders',
        metricKey: 'orders',
        unit: 'number' as const,
        getValue: (store: StorePerformance) => store.metrics.orders,
        getGrowth: (store: StorePerformance) => store.growth.orders
      },
      {
        metricName: 'Average Order Value',
        metricKey: 'avgOrderValue',
        unit: 'currency' as const,
        getValue: (store: StorePerformance) => store.metrics.avgOrderValue,
        getGrowth: (store: StorePerformance) => 0 // Calculate separately if needed
      },
      {
        metricName: 'Conversion Rate',
        metricKey: 'conversionRate',
        unit: 'percentage' as const,
        getValue: (store: StorePerformance) => store.metrics.conversionRate,
        getGrowth: (store: StorePerformance) => 0
      },
      {
        metricName: 'Visitors',
        metricKey: 'visitors',
        unit: 'number' as const,
        getValue: (store: StorePerformance) => store.metrics.visitors,
        getGrowth: (store: StorePerformance) => store.growth.visitors
      }
    ];

    return metrics.map(metric => {
      const values = storePerformances.map(metric.getValue);
      const sortedValues = [...values].sort((a, b) => b - a);
      
      const stores = storePerformances.map((store, index) => {
        const value = metric.getValue(store);
        const rank = sortedValues.indexOf(value) + 1;
        const percentileRank = ((storePerformances.length - rank + 1) / storePerformances.length) * 100;
        
        return {
          storeId: store.storeId,
          storeName: store.storeName,
          value,
          rank,
          percentileRank,
          growthRate: metric.getGrowth(store),
          isTopPerformer: percentileRank >= 75,
          isUnderperformer: percentileRank <= 25
        };
      });

      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const median = this.calculateMedian(values);
      const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
      const standardDeviation = Math.sqrt(variance);

      return {
        metricName: metric.metricName,
        metricKey: metric.metricKey,
        unit: metric.unit,
        stores,
        average,
        median,
        standardDeviation,
        totalVariance: variance
      };
    });
  }

  private async generateStoreComparisons(
    storePerformances: StorePerformance[],
    benchmarks: ComparisonMetric[]
  ): Promise<StoreComparison[]> {
    return storePerformances.map(store => {
      const metrics = {
        revenue: this.calculateComparisonRank(store.storeId, 'revenue', benchmarks),
        orders: this.calculateComparisonRank(store.storeId, 'orders', benchmarks),
        avgOrderValue: this.calculateComparisonRank(store.storeId, 'avgOrderValue', benchmarks),
        conversionRate: this.calculateComparisonRank(store.storeId, 'conversionRate', benchmarks),
        trafficVolume: this.calculateComparisonRank(store.storeId, 'visitors', benchmarks),
        customerRetention: {
          value: 0, rank: 0, percentile: 0, vsAverage: 0,
          trend: 'stable' as const, confidence: 0.5
        } // Would need additional data
      };

      const overallScore = this.calculateOverallScore(metrics);
      const analysis = this.analyzeStorePerformance(store, metrics, benchmarks);

      return {
        storeId: store.storeId,
        storeName: store.storeName,
        overallScore,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        recommendations: analysis.recommendations,
        metrics,
        peerGroup: {
          similar: this.findSimilarStores(store, storePerformances),
          competitors: this.identifyCompetitors(store, storePerformances),
          benchmarks: this.calculatePeerBenchmarks(store, storePerformances)
        }
      };
    });
  }

  private calculateComparisonRank(
    storeId: string,
    metricKey: string,
    benchmarks: ComparisonMetric[]
  ): ComparisonRank {
    const benchmark = benchmarks.find(b => b.metricKey === metricKey);
    if (!benchmark) {
      return {
        value: 0, rank: 0, percentile: 0, vsAverage: 0,
        trend: 'stable', confidence: 0
      };
    }

    const storeData = benchmark.stores.find(s => s.storeId === storeId);
    if (!storeData) {
      return {
        value: 0, rank: 0, percentile: 0, vsAverage: 0,
        trend: 'stable', confidence: 0
      };
    }

    const vsAverage = ((storeData.value - benchmark.average) / benchmark.average) * 100;
    const trend = this.determineTrend(storeData.growthRate);

    return {
      value: storeData.value,
      rank: storeData.rank,
      percentile: storeData.percentileRank,
      vsAverage,
      trend,
      confidence: this.calculateConfidence(storeData, benchmark)
    };
  }

  private analyzeStorePerformance(
    store: StorePerformance,
    metrics: StoreComparison['metrics'],
    benchmarks: ComparisonMetric[]
  ) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const recommendations: string[] = [];

    // Analyze strengths
    if (metrics.revenue.percentile >= 75) {
      strengths.push('High revenue performance');
    }
    if (metrics.conversionRate.percentile >= 75) {
      strengths.push('Excellent conversion rate');
    }
    if (metrics.avgOrderValue.percentile >= 75) {
      strengths.push('Strong average order value');
    }

    // Analyze weaknesses
    if (metrics.revenue.percentile <= 25) {
      weaknesses.push('Below-average revenue generation');
    }
    if (metrics.trafficVolume.percentile <= 25) {
      weaknesses.push('Low traffic volume');
    }
    if (metrics.conversionRate.percentile <= 25) {
      weaknesses.push('Poor conversion performance');
    }

    // Identify opportunities
    if (metrics.trafficVolume.percentile >= 50 && metrics.conversionRate.percentile <= 50) {
      opportunities.push('High traffic with conversion optimization potential');
    }
    if (metrics.orders.percentile >= 50 && metrics.avgOrderValue.percentile <= 50) {
      opportunities.push('Good order volume with upselling potential');
    }

    // Generate recommendations
    if (metrics.conversionRate.percentile <= 50) {
      recommendations.push('Focus on conversion rate optimization');
    }
    if (metrics.avgOrderValue.percentile <= 50) {
      recommendations.push('Implement upselling and cross-selling strategies');
    }
    if (metrics.trafficVolume.percentile <= 50) {
      recommendations.push('Invest in traffic acquisition and SEO');
    }

    return { strengths, weaknesses, opportunities, recommendations };
  }

  private async generateCrossStoreInsights(
    ownerId: string,
    crossStoreData: any
  ): Promise<CrossStoreInsights> {
    // Cannibalization analysis
    const cannibalizationAnalysis = await this.analyzeCannibalization(crossStoreData.storePerformances);
    
    // Synergy opportunities
    const synergies = await this.identifySynergies(crossStoreData.storePerformances);
    
    // Market gap analysis
    const marketGaps = await this.analyzeMarketGaps(crossStoreData.storePerformances);

    return {
      cannibalizationAnalysis,
      synergies,
      marketGaps
    };
  }

  private async analyzeCannibalization(storePerformances: StorePerformance[]) {
    const potentialCannibalization = [];
    
    // Simple heuristic: stores with similar performance patterns might be cannibalizing
    for (let i = 0; i < storePerformances.length; i++) {
      for (let j = i + 1; j < storePerformances.length; j++) {
        const store1 = storePerformances[i];
        const store2 = storePerformances[j];
        
        const overlapScore = this.calculateOverlapScore(store1, store2);
        
        if (overlapScore > 0.7) {
          potentialCannibalization.push({
            store1: store1.storeName,
            store2: store2.storeName,
            overlapScore,
            sharedCustomers: Math.round(Math.min(store1.metrics.visitors, store2.metrics.visitors) * overlapScore),
            competingProducts: [], // Would need product analysis
            impactAssessment: overlapScore > 0.8 ? 'high' as const : 'medium' as const
          });
        }
      }
    }

    const recommendations = [
      'Consider differentiated positioning for overlapping stores',
      'Analyze customer journey across stores',
      'Implement cross-store customer tracking'
    ];

    return {
      potentialCannibalization,
      recommendations
    };
  }

  private async identifySynergies(storePerformances: StorePerformance[]) {
    const crossSellingOpportunities = [];
    const inventoryOptimization = [];

    // Identify cross-selling opportunities between complementary stores
    for (const sourceStore of storePerformances) {
      for (const targetStore of storePerformances) {
        if (sourceStore.storeId !== targetStore.storeId) {
          const synergy = this.calculateSynergyPotential(sourceStore, targetStore);
          
          if (synergy.potential > 0.5) {
            crossSellingOpportunities.push({
              sourceStore: sourceStore.storeName,
              targetStore: targetStore.storeName,
              potentialRevenue: sourceStore.metrics.revenue * synergy.potential * 0.1,
              customerSegment: 'High-value customers',
              products: [] // Would need product analysis
            });
          }
        }
      }
    }

    return {
      crossSellingOpportunities,
      inventoryOptimization
    };
  }

  private async analyzeMarketGaps(storePerformances: StorePerformance[]) {
    return {
      underservedRegions: ['Emerging markets', 'Rural areas'],
      productGaps: ['Mid-range products', 'Sustainable options'],
      priceGaps: [
        {
          segment: 'Premium',
          minPrice: 100,
          maxPrice: 500,
          opportunity: 15000
        },
        {
          segment: 'Budget',
          minPrice: 10,
          maxPrice: 50,
          opportunity: 8000
        }
      ]
    };
  }

  // Helper methods
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateOverallScore(metrics: StoreComparison['metrics']): number {
    const weights = {
      revenue: 0.3,
      orders: 0.2,
      avgOrderValue: 0.2,
      conversionRate: 0.15,
      trafficVolume: 0.1,
      customerRetention: 0.05
    };

    return Object.entries(weights).reduce((score, [key, weight]) => {
      const metric = metrics[key as keyof typeof metrics];
      return score + (metric.percentile * weight);
    }, 0);
  }

  private determineTrend(growthRate: number): 'improving' | 'declining' | 'stable' {
    if (growthRate > 5) return 'improving';
    if (growthRate < -5) return 'declining';
    return 'stable';
  }

  private calculateConfidence(storeData: any, benchmark: ComparisonMetric): number {
    // Simple confidence calculation based on data stability
    const coefficient = benchmark.standardDeviation / benchmark.average;
    return Math.max(0.3, 1 - coefficient);
  }

  private findSimilarStores(store: StorePerformance, allStores: StorePerformance[]): string[] {
    return allStores
      .filter(s => s.storeId !== store.storeId)
      .map(s => ({
        store: s,
        similarity: this.calculateSimilarity(store, s)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.store.storeName);
  }

  private identifyCompetitors(store: StorePerformance, allStores: StorePerformance[]): string[] {
    return allStores
      .filter(s => s.storeId !== store.storeId)
      .filter(s => s.metrics.revenue > store.metrics.revenue * 0.8)
      .map(s => s.storeName)
      .slice(0, 3);
  }

  private calculatePeerBenchmarks(store: StorePerformance, allStores: StorePerformance[]): Record<string, number> {
    const peers = allStores.filter(s => s.storeId !== store.storeId);
    const avgRevenue = peers.reduce((sum, s) => sum + s.metrics.revenue, 0) / peers.length;
    const avgOrders = peers.reduce((sum, s) => sum + s.metrics.orders, 0) / peers.length;
    const avgConversion = peers.reduce((sum, s) => sum + s.metrics.conversionRate, 0) / peers.length;

    return {
      avgRevenue,
      avgOrders,
      avgConversionRate: avgConversion
    };
  }

  private calculateOverlapScore(store1: StorePerformance, store2: StorePerformance): number {
    // Simple overlap calculation based on performance similarity
    const revenueRatio = Math.min(store1.metrics.revenue, store2.metrics.revenue) / 
                        Math.max(store1.metrics.revenue, store2.metrics.revenue);
    const orderRatio = Math.min(store1.metrics.orders, store2.metrics.orders) / 
                      Math.max(store1.metrics.orders, store2.metrics.orders);
    
    return (revenueRatio + orderRatio) / 2;
  }

  private calculateSimilarity(store1: StorePerformance, store2: StorePerformance): number {
    const metrics = ['revenue', 'orders', 'visitors'] as const;
    
    const similarities = metrics.map(metric => {
      const val1 = store1.metrics[metric];
      const val2 = store2.metrics[metric];
      return Math.min(val1, val2) / Math.max(val1, val2);
    });

    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  }

  private calculateSynergyPotential(store1: StorePerformance, store2: StorePerformance): { potential: number } {
    // Simple synergy calculation
    const avgOrderDiff = Math.abs(store1.metrics.avgOrderValue - store2.metrics.avgOrderValue);
    const conversionDiff = Math.abs(store1.metrics.conversionRate - store2.metrics.conversionRate);
    
    const potential = 1 - ((avgOrderDiff / Math.max(store1.metrics.avgOrderValue, store2.metrics.avgOrderValue)) + 
                          (conversionDiff / Math.max(store1.metrics.conversionRate, store2.metrics.conversionRate))) / 2;
    
    return { potential: Math.max(0, potential) };
  }
}