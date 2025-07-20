/**
 * Klaviyo Email Marketing Integration
 * Advanced email marketing sync and automation
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const KlaviyoAuthSchema = z.object({
  apiKey: z.string(),
  publicApiKey: z.string().optional()
});

const KlaviyoListSchema = z.object({
  name: z.string(),
  list_type: z.enum(['list', 'segment']).optional()
});

const KlaviyoProfileSchema = z.object({
  email: z.string().email(),
  phone_number: z.string().optional(),
  external_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  organization: z.string().optional(),
  title: z.string().optional(),
  image: z.string().url().optional(),
  location: z.object({
    address1: z.string().optional(),
    address2: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    region: z.string().optional(),
    zip: z.string().optional(),
    timezone: z.string().optional()
  }).optional(),
  properties: z.record(z.any()).optional()
});

const KlaviyoCampaignSchema = z.object({
  name: z.string(),
  subject: z.string(),
  from_email: z.string().email(),
  from_name: z.string(),
  list_id: z.string(),
  template_id: z.string().optional(),
  content: z.object({
    html: z.string().optional(),
    text: z.string().optional()
  }).optional(),
  options: z.object({
    use_smart_sending: z.boolean().optional(),
    add_google_analytics: z.boolean().optional(),
    track_clicks: z.boolean().optional(),
    track_opens: z.boolean().optional()
  }).optional()
});

const KlaviyoEventSchema = z.object({
  event: z.string(),
  customer_properties: z.object({
    email: z.string().email(),
    phone_number: z.string().optional(),
    external_id: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    properties: z.record(z.any()).optional()
  }),
  properties: z.record(z.any()).optional(),
  time: z.number().optional() // Unix timestamp
});

const KlaviyoFlowSchema = z.object({
  name: z.string(),
  status: z.enum(['draft', 'live', 'stopped', 'archived']),
  trigger_filters: z.array(z.object({
    type: z.string(),
    filter: z.record(z.any())
  })).optional(),
  actions: z.array(z.object({
    type: z.string(),
    settings: z.record(z.any())
  })).optional()
});

export class KlaviyoConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'klaviyo',
      name: 'Klaviyo',
      version: '1.0.0',
      description: 'Klaviyo email marketing platform integration',
      category: 'email',
      requiresAuth: true,
      authType: 'api_key',
      endpoints: {
        api: 'https://a.klaviyo.com/api/',
      },
      rateLimits: {
        requests: 3000,
        window: 3600, // 1 hour
        burst: 150
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: KlaviyoAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { apiKey, publicApiKey, userId, organizationId } = credentials;

    try {
      // Test the credentials by making a simple API call
      const response = await fetch(`${this.config.endpoints.api}accounts/`, {
        method: 'GET',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'revision': '2024-07-15'
        }
      });

      if (!response.ok) {
        throw new Error(`Klaviyo auth failed: ${response.statusText}`);
      }

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId,
        organizationId,
        credentials: {
          apiKey,
          publicApiKey
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Klaviyo authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    // Klaviyo uses API key auth which doesn't expire
    return credentials;
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoints.api}accounts/`, {
        method: 'GET',
        headers: {
          'Authorization': `Klaviyo-API-Key ${credentials.credentials.apiKey}`,
          'revision': '2024-07-15'
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
        'revision': '2024-07-15',
        ...headers
      },
      body: context.parameters ? JSON.stringify(context.parameters) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Klaviyo API error: ${data.detail || response.statusText}`);
    }

    return data;
  }

  // Profile Management
  async createProfile(
    credentials: ConnectorCredentials,
    profileData: z.infer<typeof KlaviyoProfileSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-profile',
        method: 'POST',
        endpoint: 'profiles/',
        description: 'Create a new Klaviyo profile'
      },
      parameters: {
        data: {
          type: 'profile',
          attributes: profileData
        }
      }
    };

    return this.execute(context);
  }

  async getProfiles(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
      additional_fields?: string[];
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-profiles',
        method: 'GET',
        endpoint: 'profiles/',
        description: 'Get Klaviyo profiles'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getProfile(
    credentials: ConnectorCredentials,
    profileId: string,
    additionalFields?: string[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-profile',
        method: 'GET',
        endpoint: `profiles/${profileId}/`,
        description: 'Get Klaviyo profile details'
      },
      parameters: {
        additional_fields: additionalFields
      }
    };

    return this.execute(context);
  }

  async updateProfile(
    credentials: ConnectorCredentials,
    profileId: string,
    updates: Partial<z.infer<typeof KlaviyoProfileSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-profile',
        method: 'PATCH',
        endpoint: `profiles/${profileId}/`,
        description: 'Update Klaviyo profile'
      },
      parameters: {
        data: {
          type: 'profile',
          id: profileId,
          attributes: updates
        }
      }
    };

    return this.execute(context);
  }

  // List Management
  async createList(
    credentials: ConnectorCredentials,
    listData: z.infer<typeof KlaviyoListSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-list',
        method: 'POST',
        endpoint: 'lists/',
        description: 'Create a new Klaviyo list'
      },
      parameters: {
        data: {
          type: 'list',
          attributes: listData
        }
      }
    };

    return this.execute(context);
  }

  async getLists(
    credentials: ConnectorCredentials,
    filters?: {
      page_cursor?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-lists',
        method: 'GET',
        endpoint: 'lists/',
        description: 'Get Klaviyo lists'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async addProfileToList(
    credentials: ConnectorCredentials,
    listId: string,
    profileIds: string[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'add-profiles-to-list',
        method: 'POST',
        endpoint: `lists/${listId}/relationships/profiles/`,
        description: 'Add profiles to Klaviyo list'
      },
      parameters: {
        data: profileIds.map(id => ({
          type: 'profile',
          id
        }))
      }
    };

    return this.execute(context);
  }

  async removeProfileFromList(
    credentials: ConnectorCredentials,
    listId: string,
    profileIds: string[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'remove-profiles-from-list',
        method: 'DELETE',
        endpoint: `lists/${listId}/relationships/profiles/`,
        description: 'Remove profiles from Klaviyo list'
      },
      parameters: {
        data: profileIds.map(id => ({
          type: 'profile',
          id
        }))
      }
    };

    return this.execute(context);
  }

  // Campaign Management
  async createCampaign(
    credentials: ConnectorCredentials,
    campaignData: z.infer<typeof KlaviyoCampaignSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-campaign',
        method: 'POST',
        endpoint: 'campaigns/',
        description: 'Create a new Klaviyo campaign'
      },
      parameters: {
        data: {
          type: 'campaign',
          attributes: campaignData
        }
      }
    };

    return this.execute(context);
  }

  async getCampaigns(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-campaigns',
        method: 'GET',
        endpoint: 'campaigns/',
        description: 'Get Klaviyo campaigns'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async sendCampaign(
    credentials: ConnectorCredentials,
    campaignId: string,
    sendTime?: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'send-campaign',
        method: 'POST',
        endpoint: `campaigns/${campaignId}/send/`,
        description: 'Send Klaviyo campaign'
      },
      parameters: sendTime ? {
        data: {
          type: 'campaign-send-job',
          attributes: {
            send_time: sendTime
          }
        }
      } : {}
    };

    return this.execute(context);
  }

  async cloneCampaign(
    credentials: ConnectorCredentials,
    campaignId: string,
    newName: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'clone-campaign',
        method: 'POST',
        endpoint: `campaigns/${campaignId}/clone/`,
        description: 'Clone Klaviyo campaign'
      },
      parameters: {
        data: {
          type: 'campaign-clone-query',
          attributes: {
            name: newName
          }
        }
      }
    };

    return this.execute(context);
  }

  // Event Tracking
  async trackEvent(
    credentials: ConnectorCredentials,
    eventData: z.infer<typeof KlaviyoEventSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'track-event',
        method: 'POST',
        endpoint: 'events/',
        description: 'Track Klaviyo event'
      },
      parameters: {
        data: {
          type: 'event',
          attributes: eventData
        }
      }
    };

    return this.execute(context);
  }

  async trackMultipleEvents(
    credentials: ConnectorCredentials,
    events: z.infer<typeof KlaviyoEventSchema>[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'track-events-bulk',
        method: 'POST',
        endpoint: 'event-bulk-create-jobs/',
        description: 'Track multiple Klaviyo events'
      },
      parameters: {
        data: {
          type: 'event-bulk-create-job',
          attributes: {
            events: events.map(event => ({
              data: {
                type: 'event',
                attributes: event
              }
            }))
          }
        }
      }
    };

    return this.execute(context);
  }

  async getEvents(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
      include?: string[];
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-events',
        method: 'GET',
        endpoint: 'events/',
        description: 'Get Klaviyo events'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Flow (Automation) Management
  async getFlows(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-flows',
        method: 'GET',
        endpoint: 'flows/',
        description: 'Get Klaviyo flows'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getFlow(
    credentials: ConnectorCredentials,
    flowId: string,
    include?: string[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-flow',
        method: 'GET',
        endpoint: `flows/${flowId}/`,
        description: 'Get Klaviyo flow details'
      },
      parameters: {
        include
      }
    };

    return this.execute(context);
  }

  async updateFlow(
    credentials: ConnectorCredentials,
    flowId: string,
    updates: Partial<z.infer<typeof KlaviyoFlowSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-flow',
        method: 'PATCH',
        endpoint: `flows/${flowId}/`,
        description: 'Update Klaviyo flow'
      },
      parameters: {
        data: {
          type: 'flow',
          id: flowId,
          attributes: updates
        }
      }
    };

    return this.execute(context);
  }

  // Template Management
  async getTemplates(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-templates',
        method: 'GET',
        endpoint: 'templates/',
        description: 'Get Klaviyo templates'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async createTemplate(
    credentials: ConnectorCredentials,
    templateData: {
      name: string;
      editor_type: 'SYSTEM' | 'SIMPLE' | 'CODE';
      html: string;
      text?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-template',
        method: 'POST',
        endpoint: 'templates/',
        description: 'Create Klaviyo template'
      },
      parameters: {
        data: {
          type: 'template',
          attributes: templateData
        }
      }
    };

    return this.execute(context);
  }

  // Metrics and Analytics
  async getMetrics(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-metrics',
        method: 'GET',
        endpoint: 'metrics/',
        description: 'Get Klaviyo metrics'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getMetric(
    credentials: ConnectorCredentials,
    metricId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-metric',
        method: 'GET',
        endpoint: `metrics/${metricId}/`,
        description: 'Get Klaviyo metric details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  async queryMetric(
    credentials: ConnectorCredentials,
    metricId: string,
    query: {
      start_date?: string;
      end_date?: string;
      unit?: 'day' | 'week' | 'month';
      measurement?: Record<string, any>;
      filter?: string[];
      by?: string[];
      count?: number;
      page_cursor?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'query-metric',
        method: 'POST',
        endpoint: `metric-aggregates/`,
        description: 'Query Klaviyo metric data'
      },
      parameters: {
        data: {
          type: 'metric-aggregate',
          attributes: {
            metric_id: metricId,
            ...query
          }
        }
      }
    };

    return this.execute(context);
  }

  // Segment Management
  async getSegments(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-segments',
        method: 'GET',
        endpoint: 'segments/',
        description: 'Get Klaviyo segments'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getSegmentProfiles(
    credentials: ConnectorCredentials,
    segmentId: string,
    filters?: {
      additional_fields?: string[];
      filter?: string;
      page_cursor?: string;
      page_size?: number;
      sort?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-segment-profiles',
        method: 'GET',
        endpoint: `segments/${segmentId}/profiles/`,
        description: 'Get profiles in Klaviyo segment'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // A/B Testing
  async createABTest(
    credentials: ConnectorCredentials,
    campaignId: string,
    testData: {
      test_type: 'subject_line' | 'content' | 'send_time';
      split_percentage: number;
      test_variables: Record<string, any>;
      duration_hours?: number;
      winner_criteria: 'open_rate' | 'click_rate' | 'conversion_rate';
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-ab-test',
        method: 'POST',
        endpoint: `campaigns/${campaignId}/campaign-valuation-requests/`,
        description: 'Create A/B test for Klaviyo campaign'
      },
      parameters: {
        data: {
          type: 'campaign-valuation-request',
          attributes: testData
        }
      }
    };

    return this.execute(context);
  }

  // Suppression Management
  async getSuppressions(
    credentials: ConnectorCredentials,
    filters?: {
      filter?: string;
      page_cursor?: string;
      page_size?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-suppressions',
        method: 'GET',
        endpoint: 'profile-suppression-bulk-create-jobs/',
        description: 'Get Klaviyo suppressions'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async suppressProfile(
    credentials: ConnectorCredentials,
    profileId: string,
    reason?: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'suppress-profile',
        method: 'POST',
        endpoint: 'profile-suppression-bulk-create-jobs/',
        description: 'Suppress Klaviyo profile'
      },
      parameters: {
        data: {
          type: 'profile-suppression-bulk-create-job',
          attributes: {
            suppressions: [{
              data: {
                type: 'profile-suppression',
                attributes: {
                  email: profileId,
                  reason: reason || 'manual'
                }
              }
            }]
          }
        }
      }
    };

    return this.execute(context);
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    return {
      'Authorization': `Klaviyo-API-Key ${credentials.credentials.apiKey}`
    };
  }
}

export default new KlaviyoConnector();