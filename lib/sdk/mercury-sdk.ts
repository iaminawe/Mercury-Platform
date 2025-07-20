/**
 * Mercury SDK - Main SDK Class
 * Provides unified access to Mercury platform capabilities
 */

import { APIClient } from './api-client';
import { PluginManager } from './plugin-manager';
import { WebhookHandler } from './webhook-handler';
import { 
  MercurySDKConfig,
  Store,
  Product,
  Customer,
  Order,
  AnalyticsData,
  Plugin,
  Extension,
  MercuryEvent,
  EventSubscription,
  MercuryError
} from './types';

export class MercurySDK {
  private config: MercurySDKConfig;
  private apiClient: APIClient;
  private pluginManager: PluginManager;
  private webhookHandler: WebhookHandler;
  private eventListeners: Map<string, Set<EventSubscription>> = new Map();

  constructor(config: MercurySDKConfig) {
    this.validateConfig(config);
    this.config = {
      environment: 'production',
      timeout: 30000,
      retryAttempts: 3,
      enableLogging: false,
      ...config
    };

    this.apiClient = new APIClient(this.config);
    this.pluginManager = new PluginManager(this);
    this.webhookHandler = new WebhookHandler(this.config.webhookSecret || '');

    this.setupEventHandling();
  }

  // Configuration Management
  private validateConfig(config: MercurySDKConfig): void {
    if (!config.apiKey) {
      throw new MercuryError('API key is required', 'MISSING_API_KEY');
    }

    if (config.environment && !['development', 'staging', 'production'].includes(config.environment)) {
      throw new MercuryError('Invalid environment', 'INVALID_ENVIRONMENT');
    }
  }

  public getConfig(): Readonly<MercurySDKConfig> {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<MercurySDKConfig>): void {
    this.config = { ...this.config, ...updates };
    this.apiClient.updateConfig(this.config);
  }

  // Store Management
  public async getStores(): Promise<Store[]> {
    try {
      const response = await this.apiClient.get<Store[]>('/stores');
      return response.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch stores');
    }
  }

  public async getStore(storeId: string): Promise<Store> {
    try {
      const response = await this.apiClient.get<Store>(`/stores/${storeId}`);
      if (!response.data) {
        throw new MercuryError('Store not found', 'STORE_NOT_FOUND');
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch store');
    }
  }

  public async createStore(storeData: Partial<Store>): Promise<Store> {
    try {
      const response = await this.apiClient.post<Store>('/stores', storeData);
      if (!response.data) {
        throw new MercuryError('Failed to create store', 'STORE_CREATION_FAILED');
      }
      this.emit('store:created', response.data);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create store');
    }
  }

  public async updateStore(storeId: string, updates: Partial<Store>): Promise<Store> {
    try {
      const response = await this.apiClient.put<Store>(`/stores/${storeId}`, updates);
      if (!response.data) {
        throw new MercuryError('Failed to update store', 'STORE_UPDATE_FAILED');
      }
      this.emit('store:updated', response.data);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update store');
    }
  }

  // Product Management
  public async getProducts(storeId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
  }): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);
      if (options?.tags) params.append('tags', options.tags.join(','));

      const response = await this.apiClient.get<Product[]>(
        `/stores/${storeId}/products?${params.toString()}`
      );
      return response.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch products');
    }
  }

  public async getProduct(storeId: string, productId: string): Promise<Product> {
    try {
      const response = await this.apiClient.get<Product>(
        `/stores/${storeId}/products/${productId}`
      );
      if (!response.data) {
        throw new MercuryError('Product not found', 'PRODUCT_NOT_FOUND');
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch product');
    }
  }

  public async createProduct(storeId: string, productData: Partial<Product>): Promise<Product> {
    try {
      const response = await this.apiClient.post<Product>(
        `/stores/${storeId}/products`,
        productData
      );
      if (!response.data) {
        throw new MercuryError('Failed to create product', 'PRODUCT_CREATION_FAILED');
      }
      this.emit('product:created', { storeId, product: response.data });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create product');
    }
  }

  public async updateProduct(
    storeId: string,
    productId: string,
    updates: Partial<Product>
  ): Promise<Product> {
    try {
      const response = await this.apiClient.put<Product>(
        `/stores/${storeId}/products/${productId}`,
        updates
      );
      if (!response.data) {
        throw new MercuryError('Failed to update product', 'PRODUCT_UPDATE_FAILED');
      }
      this.emit('product:updated', { storeId, product: response.data });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update product');
    }
  }

  public async deleteProduct(storeId: string, productId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/stores/${storeId}/products/${productId}`);
      this.emit('product:deleted', { storeId, productId });
    } catch (error) {
      throw this.handleError(error, 'Failed to delete product');
    }
  }

  // Customer Management
  public async getCustomers(storeId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<Customer[]> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.search) params.append('search', options.search);

      const response = await this.apiClient.get<Customer[]>(
        `/stores/${storeId}/customers?${params.toString()}`
      );
      return response.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch customers');
    }
  }

  public async getCustomer(storeId: string, customerId: string): Promise<Customer> {
    try {
      const response = await this.apiClient.get<Customer>(
        `/stores/${storeId}/customers/${customerId}`
      );
      if (!response.data) {
        throw new MercuryError('Customer not found', 'CUSTOMER_NOT_FOUND');
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch customer');
    }
  }

  // Order Management
  public async getOrders(storeId: string, options?: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
  }): Promise<Order[]> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.status) params.append('status', options.status);
      if (options?.customerId) params.append('customerId', options.customerId);

      const response = await this.apiClient.get<Order[]>(
        `/stores/${storeId}/orders?${params.toString()}`
      );
      return response.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch orders');
    }
  }

  public async getOrder(storeId: string, orderId: string): Promise<Order> {
    try {
      const response = await this.apiClient.get<Order>(
        `/stores/${storeId}/orders/${orderId}`
      );
      if (!response.data) {
        throw new MercuryError('Order not found', 'ORDER_NOT_FOUND');
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch order');
    }
  }

  // Analytics
  public async getAnalytics(storeId: string, options: {
    metrics: string[];
    startDate: Date;
    endDate: Date;
    granularity?: 'hour' | 'day' | 'week' | 'month';
    dimensions?: string[];
  }): Promise<AnalyticsData> {
    try {
      const response = await this.apiClient.post<AnalyticsData>(
        `/stores/${storeId}/analytics`,
        options
      );
      if (!response.data) {
        throw new MercuryError('Failed to fetch analytics', 'ANALYTICS_FETCH_FAILED');
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch analytics');
    }
  }

  // Plugin System Access
  public get plugins(): PluginManager {
    return this.pluginManager;
  }

  // Webhook System Access
  public get webhooks(): WebhookHandler {
    return this.webhookHandler;
  }

  // Event System
  private setupEventHandling(): void {
    // Setup internal event handling
    this.webhookHandler.on('webhook:received', (event) => {
      this.emit('webhook:received', event);
    });
  }

  public on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    const subscription: EventSubscription = { event, callback };
    this.eventListeners.get(event)!.add(subscription);
  }

  public once(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    const subscription: EventSubscription = { event, callback, once: true };
    this.eventListeners.get(event)!.add(subscription);
  }

  public off(event: string, callback?: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    if (callback) {
      for (const subscription of listeners) {
        if (subscription.callback === callback) {
          listeners.delete(subscription);
          break;
        }
      }
    } else {
      listeners.clear();
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    const mercuryEvent: MercuryEvent = {
      type: event,
      payload: data,
      timestamp: new Date(),
      source: 'mercury-sdk'
    };

    const toRemove: EventSubscription[] = [];
    
    for (const subscription of listeners) {
      try {
        subscription.callback(mercuryEvent);
        if (subscription.once) {
          toRemove.push(subscription);
        }
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }

    // Remove one-time listeners
    toRemove.forEach(subscription => listeners.delete(subscription));
  }

  // Utility Methods
  private handleError(error: any, defaultMessage: string): MercuryError {
    if (error instanceof MercuryError) {
      return error;
    }

    const message = error.message || defaultMessage;
    const code = error.code || 'UNKNOWN_ERROR';
    
    return new MercuryError(message, code, error);
  }

  public async health(): Promise<{ status: string; timestamp: Date; version: string }> {
    try {
      const response = await this.apiClient.get('/health');
      return {
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      throw this.handleError(error, 'Health check failed');
    }
  }

  // Cleanup
  public destroy(): void {
    this.eventListeners.clear();
    this.pluginManager.destroy();
    this.webhookHandler.destroy();
  }
}

// Export convenience factory function
export function createMercurySDK(config: MercurySDKConfig): MercurySDK {
  return new MercurySDK(config);
}

export default MercurySDK;