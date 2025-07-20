/**
 * Mercury Webhook System
 * Comprehensive webhook management for the Mercury platform
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { z } from 'zod';

// Webhook Event Types
export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: any;
  source: string;
  version: string;
  idempotencyKey?: string;
}

// Webhook Endpoint Configuration
export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  description?: string;
  headers?: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffDelay: number;
  };
  timeoutMs: number;
  filterExpression?: string;
}

// Webhook Delivery Attempt
export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  responseCode?: number;
  responseBody?: string;
  errorMessage?: string;
  timestamp: number;
  duration?: number;
}

// Webhook Validation Schemas
export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  data: z.any(),
  source: z.string(),
  version: z.string(),
  idempotencyKey: z.string().optional()
});

export const WebhookEndpointSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()),
  active: z.boolean().default(true),
  description: z.string().optional(),
  headers: z.record(z.string()).optional(),
  retryConfig: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    backoffMultiplier: z.number().min(1).default(2),
    maxBackoffDelay: z.number().min(1000).default(300000)
  }).default({}),
  timeoutMs: z.number().min(1000).max(30000).default(10000),
  filterExpression: z.string().optional()
});

export class WebhookSystem extends EventEmitter {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private retryQueue: Set<string> = new Set();
  private isProcessing = false;

  constructor() {
    super();
    this.startRetryProcessor();
  }

  /**
   * Register a new webhook endpoint
   */
  async registerEndpoint(config: Omit<WebhookEndpoint, 'id'>): Promise<string> {
    // Validate configuration
    const validated = WebhookEndpointSchema.parse(config);
    
    const endpoint: WebhookEndpoint = {
      id: crypto.randomUUID(),
      ...validated
    };

    // Test endpoint connectivity
    await this.testEndpoint(endpoint);
    
    this.endpoints.set(endpoint.id, endpoint);
    
    this.emit('endpoint:registered', { endpointId: endpoint.id });
    
    return endpoint.id;
  }

  /**
   * Update webhook endpoint configuration
   */
  async updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<void> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    const updated = { ...endpoint, ...updates };
    const validated = WebhookEndpointSchema.parse(updated);
    
    // Test updated endpoint if URL or headers changed
    if (updates.url || updates.headers) {
      await this.testEndpoint({ ...endpoint, ...validated });
    }
    
    this.endpoints.set(id, { ...endpoint, ...validated });
    
    this.emit('endpoint:updated', { endpointId: id });
  }

  /**
   * Remove webhook endpoint
   */
  async removeEndpoint(id: string): Promise<void> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    this.endpoints.delete(id);
    
    // Remove pending deliveries for this endpoint
    for (const [deliveryId, delivery] of this.deliveries) {
      if (delivery.endpointId === id && delivery.status === 'pending') {
        this.deliveries.delete(deliveryId);
        this.retryQueue.delete(deliveryId);
      }
    }
    
    this.emit('endpoint:removed', { endpointId: id });
  }

  /**
   * Emit webhook event to all matching endpoints
   */
  async emitEvent(eventType: string, data: any, source = 'mercury'): Promise<void> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: Date.now(),
      data,
      source,
      version: '1.0',
      idempotencyKey: crypto.randomUUID()
    };

    // Validate event
    WebhookEventSchema.parse(event);

    // Find matching endpoints
    const matchingEndpoints = Array.from(this.endpoints.values())
      .filter(endpoint => 
        endpoint.active && 
        endpoint.events.includes(eventType) &&
        this.matchesFilter(event, endpoint.filterExpression)
      );

    // Create delivery attempts
    for (const endpoint of matchingEndpoints) {
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        endpointId: endpoint.id,
        eventId: event.id,
        attempt: 1,
        status: 'pending',
        timestamp: Date.now()
      };

      this.deliveries.set(delivery.id, delivery);
      this.retryQueue.add(delivery.id);
    }

    this.emit('event:emitted', { 
      eventId: event.id, 
      type: eventType, 
      endpointCount: matchingEndpoints.length 
    });

    // Process deliveries
    if (!this.isProcessing) {
      this.processDeliveries();
    }
  }

  /**
   * Test webhook endpoint connectivity
   */
  async testEndpoint(endpoint: WebhookEndpoint): Promise<boolean> {
    const testEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      type: 'webhook:test',
      timestamp: Date.now(),
      data: { message: 'This is a test webhook' },
      source: 'mercury',
      version: '1.0'
    };

    try {
      const response = await this.deliverWebhook(endpoint, testEvent);
      return response.ok;
    } catch (error) {
      throw new Error(`Webhook endpoint test failed: ${error.message}`);
    }
  }

  /**
   * Get webhook endpoint by ID
   */
  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id);
  }

  /**
   * List all webhook endpoints
   */
  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get webhook delivery by ID
   */
  getDelivery(id: string): WebhookDelivery | undefined {
    return this.deliveries.get(id);
  }

  /**
   * List webhook deliveries for an endpoint
   */
  listDeliveries(endpointId?: string, limit = 100): WebhookDelivery[] {
    const deliveries = Array.from(this.deliveries.values())
      .filter(delivery => !endpointId || delivery.endpointId === endpointId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return deliveries;
  }

  /**
   * Get webhook delivery statistics
   */
  getDeliveryStats(endpointId?: string): {
    total: number;
    success: number;
    failed: number;
    pending: number;
    successRate: number;
  } {
    const deliveries = this.listDeliveries(endpointId, 1000);
    
    const total = deliveries.length;
    const success = deliveries.filter(d => d.status === 'success').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const pending = deliveries.filter(d => d.status === 'pending').length;
    const successRate = total > 0 ? (success / total) * 100 : 0;

    return { total, success, failed, pending, successRate };
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Private: Process webhook deliveries
   */
  private async processDeliveries(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      const pendingDeliveries = Array.from(this.retryQueue);
      
      for (const deliveryId of pendingDeliveries) {
        const delivery = this.deliveries.get(deliveryId);
        const endpoint = delivery ? this.endpoints.get(delivery.endpointId) : undefined;
        
        if (!delivery || !endpoint) {
          this.retryQueue.delete(deliveryId);
          continue;
        }

        await this.processDelivery(delivery, endpoint);
        
        // Small delay between deliveries to avoid overwhelming endpoints
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
    }

    // Schedule next processing cycle if there are still pending deliveries
    if (this.retryQueue.size > 0) {
      setTimeout(() => this.processDeliveries(), 5000);
    }
  }

  /**
   * Private: Process individual webhook delivery
   */
  private async processDelivery(delivery: WebhookDelivery, endpoint: WebhookEndpoint): Promise<void> {
    const event = this.findEventById(delivery.eventId);
    if (!event) {
      this.retryQueue.delete(delivery.id);
      return;
    }

    const startTime = Date.now();
    
    try {
      const response = await this.deliverWebhook(endpoint, event);
      
      delivery.status = response.ok ? 'success' : 'failed';
      delivery.responseCode = response.status;
      delivery.responseBody = await response.text().catch(() => '');
      delivery.duration = Date.now() - startTime;
      
      this.retryQueue.delete(delivery.id);
      
      this.emit('delivery:completed', { 
        deliveryId: delivery.id, 
        status: delivery.status,
        endpointId: endpoint.id 
      });
      
    } catch (error) {
      delivery.status = 'failed';
      delivery.errorMessage = error.message;
      delivery.duration = Date.now() - startTime;
      
      // Schedule retry if within limits
      if (delivery.attempt < endpoint.retryConfig.maxRetries) {
        const retryDelay = this.calculateRetryDelay(
          delivery.attempt, 
          endpoint.retryConfig
        );
        
        setTimeout(() => {
          delivery.attempt++;
          delivery.status = 'pending';
          delivery.timestamp = Date.now();
          this.retryQueue.add(delivery.id);
          
          if (!this.isProcessing) {
            this.processDeliveries();
          }
        }, retryDelay);
        
        this.emit('delivery:retry_scheduled', { 
          deliveryId: delivery.id, 
          attempt: delivery.attempt,
          retryDelay 
        });
      } else {
        this.retryQueue.delete(delivery.id);
        
        this.emit('delivery:failed', { 
          deliveryId: delivery.id, 
          endpointId: endpoint.id,
          error: error.message 
        });
      }
    }
    
    this.deliveries.set(delivery.id, delivery);
  }

  /**
   * Private: Deliver webhook to endpoint
   */
  private async deliverWebhook(endpoint: WebhookEndpoint, event: WebhookEvent): Promise<Response> {
    const payload = JSON.stringify(event);
    const signature = this.generateSignature(payload, endpoint.secret);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mercury-Webhooks/1.0',
      'X-Mercury-Signature': signature,
      'X-Mercury-Event-Type': event.type,
      'X-Mercury-Event-ID': event.id,
      'X-Mercury-Timestamp': event.timestamp.toString(),
      ...endpoint.headers
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Private: Check if event matches filter expression
   */
  private matchesFilter(event: WebhookEvent, filterExpression?: string): boolean {
    if (!filterExpression) return true;
    
    try {
      // Simple filter expression evaluation
      // In production, use a proper expression evaluator
      const context = { event, data: event.data };
      return new Function('context', `with(context) { return ${filterExpression}; }`)(context);
    } catch {
      return true; // Default to true if filter evaluation fails
    }
  }

  /**
   * Private: Find event by ID (in production, store events in database)
   */
  private findEventById(eventId: string): WebhookEvent | undefined {
    // In production, this would query the database
    // For now, we'll construct a basic event
    return {
      id: eventId,
      type: 'unknown',
      timestamp: Date.now(),
      data: {},
      source: 'mercury',
      version: '1.0'
    };
  }

  /**
   * Private: Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config: WebhookEndpoint['retryConfig']): number {
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxBackoffDelay);
  }

  /**
   * Private: Start retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      if (this.retryQueue.size > 0 && !this.isProcessing) {
        this.processDeliveries();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Cleanup old deliveries (call periodically)
   */
  cleanup(maxAge = 7 * 24 * 60 * 60 * 1000): void { // 7 days default
    const cutoff = Date.now() - maxAge;
    
    for (const [deliveryId, delivery] of this.deliveries) {
      if (delivery.timestamp < cutoff && delivery.status !== 'pending') {
        this.deliveries.delete(deliveryId);
      }
    }
  }
}

// Export singleton instance
export const webhookSystem = new WebhookSystem();

// Webhook event types for Mercury platform
export const WEBHOOK_EVENTS = {
  // Store events
  STORE_CREATED: 'store.created',
  STORE_UPDATED: 'store.updated',
  STORE_DELETED: 'store.deleted',
  
  // Product events
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  PRODUCT_INVENTORY_LOW: 'product.inventory.low',
  
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_PAID: 'order.paid',
  ORDER_FULFILLED: 'order.fulfilled',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',
  
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  
  // Analytics events
  ANALYTICS_THRESHOLD_EXCEEDED: 'analytics.threshold.exceeded',
  ANALYTICS_ANOMALY_DETECTED: 'analytics.anomaly.detected',
  
  // AI events
  AI_RECOMMENDATION_GENERATED: 'ai.recommendation.generated',
  AI_MODEL_TRAINED: 'ai.model.trained',
  AI_PREDICTION_MADE: 'ai.prediction.made',
  
  // Plugin events
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_ACTIVATED: 'plugin.activated',
  PLUGIN_DEACTIVATED: 'plugin.deactivated',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
  
  // System events
  SYSTEM_HEALTH_CHECK: 'system.health.check',
  SYSTEM_BACKUP_COMPLETED: 'system.backup.completed',
  SYSTEM_ERROR: 'system.error'
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];