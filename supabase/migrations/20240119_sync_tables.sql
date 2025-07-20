-- Create collections table
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_collection_id TEXT NOT NULL,
  title TEXT NOT NULL,
  handle TEXT NOT NULL,
  description TEXT,
  products_count INTEGER DEFAULT 0,
  data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_collection_id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_customer_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  accepts_marketing BOOLEAN DEFAULT false,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_customer_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  email TEXT,
  financial_status TEXT,
  fulfillment_status TEXT,
  total_price DECIMAL(10, 2) NOT NULL,
  subtotal_price DECIMAL(10, 2) NOT NULL,
  total_tax DECIMAL(10, 2) DEFAULT 0,
  currency TEXT NOT NULL,
  customer_id TEXT,
  line_items_count INTEGER DEFAULT 0,
  data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_order_id)
);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  sku TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  position INTEGER DEFAULT 1,
  data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_variant_id)
);

-- Create sync_jobs table for tracking bulk imports
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_collections_store_id ON public.collections(store_id);
CREATE INDEX idx_collections_handle ON public.collections(handle);
CREATE INDEX idx_customers_store_id ON public.customers(store_id);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_orders_store_id ON public.orders(store_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_product_variants_store_id ON public.product_variants(store_id);
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_sync_jobs_store_id ON public.sync_jobs(store_id);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);

-- Add RLS policies
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for collections
CREATE POLICY "Users can view their store's collections" ON public.collections
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for customers
CREATE POLICY "Users can view their store's customers" ON public.customers
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for orders
CREATE POLICY "Users can view their store's orders" ON public.orders
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for product_variants
CREATE POLICY "Users can view their store's product variants" ON public.product_variants
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for sync_jobs
CREATE POLICY "Users can view their store's sync jobs" ON public.sync_jobs
  FOR ALL USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );