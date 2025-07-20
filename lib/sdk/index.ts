/**
 * Mercury SDK - Main Export
 * Entry point for the Mercury Developer SDK
 */

// Core SDK exports
export { MercurySDK, createMercurySDK } from './mercury-sdk';
export { APIClient } from './api-client';
export { PluginManager } from './plugin-manager';
export { WebhookHandler } from './webhook-handler';

// Type exports
export type {
  // Core configuration
  MercurySDKConfig,
  AuthConfig,
  
  // API types
  APIResponse,
  APIError,
  PaginationMeta,
  RateLimitInfo,
  
  // Plugin system
  Plugin,
  PluginManifest,
  PluginConfig,
  PluginHooks,
  PluginDependency,
  
  // Webhook system
  WebhookEvent,
  WebhookHandler as IWebhookHandler,
  WebhookConfig,
  
  // Data models
  Store,
  Product,
  ProductImage,
  ProductVariant,
  VariantOption,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  Address,
  
  // Analytics
  AnalyticsData,
  Metric,
  Dimension,
  DimensionValue,
  TimePeriod,
  AnalyticsFilter,
  
  // Events and extensions
  MercuryEvent,
  EventSubscription,
  Extension,
  ExtensionConfig,
  
  // Utility types
  DeepPartial,
  RequiredFields,
  OptionalFields
} from './types';

// Error exports
export { MercuryError, PluginError, APIError } from './types';

// SDK version
export const SDK_VERSION = '1.0.0';

// Default configuration
export const DEFAULT_CONFIG: Partial<MercurySDKConfig> = {
  environment: 'production',
  timeout: 30000,
  retryAttempts: 3,
  enableLogging: false
};

// Utility functions
export function validateApiKey(apiKey: string): boolean {
  // Basic API key validation
  return typeof apiKey === 'string' && apiKey.length >= 32;
}

export function isValidEnvironment(env: string): env is 'development' | 'staging' | 'production' {
  return ['development', 'staging', 'production'].includes(env);
}

// Quick start helper
export function quickStart(apiKey: string, options?: Partial<MercurySDKConfig>) {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid API key provided');
  }

  const config: MercurySDKConfig = {
    ...DEFAULT_CONFIG,
    ...options,
    apiKey
  };

  return createMercurySDK(config);
}

// Plugin helpers
export function createPlugin(definition: Omit<Plugin, 'hooks'> & { hooks?: Partial<PluginHooks> }): Plugin {
  return {
    hooks: {},
    ...definition
  } as Plugin;
}

// Webhook helpers
export function createWebhookHandler(secret: string, config?: Partial<WebhookConfig>) {
  return new WebhookHandler(secret, config);
}

// Re-export everything for convenience
export default MercurySDK;