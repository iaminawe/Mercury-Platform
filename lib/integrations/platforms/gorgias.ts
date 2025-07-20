/**
 * Gorgias Customer Support Integration
 * Customer support ticket integration and management
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const GorgiasAuthSchema = z.object({
  domain: z.string(),
  username: z.string(),
  apiKey: z.string()
});

const GorgiasTicketSchema = z.object({
  subject: z.string(),
  status: z.enum(['open', 'closed', 'spam']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_user: z.object({
    id: z.number()
  }).optional(),
  assignee_team: z.object({
    id: z.number()
  }).optional(),
  requester: z.object({
    id: z.number().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional()
  }),
  via: z.enum(['email', 'chat', 'phone', 'facebook', 'twitter', 'instagram', 'sms', 'api']).optional(),
  channel: z.enum(['email', 'chat', 'phone', 'facebook-messenger', 'facebook-post', 'twitter-dm', 'twitter-mention', 'instagram-dm', 'instagram-comment', 'sms', 'api']).optional(),
  satisfaction_rating: z.object({
    score: z.enum(['satisfied', 'not_satisfied']).optional(),
    comment: z.string().optional()
  }).optional(),
  tags: z.array(z.object({
    id: z.number()
  })).optional(),
  created_datetime: z.string().datetime().optional(),
  updated_datetime: z.string().datetime().optional(),
  last_message_datetime: z.string().datetime().optional(),
  opened_datetime: z.string().datetime().optional(),
  closed_datetime: z.string().datetime().optional(),
  language: z.string().optional(),
  external_id: z.string().optional(),
  meta: z.record(z.any()).optional()
});

const GorgiasMessageSchema = z.object({
  channel: z.enum(['email', 'chat', 'phone', 'facebook-messenger', 'facebook-post', 'twitter-dm', 'twitter-mention', 'instagram-dm', 'instagram-comment', 'sms', 'api']),
  via: z.enum(['email', 'chat', 'phone', 'facebook', 'twitter', 'instagram', 'sms', 'api']),
  source: z.object({
    type: z.enum(['email', 'chat', 'phone', 'facebook', 'twitter', 'instagram', 'sms', 'api']),
    from: z.object({
      address: z.string().optional(),
      name: z.string().optional()
    }).optional(),
    to: z.array(z.object({
      address: z.string().optional(),
      name: z.string().optional()
    })).optional()
  }),
  sender: z.object({
    id: z.number().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional()
  }),
  receiver: z.object({
    id: z.number().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional()
  }).optional(),
  subject: z.string().optional(),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  stripped_text: z.string().optional(),
  stripped_html: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    name: z.string(),
    size: z.number(),
    content_type: z.string()
  })).optional(),
  actions: z.array(z.object({
    name: z.string(),
    value: z.string()
  })).optional(),
  meta: z.record(z.any()).optional(),
  created_datetime: z.string().datetime().optional(),
  sent_datetime: z.string().datetime().optional(),
  failed_datetime: z.string().datetime().optional(),
  external_id: z.string().optional()
});

const GorgiasCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  channels: z.record(z.object({
    address: z.string(),
    preferred: z.boolean().optional()
  })).optional(),
  external_id: z.string().optional(),
  active: z.boolean().optional(),
  meta: z.record(z.any()).optional(),
  tags: z.array(z.object({
    id: z.number()
  })).optional(),
  data: z.array(z.object({
    key: z.string(),
    value: z.any()
  })).optional(),
  notes: z.string().optional()
});

export class GorgiasConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'gorgias',
      name: 'Gorgias',
      version: '1.0.0',
      description: 'Gorgias customer support integration for ticket and customer management',
      category: 'support',
      requiresAuth: true,
      authType: 'basic',
      endpoints: {
        api: 'https://{domain}.gorgias.com/api/',
      },
      rateLimits: {
        requests: 3600,
        window: 3600, // 1 hour
        burst: 60
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: GorgiasAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { domain, username, apiKey, userId, organizationId } = credentials;

    try {
      // Test the credentials by making a simple API call
      const response = await fetch(`https://${domain}.gorgias.com/api/account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Gorgias auth failed: ${response.statusText}`);
      }

      const accountData = await response.json();

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId,
        organizationId,
        credentials: {
          domain,
          username,
          apiKey
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Gorgias authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    // Gorgias uses API key auth which doesn't expire
    return credentials;
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      const response = await fetch(`https://${credentials.credentials.domain}.gorgias.com/api/account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${credentials.credentials.username}:${credentials.credentials.apiKey}`).toString('base64')}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  protected async makeRequest(context: ConnectorExecutionContext): Promise<any> {
    const headers = this.createAuthHeaders(context.credentials);
    const domain = context.credentials.credentials.domain;
    const url = `https://${domain}.gorgias.com/api/${context.operation.endpoint}`;

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
      throw new Error(`Gorgias API error: ${data.detail || response.statusText}`);
    }

    return data;
  }

  // Ticket Management
  async createTicket(
    credentials: ConnectorCredentials,
    ticketData: z.infer<typeof GorgiasTicketSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-ticket',
        method: 'POST',
        endpoint: 'tickets/',
        description: 'Create a new Gorgias ticket'
      },
      parameters: ticketData
    };

    return this.execute(context);
  }

  async getTickets(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
      status?: string;
      assignee_user?: number;
      assignee_team?: number;
      priority?: string;
      channel?: string;
      via?: string;
      tags?: string;
      created_datetime__gte?: string;
      created_datetime__lte?: string;
      updated_datetime__gte?: string;
      updated_datetime__lte?: string;
      requester?: number;
      search?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-tickets',
        method: 'GET',
        endpoint: 'tickets/',
        description: 'Get Gorgias tickets'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getTicket(
    credentials: ConnectorCredentials,
    ticketId: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-ticket',
        method: 'GET',
        endpoint: `tickets/${ticketId}/`,
        description: 'Get Gorgias ticket details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  async updateTicket(
    credentials: ConnectorCredentials,
    ticketId: number,
    updates: Partial<z.infer<typeof GorgiasTicketSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-ticket',
        method: 'PUT',
        endpoint: `tickets/${ticketId}/`,
        description: 'Update Gorgias ticket'
      },
      parameters: updates
    };

    return this.execute(context);
  }

  async deleteTicket(
    credentials: ConnectorCredentials,
    ticketId: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'delete-ticket',
        method: 'DELETE',
        endpoint: `tickets/${ticketId}/`,
        description: 'Delete Gorgias ticket'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Message Management
  async createMessage(
    credentials: ConnectorCredentials,
    ticketId: number,
    messageData: z.infer<typeof GorgiasMessageSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-message',
        method: 'POST',
        endpoint: `tickets/${ticketId}/messages/`,
        description: 'Create a new message in Gorgias ticket'
      },
      parameters: messageData
    };

    return this.execute(context);
  }

  async getMessages(
    credentials: ConnectorCredentials,
    ticketId: number,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-messages',
        method: 'GET',
        endpoint: `tickets/${ticketId}/messages/`,
        description: 'Get messages from Gorgias ticket'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getMessage(
    credentials: ConnectorCredentials,
    ticketId: number,
    messageId: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-message',
        method: 'GET',
        endpoint: `tickets/${ticketId}/messages/${messageId}/`,
        description: 'Get Gorgias message details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Customer Management
  async createCustomer(
    credentials: ConnectorCredentials,
    customerData: z.infer<typeof GorgiasCustomerSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-customer',
        method: 'POST',
        endpoint: 'customers/',
        description: 'Create a new Gorgias customer'
      },
      parameters: customerData
    };

    return this.execute(context);
  }

  async getCustomers(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
      email?: string;
      external_id?: string;
      search?: string;
      active?: boolean;
      tags?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-customers',
        method: 'GET',
        endpoint: 'customers/',
        description: 'Get Gorgias customers'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getCustomer(
    credentials: ConnectorCredentials,
    customerId: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-customer',
        method: 'GET',
        endpoint: `customers/${customerId}/`,
        description: 'Get Gorgias customer details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  async updateCustomer(
    credentials: ConnectorCredentials,
    customerId: number,
    updates: Partial<z.infer<typeof GorgiasCustomerSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-customer',
        method: 'PUT',
        endpoint: `customers/${customerId}/`,
        description: 'Update Gorgias customer'
      },
      parameters: updates
    };

    return this.execute(context);
  }

  // Knowledge Base Management
  async createArticle(
    credentials: ConnectorCredentials,
    articleData: {
      title: string;
      body_html: string;
      language: string;
      position?: number;
      meta?: Record<string, any>;
      tags?: Array<{ id: number }>;
      public?: boolean;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-article',
        method: 'POST',
        endpoint: 'helpdesk/articles/',
        description: 'Create a new knowledge base article'
      },
      parameters: articleData
    };

    return this.execute(context);
  }

  async getArticles(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
      language?: string;
      public?: boolean;
      search?: string;
      tags?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-articles',
        method: 'GET',
        endpoint: 'helpdesk/articles/',
        description: 'Get knowledge base articles'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Macros and Automation
  async getMacros(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
      search?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-macros',
        method: 'GET',
        endpoint: 'macros/',
        description: 'Get Gorgias macros'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async executeMacro(
    credentials: ConnectorCredentials,
    ticketId: number,
    macroId: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'execute-macro',
        method: 'POST',
        endpoint: `tickets/${ticketId}/macros/`,
        description: 'Execute Gorgias macro on ticket'
      },
      parameters: {
        macro_id: macroId
      }
    };

    return this.execute(context);
  }

  // Tags Management
  async getTags(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      cursor?: string;
      order_by?: string;
      search?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-tags',
        method: 'GET',
        endpoint: 'tags/',
        description: 'Get Gorgias tags'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async createTag(
    credentials: ConnectorCredentials,
    tagData: {
      name: string;
      color?: string;
      decoration?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-tag',
        method: 'POST',
        endpoint: 'tags/',
        description: 'Create a new Gorgias tag'
      },
      parameters: tagData
    };

    return this.execute(context);
  }

  // Statistics and Analytics
  async getTicketStatistics(
    credentials: ConnectorCredentials,
    filters?: {
      from_datetime?: string;
      to_datetime?: string;
      assignee_user?: number;
      assignee_team?: number;
      channel?: string;
      priority?: string;
      tags?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-ticket-statistics',
        method: 'GET',
        endpoint: 'stats/tickets/',
        description: 'Get Gorgias ticket statistics'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getCustomerSatisfaction(
    credentials: ConnectorCredentials,
    filters?: {
      from_datetime?: string;
      to_datetime?: string;
      assignee_user?: number;
      assignee_team?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-satisfaction',
        method: 'GET',
        endpoint: 'stats/satisfaction/',
        description: 'Get customer satisfaction statistics'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  // Integration Events (for webhooks)
  async createIntegration(
    credentials: ConnectorCredentials,
    integrationData: {
      name: string;
      type: string;
      active: boolean;
      settings: Record<string, any>;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-integration',
        method: 'POST',
        endpoint: 'integrations/',
        description: 'Create Gorgias integration'
      },
      parameters: integrationData
    };

    return this.execute(context);
  }

  async createWebhook(
    credentials: ConnectorCredentials,
    webhookData: {
      name: string;
      url: string;
      events: string[];
      active: boolean;
      secret?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-webhook',
        method: 'POST',
        endpoint: 'webhooks/',
        description: 'Create Gorgias webhook'
      },
      parameters: webhookData
    };

    return this.execute(context);
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    const { username, apiKey } = credentials.credentials;
    return {
      'Authorization': `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`
    };
  }
}

export default new GorgiasConnector();