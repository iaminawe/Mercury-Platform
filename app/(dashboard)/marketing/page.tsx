'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  Plus,
  Play,
  Pause,
  Edit,
  Eye,
  Copy,
  Trash2
} from 'lucide-react';

interface CampaignMetrics {
  totalSent: number;
  openRate: number;
  clickRate: number;
  revenue: number;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  scheduledAt?: string;
  metrics: CampaignMetrics;
  recipientCount: number;
}

export default function MarketingDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSubscribers: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    monthlyRevenue: 0
  });

  useEffect(() => {
    // Load marketing data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Mock data for demonstration
      setMetrics({
        totalCampaigns: 24,
        activeCampaigns: 6,
        totalSubscribers: 12450,
        avgOpenRate: 24.8,
        avgClickRate: 3.2,
        monthlyRevenue: 15680
      });

      setCampaigns([
        {
          id: '1',
          name: 'Welcome Series - Step 1',
          type: 'welcome',
          status: 'sent',
          metrics: { totalSent: 1250, openRate: 45.2, clickRate: 8.1, revenue: 2840 },
          recipientCount: 1250
        },
        {
          id: '2',
          name: 'Abandoned Cart Recovery',
          type: 'abandoned_cart',
          status: 'scheduled',
          scheduledAt: '2025-07-19T15:00:00Z',
          metrics: { totalSent: 0, openRate: 0, clickRate: 0, revenue: 0 },
          recipientCount: 340
        },
        {
          id: '3',
          name: 'Product Recommendations - AI Generated',
          type: 'product_recommendation',
          status: 'sending',
          metrics: { totalSent: 850, openRate: 28.4, clickRate: 5.2, revenue: 1560 },
          recipientCount: 2100
        },
        {
          id: '4',
          name: 'Monthly Newsletter - July',
          type: 'newsletter',
          status: 'draft',
          metrics: { totalSent: 0, openRate: 0, clickRate: 0, revenue: 0 },
          recipientCount: 0
        }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'sending':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'paused':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
          <p className="text-muted-foreground">
            AI-powered email campaigns and automation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/marketing/templates">
              <Eye className="h-4 w-4 mr-2" />
              Templates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/marketing/campaigns/new">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeCampaigns} active campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSubscribers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgOpenRate}%</div>
            <p className="text-xs text-muted-foreground">
              Industry avg: 21.3%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgClickRate}%</div>
            <p className="text-xs text-muted-foreground">
              +0.4% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +23% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Optimization</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">
              AI performance score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Campaigns</h2>
            <Button variant="outline" asChild>
              <Link href="/marketing/campaigns">
                View All
              </Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {campaign.type.replace('_', ' ')} • {campaign.recipientCount} recipients
                        {campaign.scheduledAt && (
                          <> • Scheduled for {formatDate(campaign.scheduledAt)}</>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'scheduled' && (
                        <Button size="sm" variant="outline">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'sent' && (
                        <Button size="sm" variant="outline">
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {campaign.metrics.totalSent > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sent</p>
                        <p className="font-medium">{campaign.metrics.totalSent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Open Rate</p>
                        <p className="font-medium">{campaign.metrics.openRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Click Rate</p>
                        <p className="font-medium">{campaign.metrics.clickRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-medium">${campaign.metrics.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Email Automations</h2>
            <Button asChild>
              <Link href="/marketing/automations/new">
                <Plus className="h-4 w-4 mr-2" />
                New Automation
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-green-600" />
                  Welcome Series
                </CardTitle>
                <CardDescription>
                  3-step welcome flow for new customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Triggered</p>
                    <p className="font-medium">1,250 times</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completion Rate</p>
                    <p className="font-medium">73%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-green-600" />
                  Abandoned Cart Recovery
                </CardTitle>
                <CardDescription>
                  2-step cart recovery sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Triggered</p>
                    <p className="font-medium">340 times</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recovery Rate</p>
                    <p className="font-medium">28%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pause className="h-5 w-5 text-yellow-600" />
                  Win-Back Campaign
                </CardTitle>
                <CardDescription>
                  Re-engage inactive customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Triggered</p>
                    <p className="font-medium">89 times</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reactivation Rate</p>
                    <p className="font-medium">15%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  Create New Automation
                </CardTitle>
                <CardDescription>
                  Set up a new email automation flow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link href="/marketing/automations/new">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Email Analytics</h2>
            <Button variant="outline" asChild>
              <Link href="/marketing/analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Detailed Analytics
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Welcome Series - Step 1</p>
                      <p className="text-sm text-muted-foreground">45.2% open rate</p>
                    </div>
                    <Badge variant="secondary">45.2%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Product Recommendations</p>
                      <p className="text-sm text-muted-foreground">28.4% open rate</p>
                    </div>
                    <Badge variant="secondary">28.4%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Monthly Newsletter</p>
                      <p className="text-sm text-muted-foreground">22.1% open rate</p>
                    </div>
                    <Badge variant="secondary">22.1%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Optimization Tip</p>
                    <p className="text-sm text-blue-700">
                      Send welcome emails on Tuesday at 10 AM for 23% higher open rates
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">Performance</p>
                    <p className="text-sm text-green-700">
                      Your subject lines with personalization perform 31% better
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-900">Suggestion</p>
                    <p className="text-sm text-yellow-700">
                      Consider A/B testing different CTA button colors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}