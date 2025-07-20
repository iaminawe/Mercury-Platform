import { Worker, Job } from 'bullmq';
import { createLogger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { ShopifySync } from './shopify-sync';
import { 
  SyncJobData, 
  BulkImportJobData,
  redisConnection, 
  QUEUE_NAMES,
  addSyncJob,
  getAllQueuesStatus,
  pauseQueue,
  resumeQueue,
  clearQueue,
} from './sync-queue';

const logger = createLogger('sync-manager');

// Sync worker handlers
export function createSyncWorker(queueName: string, concurrency: number = 5) {
  const worker = new Worker<SyncJobData>(
    queueName,
    async (job) => {
      logger.info('Processing sync job', {
        jobId: job.id,
        queueName,
        resourceType: job.data.resourceType,
        operation: job.data.operation,
      });

      const sync = new ShopifySync(
        job.data.storeId,
        job.data.shopDomain,
        job.data.accessToken
      );

      switch (job.data.operation) {
        case 'create':
        case 'update':
          if (job.data.resourceId) {
            await sync.syncProduct(job.data.resourceId);
          }
          break;
        case 'delete':
          if (job.data.resourceId && job.data.resourceType === 'product') {
            await sync.deleteProduct(job.data.resourceId);
          }
          break;
        case 'bulk':
          // Handle pagination for bulk operations
          let cursor = job.data.cursor;
          let hasMore = true;
          let totalSynced = 0;

          while (hasMore) {
            let result;
            switch (job.data.resourceType) {
              case 'product':
                result = await sync.syncProducts(cursor, job.data.pageSize || 50);
                break;
              case 'collection':
                result = await sync.syncCollections(cursor, job.data.pageSize || 50);
                break;
              case 'customer':
                result = await sync.syncCustomers(cursor, job.data.pageSize || 50);
                break;
              case 'order':
                // Orders use page-based pagination
                const page = cursor ? parseInt(cursor) : 1;
                result = await sync.syncOrders(page, job.data.pageSize || 250);
                result.nextCursor = result.nextPage.toString();
                break;
              default:
                throw new Error(`Unsupported resource type: ${job.data.resourceType}`);
            }

            totalSynced += result.synced;
            hasMore = result.hasMore;
            cursor = result.nextCursor;

            // Update job progress
            await job.updateProgress({
              synced: totalSynced,
              cursor,
              hasMore,
            });
          }

          logger.info('Bulk sync completed', {
            resourceType: job.data.resourceType,
            totalSynced,
          });
          break;
      }
    },
    {
      connection: redisConnection,
      concurrency,
      autorun: true,
    }
  );

  // Worker event listeners
  worker.on('completed', (job) => {
    logger.debug('Sync job completed', { jobId: job.id, queueName });
  });

  worker.on('failed', (job, err) => {
    logger.error('Sync job failed', { jobId: job?.id, queueName, error: err });
  });

  worker.on('error', (err) => {
    logger.error('Sync worker error', { queueName, error: err });
  });

  return worker;
}

// Bulk import worker
export function createBulkImportWorker(concurrency: number = 1) {
  const worker = new Worker<BulkImportJobData>(
    QUEUE_NAMES.BULK_IMPORT,
    async (job) => {
      logger.info('Processing bulk import job', {
        jobId: job.id,
        storeId: job.data.storeId,
        importType: job.data.importType,
        resources: job.data.resources,
      });

      const supabase = createClient();

      // Update sync job status
      const { data: syncJob } = await supabase
        .from('sync_jobs')
        .insert({
          store_id: job.data.storeId,
          job_type: `bulk_import_${job.data.importType}`,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        // Process each resource type
        for (const resource of job.data.resources) {
          logger.info('Starting resource sync', { resource, storeId: job.data.storeId });

          // Add sync job for each resource
          let queueName: string;
          switch (resource) {
            case 'products':
              queueName = QUEUE_NAMES.PRODUCT_SYNC;
              break;
            case 'collections':
              queueName = QUEUE_NAMES.COLLECTION_SYNC;
              break;
            case 'customers':
              queueName = QUEUE_NAMES.CUSTOMER_SYNC;
              break;
            case 'orders':
              queueName = QUEUE_NAMES.ORDER_SYNC;
              break;
            default:
              continue;
          }

          await addSyncJob(queueName as any, {
            storeId: job.data.storeId,
            shopDomain: job.data.shopDomain,
            accessToken: job.data.accessToken,
            resourceType: resource.slice(0, -1) as any, // Remove 's' from plural
            operation: 'bulk',
          });
        }

        // Update sync job status
        if (syncJob) {
          await supabase
            .from('sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              progress: 100,
            })
            .eq('id', syncJob.id);
        }

        logger.info('Bulk import completed', {
          jobId: job.id,
          storeId: job.data.storeId,
        });
      } catch (error) {
        // Update sync job status
        if (syncJob) {
          await supabase
            .from('sync_jobs')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncJob.id);
        }
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency,
      autorun: true,
    }
  );

  return worker;
}

// Sync manager class
export class SyncManager {
  private workers: Map<string, Worker> = new Map();
  private webhookWorker: Worker | null = null;

  // Start all sync workers
  async start() {
    logger.info('Starting sync manager');

    // Start sync workers for each resource type
    const syncQueues = [
      QUEUE_NAMES.PRODUCT_SYNC,
      QUEUE_NAMES.VARIANT_SYNC,
      QUEUE_NAMES.COLLECTION_SYNC,
      QUEUE_NAMES.CUSTOMER_SYNC,
      QUEUE_NAMES.ORDER_SYNC,
    ];

    for (const queueName of syncQueues) {
      const worker = createSyncWorker(queueName);
      this.workers.set(queueName, worker);
    }

    // Start bulk import worker
    const bulkImportWorker = createBulkImportWorker();
    this.workers.set(QUEUE_NAMES.BULK_IMPORT, bulkImportWorker);

    // Import webhook processor dynamically to avoid circular dependency
    const { createWebhookProcessor } = await import('./webhook-processor');
    this.webhookWorker = createWebhookProcessor();
    this.workers.set(QUEUE_NAMES.WEBHOOK_PROCESS, this.webhookWorker);

    logger.info('Sync manager started', { workers: this.workers.size });
  }

  // Stop all workers
  async stop() {
    logger.info('Stopping sync manager');

    const promises = Array.from(this.workers.values()).map((worker) => 
      worker.close()
    );

    await Promise.all(promises);
    this.workers.clear();

    logger.info('Sync manager stopped');
  }

  // Get worker status
  getWorkerStatus(queueName: string) {
    const worker = this.workers.get(queueName);
    if (!worker) {
      return null;
    }

    return {
      name: queueName,
      running: worker.isRunning(),
      concurrency: worker.concurrency,
    };
  }

  // Get all workers status
  getAllWorkersStatus() {
    return Array.from(this.workers.entries()).map(([name, worker]) => ({
      name,
      running: worker.isRunning(),
      concurrency: worker.concurrency,
    }));
  }

  // Queue management methods
  async getQueueStatus() {
    return getAllQueuesStatus();
  }

  async pauseQueue(queueName: string) {
    await pauseQueue(queueName as any);
  }

  async resumeQueue(queueName: string) {
    await resumeQueue(queueName as any);
  }

  async clearQueue(queueName: string) {
    await clearQueue(queueName as any);
  }
}

// Singleton instance
let syncManager: SyncManager | null = null;

export function getSyncManager() {
  if (!syncManager) {
    syncManager = new SyncManager();
  }
  return syncManager;
}

// Helper to get sync statistics
export async function getSyncStatistics(storeId: string) {
  const supabase = createClient();

  const [products, collections, customers, orders, recentWebhooks] = await Promise.all([
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId),
    supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId),
    supabase
      .from('webhook_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('processed_at', { ascending: false })
      .limit(10),
  ]);

  const queues = await getAllQueuesStatus();

  return {
    resources: {
      products: products.count || 0,
      collections: collections.count || 0,
      customers: customers.count || 0,
      orders: orders.count || 0,
    },
    webhooks: {
      recent: recentWebhooks.data || [],
      total: recentWebhooks.data?.length || 0,
    },
    queues,
  };
}