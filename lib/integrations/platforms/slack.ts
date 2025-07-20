/**
 * Slack Integration
 * Team notifications and collaboration platform
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const SlackAuthSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  teamId: z.string(),
  teamName: z.string(),
  userId: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().optional()
});

const SlackMessageSchema = z.object({
  channel: z.string(),
  text: z.string().optional(),
  blocks: z.array(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
  thread_ts: z.string().optional(),
  reply_broadcast: z.boolean().optional(),
  unfurl_links: z.boolean().optional(),
  unfurl_media: z.boolean().optional(),
  parse: z.enum(['full', 'none']).optional(),
  link_names: z.boolean().optional(),
  username: z.string().optional(),
  icon_url: z.string().url().optional(),
  icon_emoji: z.string().optional(),
  as_user: z.boolean().optional(),
  mrkdwn: z.boolean().optional()
});

const SlackChannelSchema = z.object({
  name: z.string(),
  is_private: z.boolean().optional(),
  topic: z.object({
    value: z.string()
  }).optional(),
  purpose: z.object({
    value: z.string()
  }).optional()
});

const SlackUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  display_name: z.string().optional(),
  real_name: z.string().optional()
});

const SlackFileSchema = z.object({
  file: z.string(), // base64 encoded or file buffer
  filename: z.string(),
  channels: z.string().optional(),
  content: z.string().optional(),
  filetype: z.string().optional(),
  initial_comment: z.string().optional(),
  title: z.string().optional(),
  thread_ts: z.string().optional()
});

export class SlackConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'slack',
      name: 'Slack',
      version: '1.0.0',
      description: 'Slack team communication and collaboration platform',
      category: 'automation',
      requiresAuth: true,
      authType: 'oauth2',
      endpoints: {
        auth: 'https://slack.com/oauth/v2/authorize',
        api: 'https://slack.com/api/',
        webhook: 'https://hooks.slack.com/services/'
      },
      rateLimits: {
        requests: 100,
        window: 60, // 1 minute (Tier 1)
        burst: 1
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: SlackAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { code, redirectUri, clientId, clientSecret } = credentials;

    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack auth failed: ${data.error}`);
      }

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId: credentials.userId,
        organizationId: credentials.organizationId,
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          teamId: data.team.id,
          teamName: data.team.name,
          userId: data.authed_user.id,
          scopes: data.scope.split(','),
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      };
    } catch (error) {
      throw new Error(`Slack authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    if (!credentials.credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID!,
          client_secret: process.env.SLACK_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: credentials.credentials.refreshToken
        })
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Slack refresh failed: ${data.error}`);
      }

      return {
        ...credentials,
        credentials: {
          ...credentials.credentials,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || credentials.credentials.refreshToken,
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined
        },
        updatedAt: new Date(),
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      };
    } catch (error) {
      throw new Error(`Slack token refresh failed: ${error}`);
    }
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      if (credentials.expiresAt && new Date() > credentials.expiresAt) {
        return false;
      }

      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.ok;
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

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }

    return data;
  }

  // Message Management
  async sendMessage(
    credentials: ConnectorCredentials,
    messageData: z.infer<typeof SlackMessageSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'send-message',
        method: 'POST',
        endpoint: 'chat.postMessage',
        description: 'Send message to Slack channel'
      },
      parameters: messageData
    };

    return this.execute(context);
  }

  async updateMessage(
    credentials: ConnectorCredentials,
    channel: string,
    ts: string,
    updates: Partial<z.infer<typeof SlackMessageSchema>>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-message',
        method: 'POST',
        endpoint: 'chat.update',
        description: 'Update Slack message'
      },
      parameters: {
        channel,
        ts,
        ...updates
      }
    };

    return this.execute(context);
  }

  async deleteMessage(
    credentials: ConnectorCredentials,
    channel: string,
    ts: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'delete-message',
        method: 'POST',
        endpoint: 'chat.delete',
        description: 'Delete Slack message'
      },
      parameters: {
        channel,
        ts
      }
    };

    return this.execute(context);
  }

  async getMessageHistory(
    credentials: ConnectorCredentials,
    channel: string,
    options?: {
      cursor?: string;
      latest?: string;
      oldest?: string;
      limit?: number;
      inclusive?: boolean;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-message-history',
        method: 'GET',
        endpoint: 'conversations.history',
        description: 'Get Slack message history'
      },
      parameters: {
        channel,
        ...options
      }
    };

    return this.execute(context);
  }

  async addReaction(
    credentials: ConnectorCredentials,
    channel: string,
    timestamp: string,
    name: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'add-reaction',
        method: 'POST',
        endpoint: 'reactions.add',
        description: 'Add reaction to Slack message'
      },
      parameters: {
        channel,
        timestamp,
        name
      }
    };

    return this.execute(context);
  }

  // Channel Management
  async createChannel(
    credentials: ConnectorCredentials,
    channelData: z.infer<typeof SlackChannelSchema>
  ): Promise<any> {
    const endpoint = channelData.is_private ? 'conversations.create' : 'conversations.create';
    
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-channel',
        method: 'POST',
        endpoint,
        description: 'Create Slack channel'
      },
      parameters: channelData
    };

    return this.execute(context);
  }

  async getChannels(
    credentials: ConnectorCredentials,
    options?: {
      cursor?: string;
      limit?: number;
      exclude_archived?: boolean;
      types?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-channels',
        method: 'GET',
        endpoint: 'conversations.list',
        description: 'Get Slack channels'
      },
      parameters: options
    };

    return this.execute(context);
  }

  async getChannelInfo(
    credentials: ConnectorCredentials,
    channel: string,
    includeLocale?: boolean
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-channel-info',
        method: 'GET',
        endpoint: 'conversations.info',
        description: 'Get Slack channel information'
      },
      parameters: {
        channel,
        include_locale: includeLocale
      }
    };

    return this.execute(context);
  }

  async inviteToChannel(
    credentials: ConnectorCredentials,
    channel: string,
    users: string[]
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'invite-to-channel',
        method: 'POST',
        endpoint: 'conversations.invite',
        description: 'Invite users to Slack channel'
      },
      parameters: {
        channel,
        users: users.join(',')
      }
    };

    return this.execute(context);
  }

  async leaveChannel(
    credentials: ConnectorCredentials,
    channel: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'leave-channel',
        method: 'POST',
        endpoint: 'conversations.leave',
        description: 'Leave Slack channel'
      },
      parameters: {
        channel
      }
    };

    return this.execute(context);
  }

  // User Management
  async getUsers(
    credentials: ConnectorCredentials,
    options?: {
      cursor?: string;
      limit?: number;
      include_locale?: boolean;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-users',
        method: 'GET',
        endpoint: 'users.list',
        description: 'Get Slack users'
      },
      parameters: options
    };

    return this.execute(context);
  }

  async getUserInfo(
    credentials: ConnectorCredentials,
    user: string,
    includeLocale?: boolean
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-user-info',
        method: 'GET',
        endpoint: 'users.info',
        description: 'Get Slack user information'
      },
      parameters: {
        user,
        include_locale: includeLocale
      }
    };

    return this.execute(context);
  }

  async getUserPresence(
    credentials: ConnectorCredentials,
    user: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-user-presence',
        method: 'GET',
        endpoint: 'users.getPresence',
        description: 'Get Slack user presence'
      },
      parameters: {
        user
      }
    };

    return this.execute(context);
  }

  async setUserPresence(
    credentials: ConnectorCredentials,
    presence: 'auto' | 'away'
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'set-user-presence',
        method: 'POST',
        endpoint: 'users.setPresence',
        description: 'Set Slack user presence'
      },
      parameters: {
        presence
      }
    };

    return this.execute(context);
  }

  // File Management
  async uploadFile(
    credentials: ConnectorCredentials,
    fileData: z.infer<typeof SlackFileSchema>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'upload-file',
        method: 'POST',
        endpoint: 'files.upload',
        description: 'Upload file to Slack'
      },
      parameters: fileData
    };

    return this.execute(context);
  }

  async getFiles(
    credentials: ConnectorCredentials,
    options?: {
      user?: string;
      channel?: string;
      ts_from?: string;
      ts_to?: string;
      types?: string;
      count?: number;
      page?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-files',
        method: 'GET',
        endpoint: 'files.list',
        description: 'Get Slack files'
      },
      parameters: options
    };

    return this.execute(context);
  }

  async getFileInfo(
    credentials: ConnectorCredentials,
    file: string,
    count?: number,
    page?: number
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-file-info',
        method: 'GET',
        endpoint: 'files.info',
        description: 'Get Slack file information'
      },
      parameters: {
        file,
        count,
        page
      }
    };

    return this.execute(context);
  }

  async deleteFile(
    credentials: ConnectorCredentials,
    file: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'delete-file',
        method: 'POST',
        endpoint: 'files.delete',
        description: 'Delete Slack file'
      },
      parameters: {
        file
      }
    };

    return this.execute(context);
  }

  // App Management
  async openModal(
    credentials: ConnectorCredentials,
    triggerId: string,
    view: any
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'open-modal',
        method: 'POST',
        endpoint: 'views.open',
        description: 'Open Slack modal'
      },
      parameters: {
        trigger_id: triggerId,
        view
      }
    };

    return this.execute(context);
  }

  async publishView(
    credentials: ConnectorCredentials,
    userId: string,
    view: any
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'publish-view',
        method: 'POST',
        endpoint: 'views.publish',
        description: 'Publish Slack home tab view'
      },
      parameters: {
        user_id: userId,
        view
      }
    };

    return this.execute(context);
  }

  // Search
  async searchMessages(
    credentials: ConnectorCredentials,
    query: string,
    options?: {
      sort?: 'score' | 'timestamp';
      sort_dir?: 'asc' | 'desc';
      highlight?: boolean;
      count?: number;
      page?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'search-messages',
        method: 'GET',
        endpoint: 'search.messages',
        description: 'Search Slack messages'
      },
      parameters: {
        query,
        ...options
      }
    };

    return this.execute(context);
  }

  async searchFiles(
    credentials: ConnectorCredentials,
    query: string,
    options?: {
      sort?: 'score' | 'timestamp';
      sort_dir?: 'asc' | 'desc';
      highlight?: boolean;
      count?: number;
      page?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'search-files',
        method: 'GET',
        endpoint: 'search.files',
        description: 'Search Slack files'
      },
      parameters: {
        query,
        ...options
      }
    };

    return this.execute(context);
  }

  // Workflow Integration
  async sendWorkflowStepCompleted(
    credentials: ConnectorCredentials,
    workflowStepExecuteId: string,
    outputs?: Record<string, any>
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'workflow-step-completed',
        method: 'POST',
        endpoint: 'workflows.stepCompleted',
        description: 'Complete workflow step'
      },
      parameters: {
        workflow_step_execute_id: workflowStepExecuteId,
        outputs
      }
    };

    return this.execute(context);
  }

  async sendWorkflowStepFailed(
    credentials: ConnectorCredentials,
    workflowStepExecuteId: string,
    error: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'workflow-step-failed',
        method: 'POST',
        endpoint: 'workflows.stepFailed',
        description: 'Mark workflow step as failed'
      },
      parameters: {
        workflow_step_execute_id: workflowStepExecuteId,
        error: {
          message: error
        }
      }
    };

    return this.execute(context);
  }

  // Team Information
  async getTeamInfo(credentials: ConnectorCredentials): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-team-info',
        method: 'GET',
        endpoint: 'team.info',
        description: 'Get Slack team information'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Webhook Support
  async sendWebhookMessage(
    webhookUrl: string,
    messageData: {
      text?: string;
      blocks?: any[];
      attachments?: any[];
      channel?: string;
      username?: string;
      icon_url?: string;
      icon_emoji?: string;
    }
  ): Promise<any> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    return { ok: true };
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    return {
      'Authorization': `Bearer ${credentials.credentials.accessToken}`
    };
  }
}

export default new SlackConnector();