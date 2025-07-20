/**
 * Zapier Integration
 * Workflow automation platform connectivity
 */

import { BaseConnector, ConnectorConfig, ConnectorCredentials, ConnectorExecutionContext } from '../connector-framework';
import { z } from 'zod';

const ZapierAuthSchema = z.object({
  apiKey: z.string()
});

const ZapierTriggerSchema = z.object({
  url: z.string().url(),
  event: z.string(),
  data: z.record(z.any())
});

const ZapierSubscriptionSchema = z.object({
  target_url: z.string().url(),
  event: z.string(),
  filter: z.record(z.any()).optional()
});

export class ZapierConnector extends BaseConnector {
  constructor() {
    const config: ConnectorConfig = {
      id: 'zapier',
      name: 'Zapier',
      version: '1.0.0',
      description: 'Zapier workflow automation platform integration',
      category: 'automation',
      requiresAuth: true,
      authType: 'api_key',
      endpoints: {
        api: 'https://zapier.com/api/v1/',
        webhook: 'https://hooks.zapier.com/hooks/catch/'
      },
      rateLimits: {
        requests: 100,
        window: 60, // 1 minute
        burst: 10
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 60
      },
      schemas: {
        auth: ZapierAuthSchema
      }
    };

    super(config);
  }

  async authenticate(credentials: any): Promise<ConnectorCredentials> {
    const { apiKey, userId, organizationId } = credentials;

    try {
      // Test the credentials by making a simple API call
      const response = await fetch(`${this.config.endpoints.api}me`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Zapier auth failed: ${response.statusText}`);
      }

      return {
        id: crypto.randomUUID(),
        connectorId: this.config.id,
        userId,
        organizationId,
        credentials: {
          apiKey
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Zapier authentication failed: ${error}`);
    }
  }

  async refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    // Zapier uses API key auth which doesn't expire
    return credentials;
  }

  async validateCredentials(credentials: ConnectorCredentials): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoints.api}me`, {
        method: 'GET',
        headers: {
          'X-API-Key': credentials.credentials.apiKey
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zapier API error: ${response.status} ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  // Webhook Management
  async createWebhook(
    credentials: ConnectorCredentials,
    webhookData: {
      target_url: string;
      event: string;
      name?: string;
      filter?: Record<string, any>;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'create-webhook',
        method: 'POST',
        endpoint: 'hooks/',
        description: 'Create Zapier webhook'
      },
      parameters: webhookData
    };

    return this.execute(context);
  }

  async listWebhooks(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'list-webhooks',
        method: 'GET',
        endpoint: 'hooks/',
        description: 'List Zapier webhooks'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async deleteWebhook(
    credentials: ConnectorCredentials,
    hookId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'delete-webhook',
        method: 'DELETE',
        endpoint: `hooks/${hookId}/`,
        description: 'Delete Zapier webhook'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Trigger Events (send data to Zapier)
  async triggerWebhook(
    webhookUrl: string,
    data: Record<string, any>
  ): Promise<any> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Webhook trigger failed: ${response.statusText}`);
      }

      const result = await response.text();
      return { success: true, response: result };
    } catch (error) {
      throw new Error(`Failed to trigger webhook: ${error}`);
    }
  }

  async triggerMultipleWebhooks(
    triggers: Array<{
      url: string;
      data: Record<string, any>;
    }>
  ): Promise<any[]> {
    const results = await Promise.allSettled(
      triggers.map(trigger => this.triggerWebhook(trigger.url, trigger.data))
    );

    return results.map((result, index) => ({
      index,
      url: triggers[index].url,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : result.reason
    }));
  }

  // Zap Management
  async listZaps(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      offset?: number;
      status?: 'on' | 'off' | 'draft' | 'paused';
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'list-zaps',
        method: 'GET',
        endpoint: 'zaps/',
        description: 'List Zapier Zaps'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getZap(
    credentials: ConnectorCredentials,
    zapId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-zap',
        method: 'GET',
        endpoint: `zaps/${zapId}/`,
        description: 'Get Zapier Zap details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  async updateZapStatus(
    credentials: ConnectorCredentials,
    zapId: string,
    status: 'on' | 'off' | 'paused'
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'update-zap-status',
        method: 'PATCH',
        endpoint: `zaps/${zapId}/`,
        description: 'Update Zapier Zap status'
      },
      parameters: {
        status
      }
    };

    return this.execute(context);
  }

  // Task History
  async getTaskHistory(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      offset?: number;
      zap_id?: string;
      status?: 'success' | 'error' | 'filtered' | 'held' | 'delayed' | 'throttled';
      start_date?: string;
      end_date?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-task-history',
        method: 'GET',
        endpoint: 'tasks/',
        description: 'Get Zapier task history'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getTask(
    credentials: ConnectorCredentials,
    taskId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-task',
        method: 'GET',
        endpoint: `tasks/${taskId}/`,
        description: 'Get Zapier task details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  async replayTask(
    credentials: ConnectorCredentials,
    taskId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'replay-task',
        method: 'POST',
        endpoint: `tasks/${taskId}/replay/`,
        description: 'Replay Zapier task'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // App Management
  async listApps(
    credentials: ConnectorCredentials,
    filters?: {
      limit?: number;
      offset?: number;
      category?: string;
    }
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'list-apps',
        method: 'GET',
        endpoint: 'apps/',
        description: 'List Zapier apps'
      },
      parameters: filters
    };

    return this.execute(context);
  }

  async getApp(
    credentials: ConnectorCredentials,
    appId: string
  ): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-app',
        method: 'GET',
        endpoint: `apps/${appId}/`,
        description: 'Get Zapier app details'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Account Information
  async getProfile(credentials: ConnectorCredentials): Promise<any> {
    const context: ConnectorExecutionContext = {
      credentials,
      operation: {
        id: 'get-profile',
        method: 'GET',
        endpoint: 'me/',
        description: 'Get Zapier user profile'
      },
      parameters: {}
    };

    return this.execute(context);
  }

  // Bulk Operations
  async bulkTriggerWebhooks(
    webhookUrls: string[],
    data: Record<string, any>
  ): Promise<any[]> {
    const triggers = webhookUrls.map(url => ({ url, data }));
    return this.triggerMultipleWebhooks(triggers);
  }

  async batchCreateWebhooks(
    credentials: ConnectorCredentials,
    webhooks: Array<{
      target_url: string;
      event: string;
      name?: string;
      filter?: Record<string, any>;
    }>
  ): Promise<any[]> {
    const results = await Promise.allSettled(
      webhooks.map(webhook => this.createWebhook(credentials, webhook))
    );

    return results.map((result, index) => ({
      index,
      webhook: webhooks[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : result.reason
    }));
  }

  // Event Filtering and Transformation
  async testFilter(
    data: Record<string, any>,
    filter: Record<string, any>
  ): Promise<boolean> {
    // Simple filter testing logic
    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = this.getNestedValue(data, key);
      
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        // Handle operators like { $gt: 10 }, { $contains: 'text' }
        const operator = Object.keys(expectedValue)[0];
        const operatorValue = expectedValue[operator];
        
        switch (operator) {
          case '$gt':
            if (!(actualValue > operatorValue)) return false;
            break;
          case '$lt':
            if (!(actualValue < operatorValue)) return false;
            break;
          case '$contains':
            if (!String(actualValue).includes(String(operatorValue))) return false;
            break;
          case '$exists':
            if ((actualValue !== undefined) !== operatorValue) return false;
            break;
          default:
            if (actualValue !== expectedValue) return false;
        }
      } else {
        if (actualValue !== expectedValue) return false;
      }
    }
    
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async transformData(
    data: Record<string, any>,
    transformations: Array<{
      type: 'map' | 'filter' | 'format' | 'calculate';
      config: any;
    }>
  ): Promise<any> {
    let result = { ...data };

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'map':
          result = this.mapFields(result, transformation.config);
          break;
        case 'filter':
          result = this.filterFields(result, transformation.config);
          break;
        case 'format':
          result = this.formatFields(result, transformation.config);
          break;
        case 'calculate':
          result = this.calculateFields(result, transformation.config);
          break;
      }
    }

    return result;
  }

  private mapFields(data: any, mapping: Record<string, string>): any {
    const result: any = {};
    
    Object.entries(mapping).forEach(([newKey, sourcePath]) => {
      const value = this.getNestedValue(data, sourcePath);
      if (value !== undefined) {
        result[newKey] = value;
      }
    });

    return result;
  }

  private filterFields(data: any, allowedFields: string[]): any {
    const result: any = {};
    
    allowedFields.forEach(field => {
      const value = this.getNestedValue(data, field);
      if (value !== undefined) {
        this.setNestedValue(result, field, value);
      }
    });

    return result;
  }

  private formatFields(data: any, formatters: Record<string, any>): any {
    const result = { ...data };
    
    Object.entries(formatters).forEach(([field, formatter]) => {
      const value = this.getNestedValue(data, field);
      if (value !== undefined) {
        let formattedValue = value;
        
        switch (formatter.type) {
          case 'date':
            formattedValue = new Date(value).toISOString();
            break;
          case 'number':
            formattedValue = Number(value);
            break;
          case 'string':
            formattedValue = String(value);
            break;
          case 'uppercase':
            formattedValue = String(value).toUpperCase();
            break;
          case 'lowercase':
            formattedValue = String(value).toLowerCase();
            break;
        }
        
        this.setNestedValue(result, field, formattedValue);
      }
    });

    return result;
  }

  private calculateFields(data: any, calculations: Record<string, any>): any {
    const result = { ...data };
    
    Object.entries(calculations).forEach(([newField, calculation]) => {
      let calculatedValue;
      
      switch (calculation.operation) {
        case 'sum':
          calculatedValue = calculation.fields.reduce((sum: number, field: string) => {
            return sum + (Number(this.getNestedValue(data, field)) || 0);
          }, 0);
          break;
        case 'concat':
          calculatedValue = calculation.fields.map((field: string) => 
            String(this.getNestedValue(data, field) || '')
          ).join(calculation.separator || '');
          break;
        case 'constant':
          calculatedValue = calculation.value;
          break;
      }
      
      if (calculatedValue !== undefined) {
        this.setNestedValue(result, newField, calculatedValue);
      }
    });

    return result;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  // Webhook URL Generator
  generateWebhookUrl(hookId: string): string {
    return `${this.config.endpoints.webhook}${hookId}/`;
  }

  // Instant Webhook (for testing)
  async sendInstantTrigger(
    credentials: ConnectorCredentials,
    triggerData: z.infer<typeof ZapierTriggerSchema>
  ): Promise<any> {
    return this.triggerWebhook(triggerData.url, {
      event: triggerData.event,
      data: triggerData.data,
      timestamp: new Date().toISOString()
    });
  }

  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    return {
      'X-API-Key': credentials.credentials.apiKey
    };
  }
}

export default new ZapierConnector();