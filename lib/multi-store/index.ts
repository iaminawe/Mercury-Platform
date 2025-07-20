// Multi-Store Management System - Main Export
export * from './types';
export { StoreManager } from './store-manager';
export { DataAggregator } from './data-aggregator';
export { SyncCoordinator } from './sync-coordinator';
export { ConflictResolver } from './conflict-resolver';
export { AccessController } from './access-controller';

// Main Multi-Store Service Class
import { StoreManager } from './store-manager';
import { DataAggregator } from './data-aggregator';
import { SyncCoordinator } from './sync-coordinator';
import { ConflictResolver } from './conflict-resolver';
import { AccessController } from './access-controller';
import { 
  StoreGroup, 
  EnhancedStore, 
  SyncOperation, 
  MultiStoreAnalytics,
  SyncConfig 
} from './types';

export class MultiStoreService {
  public storeManager: StoreManager;
  public dataAggregator: DataAggregator;
  public syncCoordinator: SyncCoordinator;
  public conflictResolver: ConflictResolver;
  public accessController: AccessController;

  constructor() {
    this.storeManager = new StoreManager();
    this.dataAggregator = new DataAggregator();
    this.syncCoordinator = new SyncCoordinator();
    this.conflictResolver = new ConflictResolver();
    this.accessController = new AccessController();
  }

  // High-level operations that combine multiple services
  async setupMultiStoreAccount(
    ownerId: string,
    groupName: string,
    stores: Array<{
      storeId: string;
      isMaster?: boolean;
    }>,
    syncConfig?: Partial<SyncConfig>
  ) {
    // Create store group
    const group = await this.storeManager.createStoreGroup(
      ownerId,
      groupName,
      `Multi-store group created on ${new Date().toLocaleDateString()}`
    );

    // Add stores to group
    const addedStores: EnhancedStore[] = [];
    for (const storeConfig of stores) {
      const store = await this.storeManager.addStoreToGroup(
        storeConfig.storeId,
        group.id,
        storeConfig.isMaster || false
      );
      addedStores.push(store);
    }

    // Set up store relationships for sync
    const masterStore = addedStores.find(s => s.is_master);
    if (masterStore) {
      const otherStores = addedStores.filter(s => !s.is_master);
      
      for (const store of otherStores) {
        await this.storeManager.createStoreRelationship(
          masterStore.id,
          store.id,
          'master_slave',
          'source_to_target'
        );
      }
    }

    return {
      group,
      stores: addedStores,
      masterStore
    };
  }

  async initiateFullGroupSync(
    storeGroupId: string,
    syncMode: SyncOperation['sync_mode'] = 'batch'
  ) {
    const operation = await this.syncCoordinator.initiateSyncOperation(
      storeGroupId,
      'full_sync',
      undefined, // No specific source store
      undefined, // Will determine target stores automatically
      syncMode
    );

    return operation;
  }

  async getGroupDashboard(storeGroupId: string): Promise<{
    group: StoreGroup;
    stores: EnhancedStore[];
    analytics: MultiStoreAnalytics;
    recentSyncs: SyncOperation[];
    pendingConflicts: number;
  }> {
    // This would be implemented to fetch all dashboard data
    // For now, returning a basic structure
    throw new Error('getGroupDashboard not yet implemented');
  }

  async migrateStoreToGroup(
    storeId: string,
    targetGroupId: string,
    isMaster = false
  ) {
    // Remove from current group if applicable
    const store = await this.storeManager.removeStoreFromGroup(storeId);
    
    // Add to new group
    const updatedStore = await this.storeManager.addStoreToGroup(
      storeId,
      targetGroupId,
      isMaster
    );

    return updatedStore;
  }

  async autoResolveConflicts(
    storeGroupId: string,
    strategy: 'master_wins' | 'latest_wins' | 'merge' = 'master_wins'
  ) {
    const conflicts = await this.conflictResolver.getConflicts(
      storeGroupId,
      'pending'
    );

    const resolutionStrategy = strategy === 'master_wins' ? 'auto_master_wins' :
                             strategy === 'latest_wins' ? 'auto_latest_wins' :
                             'auto_merge';

    const results = await this.conflictResolver.resolveBatchConflicts(
      conflicts.map(c => c.id),
      resolutionStrategy,
      'system' // Auto-resolution
    );

    return results;
  }

  async getStorePerformanceComparison(storeGroupId: string) {
    const analytics = await this.dataAggregator.generateMultiStoreAnalytics(
      storeGroupId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      new Date().toISOString()
    );

    return analytics;
  }

  // Health check for entire multi-store setup
  async performHealthCheck(storeGroupId: string) {
    const stores = await this.storeManager.getGroupStores(storeGroupId);
    const healthChecks = await Promise.all(
      stores.map(store => this.storeManager.validateStoreConnection(store.id))
    );

    const conflicts = await this.conflictResolver.getConflicts(storeGroupId, 'pending');
    const runningSyncs = await this.syncCoordinator.getSyncOperationStatus('latest'); // This would need to be implemented

    return {
      totalStores: stores.length,
      connectedStores: healthChecks.filter(hc => hc.isConnected).length,
      disconnectedStores: healthChecks.filter(hc => !hc.isConnected).length,
      pendingConflicts: conflicts.length,
      runningSyncs: 0, // Would be calculated from actual running operations
      lastHealthCheck: new Date().toISOString(),
      storeStatuses: stores.map((store, index) => ({
        store,
        healthCheck: healthChecks[index]
      }))
    };
  }
}

// Singleton instance
export const multiStoreService = new MultiStoreService();

// Utility functions
export function generateMasterProductId(productTitle: string, sku?: string): string {
  const base = sku || productTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `master_${base}_${Date.now()}`;
}

export function calculateInventoryDistribution(
  totalInventory: number,
  stores: EnhancedStore[],
  strategy: 'equal' | 'proportional' | 'master_priority' = 'equal'
): Record<string, number> {
  const distribution: Record<string, number> = {};

  switch (strategy) {
    case 'equal':
      const equalAmount = Math.floor(totalInventory / stores.length);
      stores.forEach(store => {
        distribution[store.id] = equalAmount;
      });
      break;

    case 'master_priority':
      const masterStore = stores.find(s => s.is_master);
      const otherStores = stores.filter(s => !s.is_master);
      
      if (masterStore) {
        distribution[masterStore.id] = Math.floor(totalInventory * 0.6); // 60% to master
        const remainingAmount = totalInventory - distribution[masterStore.id];
        const perOtherStore = Math.floor(remainingAmount / otherStores.length);
        
        otherStores.forEach(store => {
          distribution[store.id] = perOtherStore;
        });
      } else {
        // Fallback to equal distribution
        const equalAmount = Math.floor(totalInventory / stores.length);
        stores.forEach(store => {
          distribution[store.id] = equalAmount;
        });
      }
      break;

    case 'proportional':
      // This would be based on historical sales data
      // For now, fallback to equal distribution
      const proportionalAmount = Math.floor(totalInventory / stores.length);
      stores.forEach(store => {
        distribution[store.id] = proportionalAmount;
      });
      break;
  }

  return distribution;
}

export function validateSyncConfiguration(config: SyncConfig): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  if (config.batch_size <= 0) {
    errors.push('Batch size must be greater than 0');
  }

  if (config.retry_attempts < 0) {
    errors.push('Retry attempts cannot be negative');
  }

  if (config.retry_delay < 1000) {
    errors.push('Retry delay must be at least 1000ms');
  }

  if (config.enabled_sync_types.length === 0) {
    errors.push('At least one sync type must be enabled');
  }

  if (config.mode === 'scheduled' && !config.schedule?.cron) {
    errors.push('Cron expression required for scheduled sync mode');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}