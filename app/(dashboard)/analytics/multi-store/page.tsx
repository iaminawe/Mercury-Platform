'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Store, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ShoppingCart,
  Users,
  Globe,
  ArrowRight,
  Target,
  Activity,
  Package,
  BarChart3,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { StoreSelector } from '@/components/analytics/store-selector';
import { UnifiedCharts } from '@/components/analytics/unified-charts';
import { PerformanceMatrix } from '@/components/analytics/performance-matrix';
import { CrossStoreAggregator } from '@/lib/analytics/cross-store-aggregator';
import { UnifiedMetrics } from '@/lib/analytics/unified-metrics';
import { ComparativeAnalyzer } from '@/lib/analytics/comparative-analyzer';

interface MultiStoreAnalyticsPageProps {
  userId?: string;
}

export default function MultiStoreAnalyticsPage({ userId }: MultiStoreAnalyticsPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('30d');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const [stores, setStores] = useState<any[]>([]);
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    loadMultiStoreData();
  }, [selectedStores, dateRange]);

  const loadMultiStoreData = async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would be actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock store data
      const mockStores = [
        {
          id: 'store-1',
          shop_name: 'Fashion Forward NYC',
          shop_domain: 'fashion-forward-nyc.myshopify.com',
          status: 'active' as const,
          last_sync: new Date().toISOString(),
          metrics: { revenue: 1250000, orders: 3920 }
        },
        {
          id: 'store-2',
          shop_name: 'Tech Gadgets Pro',
          shop_domain: 'tech-gadgets-pro.myshopify.com',
          status: 'active' as const,
          last_sync: new Date().toISOString(),
          metrics: { revenue: 890000, orders: 2150 }
        },
        {
          id: 'store-3',
          shop_name: 'Home Essentials Plus',
          shop_domain: 'home-essentials-plus.myshopify.com',
          status: 'active' as const,
          last_sync: new Date().toISOString(),
          metrics: { revenue: 675000, orders: 1890 }
        },
        {
          id: 'store-4',
          shop_name: 'Beauty & Wellness Hub',
          shop_domain: 'beauty-wellness-hub.myshopify.com',
          status: 'trial' as const,
          last_sync: new Date().toISOString(),
          metrics: { revenue: 425000, orders: 2340 }
        }
      ];

      setStores(mockStores);
      
      // Auto-select stores if none selected
      if (selectedStores.length === 0) {
        setSelectedStores(mockStores.slice(0, 3).map(s => s.id));
      }

      // Mock aggregated data
      setAggregatedData({
        totalRevenue: 3240000,
        totalOrders: 10300,
        avgOrderValue: 314.56,
        conversionRate: 7.8,
        totalVisitors: 132000,
        revenueGrowth: 24.5,
        ordersGrowth: 19.2,
        topProducts: [
          { name: 'Premium Widget', revenue: 450000, orders: 1200 },
          { name: 'Smart Device X', revenue: 380000, orders: 950 },
          { name: 'Eco-Friendly Set', revenue: 320000, orders: 1100 }
        ],
        topMarkets: [
          { country: 'United States', revenue: 1620000, percentage: 50 },
          { country: 'Canada', revenue: 648000, percentage: 20 },
          { country: 'United Kingdom', revenue: 486000, percentage: 15 }
        ]
      });

      // Mock comparison data
      setComparisonData({
        performanceScores: selectedStores.map(storeId => {
          const store = mockStores.find(s => s.id === storeId);
          return {
            storeId,
            storeName: store?.shop_name || storeId,
            scores: {
              revenue: Math.round(70 + Math.random() * 30),
              conversion: Math.round(60 + Math.random() * 40),
              retention: Math.round(50 + Math.random() * 50),
              efficiency: Math.round(65 + Math.random() * 35),
              overall: Math.round(70 + Math.random() * 30)
            }
          };
        })
      });

      // Mock insights
      setInsights([
        {
          type: 'opportunity',
          title: 'Cross-selling potential identified',
          description: 'Products from Store A could perform well in Store B based on customer behavior',
          impact: 'High',
          stores: ['store-1', 'store-2']
        },
        {
          type: 'alert',
          title: 'Inventory imbalance detected',
          description: 'Store C has excess inventory while Store D is running low on similar items',
          impact: 'Medium',
          stores: ['store-3', 'store-4']
        },
        {
          type: 'trend',
          title: 'Seasonal trend emerging',
          description: 'All stores showing increased demand for summer products',
          impact: 'High',
          stores: selectedStores
        }
      ]);

      setLoading(false);
    } catch (err) {
      setError('Failed to load multi-store analytics');
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Store Analytics</h1>
          <p className="text-muted-foreground">
            Unified view across all your Shopify stores
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[300px]">
            <StoreSelector
              stores={stores}
              selectedStores={selectedStores}
              onStoreSelect={setSelectedStores}
              multiple={true}
              showMetrics={true}
            />
          </div>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadMultiStoreData} size="icon" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combined Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(aggregatedData?.totalRevenue || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(aggregatedData?.revenueGrowth || 0)}
              <span className="ml-1">
                {Math.abs(aggregatedData?.revenueGrowth || 0).toFixed(1)}% from last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(aggregatedData?.totalOrders || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(aggregatedData?.ordersGrowth || 0)}
              <span className="ml-1">
                {Math.abs(aggregatedData?.ordersGrowth || 0).toFixed(1)}% from last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedData?.conversionRate?.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              Across {selectedStores.length} stores
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedStores.length} / {stores.length}</div>
            <div className="text-xs text-muted-foreground">
              {stores.filter(s => s.status === 'active').length} fully active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Cross-Store Insights
            </CardTitle>
            <CardDescription>
              AI-powered recommendations and alerts across your stores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-muted/50"
                >
                  <div className="mt-1">
                    {insight.type === 'opportunity' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {insight.type === 'alert' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                    {insight.type === 'trend' && <TrendingUp className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="secondary">{insight.impact} Impact</Badge>
                      <span className="text-xs text-muted-foreground">
                        Affects {insight.stores.length} stores
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceMatrix
            stores={stores.filter(s => selectedStores.includes(s.id)).map(store => ({
              storeId: store.id,
              storeName: store.shop_name,
              shopDomain: store.shop_domain,
              status: store.status,
              metrics: {
                revenue: store.metrics.revenue,
                orders: store.metrics.orders,
                avgOrderValue: store.metrics.revenue / store.metrics.orders,
                conversionRate: 0.05 + Math.random() * 0.05,
                visitors: Math.round(store.metrics.orders / 0.075),
                returnRate: 0.15 + Math.random() * 0.1,
                cartAbandonmentRate: 0.65 + Math.random() * 0.1,
                customerLifetimeValue: (store.metrics.revenue / store.metrics.orders) * 3.5
              },
              trends: {
                revenue: -10 + Math.random() * 35,
                orders: -5 + Math.random() * 25,
                conversionRate: -2 + Math.random() * 8,
                visitors: -5 + Math.random() * 20
              },
              scores: {
                performance: Math.round(70 + Math.random() * 30),
                efficiency: Math.round(60 + Math.random() * 40),
                growth: Math.round(50 + Math.random() * 50),
                overall: Math.round(65 + Math.random() * 35)
              },
              alerts: []
            }))}
            onStoreClick={(storeId) => console.log('Store clicked:', storeId)}
            onExport={() => console.log('Export clicked')}
          />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <UnifiedCharts
              data={{
                storeComparison: comparisonData?.performanceScores || [],
                stores: stores.filter(s => selectedStores.includes(s.id))
              }}
              chartType="comparison"
              selectedStores={selectedStores}
            />
            <UnifiedCharts
              data={{
                timeSeriesData: generateMockTimeSeriesData(),
                stores: stores.filter(s => selectedStores.includes(s.id))
              }}
              chartType="revenue"
              timeframe="day"
              selectedStores={selectedStores}
            />
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Products Across Stores</CardTitle>
              <CardDescription>
                Best performing products from all selected stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aggregatedData?.topProducts?.map((product: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(product.orders)} orders
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(product.revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        {((product.revenue / aggregatedData.totalRevenue) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>
                Revenue breakdown by country across all stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aggregatedData?.topMarkets?.map((market: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{market.country}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(market.revenue)} ({market.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${market.percentage}%` }}
                      />
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

  function generateMockTimeSeriesData() {
    const days = 30;
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      const dayData: any = { date };
      
      selectedStores.forEach(storeId => {
        const store = stores.find(s => s.id === storeId);
        if (store) {
          dayData[`revenue_${storeId}`] = Math.floor(store.metrics.revenue / days * (0.8 + Math.random() * 0.4));
          dayData[`orders_${storeId}`] = Math.floor(store.metrics.orders / days * (0.8 + Math.random() * 0.4));
        }
      });
      
      data.push(dayData);
    }
    return data;
  }
}