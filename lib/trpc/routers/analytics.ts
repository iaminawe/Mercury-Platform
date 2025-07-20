import { z } from 'zod';
import { router, storeProcedure } from '@/lib/trpc/init';
import { TRPCError } from '@trpc/server';
import { createLogger } from '@/lib/logger';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const logger = createLogger('analytics-router');

export const analyticsRouter = router({
  getDashboardMetrics: storeProcedure
    .input(
      z.object({
        dateRange: z.object({
          from: z.date(),
          to: z.date(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateRange } = input;

      try {
        // Get analytics snapshots for the date range
        const { data: snapshots, error } = await ctx.supabase
          .from('analytics_snapshots')
          .select('*')
          .eq('store_id', ctx.storeId!)
          .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
          .order('date', { ascending: true });

        if (error) {
          logger.error('Get analytics error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch analytics',
          });
        }

        // Calculate aggregate metrics
        const metrics = snapshots?.reduce(
          (acc, snapshot) => ({
            totalRevenue: acc.totalRevenue + snapshot.revenue,
            totalOrders: acc.totalOrders + snapshot.orders_count,
            totalVisitors: acc.totalVisitors + snapshot.unique_visitors,
            avgOrderValue:
              acc.avgOrderValue +
              snapshot.average_order_value / (snapshots?.length || 1),
            avgConversionRate:
              acc.avgConversionRate +
              snapshot.conversion_rate / (snapshots?.length || 1),
          }),
          {
            totalRevenue: 0,
            totalOrders: 0,
            totalVisitors: 0,
            avgOrderValue: 0,
            avgConversionRate: 0,
          }
        ) || {
          totalRevenue: 0,
          totalOrders: 0,
          totalVisitors: 0,
          avgOrderValue: 0,
          avgConversionRate: 0,
        };

        // Get AI analyses summary
        const { data: aiAnalyses, error: aiError } = await ctx.supabase
          .from('ai_analyses')
          .select('analysis_type, status, created_at')
          .eq('store_id', ctx.storeId!)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());

        if (aiError) {
          logger.warn('AI analyses fetch error', aiError);
        }

        const aiSummary = {
          total: aiAnalyses?.length || 0,
          completed: aiAnalyses?.filter((a) => a.status === 'completed').length || 0,
          failed: aiAnalyses?.filter((a) => a.status === 'failed').length || 0,
          pending: aiAnalyses?.filter((a) => a.status === 'pending').length || 0,
        };

        return {
          metrics,
          snapshots: snapshots || [],
          aiSummary,
          dateRange,
        };
      } catch (error) {
        logger.error('Unexpected analytics error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analytics',
        });
      }
    }),

  getRevenueChart: storeProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
        groupBy: z.enum(['day', 'week', 'month']).default('day'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { days, groupBy } = input;

      try {
        const startDate = subDays(new Date(), days);

        const { data: snapshots, error } = await ctx.supabase
          .from('analytics_snapshots')
          .select('date, revenue, orders_count')
          .eq('store_id', ctx.storeId!)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .order('date', { ascending: true });

        if (error) {
          logger.error('Get revenue chart error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch revenue data',
          });
        }

        // Transform data for chart
        const chartData = snapshots?.map((snapshot) => ({
          date: snapshot.date,
          revenue: snapshot.revenue,
          orders: snapshot.orders_count,
        })) || [];

        return {
          chartData,
          period: { from: startDate, to: new Date() },
        };
      } catch (error) {
        logger.error('Unexpected revenue chart error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch revenue data',
        });
      }
    }),

  getTopProducts: storeProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        dateRange: z.object({
          from: z.date(),
          to: z.date(),
        }).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, dateRange } = input;

      try {
        let query = ctx.supabase
          .from('analytics_snapshots')
          .select('date, top_products')
          .eq('store_id', ctx.storeId!)
          .order('date', { ascending: false })
          .limit(1);

        if (dateRange) {
          query = query
            .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
            .lte('date', format(dateRange.to, 'yyyy-MM-dd'));
        }

        const { data, error } = await query;

        if (error) {
          logger.error('Get top products error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch top products',
          });
        }

        const topProducts = data?.[0]?.top_products || [];

        return {
          products: topProducts.slice(0, limit),
          updatedAt: data?.[0]?.date || new Date().toISOString(),
        };
      } catch (error) {
        logger.error('Unexpected top products error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch top products',
        });
      }
    }),

  getTrafficSources: storeProcedure
    .input(
      z.object({
        dateRange: z.object({
          from: z.date(),
          to: z.date(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateRange } = input;

      try {
        const { data: snapshots, error } = await ctx.supabase
          .from('analytics_snapshots')
          .select('traffic_sources')
          .eq('store_id', ctx.storeId!)
          .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('date', format(dateRange.to, 'yyyy-MM-dd'));

        if (error) {
          logger.error('Get traffic sources error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch traffic sources',
          });
        }

        // Aggregate traffic sources
        const aggregated: Record<string, number> = {};
        snapshots?.forEach((snapshot) => {
          const sources = snapshot.traffic_sources as Record<string, number>;
          Object.entries(sources).forEach(([source, visits]) => {
            aggregated[source] = (aggregated[source] || 0) + visits;
          });
        });

        return {
          sources: Object.entries(aggregated).map(([name, visits]) => ({
            name,
            visits,
            percentage: 0, // Will be calculated on the frontend
          })),
        };
      } catch (error) {
        logger.error('Unexpected traffic sources error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch traffic sources',
        });
      }
    }),
});