// Conflict Resolution System for Multi-Store Synchronization
import { createClient } from '@/lib/supabase/server';
import { shopifyClient } from '@/lib/shopify/client';
import { 
  ConflictResolution, 
  EnhancedStore, 
  MultiStoreError,
  SyncConflictError 
} from './types';

export class ConflictResolver {
  private supabase = createClient();

  // Create and Log Conflicts
  async createConflict(
    syncOperationId: string,
    conflictType: ConflictResolution['conflict_type'],
    sourceStoreId: string,
    targetStoreId: string,
    conflictData: ConflictResolution['conflict_data']
  ): Promise<ConflictResolution> {
    const { data: conflict, error } = await this.supabase
      .from('conflict_resolutions')
      .insert({
        sync_operation_id: syncOperationId,
        conflict_type: conflictType,
        source_store_id: sourceStoreId,
        target_store_id: targetStoreId,
        conflict_data: conflictData,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to create conflict: ${error.message}`, {
        code: 'CREATE_CONFLICT_FAILED',
        context: { syncOperationId, conflictType, sourceStoreId, targetStoreId, error }
      });
    }

    return conflict;
  }

  async getConflicts(
    storeGroupId?: string,
    status?: ConflictResolution['status'],
    conflictType?: ConflictResolution['conflict_type']
  ): Promise<ConflictResolution[]> {
    let query = this.supabase
      .from('conflict_resolutions')
      .select(`
        *,
        sync_operation:sync_operations (
          operation_id,
          operation_type,
          store_group_id
        ),
        source_store:stores!source_store_id (
          id,
          shop_name,
          shop_domain
        ),
        target_store:stores!target_store_id (
          id,
          shop_name,
          shop_domain
        )
      `);

    if (status) {
      query = query.eq('status', status);
    }

    if (conflictType) {
      query = query.eq('conflict_type', conflictType);
    }

    if (storeGroupId) {
      query = query.eq('sync_operation.store_group_id', storeGroupId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new MultiStoreError(`Failed to fetch conflicts: ${error.message}`, {
        code: 'FETCH_CONFLICTS_FAILED',
        context: { storeGroupId, status, conflictType, error }
      });
    }

    return data || [];
  }

  // Automatic Conflict Resolution
  async resolveConflict(
    conflictId: string,
    resolutionStrategy: ConflictResolution['resolution_strategy'],
    resolvedBy: string,
    customResolutionData?: Record<string, any>
  ): Promise<ConflictResolution> {
    const { data: conflict, error: fetchError } = await this.supabase
      .from('conflict_resolutions')
      .select(`
        *,
        source_store:stores!source_store_id (
          id,
          shop_domain,
          access_token,
          is_master
        ),
        target_store:stores!target_store_id (
          id,
          shop_domain,
          access_token,
          is_master
        )
      `)
      .eq('id', conflictId)
      .single();

    if (fetchError || !conflict) {
      throw new MultiStoreError(`Conflict not found: ${fetchError?.message}`, {
        code: 'CONFLICT_NOT_FOUND',
        context: { conflictId, fetchError }
      });
    }

    if (conflict.status !== 'pending') {
      throw new MultiStoreError(`Conflict already resolved with status: ${conflict.status}`, {
        code: 'CONFLICT_ALREADY_RESOLVED',
        context: { conflictId, currentStatus: conflict.status }
      });
    }

    let resolutionData: Record<string, any> = {};

    try {
      switch (resolutionStrategy) {
        case 'auto_master_wins':
          resolutionData = await this.resolveMasterWins(conflict);
          break;
        case 'auto_latest_wins':
          resolutionData = await this.resolveLatestWins(conflict);
          break;
        case 'auto_merge':
          resolutionData = await this.resolveMerge(conflict);
          break;
        case 'manual':
          resolutionData = customResolutionData || {};
          await this.applyManualResolution(conflict, resolutionData);
          break;
        default:
          throw new MultiStoreError(`Unknown resolution strategy: ${resolutionStrategy}`, {
            code: 'UNKNOWN_RESOLUTION_STRATEGY',
            context: { resolutionStrategy }
          });
      }

      // Update conflict status
      const { data: updatedConflict, error: updateError } = await this.supabase
        .from('conflict_resolutions')
        .update({
          status: 'resolved',
          resolution_strategy: resolutionStrategy,
          resolution_data: resolutionData,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conflictId)
        .select()
        .single();

      if (updateError) {
        throw new MultiStoreError(`Failed to update conflict status: ${updateError.message}`, {
          code: 'UPDATE_CONFLICT_FAILED',
          context: { conflictId, updateError }
        });
      }

      return updatedConflict;
    } catch (error) {
      throw new SyncConflictError(
        `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conflict.target_store_id,
        conflict.sync_operation_id,
        conflict.conflict_data,
        { conflictId, resolutionStrategy, error }
      );
    }
  }

  // Resolution Strategies
  private async resolveMasterWins(conflict: any): Promise<Record<string, any>> {
    const masterStore = conflict.source_store.is_master ? conflict.source_store : conflict.target_store;
    const slaveStore = conflict.source_store.is_master ? conflict.target_store : conflict.source_store;

    const masterValue = conflict.source_store.is_master 
      ? conflict.conflict_data.source_value 
      : conflict.conflict_data.target_value;

    await this.applyResolutionToStore(slaveStore, conflict, masterValue);

    return {
      strategy: 'master_wins',
      winning_value: masterValue,
      master_store_id: masterStore.id,
      slave_store_id: slaveStore.id,
      applied_at: new Date().toISOString()
    };
  }

  private async resolveLatestWins(conflict: any): Promise<Record<string, any>> {
    // For this implementation, we'll assume source is more recent
    // In a real implementation, you'd check timestamps from the actual data
    const winningValue = conflict.conflict_data.source_value;
    const losingStore = conflict.target_store;

    await this.applyResolutionToStore(losingStore, conflict, winningValue);

    return {
      strategy: 'latest_wins',
      winning_value: winningValue,
      winning_store_id: conflict.source_store_id,
      losing_store_id: conflict.target_store_id,
      applied_at: new Date().toISOString()
    };
  }

  private async resolveMerge(conflict: any): Promise<Record<string, any>> {
    let mergedValue: any;

    switch (conflict.conflict_type) {
      case 'inventory_mismatch':
        // For inventory, take the average
        const sourceInventory = parseInt(conflict.conflict_data.source_value) || 0;
        const targetInventory = parseInt(conflict.conflict_data.target_value) || 0;
        mergedValue = Math.floor((sourceInventory + targetInventory) / 2);
        break;

      case 'price_conflict':
        // For prices, take the higher value (assuming it's more recent)
        const sourcePrice = parseFloat(conflict.conflict_data.source_value) || 0;
        const targetPrice = parseFloat(conflict.conflict_data.target_value) || 0;
        mergedValue = Math.max(sourcePrice, targetPrice);
        break;

      case 'data_conflict':
        // For general data conflicts, prefer non-empty values
        mergedValue = conflict.conflict_data.source_value || conflict.conflict_data.target_value;
        break;

      default:
        mergedValue = conflict.conflict_data.source_value;
    }

    // Apply merged value to both stores
    await Promise.all([
      this.applyResolutionToStore(conflict.source_store, conflict, mergedValue),
      this.applyResolutionToStore(conflict.target_store, conflict, mergedValue)
    ]);

    return {
      strategy: 'merge',
      merged_value: mergedValue,
      source_value: conflict.conflict_data.source_value,
      target_value: conflict.conflict_data.target_value,
      applied_to_both_stores: true,
      applied_at: new Date().toISOString()
    };
  }

  private async applyManualResolution(conflict: any, resolutionData: Record<string, any>): Promise<void> {
    if (!resolutionData.resolution_value) {
      throw new MultiStoreError('Manual resolution requires resolution_value', {
        code: 'MANUAL_RESOLUTION_VALUE_REQUIRED'
      });
    }

    const targetStore = resolutionData.apply_to_store === 'source' ? conflict.source_store : conflict.target_store;
    await this.applyResolutionToStore(targetStore, conflict, resolutionData.resolution_value);
  }

  // Apply Resolution to Shopify Store
  private async applyResolutionToStore(
    store: any,
    conflict: any,
    resolutionValue: any
  ): Promise<void> {
    const client = shopifyClient(store.shop_domain, store.access_token);

    try {
      switch (conflict.conflict_type) {
        case 'inventory_mismatch':
          await this.updateInventoryInStore(client, conflict, resolutionValue);
          break;
        case 'price_conflict':
          await this.updatePriceInStore(client, conflict, resolutionValue);
          break;
        case 'data_conflict':
          await this.updateDataInStore(client, conflict, resolutionValue);
          break;
        case 'duplicate_product':
          await this.resolveDuplicateProduct(client, conflict, resolutionValue);
          break;
        default:
          throw new MultiStoreError(`Cannot apply resolution for conflict type: ${conflict.conflict_type}`, {
            code: 'UNSUPPORTED_CONFLICT_TYPE'
          });
      }
    } catch (error) {
      throw new MultiStoreError(`Failed to apply resolution to store: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        code: 'APPLY_RESOLUTION_FAILED',
        context: { storeId: store.id, conflictType: conflict.conflict_type, error }
      });
    }
  }

  private async updateInventoryInStore(client: any, conflict: any, inventory: number): Promise<void> {
    const variantId = conflict.conflict_data.variant_id;
    
    if (variantId) {
      await client.put(`/admin/api/2023-10/variants/${variantId}.json`, {
        variant: {
          id: variantId,
          inventory_quantity: inventory
        }
      });
    } else {
      // If no variant ID, update all variants of the product
      const productId = conflict.conflict_data.product_id;
      const product = await client.get(`/admin/api/2023-10/products/${productId}.json`);
      
      if (product.data?.product?.variants) {
        for (const variant of product.data.product.variants) {
          await client.put(`/admin/api/2023-10/variants/${variant.id}.json`, {
            variant: {
              id: variant.id,
              inventory_quantity: inventory
            }
          });
        }
      }
    }
  }

  private async updatePriceInStore(client: any, conflict: any, price: number): Promise<void> {
    const variantId = conflict.conflict_data.variant_id;
    
    if (variantId) {
      await client.put(`/admin/api/2023-10/variants/${variantId}.json`, {
        variant: {
          id: variantId,
          price: price.toString()
        }
      });
    }
  }

  private async updateDataInStore(client: any, conflict: any, value: any): Promise<void> {
    const productId = conflict.conflict_data.product_id;
    const fieldName = conflict.conflict_data.field_name;
    
    const updateData: any = {};
    updateData[fieldName] = value;

    await client.put(`/admin/api/2023-10/products/${productId}.json`, {
      product: {
        id: productId,
        ...updateData
      }
    });
  }

  private async resolveDuplicateProduct(client: any, conflict: any, action: 'merge' | 'delete_duplicate' | 'keep_both'): Promise<void> {
    const primaryProductId = conflict.conflict_data.primary_product_id;
    const duplicateProductId = conflict.conflict_data.duplicate_product_id;

    switch (action) {
      case 'delete_duplicate':
        await client.delete(`/admin/api/2023-10/products/${duplicateProductId}.json`);
        break;
      
      case 'merge':
        // Get both products
        const [primaryProduct, duplicateProduct] = await Promise.all([
          client.get(`/admin/api/2023-10/products/${primaryProductId}.json`),
          client.get(`/admin/api/2023-10/products/${duplicateProductId}.json`)
        ]);

        // Merge variants from duplicate into primary
        if (duplicateProduct.data?.product?.variants) {
          for (const variant of duplicateProduct.data.product.variants) {
            await client.post(`/admin/api/2023-10/products/${primaryProductId}/variants.json`, {
              variant: {
                title: variant.title,
                price: variant.price,
                sku: variant.sku,
                inventory_quantity: variant.inventory_quantity
              }
            });
          }
        }

        // Delete duplicate product
        await client.delete(`/admin/api/2023-10/products/${duplicateProductId}.json`);
        break;
      
      case 'keep_both':
        // Just mark as resolved without action
        break;
    }
  }

  // Batch Conflict Resolution
  async resolveBatchConflicts(
    conflictIds: string[],
    resolutionStrategy: ConflictResolution['resolution_strategy'],
    resolvedBy: string
  ): Promise<ConflictResolution[]> {
    const results: ConflictResolution[] = [];
    const errors: Array<{ conflictId: string; error: string }> = [];

    for (const conflictId of conflictIds) {
      try {
        const resolved = await this.resolveConflict(conflictId, resolutionStrategy, resolvedBy);
        results.push(resolved);
      } catch (error) {
        errors.push({
          conflictId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (errors.length > 0) {
      console.warn('Some conflicts failed to resolve:', errors);
    }

    return results;
  }

  // Conflict Prevention
  async detectPotentialConflicts(
    storeGroupId: string,
    operationType: 'inventory' | 'price' | 'product_data'
  ): Promise<Array<{
    product_id: string;
    conflict_type: string;
    stores_affected: string[];
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>> {
    const potentialConflicts: Array<{
      product_id: string;
      conflict_type: string;
      stores_affected: string[];
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    // Get all stores in the group
    const { data: stores, error } = await this.supabase
      .from('stores')
      .select('id, shop_domain, access_token')
      .eq('store_group_id', storeGroupId)
      .eq('sync_enabled', true);

    if (error || !stores || stores.length < 2) {
      return potentialConflicts;
    }

    // Compare data across stores to detect potential conflicts
    for (let i = 0; i < stores.length; i++) {
      for (let j = i + 1; j < stores.length; j++) {
        const conflicts = await this.compareStoreData(stores[i], stores[j], operationType);
        potentialConflicts.push(...conflicts);
      }
    }

    return potentialConflicts;
  }

  private async compareStoreData(
    store1: any,
    store2: any,
    operationType: 'inventory' | 'price' | 'product_data'
  ): Promise<Array<{
    product_id: string;
    conflict_type: string;
    stores_affected: string[];
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>> {
    const conflicts: Array<{
      product_id: string;
      conflict_type: string;
      stores_affected: string[];
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    try {
      const [client1, client2] = [
        shopifyClient(store1.shop_domain, store1.access_token),
        shopifyClient(store2.shop_domain, store2.access_token)
      ];

      const [products1, products2] = await Promise.all([
        this.fetchStoreProducts(client1),
        this.fetchStoreProducts(client2)
      ]);

      // Find matching products and compare data
      for (const product1 of products1) {
        const matchingProduct2 = products2.find(p2 => 
          p2.title === product1.title || 
          p2.handle === product1.handle ||
          p2.variants?.some((v2: any) => 
            product1.variants?.some((v1: any) => v1.sku === v2.sku && v1.sku)
          )
        );

        if (matchingProduct2) {
          const productConflicts = this.analyzeProductConflicts(
            product1, 
            matchingProduct2, 
            store1.id, 
            store2.id, 
            operationType
          );
          conflicts.push(...productConflicts);
        }
      }
    } catch (error) {
      console.error('Error comparing store data:', error);
    }

    return conflicts;
  }

  private analyzeProductConflicts(
    product1: any,
    product2: any,
    store1Id: string,
    store2Id: string,
    operationType: 'inventory' | 'price' | 'product_data'
  ): Array<{
    product_id: string;
    conflict_type: string;
    stores_affected: string[];
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> {
    const conflicts: Array<{
      product_id: string;
      conflict_type: string;
      stores_affected: string[];
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    switch (operationType) {
      case 'inventory':
        for (const variant1 of product1.variants || []) {
          const matchingVariant2 = product2.variants?.find((v2: any) => 
            v2.sku === variant1.sku || v2.title === variant1.title
          );

          if (matchingVariant2) {
            const inventoryDiff = Math.abs(variant1.inventory_quantity - matchingVariant2.inventory_quantity);
            if (inventoryDiff > 10) { // Threshold for significant difference
              conflicts.push({
                product_id: product1.id.toString(),
                conflict_type: 'inventory_mismatch',
                stores_affected: [store1Id, store2Id],
                severity: inventoryDiff > 50 ? 'high' : inventoryDiff > 25 ? 'medium' : 'low',
                description: `Inventory mismatch: ${variant1.inventory_quantity} vs ${matchingVariant2.inventory_quantity}`
              });
            }
          }
        }
        break;

      case 'price':
        for (const variant1 of product1.variants || []) {
          const matchingVariant2 = product2.variants?.find((v2: any) => 
            v2.sku === variant1.sku || v2.title === variant1.title
          );

          if (matchingVariant2) {
            const price1 = parseFloat(variant1.price) || 0;
            const price2 = parseFloat(matchingVariant2.price) || 0;
            const priceDiffPercent = Math.abs(price1 - price2) / Math.max(price1, price2) * 100;

            if (priceDiffPercent > 5) { // 5% threshold
              conflicts.push({
                product_id: product1.id.toString(),
                conflict_type: 'price_conflict',
                stores_affected: [store1Id, store2Id],
                severity: priceDiffPercent > 20 ? 'high' : priceDiffPercent > 10 ? 'medium' : 'low',
                description: `Price difference: $${price1} vs $${price2} (${priceDiffPercent.toFixed(1)}%)`
              });
            }
          }
        }
        break;

      case 'product_data':
        if (product1.title !== product2.title) {
          conflicts.push({
            product_id: product1.id.toString(),
            conflict_type: 'data_conflict',
            stores_affected: [store1Id, store2Id],
            severity: 'medium',
            description: `Title mismatch: "${product1.title}" vs "${product2.title}"`
          });
        }

        if (product1.vendor !== product2.vendor) {
          conflicts.push({
            product_id: product1.id.toString(),
            conflict_type: 'data_conflict',
            stores_affected: [store1Id, store2Id],
            severity: 'low',
            description: `Vendor mismatch: "${product1.vendor}" vs "${product2.vendor}"`
          });
        }
        break;
    }

    return conflicts;
  }

  private async fetchStoreProducts(client: any): Promise<any[]> {
    try {
      const response = await client.get('/admin/api/2023-10/products.json', {
        limit: 250,
        fields: 'id,title,handle,vendor,variants'
      });
      return response.data?.products || [];
    } catch (error) {
      console.error('Error fetching store products:', error);
      return [];
    }
  }

  // Utility Methods
  async getConflictStatistics(storeGroupId: string): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    resolution_rate: number;
    avg_resolution_time: number; // in hours
  }> {
    const { data: conflicts, error } = await this.supabase
      .from('conflict_resolutions')
      .select(`
        status,
        conflict_type,
        created_at,
        resolved_at,
        sync_operation:sync_operations!inner (
          store_group_id
        )
      `)
      .eq('sync_operation.store_group_id', storeGroupId);

    if (error) {
      throw new MultiStoreError(`Failed to get conflict statistics: ${error.message}`, {
        code: 'GET_CONFLICT_STATS_FAILED',
        context: { storeGroupId, error }
      });
    }

    const total = conflicts?.length || 0;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const conflict of conflicts || []) {
      byStatus[conflict.status] = (byStatus[conflict.status] || 0) + 1;
      byType[conflict.conflict_type] = (byType[conflict.conflict_type] || 0) + 1;

      if (conflict.status === 'resolved' && conflict.resolved_at) {
        const resolutionTime = new Date(conflict.resolved_at).getTime() - new Date(conflict.created_at).getTime();
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    }

    const resolutionRate = total > 0 ? (resolvedCount / total) * 100 : 100;
    const avgResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) : 0; // hours

    return {
      total,
      by_status: byStatus,
      by_type: byType,
      resolution_rate: resolutionRate,
      avg_resolution_time: avgResolutionTime
    };
  }
}