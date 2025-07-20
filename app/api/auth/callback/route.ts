import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '@/lib/shopify/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { registerWebhooks } from '@/lib/shopify/client';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const logger = createLogger('shopify-callback');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shop = searchParams.get('shop');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const hmac = searchParams.get('hmac');

    // Validate required parameters
    if (!shop || !code || !state || !hmac) {
      logger.error('Missing required parameters');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/install?error=missing_parameters`
      );
    }

    // Validate state parameter
    const storedState = request.cookies.get('shopify-oauth-state')?.value;
    if (!storedState || storedState !== state) {
      logger.error('Invalid state parameter', { state, storedState });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/install?error=invalid_state`
      );
    }

    // Validate HMAC
    const params = new URLSearchParams(searchParams.toString());
    params.delete('hmac');
    const message = params.toString();
    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_APP_API_SECRET!)
      .update(message)
      .digest('hex');

    if (generatedHmac !== hmac) {
      logger.error('Invalid HMAC', { hmac, generatedHmac });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/install?error=invalid_hmac`
      );
    }

    // Exchange code for access token
    const { session } = await shopify.auth.callback({
      rawRequest: request,
    });

    if (!session?.accessToken) {
      logger.error('Failed to obtain access token');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/install?error=token_exchange_failed`
      );
    }

    // Get shop information
    const client = new shopify.clients.Rest({ session });
    const shopData = await client.get({
      path: 'shop',
    });

    const shopInfo = shopData.body.shop;

    // Initialize Supabase client
    const supabase = await createServerSupabaseClient();

    // Check if store already exists
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id, owner_id')
      .eq('shop_domain', shop)
      .single();

    if (existingStore) {
      // Update existing store
      const { error: updateError } = await supabase
        .from('stores')
        .update({
          access_token: session.accessToken,
          shop_name: shopInfo.name,
          email: shopInfo.email,
          plan: shopInfo.plan_name,
          is_active: true,
          updated_at: new Date().toISOString(),
          settings: {
            currency: shopInfo.currency,
            timezone: shopInfo.timezone,
            country: shopInfo.country_name,
            primary_location_id: shopInfo.primary_location_id,
          },
        })
        .eq('id', existingStore.id);

      if (updateError) {
        logger.error('Failed to update store', { error: updateError });
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/install?error=store_update_failed`
        );
      }

      // Sign in the existing user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: shopInfo.email,
        password: session.accessToken, // Using access token as password for now
      });

      if (signInError) {
        logger.warn('Could not auto-sign in user', { error: signInError });
      }
    } else {
      // Create new user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: shopInfo.email,
        password: session.accessToken, // Using access token as password for now
        options: {
          data: {
            shop_domain: shop,
            shop_name: shopInfo.name,
          },
        },
      });

      if (authError) {
        logger.error('Failed to create user', { error: authError });
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/install?error=user_creation_failed`
        );
      }

      // Create new store
      const { error: storeError } = await supabase.from('stores').insert({
        shop_domain: shop,
        access_token: session.accessToken,
        shop_name: shopInfo.name,
        email: shopInfo.email,
        owner_id: authData.user!.id,
        plan: shopInfo.plan_name,
        is_active: true,
        settings: {
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          country: shopInfo.country_name,
          primary_location_id: shopInfo.primary_location_id,
        },
      });

      if (storeError) {
        logger.error('Failed to create store', { error: storeError });
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/install?error=store_creation_failed`
        );
      }
    }

    // Register webhooks
    try {
      await registerWebhooks(shop, session.accessToken);
      logger.info('Webhooks registered successfully', { shop });
    } catch (error) {
      logger.error('Failed to register webhooks', { shop, error });
      // Continue anyway - webhooks can be registered later
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
    response.cookies.delete('shopify-oauth-state');

    logger.info('OAuth flow completed successfully', { shop });
    return response;
  } catch (error) {
    logger.error('OAuth callback error', { error });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/install?error=unexpected_error`
    );
  }
}