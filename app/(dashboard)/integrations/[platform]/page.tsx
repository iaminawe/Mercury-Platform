'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Activity, 
  FileText, 
  Link,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// This would come from your API/database
const platformConfigs: Record<string, any> = {
  'tiktok-ads': {
    name: 'TikTok for Business',
    icon: '🎵',
    description: 'Connect your store with TikTok to sync products and run ad campaigns',
    authType: 'oauth2',
    features: [
      'Product catalog sync',
      'Dynamic product ads',
      'Conversion tracking',
      'Campaign management',
      'Analytics dashboard',
      'Audience targeting'
    ],
    requiredScopes: [
      'business_management',
      'catalog_management',
      'campaign_management',
      'report'
    ],
    webhookEvents: [
      'product.created',
      'product.updated',
      'product.deleted',
      'order.created'
    ],
    setupSteps: [
      'Connect TikTok Business account',
      'Select advertiser accounts',
      'Configure product sync settings',
      'Set up pixel tracking',
      'Enable webhooks'
    ]
  },
  'klaviyo': {
    name: 'Klaviyo',
    icon: '✉️',
    description: 'Advanced email marketing and SMS automation platform',
    authType: 'api_key',
    features: [
      'Email automation',
      'SMS campaigns',
      'Customer segmentation',
      'A/B testing',
      'Revenue tracking',
      'Predictive analytics'
    ],
    webhookEvents: [
      'customer.created',
      'customer.updated',
      'order.placed',
      'order.fulfilled',
      'product.viewed'
    ]
  }
};

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const platform = params.platform as string;
  const config = platformConfigs[platform] || {};
  
  const [isConnected, setIsConnected] = useState(platform === 'klaviyo');
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [settings, setSettings] = useState({
    syncProducts: true,
    syncOrders: true,
    syncCustomers: true,
    webhooksEnabled: true,
    autoSync: true,
    syncInterval: '60'
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    
    if (config.authType === 'oauth2') {
      // Simulate OAuth flow
      setTimeout(() => {
        window.open('https://business.tiktok.com/oauth/authorize', '_blank');
        setTimeout(() => {
          setIsConnecting(false);
          setIsConnected(true);
          toast.success('Successfully connected to ' + config.name);
        }, 3000);
      }, 1000);
    } else {
      // Simulate API key connection
      setTimeout(() => {
        setIsConnecting(false);
        setIsConnected(true);
        toast.success('Successfully connected to ' + config.name);
      }, 2000);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast.success('Disconnected from ' + config.name);
  };

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully');
  };

  if (!config.name) {
    return (
      <div className="space-y-4">
        <Button onClick={() => router.back()} variant="ghost">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integrations
        </Button>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Integration not found
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={() => router.back()} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <h1 className="text-2xl font-bold">{config.name}</h1>
              <p className="text-muted-foreground">{config.description}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings" disabled={!isConnected}>Settings</TabsTrigger>
          <TabsTrigger value="activity" disabled={!isConnected}>Activity</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>What you can do with this integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {config.features?.map((feature: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Setup Steps */}
          {!isConnected && config.setupSteps && (
            <Card>
              <CardHeader>
                <CardTitle>Setup Steps</CardTitle>
                <CardDescription>Follow these steps to connect {config.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {config.setupSteps.map((step: string, index: number) => (
                    <li key={index} className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Connection Status */}
          {isConnected && (
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Current integration health and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">API Connection</span>
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Sync</span>
                  <span className="text-sm text-muted-foreground">2 minutes ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Webhooks</span>
                  <Badge variant="default" className="bg-green-600">Enabled</Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>Configure what data to sync and how often</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sync Products</Label>
                    <p className="text-sm text-muted-foreground">Keep product catalog in sync</p>
                  </div>
                  <Switch
                    checked={settings.syncProducts}
                    onCheckedChange={(checked) => setSettings({ ...settings, syncProducts: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sync Orders</Label>
                    <p className="text-sm text-muted-foreground">Send order data for tracking</p>
                  </div>
                  <Switch
                    checked={settings.syncOrders}
                    onCheckedChange={(checked) => setSettings({ ...settings, syncOrders: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sync Customers</Label>
                    <p className="text-sm text-muted-foreground">Share customer data for targeting</p>
                  </div>
                  <Switch
                    checked={settings.syncCustomers}
                    onCheckedChange={(checked) => setSettings({ ...settings, syncCustomers: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Webhooks</Label>
                    <p className="text-sm text-muted-foreground">Real-time event notifications</p>
                  </div>
                  <Switch
                    checked={settings.webhooksEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, webhooksEnabled: checked })}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-sync</Label>
                    <p className="text-sm text-muted-foreground">Automatically sync data</p>
                  </div>
                  <Switch
                    checked={settings.autoSync}
                    onCheckedChange={(checked) => setSettings({ ...settings, autoSync: checked })}
                  />
                </div>
                
                {settings.autoSync && (
                  <div className="space-y-2">
                    <Label>Sync Interval (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.syncInterval}
                      onChange={(e) => setSettings({ ...settings, syncInterval: e.target.value })}
                      min="15"
                      max="1440"
                    />
                  </div>
                )}
              </div>
              
              <Button onClick={handleSaveSettings} className="w-full">
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {config.authType === 'api_key' && (
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Manage your API credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex space-x-2">
                    <Input type="password" value="••••••••••••••••" disabled />
                    <Button variant="outline" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex space-x-2">
                    <Input 
                      value="https://mercury.app/webhooks/klaviyo" 
                      readOnly 
                    />
                    <Button variant="outline" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest sync operations and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { type: 'sync', message: 'Products synced successfully', time: '2 minutes ago', status: 'success' },
                  { type: 'webhook', message: 'Order webhook received', time: '15 minutes ago', status: 'success' },
                  { type: 'sync', message: 'Customer sync completed', time: '1 hour ago', status: 'success' },
                  { type: 'error', message: 'Rate limit exceeded, retrying...', time: '2 hours ago', status: 'warning' },
                  { type: 'sync', message: 'Inventory levels updated', time: '3 hours ago', status: 'success' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    {activity.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : activity.status === 'warning' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Statistics</CardTitle>
              <CardDescription>Data sync performance over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium">Products Synced</p>
                  <p className="text-2xl font-bold">1,234</p>
                  <p className="text-xs text-muted-foreground">+5.2% from yesterday</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Orders Processed</p>
                  <p className="text-2xl font-bold">456</p>
                  <p className="text-xs text-muted-foreground">+12.3% from yesterday</p>
                </div>
                <div>
                  <p className="text-sm font-medium">API Calls</p>
                  <p className="text-2xl font-bold">8,901</p>
                  <p className="text-xs text-muted-foreground">Within rate limits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>Learn how to use this integration effectively</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Quick Start Guide</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Get up and running with {config.name} in minutes. This guide covers the basic setup and configuration.
                </p>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  View Guide
                </Button>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">API Reference</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Complete API documentation including endpoints, webhooks, and data schemas.
                </p>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View API Docs
                </Button>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Troubleshooting</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Common issues and solutions for {config.name} integration.
                </p>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Troubleshooting Guide
                </Button>
              </div>
            </CardContent>
          </Card>

          {config.webhookEvents && (
            <Card>
              <CardHeader>
                <CardTitle>Webhook Events</CardTitle>
                <CardDescription>Events that trigger webhooks from your store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {config.webhookEvents.map((event: string, index: number) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{event}</code>
                      <Badge variant="outline">Enabled</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}