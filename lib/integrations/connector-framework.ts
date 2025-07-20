/**
 * Universal Connector Framework
 * Provides a standardized interface for all external integrations
 */

import { z } from 'zod';
import crypto from 'crypto';

export interface ConnectorConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'social' | 'support' | 'email' | 'analytics' | 'crm' | 'automation';
  requiresAuth: boolean;
  authType?: 'oauth2' | 'api_key' | 'basic' | 'bearer';
  endpoints: {
    auth?: string;
    api: string;
    webhook?: string;
  };
  rateLimits: {
    requests: number;
    window: number; // seconds
    burst?: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
  schemas: {
    auth?: z.ZodSchema;
    webhook?: z.ZodSchema;
    api?: z.ZodSchema;
  };
}

export interface ConnectorCredentials {
  id: string;
  connectorId: string;
  userId: string;
  organizationId: string;
  credentials: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface ConnectorOperation {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  description: string;
  parameters?: z.ZodSchema;
  response?: z.ZodSchema;
  scopes?: string[];
}

export interface ConnectorExecutionContext {
  credentials: ConnectorCredentials;
  operation: ConnectorOperation;
  parameters: any;
  metadata?: Record<string, any>;
}

export interface ConnectorResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: Date;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
    retryCount: number;
    executionTime: number;
  };
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented by specific connectors
  abstract authenticate(credentials: any): Promise<ConnectorCredentials>;
  abstract refreshAuth(credentials: ConnectorCredentials): Promise<ConnectorCredentials>;
  abstract validateCredentials(credentials: ConnectorCredentials): Promise<boolean>;

  // Common connector functionality
  async execute<T = any>(
    context: ConnectorExecutionContext
  ): Promise<ConnectorResponse<T>> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let retryCount = 0;

    try {
      // Validate credentials
      const isValid = await this.validateCredentials(context.credentials);
      if (!isValid) {
        throw new Error('Invalid or expired credentials');
      }

      // Execute with retry logic
      const result = await this.executeWithRetry(context, retryCount);
      
      return {
        success: true,
        data: result,
        metadata: {
          requestId,
          timestamp: new Date(),
          retryCount,
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          retryCount,
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  private async executeWithRetry(
    context: ConnectorExecutionContext,
    retryCount: number
  ): Promise<any> {
    try {
      return await this.makeRequest(context);
    } catch (error) {
      if (retryCount < this.config.retryPolicy.maxRetries) {
        const backoffTime = Math.min(
          this.config.retryPolicy.backoffMultiplier ** retryCount * 1000,
          this.config.retryPolicy.maxBackoffTime * 1000
        );
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.executeWithRetry(context, retryCount + 1);
      }
      throw error;
    }
  }

  protected abstract makeRequest(context: ConnectorExecutionContext): Promise<any>;

  // Utility methods
  protected createAuthHeaders(credentials: ConnectorCredentials): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.config.authType) {
      case 'api_key':
        headers['X-API-Key'] = credentials.credentials.apiKey;
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

  // Health check functionality
  async healthCheck(credentials: ConnectorCredentials): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    responseTime: number;
    errors?: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Test basic connectivity
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        errors.push('Invalid credentials');
      }

      // Test basic API call if available
      if (this.config.endpoints.api) {
        // Implement a simple health check call
      }

      const responseTime = Date.now() - startTime;
      
      return {
        status: errors.length === 0 ? 'healthy' : 'degraded',
        lastChecked: new Date(),
        responseTime,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}

// Registry for managing all connectors
export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, BaseConnector> = new Map();

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  register(connector: BaseConnector): void {
    this.connectors.set(connector['config'].id, connector);
  }

  get(connectorId: string): BaseConnector | undefined {
    return this.connectors.get(connectorId);
  }

  list(): ConnectorConfig[] {
    return Array.from(this.connectors.values()).map(c => c['config']);
  }

  async executeOperation<T = any>(
    connectorId: string,
    operationId: string,
    context: Omit<ConnectorExecutionContext, 'operation'>
  ): Promise<ConnectorResponse<T>> {
    const connector = this.get(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    // Find operation in connector config
    const operation = connector['config'].operations?.find(op => op.id === operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found in connector ${connectorId}`);
    }

    return connector.execute({
      ...context,
      operation
    });
  }
}

// Connector factory for dynamic loading
export class ConnectorFactory {
  static async createConnector(
    type: string,
    config: Partial<ConnectorConfig>
  ): Promise<BaseConnector> {
    // This would dynamically load the appropriate connector class
    // For now, we'll just throw an error for unknown types
    throw new Error(`Unknown connector type: ${type}`);
  }
}

export default ConnectorRegistry.getInstance();