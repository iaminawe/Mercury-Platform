/**
 * Advanced Webhook Management System
 * Handles webhook registration, validation, processing, and routing
 */

import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  organizationId: string;
  connectorId?: string;
  headers?: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    timeoutMs: number;
  };
  filters?: WebhookFilter[];
  transformations?: WebhookTransformation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: any;
  metadata: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'expired';
  httpStatus?: number;
  response?: any;
  error?: string;
  sentAt: Date;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

export interface WebhookFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'exists' | 'gt' | 'lt';
  value: any;
}

export interface WebhookTransformation {
  type: 'map' | 'filter' | 'enrich' | 'format';
  config: any;
}

export interface WebhookSignature {
  algorithm: 'sha256' | 'sha1' | 'md5';
  header: string;
  prefix?: string;
}

const WebhookEventSchema = z.object({
  type: z.string(),
  source: z.string(),
  data: z.any(),
  metadata: z.record(z.any()).optional().default({})
});

export class WebhookManager extends EventEmitter {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private retryQueue: Set<string> = new Set();

  constructor() {
    super();
    this.setupRetryProcessor();
  }

  // Webhook endpoint management
  async registerEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'secret' | 'createdAt' | 'updatedAt'>): Promise<WebhookEndpoint> {
    const webhookEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: crypto.randomUUID(),
      secret: this.generateSecret(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.endpoints.set(webhookEndpoint.id, webhookEndpoint);
    
    this.emit('endpoint:registered', webhookEndpoint);
    
    return webhookEndpoint;
  }

  async updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return null;

    const updatedEndpoint = {
      ...endpoint,
      ...updates,
      updatedAt: new Date()
    };

    this.endpoints.set(id, updatedEndpoint);
    this.emit('endpoint:updated', updatedEndpoint);
    
    return updatedEndpoint;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return false;

    this.endpoints.delete(id);
    this.emit('endpoint:deleted', endpoint);
    
    return true;
  }

  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id);
  }

  listEndpoints(organizationId?: string): WebhookEndpoint[] {
    const endpoints = Array.from(this.endpoints.values());
    return organizationId 
      ? endpoints.filter(e => e.organizationId === organizationId)
      : endpoints;
  }

  // Event processing
  async processEvent(event: WebhookEvent): Promise<void> {
    try {
      // Validate event
      const validatedEvent = WebhookEventSchema.parse(event);
      
      // Find matching endpoints
      const matchingEndpoints = this.findMatchingEndpoints(validatedEvent);
      
      // Process each endpoint
      for (const endpoint of matchingEndpoints) {
        if (!endpoint.isActive) continue;
        
        await this.deliverToEndpoint(validatedEvent, endpoint);
      }
      
      this.emit('event:processed', validatedEvent, matchingEndpoints.length);
    } catch (error) {
      this.emit('event:error', event, error);
      throw error;
    }
  }

  private findMatchingEndpoints(event: WebhookEvent): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(endpoint => {
      // Check if event type matches
      if (!endpoint.events.includes(event.type) && !endpoint.events.includes('*')) {
        return false;
      }

      // Apply filters
      if (endpoint.filters && endpoint.filters.length > 0) {
        return this.applyFilters(event, endpoint.filters);
      }

      return true;
    });
  }

  private applyFilters(event: WebhookEvent, filters: WebhookFilter[]): boolean {
    return filters.every(filter => {
      const value = this.getNestedValue(event, filter.field);
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).includes(String(filter.value));
        case 'startsWith':
          return String(value).startsWith(String(filter.value));
        case 'endsWith':
          return String(value).endsWith(String(filter.value));
        case 'exists':
          return value !== undefined && value !== null;
        case 'gt':
          return Number(value) > Number(filter.value);
        case 'lt':
          return Number(value) < Number(filter.value);
        default:
          return false;
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Webhook delivery
  private async deliverToEndpoint(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: endpoint.id,
      eventId: event.id,
      url: endpoint.url,
      attempt: 1,
      status: 'pending',
      sentAt: new Date()
    };

    this.deliveries.set(delivery.id, delivery);

    try {
      await this.sendWebhook(event, endpoint, delivery);
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Add to retry queue if retries are configured
      if (endpoint.retryConfig.maxRetries > 0) {
        this.scheduleRetry(delivery, endpoint);
      }
      
      this.emit('delivery:failed', delivery, error);
    }
  }

  private async sendWebhook(
    event: WebhookEvent, 
    endpoint: WebhookEndpoint, 
    delivery: WebhookDelivery
  ): Promise<void> {
    // Apply transformations
    const transformedEvent = this.applyTransformations(event, endpoint.transformations);
    
    // Create payload
    const payload = JSON.stringify(transformedEvent);
    
    // Generate signature
    const signature = this.generateSignature(payload, endpoint.secret);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-ID': delivery.id,
      'X-Webhook-Timestamp': delivery.sentAt.toISOString(),
      ...endpoint.headers
    };

    // Send request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), endpoint.retryConfig.timeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      delivery.httpStatus = response.status;
      delivery.deliveredAt = new Date();

      if (response.ok) {
        delivery.status = 'success';
        delivery.response = await response.text();
        this.emit('delivery:success', delivery);
      } else {
        delivery.status = 'failed';
        delivery.error = `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(delivery.error);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private applyTransformations(event: WebhookEvent, transformations?: WebhookTransformation[]): any {
    if (!transformations || transformations.length === 0) {
      return event;
    }

    let result = { ...event };

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'map':
          result = this.mapFields(result, transformation.config);
          break;
        case 'filter':
          result = this.filterFields(result, transformation.config);
          break;
        case 'enrich':
          result = this.enrichData(result, transformation.config);
          break;
        case 'format':
          result = this.formatData(result, transformation.config);
          break;
      }
    }

    return result;
  }

  private mapFields(data: any, mapping: Record<string, string>): any {
    const result = { ...data };
    
    Object.entries(mapping).forEach(([from, to]) => {
      const value = this.getNestedValue(data, from);
      if (value !== undefined) {
        this.setNestedValue(result, to, value);
      }
    });

    return result;
  }

  private filterFields(data: any, fields: string[]): any {
    const result: any = {};
    
    fields.forEach(field => {
      const value = this.getNestedValue(data, field);
      if (value !== undefined) {
        this.setNestedValue(result, field, value);
      }
    });

    return result;
  }

  private enrichData(data: any, enrichment: Record<string, any>): any {
    return {
      ...data,
      ...enrichment
    };
  }

  private formatData(data: any, format: any): any {
    // Apply formatting rules based on configuration
    return data;
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

  // Signature generation and validation
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Retry mechanism
  private scheduleRetry(delivery: WebhookDelivery, endpoint: WebhookEndpoint): void {
    if (delivery.attempt >= endpoint.retryConfig.maxRetries) {
      delivery.status = 'expired';
      return;
    }

    const backoffTime = endpoint.retryConfig.backoffMultiplier ** (delivery.attempt - 1) * 1000;
    delivery.nextRetryAt = new Date(Date.now() + backoffTime);
    
    this.retryQueue.add(delivery.id);
  }

  private setupRetryProcessor(): void {
    setInterval(() => {
      this.processRetryQueue();
    }, 60000); // Check every minute
  }

  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    
    for (const deliveryId of this.retryQueue) {
      const delivery = this.deliveries.get(deliveryId);
      if (!delivery || !delivery.nextRetryAt) continue;
      
      if (delivery.nextRetryAt <= now) {
        this.retryQueue.delete(deliveryId);
        
        const endpoint = this.endpoints.get(delivery.webhookId);
        if (!endpoint) continue;
        
        delivery.attempt++;
        delivery.status = 'pending';
        delivery.sentAt = new Date();
        delivery.nextRetryAt = undefined;
        
        try {
          // Re-fetch the original event for retry
          const event = await this.getEventById(delivery.eventId);
          if (event) {
            await this.sendWebhook(event, endpoint, delivery);
          }
        } catch (error) {
          delivery.status = 'failed';
          delivery.error = error instanceof Error ? error.message : 'Retry failed';
          
          if (delivery.attempt < endpoint.retryConfig.maxRetries) {
            this.scheduleRetry(delivery, endpoint);
          } else {
            delivery.status = 'expired';
          }
        }
      }
    }
  }

  // Utility methods
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async getEventById(eventId: string): Promise<WebhookEvent | null> {
    // This would typically fetch from a database
    // For now, return null as we don't have event storage
    return null;
  }

  // Analytics and monitoring
  getDeliveryStats(webhookId: string, timeRange: { start: Date; end: Date }): {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    expired: number;
    averageResponseTime: number;
  } {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => 
        d.webhookId === webhookId && 
        d.sentAt >= timeRange.start && 
        d.sentAt <= timeRange.end
      );

    const stats = {
      total: deliveries.length,
      successful: 0,
      failed: 0,
      pending: 0,
      expired: 0,
      averageResponseTime: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    deliveries.forEach(delivery => {
      stats[delivery.status]++;
      
      if (delivery.deliveredAt) {
        totalResponseTime += delivery.deliveredAt.getTime() - delivery.sentAt.getTime();
        responseTimeCount++;
      }
    });

    stats.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return stats;
  }
}

export default new WebhookManager();