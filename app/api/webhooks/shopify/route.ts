import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { addWebhookJob } from '@/lib/sync/sync-queue';

const logger = createLogger('shopify-webhooks');

// Note: Webhook handlers have been moved to webhook-processor.ts
// This route now only validates and queues webhooks for processing

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const topic = request.headers.get('X-Shopify-Topic');
    const shop = request.headers.get('X-Shopify-Shop-Domain');
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');

    if (!topic || !shop || !hmacHeader) {
      logger.error('Missing required headers');
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (hash !== hmacHeader) {
      logger.error('Invalid webhook signature', { shop, topic });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook data
    const data = JSON.parse(rawBody);

    // Get store ID
    const supabase = await createServiceRoleClient();
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('shop_domain', shop)
      .single();

    if (!store) {
      logger.error('Store not found', { shop });
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Add webhook to processing queue
    await addWebhookJob({
      storeId: store.id,
      shopDomain: shop,
      topic,
      payload: data,
      timestamp: Date.now(),
    });

    logger.info('Webhook queued', { shop, topic });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

