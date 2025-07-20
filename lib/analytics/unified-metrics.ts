import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const logger = createLogger('unified-metrics');

export interface UnifiedKPIs {
  // Financial KPIs
  totalRevenue: number;
  revenuePerStore: number;
  revenueGrowth: number;
  grossMargin: number;
  netProfit: number;
  
  // Sales KPIs
  totalOrders: number;
  avgOrderValue: number;
  orderFrequency: number;
  repeatPurchaseRate: number;
  cartAbandonmentRate: number;
  
  // Customer KPIs
  totalCustomers: number;
  newVsReturning: {
    new: number;
    returning: number;
    ratio: number;
  };
  customerLifetimeValue: number;
  customerAcquisitionCost: number;
  customerSatisfactionScore: number;
  
  // Operational KPIs
  avgFulfillmentTime: number;
  returnRate: number;
  inventoryTurnover: number;
  stockoutRate: number;
  shippingEfficiency: number;
  
  // Marketing KPIs
  conversionRate: number;
  trafficSources: Array<{
    source: string;
    visitors: number;
    revenue: number;
    conversionRate: number;
  }>;
  emailMarketingROI: number;
  socialMediaEngagement: number;
  
  // Store Performance
  storeHealthScore: number;
  topPerformingCategories: Array<{
    category: string;
    revenue: number;
    growth: number;
  }>;
  underperformingStores: Array<{
    storeId: string;
    storeName: string;
    healthScore: number;
    issues: string[];
  }>;
}

export interface UnifiedDashboardData {
  kpis: UnifiedKPIs;
  trends: {
    revenue: Array<{ date: string; value: number; }>;
    orders: Array<{ date: string; value: number; }>;
    customers: Array<{ date: string; value: number; }>;
    conversionRate: Array<{ date: string; value: number; }>;
  };
  storeComparison: Array<{
    storeId: string;
    storeName: string;
    kpis: Partial<UnifiedKPIs>;
    performanceScore: number;
  }>;
  insights: Array<{
    type: 'opportunity' | 'warning' | 'success';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
}

export class UnifiedMetricsCalculator {
  constructor(private supabase: SupabaseClient<Database>) {}

  async calculateUnifiedKPIs(
    ownerId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<UnifiedDashboardData> {
    try {
      // Get all active stores
      const { data: stores, error: storesError } = await this.supabase
        .from('stores')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('is_active', true);

      if (storesError) throw storesError;
      if (!stores || stores.length === 0) {
        throw new Error('No active stores found');
      }

      const storeIds = stores.map(s => s.id);

      // Fetch analytics data
      const [currentData, previousData, customerData, inventoryData] = await Promise.all([
        this.fetchAnalyticsData(storeIds, dateRange),
        this.fetchAnalyticsData(storeIds, this.getPreviousPeriod(dateRange)),
        this.fetchCustomerData(storeIds, dateRange),
        this.fetchInventoryData(storeIds)
      ]);

      // Calculate KPIs
      const kpis = this.calculateKPIs(currentData, previousData, customerData, inventoryData);
      
      // Generate trends
      const trends = await this.generateTrends(storeIds, dateRange);
      
      // Store comparison
      const storeComparison = await this.generateStoreComparison(stores, dateRange);
      
      // Generate insights
      const insights = this.generateInsights(kpis, storeComparison);

      return {
        kpis,
        trends,
        storeComparison,
        insights
      };
    } catch (error) {
      logger.error('Failed to calculate unified KPIs', error);
      throw error;
    }
  }

  private async fetchAnalyticsData(storeIds: string[], dateRange: { from: Date; to: Date }) {
    const { data, error } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

    if (error) throw error;
    return data || [];
  }

  private async fetchCustomerData(storeIds: string[], dateRange: { from: Date; to: Date }) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*, orders(id, total_price)')
      .in('store_id', storeIds)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (error) throw error;
    return data || [];
  }

  private async fetchInventoryData(storeIds: string[]) {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, variants(inventory_quantity, inventory_policy)')
      .in('store_id', storeIds)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  }

  private calculateKPIs(
    currentData: any[],
    previousData: any[],
    customerData: any[],
    inventoryData: any[]
  ): UnifiedKPIs {
    // Financial calculations
    const totalRevenue = currentData.reduce((sum, d) => sum + d.revenue, 0);
    const previousRevenue = previousData.reduce((sum, d) => sum + d.revenue, 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    
    // Sales calculations
    const totalOrders = currentData.reduce((sum, d) => sum + d.orders_count, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Customer calculations
    const totalCustomers = new Set(customerData.map(c => c.email)).size;
    const returningCustomers = customerData.filter(c => c.orders.length > 1).length;
    const newCustomers = totalCustomers - returningCustomers;
    const repeatPurchaseRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
    
    // Calculate CLV (simplified)
    const avgOrdersPerCustomer = customerData.reduce((sum, c) => sum + c.orders.length, 0) / totalCustomers;
    const customerLifetimeValue = avgOrderValue * avgOrdersPerCustomer;
    
    // Operational calculations
    const totalVisitors = currentData.reduce((sum, d) => sum + d.unique_visitors, 0);
    const conversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors) * 100 : 0;
    
    // Inventory calculations
    const totalProducts = inventoryData.length;
    const outOfStockProducts = inventoryData.filter(p => 
      p.variants.every((v: any) => v.inventory_quantity === 0)
    ).length;
    const stockoutRate = totalProducts > 0 ? (outOfStockProducts / totalProducts) * 100 : 0;
    
    // Traffic sources aggregation
    const trafficSources = this.aggregateTrafficSources(currentData);
    
    // Store health calculation
    const storeHealthScore = this.calculateHealthScore({
      conversionRate,
      revenueGrowth,
      repeatPurchaseRate,
      stockoutRate
    });

    return {
      // Financial KPIs
      totalRevenue,
      revenuePerStore: totalRevenue / currentData.length,
      revenueGrowth,
      grossMargin: 65, // Placeholder - would calculate from actual cost data
      netProfit: totalRevenue * 0.2, // Placeholder
      
      // Sales KPIs
      totalOrders,
      avgOrderValue,
      orderFrequency: avgOrdersPerCustomer,
      repeatPurchaseRate,
      cartAbandonmentRate: 30, // Placeholder
      
      // Customer KPIs
      totalCustomers,
      newVsReturning: {
        new: newCustomers,
        returning: returningCustomers,
        ratio: newCustomers / returningCustomers
      },
      customerLifetimeValue,
      customerAcquisitionCost: 25, // Placeholder
      customerSatisfactionScore: 4.5, // Placeholder
      
      // Operational KPIs
      avgFulfillmentTime: 2.5, // Placeholder (days)
      returnRate: 5, // Placeholder
      inventoryTurnover: 12, // Placeholder
      stockoutRate,
      shippingEfficiency: 95, // Placeholder
      
      // Marketing KPIs
      conversionRate,
      trafficSources,
      emailMarketingROI: 42, // Placeholder
      socialMediaEngagement: 3.5, // Placeholder
      
      // Store Performance
      storeHealthScore,
      topPerformingCategories: [], // Would need category data
      underperformingStores: [] // Calculated in store comparison
    };
  }

  private aggregateTrafficSources(data: any[]): UnifiedKPIs['trafficSources'] {
    const sourceMap = new Map<string, { visitors: number; revenue: number; orders: number }>();
    
    data.forEach(snapshot => {
      const sources = snapshot.traffic_sources || [];
      sources.forEach((source: any) => {
        const existing = sourceMap.get(source.source) || { visitors: 0, revenue: 0, orders: 0 };
        existing.visitors += source.visitors || 0;
        existing.revenue += source.revenue || 0;
        existing.orders += source.orders || 0;
        sourceMap.set(source.source, existing);
      });
    });

    return Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      visitors: data.visitors,
      revenue: data.revenue,
      conversionRate: data.visitors > 0 ? (data.orders / data.visitors) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }

  private calculateHealthScore(metrics: {
    conversionRate: number;
    revenueGrowth: number;
    repeatPurchaseRate: number;
    stockoutRate: number;
  }): number {
    // Weighted scoring system
    const weights = {
      conversionRate: 0.3,
      revenueGrowth: 0.3,
      repeatPurchaseRate: 0.25,
      stockoutRate: 0.15
    };

    // Normalize metrics to 0-100 scale
    const normalized = {
      conversionRate: Math.min(metrics.conversionRate * 20, 100), // 5% = 100
      revenueGrowth: Math.min(Math.max(metrics.revenueGrowth + 50, 0), 100), // -50% to 50% mapped to 0-100
      repeatPurchaseRate: Math.min(metrics.repeatPurchaseRate * 2, 100), // 50% = 100
      stockoutRate: Math.max(100 - metrics.stockoutRate * 5, 0) // 20% = 0
    };

    return Object.entries(weights).reduce((score, [metric, weight]) => {
      return score + (normalized[metric as keyof typeof normalized] * weight);
    }, 0);
  }

  private async generateTrends(storeIds: string[], dateRange: { from: Date; to: Date }) {
    const { data } = await this.supabase
      .from('analytics_snapshots')
      .select('date, revenue, orders_count, unique_visitors')
      .in('store_id', storeIds)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('date');

    const groupedByDate = (data || []).reduce((acc, snapshot) => {
      if (!acc[snapshot.date]) {
        acc[snapshot.date] = {
          revenue: 0,
          orders: 0,
          visitors: 0
        };
      }
      acc[snapshot.date].revenue += snapshot.revenue;
      acc[snapshot.date].orders += snapshot.orders_count;
      acc[snapshot.date].visitors += snapshot.unique_visitors;
      return acc;
    }, {} as Record<string, { revenue: number; orders: number; visitors: number }>);

    const dates = Object.keys(groupedByDate).sort();

    return {
      revenue: dates.map(date => ({ date, value: groupedByDate[date].revenue })),
      orders: dates.map(date => ({ date, value: groupedByDate[date].orders })),
      customers: dates.map(date => ({ date, value: groupedByDate[date].visitors })),
      conversionRate: dates.map(date => ({
        date,
        value: groupedByDate[date].visitors > 0
          ? (groupedByDate[date].orders / groupedByDate[date].visitors) * 100
          : 0
      }))
    };
  }

  private async generateStoreComparison(stores: any[], dateRange: { from: Date; to: Date }) {
    const comparisons = await Promise.all(stores.map(async store => {
      const { data } = await this.supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('store_id', store.id)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

      const storeData = data || [];
      const revenue = storeData.reduce((sum, d) => sum + d.revenue, 0);
      const orders = storeData.reduce((sum, d) => sum + d.orders_count, 0);
      const visitors = storeData.reduce((sum, d) => sum + d.unique_visitors, 0);

      const kpis: Partial<UnifiedKPIs> = {
        totalRevenue: revenue,
        totalOrders: orders,
        avgOrderValue: orders > 0 ? revenue / orders : 0,
        conversionRate: visitors > 0 ? (orders / visitors) * 100 : 0
      };

      const performanceScore = this.calculateHealthScore({
        conversionRate: kpis.conversionRate || 0,
        revenueGrowth: 0, // Would need previous period data
        repeatPurchaseRate: 30, // Placeholder
        stockoutRate: 5 // Placeholder
      });

      return {
        storeId: store.id,
        storeName: store.shop_name,
        kpis,
        performanceScore
      };
    }));

    return comparisons.sort((a, b) => b.performanceScore - a.performanceScore);
  }

  private generateInsights(kpis: UnifiedKPIs, storeComparison: any[]): UnifiedDashboardData['insights'] {
    const insights: UnifiedDashboardData['insights'] = [];

    // Revenue insights
    if (kpis.revenueGrowth > 20) {
      insights.push({
        type: 'success',
        title: 'Strong Revenue Growth',
        description: `Revenue has grown by ${kpis.revenueGrowth.toFixed(1)}% compared to the previous period.`,
        impact: 'high',
        actionItems: [
          'Analyze top-performing products and categories',
          'Consider increasing inventory for high-demand items',
          'Replicate successful strategies across other stores'
        ]
      });
    } else if (kpis.revenueGrowth < -10) {
      insights.push({
        type: 'warning',
        title: 'Revenue Decline Detected',
        description: `Revenue has decreased by ${Math.abs(kpis.revenueGrowth).toFixed(1)}% compared to the previous period.`,
        impact: 'high',
        actionItems: [
          'Review pricing strategies',
          'Analyze competitor activities',
          'Increase marketing efforts',
          'Check for seasonal factors'
        ]
      });
    }

    // Conversion rate insights
    if (kpis.conversionRate < 2) {
      insights.push({
        type: 'warning',
        title: 'Low Conversion Rate',
        description: `Current conversion rate of ${kpis.conversionRate.toFixed(2)}% is below industry average.`,
        impact: 'high',
        actionItems: [
          'Optimize product pages and descriptions',
          'Improve site speed and user experience',
          'Review checkout process for friction points',
          'Implement A/B testing for key pages'
        ]
      });
    }

    // Stock insights
    if (kpis.stockoutRate > 10) {
      insights.push({
        type: 'warning',
        title: 'High Stockout Rate',
        description: `${kpis.stockoutRate.toFixed(1)}% of products are out of stock, potentially causing lost sales.`,
        impact: 'medium',
        actionItems: [
          'Review inventory management processes',
          'Set up automatic reorder points',
          'Analyze demand forecasting accuracy',
          'Consider safety stock levels'
        ]
      });
    }

    // Customer insights
    if (kpis.repeatPurchaseRate > 40) {
      insights.push({
        type: 'success',
        title: 'Excellent Customer Retention',
        description: `${kpis.repeatPurchaseRate.toFixed(1)}% of customers are making repeat purchases.`,
        impact: 'high',
        actionItems: [
          'Launch a loyalty program to further increase retention',
          'Collect customer feedback to maintain satisfaction',
          'Create personalized marketing campaigns'
        ]
      });
    }

    // Store performance insights
    const underperformingStores = storeComparison.filter(s => s.performanceScore < 50);
    if (underperformingStores.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Store Performance Optimization Opportunity',
        description: `${underperformingStores.length} store(s) are underperforming and could benefit from optimization.`,
        impact: 'medium',
        actionItems: [
          'Review individual store strategies',
          'Share best practices from top-performing stores',
          'Consider targeted marketing for underperforming regions',
          'Analyze local competition and market conditions'
        ]
      });
    }

    return insights.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  private getPreviousPeriod(dateRange: { from: Date; to: Date }) {
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return {
      from: subDays(dateRange.from, daysDiff),
      to: subDays(dateRange.to, daysDiff)
    };
  }
}