import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { multiStoreService } from '@/lib/multi-store';

// Input validation schemas
const createStoreGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  maxStores: z.number().min(1).max(50).default(10),
  settings: z.object({
    default_sync_mode: z.enum(['real_time', 'batch', 'scheduled']).default('batch'),
    conflict_resolution_strategy: z.enum(['manual', 'auto_master_wins', 'auto_latest_wins']).default('manual'),
    inventory_sync_enabled: z.boolean().default(true),
    customer_sync_enabled: z.boolean().default(true),
    product_sync_enabled: z.boolean().default(true),
  }).optional()
});

const addStoreToGroupSchema = z.object({
  storeId: z.string().uuid(),
  groupId: z.string().uuid(),
  isMaster: z.boolean().default(false)
});

const syncOperationSchema = z.object({
  storeGroupId: z.string().uuid().optional(),
  operationType: z.enum(['inventory_sync', 'product_sync', 'customer_sync', 'full_sync']),
  sourceStoreId: z.string().uuid().optional(),
  targetStores: z.array(z.string().uuid()).optional(),
  syncMode: z.enum(['real_time', 'batch', 'scheduled']).default('batch'),
  payload: z.record(z.any()).optional()
});

const resolveConflictSchema = z.object({
  conflictId: z.string().uuid(),
  strategy: z.enum(['auto_master_wins', 'auto_latest_wins', 'auto_merge', 'manual']),
  customData: z.record(z.any()).optional()
});

const grantAccessSchema = z.object({
  userId: z.string().uuid(),
  storeId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'viewer']),
  customPermissions: z.object({
    read_products: z.boolean().optional(),
    write_products: z.boolean().optional(),
    read_inventory: z.boolean().optional(),
    write_inventory: z.boolean().optional(),
    read_customers: z.boolean().optional(),
    write_customers: z.boolean().optional(),
    read_orders: z.boolean().optional(),
    write_orders: z.boolean().optional(),
    manage_sync: z.boolean().optional(),
    resolve_conflicts: z.boolean().optional()
  }).optional(),
  expiresAt: z.string().datetime().optional()
});

export const multiStoreRouter = createTRPCRouter({
  // Store Group Management
  createStoreGroup: protectedProcedure
    .input(createStoreGroupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const group = await multiStoreService.storeManager.createStoreGroup(
          ctx.user.id,
          input.name,
          input.description,
          input.settings
        );
        return group;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create store group',
        });
      }
    }),

  getStoreGroups: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await multiStoreService.storeManager.getStoreGroups(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch store groups',
        });
      }
    }),

  getStoreGroup: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const groups = await multiStoreService.storeManager.getStoreGroups(ctx.user.id);
        const group = groups.find(g => g.id === input.id);
        
        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store group not found',
          });
        }

        const stores = await multiStoreService.storeManager.getGroupStores(group.id);
        const analytics = await multiStoreService.storeManager.getStoreGroupAnalytics(group.id);

        return {
          ...group,
          stores,
          analytics
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch store group',
        });
      }
    }),

  updateStoreGroup: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      updates: createStoreGroupSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify ownership
        const groups = await multiStoreService.storeManager.getStoreGroups(ctx.user.id);
        const group = groups.find(g => g.id === input.id);
        
        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store group not found',
          });
        }

        return await multiStoreService.storeManager.updateStoreGroup(input.id, input.updates);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update store group',
        });
      }
    }),

  // Store Management
  addStoreToGroup: protectedProcedure
    .input(addStoreToGroupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.storeManager.addStoreToGroup(
          input.storeId,
          input.groupId,
          input.isMaster
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to add store to group',
        });
      }
    }),

  removeStoreFromGroup: protectedProcedure
    .input(z.object({ storeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.storeManager.removeStoreFromGroup(input.storeId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove store from group',
        });
      }
    }),

  getGroupStores: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.storeManager.getGroupStores(input.groupId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch group stores',
        });
      }
    }),

  // Sync Operations
  initiateSyncOperation: protectedProcedure
    .input(syncOperationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.syncCoordinator.initiateSyncOperation(
          input.storeGroupId,
          input.operationType,
          input.sourceStoreId,
          input.targetStores,
          input.syncMode,
          input.payload
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to initiate sync operation',
        });
      }
    }),

  getSyncOperationStatus: protectedProcedure
    .input(z.object({ operationId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.syncCoordinator.getSyncOperationStatus(input.operationId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get sync operation status',
        });
      }
    }),

  // Data Aggregation
  getAggregatedInventory: protectedProcedure
    .input(z.object({ storeGroupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.dataAggregator.aggregateInventoryAcrossStores(input.storeGroupId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to aggregate inventory',
        });
      }
    }),

  getAggregatedCustomers: protectedProcedure
    .input(z.object({ storeGroupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.dataAggregator.aggregateCustomersAcrossStores(input.storeGroupId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to aggregate customers',
        });
      }
    }),

  findSimilarProducts: protectedProcedure
    .input(z.object({
      storeGroupId: z.string().uuid(),
      productTitle: z.string(),
      sku: z.string().optional(),
      threshold: z.number().min(0).max(1).default(0.8)
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.dataAggregator.findSimilarProducts(
          input.storeGroupId,
          input.productTitle,
          input.sku,
          input.threshold
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to find similar products',
        });
      }
    }),

  // Analytics
  getMultiStoreAnalytics: protectedProcedure
    .input(z.object({
      storeGroupId: z.string().uuid(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime()
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.dataAggregator.generateMultiStoreAnalytics(
          input.storeGroupId,
          input.startDate,
          input.endDate
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate analytics',
        });
      }
    }),

  // Conflict Resolution
  getConflicts: protectedProcedure
    .input(z.object({
      storeGroupId: z.string().uuid().optional(),
      status: z.enum(['pending', 'resolved', 'ignored']).optional(),
      conflictType: z.enum(['inventory_mismatch', 'price_conflict', 'data_conflict', 'duplicate_product']).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.conflictResolver.getConflicts(
          input.storeGroupId,
          input.status,
          input.conflictType
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch conflicts',
        });
      }
    }),

  resolveConflict: protectedProcedure
    .input(resolveConflictSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.conflictResolver.resolveConflict(
          input.conflictId,
          input.strategy,
          ctx.user.id,
          input.customData
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to resolve conflict',
        });
      }
    }),

  resolveBatchConflicts: protectedProcedure
    .input(z.object({
      conflictIds: z.array(z.string().uuid()),
      strategy: z.enum(['auto_master_wins', 'auto_latest_wins', 'auto_merge'])
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.conflictResolver.resolveBatchConflicts(
          input.conflictIds,
          input.strategy,
          ctx.user.id
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve conflicts',
        });
      }
    }),

  detectPotentialConflicts: protectedProcedure
    .input(z.object({
      storeGroupId: z.string().uuid(),
      operationType: z.enum(['inventory', 'price', 'product_data'])
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.conflictResolver.detectPotentialConflicts(
          input.storeGroupId,
          input.operationType
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to detect potential conflicts',
        });
      }
    }),

  getConflictStatistics: protectedProcedure
    .input(z.object({ storeGroupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.conflictResolver.getConflictStatistics(input.storeGroupId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get conflict statistics',
        });
      }
    }),

  // Access Control
  grantStoreAccess: protectedProcedure
    .input(grantAccessSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.accessController.grantAccess(
          input.userId,
          input.storeId,
          input.role,
          ctx.user.id,
          input.customPermissions,
          input.expiresAt
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to grant store access',
        });
      }
    }),

  revokeStoreAccess: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      storeId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await multiStoreService.accessController.revokeAccess(
          input.userId,
          input.storeId,
          ctx.user.id
        );
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to revoke store access',
        });
      }
    }),

  getUserStoreAccess: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await multiStoreService.accessController.getUserAccessibleStores(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user store access',
        });
      }
    }),

  getStoreUsers: protectedProcedure
    .input(z.object({ storeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.accessController.getStoreUsers(input.storeId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch store users',
        });
      }
    }),

  checkPermission: protectedProcedure
    .input(z.object({
      storeId: z.string().uuid(),
      permission: z.enum([
        'read_products', 'write_products', 'read_inventory', 'write_inventory',
        'read_customers', 'write_customers', 'read_orders', 'write_orders',
        'manage_sync', 'resolve_conflicts'
      ])
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.accessController.hasPermission(
          ctx.user.id,
          input.storeId,
          input.permission
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check permission',
        });
      }
    }),

  // Utility Operations
  validateStoreConnection: protectedProcedure
    .input(z.object({ storeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.storeManager.validateStoreConnection(input.storeId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate store connection',
        });
      }
    }),

  performHealthCheck: protectedProcedure
    .input(z.object({ storeGroupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await multiStoreService.performHealthCheck(input.storeGroupId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform health check',
        });
      }
    }),

  setupMultiStoreAccount: protectedProcedure
    .input(z.object({
      groupName: z.string().min(1).max(100),
      stores: z.array(z.object({
        storeId: z.string().uuid(),
        isMaster: z.boolean().default(false)
      })).min(2),
      syncConfig: z.object({
        mode: z.enum(['real_time', 'batch', 'scheduled']).default('batch'),
        batch_size: z.number().min(1).max(1000).default(100),
        retry_attempts: z.number().min(0).max(10).default(3),
        retry_delay: z.number().min(1000).default(5000),
        conflict_resolution: z.enum(['manual', 'auto_master_wins', 'auto_latest_wins']).default('manual'),
        enabled_sync_types: z.array(z.enum(['inventory', 'products', 'customers', 'orders'])).default(['inventory', 'products'])
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await multiStoreService.setupMultiStoreAccount(
          ctx.user.id,
          input.groupName,
          input.stores,
          input.syncConfig
        );
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to setup multi-store account',
        });
      }
    })
});