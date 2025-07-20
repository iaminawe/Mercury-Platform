// Synchronization Coordinator for Multi-Store Operations
import { createClient } from '@/lib/supabase/server';
import { shopifyClient } from '@/lib/shopify/client';
import { 
  SyncOperation, 
  EnhancedStore, 
  SyncConfig, 
  SyncProgress,
  MultiStoreError,
  StoreConnectionError 
} from './types';
import { DataAggregator } from './data-aggregator';
import { ConflictResolver } from './conflict-resolver';

export class SyncCoordinator {
  private supabase = createClient();
  private dataAggregator = new DataAggregator();
  private conflictResolver = new ConflictResolver();

  // Main Sync Operations
  async initiateSyncOperation(
    storeGroupId: string,
    operationType: SyncOperation['operation_type'],
    sourceStoreId?: string,
    targetStores?: string[],
    syncMode: SyncOperation['sync_mode'] = 'batch',
    payload?: Record<string, any>
  ): Promise<SyncOperation> {
    const operationId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine target stores if not provided
    if (!targetStores) {
      const { data: stores, error } = await this.supabase
        .from('stores')
        .select('id')
        .eq('store_group_id', storeGroupId)
        .eq('sync_enabled', true);

      if (error) {
        throw new MultiStoreError(`Failed to get target stores: ${error.message}`, {
          code: 'GET_TARGET_STORES_FAILED',
          context: { storeGroupId, error }
        });
      }

      targetStores = stores?.map(s => s.id).filter(id => id !== sourceStoreId) || [];
    }

    const { data: operation, error } = await this.supabase
      .from('sync_operations')
      .insert({
        operation_id: operationId,
        store_group_id: storeGroupId,
        source_store_id: sourceStoreId,
        target_stores: targetStores,
        operation_type: operationType,
        sync_mode: syncMode,
        status: 'pending',
        payload: payload || {}
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to create sync operation: ${error.message}`, {
        code: 'CREATE_SYNC_OPERATION_FAILED',
        context: { operationId, operationType, error }
      });
    }

    // Start sync operation asynchronously
    this.executeSyncOperation(operation.id).catch(error => {
      console.error('Sync operation failed:', error);
      this.updateSyncOperationStatus(operation.id, 'failed', undefined, {
        message: error.message,
        stack: error.stack
      });
    });

    return operation;
  }

  async executeSyncOperation(syncOperationId: string): Promise<void> {
    const { data: operation, error } = await this.supabase
      .from('sync_operations')
      .select('*')
      .eq('id', syncOperationId)
      .single();

    if (error || !operation) {
      throw new MultiStoreError(`Sync operation not found: ${error?.message}`, {
        code: 'SYNC_OPERATION_NOT_FOUND',
        context: { syncOperationId, error }
      });
    }

    // Update status to running
    await this.updateSyncOperationStatus(syncOperationId, 'running');

    try {
      switch (operation.operation_type) {
        case 'inventory_sync':
          await this.executeInventorySync(operation);
          break;
        case 'product_sync':
          await this.executeProductSync(operation);
          break;
        case 'customer_sync':
          await this.executeCustomerSync(operation);
          break;
        case 'full_sync':
          await this.executeFullSync(operation);
          break;
        default:
          throw new MultiStoreError(`Unknown operation type: ${operation.operation_type}`, {
            code: 'UNKNOWN_OPERATION_TYPE',
            context: { operation }
          });
      }

      await this.updateSyncOperationStatus(syncOperationId, 'completed');
    } catch (error) {
      await this.updateSyncOperationStatus(syncOperationId, 'failed', undefined, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  // Inventory Synchronization
  async executeInventorySync(operation: SyncOperation): Promise<void> {
    const sourceStore = operation.source_store_id ? await this.getStore(operation.source_store_id) : null;
    const targetStores = await this.getStores(operation.target_stores);

    if (!sourceStore && operation.sync_mode !== 'batch') {
      throw new MultiStoreError('Source store required for real-time inventory sync', {
        code: 'SOURCE_STORE_REQUIRED'
      });
    }

    let totalItems = 0;
    let processedItems = 0;

    try {
      if (sourceStore) {
        // Source-to-target sync
        const sourceClient = shopifyClient(sourceStore.shop_domain, sourceStore.access_token);
        const products = await this.fetchAllProducts(sourceClient);
        totalItems = products.length * targetStores.length;

        await this.updateSyncOperationProgress(operation.id, 0, totalItems);

        for (const product of products) {
          for (const targetStore of targetStores) {
            try {
              await this.syncProductInventory(sourceStore, targetStore, product);
              processedItems++;
              await this.updateSyncOperationProgress(operation.id, processedItems, totalItems);
            } catch (error) {
              console.error(`Failed to sync product ${product.id} to store ${targetStore.id}:`, error);
              await this.conflictResolver.createConflict(
                operation.id,
                'inventory_mismatch',
                sourceStore.id,
                targetStore.id,
                {
                  product_id: product.id.toString(),
                  source_value: product.variants?.[0]?.inventory_quantity || 0,
                  target_value: 'unknown',
                  field_name: 'inventory_quantity',
                  conflict_reason: error instanceof Error ? error.message : 'Unknown error'
                }
              );
            }
          }
        }
      } else {
        // Bidirectional sync across all stores
        const allStores = await this.getStores([operation.store_group_id!]);
        const combinations = this.generateStoreCombinations(allStores);
        totalItems = combinations.length;

        await this.updateSyncOperationProgress(operation.id, 0, totalItems);

        for (const [store1, store2] of combinations) {
          try {
            await this.bidirectionalInventorySync(store1, store2);
            processedItems++;
            await this.updateSyncOperationProgress(operation.id, processedItems, totalItems);
          } catch (error) {
            console.error(`Failed bidirectional sync between ${store1.id} and ${store2.id}:`, error);
          }
        }
      }
    } catch (error) {
      throw new MultiStoreError(`Inventory sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        code: 'INVENTORY_SYNC_FAILED',
        context: { operation, error }
      });
    }
  }

  async syncProductInventory(sourceStore: EnhancedStore, targetStore: EnhancedStore, product: any): Promise<void> {
    const targetClient = shopifyClient(targetStore.shop_domain, targetStore.access_token);

    // Find matching product in target store
    const matchingProduct = await this.findMatchingProduct(targetClient, product);

    if (!matchingProduct) {
      // Create product in target store
      await this.createProductInStore(targetClient, product);
    } else {
      // Update inventory in target store
      for (const variant of product.variants || []) {
        const matchingVariant = matchingProduct.variants.find((v: any) => 
          v.sku === variant.sku || v.title === variant.title
        );

        if (matchingVariant) {
          await targetClient.put(`/admin/api/2023-10/variants/${matchingVariant.id}.json`, {
            variant: {
              id: matchingVariant.id,
              inventory_quantity: variant.inventory_quantity
            }
          });
        }
      }
    }

    // Update aggregated inventory
    if (sourceStore.store_group_id) {
      await this.dataAggregator.updateInventoryAggregation(
        `${sourceStore.store_group_id}_${product.id}`,
        targetStore.id,
        product.variants?.[0]?.inventory_quantity || 0
      );
    }
  }

  // Product Synchronization
  async executeProductSync(operation: SyncOperation): Promise<void> {
    const sourceStore = operation.source_store_id ? await this.getStore(operation.source_store_id) : null;
    const targetStores = await this.getStores(operation.target_stores);

    if (!sourceStore) {
      throw new MultiStoreError('Source store required for product sync', {
        code: 'SOURCE_STORE_REQUIRED'
      });
    }

    const sourceClient = shopifyClient(sourceStore.shop_domain, sourceStore.access_token);
    const products = await this.fetchAllProducts(sourceClient);
    
    let totalItems = products.length * targetStores.length;
    let processedItems = 0;

    await this.updateSyncOperationProgress(operation.id, 0, totalItems);

    for (const product of products) {
      for (const targetStore of targetStores) {
        try {
          await this.syncProduct(sourceStore, targetStore, product);
          processedItems++;
          await this.updateSyncOperationProgress(operation.id, processedItems, totalItems);
        } catch (error) {
          console.error(`Failed to sync product ${product.id} to store ${targetStore.id}:`, error);
        }
      }
    }
  }

  async syncProduct(sourceStore: EnhancedStore, targetStore: EnhancedStore, product: any): Promise<void> {
    const targetClient = shopifyClient(targetStore.shop_domain, targetStore.access_token);
    const existingProduct = await this.findMatchingProduct(targetClient, product);

    if (existingProduct) {
      // Update existing product
      await targetClient.put(`/admin/api/2023-10/products/${existingProduct.id}.json`, {
        product: {
          id: existingProduct.id,
          title: product.title,
          body_html: product.body_html,
          vendor: product.vendor,
          product_type: product.product_type,
          tags: product.tags
        }
      });

      // Update variants
      for (const variant of product.variants || []) {
        const matchingVariant = existingProduct.variants.find((v: any) => 
          v.sku === variant.sku
        );

        if (matchingVariant) {
          await targetClient.put(`/admin/api/2023-10/variants/${matchingVariant.id}.json`, {
            variant: {
              id: matchingVariant.id,
              price: variant.price,
              compare_at_price: variant.compare_at_price,
              inventory_quantity: variant.inventory_quantity
            }
          });
        }
      }
    } else {
      // Create new product
      await this.createProductInStore(targetClient, product);
    }
  }

  // Customer Synchronization
  async executeCustomerSync(operation: SyncOperation): Promise<void> {
    const sourceStore = operation.source_store_id ? await this.getStore(operation.source_store_id) : null;
    const targetStores = await this.getStores(operation.target_stores);

    if (!sourceStore) {
      throw new MultiStoreError('Source store required for customer sync', {
        code: 'SOURCE_STORE_REQUIRED'
      });
    }

    const sourceClient = shopifyClient(sourceStore.shop_domain, sourceStore.access_token);
    const customers = await this.fetchAllCustomers(sourceClient);
    
    let totalItems = customers.length;
    let processedItems = 0;

    await this.updateSyncOperationProgress(operation.id, 0, totalItems);

    for (const customer of customers) {
      try {
        await this.syncCustomer(sourceStore, targetStores, customer);
        processedItems++;
        await this.updateSyncOperationProgress(operation.id, processedItems, totalItems);
      } catch (error) {
        console.error(`Failed to sync customer ${customer.id}:`, error);
      }
    }
  }

  async syncCustomer(sourceStore: EnhancedStore, targetStores: EnhancedStore[], customer: any): Promise<void> {
    if (!sourceStore.store_group_id) return;

    // Create or update unified customer
    const existingUnifiedCustomer = await this.dataAggregator.findCustomerByEmail(
      sourceStore.store_group_id,
      customer.email
    );

    if (!existingUnifiedCustomer) {
      const storeMappings = [{
        store_id: sourceStore.id,
        shopify_customer_id: customer.id.toString(),
        local_total_spent: parseFloat(customer.total_spent || '0'),
        local_orders_count: customer.orders_count || 0
      }];

      await this.dataAggregator.createUnifiedCustomer(
        sourceStore.store_group_id,
        customer.email,
        {
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          accepts_marketing: customer.accepts_marketing,
          addresses: customer.addresses || []
        },
        storeMappings
      );
    }
  }

  // Full Sync
  async executeFullSync(operation: SyncOperation): Promise<void> {
    const steps = ['inventory_sync', 'product_sync', 'customer_sync'] as const;
    
    for (let i = 0; i < steps.length; i++) {
      const stepOperation: SyncOperation = {
        ...operation,
        operation_type: steps[i]
      };

      await this.updateSyncOperationProgress(operation.id, i * 33, 100, `Executing ${steps[i]}`);

      switch (steps[i]) {
        case 'inventory_sync':
          await this.executeInventorySync(stepOperation);
          break;
        case 'product_sync':
          await this.executeProductSync(stepOperation);
          break;
        case 'customer_sync':
          await this.executeCustomerSync(stepOperation);
          break;
      }
    }

    await this.updateSyncOperationProgress(operation.id, 100, 100, 'Completed full sync');
  }

  // Utility Methods
  private async getStore(storeId: string): Promise<EnhancedStore> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error || !data) {
      throw new StoreConnectionError('Store not found', storeId);
    }

    return data;
  }

  private async getStores(storeIds: string[]): Promise<EnhancedStore[]> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .in('id', storeIds);

    if (error) {
      throw new MultiStoreError(`Failed to fetch stores: ${error.message}`, {
        code: 'FETCH_STORES_FAILED',
        context: { storeIds, error }
      });
    }

    return data || [];
  }

  private async fetchAllProducts(client: any): Promise<any[]> {
    const products: any[] = [];
    let nextPageInfo = null;

    do {
      const response = await client.get('/admin/api/2023-10/products.json', {
        limit: 250,
        page_info: nextPageInfo
      });

      if (response.data?.products) {
        products.push(...response.data.products);
      }

      nextPageInfo = this.extractNextPageInfo(response.headers?.link);
    } while (nextPageInfo);

    return products;
  }

  private async fetchAllCustomers(client: any): Promise<any[]> {
    const customers: any[] = [];
    let nextPageInfo = null;

    do {
      const response = await client.get('/admin/api/2023-10/customers.json', {
        limit: 250,
        page_info: nextPageInfo
      });

      if (response.data?.customers) {
        customers.push(...response.data.customers);
      }

      nextPageInfo = this.extractNextPageInfo(response.headers?.link);
    } while (nextPageInfo);

    return customers;
  }

  private async findMatchingProduct(client: any, product: any): Promise<any | null> {
    try {
      const response = await client.get('/admin/api/2023-10/products.json', {
        title: product.title,
        limit: 1
      });

      return response.data?.products?.[0] || null;
    } catch (error) {
      return null;
    }
  }

  private async createProductInStore(client: any, product: any): Promise<any> {
    const response = await client.post('/admin/api/2023-10/products.json', {
      product: {
        title: product.title,
        body_html: product.body_html,
        vendor: product.vendor,
        product_type: product.product_type,
        tags: product.tags,
        variants: product.variants?.map((variant: any) => ({
          title: variant.title,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          sku: variant.sku,
          inventory_quantity: variant.inventory_quantity,
          weight: variant.weight,
          weight_unit: variant.weight_unit
        }))
      }
    });

    return response.data?.product;
  }

  private async bidirectionalInventorySync(store1: EnhancedStore, store2: EnhancedStore): Promise<void> {
    // Implementation for bidirectional sync between two stores
    const client1 = shopifyClient(store1.shop_domain, store1.access_token);
    const client2 = shopifyClient(store2.shop_domain, store2.access_token);

    const [products1, products2] = await Promise.all([
      this.fetchAllProducts(client1),
      this.fetchAllProducts(client2)
    ]);

    // Find common products and sync inventory
    for (const product1 of products1) {
      const matchingProduct2 = products2.find(p2 => 
        p2.title === product1.title || 
        p2.variants?.some((v2: any) => 
          product1.variants?.some((v1: any) => v1.sku === v2.sku)
        )
      );

      if (matchingProduct2) {
        // Sync inventory between matching products
        await this.syncInventoryBetweenProducts(client1, client2, product1, matchingProduct2);
      }
    }
  }

  private async syncInventoryBetweenProducts(
    client1: any, 
    client2: any, 
    product1: any, 
    product2: any
  ): Promise<void> {
    // Simple strategy: average the inventory between both stores
    for (const variant1 of product1.variants || []) {
      const matchingVariant2 = product2.variants?.find((v2: any) => v2.sku === variant1.sku);
      
      if (matchingVariant2) {
        const avgInventory = Math.floor((variant1.inventory_quantity + matchingVariant2.inventory_quantity) / 2);
        
        await Promise.all([
          client1.put(`/admin/api/2023-10/variants/${variant1.id}.json`, {
            variant: { id: variant1.id, inventory_quantity: avgInventory }
          }),
          client2.put(`/admin/api/2023-10/variants/${matchingVariant2.id}.json`, {
            variant: { id: matchingVariant2.id, inventory_quantity: avgInventory }
          })
        ]);
      }
    }
  }

  private generateStoreCombinations(stores: EnhancedStore[]): [EnhancedStore, EnhancedStore][] {
    const combinations: [EnhancedStore, EnhancedStore][] = [];
    
    for (let i = 0; i < stores.length; i++) {
      for (let j = i + 1; j < stores.length; j++) {
        combinations.push([stores[i], stores[j]]);
      }
    }
    
    return combinations;
  }

  private extractNextPageInfo(linkHeader?: string): string | null {
    if (!linkHeader) return null;
    
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (nextMatch) {
      const url = new URL(nextMatch[1]);
      return url.searchParams.get('page_info');
    }
    
    return null;
  }

  private async updateSyncOperationStatus(
    operationId: string,
    status: SyncOperation['status'],
    progress?: number,
    errorDetails?: any
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (progress !== undefined) {
      updates.progress = progress;
    }

    if (status === 'running' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    if (errorDetails) {
      updates.error_details = errorDetails;
    }

    await this.supabase
      .from('sync_operations')
      .update(updates)
      .eq('id', operationId);
  }

  private async updateSyncOperationProgress(
    operationId: string,
    processedItems: number,
    totalItems: number,
    currentStep?: string
  ): Promise<void> {
    const progress = totalItems > 0 ? Math.floor((processedItems / totalItems) * 100) : 0;
    
    await this.supabase
      .from('sync_operations')
      .update({
        progress,
        processed_items: processedItems,
        total_items: totalItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', operationId);
  }

  // Public API Methods
  async getSyncOperationStatus(operationId: string): Promise<SyncProgress> {
    const { data: operation, error } = await this.supabase
      .from('sync_operations')
      .select('*')
      .eq('operation_id', operationId)
      .single();

    if (error || !operation) {
      throw new MultiStoreError(`Sync operation not found: ${error?.message}`, {
        code: 'SYNC_OPERATION_NOT_FOUND',
        context: { operationId, error }
      });
    }

    return {
      operation_id: operationId,
      status: operation.status,
      progress_percentage: operation.progress,
      current_step: operation.operation_type,
      total_steps: 1, // Will be enhanced based on operation type
      completed_steps: operation.status === 'completed' ? 1 : 0,
      estimated_completion: this.estimateCompletion(operation),
      last_update: operation.updated_at
    };
  }

  private estimateCompletion(operation: SyncOperation): string | undefined {
    if (operation.status === 'completed' || operation.status === 'failed') {
      return undefined;
    }

    if (operation.started_at && operation.progress > 0) {
      const elapsed = Date.now() - new Date(operation.started_at).getTime();
      const estimated = (elapsed / operation.progress) * (100 - operation.progress);
      return new Date(Date.now() + estimated).toISOString();
    }

    return undefined;
  }
}