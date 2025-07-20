// Multi-Store System Types

export interface StoreGroup {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  settings: {
    max_stores: number;
    default_sync_mode: 'real_time' | 'batch' | 'scheduled';
    conflict_resolution_strategy: 'manual' | 'auto_master_wins' | 'auto_latest_wins';
    inventory_sync_enabled: boolean;
    customer_sync_enabled: boolean;
    product_sync_enabled: boolean;
  };
  max_stores: number;
  created_at: string;
  updated_at: string;
}

export interface EnhancedStore {
  id: string;
  shop_domain: string;
  access_token: string;
  shop_name: string;
  email: string;
  owner_id: string;
  plan: string;
  store_group_id?: string;
  is_master: boolean;
  sync_enabled: boolean;
  last_sync_at?: string;
  sync_status: 'active' | 'paused' | 'error' | 'syncing';
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface StoreRelationship {
  id: string;
  source_store_id: string;
  target_store_id: string;
  relationship_type: 'sync' | 'master_slave' | 'peer';
  sync_direction: 'source_to_target' | 'target_to_source' | 'bidirectional';
  sync_config: {
    sync_inventory: boolean;
    sync_products: boolean;
    sync_customers: boolean;
    sync_orders: boolean;
    batch_size: number;
    sync_frequency: string; // cron expression
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MultiStoreInventory {
  id: string;
  store_group_id: string;
  master_product_id: string;
  product_data: {
    title: string;
    handle: string;
    product_type: string;
    vendor: string;
    tags: string[];
    variants: ProductVariant[];
  };
  total_inventory: number;
  reserved_inventory: number;
  available_inventory: number;
  sync_status: 'synced' | 'pending' | 'conflicted' | 'error';
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  inventory_quantity: number;
  position: number;
}

export interface StoreInventoryMapping {
  id: string;
  multi_store_inventory_id: string;
  store_id: string;
  shopify_product_id: string;
  shopify_variant_id?: string;
  local_inventory: number;
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncOperation {
  id: string;
  operation_id: string;
  store_group_id?: string;
  source_store_id?: string;
  target_stores: string[];
  operation_type: 'inventory_sync' | 'product_sync' | 'customer_sync' | 'full_sync';
  sync_mode: 'real_time' | 'batch' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_details?: {
    message: string;
    stack?: string;
    failed_items: Array<{
      id: string;
      error: string;
    }>;
  };
  payload?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConflictResolution {
  id: string;
  sync_operation_id: string;
  conflict_type: 'inventory_mismatch' | 'price_conflict' | 'data_conflict' | 'duplicate_product';
  source_store_id: string;
  target_store_id: string;
  conflict_data: {
    product_id?: string;
    variant_id?: string;
    source_value: any;
    target_value: any;
    field_name: string;
    conflict_reason: string;
  };
  resolution_strategy?: 'manual' | 'auto_master_wins' | 'auto_latest_wins' | 'auto_merge';
  resolution_data?: Record<string, any>;
  status: 'pending' | 'resolved' | 'ignored';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreAccessControl {
  id: string;
  user_id: string;
  store_id: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  permissions: {
    read_products: boolean;
    write_products: boolean;
    read_inventory: boolean;
    write_inventory: boolean;
    read_customers: boolean;
    write_customers: boolean;
    read_orders: boolean;
    write_orders: boolean;
    manage_sync: boolean;
    resolve_conflicts: boolean;
  };
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnifiedCustomer {
  id: string;
  store_group_id: string;
  email: string;
  primary_store_id?: string;
  customer_data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    accepts_marketing: boolean;
    addresses: Array<{
      address1: string;
      address2?: string;
      city: string;
      province: string;
      country: string;
      zip: string;
      is_default: boolean;
    }>;
  };
  total_spent_across_stores: number;
  total_orders_across_stores: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerStoreMapping {
  id: string;
  unified_customer_id: string;
  store_id: string;
  shopify_customer_id: string;
  local_total_spent: number;
  local_orders_count: number;
  sync_status: 'synced' | 'pending' | 'error';
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

// Sync Configuration Types
export interface SyncConfig {
  mode: 'real_time' | 'batch' | 'scheduled';
  batch_size: number;
  retry_attempts: number;
  retry_delay: number; // milliseconds
  conflict_resolution: 'manual' | 'auto_master_wins' | 'auto_latest_wins';
  enabled_sync_types: ('inventory' | 'products' | 'customers' | 'orders')[];
  schedule?: {
    cron: string;
    timezone: string;
  };
}

export interface SyncProgress {
  operation_id: string;
  status: SyncOperation['status'];
  progress_percentage: number;
  current_step: string;
  total_steps: number;
  completed_steps: number;
  estimated_completion?: string;
  last_update: string;
}

// Error Types
export interface MultiStoreError extends Error {
  code: string;
  store_id?: string;
  operation_id?: string;
  context?: Record<string, any>;
}

export class SyncConflictError extends Error implements MultiStoreError {
  code = 'SYNC_CONFLICT';
  constructor(
    message: string,
    public store_id: string,
    public operation_id: string,
    public conflict_data: ConflictResolution['conflict_data'],
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SyncConflictError';
  }
}

export class StoreConnectionError extends Error implements MultiStoreError {
  code = 'STORE_CONNECTION_ERROR';
  constructor(
    message: string,
    public store_id: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'StoreConnectionError';
  }
}

// Event Types for Real-time Updates
export interface MultiStoreEvent {
  type: 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'store_connected' | 'store_disconnected';
  store_group_id?: string;
  store_id?: string;
  operation_id?: string;
  data: Record<string, any>;
  timestamp: string;
}

// Analytics Types
export interface MultiStoreAnalytics {
  store_group_id: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    total_stores: number;
    active_stores: number;
    total_products: number;
    total_inventory_value: number;
    total_customers: number;
    unified_customers: number;
    sync_operations: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
    };
    conflicts: {
      total: number;
      resolved: number;
      pending: number;
    };
    performance: {
      avg_sync_time: number;
      sync_success_rate: number;
      data_freshness: number; // minutes
    };
  };
}