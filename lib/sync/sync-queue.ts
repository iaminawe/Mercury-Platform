import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { createLogger } from '@/lib/logger';

const logger = createLogger('sync-queue');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

// Create Redis connections
export const redisConnection = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);

// Queue names
export const QUEUE_NAMES = {
  PRODUCT_SYNC: 'product-sync',
  VARIANT_SYNC: 'variant-sync',
  COLLECTION_SYNC: 'collection-sync',
  CUSTOMER_SYNC: 'customer-sync',
  ORDER_SYNC: 'order-sync',
  WEBHOOK_PROCESS: 'webhook-process',
  BULK_IMPORT: 'bulk-import',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job types
export interface SyncJobData {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  resourceType: 'product' | 'variant' | 'collection' | 'customer' | 'order';
  resourceId?: string;
  operation: 'create' | 'update' | 'delete' | 'bulk';
  data?: any;
  cursor?: string;
  pageSize?: number;
}

export interface WebhookJobData {
  storeId: string;
  shopDomain: string;
  topic: string;
  payload: any;
  timestamp: number;
}

export interface BulkImportJobData {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  importType: 'full' | 'incremental';
  resources: Array<'products' | 'collections' | 'customers' | 'orders'>;
  startDate?: string;
  endDate?: string;
}

// Queue instances
export const queues: Record<QueueName, Queue> = {
  [QUEUE_NAMES.PRODUCT_SYNC]: new Queue(QUEUE_NAMES.PRODUCT_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
  [QUEUE_NAMES.VARIANT_SYNC]: new Queue(QUEUE_NAMES.VARIANT_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
  [QUEUE_NAMES.COLLECTION_SYNC]: new Queue(QUEUE_NAMES.COLLECTION_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
  [QUEUE_NAMES.CUSTOMER_SYNC]: new Queue(QUEUE_NAMES.CUSTOMER_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
  [QUEUE_NAMES.ORDER_SYNC]: new Queue(QUEUE_NAMES.ORDER_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),
  [QUEUE_NAMES.WEBHOOK_PROCESS]: new Queue(QUEUE_NAMES.WEBHOOK_PROCESS, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 100 },
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  }),
  [QUEUE_NAMES.BULK_IMPORT]: new Queue(QUEUE_NAMES.BULK_IMPORT, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
      attempts: 1,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    },
  }),
};

// Queue event listeners for monitoring
export const queueEvents: Record<QueueName, QueueEvents> = Object.entries(QUEUE_NAMES).reduce(
  (acc, [key, queueName]) => {
    acc[queueName] = new QueueEvents(queueName, {
      connection: redisSubscriber,
    });
    return acc;
  },
  {} as Record<QueueName, QueueEvents>
);

// Helper functions
export async function addSyncJob(
  queueName: QueueName,
  data: SyncJobData,
  options?: { priority?: number; delay?: number }
) {
  const queue = queues[queueName];
  const job = await queue.add(`${data.resourceType}-${data.operation}`, data, options);
  logger.info('Sync job added', { queueName, jobId: job.id, data });
  return job;
}

export async function addWebhookJob(data: WebhookJobData, options?: { priority?: number }) {
  const job = await queues[QUEUE_NAMES.WEBHOOK_PROCESS].add(data.topic, data, {
    ...options,
    priority: options?.priority ?? 10, // Higher priority for webhooks
  });
  logger.info('Webhook job added', { jobId: job.id, topic: data.topic });
  return job;
}

export async function addBulkImportJob(data: BulkImportJobData) {
  const job = await queues[QUEUE_NAMES.BULK_IMPORT].add('bulk-import', data, {
    attempts: 1, // Don't retry bulk imports automatically
  });
  logger.info('Bulk import job added', { jobId: job.id, storeId: data.storeId });
  return job;
}

// Queue status helpers
export async function getQueueStatus(queueName: QueueName) {
  const queue = queues[queueName];
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  };
}

export async function getAllQueuesStatus() {
  const statuses = await Promise.all(
    Object.values(QUEUE_NAMES).map((queueName) => getQueueStatus(queueName))
  );
  return statuses;
}

// Queue control
export async function pauseQueue(queueName: QueueName) {
  await queues[queueName].pause();
  logger.info('Queue paused', { queueName });
}

export async function resumeQueue(queueName: QueueName) {
  await queues[queueName].resume();
  logger.info('Queue resumed', { queueName });
}

export async function clearQueue(queueName: QueueName) {
  await queues[queueName].obliterate({ force: true });
  logger.info('Queue cleared', { queueName });
}

// Cleanup connections
export async function closeSyncQueues() {
  await Promise.all([
    ...Object.values(queues).map((queue) => queue.close()),
    ...Object.values(queueEvents).map((events) => events.close()),
    redisConnection.quit(),
    redisSubscriber.quit(),
  ]);
  logger.info('All queue connections closed');
}