'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Mail, 
  MousePointer, 
  DollarSign,
  Eye,
  BarChart3,
  Calendar,
  Target,
  RefreshCw
} from 'lucide-react';

interface CampaignStatsProps {
  campaignId: string;
  realTime?: boolean;
}

interface CampaignMetrics {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  complaintRate: number;
  revenue: number;
  conversions: number;
  conversionRate: number;
  revenuePerEmail: number;
  listGrowth: number;
  engagementScore: number;
}

interface TimeSeriesData {
  timestamp: string;
  opens: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface DeviceStats {
  desktop: number;
  mobile: number;
  tablet: number;
  webmail: number;
}

interface LocationStats {
  country: string;
  opens: number;
  clicks: number;
  percentage: number;
}

export default function CampaignStats({ campaignId, realTime = false }: CampaignStatsProps) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [locationStats, setLocationStats] = useState<LocationStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadCampaignStats();
    
    if (realTime) {
      const interval = setInterval(loadCampaignStats, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [campaignId, realTime]);

  const loadCampaignStats = async () => {
    try {
      // Mock data for demonstration
      setMetrics({
        totalSent: 5600,
        delivered: 5456,
        opened: 1752,
        clicked: 381,
        bounced: 144,
        unsubscribed: 23,
        complained: 8,
        openRate: 32.1,
        clickRate: 6.8,
        clickToOpenRate: 21.7,
        bounceRate: 2.6,
        unsubscribeRate: 0.4,
        complaintRate: 0.1,
        revenue: 12340,
        conversions: 89,
        conversionRate: 1.6,
        revenuePerEmail: 2.20,
        listGrowth: 156,
        engagementScore: 8.2
      });

      setTimeSeriesData([
        { timestamp: '2025-07-19T08:00:00Z', opens: 245, clicks: 52, conversions: 8, revenue: 1120 },
        { timestamp: '2025-07-19T09:00:00Z', opens: 312, clicks: 67, conversions: 12, revenue: 1680 },
        { timestamp: '2025-07-19T10:00:00Z', opens: 428, clicks: 95, conversions: 18, revenue: 2240 },
        { timestamp: '2025-07-19T11:00:00Z', opens: 387, clicks: 83, conversions: 15, revenue: 1890 },
        { timestamp: '2025-07-19T12:00:00Z', opens: 298, clicks: 64, conversions: 11, revenue: 1540 },
        { timestamp: '2025-07-19T13:00:00Z', opens: 82, clicks: 20, conversions: 3, revenue: 420 }
      ]);

      setDeviceStats({
        desktop: 45.2,
        mobile: 41.8,
        tablet: 8.3,
        webmail: 4.7
      });

      setLocationStats([
        { country: 'United States', opens: 892, clicks: 198, percentage: 50.9 },
        { country: 'Canada', opens: 245, clicks: 56, percentage: 14.0 },
        { country: 'United Kingdom', opens: 198, clicks: 42, percentage: 11.3 },
        { country: 'Australia', opens: 156, clicks: 34, percentage: 8.9 },
        { country: 'Germany', opens: 134, clicks: 28, percentage: 7.6 },
        { country: 'Other', opens: 127, clicks: 23, percentage: 7.3 }
      ]);

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to load campaign stats:', error);
      setLoading(false);
    }
  };

  const getMetricTrend = (value: number, benchmark: number) => {
    const difference = value - benchmark;
    const percentage = ((difference / benchmark) * 100).toFixed(1);
    const isPositive = difference > 0;
    
    return {
      percentage: Math.abs(parseFloat(percentage)),
      isPositive,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-green-600' : 'text-red-600'
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No campaign data available</p>
        <Button variant="outline" onClick={loadCampaignStats} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  const deliveryTrend = getMetricTrend(metrics.openRate, 24.8); // Industry benchmark
  const engagementTrend = getMetricTrend(metrics.clickRate, 3.2);
  const revenueTrend = getMetricTrend(metrics.conversionRate, 1.2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign Analytics</h2>
          <p className="text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
            {realTime && <Badge variant="secondary" className="ml-2">Live</Badge>}
          </p>
        </div>
        <Button variant="outline" onClick={loadCampaignStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.delivered.toLocaleString()} delivered ({formatPercentage((metrics.delivered / metrics.totalSent) * 100)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.openRate)}</div>
            <div className="flex items-center text-xs">
              <deliveryTrend.icon className={`h-3 w-3 mr-1 ${deliveryTrend.color}`} />
              <span className={deliveryTrend.color}>
                {deliveryTrend.percentage}% vs industry avg
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.clickRate)}</div>
            <div className="flex items-center text-xs">
              <engagementTrend.icon className={`h-3 w-3 mr-1 ${engagementTrend.color}`} />
              <span className={engagementTrend.color}>
                {engagementTrend.percentage}% vs industry avg
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.revenue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(metrics.revenuePerEmail)} per email
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Funnel</CardTitle>
                <CardDescription>Email performance breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Delivered</span>
                    <span>{metrics.delivered.toLocaleString()}</span>
                  </div>
                  <Progress value={(metrics.delivered / metrics.totalSent) * 100} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Opened</span>
                    <span>{metrics.opened.toLocaleString()} ({formatPercentage(metrics.openRate)})</span>
                  </div>
                  <Progress value={(metrics.opened / metrics.delivered) * 100} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Clicked</span>
                    <span>{metrics.clicked.toLocaleString()} ({formatPercentage(metrics.clickRate)})</span>
                  </div>
                  <Progress value={(metrics.clicked / metrics.delivered) * 100} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Converted</span>
                    <span>{metrics.conversions.toLocaleString()} ({formatPercentage(metrics.conversionRate)})</span>
                  </div>
                  <Progress value={(metrics.conversions / metrics.delivered) * 100} />
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{formatPercentage(metrics.clickToOpenRate)}</p>
                    <p className="text-xs text-muted-foreground">Click-to-Open Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{metrics.engagementScore}</p>
                    <p className="text-xs text-muted-foreground">Engagement Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{formatPercentage(metrics.bounceRate)}</p>
                    <p className="text-xs text-muted-foreground">Bounce Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{formatPercentage(metrics.unsubscribeRate)}</p>
                    <p className="text-xs text-muted-foreground">Unsubscribe Rate</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">List Growth</p>
                      <p className="text-sm text-muted-foreground">New subscribers gained</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">+{metrics.listGrowth}</p>
                      <p className="text-xs text-muted-foreground">This campaign</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Over Time</CardTitle>
              <CardDescription>Hourly breakdown of email engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeSeriesData.map((data, index) => {
                  const hour = new Date(data.timestamp).getHours();
                  const maxOpens = Math.max(...timeSeriesData.map(d => d.opens));
                  const maxClicks = Math.max(...timeSeriesData.map(d => d.clicks));
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{hour}:00</span>
                        <span>{data.opens} opens, {data.clicks} clicks</span>
                      </div>
                      <div className="space-y-1">
                        <Progress value={(data.opens / maxOpens) * 100} className="h-2" />
                        <Progress value={(data.clicks / maxClicks) * 100} className="h-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
              <CardDescription>Email opens by device type</CardDescription>
            </CardHeader>
            <CardContent>
              {deviceStats && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Desktop</span>
                      <span>{formatPercentage(deviceStats.desktop)}</span>
                    </div>
                    <Progress value={deviceStats.desktop} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Mobile</span>
                      <span>{formatPercentage(deviceStats.mobile)}</span>
                    </div>
                    <Progress value={deviceStats.mobile} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Tablet</span>
                      <span>{formatPercentage(deviceStats.tablet)}</span>
                    </div>
                    <Progress value={deviceStats.tablet} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Webmail</span>
                      <span>{formatPercentage(deviceStats.webmail)}</span>
                    </div>
                    <Progress value={deviceStats.webmail} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Performance</CardTitle>
              <CardDescription>Email engagement by location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {locationStats.map((location, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{location.country}</span>
                        <span className="text-sm text-muted-foreground">
                          {location.opens} opens, {location.clicks} clicks
                        </span>
                      </div>
                      <Progress value={location.percentage} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}