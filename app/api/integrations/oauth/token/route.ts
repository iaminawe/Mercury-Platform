import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ConnectorRegistry from '@/lib/integrations/connector-framework';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OAuthTokenRequest {
  platform: string;
  code: string;
  state?: string;
}

// Platform-specific OAuth configurations
const oauthConfigs: Record<string, {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}> = {
  'tiktok-ads': {
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    clientId: process.env.TIKTOK_CLIENT_ID!,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET!
  },
  'pinterest-business': {
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    clientId: process.env.PINTEREST_CLIENT_ID!,
    clientSecret: process.env.PINTEREST_CLIENT_SECRET!
  },
  'slack': {
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!
  }
};

export async function POST(request: NextRequest) {
  try {
    const body: OAuthTokenRequest = await request.json();
    const { platform, code, state } = body;

    // Validate platform
    const config = oauthConfigs[platform];
    if (!config) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Get the redirect URI from the request origin
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const redirectUri = `${origin}/integrations/oauth/callback`;

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      platform,
      code,
      redirectUri,
      config
    );

    if (!tokenResponse.success) {
      return NextResponse.json(
        { error: tokenResponse.error },
        { status: 400 }
      );
    }

    // Get the user from the session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Save the integration
    const connector = ConnectorRegistry.get(platform);
    if (connector) {
      const credentials = await connector.authenticate({
        ...tokenResponse.data,
        userId: user.id,
        organizationId: member.organization_id
      });

      await supabase
        .from('integrations')
        .upsert({
          id: credentials.id,
          organization_id: member.organization_id,
          platform,
          credentials: credentials.credentials,
          status: 'active',
          created_by: user.id,
          updated_at: new Date().toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      ...tokenResponse.data
    });

  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange authorization code' },
      { status: 500 }
    );
  }
}

async function exchangeCodeForTokens(
  platform: string,
  code: string,
  redirectUri: string,
  config: typeof oauthConfigs[string]
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    let response: Response;
    
    switch (platform) {
      case 'tiktok-ads':
        response = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            auth_code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
          })
        });
        break;
        
      case 'pinterest-business':
        const pinterestParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        });
        
        response = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: pinterestParams
        });
        break;
        
      case 'slack':
        const slackParams = new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri
        });
        
        response = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: slackParams
        });
        break;
        
      default:
        return { success: false, error: 'Unsupported platform' };
    }

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: data.error || data.message || 'Token exchange failed' 
      };
    }

    // Normalize the response based on platform
    let normalizedData;
    switch (platform) {
      case 'tiktok-ads':
        normalizedData = {
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          expiresIn: data.data.expires_in,
          tokenType: 'Bearer',
          scope: data.data.scope
        };
        break;
        
      case 'pinterest-business':
        normalizedData = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          scope: data.scope
        };
        break;
        
      case 'slack':
        normalizedData = {
          accessToken: data.access_token,
          tokenType: 'Bearer',
          scope: data.scope,
          teamId: data.team?.id,
          teamName: data.team?.name,
          authedUser: data.authed_user
        };
        break;
        
      default:
        normalizedData = data;
    }

    return { success: true, data: normalizedData };

  } catch (error) {
    console.error('Token exchange error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}