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
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  Activity,
  Globe,
  Zap,
  Brain,
  AlertTriangle,
  CheckCircle,
  Info,
  Filter,
  Download,
  RefreshCw,
  Eye
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { StoreSelector } from '@/components/analytics/store-selector';
import { UnifiedCharts } from '@/components/analytics/unified-charts';
import { PerformanceMatrix } from '@/components/analytics/performance-matrix';

export default function UnifiedAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('30d');
  const [viewMode, setViewMode] = useState('unified');
  
  const [stores, setStores] = useState<any[]>([]);
  const [unifiedMetrics, setUnifiedMetrics] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    loadUnifiedData();
  }, [selectedStores, timeframe]);

  const loadUnifiedData = async () => {
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock stores data
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
        },
        {
          id: 'store-5',
          shop_name: 'Sports & Outdoors Co',
          shop_domain: 'sports-outdoors-co.myshopify.com',
          status: 'active' as const,
          last_sync: new Date().toISOString(),
          metrics: { revenue: 780000, orders: 1560 }
        }
      ];

      setStores(mockStores);

      if (selectedStores.length === 0) {
        setSelectedStores(mockStores.slice(0, 4).map(s => s.id));
      }

      // Mock unified metrics
      setUnifiedMetrics({
        totalRevenue: 4020000,
        totalOrders: 11860,
        totalVisitors: 158600,
        avgOrderValue: 339.05,
        conversionRate: 7.47,
        customerAcquisitionCost: 45.60,
        customerLifetimeValue: 1187.40,
        returnCustomerRate: 0.34,
        avgOrderProcessingTime: 2.4,
        inventoryTurnover: 8.2,
        growthMetrics: {
          revenue: 26.8,
          orders: 21.4,
          visitors: 18.9,
          conversion: 2.1
        },
        efficiency: {
          costPerAcquisition: 45.60,
          returnOnAdSpend: 4.2,
          inventoryEfficiency: 92.5,
          fulfillmentSpeed: 1.8
        }
      });

      // Mock AI insights
      setInsights([
        {
          type: 'opportunity',
          priority: 'high',
          title: 'Cross-store inventory optimization opportunity',
          description: 'Store A has 340% higher demand for Product X than Store B. Consider redistributing inventory.',
          impact: '+$42K potential revenue increase',
          confidence: 94,
          stores: ['store-1', 'store-2'],
          action: 'Redistribute inventory'
        },
        {
          type: 'trend',
          priority: 'medium',
          title: 'Emerging customer behavior pattern',
          description: 'Mobile checkout completion rates increasing 15% across all stores in the past 7 days.',
          impact: '+2.3% conversion rate improvement',
          confidence: 87,
          stores: selectedStores,
          action: 'Optimize mobile experience'
        },
        {
          type: 'alert',
          priority: 'high',
          title: 'Anomaly in conversion rates detected',
          description: 'Store C showing 23% drop in conversion rate compared to 30-day average.',
          impact: '-$18K weekly revenue impact',
          confidence: 96,
          stores: ['store-3'],
          action: 'Investigate checkout flow'
        }
      ]);

      // Mock predictions
      setPredictions([
        {
          metric: 'Revenue',
          current: 4020000,
          predicted: 4680000,
          change: 16.4,
          timeframe: 'Next 30 days',
          confidence: 89
        },
        {
          metric: 'Orders',
          current: 11860,
          predicted: 13750,
          change: 15.9,
          timeframe: 'Next 30 days',
          confidence: 92
        },
        {
          metric: 'Conversion Rate',
          current: 7.47,
          predicted: 8.12,
          change: 8.7,
          timeframe: 'Next 30 days',
          confidence: 78
        }
      ]);

      // Mock anomalies
      setAnomalies([
        {
          type: 'revenue',
          severity: 'medium',
          store: 'Fashion Forward NYC',
          description: '15% revenue spike on weekends vs weekdays',
          detected: '2 hours ago',
          status: 'investigating'
        },
        {
          type: 'inventory',
          severity: 'high',
          store: 'Tech Gadgets Pro',
          description: 'Stock levels critically low for top 3 products',
          detected: '4 hours ago',
          status: 'action_required'
        }
      ]);

      setLoading(false);
    } catch (error) {
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

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'trend':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unified Analytics</h1>
          <p className="text-muted-foreground">
            AI-powered insights across all your stores
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
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unified">Unified View</SelectItem>
              <SelectItem value="comparative">Comparative</SelectItem>
              <SelectItem value="predictive">Predictive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadUnifiedData} size="icon" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Unified KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(unifiedMetrics?.totalRevenue || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(unifiedMetrics?.growthMetrics?.revenue || 0)}
              <span className="ml-1">
                {Math.abs(unifiedMetrics?.growthMetrics?.revenue || 0).toFixed(1)}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(unifiedMetrics?.customerLifetimeValue || 0)}</div>
            <div className="text-xs text-muted-foreground">
              CAC: {formatCurrency(unifiedMetrics?.customerAcquisitionCost || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unifiedMetrics?.conversionRate?.toFixed(2)}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(unifiedMetrics?.growthMetrics?.conversion || 0)}
              <span className="ml-1">
                {Math.abs(unifiedMetrics?.growthMetrics?.conversion || 0).toFixed(1)}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unifiedMetrics?.efficiency?.inventoryEfficiency?.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              ROAS: {unifiedMetrics?.efficiency?.returnOnAdSpend?.toFixed(1)}x
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>AI-Powered Insights</CardTitle>
            </div>
            <Badge variant="secondary">Live Analysis</Badge>
          </div>
          <CardDescription>
            Real-time insights and recommendations powered by machine learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getPriorityColor(insight.priority)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <Badge variant={insight.priority === 'high' ? 'destructive' : 'secondary'}>
                        {insight.priority}
                      </Badge>
                      <Badge variant="outline">
                        {insight.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-600">{insight.impact}</span>
                      <Button variant="outline" size="sm">
                        {insight.action}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Predictions & Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Predictions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle>Predictive Analytics</CardTitle>
            </div>
            <CardDescription>
              AI-powered forecasts for the next 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {predictions.map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{prediction.metric}</p>
                    <p className="text-sm text-muted-foreground">{prediction.timeframe}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(prediction.change)}
                      <span className="font-medium">
                        {prediction.change > 0 ? '+' : ''}{prediction.change.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {prediction.confidence}% confidence
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Anomaly Detection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <CardTitle>Anomaly Detection</CardTitle>
            </div>
            <CardDescription>
              Unusual patterns detected across your stores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {anomalies.length > 0 ? (
                anomalies.map((anomaly, index) => (
                  <div key={index} className="flex items-start gap-4 p-3 rounded-lg border">
                    <AlertTriangle className={`h-5 w-5 mt-1 ${
                      anomaly.severity === 'high' ? 'text-red-500' : 'text-orange-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{anomaly.store}</p>
                        <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                          {anomaly.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{anomaly.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Detected {anomaly.detected} • {anomaly.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No anomalies detected</p>
                  <p className="text-sm">All systems operating normally</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Charts */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <UnifiedCharts
            data={{
              timeSeriesData: generateTimeSeriesData(),
              stores: stores.filter(s => selectedStores.includes(s.id)),
              growth: unifiedMetrics?.growthMetrics
            }}
            chartType="revenue"
            timeframe="day"
            selectedStores={selectedStores}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <UnifiedCharts
              data={{
                conversionData: generateConversionData(),
                stores: stores.filter(s => selectedStores.includes(s.id)),
                avgConversionRate: unifiedMetrics?.conversionRate
              }}
              chartType="conversion"
              timeframe="day"
              selectedStores={selectedStores}
            />
            <UnifiedCharts
              data={{
                timeSeriesData: generateOrdersData(),
                stores: stores.filter(s => selectedStores.includes(s.id))
              }}
              chartType="orders"
              timeframe="day"
              selectedStores={selectedStores}
            />
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <UnifiedCharts
            data={{
              storeComparison: generateComparisonData(),
              treemapData: generateTreemapData(),
              pieData: generatePieData(),
              stores: stores.filter(s => selectedStores.includes(s.id))
            }}
            chartType="comparison"
            selectedStores={selectedStores}
          />
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
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
          />
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
      
      selectedStores.forEach(storeId => {
        const store = stores.find(s => s.id === storeId);
        if (store) {
          dayData[`revenue_${storeId}`] = Math.floor(store.metrics.revenue / days * (0.8 + Math.random() * 0.4));
        }
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
      
      selectedStores.forEach(storeId => {
        dayData[`conversionRate_${storeId}`] = 0.05 + Math.random() * 0.05;
      });
      
      data.push(dayData);
    }
    return data;
  }

  function generateOrdersData() {
    const days = 30;
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      const dayData: any = { date };
      
      selectedStores.forEach(storeId => {
        const store = stores.find(s => s.id === storeId);
        if (store) {
          dayData[`orders_${storeId}`] = Math.floor(store.metrics.orders / days * (0.8 + Math.random() * 0.4));
        }
      });
      
      data.push(dayData);
    }
    return data;
  }

  function generateComparisonData() {
    const metrics = ['Revenue', 'Orders', 'Conversion', 'AOV', 'Traffic'];
    return metrics.map(metric => {
      const dataPoint: any = { metric };
      selectedStores.forEach(storeId => {
        dataPoint[storeId] = Math.floor(60 + Math.random() * 40);
      });
      return dataPoint;
    });
  }

  function generateTreemapData() {
    return stores.filter(s => selectedStores.includes(s.id)).map(store => ({
      name: store.shop_name,
      value: store.metrics.revenue
    }));
  }

  function generatePieData() {
    return stores.filter(s => selectedStores.includes(s.id)).map(store => ({
      name: store.shop_name,
      value: store.metrics.revenue
    }));
  }
}