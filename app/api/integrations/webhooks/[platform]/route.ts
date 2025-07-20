import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webhookManager from '@/lib/integrations/webhook-manager';
import ConnectorRegistry from '@/lib/integrations/connector-framework';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Platform-specific webhook validation
const webhookValidators: Record<string, (
  request: NextRequest,
  body: string,
  secret: string
) => boolean> = {
  'shopify': (request, body, secret) => {
    const hmac = request.headers.get('x-shopify-hmac-sha256');
    if (!hmac) return false;
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
  },
  
  'klaviyo': (request, body, secret) => {
    const signature = request.headers.get('x-klaviyo-signature');
    if (!signature) return false;
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  },
  
  'stripe': (request, body, secret) => {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return false;
    
    // Stripe webhook validation is more complex
    // This is a simplified version
    const elements = signature.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.substring(2);
    const signatures = elements.filter(e => e.startsWith('v1='));
    
    if (!timestamp || signatures.length === 0) return false;
    
    const payload = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signatures.some(sig => {
      const signature = sig.substring(3);
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    });
  },
  
  'default': (request, body, secret) => {
    // Generic HMAC validation
    const signature = request.headers.get('x-webhook-signature') || 
                     request.headers.get('x-signature');
    if (!signature) return true; // No signature header, allow for testing
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform;
    const body = await request.text();
    
    // Parse the body
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    // Get webhook configuration
    const { data: webhook, error: webhookError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();
    
    if (webhookError || !webhook) {
      console.error('Webhook not found:', platform);
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }
    
    // Validate webhook signature
    const validator = webhookValidators[platform] || webhookValidators.default;
    const isValid = validator(request, body, webhook.secret);
    
    if (!isValid) {
      console.error('Invalid webhook signature for platform:', platform);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Create webhook event
    const event = {
      id: crypto.randomUUID(),
      type: data.event || data.type || 'unknown',
      source: platform,
      timestamp: new Date(),
      data: data,
      metadata: {
        headers: Object.fromEntries(request.headers.entries()),
        organizationId: webhook.organization_id
      }
    };
    
    // Process the webhook through our manager
    await webhookManager.processEvent(event);
    
    // Store raw webhook event
    await supabase
      .from('webhook_events')
      .insert({
        id: event.id,
        endpoint_id: webhook.id,
        event_type: event.type,
        payload: event.data,
        headers: event.metadata.headers,
        processed_at: new Date().toISOString()
      });
    
    // Handle platform-specific logic
    await handlePlatformWebhook(platform, event, webhook);
    
    // Return success response
    return NextResponse.json({
      success: true,
      eventId: event.id
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePlatformWebhook(
  platform: string,
  event: any,
  webhook: any
) {
  const connector = ConnectorRegistry.get(platform);
  if (!connector) return;
  
  switch (platform) {
    case 'shopify':
      await handleShopifyWebhook(event, webhook);
      break;
      
    case 'klaviyo':
      await handleKlaviyoWebhook(event, webhook);
      break;
      
    case 'tiktok-ads':
      await handleTikTokWebhook(event, webhook);
      break;
      
    case 'stripe':
      await handleStripeWebhook(event, webhook);
      break;
      
    default:
      console.log('Unhandled platform webhook:', platform);
  }
}

async function handleShopifyWebhook(event: any, webhook: any) {
  const { type, data } = event;
  
  switch (type) {
    case 'products/create':
    case 'products/update':
      // Sync product to connected platforms
      await syncProductToPlatforms(data, webhook.organization_id);
      break;
      
    case 'orders/create':
      // Track order in analytics platforms
      await trackOrderInPlatforms(data, webhook.organization_id);
      break;
      
    case 'customers/create':
    case 'customers/update':
      // Sync customer to CRM/email platforms
      await syncCustomerToPlatforms(data, webhook.organization_id);
      break;
  }
}

async function handleKlaviyoWebhook(event: any, webhook: any) {
  const { type, data } = event;
  
  switch (type) {
    case 'profile/subscribed':
    case 'profile/unsubscribed':
      // Update customer subscription status
      await updateCustomerSubscription(data, webhook.organization_id);
      break;
      
    case 'campaign/sent':
    case 'campaign/opened':
    case 'campaign/clicked':
      // Track email campaign metrics
      await trackEmailMetrics(data, webhook.organization_id);
      break;
  }
}

async function handleTikTokWebhook(event: any, webhook: any) {
  const { type, data } = event;
  
  switch (type) {
    case 'pixel/purchase':
    case 'pixel/add_to_cart':
    case 'pixel/view_content':
      // Track conversion events
      await trackConversionEvent(data, webhook.organization_id);
      break;
  }
}

async function handleStripeWebhook(event: any, webhook: any) {
  const { type, data } = event;
  
  switch (type) {
    case 'payment_intent.succeeded':
      // Update order payment status
      await updateOrderPaymentStatus(data.object, webhook.organization_id);
      break;
      
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Handle subscription changes
      await handleSubscriptionChange(data.object, webhook.organization_id);
      break;
  }
}

// Helper functions for cross-platform syncing
async function syncProductToPlatforms(product: any, organizationId: string) {
  // Get all active integrations for this organization
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('platform', ['tiktok-ads', 'pinterest-business', 'facebook-shops']);
  
  if (!integrations) return;
  
  // Sync to each platform
  for (const integration of integrations) {
    const connector = ConnectorRegistry.get(integration.platform);
    if (connector) {
      try {
        // This would call platform-specific sync methods
        console.log(`Syncing product ${product.id} to ${integration.platform}`);
      } catch (error) {
        console.error(`Failed to sync product to ${integration.platform}:`, error);
      }
    }
  }
}

async function trackOrderInPlatforms(order: any, organizationId: string) {
  // Track order in analytics and marketing platforms
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('platform', ['klaviyo', 'google-analytics', 'tiktok-ads']);
  
  if (!integrations) return;
  
  for (const integration of integrations) {
    try {
      // Track order event in each platform
      console.log(`Tracking order ${order.id} in ${integration.platform}`);
    } catch (error) {
      console.error(`Failed to track order in ${integration.platform}:`, error);
    }
  }
}

async function syncCustomerToPlatforms(customer: any, organizationId: string) {
  // Sync customer to CRM and email platforms
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('platform', ['klaviyo', 'mailchimp', 'hubspot']);
  
  if (!integrations) return;
  
  for (const integration of integrations) {
    try {
      // Sync customer profile to each platform
      console.log(`Syncing customer ${customer.id} to ${integration.platform}`);
    } catch (error) {
      console.error(`Failed to sync customer to ${integration.platform}:`, error);
    }
  }
}

async function updateCustomerSubscription(data: any, organizationId: string) {
  // Update subscription status in database
  await supabase
    .from('customer_subscriptions')
    .upsert({
      customer_email: data.email,
      organization_id: organizationId,
      platform: 'klaviyo',
      subscribed: data.subscribed,
      updated_at: new Date().toISOString()
    });
}

async function trackEmailMetrics(data: any, organizationId: string) {
  // Store email campaign metrics
  await supabase
    .from('email_metrics')
    .insert({
      organization_id: organizationId,
      campaign_id: data.campaign_id,
      event_type: data.type,
      recipient_email: data.email,
      occurred_at: new Date().toISOString()
    });
}

async function trackConversionEvent(data: any, organizationId: string) {
  // Track conversion events for attribution
  await supabase
    .from('conversion_events')
    .insert({
      organization_id: organizationId,
      platform: 'tiktok-ads',
      event_type: data.event_type,
      value: data.value,
      currency: data.currency,
      occurred_at: new Date().toISOString()
    });
}

async function updateOrderPaymentStatus(payment: any, organizationId: string) {
  // Update order payment status
  await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      stripe_payment_intent_id: payment.id,
      paid_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId)
    .eq('stripe_payment_intent_id', payment.id);
}

async function handleSubscriptionChange(subscription: any, organizationId: string) {
  // Handle subscription lifecycle events
  await supabase
    .from('subscriptions')
    .upsert({
      stripe_subscription_id: subscription.id,
      customer_id: subscription.customer,
      organization_id: organizationId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
}

// GET endpoint for webhook verification (some platforms require this)
export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform;
  
  // Handle platform-specific verification challenges
  switch (platform) {
    case 'shopify':
      // Shopify webhook verification
      return NextResponse.json({ verified: true });
      
    case 'facebook':
      // Facebook webhook verification
      const mode = request.nextUrl.searchParams.get('hub.mode');
      const token = request.nextUrl.searchParams.get('hub.verify_token');
      const challenge = request.nextUrl.searchParams.get('hub.challenge');
      
      if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
        return new NextResponse(challenge);
      }
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
      
    default:
      return NextResponse.json({ status: 'ok' });
  }
}