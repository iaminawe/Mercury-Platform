/**
 * Pinterest Business Integration
 * Product catalog sync and advertising for Pinterest Business
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const PinterestAuthSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime()
});

const PinterestCatalogSchema = z.object({
  name: z.string(),
  catalog_type: z.enum(['RETAIL', 'HOTEL']),
  description: z.string().optional(),
  country: z.string(),
  language: z.string(),
  default_currency: z.string(),
  default_availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).optional()
});

const PinterestProductSchema = z.object({
  item_id: z.string(),
  item_group_id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  link: z.string().url(),
  image_link: z.string().url(),
  additional_image_link: z.array(z.string().url()).optional(),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']),
  price: z.string(),
  sale_price: z.string().optional(),
  brand: z.string().optional(),
  mpn: z.string().optional(),
  gtin: z.string().optional(),
  google_product_category: z.string().optional(),
  product_type: z.string().optional(),
  size: z.string().optional(),
  size_type: z.string().optional(),
  size_system: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  pattern: z.string().optional(),
  age_group: z.enum(['ADULT', 'KIDS']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNISEX']).optional(),
  shipping: z.string().optional(),
  shipping_weight: z.string().optional(),
  tax: z.string().optional(),
  custom_label_0: z.string().optional(),
  custom_label_1: z.string().optional(),
  custom_label_2: z.string().optional(),
  custom_label_3: z.string().optional(),
  custom_label_4: z.string().optional()
});

const PinterestCampaignSchema = z.object({
  name: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
  lifetime_spend_cap: z.number().optional(),
  daily_spend_cap: z.number().optional(),
  order_line_id: z.string().optional(),
  tracking_urls: z.object({
    impression: z.array(z.string()).optional(),
    click: z.array(z.string()).optional(),
    engagement: z.array(z.string()).optional(),
    buyable_button: z.array(z.string()).optional(),
    audience_verification: z.array(z.string()).optional()
  }).optional(),
  start_time: z.number().optional(),
  end_time: z.number().optional(),
  summary_status: z.enum(['RUNNING', 'PAUSED', 'NOT_STARTED', 'COMPLETED', 'ADVERTISER_DISABLED', 'ARCHIVED', 'DRAFT']).optional()
});

const PinterestAdGroupSchema = z.object({
  name: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
  budget_in_micro_currency: z.number().optional(),
  bid_in_micro_currency: z.number().optional(),
  budget_type: z.enum(['DAILY', 'LIFETIME']).optional(),
  start_time: z.number().optional(),
  end_time: z.number().optional(),
  targeting_spec: z.object({
    age_bucket: z.array(z.string()).optional(),
    apptype: z.array(z.string()).optional(),
    audience_exclude: z.array(z.string()).optional(),
    audience_include: z.array(z.string()).optional(),
    child_safety_status: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    custom_audience: z.array(z.string()).optional(),
    device_type: z.array(z.string()).optional(),
    gender: z.array(z.string()).optional(),
    geo: z.array(z.string()).optional(),
    interest: z.array(z.string()).optional(),
    locale: z.array(z.string()).optional(),
    location: z.array(z.string()).optional(),
    shopping_retargeting: z.array(z.string()).optional(),
    targeting_strategy: z.array(z.string()).optional()
  }).optional(),
  lifetime_frequency_cap: z.number().optional(),
  tracking_urls: z.object({
    impression: z.array(z.string()).optional(),
    click: z.array(z.string()).optional(),
    engagement: z.array(z.string()).optional(),
    buyable_button: z.array(z.string()).optional(),
    audience_verification: z.array(z.string()).optional()
  }).optional(),
  auto_targeting_enabled: z.boolean().optional(),
  placement_group: z.enum(['ALL', 'SEARCH', 'BROWSE', 'OTHER']).optional(),
  pacing_delivery_type: z.enum(['STANDARD', 'ACCELERATED']).optional(),
  campaign_id: z.string(),
  billable_event: z.enum(['CLICKTHROUGH', 'IMPRESSION', 'VIDEO_V_50_MRC']),
  optimization_goal_metadata: z.object({
    conversion_tag_v3_goal_metadata: z.object({
      attribution_windows: z.object({
        click_window_days: z.number().optional(),
        engagement_window_days: z.number().optional(),
        view_window_days: z.number().optional()
      }).optional(),
      conversion_event: z.string().optional(),
      conversion_tag_id: z.string().optional(),
      cpa_goal_value_in_micro_currency: z.string().optional(),
      is_roas_optimized: z.boolean().optional(),
      learning_mode_type: z.string().optional(),
      roas_goal_value_in_micro_currency: z.string().optional()
    }).optional(),
    frequency_goal_metadata: z.object({
      frequency: z.number().optional(),
      timerange: z.string().optional()
    }).optional(),
    scrollup_goal_metadata: z.object({
      scrollup_goal_value_in_micro_currency: z.string().optional()
    }).optional()
  }).optional()
});

export class PinterestBusinessConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'pinterest-business',
      name: 'Pinterest Business',
      version: '1.0.0',
      description: 'Pinterest Business API integration for product catalogs and advertising',
      category: 'social',
      requiresAuth: true,
      authType: 'oauth2',
      endpoints: {
        auth: 'https://www.pinterest.com/oauth/',
        api: 'https://api.pinterest.com/v5/',
        webhook: 'https://api.pinterest.com/v5/user_account/webhooks/'
      },
      rateLimits: {
        requests: 1000,
        window: 3600, // 1 hour
        burst: 10
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: PinterestAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { code, redirectUri, clientId, clientSecret } = credentials;

    try {
      const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Pinterest auth failed: ${data.error_description || data.error}`);
      }

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId: credentials.userId,
        organizationId: credentials.organizationId,
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          scopes: data.scope.split(','),
          expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Pinterest authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    try {
      const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.credentials.refreshToken
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Pinterest refresh failed: ${data.error_description || data.error}`);
      }

      return {
        ...credentials,
        credentials: {
          ...credentials.credentials,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || credentials.credentials.refreshToken,
          expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString()
        },
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Pinterest token refresh failed: ${error}`);
    }
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      if (credentials.expiresAt && new Date() > credentials.expiresAt) {
        return false;
      }

      const response = await fetch(`${this.config.endpoints.api}user_account`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.credentials.accessToken}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  protected async makeRequest(context: ConnectorExecutionContext): Promise<any> {
    const headers = this.createAuthHeaders(context.credentials);
    const url = `${this.config.endpoints.api}${context.operation.endpoint}`;

    const response = await fetch(url, {
      method: context.operation.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: context.parameters ? JSON.stringify(context.parameters) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Pinterest API error: ${data.message || response.statusText}`);
    }

    return data;
  }

  // Catalog Management
  async createCatalog(
    credentials: ConnectorCredentials,
    adAccountId: string,
    catalogData: z.infer<typeof PinterestCatalogSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-catalog',
        method: 'POST',
        endpoint: `ad_accounts/${adAccountId}/catalogs`,
        description: 'Create a Pinterest product catalog'
      },
      parameters: catalogData
    };

    return this.execute(context);
  }

  async getCatalogs(
    credentials: ConnectorCredentials,
    adAccountId: string,
    filters?: {
      bookmark?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-catalogs',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/catalogs`,
        description: 'Get Pinterest product catalogs'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getCatalog(
    credentials: ConnectorCredentials,
    adAccountId: string,
    catalogId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-catalog',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/catalogs/${catalogId}`,
        description: 'Get Pinterest product catalog details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Product Management
  async uploadProducts(
    credentials: ConnectorCredentials,
    adAccountId: string,
    catalogId: string,
    products: z.infer<typeof PinterestProductSchema>[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'upload-products',
        method: 'POST',
        endpoint: `ad_accounts/${adAccountId}/catalogs/${catalogId}/product_groups/batch`,
        description: 'Upload products to Pinterest catalog'
      },
      parameters: {
        items: products.map(product => ({
          item_batch_record: product
        }))
      }
    };

    return this.execute(context);
  }

  async updateProducts(
    credentials: ConnectorCredentials,
    adAccountId: string,
    catalogId: string,
    products: Partial<z.infer<typeof PinterestProductSchema>>[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-products',
        method: 'PATCH',
        endpoint: `ad_accounts/${adAccountId}/catalogs/${catalogId}/product_groups/batch`,
        description: 'Update products in Pinterest catalog'
      },
      parameters: {
        items: products.map(product => ({
          item_batch_record: product
        }))
      }
    };

    return this.execute(context);
  }

  async getProducts(
    credentials: ConnectorCredentials,
    adAccountId: string,
    catalogId: string,
    filters?: {
      bookmark?: string;
      page_size?: number;
      status?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-products',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/catalogs/${catalogId}/product_groups`,
        description: 'Get products from Pinterest catalog'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Campaign Management
  async createCampaign(
    credentials: ConnectorCredentials,
    adAccountId: string,
    campaignData: z.infer<typeof PinterestCampaignSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-campaign',
        method: 'POST',
        endpoint: `ad_accounts/${adAccountId}/campaigns`,
        description: 'Create a Pinterest ad campaign'
      },
      parameters: [campaignData]
    };

    return this.execute(context);
  }

  async getCampaigns(
    credentials: ConnectorCredentials,
    adAccountId: string,
    filters?: {
      campaign_ids?: string[];
      entity_statuses?: string[];
      page_size?: number;
      order?: string;
      bookmark?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-campaigns',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/campaigns`,
        description: 'Get Pinterest ad campaigns'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async updateCampaign(
    credentials: ConnectorCredentials,
    adAccountId: string,
    campaignId: string,
    updates: Partial<z.infer<typeof PinterestCampaignSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-campaign',
        method: 'PATCH',
        endpoint: `ad_accounts/${adAccountId}/campaigns`,
        description: 'Update Pinterest ad campaign'
      },
      parameters: [{
        id: campaignId,
        ...updates
      }]
    };

    return this.execute(context);
  }

  // Ad Group Management
  async createAdGroup(
    credentials: ConnectorCredentials,
    adAccountId: string,
    adGroupData: z.infer<typeof PinterestAdGroupSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-adgroup',
        method: 'POST',
        endpoint: `ad_accounts/${adAccountId}/ad_groups`,
        description: 'Create a Pinterest ad group'
      },
      parameters: [adGroupData]
    };

    return this.execute(context);
  }

  async getAdGroups(
    credentials: ConnectorCredentials,
    adAccountId: string,
    filters?: {
      campaign_ids?: string[];
      ad_group_ids?: string[];
      entity_statuses?: string[];
      page_size?: number;
      order?: string;
      bookmark?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-adgroups',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/ad_groups`,
        description: 'Get Pinterest ad groups'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Analytics and Reporting
  async getCampaignAnalytics(
    credentials: ConnectorCredentials,
    adAccountId: string,
    campaignIds: string[],
    dateRange: {
      start_date: string;
      end_date: string;
    },
    metrics: string[],
    granularity: 'TOTAL' | 'DAY' | 'HOUR' | 'WEEK' | 'MONTH' = 'TOTAL'
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-campaign-analytics',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/campaigns/analytics`,
        description: 'Get Pinterest campaign analytics'
      },
      parameters: {
        campaign_ids: campaignIds,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        columns: metrics,
        granularity
      }
    };

    return this.execute(context);
  }

  async getAdGroupAnalytics(
    credentials: ConnectorCredentials,
    adAccountId: string,
    adGroupIds: string[],
    dateRange: {
      start_date: string;
      end_date: string;
    },
    metrics: string[],
    granularity: 'TOTAL' | 'DAY' | 'HOUR' | 'WEEK' | 'MONTH' = 'TOTAL'
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-adgroup-analytics',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/ad_groups/analytics`,
        description: 'Get Pinterest ad group analytics'
      },
      parameters: {
        ad_group_ids: adGroupIds,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        columns: metrics,
        granularity
      }
    };

    return this.execute(context);
  }

  // Audience Management
  async createAudience(
    credentials: ConnectorCredentials,
    adAccountId: string,
    audienceData: {
      name: string;
      audience_type: 'VISITOR' | 'ENGAGEMENT' | 'CUSTOMER_LIST' | 'ACTALIKE';
      description?: string;
      rule?: any;
      retention_days?: number;
      is_owned?: boolean;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-audience',
        method: 'POST',
        endpoint: `ad_accounts/${adAccountId}/audiences`,
        description: 'Create Pinterest custom audience'
      },
      parameters: audienceData
    };

    return this.execute(context);
  }

  async getAudiences(
    credentials: ConnectorCredentials,
    adAccountId: string,
    filters?: {
      bookmark?: string;
      page_size?: number;
      order?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-audiences',
        method: 'GET',
        endpoint: `ad_accounts/${adAccountId}/audiences`,
        description: 'Get Pinterest custom audiences'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Board and Pin Management (Organic)
  async createBoard(
    credentials: ConnectorCredentials,
    boardData: {
      name: string;
      description?: string;
      privacy?: 'PUBLIC' | 'PROTECTED' | 'SECRET';
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-board',
        method: 'POST',
        endpoint: 'boards',
        description: 'Create Pinterest board'
      },
      parameters: boardData
    };

    return this.execute(context);
  }

  async createPin(
    credentials: ConnectorCredentials,
    pinData: {
      board_id: string;
      title?: string;
      description?: string;
      link?: string;
      media_source: {
        source_type: 'image_url' | 'image_base64' | 'video_url';
        content_type: string;
        data: string;
        url?: string;
        cover_image_url?: string;
        cover_image_content_type?: string;
        cover_image_data?: string;
        media_id?: string;
        items?: any[];
      };
      parent_pin_id?: string;
      alt_text?: string;
      board_section_id?: string;
      note?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-pin',
        method: 'POST',
        endpoint: 'pins',
        description: 'Create Pinterest pin'
      },
      parameters: pinData
    };

    return this.execute(context);
  }

  async getBoards(
    credentials: ConnectorCredentials,
    filters?: {
      bookmark?: string;
      page_size?: number;
      privacy?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-boards',
        method: 'GET',
        endpoint: 'boards',
        description: 'Get Pinterest boards'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getPins(
    credentials: ConnectorCredentials,
    boardId: string,
    filters?: {
      bookmark?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-pins',
        method: 'GET',
        endpoint: `boards/${boardId}/pins`,
        description: 'Get Pinterest pins from board'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    return {
      'Authorization': `Bearer ${credentials.credentials.accessToken}`
    };
  }
}

export default new PinterestBusinessConnector();