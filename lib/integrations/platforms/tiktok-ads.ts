/**
 * TikTok Ads Integration
 * Campaign management and analytics for TikTok Business
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const TikTokAuthSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  advertiserIds: z.array(z.string()),
  expiresAt: z.string().datetime()
});

const TikTokCampaignSchema = z.object({
  campaign_name: z.string(),
  objective_type: z.enum(['REACH', 'TRAFFIC', 'APP_INSTALL', 'VIDEO_VIEW', 'LEAD_GENERATION', 'CONVERSIONS']),
  budget_mode: z.enum(['BUDGET_MODE_DAY', 'BUDGET_MODE_TOTAL']),
  budget: z.number(),
  bid_type: z.enum(['BID_TYPE_NO_BID', 'BID_TYPE_CUSTOM']),
  optimization_goal: z.string().optional(),
  schedule_type: z.enum(['SCHEDULE_FROM_NOW', 'SCHEDULE_START_END']),
  schedule_start_time: z.string().optional(),
  schedule_end_time: z.string().optional()
});

const TikTokAdGroupSchema = z.object({
  campaign_id: z.string(),
  adgroup_name: z.string(),
  placement_type: z.enum(['PLACEMENT_TYPE_AUTOMATIC', 'PLACEMENT_TYPE_NORMAL']),
  placements: z.array(z.string()).optional(),
  targeting: z.object({
    age_groups: z.array(z.string()).optional(),
    genders: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    locations: z.array(z.object({
      location_type: z.string(),
      location_ids: z.array(z.string())
    })).optional(),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional()
  }).optional(),
  budget: z.number(),
  schedule_type: z.enum(['SCHEDULE_FROM_NOW', 'SCHEDULE_START_END']),
  schedule_start_time: z.string().optional(),
  schedule_end_time: z.string().optional()
});

const TikTokAdSchema = z.object({
  adgroup_id: z.string(),
  ad_name: z.string(),
  ad_format: z.enum(['SINGLE_IMAGE', 'SINGLE_VIDEO', 'COLLECTION', 'SPARK_AD']),
  ad_text: z.string(),
  call_to_action: z.string().optional(),
  landing_page_url: z.string().url().optional(),
  display_name: z.string().optional(),
  identity_id: z.string().optional(),
  identity_type: z.enum(['CUSTOMIZED_USER', 'CATALOG']).optional(),
  creative_material_mode: z.enum(['CUSTOM', 'DYNAMIC']).optional(),
  creatives: z.array(z.object({
    image_ids: z.array(z.string()).optional(),
    video_id: z.string().optional(),
    text: z.string().optional(),
    call_to_action: z.string().optional()
  }))
});

export class TikTokAdsConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'tiktok-ads',
      name: 'TikTok for Business',
      version: '1.0.0',
      description: 'TikTok Ads API integration for campaign management and analytics',
      category: 'social',
      requiresAuth: true,
      authType: 'oauth2',
      endpoints: {
        auth: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
        api: 'https://business-api.tiktok.com/open_api/v1.3/',
        webhook: 'https://business-api.tiktok.com/open_api/v1.3/pixel/track/'
      },
      rateLimits: {
        requests: 1000,
        window: 3600, // 1 hour
        burst: 100
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: TikTokAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { code, redirectUri, clientId, clientSecret } = credentials;

    try {
      const response = await fetch(`${this.config.endpoints.auth}access_token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          auth_code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`TikTok auth failed: ${data.message}`);
      }

      // Get advertiser accounts
      const advertiserResponse = await fetch(`${this.config.endpoints.api}oauth2/advertiser/get/`, {
        method: 'GET',
        headers: {
          'Access-Token': data.data.access_token
        }
      });

      const advertiserData = await advertiserResponse.json();

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId: credentials.userId,
        organizationId: credentials.organizationId,
        credentials: {
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          advertiserIds: advertiserData.data?.list?.map((adv: any) => adv.advertiser_id) || [],
          expiresAt: new Date(Date.now() + data.data.expires_in * 1000).toISOString()
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + data.data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`TikTok authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    try {
      const response = await fetch(`${this.config.endpoints.auth}refresh_token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.TIKTOK_CLIENT_ID,
          client_secret: process.env.TIKTOK_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: credentials.credentials.refreshToken
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`TikTok refresh failed: ${data.message}`);
      }

      return {
        ...credentials,
        credentials: {
          ...credentials.credentials,
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          expiresAt: new Date(Date.now() + data.data.expires_in * 1000).toISOString()
        },
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + data.data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`TikTok token refresh failed: ${error}`);
    }
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      if (credentials.expiresAt && new Date() > credentials.expiresAt) {
        return false;
      }

      const response = await fetch(`${this.config.endpoints.api}oauth2/advertiser/get/`, {
        method: 'GET',
        headers: {
          'Access-Token': credentials.credentials.accessToken
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
      throw new Error(`TikTok API error: ${data.message || response.statusText}`);
    }

    return data;
  }

  // Campaign Management Methods
  async createCampaign(
    credentials: ConnectorCredentials,
    advertiserId: string,
    campaignData: z.infer<typeof TikTokCampaignSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-campaign',
        method: 'POST',
        endpoint: 'campaign/create/',
        description: 'Create a new TikTok ad campaign'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...campaignData
      }
    };

    return this.execute(context);
  }

  async getCampaigns(
    credentials: ConnectorCredentials,
    advertiserId: string,
    filters?: {
      campaign_ids?: string[];
      primary_status?: string;
      objective_type?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-campaigns',
        method: 'GET',
        endpoint: 'campaign/get/',
        description: 'Get TikTok ad campaigns'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...filters
      }
    };

    return this.execute(context);
  }

  async updateCampaign(
    credentials: ConnectorCredentials,
    advertiserId: string,
    campaignId: string,
    updates: Partial<z.infer<typeof TikTokCampaignSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-campaign',
        method: 'POST',
        endpoint: 'campaign/update/',
        description: 'Update TikTok ad campaign'
      },
      parameters: {
        advertiser_id: advertiserId,
        campaign_id: campaignId,
        ...updates
      }
    };

    return this.execute(context);
  }

  // Ad Group Management
  async createAdGroup(
    credentials: ConnectorCredentials,
    advertiserId: string,
    adGroupData: z.infer<typeof TikTokAdGroupSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-adgroup',
        method: 'POST',
        endpoint: 'adgroup/create/',
        description: 'Create a new TikTok ad group'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...adGroupData
      }
    };

    return this.execute(context);
  }

  async getAdGroups(
    credentials: ConnectorCredentials,
    advertiserId: string,
    filters?: {
      campaign_ids?: string[];
      adgroup_ids?: string[];
      primary_status?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-adgroups',
        method: 'GET',
        endpoint: 'adgroup/get/',
        description: 'Get TikTok ad groups'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...filters
      }
    };

    return this.execute(context);
  }

  // Ad Management
  async createAd(
    credentials: ConnectorCredentials,
    advertiserId: string,
    adData: z.infer<typeof TikTokAdSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-ad',
        method: 'POST',
        endpoint: 'ad/create/',
        description: 'Create a new TikTok ad'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...adData
      }
    };

    return this.execute(context);
  }

  async getAds(
    credentials: ConnectorCredentials,
    advertiserId: string,
    filters?: {
      campaign_ids?: string[];
      adgroup_ids?: string[];
      ad_ids?: string[];
      primary_status?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-ads',
        method: 'GET',
        endpoint: 'ad/get/',
        description: 'Get TikTok ads'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...filters
      }
    };

    return this.execute(context);
  }

  // Analytics and Reporting
  async getReports(
    credentials: ConnectorCredentials,
    advertiserId: string,
    reportConfig: {
      report_type: 'BASIC' | 'AUCTION' | 'AUDIENCE' | 'PLAYABLE_MATERIAL' | 'CATALOG_LISTING';
      data_level: 'AUCTION_CAMPAIGN' | 'AUCTION_ADGROUP' | 'AUCTION_AD';
      dimensions: string[];
      metrics: string[];
      start_date: string;
      end_date: string;
      filters?: any[];
      page?: number;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-reports',
        method: 'GET',
        endpoint: 'report/integrated/get/',
        description: 'Get TikTok advertising reports'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...reportConfig
      }
    };

    return this.execute(context);
  }

  async getInsights(
    credentials: ConnectorCredentials,
    advertiserId: string,
    insights: {
      objective_type?: string;
      placements?: string[];
      special_industries?: string[];
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-insights',
        method: 'GET',
        endpoint: 'tool/target_recommend/',
        description: 'Get TikTok targeting insights'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...insights
      }
    };

    return this.execute(context);
  }

  // Creative Management
  async uploadImage(
    credentials: ConnectorCredentials,
    advertiserId: string,
    imageData: {
      image_file: string; // base64 encoded
      image_signature: string;
      upload_type: 'UPLOAD_BY_FILE' | 'UPLOAD_BY_URL';
      image_url?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'upload-image',
        method: 'POST',
        endpoint: 'file/image/ad/upload/',
        description: 'Upload image for TikTok ads'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...imageData
      }
    };

    return this.execute(context);
  }

  async uploadVideo(
    credentials: ConnectorCredentials,
    advertiserId: string,
    videoData: {
      video_file?: string; // base64 encoded
      video_signature?: string;
      upload_type: 'UPLOAD_BY_FILE' | 'UPLOAD_BY_URL' | 'UPLOAD_BY_VIDEO_ID';
      video_url?: string;
      video_id?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'upload-video',
        method: 'POST',
        endpoint: 'file/video/ad/upload/',
        description: 'Upload video for TikTok ads'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...videoData
      }
    };

    return this.execute(context);
  }

  // Audience Management
  async createCustomAudience(
    credentials: ConnectorCredentials,
    advertiserId: string,
    audienceData: {
      custom_audience_name: string;
      audience_type: 'CUSTOMER_FILE' | 'WEBSITE_TRAFFIC' | 'APP_ACTIVITY' | 'ENGAGEMENT' | 'VIDEO_VIEWS';
      sub_type?: string;
      rule?: any;
      retention_in_days?: number;
      is_auto_update?: boolean;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-audience',
        method: 'POST',
        endpoint: 'dmp/custom_audience/create/',
        description: 'Create custom audience for TikTok ads'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...audienceData
      }
    };

    return this.execute(context);
  }

  async getCustomAudiences(
    credentials: ConnectorCredentials,
    advertiserId: string,
    filters?: {
      custom_audience_ids?: string[];
      page?: number;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-audiences',
        method: 'GET',
        endpoint: 'dmp/custom_audience/list/',
        description: 'Get custom audiences for TikTok ads'
      },
      parameters: {
        advertiser_id: advertiserId,
        ...filters
      }
    };

    return this.execute(context);
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    return {
      'Access-Token': credentials.credentials.accessToken
    };
  }
}

export default new TikTokAdsConnector();