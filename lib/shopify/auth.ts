import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

const logger = createLogger('shopify-auth');

export interface ShopifyOAuthQuery {
  code?: string;
  shop?: string;
  state?: string;
  hmac?: string;
  timestamp?: string;
  [key: string]: string | undefined;
}

/**
 * Validates the HMAC signature from Shopify
 */
export function validateHMAC(query: ShopifyOAuthQuery): boolean {
  const { hmac, ...params } = query;

  if (!hmac) {
    logger.error('HMAC missing from query');
    return false;
  }

  // Create the query string (sorted by key)
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined) {
        acc.push(`${key}=${params[key]}`);
      }
      return acc;
    }, [] as string[]);

  const message = sortedParams.join('&');

  // Generate HMAC
  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_APP_API_SECRET!)
    .update(message)
    .digest('hex');

  const isValid = generatedHmac === hmac;

  if (!isValid) {
    logger.error('HMAC validation failed', {
      expected: hmac,
      generated: generatedHmac,
      message,
    });
  }

  return isValid;
}

/**
 * Validates a Shopify shop domain
 */
export function validateShopDomain(shop: string): boolean {
  const shopRegex = /^[a-z0-9-]+\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * Generates a secure random state parameter
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Builds the Shopify OAuth authorization URL
 */
export function buildAuthUrl(shop: string, state: string): string {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
  const scopes = process.env.SHOPIFY_APP_SCOPES!;
  const apiKey = process.env.SHOPIFY_APP_API_KEY!;

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', apiKey);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

/**
 * Exchanges the authorization code for an access token
 */
export async function exchangeToken(shop: string, code: string): Promise<string> {
  const apiKey = process.env.SHOPIFY_APP_API_KEY!;
  const apiSecret = process.env.SHOPIFY_APP_API_SECRET!;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Token exchange failed', { shop, error });
    throw new Error('Failed to exchange token');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Creates a secure session token
 */
export function createSessionToken(shop: string, userId: string): string {
  const payload = {
    shop,
    userId,
    timestamp: Date.now(),
  };

  const token = crypto
    .createHmac('sha256', process.env.SESSION_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');

  return token;
}

/**
 * Verifies a session token
 */
export function verifySessionToken(token: string, shop: string, userId: string): boolean {
  const expectedToken = createSessionToken(shop, userId);
  return token === expectedToken;
}