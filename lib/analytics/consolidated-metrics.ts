import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay, endOfDay, subDays, addDays, parseISO } from 'date-fns';

const logger = createLogger('consolidated-metrics');

export interface ConsolidatedKPI {
  id: string;
  name: string;
  value: number;
  unit: 'currency' | 'number' | 'percentage';
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  target?: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  breakdown: Array<{
    storeId: string;
    storeName: string;
    value: number;
    contribution: number; // percentage of total
  }>;
  context: {
    description: string;
    factors: string[];
    recommendations: string[];
  };
}

export interface MetricsDashboard {
  kpis: ConsolidatedKPI[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    activeStores: number;
    revenueGrowth: number;
    customerGrowth: number;
    operationalEfficiency: number;
  };
  alerts: Array<{
    type: 'opportunity' | 'warning' | 'critical';
    message: string;
    storeId?: string;
    storeName?: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  benchmarks: {
    industryBenchmarks: Record<string, number>;
    internalBenchmarks: Record<string, number>;
    competitiveBenchmarks: Record<string, number>;
  };
}

export interface RealTimeMetrics {
  liveRevenue: number;
  liveOrders: number;
  activeVisitors: number;
  conversionRate: number;
  topPerformingStore: {
    storeId: string;
    storeName: string;
    liveRevenue: number;
  };
  recentActivity: Array<{
    timestamp: string;
    event: 'order' | 'visitor' | 'conversion';
    storeId: string;
    storeName: string;
    value: number;
    details: string;
  }>;
  performanceIndicators: {
    serverHealth: 'healthy' | 'degraded' | 'critical';
    dataFreshness: number; // minutes since last update
    syncStatus: Record<string, 'synced' | 'syncing' | 'error'>;
  };
}

export interface CustomMetric {
  id: string;
  name: string;
  formula: string;
  parameters: Record<string, any>;
  schedule: 'realtime' | 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
  createdBy: string;
  stores: string[]; // empty means all stores
}

export class ConsolidatedMetrics {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getDashboard(
    ownerId: string,
    dateRange: { from: Date; to: Date },
    customMetrics?: CustomMetric[]
  ): Promise<MetricsDashboard> {
    const stores = await this.getStoresList(ownerId);
    const storeIds = stores.map(s => s.id);

    // Get analytics data
    const { data: snapshots, error } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    if (error) {
      logger.error('Failed to fetch analytics snapshots', error);
      throw new Error('Failed to fetch analytics data');
    }

    // Get previous period for comparison
    const daysDiff = Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24);
    const prevDateRange = {
      from: subDays(dateRange.from, daysDiff),
      to: subDays(dateRange.to, daysDiff)
    };

    const { data: prevSnapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(prevDateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(prevDateRange.to, 'yyyy-MM-dd'));

    const kpis = await this.calculateKPIs(stores, snapshots || [], prevSnapshots || []);
    const summary = this.calculateSummary(snapshots || [], prevSnapshots || []);
    const alerts = this.generateAlerts(stores, snapshots || [], kpis);
    const benchmarks = await this.getBenchmarks(ownerId);

    // Calculate custom metrics if provided
    if (customMetrics && customMetrics.length > 0) {
      const customKPIs = await this.calculateCustomMetrics(customMetrics, stores, snapshots || []);
      kpis.push(...customKPIs);
    }

    return {
      kpis,
      summary,
      alerts,
      benchmarks
    };
  }

  async getRealTimeMetrics(ownerId: string): Promise<RealTimeMetrics> {
    const stores = await this.getStoresList(ownerId);
    const storeIds = stores.map(s => s.id);

    // Get today's data
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: todaySnapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .eq('date', today);

    // Calculate live metrics (in a real system, this would come from real-time data)
    const liveRevenue = todaySnapshots?.reduce((sum, s) => sum + s.revenue, 0) || 0;
    const liveOrders = todaySnapshots?.reduce((sum, s) => sum + s.orders_count, 0) || 0;
    const activeVisitors = todaySnapshots?.reduce((sum, s) => sum + s.unique_visitors, 0) || 0;
    const conversionRate = activeVisitors > 0 ? (liveOrders / activeVisitors) * 100 : 0;

    const topPerformingStore = todaySnapshots?.reduce((top, snapshot) => {
      const store = stores.find(s => s.id === snapshot.store_id);
      if (!top || snapshot.revenue > top.liveRevenue) {
        return {
          storeId: snapshot.store_id,
          storeName: store?.shop_name || 'Unknown',
          liveRevenue: snapshot.revenue
        };
      }
      return top;
    }, null as RealTimeMetrics['topPerformingStore']) || {
      storeId: '',
      storeName: 'No data',
      liveRevenue: 0
    };

    // Generate mock recent activity (in production, this would be real-time events)
    const recentActivity = this.generateMockActivity(stores, todaySnapshots || []);

    return {
      liveRevenue,
      liveOrders,
      activeVisitors,
      conversionRate,
      topPerformingStore,
      recentActivity,
      performanceIndicators: {
        serverHealth: 'healthy',
        dataFreshness: 5, // 5 minutes
        syncStatus: stores.reduce((status, store) => {
          status[store.shop_name] = 'synced';
          return status;
        }, {} as Record<string, 'synced' | 'syncing' | 'error'>)
      }
    };
  }

  private async calculateKPIs(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[],
    prevSnapshots: any[]
  ): Promise<ConsolidatedKPI[]> {
    const currentTotals = this.aggregateSnapshots(snapshots);
    const prevTotals = this.aggregateSnapshots(prevSnapshots);

    const kpis: ConsolidatedKPI[] = [
      {
        id: 'total-revenue',
        name: 'Total Revenue',
        value: currentTotals.revenue,
        unit: 'currency',
        trend: {
          direction: this.getTrendDirection(currentTotals.revenue, prevTotals.revenue),
          percentage: this.calculateGrowthRate(currentTotals.revenue, prevTotals.revenue),
          period: 'vs previous period'
        },
        status: this.getKPIStatus(currentTotals.revenue, prevTotals.revenue, 'revenue'),
        breakdown: this.calculateStoreBreakdown('revenue', stores, snapshots, currentTotals.revenue),
        context: {
          description: 'Total revenue across all stores',
          factors: this.getRevenuFactors(currentTotals, prevTotals),
          recommendations: this.getRevenueRecommendations(currentTotals, prevTotals)
        }
      },
      {
        id: 'total-orders',
        name: 'Total Orders',
        value: currentTotals.orders,
        unit: 'number',
        trend: {
          direction: this.getTrendDirection(currentTotals.orders, prevTotals.orders),
          percentage: this.calculateGrowthRate(currentTotals.orders, prevTotals.orders),
          period: 'vs previous period'
        },
        status: this.getKPIStatus(currentTotals.orders, prevTotals.orders, 'orders'),
        breakdown: this.calculateStoreBreakdown('orders_count', stores, snapshots, currentTotals.orders),
        context: {
          description: 'Total number of orders across all stores',
          factors: this.getOrderFactors(currentTotals, prevTotals),
          recommendations: this.getOrderRecommendations(currentTotals, prevTotals)
        }
      },
      {
        id: 'avg-order-value',
        name: 'Average Order Value',
        value: currentTotals.orders > 0 ? currentTotals.revenue / currentTotals.orders : 0,
        unit: 'currency',
        trend: {
          direction: this.getAOVTrendDirection(currentTotals, prevTotals),
          percentage: this.calculateAOVGrowthRate(currentTotals, prevTotals),
          period: 'vs previous period'
        },
        status: this.getAOVStatus(currentTotals, prevTotals),
        breakdown: this.calculateAOVBreakdown(stores, snapshots),
        context: {
          description: 'Average value per order across all stores',
          factors: this.getAOVFactors(currentTotals, prevTotals),
          recommendations: this.getAOVRecommendations(currentTotals, prevTotals)
        }
      },
      {
        id: 'conversion-rate',
        name: 'Conversion Rate',
        value: currentTotals.visitors > 0 ? (currentTotals.orders / currentTotals.visitors) * 100 : 0,
        unit: 'percentage',
        trend: {
          direction: this.getConversionTrendDirection(currentTotals, prevTotals),
          percentage: this.calculateConversionGrowthRate(currentTotals, prevTotals),
          period: 'vs previous period'
        },
        status: this.getConversionStatus(currentTotals, prevTotals),
        breakdown: this.calculateConversionBreakdown(stores, snapshots),
        context: {
          description: 'Percentage of visitors who make a purchase',
          factors: this.getConversionFactors(currentTotals, prevTotals),
          recommendations: this.getConversionRecommendations(currentTotals, prevTotals)
        }
      },
      {
        id: 'customer-satisfaction',
        name: 'Customer Satisfaction',
        value: 85, // Mock value - would come from reviews/surveys
        unit: 'percentage',
        trend: {
          direction: 'up',
          percentage: 2.5,
          period: 'vs previous period'
        },
        status: 'good',
        breakdown: stores.map(store => ({
          storeId: store.id,
          storeName: store.shop_name,
          value: 80 + Math.random() * 20,
          contribution: 100 / stores.length
        })),
        context: {
          description: 'Overall customer satisfaction across all touchpoints',
          factors: ['Product quality', 'Customer service', 'Delivery experience'],
          recommendations: ['Focus on delivery optimization', 'Improve customer support response times']
        }
      }
    ];

    return kpis;
  }

  private calculateSummary(snapshots: any[], prevSnapshots: any[]) {
    const current = this.aggregateSnapshots(snapshots);
    const prev = this.aggregateSnapshots(prevSnapshots);

    return {
      totalRevenue: current.revenue,
      totalOrders: current.orders,
      totalCustomers: current.visitors, // Simplified - would need unique customer tracking
      activeStores: new Set(snapshots.map(s => s.store_id)).size,
      revenueGrowth: this.calculateGrowthRate(current.revenue, prev.revenue),
      customerGrowth: this.calculateGrowthRate(current.visitors, prev.visitors),
      operationalEfficiency: this.calculateOperationalEfficiency(current, prev)
    };
  }

  private generateAlerts(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[],
    kpis: ConsolidatedKPI[]
  ) {
    const alerts: MetricsDashboard['alerts'] = [];

    // Revenue alerts
    const revenueKPI = kpis.find(k => k.id === 'total-revenue');
    if (revenueKPI && revenueKPI.trend.direction === 'down' && Math.abs(revenueKPI.trend.percentage) > 10) {
      alerts.push({
        type: 'warning',
        message: `Revenue declined by ${Math.abs(revenueKPI.trend.percentage).toFixed(1)}%`,
        action: 'Review underperforming stores and implement recovery strategies',
        priority: 'high'
      });
    }

    // Conversion rate alerts
    const conversionKPI = kpis.find(k => k.id === 'conversion-rate');
    if (conversionKPI && conversionKPI.value < 2) {
      alerts.push({
        type: 'warning',
        message: `Low conversion rate: ${conversionKPI.value.toFixed(2)}%`,
        action: 'Optimize product pages and checkout process',
        priority: 'medium'
      });
    }

    // Store-specific alerts
    stores.forEach(store => {
      const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
      const storeRevenue = storeSnapshots.reduce((sum, s) => sum + s.revenue, 0);
      
      if (storeRevenue === 0 && storeSnapshots.length > 0) {
        alerts.push({
          type: 'critical',
          message: 'No revenue generated',
          storeId: store.id,
          storeName: store.shop_name,
          action: 'Investigate store configuration and product availability',
          priority: 'high'
        });
      }
    });

    // Opportunity alerts
    const avgOrderValueKPI = kpis.find(k => k.id === 'avg-order-value');
    if (avgOrderValueKPI && avgOrderValueKPI.trend.direction === 'up' && avgOrderValueKPI.trend.percentage > 15) {
      alerts.push({
        type: 'opportunity',
        message: `AOV increased by ${avgOrderValueKPI.trend.percentage.toFixed(1)}%`,
        action: 'Capitalize on this trend with targeted upselling campaigns',
        priority: 'medium'
      });
    }

    return alerts;
  }

  private async getBenchmarks(ownerId: string) {
    // In a real implementation, these would come from industry data and competitive analysis
    return {
      industryBenchmarks: {
        conversionRate: 2.86,
        avgOrderValue: 75,
        cartAbandonmentRate: 69.8,
        customerLifetimeValue: 168
      },
      internalBenchmarks: {
        bestMonthRevenue: 0, // Would calculate from historical data
        bestConversionRate: 0,
        targetGrowthRate: 15
      },
      competitiveBenchmarks: {
        marketShareGrowth: 8.5,
        priceCompetitiveness: 92,
        customerSatisfaction: 88
      }
    };
  }

  private async calculateCustomMetrics(
    customMetrics: CustomMetric[],
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[]
  ): Promise<ConsolidatedKPI[]> {
    const customKPIs: ConsolidatedKPI[] = [];

    for (const metric of customMetrics) {
      if (!metric.enabled) continue;

      try {
        const value = await this.evaluateCustomFormula(metric.formula, metric.parameters, snapshots, stores);
        
        customKPIs.push({
          id: `custom-${metric.id}`,
          name: metric.name,
          value,
          unit: 'number',
          trend: {
            direction: 'stable',
            percentage: 0,
            period: 'custom metric'
          },
          status: 'good',
          breakdown: [],
          context: {
            description: `Custom metric: ${metric.name}`,
            factors: ['Custom calculation'],
            recommendations: ['Review custom metric parameters']
          }
        });
      } catch (error) {
        logger.error(`Failed to calculate custom metric ${metric.name}`, error);
      }
    }

    return customKPIs;
  }

  private async evaluateCustomFormula(
    formula: string,
    parameters: Record<string, any>,
    snapshots: any[],
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>
  ): Promise<number> {
    // Simple formula evaluation - in production, use a proper expression parser
    const totals = this.aggregateSnapshots(snapshots);
    
    const context = {
      revenue: totals.revenue,
      orders: totals.orders,
      visitors: totals.visitors,
      stores: stores.length,
      ...parameters
    };

    // Basic formula evaluation (unsafe in production - use proper parser)
    try {
      // Replace variables in formula
      let evaluatedFormula = formula;
      Object.entries(context).forEach(([key, value]) => {
        evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
      });

      // Basic math operations only
      if (/^[\d\s+\-*/().]+$/.test(evaluatedFormula)) {
        return eval(evaluatedFormula);
      }
    } catch (error) {
      logger.error('Failed to evaluate custom formula', error);
    }

    return 0;
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

  private aggregateSnapshots(snapshots: any[]) {
    return snapshots.reduce(
      (acc, snapshot) => ({
        revenue: acc.revenue + snapshot.revenue,
        orders: acc.orders + snapshot.orders_count,
        visitors: acc.visitors + snapshot.unique_visitors,
        pageViews: acc.pageViews + snapshot.page_views
      }),
      { revenue: 0, orders: 0, visitors: 0, pageViews: 0 }
    );
  }

  private getTrendDirection(current: number, previous: number): 'up' | 'down' | 'stable' {
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 1) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getKPIStatus(current: number, previous: number, type: string): ConsolidatedKPI['status'] {
    const growth = this.calculateGrowthRate(current, previous);
    
    if (growth > 15) return 'excellent';
    if (growth > 5) return 'good';
    if (growth > -5) return 'warning';
    return 'critical';
  }

  private calculateStoreBreakdown(
    field: string,
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[],
    total: number
  ) {
    return stores.map(store => {
      const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
      const storeValue = storeSnapshots.reduce((sum, s) => sum + s[field], 0);
      
      return {
        storeId: store.id,
        storeName: store.shop_name,
        value: storeValue,
        contribution: total > 0 ? (storeValue / total) * 100 : 0
      };
    });
  }

  private generateMockActivity(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[]
  ) {
    const activities = [];
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      const store = stores[Math.floor(Math.random() * stores.length)];
      const events = ['order', 'visitor', 'conversion'] as const;
      const event = events[Math.floor(Math.random() * events.length)];
      
      activities.push({
        timestamp: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
        event,
        storeId: store.id,
        storeName: store.shop_name,
        value: Math.random() * 100,
        details: this.generateEventDetails(event, store.shop_name)
      });
    }

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private generateEventDetails(event: string, storeName: string): string {
    switch (event) {
      case 'order':
        return `New order placed on ${storeName}`;
      case 'visitor':
        return `New visitor on ${storeName}`;
      case 'conversion':
        return `Conversion completed on ${storeName}`;
      default:
        return `Activity on ${storeName}`;
    }
  }

  // Additional helper methods for specific KPI calculations
  private getAOVTrendDirection(current: any, prev: any): 'up' | 'down' | 'stable' {
    const currentAOV = current.orders > 0 ? current.revenue / current.orders : 0;
    const prevAOV = prev.orders > 0 ? prev.revenue / prev.orders : 0;
    return this.getTrendDirection(currentAOV, prevAOV);
  }

  private calculateAOVGrowthRate(current: any, prev: any): number {
    const currentAOV = current.orders > 0 ? current.revenue / current.orders : 0;
    const prevAOV = prev.orders > 0 ? prev.revenue / prev.orders : 0;
    return this.calculateGrowthRate(currentAOV, prevAOV);
  }

  private getAOVStatus(current: any, prev: any): ConsolidatedKPI['status'] {
    const currentAOV = current.orders > 0 ? current.revenue / current.orders : 0;
    const prevAOV = prev.orders > 0 ? prev.revenue / prev.orders : 0;
    return this.getKPIStatus(currentAOV, prevAOV, 'aov');
  }

  private calculateAOVBreakdown(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[]
  ) {
    return stores.map(store => {
      const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
      const storeRevenue = storeSnapshots.reduce((sum, s) => sum + s.revenue, 0);
      const storeOrders = storeSnapshots.reduce((sum, s) => sum + s.orders_count, 0);
      const aov = storeOrders > 0 ? storeRevenue / storeOrders : 0;
      
      return {
        storeId: store.id,
        storeName: store.shop_name,
        value: aov,
        contribution: 100 / stores.length // Equal weight for AOV
      };
    });
  }

  private getConversionTrendDirection(current: any, prev: any): 'up' | 'down' | 'stable' {
    const currentConversion = current.visitors > 0 ? (current.orders / current.visitors) * 100 : 0;
    const prevConversion = prev.visitors > 0 ? (prev.orders / prev.visitors) * 100 : 0;
    return this.getTrendDirection(currentConversion, prevConversion);
  }

  private calculateConversionGrowthRate(current: any, prev: any): number {
    const currentConversion = current.visitors > 0 ? (current.orders / current.visitors) * 100 : 0;
    const prevConversion = prev.visitors > 0 ? (prev.orders / prev.visitors) * 100 : 0;
    return this.calculateGrowthRate(currentConversion, prevConversion);
  }

  private getConversionStatus(current: any, prev: any): ConsolidatedKPI['status'] {
    const currentConversion = current.visitors > 0 ? (current.orders / current.visitors) * 100 : 0;
    const prevConversion = prev.visitors > 0 ? (prev.orders / prev.visitors) * 100 : 0;
    return this.getKPIStatus(currentConversion, prevConversion, 'conversion');
  }

  private calculateConversionBreakdown(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[]
  ) {
    return stores.map(store => {
      const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
      const storeOrders = storeSnapshots.reduce((sum, s) => sum + s.orders_count, 0);
      const storeVisitors = storeSnapshots.reduce((sum, s) => sum + s.unique_visitors, 0);
      const conversion = storeVisitors > 0 ? (storeOrders / storeVisitors) * 100 : 0;
      
      return {
        storeId: store.id,
        storeName: store.shop_name,
        value: conversion,
        contribution: 100 / stores.length
      };
    });
  }

  private calculateOperationalEfficiency(current: any, prev: any): number {
    // Simple efficiency calculation based on revenue per visitor
    const currentEfficiency = current.visitors > 0 ? current.revenue / current.visitors : 0;
    const prevEfficiency = prev.visitors > 0 ? prev.revenue / prev.visitors : 0;
    
    if (prevEfficiency === 0) return currentEfficiency > 0 ? 100 : 50;
    
    const efficiency = (currentEfficiency / prevEfficiency) * 100;
    return Math.min(100, Math.max(0, efficiency));
  }

  // Context and recommendation methods
  private getRevenuFactors(current: any, prev: any): string[] {
    const factors = [];
    
    if (current.orders > prev.orders) factors.push('Increased order volume');
    if (current.revenue / current.orders > prev.revenue / prev.orders) factors.push('Higher average order value');
    if (current.visitors > prev.visitors) factors.push('Increased traffic');
    
    return factors.length > 0 ? factors : ['Market conditions', 'Seasonal trends'];
  }

  private getRevenueRecommendations(current: any, prev: any): string[] {
    const recommendations = [];
    
    if (current.revenue < prev.revenue) {
      recommendations.push('Review marketing campaigns and traffic sources');
      recommendations.push('Analyze conversion funnel for bottlenecks');
    } else {
      recommendations.push('Maintain successful strategies');
      recommendations.push('Scale winning campaigns');
    }
    
    return recommendations;
  }

  private getOrderFactors(current: any, prev: any): string[] {
    return ['Customer acquisition', 'Product appeal', 'Marketing effectiveness'];
  }

  private getOrderRecommendations(current: any, prev: any): string[] {
    return ['Optimize product listings', 'Improve customer experience', 'Enhance marketing reach'];
  }

  private getAOVFactors(current: any, prev: any): string[] {
    return ['Product pricing', 'Upselling effectiveness', 'Customer behavior'];
  }

  private getAOVRecommendations(current: any, prev: any): string[] {
    return ['Implement cross-selling', 'Review pricing strategy', 'Create product bundles'];
  }

  private getConversionFactors(current: any, prev: any): string[] {
    return ['Website performance', 'Product appeal', 'Checkout process'];
  }

  private getConversionRecommendations(current: any, prev: any): string[] {
    return ['Optimize landing pages', 'Simplify checkout', 'A/B test product pages'];
  }
}