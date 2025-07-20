import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, format, subDays, parseISO } from 'date-fns';

const logger = createLogger('cross-store-aggregator');

export interface CrossStoreMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalVisitors: number;
  avgOrderValue: number;
  avgConversionRate: number;
  storeCount: number;
  topPerformingStore: {
    storeId: string;
    storeName: string;
    revenue: number;
    orders: number;
  } | null;
  revenueGrowth: number;
  ordersGrowth: number;
}

export interface StorePerformance {
  storeId: string;
  storeName: string;
  shopDomain: string;
  metrics: {
    revenue: number;
    orders: number;
    visitors: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  dailyData: Array<{
    date: string;
    revenue: number;
    orders: number;
    visitors: number;
  }>;
  growth: {
    revenue: number;
    orders: number;
    visitors: number;
  };
}

export interface CrossStoreData {
  aggregatedMetrics: CrossStoreMetrics;
  storePerformances: StorePerformance[];
  timeSeriesData: Array<{
    date: string;
    totalRevenue: number;
    totalOrders: number;
    totalVisitors: number;
    storeBreakdown: Record<string, {
      revenue: number;
      orders: number;
      visitors: number;
    }>;
  }>;
  topProducts: Array<{
    productId: string;
    title: string;
    totalRevenue: number;
    totalOrders: number;
    storeBreakdown: Record<string, {
      revenue: number;
      orders: number;
    }>;
  }>;
}

export class CrossStoreAggregator {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getStoresList(ownerId: string): Promise<Array<{ id: string; shop_name: string; shop_domain: string }>> {
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

  async aggregateMetrics(
    ownerId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<CrossStoreData> {
    const stores = await this.getStoresList(ownerId);
    
    if (stores.length === 0) {
      throw new Error('No active stores found');
    }

    const storeIds = stores.map(store => store.id);
    
    // Fetch analytics snapshots for all stores
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

    // Get previous period for growth calculation
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

    // Process the data
    const storePerformances = this.calculateStorePerformances(stores, snapshots || [], prevSnapshots || []);
    const aggregatedMetrics = this.calculateAggregatedMetrics(storePerformances, prevSnapshots || []);
    const timeSeriesData = this.generateTimeSeriesData(snapshots || [], stores);
    const topProducts = await this.getTopProductsAcrossStores(storeIds, dateRange);

    return {
      aggregatedMetrics,
      storePerformances,
      timeSeriesData,
      topProducts
    };
  }

  private calculateStorePerformances(
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>,
    snapshots: any[],
    prevSnapshots: any[]
  ): StorePerformance[] {
    return stores.map(store => {
      const storeSnapshots = snapshots.filter(s => s.store_id === store.id);
      const storePrevSnapshots = prevSnapshots.filter(s => s.store_id === store.id);

      const currentTotals = storeSnapshots.reduce(
        (acc, snapshot) => ({
          revenue: acc.revenue + snapshot.revenue,
          orders: acc.orders + snapshot.orders_count,
          visitors: acc.visitors + snapshot.unique_visitors,
          pageViews: acc.pageViews + snapshot.page_views
        }),
        { revenue: 0, orders: 0, visitors: 0, pageViews: 0 }
      );

      const prevTotals = storePrevSnapshots.reduce(
        (acc, snapshot) => ({
          revenue: acc.revenue + snapshot.revenue,
          orders: acc.orders + snapshot.orders_count,
          visitors: acc.visitors + snapshot.unique_visitors
        }),
        { revenue: 0, orders: 0, visitors: 0 }
      );

      const avgOrderValue = currentTotals.orders > 0 ? currentTotals.revenue / currentTotals.orders : 0;
      const conversionRate = currentTotals.visitors > 0 ? (currentTotals.orders / currentTotals.visitors) * 100 : 0;

      const growth = {
        revenue: prevTotals.revenue > 0 ? ((currentTotals.revenue - prevTotals.revenue) / prevTotals.revenue) * 100 : 0,
        orders: prevTotals.orders > 0 ? ((currentTotals.orders - prevTotals.orders) / prevTotals.orders) * 100 : 0,
        visitors: prevTotals.visitors > 0 ? ((currentTotals.visitors - prevTotals.visitors) / prevTotals.visitors) * 100 : 0
      };

      const dailyData = storeSnapshots.map(snapshot => ({
        date: snapshot.date,
        revenue: snapshot.revenue,
        orders: snapshot.orders_count,
        visitors: snapshot.unique_visitors
      }));

      return {
        storeId: store.id,
        storeName: store.shop_name,
        shopDomain: store.shop_domain,
        metrics: {
          revenue: currentTotals.revenue,
          orders: currentTotals.orders,
          visitors: currentTotals.visitors,
          avgOrderValue,
          conversionRate
        },
        dailyData,
        growth
      };
    });
  }

  private calculateAggregatedMetrics(
    storePerformances: StorePerformance[],
    prevSnapshots: any[]
  ): CrossStoreMetrics {
    const totals = storePerformances.reduce(
      (acc, store) => ({
        revenue: acc.revenue + store.metrics.revenue,
        orders: acc.orders + store.metrics.orders,
        visitors: acc.visitors + store.metrics.visitors
      }),
      { revenue: 0, orders: 0, visitors: 0 }
    );

    const prevTotals = prevSnapshots.reduce(
      (acc, snapshot) => ({
        revenue: acc.revenue + snapshot.revenue,
        orders: acc.orders + snapshot.orders_count,
        visitors: acc.visitors + snapshot.unique_visitors
      }),
      { revenue: 0, orders: 0, visitors: 0 }
    );

    const topPerformingStore = storePerformances.reduce((top, store) => {
      if (!top || store.metrics.revenue > top.revenue) {
        return {
          storeId: store.storeId,
          storeName: store.storeName,
          revenue: store.metrics.revenue,
          orders: store.metrics.orders
        };
      }
      return top;
    }, null as CrossStoreMetrics['topPerformingStore']);

    return {
      totalRevenue: totals.revenue,
      totalOrders: totals.orders,
      totalVisitors: totals.visitors,
      avgOrderValue: totals.orders > 0 ? totals.revenue / totals.orders : 0,
      avgConversionRate: totals.visitors > 0 ? (totals.orders / totals.visitors) * 100 : 0,
      storeCount: storePerformances.length,
      topPerformingStore,
      revenueGrowth: prevTotals.revenue > 0 ? ((totals.revenue - prevTotals.revenue) / prevTotals.revenue) * 100 : 0,
      ordersGrowth: prevTotals.orders > 0 ? ((totals.orders - prevTotals.orders) / prevTotals.orders) * 100 : 0
    };
  }

  private generateTimeSeriesData(
    snapshots: any[],
    stores: Array<{ id: string; shop_name: string; shop_domain: string }>
  ) {
    const dateGroups = snapshots.reduce((groups, snapshot) => {
      const date = snapshot.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(snapshot);
      return groups;
    }, {} as Record<string, any[]>);

    return Object.entries(dateGroups).map(([date, daySnapshots]) => {
      const dayTotals = daySnapshots.reduce(
        (acc, snapshot) => ({
          revenue: acc.revenue + snapshot.revenue,
          orders: acc.orders + snapshot.orders_count,
          visitors: acc.visitors + snapshot.unique_visitors
        }),
        { revenue: 0, orders: 0, visitors: 0 }
      );

      const storeBreakdown = daySnapshots.reduce((breakdown, snapshot) => {
        const store = stores.find(s => s.id === snapshot.store_id);
        if (store) {
          breakdown[store.shop_name] = {
            revenue: snapshot.revenue,
            orders: snapshot.orders_count,
            visitors: snapshot.unique_visitors
          };
        }
        return breakdown;
      }, {} as Record<string, { revenue: number; orders: number; visitors: number }>);

      return {
        date,
        totalRevenue: dayTotals.revenue,
        totalOrders: dayTotals.orders,
        totalVisitors: dayTotals.visitors,
        storeBreakdown
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getTopProductsAcrossStores(
    storeIds: string[],
    dateRange: { from: Date; to: Date }
  ) {
    // Get recent analytics snapshots to extract top products
    const { data: snapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('store_id, top_products')
      .in('store_id', storeIds)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

    const productAggregation: Record<string, {
      title: string;
      totalRevenue: number;
      totalOrders: number;
      storeBreakdown: Record<string, { revenue: number; orders: number }>;
    }> = {};

    snapshots?.forEach(snapshot => {
      const topProducts = snapshot.top_products as any[];
      topProducts?.forEach(product => {
        const productId = product.id || product.product_id;
        if (!productAggregation[productId]) {
          productAggregation[productId] = {
            title: product.title,
            totalRevenue: 0,
            totalOrders: 0,
            storeBreakdown: {}
          };
        }

        productAggregation[productId].totalRevenue += product.revenue || 0;
        productAggregation[productId].totalOrders += product.orders || 0;
        
        if (!productAggregation[productId].storeBreakdown[snapshot.store_id]) {
          productAggregation[productId].storeBreakdown[snapshot.store_id] = {
            revenue: 0,
            orders: 0
          };
        }
        
        productAggregation[productId].storeBreakdown[snapshot.store_id].revenue += product.revenue || 0;
        productAggregation[productId].storeBreakdown[snapshot.store_id].orders += product.orders || 0;
      });
    });

    return Object.entries(productAggregation)
      .map(([productId, data]) => ({
        productId,
        ...data
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20);
  }

  async getRegionalPerformance(ownerId: string, dateRange: { from: Date; to: Date }) {
    const stores = await this.getStoresList(ownerId);
    
    // For now, we'll group by store location/region
    // In a real implementation, you'd have store location data
    const regionMap: Record<string, { stores: string[], totalRevenue: number, totalOrders: number }> = {};

    const { data: snapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('store_id, revenue, orders_count')
      .in('store_id', stores.map(s => s.id))
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

    snapshots?.forEach(snapshot => {
      const store = stores.find(s => s.id === snapshot.store_id);
      if (store) {
        // Simple region extraction from domain (you'd want proper geolocation)
        const region = this.extractRegionFromDomain(store.shop_domain);
        
        if (!regionMap[region]) {
          regionMap[region] = { stores: [], totalRevenue: 0, totalOrders: 0 };
        }
        
        if (!regionMap[region].stores.includes(store.shop_name)) {
          regionMap[region].stores.push(store.shop_name);
        }
        
        regionMap[region].totalRevenue += snapshot.revenue;
        regionMap[region].totalOrders += snapshot.orders_count;
      }
    });

    return Object.entries(regionMap).map(([region, data]) => ({
      region,
      storeCount: data.stores.length,
      stores: data.stores,
      totalRevenue: data.totalRevenue,
      totalOrders: data.totalOrders,
      avgOrderValue: data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0
    }));
  }

  private extractRegionFromDomain(domain: string): string {
    // Simple region extraction - in production you'd use proper geolocation
    const tld = domain.split('.').pop()?.toLowerCase();
    const regionMap: Record<string, string> = {
      'com': 'Global',
      'ca': 'Canada',
      'uk': 'United Kingdom',
      'au': 'Australia',
      'de': 'Germany',
      'fr': 'France',
      'myshopify.com': 'Global'
    };
    
    return regionMap[tld || ''] || 'Other';
  }
}