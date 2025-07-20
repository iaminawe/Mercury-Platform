import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StoreSwitcher } from '@/components/multi-store/store-switcher';
import { SyncStatus } from '@/components/multi-store/sync-status';
import { 
  Store, 
  Users, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  Crown,
  ExternalLink,
  Sync,
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

async function getStoreDetails(storeId: string, userId: string) {
  const supabase = createClient();

  const [storeRes, groupRes, syncOpsRes, conflictsRes, analyticsRes] = await Promise.all([
    // Get store details
    supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .eq('owner_id', userId)
      .single(),
    
    // Get store group if applicable
    supabase
      .from('store_groups')
      .select('*')
      .eq('owner_id', userId),
    
    // Get recent sync operations
    supabase
      .from('sync_operations')
      .select('*')
      .or(`source_store_id.eq.${storeId},target_stores.cs.{${storeId}}`)
      .order('created_at', { ascending: false })
      .limit(10),
    
    // Get store conflicts
    supabase
      .from('conflict_resolutions')
      .select(`
        *,
        sync_operation:sync_operations!inner (
          source_store_id,
          target_stores
        )
      `)
      .or(`source_store_id.eq.${storeId},target_store_id.eq.${storeId}`)
      .order('created_at', { ascending: false }),
    
    // Get analytics snapshots
    supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .limit(30)
  ]);

  if (storeRes.error || !storeRes.data) {
    return null;
  }

  const store = storeRes.data;
  const storeGroup = store.store_group_id 
    ? groupRes.data?.find(g => g.id === store.store_group_id) 
    : null;

  return {
    store,
    storeGroup,
    syncOperations: syncOpsRes.data || [],
    conflicts: conflictsRes.data || [],
    analytics: analyticsRes.data || []
  };
}

export default async function StoreDetailsPage({
  params
}: {
  params: { storeId: string }
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to access store details.</div>;
  }

  const storeData = await getStoreDetails(params.storeId, user.id);

  if (!storeData) {
    notFound();
  }

  const { store, storeGroup, syncOperations, conflicts, analytics } = storeData;

  // Calculate metrics from analytics
  const latestAnalytics = analytics[0];
  const previousAnalytics = analytics[1];
  
  const revenueChange = latestAnalytics && previousAnalytics
    ? ((latestAnalytics.revenue - previousAnalytics.revenue) / previousAnalytics.revenue) * 100
    : 0;

  const ordersChange = latestAnalytics && previousAnalytics
    ? ((latestAnalytics.orders_count - previousAnalytics.orders_count) / previousAnalytics.orders_count) * 100
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'syncing':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const runningSyncs = syncOperations.filter(op => op.status === 'running');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold tracking-tight">{store.shop_name}</h1>
            {store.is_master && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                <Crown className="h-3 w-3 mr-1" />
                Master Store
              </Badge>
            )}
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(store.sync_status)}`}
                title={`Status: ${store.sync_status}`}
              />
              <Badge variant="outline" className="capitalize">
                {store.sync_status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>{store.shop_domain}</span>
            <span>•</span>
            <span className="capitalize">{store.plan} plan</span>
            {storeGroup && (
              <>
                <span>•</span>
                <span>Group: {storeGroup.name}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <a href={`https://${store.shop_domain}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Store
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/stores/${store.id}/settings`}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/stores/${store.id}/sync`}>
              <Sync className="h-4 w-4 mr-2" />
              Sync Now
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${latestAnalytics?.revenue?.toLocaleString() || '0'}
            </div>
            {revenueChange !== 0 && (
              <p className={`text-xs ${revenueChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {revenueChange > 0 ? '+' : ''}{revenueChange.toFixed(1)}% from yesterday
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestAnalytics?.orders_count?.toLocaleString() || '0'}
            </div>
            {ordersChange !== 0 && (
              <p className={`text-xs ${ordersChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {ordersChange > 0 ? '+' : ''}{ordersChange.toFixed(1)}% from yesterday
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${latestAnalytics?.average_order_value?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestAnalytics?.conversion_rate?.toFixed(2) || '0'}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestAnalytics?.unique_visitors?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestAnalytics?.page_views?.toLocaleString() || '0'} page views
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(runningSyncs.length > 0 || pendingConflicts.length > 0) && (
        <div className="space-y-3">
          {runningSyncs.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <Sync className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {runningSyncs.length} sync operation{runningSyncs.length > 1 ? 's' : ''} in progress
                    </p>
                    <p className="text-sm text-blue-700">
                      Data synchronization is currently running
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="#sync-operations">View Details</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {pendingConflicts.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">
                      {pendingConflicts.length} sync conflict{pendingConflicts.length > 1 ? 's' : ''} require attention
                    </p>
                    <p className="text-sm text-red-700">
                      Manual resolution needed to continue synchronization
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/stores/${store.id}/conflicts`}>Resolve Conflicts</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sync">Synchronization</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Store Information */}
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Shop Name</Label>
                  <p className="text-sm">{store.shop_name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Domain</Label>
                  <p className="text-sm">{store.shop_domain}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm">{store.email}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Plan</Label>
                  <p className="text-sm capitalize">{store.plan}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Connected</Label>
                  <p className="text-sm">{new Date(store.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <p className="text-sm">{new Date(store.updated_at).toLocaleDateString()}</p>
                </div>
              </div>

              {storeGroup && (
                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Store Group</Label>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{storeGroup.name}</p>
                        {storeGroup.description && (
                          <p className="text-sm text-muted-foreground">{storeGroup.description}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/stores/groups/${storeGroup.id}`}>
                          View Group
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Products</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-2">
                  {store.settings?.product_count?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Total products in store
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/stores/${store.id}/products`}>
                    Manage Products
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Customers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-2">
                  {store.settings?.customer_count?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Total customers
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/stores/${store.id}/customers`}>
                    View Customers
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Analytics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-2">
                  ${latestAnalytics?.revenue?.toLocaleString() || '0'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Revenue this month
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/stores/${store.id}/analytics`}>
                    View Analytics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sync" id="sync-operations">
          <SyncStatus
            operations={syncOperations}
            stores={[store]}
          />
        </TabsContent>

        <TabsContent value="conflicts">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sync Conflicts</h3>
              <Badge variant={pendingConflicts.length > 0 ? "destructive" : "outline"}>
                {pendingConflicts.length} pending
              </Badge>
            </div>
            
            {conflicts.length > 0 ? (
              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <Card key={conflict.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {conflict.conflict_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Field: {conflict.conflict_data.field_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(conflict.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={conflict.status === 'pending' ? 'destructive' : 'outline'}>
                            {conflict.status}
                          </Badge>
                          {conflict.status === 'pending' && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/stores/conflicts/${conflict.id}`}>
                                Resolve
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No conflicts
                  </h3>
                  <p className="text-sm text-gray-500 text-center max-w-sm">
                    This store has no synchronization conflicts. All data is in sync.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>
                  Store performance metrics for the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold">
                          ${analytics.reduce((sum, a) => sum + (a.revenue || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Orders</p>
                        <p className="text-2xl font-bold">
                          {analytics.reduce((sum, a) => sum + (a.orders_count || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Avg Conversion Rate</p>
                        <p className="text-2xl font-bold">
                          {(analytics.reduce((sum, a) => sum + (a.conversion_rate || 0), 0) / analytics.length).toFixed(2)}%
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Visitors</p>
                        <p className="text-2xl font-bold">
                          {analytics.reduce((sum, a) => sum + (a.unique_visitors || 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No analytics data
                    </h3>
                    <p className="text-sm text-gray-500">
                      Analytics data will appear here once your store starts generating data.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Store Settings</CardTitle>
              <CardDescription>
                Configure synchronization and store-specific settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Synchronization</h4>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable data synchronization
                    </p>
                  </div>
                  <Badge variant={store.sync_enabled ? "default" : "secondary"}>
                    {store.sync_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Master Store</h4>
                    <p className="text-sm text-muted-foreground">
                      This store is the master for conflict resolution
                    </p>
                  </div>
                  <Badge variant={store.is_master ? "default" : "secondary"}>
                    {store.is_master ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="pt-4">
                  <Button asChild>
                    <Link href={`/stores/${store.id}/settings`}>
                      Edit Settings
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}