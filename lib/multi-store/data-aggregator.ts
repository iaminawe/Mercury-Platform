// Cross-Store Data Aggregation System
import { createClient } from '@/lib/supabase/server';
import { 
  MultiStoreInventory, 
  StoreInventoryMapping, 
  UnifiedCustomer,
  CustomerStoreMapping,
  MultiStoreAnalytics,
  MultiStoreError 
} from './types';

export class DataAggregator {
  private supabase = createClient();

  // Product & Inventory Aggregation
  async aggregateInventoryAcrossStores(storeGroupId: string): Promise<MultiStoreInventory[]> {
    const { data, error } = await this.supabase
      .from('multi_store_inventory')
      .select(`
        *,
        store_mappings:store_inventory_mappings (
          *,
          store:stores (
            id,
            shop_name,
            shop_domain,
            is_master
          )
        )
      `)
      .eq('store_group_id', storeGroupId)
      .order('last_sync_at', { ascending: false });

    if (error) {
      throw new MultiStoreError(`Failed to aggregate inventory: ${error.message}`, {
        code: 'AGGREGATE_INVENTORY_FAILED',
        context: { storeGroupId, error }
      });
    }

    return data || [];
  }

  async createUnifiedProduct(
    storeGroupId: string,
    masterProductId: string,
    productData: MultiStoreInventory['product_data'],
    storeMappings: Array<{
      store_id: string;
      shopify_product_id: string;
      shopify_variant_id?: string;
      local_inventory: number;
    }>
  ): Promise<MultiStoreInventory> {
    const totalInventory = storeMappings.reduce((sum, mapping) => sum + mapping.local_inventory, 0);

    // Create master inventory record
    const { data: inventory, error: inventoryError } = await this.supabase
      .from('multi_store_inventory')
      .insert({
        store_group_id: storeGroupId,
        master_product_id: masterProductId,
        product_data: productData,
        total_inventory: totalInventory,
        available_inventory: totalInventory,
        sync_status: 'synced',
        last_sync_at: new Date().toISOString()
      })
      .select()
      .single();

    if (inventoryError) {
      throw new MultiStoreError(`Failed to create unified product: ${inventoryError.message}`, {
        code: 'CREATE_UNIFIED_PRODUCT_FAILED',
        context: { storeGroupId, masterProductId, inventoryError }
      });
    }

    // Create store mappings
    const mappingInserts = storeMappings.map(mapping => ({
      multi_store_inventory_id: inventory.id,
      store_id: mapping.store_id,
      shopify_product_id: mapping.shopify_product_id,
      shopify_variant_id: mapping.shopify_variant_id,
      local_inventory: mapping.local_inventory,
      sync_status: 'synced',
      last_sync_at: new Date().toISOString()
    }));

    const { error: mappingError } = await this.supabase
      .from('store_inventory_mappings')
      .insert(mappingInserts);

    if (mappingError) {
      // Rollback inventory creation
      await this.supabase
        .from('multi_store_inventory')
        .delete()
        .eq('id', inventory.id);

      throw new MultiStoreError(`Failed to create store mappings: ${mappingError.message}`, {
        code: 'CREATE_STORE_MAPPINGS_FAILED',
        context: { inventoryId: inventory.id, mappingError }
      });
    }

    return inventory;
  }

  async updateInventoryAggregation(
    multiStoreInventoryId: string,
    storeId: string,
    inventoryDelta: number
  ): Promise<void> {
    const { data: mapping, error: mappingError } = await this.supabase
      .from('store_inventory_mappings')
      .select('local_inventory')
      .eq('multi_store_inventory_id', multiStoreInventoryId)
      .eq('store_id', storeId)
      .single();

    if (mappingError) {
      throw new MultiStoreError(`Store mapping not found: ${mappingError.message}`, {
        code: 'STORE_MAPPING_NOT_FOUND',
        context: { multiStoreInventoryId, storeId, mappingError }
      });
    }

    const newLocalInventory = mapping.local_inventory + inventoryDelta;

    // Update store mapping
    const { error: updateMappingError } = await this.supabase
      .from('store_inventory_mappings')
      .update({
        local_inventory: newLocalInventory,
        sync_status: 'synced',
        last_sync_at: new Date().toISOString()
      })
      .eq('multi_store_inventory_id', multiStoreInventoryId)
      .eq('store_id', storeId);

    if (updateMappingError) {
      throw new MultiStoreError(`Failed to update store mapping: ${updateMappingError.message}`, {
        code: 'UPDATE_STORE_MAPPING_FAILED',
        context: { multiStoreInventoryId, storeId, updateMappingError }
      });
    }

    // Update master inventory
    const { error: updateInventoryError } = await this.supabase
      .from('multi_store_inventory')
      .update({
        total_inventory: this.supabase.raw(`total_inventory + ${inventoryDelta}`),
        available_inventory: this.supabase.raw(`available_inventory + ${inventoryDelta}`),
        last_sync_at: new Date().toISOString()
      })
      .eq('id', multiStoreInventoryId);

    if (updateInventoryError) {
      throw new MultiStoreError(`Failed to update master inventory: ${updateInventoryError.message}`, {
        code: 'UPDATE_MASTER_INVENTORY_FAILED',
        context: { multiStoreInventoryId, inventoryDelta, updateInventoryError }
      });
    }
  }

  // Customer Aggregation
  async aggregateCustomersAcrossStores(storeGroupId: string): Promise<UnifiedCustomer[]> {
    const { data, error } = await this.supabase
      .from('unified_customers')
      .select(`
        *,
        store_mappings:customer_store_mappings (
          *,
          store:stores (
            id,
            shop_name,
            shop_domain
          )
        )
      `)
      .eq('store_group_id', storeGroupId)
      .order('total_spent_across_stores', { ascending: false });

    if (error) {
      throw new MultiStoreError(`Failed to aggregate customers: ${error.message}`, {
        code: 'AGGREGATE_CUSTOMERS_FAILED',
        context: { storeGroupId, error }
      });
    }

    return data || [];
  }

  async createUnifiedCustomer(
    storeGroupId: string,
    email: string,
    customerData: UnifiedCustomer['customer_data'],
    storeMappings: Array<{
      store_id: string;
      shopify_customer_id: string;
      local_total_spent: number;
      local_orders_count: number;
    }>
  ): Promise<UnifiedCustomer> {
    const totalSpentAcrossStores = storeMappings.reduce((sum, mapping) => sum + mapping.local_total_spent, 0);
    const totalOrdersAcrossStores = storeMappings.reduce((sum, mapping) => sum + mapping.local_orders_count, 0);

    // Create unified customer
    const { data: customer, error: customerError } = await this.supabase
      .from('unified_customers')
      .insert({
        store_group_id: storeGroupId,
        email,
        customer_data: customerData,
        total_spent_across_stores: totalSpentAcrossStores,
        total_orders_across_stores: totalOrdersAcrossStores
      })
      .select()
      .single();

    if (customerError) {
      throw new MultiStoreError(`Failed to create unified customer: ${customerError.message}`, {
        code: 'CREATE_UNIFIED_CUSTOMER_FAILED',
        context: { storeGroupId, email, customerError }
      });
    }

    // Create store mappings
    const mappingInserts = storeMappings.map(mapping => ({
      unified_customer_id: customer.id,
      store_id: mapping.store_id,
      shopify_customer_id: mapping.shopify_customer_id,
      local_total_spent: mapping.local_total_spent,
      local_orders_count: mapping.local_orders_count,
      sync_status: 'synced',
      last_sync_at: new Date().toISOString()
    }));

    const { error: mappingError } = await this.supabase
      .from('customer_store_mappings')
      .insert(mappingInserts);

    if (mappingError) {
      // Rollback customer creation
      await this.supabase
        .from('unified_customers')
        .delete()
        .eq('id', customer.id);

      throw new MultiStoreError(`Failed to create customer store mappings: ${mappingError.message}`, {
        code: 'CREATE_CUSTOMER_MAPPINGS_FAILED',
        context: { customerId: customer.id, mappingError }
      });
    }

    return customer;
  }

  async findCustomerByEmail(storeGroupId: string, email: string): Promise<UnifiedCustomer | null> {
    const { data, error } = await this.supabase
      .from('unified_customers')
      .select(`
        *,
        store_mappings:customer_store_mappings (
          *,
          store:stores (
            id,
            shop_name,
            shop_domain
          )
        )
      `)
      .eq('store_group_id', storeGroupId)
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new MultiStoreError(`Failed to find customer: ${error.message}`, {
        code: 'FIND_CUSTOMER_FAILED',
        context: { storeGroupId, email, error }
      });
    }

    return data || null;
  }

  // Analytics Aggregation
  async generateMultiStoreAnalytics(
    storeGroupId: string,
    startDate: string,
    endDate: string
  ): Promise<MultiStoreAnalytics> {
    const [stores, products, customers, syncOps, conflicts] = await Promise.all([
      // Get stores in group
      this.supabase
        .from('stores')
        .select('id, sync_status')
        .eq('store_group_id', storeGroupId),
      
      // Get products count and inventory value
      this.supabase
        .from('multi_store_inventory')
        .select('total_inventory, product_data')
        .eq('store_group_id', storeGroupId),
      
      // Get customer counts
      this.supabase
        .from('unified_customers')
        .select('id, total_spent_across_stores')
        .eq('store_group_id', storeGroupId),
      
      // Get sync operations
      this.supabase
        .from('sync_operations')
        .select('status, started_at, completed_at')
        .eq('store_group_id', storeGroupId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),
      
      // Get conflicts
      this.supabase
        .from('conflict_resolutions')
        .select('status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    ]);

    const storeData = stores.data || [];
    const productData = products.data || [];
    const customerData = customers.data || [];
    const syncData = syncOps.data || [];
    const conflictData = conflicts.data || [];

    // Calculate inventory value (approximate)
    const totalInventoryValue = productData.reduce((sum, product) => {
      const avgPrice = product.product_data?.variants?.[0]?.price || 0;
      return sum + (product.total_inventory * avgPrice);
    }, 0);

    // Calculate sync performance
    const completedSyncs = syncData.filter(op => op.status === 'completed');
    const avgSyncTime = completedSyncs.length > 0 
      ? completedSyncs.reduce((sum, op) => {
          if (op.started_at && op.completed_at) {
            return sum + (new Date(op.completed_at).getTime() - new Date(op.started_at).getTime());
          }
          return sum;
        }, 0) / completedSyncs.length / 1000 / 60 // Convert to minutes
      : 0;

    const syncSuccessRate = syncData.length > 0 
      ? (completedSyncs.length / syncData.length) * 100 
      : 100;

    // Calculate data freshness (average time since last sync)
    const now = new Date().getTime();
    const dataFreshness = productData.length > 0
      ? productData.reduce((sum, product) => {
          const lastSync = new Date(product.last_sync_at || 0).getTime();
          return sum + (now - lastSync);
        }, 0) / productData.length / 1000 / 60 // Convert to minutes
      : 0;

    return {
      store_group_id: storeGroupId,
      period: {
        start: startDate,
        end: endDate
      },
      metrics: {
        total_stores: storeData.length,
        active_stores: storeData.filter(s => s.sync_status === 'active').length,
        total_products: productData.length,
        total_inventory_value: totalInventoryValue,
        total_customers: customerData.reduce((sum, customer) => {
          return sum + 1; // Count unique unified customers
        }, 0),
        unified_customers: customerData.length,
        sync_operations: {
          total: syncData.length,
          successful: syncData.filter(op => op.status === 'completed').length,
          failed: syncData.filter(op => op.status === 'failed').length,
          pending: syncData.filter(op => op.status === 'pending').length
        },
        conflicts: {
          total: conflictData.length,
          resolved: conflictData.filter(c => c.status === 'resolved').length,
          pending: conflictData.filter(c => c.status === 'pending').length
        },
        performance: {
          avg_sync_time: avgSyncTime,
          sync_success_rate: syncSuccessRate,
          data_freshness: dataFreshness
        }
      }
    };
  }

  // Data Discovery & Matching
  async findSimilarProducts(
    storeGroupId: string,
    productTitle: string,
    sku?: string,
    threshold = 0.8
  ): Promise<Array<{
    product: MultiStoreInventory;
    similarity: number;
    matchingFields: string[];
  }>> {
    const { data: products, error } = await this.supabase
      .from('multi_store_inventory')
      .select('*')
      .eq('store_group_id', storeGroupId);

    if (error) {
      throw new MultiStoreError(`Failed to search products: ${error.message}`, {
        code: 'SEARCH_PRODUCTS_FAILED',
        context: { storeGroupId, productTitle, error }
      });
    }

    const results: Array<{
      product: MultiStoreInventory;
      similarity: number;
      matchingFields: string[];
    }> = [];

    for (const product of products || []) {
      const matchingFields: string[] = [];
      let similarity = 0;

      // Title similarity (using simple string comparison)
      const titleSimilarity = this.calculateStringSimilarity(
        productTitle.toLowerCase(),
        product.product_data.title.toLowerCase()
      );
      if (titleSimilarity > threshold) {
        similarity += titleSimilarity * 0.6; // 60% weight for title
        matchingFields.push('title');
      }

      // SKU exact match
      if (sku && product.product_data.variants?.some(v => v.sku === sku)) {
        similarity += 0.4; // 40% weight for SKU
        matchingFields.push('sku');
      }

      // Handle similarity
      const handleSimilarity = this.calculateStringSimilarity(
        this.generateHandle(productTitle),
        product.product_data.handle
      );
      if (handleSimilarity > threshold) {
        similarity += handleSimilarity * 0.3; // 30% weight for handle
        matchingFields.push('handle');
      }

      if (similarity > threshold && matchingFields.length > 0) {
        results.push({
          product,
          similarity,
          matchingFields
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // Utility Methods
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  private generateHandle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-|-$/g, '');
  }
}