'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Store, AlertTriangle, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/use-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: sessionData, isLoading: sessionLoading } = trpc.auth.getSession.useQuery();
  const { data: storeData, isLoading: storeLoading, refetch: refetchStore } = trpc.auth.getStore.useQuery(
    undefined,
    {
      enabled: !!sessionData?.session,
    }
  );

  const updateStore = trpc.auth.updateStore.useMutation({
    onSuccess: () => {
      toast({
        title: 'Settings updated',
        description: 'Your store settings have been saved.',
      });
      refetchStore();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const disconnectStore = trpc.auth.disconnectStore.useMutation({
    onSuccess: () => {
      toast({
        title: 'Store disconnected',
        description: 'Your Shopify store has been disconnected.',
      });
      router.push('/install');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsDisconnecting(false);
    },
  });

  const signOut = trpc.auth.signOut.useMutation({
    onSuccess: () => {
      router.push('/install');
    },
  });

  if (sessionLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!storeData?.store) {
    router.push('/install');
    return null;
  }

  const store = storeData.store;

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    await disconnectStore.mutateAsync();
  };

  const handleSignOut = async () => {
    await signOut.mutateAsync();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Store Information */}
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
              <CardDescription>Your connected Shopify store details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Store className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium">{store.shop_name}</p>
                  <p className="text-sm text-gray-500">{store.shop_domain}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <Label className="text-sm text-gray-500">Plan</Label>
                  <p className="font-medium">{store.plan || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <p className="font-medium flex items-center">
                    {store.is_active ? (
                      <>
                        <Check className="h-4 w-4 text-green-500 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                        Inactive
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Connected Since</Label>
                  <p className="font-medium">
                    {new Date(store.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Last Updated</Label>
                  <p className="font-medium">
                    {new Date(store.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Store Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Store Settings</CardTitle>
              <CardDescription>Configure your store preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-sync Products</Label>
                  <p className="text-sm text-gray-500">
                    Automatically sync products when changes are detected
                  </p>
                </div>
                <Switch
                  checked={store.settings?.auto_sync_products ?? true}
                  onCheckedChange={(checked) => {
                    updateStore.mutate({
                      settings: {
                        ...store.settings,
                        auto_sync_products: checked,
                      },
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Analysis</Label>
                  <p className="text-sm text-gray-500">
                    Enable AI-powered product and customer insights
                  </p>
                </div>
                <Switch
                  checked={store.settings?.ai_analysis_enabled ?? true}
                  onCheckedChange={(checked) => {
                    updateStore.mutate({
                      settings: {
                        ...store.settings,
                        ai_analysis_enabled: checked,
                      },
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Receive email updates about important events
                  </p>
                </div>
                <Switch
                  checked={store.settings?.email_notifications ?? true}
                  onCheckedChange={(checked) => {
                    updateStore.mutate({
                      settings: {
                        ...store.settings,
                        email_notifications: checked,
                      },
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Disconnecting your store will remove all access to your Shopify data.
                  You can reconnect at any time by going through the installation process again.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect Store'
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}