// Central Store Management System
import { createClient } from '@/lib/supabase/server';
import { 
  StoreGroup, 
  EnhancedStore, 
  StoreRelationship, 
  StoreAccessControl,
  MultiStoreError,
  StoreConnectionError 
} from './types';
import { shopifyClient } from '@/lib/shopify/client';

export class StoreManager {
  private supabase = createClient();

  // Store Group Management
  async createStoreGroup(
    ownerId: string, 
    name: string, 
    description?: string,
    settings?: Partial<StoreGroup['settings']>
  ): Promise<StoreGroup> {
    const defaultSettings: StoreGroup['settings'] = {
      max_stores: 10,
      default_sync_mode: 'batch',
      conflict_resolution_strategy: 'manual',
      inventory_sync_enabled: true,
      customer_sync_enabled: true,
      product_sync_enabled: true,
      ...settings
    };

    const { data, error } = await this.supabase
      .from('store_groups')
      .insert({
        owner_id: ownerId,
        name,
        description,
        settings: defaultSettings,
        max_stores: defaultSettings.max_stores
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to create store group: ${error.message}`, {
        code: 'CREATE_STORE_GROUP_FAILED',
        context: { ownerId, name, error }
      });
    }

    return data;
  }

  async getStoreGroups(ownerId: string): Promise<StoreGroup[]> {
    const { data, error } = await this.supabase
      .from('store_groups')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new MultiStoreError(`Failed to fetch store groups: ${error.message}`, {
        code: 'FETCH_STORE_GROUPS_FAILED',
        context: { ownerId, error }
      });
    }

    return data || [];
  }

  async updateStoreGroup(groupId: string, updates: Partial<StoreGroup>): Promise<StoreGroup> {
    const { data, error } = await this.supabase
      .from('store_groups')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to update store group: ${error.message}`, {
        code: 'UPDATE_STORE_GROUP_FAILED',
        context: { groupId, updates, error }
      });
    }

    return data;
  }

  // Store Management
  async addStoreToGroup(storeId: string, groupId: string, isMaster = false): Promise<EnhancedStore> {
    // Check if group has capacity
    const { data: groupStores, error: countError } = await this.supabase
      .from('stores')
      .select('id')
      .eq('store_group_id', groupId);

    if (countError) {
      throw new MultiStoreError(`Failed to check group capacity: ${countError.message}`, {
        code: 'GROUP_CAPACITY_CHECK_FAILED',
        context: { storeId, groupId, countError }
      });
    }

    const { data: group, error: groupError } = await this.supabase
      .from('store_groups')
      .select('max_stores')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      throw new MultiStoreError(`Store group not found: ${groupError?.message}`, {
        code: 'STORE_GROUP_NOT_FOUND',
        context: { groupId, groupError }
      });
    }

    if (groupStores && groupStores.length >= group.max_stores) {
      throw new MultiStoreError(`Store group has reached maximum capacity of ${group.max_stores} stores`, {
        code: 'GROUP_CAPACITY_EXCEEDED',
        context: { groupId, currentStores: groupStores.length, maxStores: group.max_stores }
      });
    }

    // If setting as master, remove master status from other stores
    if (isMaster) {
      await this.supabase
        .from('stores')
        .update({ is_master: false })
        .eq('store_group_id', groupId);
    }

    const { data, error } = await this.supabase
      .from('stores')
      .update({
        store_group_id: groupId,
        is_master: isMaster,
        sync_enabled: true,
        sync_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to add store to group: ${error.message}`, {
        code: 'ADD_STORE_TO_GROUP_FAILED',
        context: { storeId, groupId, isMaster, error }
      });
    }

    return data;
  }

  async removeStoreFromGroup(storeId: string): Promise<EnhancedStore> {
    const { data, error } = await this.supabase
      .from('stores')
      .update({
        store_group_id: null,
        is_master: false,
        sync_enabled: false,
        sync_status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to remove store from group: ${error.message}`, {
        code: 'REMOVE_STORE_FROM_GROUP_FAILED',
        context: { storeId, error }
      });
    }

    // Clean up relationships
    await this.supabase
      .from('store_relationships')
      .delete()
      .or(`source_store_id.eq.${storeId},target_store_id.eq.${storeId}`);

    return data;
  }

  async getGroupStores(groupId: string): Promise<EnhancedStore[]> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('store_group_id', groupId)
      .order('is_master', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new MultiStoreError(`Failed to fetch group stores: ${error.message}`, {
        code: 'FETCH_GROUP_STORES_FAILED',
        context: { groupId, error }
      });
    }

    return data || [];
  }

  async getMasterStore(groupId: string): Promise<EnhancedStore | null> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('store_group_id', groupId)
      .eq('is_master', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new MultiStoreError(`Failed to fetch master store: ${error.message}`, {
        code: 'FETCH_MASTER_STORE_FAILED',
        context: { groupId, error }
      });
    }

    return data || null;
  }

  // Store Relationships
  async createStoreRelationship(
    sourceStoreId: string,
    targetStoreId: string,
    relationshipType: StoreRelationship['relationship_type'],
    syncDirection: StoreRelationship['sync_direction'] = 'bidirectional',
    syncConfig?: Partial<StoreRelationship['sync_config']>
  ): Promise<StoreRelationship> {
    const defaultSyncConfig: StoreRelationship['sync_config'] = {
      sync_inventory: true,
      sync_products: true,
      sync_customers: true,
      sync_orders: false,
      batch_size: 100,
      sync_frequency: '0 */6 * * *', // Every 6 hours
      ...syncConfig
    };

    const { data, error } = await this.supabase
      .from('store_relationships')
      .insert({
        source_store_id: sourceStoreId,
        target_store_id: targetStoreId,
        relationship_type: relationshipType,
        sync_direction: syncDirection,
        sync_config: defaultSyncConfig,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to create store relationship: ${error.message}`, {
        code: 'CREATE_STORE_RELATIONSHIP_FAILED',
        context: { sourceStoreId, targetStoreId, relationshipType, error }
      });
    }

    return data;
  }

  async getStoreRelationships(storeId: string): Promise<StoreRelationship[]> {
    const { data, error } = await this.supabase
      .from('store_relationships')
      .select('*')
      .or(`source_store_id.eq.${storeId},target_store_id.eq.${storeId}`)
      .eq('is_active', true);

    if (error) {
      throw new MultiStoreError(`Failed to fetch store relationships: ${error.message}`, {
        code: 'FETCH_STORE_RELATIONSHIPS_FAILED',
        context: { storeId, error }
      });
    }

    return data || [];
  }

  // Store Access Control
  async grantStoreAccess(
    userId: string,
    storeId: string,
    role: StoreAccessControl['role'],
    grantedBy: string,
    permissions?: Partial<StoreAccessControl['permissions']>,
    expiresAt?: string
  ): Promise<StoreAccessControl> {
    const defaultPermissions: StoreAccessControl['permissions'] = {
      read_products: role !== 'viewer',
      write_products: ['owner', 'admin', 'manager'].includes(role),
      read_inventory: true,
      write_inventory: ['owner', 'admin', 'manager'].includes(role),
      read_customers: true,
      write_customers: ['owner', 'admin'].includes(role),
      read_orders: true,
      write_orders: ['owner', 'admin'].includes(role),
      manage_sync: ['owner', 'admin'].includes(role),
      resolve_conflicts: ['owner', 'admin'].includes(role),
      ...permissions
    };

    const { data, error } = await this.supabase
      .from('store_access_controls')
      .upsert({
        user_id: userId,
        store_id: storeId,
        role,
        permissions: defaultPermissions,
        granted_by: grantedBy,
        granted_at: new Date().toISOString(),
        expires_at: expiresAt,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to grant store access: ${error.message}`, {
        code: 'GRANT_STORE_ACCESS_FAILED',
        context: { userId, storeId, role, error }
      });
    }

    return data;
  }

  async getUserStoreAccess(userId: string): Promise<StoreAccessControl[]> {
    const { data, error } = await this.supabase
      .from('store_access_controls')
      .select(`
        *,
        stores:store_id (
          id,
          shop_name,
          shop_domain,
          store_group_id
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      throw new MultiStoreError(`Failed to fetch user store access: ${error.message}`, {
        code: 'FETCH_USER_STORE_ACCESS_FAILED',
        context: { userId, error }
      });
    }

    return data || [];
  }

  // Store Health Check
  async validateStoreConnection(storeId: string): Promise<{
    isConnected: boolean;
    error?: string;
    lastChecked: string;
  }> {
    try {
      const { data: store, error } = await this.supabase
        .from('stores')
        .select('access_token, shop_domain')
        .eq('id', storeId)
        .single();

      if (error || !store) {
        throw new StoreConnectionError('Store not found', storeId);
      }

      // Test connection with Shopify
      const client = shopifyClient(store.shop_domain, store.access_token);
      const shop = await client.get('/admin/api/2023-10/shop.json');

      if (!shop.data?.shop) {
        throw new StoreConnectionError('Invalid Shopify connection', storeId);
      }

      // Update store status
      await this.supabase
        .from('stores')
        .update({
          sync_status: 'active',
          last_sync_at: new Date().toISOString()
        })
        .eq('id', storeId);

      return {
        isConnected: true,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      // Update store status to error
      await this.supabase
        .from('stores')
        .update({
          sync_status: 'error'
        })
        .eq('id', storeId);

      return {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  // Utility Methods
  async getStoreGroupAnalytics(groupId: string) {
    const [stores, relationships, syncOps] = await Promise.all([
      this.getGroupStores(groupId),
      this.supabase
        .from('store_relationships')
        .select('*')
        .or(`source_store_id.in.(${stores.map(s => s.id).join(',')}),target_store_id.in.(${stores.map(s => s.id).join(',')})`)
        .eq('is_active', true),
      this.supabase
        .from('sync_operations')
        .select('status')
        .eq('store_group_id', groupId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    ]);

    const activeStores = stores.filter(s => s.sync_status === 'active').length;
    const syncOperations = syncOps.data || [];

    return {
      total_stores: stores.length,
      active_stores: activeStores,
      master_store: stores.find(s => s.is_master),
      sync_relationships: relationships.data?.length || 0,
      recent_sync_operations: {
        total: syncOperations.length,
        completed: syncOperations.filter(op => op.status === 'completed').length,
        failed: syncOperations.filter(op => op.status === 'failed').length,
        pending: syncOperations.filter(op => op.status === 'pending').length
      }
    };
  }
}