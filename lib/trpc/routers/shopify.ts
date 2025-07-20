import { z } from 'zod';
import { router, storeProcedure } from '@/lib/trpc/init';
import { TRPCError } from '@trpc/server';
import { createLogger } from '@/lib/logger';
import { shopifyApi } from '@shopify/shopify-api';
import { getSyncStatistics } from '@/lib/sync/sync-manager';
import { addBulkImportJob, pauseQueue, resumeQueue, clearQueue, QUEUE_NAMES } from '@/lib/sync/sync-queue';

const logger = createLogger('shopify-router');

export const shopifyRouter = router({
  syncProducts: storeProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(250).default(50),
        since: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { limit, since } = input;

      try {
        // Get store details
        const { data: store, error: storeError } = await ctx.supabase
          .from('stores')
          .select('*')
          .eq('id', ctx.storeId!)
          .single();

        if (storeError || !store) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store not found',
          });
        }

        // Initialize Shopify client
        const client = new shopifyApi({
          apiKey: process.env.SHOPIFY_APP_API_KEY!,
          apiSecretKey: process.env.SHOPIFY_APP_API_SECRET!,
          scopes: process.env.SHOPIFY_APP_SCOPES!.split(','),
          hostName: process.env.SHOPIFY_APP_HOST!,
          apiVersion: '2024-01',
        });

        const session = {
          shop: store.shop_domain,
          accessToken: store.access_token,
        };

        // Fetch products from Shopify
        const response = await client.rest.Product.all({
          session,
          limit,
          updated_at_min: since?.toISOString(),
        });

        // Sync products to database
        const productsToSync = response.data.map((product: any) => ({
          store_id: ctx.storeId!,
          shopify_product_id: product.id.toString(),
          title: product.title,
          handle: product.handle,
          product_type: product.product_type || '',
          vendor: product.vendor || '',
          tags: product.tags ? product.tags.split(', ') : [],
          status: product.status,
          synced_at: new Date().toISOString(),
          data: product,
        }));

        // Upsert products
        const { error: syncError } = await ctx.supabase
          .from('products')
          .upsert(productsToSync, {
            onConflict: 'store_id,shopify_product_id',
          });

        if (syncError) {
          logger.error('Product sync error', syncError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to sync products',
          });
        }

        logger.info('Products synced', {
          storeId: ctx.storeId,
          count: productsToSync.length,
        });

        return {
          synced: productsToSync.length,
          lastSync: new Date().toISOString(),
        };
      } catch (error) {
        logger.error('Unexpected sync error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sync products',
        });
      }
    }),

  getProducts: storeProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        status: z.enum(['active', 'draft', 'archived']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, search, status } = input;

      try {
        let query = ctx.supabase
          .from('products')
          .select('*', { count: 'exact' })
          .eq('store_id', ctx.storeId!)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (search) {
          query = query.ilike('title', `%${search}%`);
        }

        if (status) {
          query = query.eq('status', status);
        }

        const { data: products, count, error } = await query;

        if (error) {
          logger.error('Get products error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch products',
          });
        }

        return {
          products: products || [],
          total: count || 0,
          limit,
          offset,
        };
      } catch (error) {
        logger.error('Unexpected get products error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch products',
        });
      }
    }),

  connectStore: storeProcedure
    .input(
      z.object({
        shopDomain: z.string(),
        accessToken: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { shopDomain, accessToken } = input;

      try {
        // Verify the access token by making a test API call
        const client = new shopifyApi({
          apiKey: process.env.SHOPIFY_APP_API_KEY!,
          apiSecretKey: process.env.SHOPIFY_APP_API_SECRET!,
          scopes: process.env.SHOPIFY_APP_SCOPES!.split(','),
          hostName: process.env.SHOPIFY_APP_HOST!,
          apiVersion: '2024-01',
        });

        const session = {
          shop: shopDomain,
          accessToken,
        };

        // Test the connection
        const shopInfo = await client.rest.Shop.all({ session });

        if (!shopInfo.data.length) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid access token',
          });
        }

        const shop = shopInfo.data[0];

        // Update or create store record
        const { error: storeError } = await ctx.supabase
          .from('stores')
          .upsert({
            shop_domain: shopDomain,
            access_token: accessToken,
            shop_name: shop.name,
            email: shop.email,
            owner_id: ctx.user!.id,
            plan: shop.plan_name || 'basic',
            is_active: true,
            settings: {},
          }, {
            onConflict: 'shop_domain',
          });

        if (storeError) {
          logger.error('Store connection error', storeError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to connect store',
          });
        }

        logger.info('Store connected', {
          shopDomain,
          userId: ctx.user!.id,
        });

        return {
          success: true,
          shop: {
            domain: shopDomain,
            name: shop.name,
            email: shop.email,
          },
        };
      } catch (error) {
        logger.error('Unexpected connect store error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to connect store',
        });
      }
    }),

  disconnectStore: storeProcedure.mutation(async ({ ctx }) => {
    try {
      const { error } = await ctx.supabase
        .from('stores')
        .update({ is_active: false })
        .eq('id', ctx.storeId!);

      if (error) {
        logger.error('Disconnect store error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to disconnect store',
        });
      }

      logger.info('Store disconnected', { storeId: ctx.storeId });
      return { success: true };
    } catch (error) {
      logger.error('Unexpected disconnect store error', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to disconnect store',
      });
    }
  }),

  // Sync Management Procedures
  getSyncStatistics: storeProcedure.query(async ({ ctx }) => {
    try {
      const stats = await getSyncStatistics(ctx.storeId!);
      return stats;
    } catch (error) {
      logger.error('Get sync statistics error', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get sync statistics',
      });
    }
  }),

  bulkImport: storeProcedure
    .input(
      z.object({
        importType: z.enum(['full', 'incremental']),
        resources: z.array(z.enum(['products', 'collections', 'customers', 'orders'])),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get store details
        const { data: store, error: storeError } = await ctx.supabase
          .from('stores')
          .select('shop_domain, access_token')
          .eq('id', ctx.storeId!)
          .single();

        if (storeError || !store) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store not found',
          });
        }

        // Add bulk import job
        const job = await addBulkImportJob({
          storeId: ctx.storeId!,
          shopDomain: store.shop_domain,
          accessToken: store.access_token,
          importType: input.importType,
          resources: input.resources,
          startDate: input.startDate,
          endDate: input.endDate,
        });

        logger.info('Bulk import job created', {
          storeId: ctx.storeId,
          jobId: job.id,
          resources: input.resources,
        });

        return {
          success: true,
          jobId: job.id,
        };
      } catch (error) {
        logger.error('Bulk import error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start bulk import',
        });
      }
    }),

  pauseQueue: storeProcedure
    .input(
      z.object({
        queueName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await pauseQueue(input.queueName as any);
        return { success: true };
      } catch (error) {
        logger.error('Pause queue error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to pause queue',
        });
      }
    }),

  resumeQueue: storeProcedure
    .input(
      z.object({
        queueName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await resumeQueue(input.queueName as any);
        return { success: true };
      } catch (error) {
        logger.error('Resume queue error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resume queue',
        });
      }
    }),

  clearQueue: storeProcedure
    .input(
      z.object({
        queueName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await clearQueue(input.queueName as any);
        return { success: true };
      } catch (error) {
        logger.error('Clear queue error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear queue',
        });
      }
    }),
});