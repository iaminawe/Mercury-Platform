'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  BarChart3,
  LineChart,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { StoreSelector } from '@/components/analytics/store-selector';
import { UnifiedCharts } from '@/components/analytics/unified-charts';

interface TrendPoint {
  date: string;
  value: number;
  change?: number;
}

interface TrendAnalysis {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  significance: 'high' | 'medium' | 'low';
  description: string;
  forecast: TrendPoint[];
}

export default function TrendsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('30d');
  const [trendType, setTrendType] = useState('revenue');
  
  const [stores, setStores] = useState<any[]>([]);
  const [trendAnalyses, setTrendAnalyses] = useState<TrendAnalysis[]>([]);
  const [seasonalTrends, setSeasonalTrends] = useState<any[]>([]);
  const [emergingTrends, setEmergingTrends] = useState<any[]>([]);
  const [trendAlerts, setTrendAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadTrendsData();
  }, [selectedStores, timeframe, trendType]);

  const loadTrendsData = async () => {
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
        }
      ];

      setStores(mockStores);

      if (selectedStores.length === 0) {
        setSelectedStores(mockStores.slice(0, 3).map(s => s.id));
      }

      // Mock trend analyses
      setTrendAnalyses([
        {
          metric: 'Revenue',
          trend: 'up',
          changePercent: 24.5,
          significance: 'high',
          description: 'Strong upward trend driven by increased AOV and conversion rates',
          forecast: generateForecastData(1250000, 0.245)
        },
        {
          metric: 'Orders',
          trend: 'up',
          changePercent: 18.2,
          significance: 'high',
          description: 'Consistent growth in order volume across all selected stores',
          forecast: generateForecastData(3920, 0.182)
        },
        {
          metric: 'Conversion Rate',
          trend: 'up',
          changePercent: 12.8,
          significance: 'medium',
          description: 'Gradual improvement in conversion rates, likely due to UX optimizations',
          forecast: generateForecastData(7.5, 0.128)
        },
        {
          metric: 'Customer Acquisition Cost',
          trend: 'down',
          changePercent: -8.4,
          significance: 'medium',
          description: 'Improved efficiency in marketing spend and organic growth',
          forecast: generateForecastData(45.6, -0.084)
        }
      ]);

      // Mock seasonal trends
      setSeasonalTrends([
        {
          period: 'Weekly Pattern',
          description: 'Peak sales on weekends, 35% higher than weekday average',
          impact: 'High',
          data: generateWeeklyPattern()
        },
        {
          period: 'Monthly Cycle',
          description: 'End-of-month sales spike, 28% increase in last week',
          impact: 'Medium',
          data: generateMonthlyPattern()
        },
        {
          period: 'Seasonal Trend',
          description: 'Summer season showing 40% increase over spring baseline',
          impact: 'High',
          data: generateSeasonalPattern()
        }
      ]);

      // Mock emerging trends
      setEmergingTrends([
        {
          title: 'Mobile Commerce Surge',
          description: 'Mobile traffic converting 23% better than desktop in the past 14 days',
          confidence: 92,
          timeline: '2 weeks',
          impact: '+$45K potential monthly revenue',
          category: 'Customer Behavior'
        },
        {
          title: 'Product Category Shift',
          description: 'Electronics category showing unusual 67% growth compared to fashion',
          confidence: 87,
          timeline: '3 weeks',
          impact: 'Inventory rebalancing needed',
          category: 'Product Performance'
        },
        {
          title: 'Geographic Expansion Opportunity',
          description: 'Organic traffic from Canada up 156% with high engagement rates',
          confidence: 78,
          timeline: '1 month',
          impact: 'New market opportunity',
          category: 'Market Expansion'
        }
      ]);

      // Mock trend alerts
      setTrendAlerts([
        {
          type: 'acceleration',
          severity: 'high',
          metric: 'Revenue Growth',
          description: 'Revenue growth rate accelerating beyond normal parameters',
          recommendation: 'Scale marketing efforts and ensure inventory levels can support growth',
          detected: '2 hours ago'
        },
        {
          type: 'deceleration',
          severity: 'medium',
          metric: 'Customer Retention',
          description: 'Slight deceleration in customer retention rate trend',
          recommendation: 'Review customer experience and implement retention campaigns',
          detected: '1 day ago'
        },
        {
          type: 'reversal',
          severity: 'low',
          metric: 'Cart Abandonment',
          description: 'Cart abandonment trend showing positive reversal',
          recommendation: 'Continue current checkout optimization strategies',
          detected: '3 days ago'
        }
      ]);

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const generateForecastData = (baseValue: number, growthRate: number): TrendPoint[] => {
    const days = 30;
    const data: TrendPoint[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      const dailyGrowth = growthRate / days;
      const value = baseValue * (1 + dailyGrowth * i) * (0.9 + Math.random() * 0.2);
      data.push({
        date,
        value: Math.round(value),
        change: i > 0 ? ((value - data[i-1].value) / data[i-1].value) * 100 : 0
      });
    }
    
    return data;
  };

  const generateWeeklyPattern = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, index) => ({
      day,
      value: index < 5 ? 70 + Math.random() * 20 : 90 + Math.random() * 20,
      isWeekend: index >= 5
    }));
  };

  const generateMonthlyPattern = () => {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return weeks.map((week, index) => ({
      week,
      value: 80 + (index * 5) + Math.random() * 10
    }));
  };

  const generateSeasonalPattern = () => {
    const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
    return seasons.map((season, index) => ({
      season,
      value: 60 + (index === 1 ? 40 : index * 10) + Math.random() * 15
    }));
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'acceleration':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'deceleration':
        return <TrendingDown className="h-5 w-5 text-orange-500" />;
      case 'reversal':
        return <Activity className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
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
          <h1 className="text-3xl font-bold tracking-tight">Trend Analysis</h1>
          <p className="text-muted-foreground">
            Advanced trend detection and forecasting across your stores
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
          <Select value={trendType} onValueChange={setTrendType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="conversion">Conversion</SelectItem>
              <SelectItem value="traffic">Traffic</SelectItem>
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
          <Button onClick={loadTrendsData} size="icon" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Trend Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {trendAnalyses.map((analysis, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{analysis.metric}</CardTitle>
              {getTrendIcon(analysis.trend)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analysis.trend === 'up' ? '+' : analysis.trend === 'down' ? '-' : ''}
                {Math.abs(analysis.changePercent).toFixed(1)}%
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getSignificanceColor(analysis.significance)}`}
                >
                  {analysis.significance} significance
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Trend Alerts</CardTitle>
            </div>
            <Badge variant="secondary">{trendAlerts.length} active</Badge>
          </div>
          <CardDescription>
            Real-time trend monitoring and anomaly detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trendAlerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg border">
                <div className="mt-1">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{alert.metric}</h4>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                  <p className="text-sm mb-2">{alert.recommendation}</p>
                  <p className="text-xs text-muted-foreground">Detected {alert.detected}</p>
                </div>
                <Button variant="outline" size="sm">
                  View Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emerging Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>Emerging Trends</CardTitle>
          </div>
          <CardDescription>
            AI-detected patterns and opportunities in your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {emergingTrends.map((trend, index) => (
              <div key={index} className="p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{trend.title}</h4>
                  <Badge variant="outline">{trend.confidence}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{trend.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{trend.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Timeline:</span>
                    <span>{trend.timeline}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impact:</span>
                    <span className="font-medium text-green-600">{trend.impact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend Analysis Tabs */}
      <Tabs defaultValue="forecasts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="comparative">Comparative</TabsTrigger>
        </TabsList>

        <TabsContent value="forecasts" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {trendAnalyses.slice(0, 2).map((analysis, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    {analysis.metric} Forecast
                  </CardTitle>
                  <CardDescription>{analysis.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <UnifiedCharts
                    data={{
                      timeSeriesData: analysis.forecast.map(point => ({
                        date: point.date,
                        [`${analysis.metric.toLowerCase()}_forecast`]: point.value
                      })),
                      stores: stores.filter(s => selectedStores.includes(s.id))
                    }}
                    chartType="revenue"
                    timeframe="day"
                    selectedStores={['forecast']}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {seasonalTrends.map((seasonal, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {seasonal.period}
                  </CardTitle>
                  <CardDescription>{seasonal.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Impact Level:</span>
                      <Badge variant={seasonal.impact === 'High' ? 'destructive' : 'secondary'}>
                        {seasonal.impact}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {seasonal.data.map((point: any, pointIndex: number) => (
                        <div key={pointIndex} className="flex items-center justify-between">
                          <span className="text-sm">
                            {point.day || point.week || point.season}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${(point.value / 120) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12">
                              {point.value.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <UnifiedCharts
            data={{
              timeSeriesData: generateTimeSeriesData(),
              stores: stores.filter(s => selectedStores.includes(s.id)),
              growth: { revenue: 24.5 }
            }}
            chartType="revenue"
            timeframe="day"
            selectedStores={selectedStores}
          />
        </TabsContent>

        <TabsContent value="comparative" className="space-y-4">
          <UnifiedCharts
            data={{
              storeComparison: generateComparisonData(),
              stores: stores.filter(s => selectedStores.includes(s.id))
            }}
            chartType="comparison"
            selectedStores={selectedStores}
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

  function generateComparisonData() {
    const metrics = ['Revenue Trend', 'Order Trend', 'Conversion Trend', 'Traffic Trend'];
    return metrics.map(metric => {
      const dataPoint: any = { metric };
      selectedStores.forEach(storeId => {
        dataPoint[storeId] = Math.floor(60 + Math.random() * 40);
      });
      return dataPoint;
    });
  }
}