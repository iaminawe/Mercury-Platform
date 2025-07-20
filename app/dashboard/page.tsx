'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Store, Package, ShoppingCart, TrendingUp, Users, Settings } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

export default function DashboardPage() {
  const router = useRouter();
  const { data: sessionData, isLoading: sessionLoading } = trpc.auth.getSession.useQuery();
  const { data: storeData, isLoading: storeLoading } = trpc.auth.getStore.useQuery(
    undefined,
    {
      enabled: !!sessionData?.session,
    }
  );

  useEffect(() => {
    if (!sessionLoading && !sessionData?.session) {
      router.push('/install');
    }
  }, [sessionData, sessionLoading, router]);

  if (sessionLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!storeData?.store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Store Connected</CardTitle>
            <CardDescription>
              Please connect your Shopify store to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/install')} className="w-full">
              Connect Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const store = storeData.store;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Store className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {store.shop_name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {store.shop_domain}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">+0% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">+0% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">0 active products</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">0 new this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/products')}
              >
                <Package className="mr-2 h-4 w-4" />
                Sync Products
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/analytics')}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => router.push('/ai')}
              >
                <Store className="mr-2 h-4 w-4" />
                AI Insights
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
              <p className="text-sm mt-2">Activity will appear here once you start using Mercury</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}