/**
 * Enhanced Base Connector Class
 * Provides foundation for all integration connectors with advanced features
 */

import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface ConnectorConfig {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  icon?: string;
  category: 'social' | 'support' | 'email' | 'analytics' | 'crm' | 'automation' | 'payment' | 'shipping' | 'erp' | 'marketing' | 'inventory';
  requiresAuth: boolean;
  authType?: 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom';
  features: string[];
  supportedTriggers?: string[];
  supportedActions?: string[];
  endpoints: {
    auth?: string;
    api: string;
    webhook?: string;
    docs?: string;
  };
  rateLimits: {
    requests: number;
    window: number; // seconds
    burst?: number;
    concurrent?: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
    retryableErrors?: string[];
  };
  schemas: {
    auth?: z.ZodSchema;
    webhook?: z.ZodSchema;
    config?: z.ZodSchema;
  };
  webhookConfig?: {
    supportsWebhooks: boolean;
    webhookPath?: string;
    verificationMethod?: 'hmac' | 'signature' | 'token';
    events?: string[];
  };
  transformConfig?: {
    dateFormat?: string;
    timezone?: string;
    currencyFormat?: string;
  };
}

export interface ConnectorCredentials {
  id: string;
  connectorId: string;
  userId: string;
  organizationId: string;
  storeId?: string;
  credentials: Record<string, any>;
  config?: Record<string, any>;
  isActive: boolean;
  lastSync?: Date;
  syncFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface ConnectorOperation {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  description: string;
  parameters?: z.ZodSchema;
  response?: z.ZodSchema;
  scopes?: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
  timeout?: number;
  retryable?: boolean;
  idempotent?: boolean;
}

export interface ConnectorExecutionContext {
  credentials: ConnectorCredentials;
  operation: ConnectorOperation;
  parameters: any;
  metadata?: Record<string, any>;
  requestId?: string;
  correlationId?: string;
}

export interface ConnectorResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  };
  metadata: {
    requestId: string;
    timestamp: Date;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
    retryCount: number;
    executionTime: number;
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      hasMore?: boolean;
      nextCursor?: string;
    };
  };
}

export interface WebhookEvent {
  id: string;
  connectorId: string;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
  verified: boolean;
}

export interface SyncState {
  connectorId: string;
  lastSyncAt?: Date;
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncError?: string;
  nextSyncAt?: Date;
  syncedRecords?: number;
  failedRecords?: number;
  cursor?: string;
}

export abstract class BaseConnector extends EventEmitter {
  protected config: ConnectorConfig;
  protected syncState: Map<string, SyncState> = new Map();
  protected activeRequests: Map<string, AbortController> = new Map();

  constructor(config: ConnectorConfig) {
    super();
    this.config = config;
  }

  // Abstract methods that must be implemented by specific connectors
  abstract authenticate(credentials: any): Promise<ConnectorCredentials>;
  abstract refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials>;
  abstract validateCredentials(credentials: ConnectorCredentials): Promise<boolean>;
  abstract verifyWebhook?(payload: any, headers: Record<string, string>): Promise<boolean>;
  abstract transformInbound?(data: any, operation: string): Promise<any>;
  abstract transformOutbound?(data: any, operation: string): Promise<any>;

  // Get connector configuration
  getConfig(): ConnectorConfig {
    return this.config;
  }

  // Get supported operations
  getSupportedOperations(): string[] {
    return [
      ...(this.config.supportedTriggers || []),
      ...(this.config.supportedActions || [])
    ];
  }

  // Common connector functionality
  async execute<T = any>(
    context: ConnectorExecutionContext
  ): Promise<ConnectorResponse<T>> {
    const requestId = context.requestId || crypto.randomUUID();
    const startTime = Date.now();
    let retryCount = 0;

    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      // Emit execution start event
      this.emit('execution:start', { requestId, operation: context.operation.id });

      // Validate credentials
      const isValid = await this.validateCredentials(context.credentials);
      if (!isValid) {
        // Try to refresh credentials
        try {
          context.credentials = await this.refreshAuth(context.credentials);
        } catch (refreshError) {
          throw new Error('Invalid or expired credentials');
        }
      }

      // Transform outbound data if transformer exists
      if (this.transformOutbound && context.parameters) {
        context.parameters = await this.transformOutbound(
          context.parameters,
          context.operation.id
        );
      }

      // Execute with retry logic
      const result = await this.executeWithRetry(context, retryCount, abortController.signal);
      
      // Transform inbound data if transformer exists
      let transformedResult = result;
      if (this.transformInbound && result) {
        transformedResult = await this.transformInbound(result, context.operation.id);
      }

      // Emit execution success event
      this.emit('execution:success', {
        requestId,
        operation: context.operation.id,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        data: transformedResult,
        metadata: {
          requestId,
          timestamp: new Date(),
          retryCount,
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      // Emit execution error event
      this.emit('execution:error', {
        requestId,
        operation: context.operation.id,
        error,
        executionTime: Date.now() - startTime
      });

      return {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error,
          retryable: this.isRetryableError(error)
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          retryCount,
          executionTime: Date.now() - startTime
        }
      };
    } finally {
      // Clean up abort controller
      this.activeRequests.delete(requestId);
    }
  }

  // Cancel a specific request
  async cancelRequest(requestId: string): Promise<boolean> {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  // Cancel all active requests
  async cancelAllRequests(): Promise<void> {
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  private async executeWithRetry(
    context: ConnectorExecutionContext,
    retryCount: number,
    signal: AbortSignal
  ): Promise<any> {
    try {
      return await this.makeRequest(context, signal);
    } catch (error) {
      // Check if request was aborted
      if (signal.aborted) {
        throw new Error('Request was cancelled');
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw error;
      }

      if (retryCount < this.config.retryPolicy.maxRetries) {
        const backoffTime = Math.min(
          this.config.retryPolicy.backoffMultiplier ** retryCount * 1000,
          this.config.retryPolicy.maxBackoffTime * 1000
        );
        
        // Wait with cancellation support
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, backoffTime);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Request was cancelled during retry'));
          });
        });

        return this.executeWithRetry(context, retryCount + 1, signal);
      }
      throw error;
    }
  }

  protected abstract makeRequest(
    context: ConnectorExecutionContext,
    signal?: AbortSignal
  ): Promise<any>;

  protected isRetryableError(error: any): boolean {
    // Check if error matches retryable patterns
    if (this.config.retryPolicy.retryableErrors) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.config.retryPolicy.retryableErrors.some(
        pattern => errorMessage.includes(pattern)
      );
    }

    // Default retryable conditions
    if (error instanceof Error) {
      const retryableMessages = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'rate limit',
        'too many requests',
        '429',
        '503',
        '504'
      ];
      return retryableMessages.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    }

    return false;
  }

  // Utility methods
  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.config.authType) {
      case 'api_key':
        if (credentials.credentials.apiKeyHeader) {
          headers[credentials.credentials.apiKeyHeader] = credentials.credentials.apiKey;
        } else {
          headers['X-API-Key'] = credentials.credentials.apiKey;
        }
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${credentials.credentials.accessToken}`;
        break;
      case 'oauth2':
        headers['Authorization'] = `Bearer ${credentials.credentials.accessToken}`;
        break;
      case 'basic':
        const basic = Buffer.from(
          `${credentials.credentials.username}:${credentials.credentials.password}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${basic}`;
        break;
      case 'custom':
        // Custom auth headers should be provided in credentials
        Object.assign(headers, credentials.credentials.customHeaders || {});
        break;
    }

    return headers;
  }

  protected validateParameters(operation: ConnectorOperation, parameters: any): boolean {
    if (!operation.parameters) return true;
    
    try {
      operation.parameters.parse(parameters);
      return true;
    } catch {
      return false;
    }
  }

  // Webhook handling
  async handleWebhook(
    payload: any,
    headers: Record<string, string>
  ): Promise<WebhookEvent> {
    const webhookId = crypto.randomUUID();

    // Verify webhook if verification method exists
    let verified = true;
    if (this.verifyWebhook) {
      verified = await this.verifyWebhook(payload, headers);
    }

    const event: WebhookEvent = {
      id: webhookId,
      connectorId: this.config.id,
      event: this.extractEventType(payload, headers),
      data: payload,
      timestamp: new Date(),
      verified
    };

    // Emit webhook event
    this.emit('webhook:received', event);

    return event;
  }

  protected extractEventType(payload: any, headers: Record<string, string>): string {
    // Default implementation - connectors can override
    return headers['x-event-type'] || payload.event || 'unknown';
  }

  // Sync management
  async getSyncState(storeId: string): Promise<SyncState | undefined> {
    return this.syncState.get(storeId);
  }

  async updateSyncState(
    storeId: string,
    update: Partial<SyncState>
  ): Promise<void> {
    const current = this.syncState.get(storeId) || {
      connectorId: this.config.id,
    };

    this.syncState.set(storeId, {
      ...current,
      ...update,
    });

    // Emit sync state update
    this.emit('sync:stateUpdate', { storeId, state: this.syncState.get(storeId) });
  }

  // Health check functionality
  async healthCheck(credentials: ConnectorCredentials): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    responseTime: number;
    errors?: string[];
    details?: Record<string, any>;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    const details: Record<string, any> = {};

    try {
      // Test basic connectivity
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        errors.push('Invalid credentials');
      }

      // Test basic API call if available
      if (this.config.endpoints.api) {
        try {
          const testContext: ConnectorExecutionContext = {
            credentials,
            operation: {
              id: 'health-check',
              name: 'Health Check',
              method: 'GET',
              endpoint: '/', // Most APIs support a root endpoint
              description: 'Health check endpoint'
            },
            parameters: {}
          };

          const response = await this.execute(testContext);
          details.apiStatus = response.success ? 'connected' : 'error';
        } catch (error) {
          errors.push('API connection failed');
          details.apiError = error instanceof Error ? error.message : String(error);
        }
      }

      // Check rate limits if available
      details.rateLimits = {
        requests: this.config.rateLimits.requests,
        window: this.config.rateLimits.window
      };

      const responseTime = Date.now() - startTime;
      
      return {
        status: errors.length === 0 ? 'healthy' : errors.length < 2 ? 'degraded' : 'unhealthy',
        lastChecked: new Date(),
        responseTime,
        errors: errors.length > 0 ? errors : undefined,
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        details
      };
    }
  }

  // Batch operations support
  async executeBatch<T = any>(
    operations: Array<Omit<ConnectorExecutionContext, 'credentials'>>,
    credentials: ConnectorCredentials,
    options?: {
      concurrency?: number;
      stopOnError?: boolean;
    }
  ): Promise<ConnectorResponse<T[]>> {
    const startTime = Date.now();
    const batchId = crypto.randomUUID();
    const concurrency = options?.concurrency || this.config.rateLimits.concurrent || 5;
    const results: any[] = [];
    const errors: any[] = [];

    // Emit batch start event
    this.emit('batch:start', { batchId, operationCount: operations.length });

    // Process operations in chunks
    for (let i = 0; i < operations.length; i += concurrency) {
      const chunk = operations.slice(i, i + concurrency);
      const chunkPromises = chunk.map(op => 
        this.execute({
          ...op,
          credentials,
          metadata: {
            ...op.metadata,
            batchId,
            batchIndex: operations.indexOf(op)
          }
        })
      );

      const chunkResults = await Promise.allSettled(chunkPromises);

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value.data);
          } else {
            errors.push(result.value.error);
            if (options?.stopOnError) {
              break;
            }
          }
        } else {
          errors.push(result.reason);
          if (options?.stopOnError) {
            break;
          }
        }
      }

      if (options?.stopOnError && errors.length > 0) {
        break;
      }
    }

    // Emit batch complete event
    this.emit('batch:complete', {
      batchId,
      successCount: results.length,
      errorCount: errors.length,
      executionTime: Date.now() - startTime
    });

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? {
        code: 'BATCH_ERRORS',
        message: `${errors.length} operations failed`,
        details: errors
      } : undefined,
      metadata: {
        requestId: batchId,
        timestamp: new Date(),
        retryCount: 0,
        executionTime: Date.now() - startTime,
        pagination: {
          total: operations.length,
          hasMore: false
        }
      }
    };
  }

  // Field mapping utilities
  mapFields(
    data: any,
    mapping: Record<string, string>,
    reverse: boolean = false
  ): any {
    if (!data || !mapping) return data;

    const mapped: Record<string, any> = {};
    const mappingToUse = reverse 
      ? Object.fromEntries(Object.entries(mapping).map(([k, v]) => [v, k]))
      : mapping;

    for (const [sourceKey, targetKey] of Object.entries(mappingToUse)) {
      const value = this.getNestedValue(data, sourceKey);
      if (value !== undefined) {
        this.setNestedValue(mapped, targetKey, value);
      }
    }

    return mapped;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

export default BaseConnector;