// Multi-Store Access Control System
import { createClient } from '@/lib/supabase/server';
import { 
  StoreAccessControl, 
  EnhancedStore, 
  StoreGroup,
  MultiStoreError 
} from './types';

export class AccessController {
  private supabase = createClient();

  // Role-Based Access Control
  async grantAccess(
    userId: string,
    storeId: string,
    role: StoreAccessControl['role'],
    grantedBy: string,
    customPermissions?: Partial<StoreAccessControl['permissions']>,
    expiresAt?: string
  ): Promise<StoreAccessControl> {
    // Verify granter has permission to grant access
    const canGrant = await this.canManageAccess(grantedBy, storeId);
    if (!canGrant) {
      throw new MultiStoreError('Insufficient permissions to grant access', {
        code: 'INSUFFICIENT_PERMISSIONS',
        context: { grantedBy, storeId, role }
      });
    }

    // Generate default permissions based on role
    const defaultPermissions = this.generateRolePermissions(role);
    const finalPermissions = { ...defaultPermissions, ...customPermissions };

    const { data: access, error } = await this.supabase
      .from('store_access_controls')
      .upsert({
        user_id: userId,
        store_id: storeId,
        role,
        permissions: finalPermissions,
        granted_by: grantedBy,
        granted_at: new Date().toISOString(),
        expires_at: expiresAt,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to grant access: ${error.message}`, {
        code: 'GRANT_ACCESS_FAILED',
        context: { userId, storeId, role, error }
      });
    }

    return access;
  }

  async revokeAccess(
    userId: string,
    storeId: string,
    revokedBy: string
  ): Promise<void> {
    // Verify revoker has permission
    const canRevoke = await this.canManageAccess(revokedBy, storeId);
    if (!canRevoke) {
      throw new MultiStoreError('Insufficient permissions to revoke access', {
        code: 'INSUFFICIENT_PERMISSIONS',
        context: { revokedBy, storeId, userId }
      });
    }

    const { error } = await this.supabase
      .from('store_access_controls')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('store_id', storeId);

    if (error) {
      throw new MultiStoreError(`Failed to revoke access: ${error.message}`, {
        code: 'REVOKE_ACCESS_FAILED',
        context: { userId, storeId, error }
      });
    }
  }

  async updatePermissions(
    userId: string,
    storeId: string,
    permissions: Partial<StoreAccessControl['permissions']>,
    updatedBy: string
  ): Promise<StoreAccessControl> {
    // Verify updater has permission
    const canUpdate = await this.canManageAccess(updatedBy, storeId);
    if (!canUpdate) {
      throw new MultiStoreError('Insufficient permissions to update permissions', {
        code: 'INSUFFICIENT_PERMISSIONS',
        context: { updatedBy, storeId, userId }
      });
    }

    // Get current permissions
    const { data: currentAccess, error: fetchError } = await this.supabase
      .from('store_access_controls')
      .select('permissions')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .single();

    if (fetchError) {
      throw new MultiStoreError(`Access control not found: ${fetchError.message}`, {
        code: 'ACCESS_CONTROL_NOT_FOUND',
        context: { userId, storeId, fetchError }
      });
    }

    const updatedPermissions = { ...currentAccess.permissions, ...permissions };

    const { data: access, error } = await this.supabase
      .from('store_access_controls')
      .update({
        permissions: updatedPermissions,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      throw new MultiStoreError(`Failed to update permissions: ${error.message}`, {
        code: 'UPDATE_PERMISSIONS_FAILED',
        context: { userId, storeId, error }
      });
    }

    return access;
  }

  // Permission Checking
  async hasPermission(
    userId: string,
    storeId: string,
    permission: keyof StoreAccessControl['permissions']
  ): Promise<boolean> {
    const access = await this.getUserStoreAccess(userId, storeId);
    if (!access) return false;

    return access.permissions[permission] === true;
  }

  async hasAnyPermission(
    userId: string,
    storeId: string,
    permissions: Array<keyof StoreAccessControl['permissions']>
  ): Promise<boolean> {
    const access = await this.getUserStoreAccess(userId, storeId);
    if (!access) return false;

    return permissions.some(permission => access.permissions[permission] === true);
  }

  async hasAllPermissions(
    userId: string,
    storeId: string,
    permissions: Array<keyof StoreAccessControl['permissions']>
  ): Promise<boolean> {
    const access = await this.getUserStoreAccess(userId, storeId);
    if (!access) return false;

    return permissions.every(permission => access.permissions[permission] === true);
  }

  async canManageAccess(userId: string, storeId: string): Promise<boolean> {
    // Check if user is store owner
    const { data: store, error } = await this.supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .single();

    if (error) return false;
    if (store.owner_id === userId) return true;

    // Check if user has admin role
    const access = await this.getUserStoreAccess(userId, storeId);
    return access?.role === 'admin';
  }

  // Access Retrieval
  async getUserStoreAccess(userId: string, storeId: string): Promise<StoreAccessControl | null> {
    const { data: access, error } = await this.supabase
      .from('store_access_controls')
      .select('*')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user store access:', error);
      return null;
    }

    return data || null;
  }

  async getUserAccessibleStores(userId: string): Promise<Array<{
    store: EnhancedStore;
    access: StoreAccessControl;
  }>> {
    const { data: accessControls, error } = await this.supabase
      .from('store_access_controls')
      .select(`
        *,
        store:stores (
          id,
          shop_name,
          shop_domain,
          store_group_id,
          is_master,
          sync_status,
          is_active
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      throw new MultiStoreError(`Failed to fetch user accessible stores: ${error.message}`, {
        code: 'FETCH_USER_STORES_FAILED',
        context: { userId, error }
      });
    }

    return accessControls?.map(ac => ({
      store: ac.store,
      access: ac
    })) || [];
  }

  async getStoreUsers(storeId: string): Promise<Array<{
    user_id: string;
    access: StoreAccessControl;
  }>> {
    const { data: accessControls, error } = await this.supabase
      .from('store_access_controls')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('role')
      .order('granted_at');

    if (error) {
      throw new MultiStoreError(`Failed to fetch store users: ${error.message}`, {
        code: 'FETCH_STORE_USERS_FAILED',
        context: { storeId, error }
      });
    }

    return accessControls?.map(ac => ({
      user_id: ac.user_id,
      access: ac
    })) || [];
  }

  // Store Group Access
  async getGroupAccessibleUsers(storeGroupId: string): Promise<Array<{
    user_id: string;
    stores: Array<{
      store: EnhancedStore;
      access: StoreAccessControl;
    }>;
  }>> {
    const { data: stores, error: storesError } = await this.supabase
      .from('stores')
      .select('id')
      .eq('store_group_id', storeGroupId);

    if (storesError) {
      throw new MultiStoreError(`Failed to fetch group stores: ${storesError.message}`, {
        code: 'FETCH_GROUP_STORES_FAILED',
        context: { storeGroupId, storesError }
      });
    }

    const storeIds = stores?.map(s => s.id) || [];
    if (storeIds.length === 0) return [];

    const { data: accessControls, error } = await this.supabase
      .from('store_access_controls')
      .select(`
        *,
        store:stores (
          id,
          shop_name,
          shop_domain,
          store_group_id,
          is_master,
          sync_status,
          is_active
        )
      `)
      .in('store_id', storeIds)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      throw new MultiStoreError(`Failed to fetch group access controls: ${error.message}`, {
        code: 'FETCH_GROUP_ACCESS_FAILED',
        context: { storeGroupId, error }
      });
    }

    // Group by user
    const userAccessMap = new Map<string, Array<{
      store: EnhancedStore;
      access: StoreAccessControl;
    }>>();

    for (const ac of accessControls || []) {
      if (!userAccessMap.has(ac.user_id)) {
        userAccessMap.set(ac.user_id, []);
      }
      userAccessMap.get(ac.user_id)!.push({
        store: ac.store,
        access: ac
      });
    }

    return Array.from(userAccessMap.entries()).map(([user_id, stores]) => ({
      user_id,
      stores
    }));
  }

  // Bulk Operations
  async grantGroupAccess(
    userIds: string[],
    storeGroupId: string,
    role: StoreAccessControl['role'],
    grantedBy: string
  ): Promise<StoreAccessControl[]> {
    // Get all stores in the group
    const { data: stores, error: storesError } = await this.supabase
      .from('stores')
      .select('id')
      .eq('store_group_id', storeGroupId);

    if (storesError) {
      throw new MultiStoreError(`Failed to fetch group stores: ${storesError.message}`, {
        code: 'FETCH_GROUP_STORES_FAILED',
        context: { storeGroupId, storesError }
      });
    }

    const storeIds = stores?.map(s => s.id) || [];
    const results: StoreAccessControl[] = [];

    // Grant access to all stores for all users
    for (const userId of userIds) {
      for (const storeId of storeIds) {
        try {
          const access = await this.grantAccess(userId, storeId, role, grantedBy);
          results.push(access);
        } catch (error) {
          console.error(`Failed to grant access for user ${userId} to store ${storeId}:`, error);
        }
      }
    }

    return results;
  }

  async revokeGroupAccess(
    userIds: string[],
    storeGroupId: string,
    revokedBy: string
  ): Promise<void> {
    // Get all stores in the group
    const { data: stores, error: storesError } = await this.supabase
      .from('stores')
      .select('id')
      .eq('store_group_id', storeGroupId);

    if (storesError) {
      throw new MultiStoreError(`Failed to fetch group stores: ${storesError.message}`, {
        code: 'FETCH_GROUP_STORES_FAILED',
        context: { storeGroupId, storesError }
      });
    }

    const storeIds = stores?.map(s => s.id) || [];

    // Revoke access from all stores for all users
    for (const userId of userIds) {
      for (const storeId of storeIds) {
        try {
          await this.revokeAccess(userId, storeId, revokedBy);
        } catch (error) {
          console.error(`Failed to revoke access for user ${userId} from store ${storeId}:`, error);
        }
      }
    }
  }

  // Access Expiration Management
  async cleanupExpiredAccess(): Promise<number> {
    const { data: expired, error } = await this.supabase
      .from('store_access_controls')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id');

    if (error) {
      throw new MultiStoreError(`Failed to cleanup expired access: ${error.message}`, {
        code: 'CLEANUP_EXPIRED_ACCESS_FAILED',
        context: { error }
      });
    }

    return expired?.length || 0;
  }

  async getExpiringAccess(daysAhead = 7): Promise<StoreAccessControl[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysAhead);

    const { data: expiring, error } = await this.supabase
      .from('store_access_controls')
      .select(`
        *,
        store:stores (
          id,
          shop_name,
          shop_domain
        )
      `)
      .lt('expires_at', expirationDate.toISOString())
      .gt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .order('expires_at');

    if (error) {
      throw new MultiStoreError(`Failed to fetch expiring access: ${error.message}`, {
        code: 'FETCH_EXPIRING_ACCESS_FAILED',
        context: { daysAhead, error }
      });
    }

    return expiring || [];
  }

  // Utility Methods
  private generateRolePermissions(role: StoreAccessControl['role']): StoreAccessControl['permissions'] {
    const basePermissions: StoreAccessControl['permissions'] = {
      read_products: false,
      write_products: false,
      read_inventory: false,
      write_inventory: false,
      read_customers: false,
      write_customers: false,
      read_orders: false,
      write_orders: false,
      manage_sync: false,
      resolve_conflicts: false
    };

    switch (role) {
      case 'owner':
        return {
          read_products: true,
          write_products: true,
          read_inventory: true,
          write_inventory: true,
          read_customers: true,
          write_customers: true,
          read_orders: true,
          write_orders: true,
          manage_sync: true,
          resolve_conflicts: true
        };

      case 'admin':
        return {
          read_products: true,
          write_products: true,
          read_inventory: true,
          write_inventory: true,
          read_customers: true,
          write_customers: true,
          read_orders: true,
          write_orders: true,
          manage_sync: true,
          resolve_conflicts: true
        };

      case 'manager':
        return {
          read_products: true,
          write_products: true,
          read_inventory: true,
          write_inventory: true,
          read_customers: true,
          write_customers: false,
          read_orders: true,
          write_orders: false,
          manage_sync: false,
          resolve_conflicts: false
        };

      case 'viewer':
        return {
          read_products: true,
          write_products: false,
          read_inventory: true,
          write_inventory: false,
          read_customers: true,
          write_customers: false,
          read_orders: true,
          write_orders: false,
          manage_sync: false,
          resolve_conflicts: false
        };

      default:
        return basePermissions;
    }
  }

  // Analytics
  async getAccessAnalytics(storeGroupId?: string): Promise<{
    total_users: number;
    users_by_role: Record<string, number>;
    stores_with_external_access: number;
    avg_permissions_per_user: number;
    expiring_soon: number;
  }> {
    let query = this.supabase
      .from('store_access_controls')
      .select(`
        role,
        permissions,
        expires_at,
        store:stores (
          store_group_id
        )
      `)
      .eq('is_active', true);

    if (storeGroupId) {
      query = query.eq('store.store_group_id', storeGroupId);
    }

    const { data: accessControls, error } = await query;

    if (error) {
      throw new MultiStoreError(`Failed to get access analytics: ${error.message}`, {
        code: 'GET_ACCESS_ANALYTICS_FAILED',
        context: { storeGroupId, error }
      });
    }

    const usersByRole: Record<string, number> = {};
    const uniqueStores = new Set<string>();
    let totalPermissions = 0;
    let expiringCount = 0;

    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    for (const ac of accessControls || []) {
      usersByRole[ac.role] = (usersByRole[ac.role] || 0) + 1;
      uniqueStores.add(ac.store.id);
      
      // Count permissions
      totalPermissions += Object.values(ac.permissions).filter(Boolean).length;
      
      // Check if expiring soon
      if (ac.expires_at && new Date(ac.expires_at) <= oneWeekFromNow) {
        expiringCount++;
      }
    }

    return {
      total_users: accessControls?.length || 0,
      users_by_role: usersByRole,
      stores_with_external_access: uniqueStores.size,
      avg_permissions_per_user: accessControls?.length ? totalPermissions / accessControls.length : 0,
      expiring_soon: expiringCount
    };
  }
}