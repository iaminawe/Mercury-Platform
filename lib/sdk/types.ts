/**
 * Mercury SDK TypeScript Definitions
 * Core types and interfaces for the Mercury Developer SDK
 */

// SDK Configuration
export interface MercurySDKConfig {
  apiKey: string;
  environment?: 'development' | 'staging' | 'production';
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
  webhookSecret?: string;
}

// Plugin System Types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: PluginDependency[];
  hooks: PluginHooks;
  config?: PluginConfig;
}

export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
}

export interface PluginHooks {
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onConfigUpdate?: (config: PluginConfig) => Promise<void>;
  [key: string]: (() => Promise<void>) | undefined;
}

export interface PluginConfig {
  [key: string]: any;
}

export interface PluginManifest {
  plugin: Plugin;
  metadata: {
    installDate: Date;
    isActive: boolean;
    configSchema?: any;
  };
}

// API Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: {
    pagination?: PaginationMeta;
    rateLimit?: RateLimitInfo;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// Authentication Types
export interface AuthConfig {
  type: 'api_key' | 'oauth' | 'jwt';
  credentials: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    token?: string;
    refreshToken?: string;
  };
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  signature?: string;
  version: string;
}

export interface WebhookHandler {
  event: string;
  handler: (event: WebhookEvent) => Promise<void>;
}

export interface WebhookConfig {
  secret: string;
  tolerance?: number; // seconds
  algorithms?: string[];
}

// Store Data Types
export interface Store {
  id: string;
  name: string;
  domain: string;
  platform: 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  vendor?: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  inventory: number;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  inventory: number;
  sku?: string;
  weight?: number;
  options: VariantOption[];
}

export interface VariantOption {
  name: string;
  value: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags: string[];
  totalSpent: number;
  ordersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  items: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed' 
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

// Analytics Types
export interface AnalyticsData {
  metrics: Metric[];
  dimensions: Dimension[];
  period: TimePeriod;
  filters?: AnalyticsFilter[];
}

export interface Metric {
  name: string;
  value: number;
  change?: number;
  changePercent?: number;
}

export interface Dimension {
  name: string;
  values: DimensionValue[];
}

export interface DimensionValue {
  value: string;
  metrics: Metric[];
}

export interface TimePeriod {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface AnalyticsFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
  value: any;
}

// Event Types
export interface MercuryEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
}

export interface EventSubscription {
  event: string;
  callback: (event: MercuryEvent) => void;
  once?: boolean;
}

// Extension Types
export interface Extension {
  id: string;
  name: string;
  type: 'widget' | 'integration' | 'workflow' | 'analytics';
  config: ExtensionConfig;
  isEnabled: boolean;
}

export interface ExtensionConfig {
  [key: string]: any;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Error Types
export class MercuryError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'MercuryError';
    this.code = code;
    this.details = details;
  }
}

export class PluginError extends MercuryError {
  public pluginId: string;

  constructor(message: string, code: string, pluginId: string, details?: any) {
    super(message, code, details);
    this.name = 'PluginError';
    this.pluginId = pluginId;
  }
}

export class APIError extends MercuryError {
  public statusCode: number;
  public endpoint: string;

  constructor(message: string, code: string, statusCode: number, endpoint: string, details?: any) {
    super(message, code, details);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}