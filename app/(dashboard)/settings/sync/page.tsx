'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  PlayCircle, 
  PauseCircle, 
  RefreshCw, 
  Download, 
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  Users,
  ShoppingCart,
  FolderOpen,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface SyncStats {
  resources: {
    products: number;
    collections: number;
    customers: number;
    orders: number;
  };
  webhooks: {
    recent: any[];
    total: number;
  };
  queues: QueueStatus[];
}

export default function SyncPage() {
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkImportProgress, setBulkImportProgress] = useState<Record<string, number>>({});

  // Fetch sync statistics
  const { data: stats, refetch } = trpc.shopify.getSyncStatistics.useQuery(undefined, {
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Bulk import mutation
  const bulkImport = trpc.shopify.bulkImport.useMutation({
    onSuccess: () => {
      toast({
        title: 'Bulk import started',
        description: 'Your data import has been queued and will process shortly.',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Queue control mutations
  const pauseQueue = trpc.shopify.pauseQueue.useMutation({
    onSuccess: () => {
      toast({ title: 'Queue paused' });
      refetch();
    },
  });

  const resumeQueue = trpc.shopify.resumeQueue.useMutation({
    onSuccess: () => {
      toast({ title: 'Queue resumed' });
      refetch();
    },
  });

  const clearQueue = trpc.shopify.clearQueue.useMutation({
    onSuccess: () => {
      toast({ title: 'Queue cleared' });
      refetch();
    },
  });

  useEffect(() => {
    if (stats) {
      setSyncStats(stats as SyncStats);
      setIsLoading(false);
    }
  }, [stats]);

  const handleBulkImport = (resources: string[]) => {
    bulkImport.mutate({
      importType: 'full',
      resources: resources as any,
    });
  };

  const getQueueIcon = (queueName: string) => {
    if (queueName.includes('product')) return <Package className="h-4 w-4" />;
    if (queueName.includes('collection')) return <FolderOpen className="h-4 w-4" />;
    if (queueName.includes('customer')) return <Users className="h-4 w-4" />;
    if (queueName.includes('order')) return <ShoppingCart className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4" />;
  };

  const getQueueStatusColor = (queue: QueueStatus) => {
    if (queue.paused) return 'text-yellow-600';
    if (queue.failed > 0) return 'text-red-600';
    if (queue.active > 0) return 'text-green-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Sync</h1>
        <p className="text-muted-foreground mt-2">
          Manage your Shopify data synchronization
        </p>
      </div>

      {/* Resource Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.resources.products || 0}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => handleBulkImport(['products'])}
            >
              <Download className="h-3 w-3 mr-1" />
              Import Products
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collections</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.resources.collections || 0}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => handleBulkImport(['collections'])}
            >
              <Download className="h-3 w-3 mr-1" />
              Import Collections
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.resources.customers || 0}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => handleBulkImport(['customers'])}
            >
              <Download className="h-3 w-3 mr-1" />
              Import Customers
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.resources.orders || 0}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => handleBulkImport(['orders'])}
            >
              <Download className="h-3 w-3 mr-1" />
              Import Orders
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Import Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Import</CardTitle>
          <CardDescription>
            Import all your Shopify data at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => handleBulkImport(['products', 'collections', 'customers', 'orders'])}
              disabled={bulkImport.isLoading}
            >
              {bulkImport.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import All Data
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Status</CardTitle>
          <CardDescription>
            Monitor sync queue processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncStats?.queues.map((queue) => (
              <div key={queue.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getQueueIcon(queue.name)}
                    <span className="font-medium capitalize">
                      {queue.name.replace(/-/g, ' ')}
                    </span>
                    {queue.paused && (
                      <Badge variant="secondary" className="text-xs">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {queue.paused ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resumeQueue.mutate({ queueName: queue.name })}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => pauseQueue.mutate({ queueName: queue.name })}
                      >
                        <PauseCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => clearQueue.mutate({ queueName: queue.name })}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Waiting: {queue.waiting}
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <Loader2 className="h-3 w-3" />
                    Active: {queue.active}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <CheckCircle className="h-3 w-3" />
                    Completed: {queue.completed}
                  </span>
                  {queue.failed > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      Failed: {queue.failed}
                    </span>
                  )}
                </div>
                {queue.active > 0 && (
                  <Progress value={75} className="h-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhooks</CardTitle>
          <CardDescription>
            Latest webhook activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncStats?.webhooks.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent webhooks</p>
          ) : (
            <div className="space-y-2">
              {syncStats?.webhooks.recent.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-2 rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    {webhook.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">{webhook.topic}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(webhook.processed_at), 'PPp')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}