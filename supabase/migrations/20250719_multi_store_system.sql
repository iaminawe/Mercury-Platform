-- Multi-Store Management System
-- Enable multi-tenant architecture with cross-store functionality

-- Create store_groups table for organizing multiple stores
CREATE TABLE IF NOT EXISTS public.store_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  max_stores INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update stores table to support grouping
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS store_group_id UUID REFERENCES public.store_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active';

-- Create store_relationships table for cross-store connections
CREATE TABLE IF NOT EXISTS public.store_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  target_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'sync', 'master_slave', 'peer'
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional', -- 'source_to_target', 'target_to_source', 'bidirectional'
  sync_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_store_id, target_store_id, relationship_type)
);

-- Create multi_store_inventory for unified inventory management
CREATE TABLE IF NOT EXISTS public.multi_store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_group_id UUID NOT NULL REFERENCES public.store_groups(id) ON DELETE CASCADE,
  master_product_id TEXT NOT NULL, -- Global product identifier
  product_data JSONB NOT NULL,
  total_inventory INTEGER DEFAULT 0,
  reserved_inventory INTEGER DEFAULT 0,
  available_inventory INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'synced',
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create store_inventory_mappings for linking products across stores
CREATE TABLE IF NOT EXISTS public.store_inventory_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multi_store_inventory_id UUID NOT NULL REFERENCES public.multi_store_inventory(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  local_inventory INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_product_id, shopify_variant_id)
);

-- Create sync_operations for tracking synchronization
CREATE TABLE IF NOT EXISTS public.sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  store_group_id UUID REFERENCES public.store_groups(id) ON DELETE CASCADE,
  source_store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  target_stores UUID[] DEFAULT '{}',
  operation_type TEXT NOT NULL, -- 'inventory_sync', 'product_sync', 'customer_sync'
  sync_mode TEXT NOT NULL, -- 'real_time', 'batch', 'scheduled'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  progress INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_details JSONB,
  payload JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create conflict_resolutions for handling sync conflicts
CREATE TABLE IF NOT EXISTS public.conflict_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_operation_id UUID NOT NULL REFERENCES public.sync_operations(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL, -- 'inventory_mismatch', 'price_conflict', 'data_conflict'
  source_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  target_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  conflict_data JSONB NOT NULL,
  resolution_strategy TEXT, -- 'manual', 'auto_master_wins', 'auto_latest_wins', 'auto_merge'
  resolution_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create store_access_controls for role-based access across stores
CREATE TABLE IF NOT EXISTS public.store_access_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'owner', 'admin', 'manager', 'viewer'
  permissions JSONB DEFAULT '{}',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

-- Create unified_customers for cross-store customer management
CREATE TABLE IF NOT EXISTS public.unified_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_group_id UUID NOT NULL REFERENCES public.store_groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  primary_store_id UUID REFERENCES public.stores(id),
  customer_data JSONB NOT NULL,
  total_spent_across_stores DECIMAL(12, 2) DEFAULT 0,
  total_orders_across_stores INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_group_id, email)
);

-- Create customer_store_mappings for linking customers across stores
CREATE TABLE IF NOT EXISTS public.customer_store_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_customer_id UUID NOT NULL REFERENCES public.unified_customers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_customer_id TEXT NOT NULL,
  local_total_spent DECIMAL(10, 2) DEFAULT 0,
  local_orders_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'synced',
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_customer_id)
);

-- Create indexes for performance
CREATE INDEX idx_store_groups_owner_id ON public.store_groups(owner_id);
CREATE INDEX idx_stores_store_group_id ON public.stores(store_group_id);
CREATE INDEX idx_stores_is_master ON public.stores(is_master);
CREATE INDEX idx_store_relationships_source_store ON public.store_relationships(source_store_id);
CREATE INDEX idx_store_relationships_target_store ON public.store_relationships(target_store_id);
CREATE INDEX idx_multi_store_inventory_group_id ON public.multi_store_inventory(store_group_id);
CREATE INDEX idx_multi_store_inventory_master_product ON public.multi_store_inventory(master_product_id);
CREATE INDEX idx_store_inventory_mappings_store_id ON public.store_inventory_mappings(store_id);
CREATE INDEX idx_store_inventory_mappings_multi_store ON public.store_inventory_mappings(multi_store_inventory_id);
CREATE INDEX idx_sync_operations_group_id ON public.sync_operations(store_group_id);
CREATE INDEX idx_sync_operations_status ON public.sync_operations(status);
CREATE INDEX idx_sync_operations_type ON public.sync_operations(operation_type);
CREATE INDEX idx_conflict_resolutions_sync_op ON public.conflict_resolutions(sync_operation_id);
CREATE INDEX idx_conflict_resolutions_status ON public.conflict_resolutions(status);
CREATE INDEX idx_store_access_controls_user_id ON public.store_access_controls(user_id);
CREATE INDEX idx_store_access_controls_store_id ON public.store_access_controls(store_id);
CREATE INDEX idx_unified_customers_group_id ON public.unified_customers(store_group_id);
CREATE INDEX idx_unified_customers_email ON public.unified_customers(email);
CREATE INDEX idx_customer_store_mappings_unified ON public.customer_store_mappings(unified_customer_id);
CREATE INDEX idx_customer_store_mappings_store ON public.customer_store_mappings(store_id);

-- Enable RLS on all new tables
ALTER TABLE public.store_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_inventory_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_access_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_store_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_groups
CREATE POLICY "Users can manage their store groups" ON public.store_groups
  FOR ALL USING (owner_id = auth.uid());

-- RLS policies for store_relationships
CREATE POLICY "Users can manage store relationships" ON public.store_relationships
  FOR ALL USING (
    source_store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
      UNION
      SELECT store_id FROM public.store_access_controls 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS policies for multi_store_inventory
CREATE POLICY "Users can access their group inventory" ON public.multi_store_inventory
  FOR ALL USING (
    store_group_id IN (
      SELECT id FROM public.store_groups WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for store_inventory_mappings
CREATE POLICY "Users can access inventory mappings" ON public.store_inventory_mappings
  FOR ALL USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
      UNION
      SELECT store_id FROM public.store_access_controls 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS policies for sync_operations
CREATE POLICY "Users can manage sync operations" ON public.sync_operations
  FOR ALL USING (
    store_group_id IN (
      SELECT id FROM public.store_groups WHERE owner_id = auth.uid()
    )
    OR source_store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
      UNION
      SELECT store_id FROM public.store_access_controls 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS policies for conflict_resolutions
CREATE POLICY "Users can manage conflict resolutions" ON public.conflict_resolutions
  FOR ALL USING (
    source_store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
      UNION
      SELECT store_id FROM public.store_access_controls 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS policies for store_access_controls
CREATE POLICY "Users can manage store access" ON public.store_access_controls
  FOR ALL USING (
    user_id = auth.uid()
    OR store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for unified_customers
CREATE POLICY "Users can access unified customers" ON public.unified_customers
  FOR ALL USING (
    store_group_id IN (
      SELECT id FROM public.store_groups WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for customer_store_mappings
CREATE POLICY "Users can access customer mappings" ON public.customer_store_mappings
  FOR ALL USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
      UNION
      SELECT store_id FROM public.store_access_controls 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Create functions for multi-store operations
CREATE OR REPLACE FUNCTION update_inventory_across_stores(
  p_master_product_id TEXT,
  p_store_group_id UUID,
  p_inventory_delta INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_inventory INTEGER;
BEGIN
  -- Update the master inventory
  UPDATE public.multi_store_inventory 
  SET 
    total_inventory = total_inventory + p_inventory_delta,
    available_inventory = available_inventory + p_inventory_delta,
    last_sync_at = NOW(),
    updated_at = NOW()
  WHERE master_product_id = p_master_product_id 
    AND store_group_id = p_store_group_id;
  
  -- Mark all store mappings as needing sync
  UPDATE public.store_inventory_mappings 
  SET sync_status = 'pending'
  WHERE multi_store_inventory_id IN (
    SELECT id FROM public.multi_store_inventory 
    WHERE master_product_id = p_master_product_id 
      AND store_group_id = p_store_group_id
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to resolve inventory conflicts
CREATE OR REPLACE FUNCTION resolve_inventory_conflict(
  p_conflict_id UUID,
  p_resolution_strategy TEXT,
  p_resolved_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict RECORD;
BEGIN
  -- Get conflict details
  SELECT * INTO v_conflict FROM public.conflict_resolutions WHERE id = p_conflict_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Apply resolution based on strategy
  CASE p_resolution_strategy
    WHEN 'auto_master_wins' THEN
      -- Use master store data
      UPDATE public.store_inventory_mappings 
      SET 
        local_inventory = (v_conflict.conflict_data->>'master_inventory')::INTEGER,
        sync_status = 'synced',
        last_sync_at = NOW()
      WHERE store_id = v_conflict.target_store_id
        AND shopify_product_id = v_conflict.conflict_data->>'product_id';
    
    WHEN 'auto_latest_wins' THEN
      -- Use the most recently updated data
      -- Implementation depends on conflict_data structure
      NULL;
    
    ELSE
      -- Manual resolution - just mark as resolved
      NULL;
  END CASE;
  
  -- Mark conflict as resolved
  UPDATE public.conflict_resolutions 
  SET 
    status = 'resolved',
    resolution_strategy = p_resolution_strategy,
    resolved_by = p_resolved_by,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_conflict_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;