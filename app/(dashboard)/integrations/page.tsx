'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Check, X, Loader2, ExternalLink, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: 'connected' | 'available' | 'coming_soon';
  features: string[];
  popularityScore: number;
}

const integrations: Integration[] = [
  {
    id: 'tiktok-ads',
    name: 'TikTok for Business',
    description: 'Sync products and manage ad campaigns on TikTok',
    icon: '🎵',
    category: 'marketing',
    status: 'available',
    features: ['Product Sync', 'Campaign Management', 'Analytics', 'Pixel Tracking'],
    popularityScore: 95
  },
  {
    id: 'pinterest-business',
    name: 'Pinterest Business',
    description: 'Create shoppable pins and track conversions',
    icon: '📌',
    category: 'marketing',
    status: 'available',
    features: ['Shopping Pins', 'Catalog Sync', 'Analytics', 'Conversion Tracking'],
    popularityScore: 88
  },
  {
    id: 'gorgias',
    name: 'Gorgias',
    description: 'Unified customer support and helpdesk platform',
    icon: '💬',
    category: 'support',
    status: 'available',
    features: ['Ticket Management', 'Live Chat', 'Automation', 'Customer Data'],
    popularityScore: 92
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Advanced email marketing and SMS campaigns',
    icon: '✉️',
    category: 'marketing',
    status: 'connected',
    features: ['Email Automation', 'SMS Marketing', 'Segmentation', 'Analytics'],
    popularityScore: 97
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team notifications and collaboration',
    icon: '💼',
    category: 'automation',
    status: 'available',
    features: ['Order Notifications', 'Inventory Alerts', 'Team Updates', 'Custom Workflows'],
    popularityScore: 90
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5000+ apps and automate workflows',
    icon: '⚡',
    category: 'automation',
    status: 'available',
    features: ['Workflow Automation', 'Multi-app Integration', 'Custom Triggers', 'Data Sync'],
    popularityScore: 94
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics 4',
    description: 'Advanced ecommerce tracking and analytics',
    icon: '📊',
    category: 'analytics',
    status: 'connected',
    features: ['Enhanced Ecommerce', 'Conversion Tracking', 'Audience Insights', 'Custom Events'],
    popularityScore: 99
  },
  {
    id: 'facebook-shops',
    name: 'Facebook & Instagram Shopping',
    description: 'Sync catalog and enable social commerce',
    icon: '📱',
    category: 'social',
    status: 'connected',
    features: ['Product Catalog', 'Shopping Tags', 'Checkout', 'Analytics'],
    popularityScore: 96
  },
  {
    id: 'recharge',
    name: 'Recharge',
    description: 'Subscription management and recurring orders',
    icon: '🔄',
    category: 'subscription',
    status: 'available',
    features: ['Subscription Plans', 'Customer Portal', 'Analytics', 'Dunning Management'],
    popularityScore: 89
  },
  {
    id: 'shipstation',
    name: 'ShipStation',
    description: 'Multi-carrier shipping and fulfillment',
    icon: '📦',
    category: 'shipping',
    status: 'available',
    features: ['Label Printing', 'Rate Shopping', 'Tracking', 'Automation Rules'],
    popularityScore: 91
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Accounting and financial management',
    icon: '💰',
    category: 'accounting',
    status: 'available',
    features: ['Order Sync', 'Inventory Tracking', 'Tax Management', 'Financial Reports'],
    popularityScore: 87
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Advanced payment processing and subscriptions',
    icon: '💳',
    category: 'payments',
    status: 'connected',
    features: ['Payment Processing', 'Subscriptions', 'International Payments', 'Fraud Protection'],
    popularityScore: 98
  },
  {
    id: 'reviews-io',
    name: 'Reviews.io',
    description: 'Collect and display customer reviews',
    icon: '⭐',
    category: 'marketing',
    status: 'available',
    features: ['Review Collection', 'Photo Reviews', 'Q&A', 'SEO Benefits'],
    popularityScore: 85
  },
  {
    id: 'loyalty-lion',
    name: 'LoyaltyLion',
    description: 'Customer loyalty and rewards program',
    icon: '🦁',
    category: 'loyalty',
    status: 'available',
    features: ['Points Program', 'VIP Tiers', 'Referrals', 'Custom Rewards'],
    popularityScore: 86
  },
  {
    id: 'omnisend',
    name: 'Omnisend',
    description: 'Omnichannel marketing automation',
    icon: '🚀',
    category: 'marketing',
    status: 'available',
    features: ['Email & SMS', 'Push Notifications', 'Automation', 'Segmentation'],
    popularityScore: 84
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Customer service and support platform',
    icon: '🎧',
    category: 'support',
    status: 'coming_soon',
    features: ['Ticket System', 'Knowledge Base', 'Live Chat', 'Analytics'],
    popularityScore: 88
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing and automation',
    icon: '🐵',
    category: 'marketing',
    status: 'available',
    features: ['Email Campaigns', 'Automation', 'Landing Pages', 'Analytics'],
    popularityScore: 93
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing automation',
    icon: '🧲',
    category: 'crm',
    status: 'coming_soon',
    features: ['Contact Management', 'Marketing Hub', 'Sales Pipeline', 'Analytics'],
    popularityScore: 90
  },
  {
    id: 'aftership',
    name: 'AfterShip',
    description: 'Shipment tracking and notifications',
    icon: '🚚',
    category: 'shipping',
    status: 'available',
    features: ['Tracking Pages', 'Email Notifications', 'Returns Management', 'Analytics'],
    popularityScore: 82
  },
  {
    id: 'yotpo',
    name: 'Yotpo',
    description: 'Reviews, loyalty, and referrals platform',
    icon: '💜',
    category: 'marketing',
    status: 'coming_soon',
    features: ['Reviews & Ratings', 'Visual Marketing', 'Loyalty Program', 'SMS Marketing'],
    popularityScore: 87
  }
];

const categories = [
  { id: 'all', name: 'All Integrations', icon: '🔗' },
  { id: 'marketing', name: 'Marketing', icon: '📣' },
  { id: 'support', name: 'Customer Support', icon: '💬' },
  { id: 'analytics', name: 'Analytics', icon: '📊' },
  { id: 'automation', name: 'Automation', icon: '⚡' },
  { id: 'social', name: 'Social Commerce', icon: '📱' },
  { id: 'shipping', name: 'Shipping', icon: '📦' },
  { id: 'accounting', name: 'Accounting', icon: '💰' },
  { id: 'payments', name: 'Payments', icon: '💳' },
  { id: 'loyalty', name: 'Loyalty', icon: '🎁' },
  { id: 'crm', name: 'CRM', icon: '👥' },
  { id: 'subscription', name: 'Subscriptions', icon: '🔄' }
];

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredIntegrations, setFilteredIntegrations] = useState(integrations);
  const [sortBy, setSortBy] = useState<'popularity' | 'name' | 'status'>('popularity');

  useEffect(() => {
    let filtered = integrations;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(i => 
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.popularityScore - a.popularityScore;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          const statusOrder = { connected: 0, available: 1, coming_soon: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        default:
          return 0;
      }
    });

    setFilteredIntegrations(filtered);
  }, [searchQuery, selectedCategory, sortBy]);

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const availableCount = integrations.filter(i => i.status === 'available').length;
  const totalCount = integrations.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your store with powerful apps and services
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedCount}</div>
            <p className="text-xs text-muted-foreground">Active integrations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Plus className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableCount}</div>
            <p className="text-xs text-muted-foreground">Ready to connect</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <ExternalLink className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">In marketplace</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border rounded-md"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="popularity">Most Popular</option>
          <option value="name">Name (A-Z)</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-6 h-auto">
          {categories.slice(0, 6).map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="text-xs"
            >
              <span className="mr-1">{category.icon}</span>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Additional categories */}
        <div className="flex flex-wrap gap-2 mt-2">
          {categories.slice(6).map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="mr-1">{category.icon}</span>
              {category.name}
            </Button>
          ))}
        </div>

        <TabsContent value={selectedCategory} className="mt-6">
          {/* Integration Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => (
              <Card key={integration.id} className="relative overflow-hidden">
                {integration.status === 'connected' && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="default" className="bg-green-600">
                      Connected
                    </Badge>
                  </div>
                )}
                {integration.status === 'coming_soon' && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="text-4xl">{integration.icon}</div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {integration.features.slice(0, 3).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{integration.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-xs ${
                              i < Math.floor(integration.popularityScore / 20)
                                ? 'text-yellow-500'
                                : 'text-gray-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({integration.popularityScore}%)
                      </span>
                    </div>
                    
                    {integration.status === 'connected' ? (
                      <Link href={`/integrations/${integration.id}`}>
                        <Button size="sm" variant="outline">
                          <Settings className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                      </Link>
                    ) : integration.status === 'available' ? (
                      <Link href={`/integrations/${integration.id}`}>
                        <Button size="sm">
                          Connect
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="secondary" disabled>
                        Notify Me
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredIntegrations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No integrations found matching your search.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}