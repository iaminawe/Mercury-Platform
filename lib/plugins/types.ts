/**
 * Plugin Architecture Types
 * Core type definitions for Mercury's plugin system
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };
  repository?: string;
  tags: string[];
  category: 'ai' | 'analytics' | 'integration' | 'ui' | 'automation' | 'marketing' | 'security';
  
  // Plugin configuration
  main: string; // Entry point file
  permissions: PluginPermission[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  
  // Mercury-specific
  mercuryVersion: string;
  storeTypes: ('shopify' | 'woocommerce' | 'magento' | 'custom')[];
  
  // Marketplace metadata
  price?: {
    type: 'free' | 'paid' | 'freemium';
    amount?: number;
    currency?: string;
    billing?: 'one-time' | 'monthly' | 'annual';
  };
  
  // Runtime configuration
  hooks: PluginHook[];
  assets?: string[];
  config?: Record<string, PluginConfigField>;
}

export interface PluginPermission {
  type: 'api' | 'database' | 'file' | 'network' | 'storage' | 'analytics' | 'customer-data';
  resource: string;
  access: 'read' | 'write' | 'admin';
  description: string;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority?: number;
  async?: boolean;
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string;
  };
}

export interface PluginContext {
  plugin: {
    id: string;
    version: string;
    config: Record<string, any>;
    dataDir: string;
    tempDir: string;
  };
  mercury: {
    version: string;
    store: {
      id: string;
      platform: string;
      domain: string;
    };
    user: {
      id: string;
      role: string;
      permissions: string[];
    };
  };
  api: PluginAPI;
  logger: PluginLogger;
}

export interface PluginAPI {
  // Store data access
  store: {
    products: any;
    orders: any;
    customers: any;
    analytics: any;
  };
  
  // Mercury services
  ai: {
    vectorStore: any;
    embeddings: any;
    chat: any;
  };
  
  // HTTP client with rate limiting
  http: {
    get: (url: string, options?: any) => Promise<any>;
    post: (url: string, data: any, options?: any) => Promise<any>;
    put: (url: string, data: any, options?: any) => Promise<any>;
    delete: (url: string, options?: any) => Promise<any>;
  };
  
  // Database access (sandboxed)
  db: {
    select: (table: string, conditions?: any) => Promise<any[]>;
    insert: (table: string, data: any) => Promise<any>;
    update: (table: string, data: any, conditions: any) => Promise<any>;
    delete: (table: string, conditions: any) => Promise<any>;
  };
  
  // Storage
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: (prefix?: string) => Promise<string[]>;
  };
  
  // Events
  events: {
    emit: (event: string, data: any) => Promise<void>;
    on: (event: string, handler: Function) => void;
    off: (event: string, handler: Function) => void;
  };
}

export interface PluginLogger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
}

export interface PluginInstance {
  manifest: PluginManifest;
  module: any;
  context: PluginContext;
  status: 'loading' | 'active' | 'inactive' | 'error';
  error?: Error;
  
  // Runtime state
  startedAt?: Date;
  lastActivity?: Date;
  metrics: {
    apiCalls: number;
    errors: number;
    execTime: number;
  };
}

export interface PluginSandbox {
  vm: any;
  globals: Record<string, any>;
  limits: {
    memory: number;
    cpu: number;
    network: number;
    storage: number;
  };
  restrictions: {
    allowedModules: string[];
    blockedAPIs: string[];
    networkWhitelist: string[];
  };
}

export interface PluginMarketplace {
  plugins: PluginMarketplaceEntry[];
  categories: string[];
  featured: string[];
  trending: string[];
}

export interface PluginMarketplaceEntry {
  manifest: PluginManifest;
  stats: {
    downloads: number;
    rating: number;
    reviews: number;
    lastUpdated: Date;
  };
  versions: PluginVersion[];
  verification: {
    verified: boolean;
    security: 'safe' | 'warning' | 'danger';
    compatibility: string[];
  };
}

export interface PluginVersion {
  version: string;
  changelog: string;
  releaseDate: Date;
  downloadUrl: string;
  checksum: string;
  deprecated?: boolean;
}

export interface PluginInstallation {
  pluginId: string;
  version: string;
  installedAt: Date;
  installedBy: string;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'updating' | 'error';
  autoUpdate: boolean;
}

export interface PluginDevelopment {
  scaffoldTemplate: (type: string, name: string) => Promise<string>;
  build: (pluginPath: string) => Promise<boolean>;
  test: (pluginPath: string) => Promise<any>;
  package: (pluginPath: string) => Promise<string>;
  publish: (packagePath: string, registry: string) => Promise<boolean>;
}

// Event types
export type PluginEvent = 
  | 'plugin.installed'
  | 'plugin.activated'
  | 'plugin.deactivated'
  | 'plugin.uninstalled'
  | 'plugin.updated'
  | 'plugin.error'
  | 'store.product.created'
  | 'store.product.updated'
  | 'store.order.created'
  | 'store.order.updated'
  | 'store.customer.created'
  | 'store.customer.updated'
  | 'analytics.data.updated'
  | 'ai.recommendation.generated'
  | 'workflow.triggered'
  | 'user.action';

export interface PluginEventData {
  plugin?: string;
  timestamp: Date;
  user?: string;
  store?: string;
  data: any;
}