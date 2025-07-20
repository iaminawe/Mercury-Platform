# Shopify OAuth Implementation

## Overview

This document describes the Shopify OAuth implementation for Mercury, providing secure authentication and authorization for Shopify stores.

## OAuth Flow

1. **Installation Initiation** (`/install`)
   - User enters their Shopify store domain
   - Domain is validated and cleaned

2. **OAuth Authorization** (`/api/auth/shopify`)
   - Generates CSRF state token
   - Redirects to Shopify authorization URL
   - Stores state in secure HTTP-only cookie

3. **OAuth Callback** (`/api/auth/callback`)
   - Validates state parameter (CSRF protection)
   - Validates HMAC signature
   - Exchanges authorization code for access token
   - Fetches shop information
   - Creates/updates user and store records in Supabase
   - Registers webhooks
   - Redirects to dashboard

## Security Features

### HMAC Validation
- All requests from Shopify are validated using HMAC-SHA256
- Ensures requests are authentic and haven't been tampered with

### State Parameter
- Random 16-byte state parameter for CSRF protection
- Stored in HTTP-only cookie during OAuth flow
- Validated on callback

### Secure Token Storage
- Access tokens are stored encrypted in Supabase
- Never exposed to client-side code
- Tokens are cleared when store is disconnected

## Required Scopes

The following Shopify API scopes are requested:

- `read_products, write_products` - Product management
- `read_orders` - Order data access
- `read_customers` - Customer information
- `read_analytics` - Analytics data

## Database Schema

### Stores Table
```typescript
{
  id: string
  shop_domain: string
  access_token: string (encrypted)
  shop_name: string
  email: string
  owner_id: string
  plan: string
  is_active: boolean
  settings: {
    currency: string
    timezone: string
    country: string
    primary_location_id: string
  }
  created_at: string
  updated_at: string
}
```

## Environment Variables

Required environment variables for OAuth:

```env
# Shopify App Credentials
SHOPIFY_APP_API_KEY=your_api_key
SHOPIFY_APP_API_SECRET=your_api_secret
SHOPIFY_APP_SCOPES=read_products,write_products,read_orders,read_customers,read_analytics
SHOPIFY_APP_HOST=https://your-app-url.com

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=your_session_secret_at_least_32_chars

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Error Handling

The OAuth flow includes comprehensive error handling:

- Missing parameters
- Invalid shop domain
- HMAC validation failures
- State parameter mismatches
- Token exchange failures
- Database operation errors

All errors redirect to `/install` with appropriate error messages.

## Webhook Registration

After successful OAuth, the following webhooks are automatically registered:

- `products/create`
- `products/update`
- `products/delete`
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `app/uninstalled`

## Middleware Protection

The middleware (`middleware.ts`) ensures:

- Protected routes require authentication
- Users with no active store are redirected to install
- Authenticated users can't access auth routes

## Usage

### Installing the App

1. Navigate to `/install`
2. Enter your Shopify store domain
3. Click "Install App"
4. Authorize the app on Shopify
5. You'll be redirected to the dashboard

### Managing Connection

- View store details in `/settings`
- Disconnect store using the "Disconnect Store" button
- Sign out to end your session

## Testing

To test the OAuth flow locally:

1. Set up a Shopify development store
2. Create a custom app in the Shopify Partners dashboard
3. Set the redirect URL to `http://localhost:3000/api/auth/callback`
4. Add the credentials to your `.env.local` file
5. Run the app with `npm run dev`

## Security Best Practices

1. Always validate HMAC signatures
2. Use HTTPS in production
3. Rotate API secrets regularly
4. Monitor webhook logs for suspicious activity
5. Implement rate limiting on OAuth endpoints
6. Log all authentication attempts