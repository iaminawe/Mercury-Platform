import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('shopify-client');

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_APP_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_APP_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES!.split(','),
  hostName: process.env.SHOPIFY_APP_HOST!.replace(/https?:\/\//, ''),
  apiVersion: ApiVersion.January24,
  isEmbeddedApp: true,
  logger: {
    log: (severity, message) => {
      switch (severity) {
        case 'error':
          logger.error(message);
          break;
        case 'warning':
          logger.warn(message);
          break;
        case 'info':
          logger.info(message);
          break;
        case 'debug':
          logger.debug(message);
          break;
      }
    },
  },
});

// Create a Shopify session from store data
export function createShopifySession(shop: string, accessToken: string): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: '',
    isOnline: false,
    accessToken,
    scope: process.env.SHOPIFY_APP_SCOPES!,
  });
}

// Helper to get REST client for a shop
export function getShopifyClient(shop: string, accessToken: string) {
  const session = createShopifySession(shop, accessToken);
  return new shopify.clients.Rest({ session });
}

// Helper to get GraphQL client for a shop
export function getShopifyGraphQLClient(shop: string, accessToken: string) {
  const session = createShopifySession(shop, accessToken);
  return new shopify.clients.Graphql({ session });
}

// Webhook configuration
export const WEBHOOK_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'app/uninstalled',
] as const;

export type WebhookTopic = typeof WEBHOOK_TOPICS[number];

// Register webhooks for a shop
export async function registerWebhooks(shop: string, accessToken: string) {
  const webhookUrl = `${process.env.SHOPIFY_APP_HOST}/api/webhooks/shopify`;
  const client = getShopifyClient(shop, accessToken);

  const results = await Promise.all(
    WEBHOOK_TOPICS.map(async (topic) => {
      try {
        const response = await client.post({
          path: 'webhooks',
          data: {
            webhook: {
              topic,
              address: webhookUrl,
              format: 'json',
            },
          },
        });

        logger.info('Webhook registered', { shop, topic });
        return { topic, success: true };
      } catch (error: any) {
        // Check if webhook already exists
        if (error.response?.body?.errors?.includes('already exists')) {
          logger.info('Webhook already exists', { shop, topic });
          return { topic, success: true };
        }

        logger.error('Failed to register webhook', { shop, topic, error });
        return { topic, success: false, error };
      }
    })
  );

  return results;
}

// Unregister all webhooks for a shop
export async function unregisterWebhooks(shop: string, accessToken: string) {
  const client = getShopifyClient(shop, accessToken);

  try {
    // Get all webhooks
    const response = await client.get({
      path: 'webhooks',
    });

    const webhooks = response.body.webhooks || [];

    // Delete each webhook
    await Promise.all(
      webhooks.map(async (webhook: any) => {
        try {
          await client.delete({
            path: `webhooks/${webhook.id}`,
          });
          logger.info('Webhook unregistered', { shop, id: webhook.id });
        } catch (error) {
          logger.error('Failed to unregister webhook', {
            shop,
            id: webhook.id,
            error,
          });
        }
      })
    );

    return true;
  } catch (error) {
    logger.error('Failed to unregister webhooks', { shop, error });
    return false;
  }
}