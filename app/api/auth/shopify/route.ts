import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '@/lib/shopify/client';
import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

const logger = createLogger('shopify-oauth');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shop = searchParams.get('shop');

    if (!shop) {
      logger.error('Shop parameter missing');
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Validate shop domain
    const shopRegex = /^[a-z0-9-]+\.myshopify\.com$/;
    if (!shopRegex.test(shop)) {
      logger.error('Invalid shop domain', { shop });
      return NextResponse.json(
        { error: 'Invalid shop domain' },
        { status: 400 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state in a cookie for verification during callback
    const response = NextResponse.redirect(
      await shopify.auth.getAuthorizationUrl({
        shop,
        state,
        isOnline: false, // We want offline access tokens
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      })
    );

    // Set the state cookie
    response.cookies.set('shopify-oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    logger.info('OAuth flow initiated', { shop });
    return response;
  } catch (error) {
    logger.error('OAuth initiation error', { error });
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}