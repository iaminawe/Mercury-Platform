'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Store, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  Target,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { format, subDays } from 'date-fns';

// Import analytics components
import { StoreSelector } from '@/components/analytics/store-selector';
import { UnifiedCharts } from '@/components/analytics/unified-charts';
import { PerformanceMatrix } from '@/components/analytics/performance-matrix';

interface CrossStoreMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalVisitors: number;
  avgOrderValue: number;
  avgConversionRate: number;
  storeCount: number;
  topPerformingStore: {
    storeId: string;
    storeName: string;
    revenue: number;
    orders: number;
  } | null;
  revenueGrowth: number;
  ordersGrowth: number;
}

interface StorePerformance {
  storeId: string;
  storeName: string;
  shopDomain: string;
  metrics: {
    revenue: number;
    orders: number;
    visitors: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  growth: {
    revenue: number;
    orders: number;
    visitors: number;
  };
}

interface CrossStoreAlert {
  type: 'opportunity' | 'warning' | 'critical';
  message: string;
  storeId?: string;
  storeName?: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export default function CrossStoreAnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  
  // Mock data - in production, this would come from your API
  const [metrics, setMetrics] = useState<CrossStoreMetrics | null>(null);
  const [storePerformances, setStorePerformances] = useState<StorePerformance[]>([]);
  const [alerts, setAlerts] = useState<CrossStoreAlert[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API integration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data
      const mockMetrics: CrossStoreMetrics = {
        totalRevenue: 2847500,
        totalOrders: 8945,
        totalVisitors: 125890,
        avgOrderValue: 318.42,
        avgConversionRate: 7.1,
        storeCount: 8,
        topPerformingStore: {
          storeId: 'store-1',
          storeName: 'Fashion Forward NYC',
          revenue: 1250000,
          orders: 3920
        },
        revenueGrowth: 23.5,
        ordersGrowth: 18.2
      };

      const mockStorePerformances: StorePerformance[] = [
        {
          storeId: 'store-1',
          storeName: 'Fashion Forward NYC',
          shopDomain: 'fashion-forward-nyc.myshopify.com',
          metrics: {
            revenue: 1250000,
            orders: 3920,
            visitors: 45200,
            avgOrderValue: 318.88,
            conversionRate: 8.7
          },
          growth: {
            revenue: 28.5,
            orders: 22.1,
            visitors: 15.3
          }
        },
        {
          storeId: 'store-2',
          storeName: 'Tech Gadgets Pro',
          shopDomain: 'tech-gadgets-pro.myshopify.com',
          metrics: {
            revenue: 890000,
            orders: 2145,
            visitors: 32100,
            avgOrderValue: 414.92,
            conversionRate: 6.7
          },
          growth: {
            revenue: 31.2,
            orders: 25.8,
            visitors: 18.9
          }
        },
        {
          storeId: 'store-3',
          storeName: 'Home & Garden Plus',
          shopDomain: 'home-garden-plus.myshopify.com',
          metrics: {
            revenue: 445000,
            orders: 1876,
            visitors: 28500,
            avgOrderValue: 237.29,
            conversionRate: 6.6
          },
          growth: {
            revenue: 12.8,
            orders: 8.9,
            visitors: 7.2
          }
        },
        {
          storeId: 'store-4',
          storeName: 'Beauty Essentials',
          shopDomain: 'beauty-essentials.myshopify.com',
          metrics: {
            revenue: 262500,
            orders: 1004,
            visitors: 20090,
            avgOrderValue: 261.55,
            conversionRate: 5.0
          },
          growth: {
            revenue: -5.2,
            orders: -8.1,
            visitors: 3.2
          }
        }
      ];

      const mockAlerts: CrossStoreAlert[] = [
        {
          type: 'opportunity',
          message: 'Tech Gadgets Pro showing 31% revenue growth',
          storeId: 'store-2',
          storeName: 'Tech Gadgets Pro',
          action: 'Scale successful campaigns and expand product lines',
          priority: 'high'
        },
        {
          type: 'warning',
          message: 'Beauty Essentials revenue declined 5.2%',
          storeId: 'store-4',
          storeName: 'Beauty Essentials',
          action: 'Investigate conversion issues and review marketing strategy',
          priority: 'high'
        },
        {
          type: 'opportunity',
          message: 'Cross-store AOV increased 12% overall',
          action: 'Implement successful upselling strategies across all stores',
          priority: 'medium'
        }
      ];

      setMetrics(mockMetrics);
      setStorePerformances(mockStorePerformances);
      setAlerts(mockAlerts);
      
      // Set all stores for the selector
      setAllStores(mockStorePerformances.map(store => ({
        id: store.storeId,
        shop_name: store.storeName,
        shop_domain: store.shopDomain,
        status: 'active' as const,
        last_sync: new Date().toISOString(),
        metrics: {
          revenue: store.metrics.revenue,
          orders: store.metrics.orders
        }
      })));
      
      // Auto-select first 3 stores
      setSelectedStores(mockStorePerformances.slice(0, 3).map(s => s.storeId));
    } catch (err) {
      setError('Failed to load analytics data. Please try again.');
      console.error('Analytics loading error:', err);
    } finally {
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
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getAlertColor = (type: CrossStoreAlert['type']) => {
    switch (type) {
      case 'opportunity':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'critical':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross-Store Analytics</h1>
          <p className="text-muted-foreground">
            Unified analytics across all your Shopify stores
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          
          {selectedTimeframe === 'custom' && (
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
            />
          )}
          
          <Button onClick={loadAnalyticsData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(metrics.revenueGrowth)}
                <span className={`ml-1 ${getTrendColor(metrics.revenueGrowth)}`}>
                  {Math.abs(metrics.revenueGrowth).toFixed(1)}% from last period
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
              <div className="text-2xl font-bold">{formatNumber(metrics.totalOrders)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(metrics.ordersGrowth)}
                <span className={`ml-1 ${getTrendColor(metrics.ordersGrowth)}`}>
                  {Math.abs(metrics.ordersGrowth).toFixed(1)}% from last period
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.avgOrderValue)}</div>
              <div className="text-xs text-muted-foreground">
                Across {metrics.storeCount} active stores
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgConversionRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                {formatNumber(metrics.totalVisitors)} total visitors
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Top Performing Store Highlight */}
      {metrics?.topPerformingStore && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Store className="mr-2 h-5 w-5 text-green-600" />
              Top Performing Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{metrics.topPerformingStore.storeName}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.topPerformingStore.revenue)} revenue • {formatNumber(metrics.topPerformingStore.orders)} orders
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {((metrics.topPerformingStore.revenue / metrics.totalRevenue) * 100).toFixed(1)}% of total revenue
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Insights & Alerts
            </CardTitle>
            <CardDescription>
              Key findings and recommended actions across your stores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Badge 
                        variant={alert.type === 'opportunity' ? 'default' : 'destructive'}
                        className="mr-2"
                      >
                        {alert.type === 'opportunity' ? 'Opportunity' : 
                         alert.type === 'warning' ? 'Warning' : 'Critical'}
                      </Badge>
                      {alert.storeName && (
                        <span className="text-sm font-medium">{alert.storeName}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{alert.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Recommended action:</strong> {alert.action}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-4">
                    {alert.priority} priority
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Store Performance</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="consolidated">Consolidated Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Store Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Store Performance Summary</CardTitle>
              <CardDescription>
                Revenue and growth metrics for all active stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {storePerformances.map((store) => (
                    <div key={store.storeId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Store className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{store.storeName}</h3>
                          <p className="text-sm text-muted-foreground">{store.shopDomain}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(store.metrics.revenue)}</p>
                          <div className="flex items-center text-sm">
                            {getTrendIcon(store.growth.revenue)}
                            <span className={`ml-1 ${getTrendColor(store.growth.revenue)}`}>
                              {Math.abs(store.growth.revenue).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold">{formatNumber(store.metrics.orders)}</p>
                          <p className="text-sm text-muted-foreground">orders</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold">{store.metrics.conversionRate.toFixed(1)}%</p>
                          <p className="text-sm text-muted-foreground">conversion</p>
                        </div>
                        
                        <Button variant="outline" size="sm">
                          View Details
                          <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Store Performance Matrix</h3>
              <div className="w-[300px]">
                <StoreSelector
                  stores={allStores}
                  selectedStores={selectedStores}
                  onStoreSelect={setSelectedStores}
                  multiple={true}
                  showMetrics={true}
                />
              </div>
            </div>
            <PerformanceMatrix
              stores={storePerformances.map(store => ({
                storeId: store.storeId,
                storeName: store.storeName,
                shopDomain: store.shopDomain,
                status: 'active' as const,
                metrics: {
                  ...store.metrics,
                  returnRate: 0.05,
                  cartAbandonmentRate: 0.68,
                  customerLifetimeValue: store.metrics.avgOrderValue * 3.5
                },
                trends: store.growth,
                scores: {
                  performance: Math.round(80 + Math.random() * 20),
                  efficiency: Math.round(70 + Math.random() * 30),
                  growth: Math.round(60 + Math.random() * 40),
                  overall: Math.round(75 + Math.random() * 25)
                },
                alerts: []
              }))}
              onStoreClick={(storeId) => console.log('Store clicked:', storeId)}
            />
          </div>
        </TabsContent>

        <TabsContent value="geographic">
          <div className="space-y-4">
            <UnifiedCharts
              data={{
                timeSeriesData: generateTimeSeriesData(),
                stores: storePerformances,
                growth: metrics ? { revenue: metrics.revenueGrowth } : undefined
              }}
              chartType="geographic"
              timeframe="day"
              selectedStores={selectedStores.length > 0 ? selectedStores : storePerformances.slice(0, 3).map(s => s.storeId)}
            />
          </div>
        </TabsContent>

        <TabsContent value="consolidated">
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <UnifiedCharts
                data={{
                  timeSeriesData: generateTimeSeriesData(),
                  stores: storePerformances,
                  growth: metrics ? { revenue: metrics.revenueGrowth } : undefined
                }}
                chartType="revenue"
                timeframe="day"
                selectedStores={selectedStores.length > 0 ? selectedStores : storePerformances.slice(0, 3).map(s => s.storeId)}
              />
              <UnifiedCharts
                data={{
                  conversionData: generateConversionData(),
                  stores: storePerformances,
                  avgConversionRate: metrics?.avgConversionRate || 0
                }}
                chartType="conversion"
                timeframe="day"
                selectedStores={selectedStores.length > 0 ? selectedStores : storePerformances.slice(0, 3).map(s => s.storeId)}
              />
            </div>
            <UnifiedCharts
              data={{
                storeComparison: generateComparisonData(),
                treemapData: generateTreemapData(),
                pieData: generatePieData(),
                stores: storePerformances
              }}
              chartType="comparison"
              selectedStores={selectedStores.length > 0 ? selectedStores : storePerformances.slice(0, 3).map(s => s.storeId)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  // Helper functions for generating chart data
  function generateTimeSeriesData() {
    const days = 30;
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      const dayData: any = { date };
      
      storePerformances.forEach(store => {
        dayData[`revenue_${store.storeId}`] = Math.floor(store.metrics.revenue / days * (0.8 + Math.random() * 0.4));
        dayData[`orders_${store.storeId}`] = Math.floor(store.metrics.orders / days * (0.8 + Math.random() * 0.4));
      });
      
      data.push(dayData);
    }
    return data;
  }

  function generateConversionData() {
    const days = 30;
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      const dayData: any = { date };
      
      storePerformances.forEach(store => {
        dayData[`conversionRate_${store.storeId}`] = store.metrics.conversionRate * (0.9 + Math.random() * 0.2);
      });
      
      data.push(dayData);
    }
    return data;
  }

  function generateComparisonData() {
    const metrics = ['Revenue', 'Orders', 'Conversion', 'AOV', 'Traffic'];
    return metrics.map(metric => {
      const dataPoint: any = { metric };
      storePerformances.forEach(store => {
        dataPoint[store.storeId] = Math.floor(60 + Math.random() * 40);
      });
      return dataPoint;
    });
  }

  function generateTreemapData() {
    return storePerformances.map(store => ({
      name: store.storeName,
      value: store.metrics.revenue,
      orders: store.metrics.orders
    }));
  }

  function generatePieData() {
    return storePerformances.map(store => ({
      name: store.storeName,
      value: store.metrics.revenue
    }));
  }
}