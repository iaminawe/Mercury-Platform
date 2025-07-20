import { Worker, Job } from 'bullmq';
import { createLogger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { ShopifySync } from './shopify-sync';
import { WebhookJobData, redisConnection, QUEUE_NAMES } from './sync-queue';

const logger = createLogger('webhook-processor');

// Webhook topic handlers
const webhookHandlers: Record<string, (job: Job<WebhookJobData>) => Promise<void>> = {
  'products/create': handleProductCreate,
  'products/update': handleProductUpdate,
  'products/delete': handleProductDelete,
  'orders/create': handleOrderCreate,
  'orders/updated': handleOrderUpdate,
  'orders/cancelled': handleOrderCancel,
  'app/uninstalled': handleAppUninstall,
};

// Product webhook handlers
async function handleProductCreate(job: Job<WebhookJobData>) {
  const { storeId, shopDomain, payload } = job.data;
  const supabase = createClient();

  // Get store access token
  const { data: store } = await supabase
    .from('stores')
    .select('access_token')
    .eq('id', storeId)
    .single();

  if (!store) {
    throw new Error('Store not found');
  }

  const sync = new ShopifySync(storeId, shopDomain, store.access_token);
  await sync.syncProduct(payload.id.toString());

  // Log webhook processing
  await logWebhook(job.data, 'success');
}

async function handleProductUpdate(job: Job<WebhookJobData>) {
  // Same as create - upsert will handle updates
  await handleProductCreate(job);
}

async function handleProductDelete(job: Job<WebhookJobData>) {
  const { storeId, shopDomain, payload } = job.data;
  const supabase = createClient();

  // Get store access token
  const { data: store } = await supabase
    .from('stores')
    .select('access_token')
    .eq('id', storeId)
    .single();

  if (!store) {
    throw new Error('Store not found');
  }

  const sync = new ShopifySync(storeId, shopDomain, store.access_token);
  await sync.deleteProduct(payload.id.toString());

  await logWebhook(job.data, 'success');
}

// Order webhook handlers
async function handleOrderCreate(job: Job<WebhookJobData>) {
  const { storeId, payload } = job.data;
  const supabase = createClient();

  // Store order in database
  const { error } = await supabase
    .from('orders')
    .upsert({
      store_id: storeId,
      shopify_order_id: payload.id.toString(),
      order_number: payload.order_number,
      email: payload.email,
      financial_status: payload.financial_status,
      fulfillment_status: payload.fulfillment_status || 'unfulfilled',
      total_price: parseFloat(payload.total_price),
      subtotal_price: parseFloat(payload.subtotal_price),
      total_tax: parseFloat(payload.total_tax || '0'),
      currency: payload.currency,
      customer_id: payload.customer?.id?.toString(),
      line_items_count: payload.line_items?.length || 0,
      data: payload,
      synced_at: new Date().toISOString(),
    })
    .eq('shopify_order_id', payload.id.toString())
    .eq('store_id', storeId);

  if (error) {
    logger.error('Failed to store order', { error, orderId: payload.id });
    throw error;
  }

  await logWebhook(job.data, 'success');
}

async function handleOrderUpdate(job: Job<WebhookJobData>) {
  // Same as create - upsert will handle updates
  await handleOrderCreate(job);
}

async function handleOrderCancel(job: Job<WebhookJobData>) {
  const { storeId, payload } = job.data;
  const supabase = createClient();

  // Update order status
  const { error } = await supabase
    .from('orders')
    .update({
      financial_status: 'cancelled',
      data: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('shopify_order_id', payload.id.toString())
    .eq('store_id', storeId);

  if (error) {
    logger.error('Failed to update cancelled order', { error, orderId: payload.id });
    throw error;
  }

  await logWebhook(job.data, 'success');
}

// App uninstall handler
async function handleAppUninstall(job: Job<WebhookJobData>) {
  const { storeId, shopDomain } = job.data;
  const supabase = createClient();

  // Mark store as inactive
  const { error } = await supabase
    .from('stores')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  if (error) {
    logger.error('Failed to deactivate store', { error, storeId });
    throw error;
  }

  logger.info('Store deactivated due to app uninstall', { storeId, shopDomain });
  await logWebhook(job.data, 'success');
}

// Helper to log webhook processing
async function logWebhook(data: WebhookJobData, status: 'success' | 'failed', error?: string) {
  const supabase = createClient();
  
  await supabase
    .from('webhook_logs')
    .insert({
      store_id: data.storeId,
      topic: data.topic,
      payload: data.payload,
      status,
      error,
    });
}

// Create webhook processor worker
export function createWebhookProcessor(concurrency: number = 10) {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK_PROCESS,
    async (job) => {
      logger.info('Processing webhook', {
        jobId: job.id,
        topic: job.data.topic,
        storeId: job.data.storeId,
      });

      const handler = webhookHandlers[job.data.topic];
      if (!handler) {
        logger.warn('No handler for webhook topic', { topic: job.data.topic });
        await logWebhook(job.data, 'failed', 'No handler for topic');
        return;
      }

      try {
        await handler(job);
        logger.info('Webhook processed successfully', {
          jobId: job.id,
          topic: job.data.topic,
        });
      } catch (error: any) {
        logger.error('Failed to process webhook', {
          jobId: job.id,
          topic: job.data.topic,
          error,
        });
        await logWebhook(job.data, 'failed', error.message);
        throw error;
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
    logger.debug('Webhook job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Webhook job failed', { jobId: job?.id, error: err });
  });

  worker.on('error', (err) => {
    logger.error('Webhook worker error', { error: err });
  });

  return worker;
}

// Start webhook processor
export async function startWebhookProcessor(concurrency?: number) {
  const worker = createWebhookProcessor(concurrency);
  logger.info('Webhook processor started', { concurrency: worker.concurrency });
  return worker;
}