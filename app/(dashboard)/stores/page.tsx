import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StoreSwitcher } from '@/components/multi-store/store-switcher';
import { SyncStatus } from '@/components/multi-store/sync-status';
import { ConflictResolverUI } from '@/components/multi-store/conflict-resolver-ui';
import { 
  Store, 
  Users, 
  BarChart3, 
  Settings, 
  Plus,
  Crown,
  Sync,
  AlertTriangle,
  TrendingUp,
  Package,
  ShoppingCart
} from 'lucide-react';
import Link from 'next/link';

async function getStoreData(userId: string) {
  const supabase = createClient();

  // Get user's store groups and stores
  const [storeGroupsRes, storesRes, syncOpsRes, conflictsRes] = await Promise.all([
    supabase
      .from('store_groups')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    
    supabase
      .from('stores')
      .select('*')
      .eq('owner_id', userId)
      .order('is_master', { ascending: false })
      .order('created_at', { ascending: true }),
    
    supabase
      .from('sync_operations')
      .select('*')
      .in('source_store_id', (await supabase.from('stores').select('id').eq('owner_id', userId)).data?.map(s => s.id) || [])
      .order('created_at', { ascending: false })
      .limit(10),
    
    supabase
      .from('conflict_resolutions')
      .select(`
        *,
        sync_operation:sync_operations!inner (
          source_store_id
        )
      `)
      .eq('sync_operation.source_store_id', (await supabase.from('stores').select('id').eq('owner_id', userId).eq('is_master', true).single()).data?.id || '')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
  ]);

  return {
    storeGroups: storeGroupsRes.data || [],
    stores: storesRes.data || [],
    syncOperations: syncOpsRes.data || [],
    conflicts: conflictsRes.data || []
  };
}

export default async function StoresPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to access stores.</div>;
  }

  const { storeGroups, stores, syncOperations, conflicts } = await getStoreData(user.id);

  const masterStore = stores.find(s => s.is_master);
  const groupedStores = stores.filter(s => s.store_group_id);
  const individualStores = stores.filter(s => !s.store_group_id);

  // Calculate metrics
  const totalProducts = stores.reduce((sum, store) => sum + (store.settings?.product_count || 0), 0);
  const totalCustomers = stores.reduce((sum, store) => sum + (store.settings?.customer_count || 0), 0);
  const activeStores = stores.filter(s => s.sync_status === 'active').length;
  const syncingStores = stores.filter(s => s.sync_status === 'syncing').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Store Management</h1>
          <p className="text-muted-foreground">
            Manage and synchronize multiple Shopify stores from one dashboard
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/stores/connect">
              <Plus className="h-4 w-4 mr-2" />
              Connect Store
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/stores/groups/new">
              <Users className="h-4 w-4 mr-2" />
              Create Group
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeStores} active • {syncingStores} syncing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all stores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total customer base
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Operations</CardTitle>
            <Sync className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncOperations.length}</div>
            <p className="text-xs text-muted-foreground">
              {syncOperations.filter(op => op.status === 'running').length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Store Groups */}
      {storeGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Store Groups</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/stores/groups">
                View All Groups
              </Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeGroups.map((group) => {
              const groupStores = stores.filter(s => s.store_group_id === group.id);
              const masterStore = groupStores.find(s => s.is_master);
              
              return (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <Badge variant="outline">
                        {groupStores.length} stores
                      </Badge>
                    </div>
                    {group.description && (
                      <CardDescription>{group.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {masterStore && (
                      <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <Crown className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Master: {masterStore.shop_name}</span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Max Stores:</span>
                        <p className="font-medium">{group.max_stores}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Active:</span>
                        <p className="font-medium">
                          {groupStores.filter(s => s.sync_status === 'active').length}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/stores/groups/${group.id}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href={`/stores/groups/${group.id}/sync`}>
                          <Sync className="h-3 w-3 mr-1" />
                          Sync
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Stores */}
      {individualStores.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Individual Stores</h2>
            <Badge variant="outline">
              {individualStores.length} stores
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {individualStores.map((store) => (
              <Card key={store.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{store.shop_name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {store.is_master && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      <div
                        className={`w-3 h-3 rounded-full ${
                          store.sync_status === 'active' ? 'bg-green-500' :
                          store.sync_status === 'syncing' ? 'bg-blue-500' :
                          store.sync_status === 'paused' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        title={`Status: ${store.sync_status}`}
                      />
                    </div>
                  </div>
                  <CardDescription>{store.shop_domain}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Plan:</span>
                      <p className="font-medium capitalize">{store.plan}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p className="font-medium capitalize">{store.sync_status}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/stores/${store.id}`}>
                        View Details
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/stores/${store.id}/settings`}>
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sync Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sync className="h-5 w-5" />
              <span>Recent Sync Operations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading sync status...</div>}>
              <SyncStatus
                operations={syncOperations.slice(0, 5)}
                stores={stores}
              />
            </Suspense>
            {syncOperations.length > 5 && (
              <div className="mt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/stores/sync">
                    View All Operations
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conflicts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Pending Conflicts</span>
              {conflicts.length > 0 && (
                <Badge variant="destructive">{conflicts.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conflicts.length > 0 ? (
              <div className="space-y-3">
                {conflicts.slice(0, 3).map((conflict) => (
                  <div
                    key={conflict.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {conflict.conflict_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Field: {conflict.conflict_data.field_name}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/stores/conflicts/${conflict.id}`}>
                        Resolve
                      </Link>
                    </Button>
                  </div>
                ))}
                {conflicts.length > 3 && (
                  <div className="mt-4">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/stores/conflicts">
                        View All Conflicts ({conflicts.length})
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No conflicts
                </h3>
                <p className="text-sm text-gray-500">
                  All stores are synchronized without conflicts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {stores.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Store className="h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No stores connected
            </h2>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Connect your first Shopify store to start managing multiple stores and synchronizing data.
            </p>
            <Button asChild>
              <Link href="/stores/connect">
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Store
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}