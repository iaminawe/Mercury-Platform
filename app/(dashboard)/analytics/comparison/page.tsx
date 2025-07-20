'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Store, 
  Target,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  Award,
  TrendingUp as Growth,
  Zap,
  Users,
  DollarSign,
  ShoppingCart,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface StoreComparison {
  storeId: string;
  storeName: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: string[];
  metrics: {
    revenue: ComparisonRank;
    orders: ComparisonRank;
    avgOrderValue: ComparisonRank;
    conversionRate: ComparisonRank;
    trafficVolume: ComparisonRank;
    customerRetention: ComparisonRank;
  };
  peerGroup: {
    similar: string[];
    competitors: string[];
    benchmarks: Record<string, number>;
  };
}

interface ComparisonRank {
  value: number;
  rank: number;
  percentile: number;
  vsAverage: number;
  trend: 'improving' | 'declining' | 'stable';
  confidence: number;
}

interface BenchmarkMetric {
  metricName: string;
  metricKey: string;
  unit: 'currency' | 'number' | 'percentage';
  average: number;
  median: number;
  topPerformer: {
    storeId: string;
    storeName: string;
    value: number;
  };
  bottomPerformer: {
    storeId: string;
    storeName: string;
    value: number;
  };
}

interface CrossStoreInsights {
  cannibalizationAnalysis: {
    potentialCannibalization: Array<{
      store1: string;
      store2: string;
      overlapScore: number;
      impactAssessment: 'high' | 'medium' | 'low';
    }>;
    recommendations: string[];
  };
  synergies: {
    crossSellingOpportunities: Array<{
      sourceStore: string;
      targetStore: string;
      potentialRevenue: number;
      customerSegment: string;
    }>;
  };
}

export default function StoreComparisonPage() {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<'performance' | 'benchmarks' | 'opportunities'>('performance');
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data
  const [comparisons, setComparisons] = useState<StoreComparison[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkMetric[]>([]);
  const [insights, setInsights] = useState<CrossStoreInsights | null>(null);
  const [allStores] = useState([
    { id: 'store-1', name: 'Fashion Forward NYC' },
    { id: 'store-2', name: 'Tech Gadgets Pro' },
    { id: 'store-3', name: 'Home & Garden Plus' },
    { id: 'store-4', name: 'Beauty Essentials' },
    { id: 'store-5', name: 'Sports & Outdoor' },
    { id: 'store-6', name: 'Books & Media' },
  ]);

  useEffect(() => {
    loadComparisonData();
  }, [selectedStores, comparisonType, timeframe]);

  const loadComparisonData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock comparison data
      const mockComparisons: StoreComparison[] = [
        {
          storeId: 'store-1',
          storeName: 'Fashion Forward NYC',
          overallScore: 87,
          strengths: ['High conversion rate', 'Strong brand recognition', 'Excellent customer service'],
          weaknesses: ['Limited product range', 'High shipping costs'],
          opportunities: ['Expand to new categories', 'International shipping', 'Mobile optimization'],
          recommendations: ['Launch premium product line', 'Optimize mobile experience', 'Expand social media presence'],
          metrics: {
            revenue: { value: 1250000, rank: 1, percentile: 95, vsAverage: 45.2, trend: 'improving', confidence: 0.92 },
            orders: { value: 3920, rank: 1, percentile: 90, vsAverage: 38.5, trend: 'improving', confidence: 0.88 },
            avgOrderValue: { value: 318.88, rank: 2, percentile: 85, vsAverage: 12.3, trend: 'stable', confidence: 0.85 },
            conversionRate: { value: 8.7, rank: 1, percentile: 95, vsAverage: 52.6, trend: 'improving', confidence: 0.94 },
            trafficVolume: { value: 45200, rank: 2, percentile: 80, vsAverage: 25.4, trend: 'improving', confidence: 0.81 },
            customerRetention: { value: 78, rank: 1, percentile: 90, vsAverage: 34.2, trend: 'stable', confidence: 0.76 }
          },
          peerGroup: {
            similar: ['Tech Gadgets Pro', 'Beauty Essentials'],
            competitors: ['Home & Garden Plus', 'Sports & Outdoor'],
            benchmarks: { avgRevenue: 850000, avgConversion: 5.7, avgAOV: 284.50 }
          }
        },
        {
          storeId: 'store-2',
          storeName: 'Tech Gadgets Pro',
          overallScore: 82,
          strengths: ['High AOV', 'Tech-savvy customers', 'Premium positioning'],
          weaknesses: ['Lower conversion rate', 'Seasonal fluctuations'],
          opportunities: ['B2B market', 'Subscription services', 'Educational partnerships'],
          recommendations: ['Improve product discovery', 'Launch corporate sales program', 'Optimize checkout flow'],
          metrics: {
            revenue: { value: 890000, rank: 2, percentile: 85, vsAverage: 32.1, trend: 'improving', confidence: 0.89 },
            orders: { value: 2145, rank: 3, percentile: 70, vsAverage: 15.8, trend: 'improving', confidence: 0.83 },
            avgOrderValue: { value: 414.92, rank: 1, percentile: 95, vsAverage: 68.5, trend: 'improving', confidence: 0.91 },
            conversionRate: { value: 6.7, rank: 3, percentile: 70, vsAverage: 17.5, trend: 'stable', confidence: 0.78 },
            trafficVolume: { value: 32100, rank: 3, percentile: 65, vsAverage: 8.2, trend: 'improving', confidence: 0.82 },
            customerRetention: { value: 72, rank: 2, percentile: 80, vsAverage: 24.1, trend: 'improving', confidence: 0.74 }
          },
          peerGroup: {
            similar: ['Fashion Forward NYC', 'Home & Garden Plus'],
            competitors: ['Beauty Essentials', 'Sports & Outdoor'],
            benchmarks: { avgRevenue: 675000, avgConversion: 5.7, avgAOV: 284.50 }
          }
        },
        {
          storeId: 'store-3',
          storeName: 'Home & Garden Plus',
          overallScore: 71,
          strengths: ['Steady growth', 'Good customer satisfaction', 'Wide product range'],
          weaknesses: ['Below-average AOV', 'Limited brand awareness'],
          opportunities: ['Seasonal promotions', 'DIY content marketing', 'Local partnerships'],
          recommendations: ['Bundle complementary products', 'Create how-to content', 'Launch loyalty program'],
          metrics: {
            revenue: { value: 445000, rank: 4, percentile: 60, vsAverage: -12.3, trend: 'stable', confidence: 0.75 },
            orders: { value: 1876, rank: 4, percentile: 55, vsAverage: -8.9, trend: 'stable', confidence: 0.72 },
            avgOrderValue: { value: 237.29, rank: 4, percentile: 45, vsAverage: -18.7, trend: 'declining', confidence: 0.68 },
            conversionRate: { value: 6.6, rank: 4, percentile: 65, vsAverage: 15.8, trend: 'stable', confidence: 0.71 },
            trafficVolume: { value: 28500, rank: 4, percentile: 50, vsAverage: -3.2, trend: 'stable', confidence: 0.69 },
            customerRetention: { value: 68, rank: 3, percentile: 70, vsAverage: 17.2, trend: 'stable', confidence: 0.66 }
          },
          peerGroup: {
            similar: ['Beauty Essentials', 'Books & Media'],
            competitors: ['Fashion Forward NYC', 'Sports & Outdoor'],
            benchmarks: { avgRevenue: 508000, avgConversion: 5.7, avgAOV: 284.50 }
          }
        },
        {
          storeId: 'store-4',
          storeName: 'Beauty Essentials',
          overallScore: 64,
          strengths: ['Strong social media presence', 'Loyal customer base'],
          weaknesses: ['Declining revenue', 'High cart abandonment', 'Limited product discovery'],
          opportunities: ['Influencer partnerships', 'Subscription boxes', 'Personalization'],
          recommendations: ['Optimize product recommendations', 'Reduce cart abandonment', 'Launch referral program'],
          metrics: {
            revenue: { value: 262500, rank: 5, percentile: 35, vsAverage: -32.8, trend: 'declining', confidence: 0.84 },
            orders: { value: 1004, rank: 5, percentile: 30, vsAverage: -28.5, trend: 'declining', confidence: 0.81 },
            avgOrderValue: { value: 261.55, rank: 3, percentile: 55, vsAverage: -8.1, trend: 'stable', confidence: 0.73 },
            conversionRate: { value: 5.0, rank: 5, percentile: 25, vsAverage: -12.3, trend: 'declining', confidence: 0.79 },
            trafficVolume: { value: 20090, rank: 5, percentile: 40, vsAverage: -18.9, trend: 'declining', confidence: 0.76 },
            customerRetention: { value: 65, rank: 4, percentile: 60, vsAverage: 12.1, trend: 'declining', confidence: 0.64 }
          },
          peerGroup: {
            similar: ['Home & Garden Plus', 'Books & Media'],
            competitors: ['Fashion Forward NYC', 'Tech Gadgets Pro'],
            benchmarks: { avgRevenue: 380000, avgConversion: 5.7, avgAOV: 284.50 }
          }
        }
      ];

      const mockBenchmarks: BenchmarkMetric[] = [
        {
          metricName: 'Revenue',
          metricKey: 'revenue',
          unit: 'currency',
          average: 712000,
          median: 668000,
          topPerformer: { storeId: 'store-1', storeName: 'Fashion Forward NYC', value: 1250000 },
          bottomPerformer: { storeId: 'store-4', storeName: 'Beauty Essentials', value: 262500 }
        },
        {
          metricName: 'Conversion Rate',
          metricKey: 'conversionRate',
          unit: 'percentage',
          average: 5.7,
          median: 6.6,
          topPerformer: { storeId: 'store-1', storeName: 'Fashion Forward NYC', value: 8.7 },
          bottomPerformer: { storeId: 'store-4', storeName: 'Beauty Essentials', value: 5.0 }
        },
        {
          metricName: 'Average Order Value',
          metricKey: 'avgOrderValue',
          unit: 'currency',
          average: 284.50,
          median: 290.22,
          topPerformer: { storeId: 'store-2', storeName: 'Tech Gadgets Pro', value: 414.92 },
          bottomPerformer: { storeId: 'store-3', storeName: 'Home & Garden Plus', value: 237.29 }
        }
      ];

      const mockInsights: CrossStoreInsights = {
        cannibalizationAnalysis: {
          potentialCannibalization: [
            {
              store1: 'Fashion Forward NYC',
              store2: 'Beauty Essentials',
              overlapScore: 0.72,
              impactAssessment: 'medium'
            }
          ],
          recommendations: [
            'Consider differentiated positioning for overlapping stores',
            'Implement cross-store customer tracking'
          ]
        },
        synergies: {
          crossSellingOpportunities: [
            {
              sourceStore: 'Fashion Forward NYC',
              targetStore: 'Beauty Essentials',
              potentialRevenue: 125000,
              customerSegment: 'Fashion-conscious women 25-45'
            },
            {
              sourceStore: 'Tech Gadgets Pro',
              targetStore: 'Home & Garden Plus',
              potentialRevenue: 89000,
              customerSegment: 'Tech enthusiasts with home projects'
            }
          ]
        }
      };

      setComparisons(mockComparisons);
      setBenchmarks(mockBenchmarks);
      setInsights(mockInsights);
    } catch (err) {
      setError('Failed to load comparison data. Please try again.');
      console.error('Comparison loading error:', err);
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

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return formatNumber(value);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'bg-green-500';
    if (percentile >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleStoreSelection = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Store Comparison</h1>
          <p className="text-muted-foreground">
            Compare performance across your stores and identify opportunities
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadComparisonData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Store Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Stores to Compare</CardTitle>
          <CardDescription>
            Choose stores to include in your comparison analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {allStores.map((store) => (
              <div key={store.id} className="flex items-center space-x-2">
                <Checkbox
                  id={store.id}
                  checked={selectedStores.includes(store.id)}
                  onCheckedChange={() => handleStoreSelection(store.id)}
                />
                <label
                  htmlFor={store.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {store.name}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Tabs */}
      <Tabs value={comparisonType} onValueChange={(value) => setComparisonType(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance Comparison</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {comparisons.map((comparison) => (
                <Card key={comparison.storeId} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Store className="mr-2 h-5 w-5" />
                        {comparison.storeName}
                      </CardTitle>
                      <Badge className={`${getScoreColor(comparison.overallScore)} font-semibold`}>
                        {comparison.overallScore}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Key Metrics */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Performance Metrics</h4>
                      {Object.entries(comparison.metrics).map(([key, metric]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                            <div className="flex items-center space-x-2">
                              {getTrendIcon(metric.trend)}
                              <span className="font-medium">
                                {formatValue(metric.value, key.includes('Rate') ? 'percentage' : key.includes('revenue') || key.includes('Value') ? 'currency' : 'number')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Progress 
                              value={metric.percentile} 
                              className="flex-1 h-2"
                            />
                            <span className="text-xs text-muted-foreground w-12">
                              #{metric.rank}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {metric.percentile}th percentile • {metric.vsAverage > 0 ? '+' : ''}{metric.vsAverage.toFixed(1)}% vs avg
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="flex items-center mb-2">
                          <ThumbsUp className="mr-2 h-4 w-4 text-green-500" />
                          <h5 className="font-semibold text-sm">Strengths</h5>
                        </div>
                        <ul className="text-xs space-y-1">
                          {comparison.strengths.map((strength, index) => (
                            <li key={index} className="flex items-center">
                              <div className="w-1 h-1 bg-green-500 rounded-full mr-2" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center mb-2">
                          <ThumbsDown className="mr-2 h-4 w-4 text-red-500" />
                          <h5 className="font-semibold text-sm">Areas for Improvement</h5>
                        </div>
                        <ul className="text-xs space-y-1">
                          {comparison.weaknesses.map((weakness, index) => (
                            <li key={index} className="flex items-center">
                              <div className="w-1 h-1 bg-red-500 rounded-full mr-2" />
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <div className="flex items-center mb-2">
                        <Target className="mr-2 h-4 w-4 text-blue-500" />
                        <h5 className="font-semibold text-sm">Top Recommendations</h5>
                      </div>
                      <ul className="text-xs space-y-1">
                        {comparison.recommendations.slice(0, 3).map((rec, index) => (
                          <li key={index} className="flex items-center">
                            <div className="w-1 h-1 bg-blue-500 rounded-full mr-2" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {benchmarks.map((benchmark) => (
                <Card key={benchmark.metricKey}>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      {benchmark.metricName} Benchmarks
                    </CardTitle>
                    <CardDescription>
                      Performance comparison across all stores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatValue(benchmark.average, benchmark.unit)}
                        </div>
                        <div className="text-sm text-muted-foreground">Average</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatValue(benchmark.median, benchmark.unit)}
                        </div>
                        <div className="text-sm text-muted-foreground">Median</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatValue(benchmark.topPerformer.value, benchmark.unit)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Top: {benchmark.topPerformer.storeName}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {formatValue(benchmark.bottomPerformer.value, benchmark.unit)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Bottom: {benchmark.bottomPerformer.storeName}
                        </div>
                      </div>
                    </div>

                    {/* Store Rankings */}
                    <div className="mt-6">
                      <h4 className="font-semibold mb-4">Store Rankings</h4>
                      <div className="space-y-3">
                        {comparisons
                          .sort((a, b) => 
                            a.metrics[benchmark.metricKey as keyof typeof a.metrics].rank - 
                            b.metrics[benchmark.metricKey as keyof typeof b.metrics].rank
                          )
                          .map((store, index) => {
                            const metric = store.metrics[benchmark.metricKey as keyof typeof store.metrics];
                            return (
                              <div key={store.storeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                    {index + 1}
                                  </Badge>
                                  <span className="font-medium">{store.storeName}</span>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span className="font-semibold">
                                    {formatValue(metric.value, benchmark.unit)}
                                  </span>
                                  <div className="w-16 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${getPercentileColor(metric.percentile)}`}
                                      style={{ width: `${metric.percentile}%` }}
                                    />
                                  </div>
                                  <span className="text-sm text-muted-foreground w-12">
                                    {metric.percentile}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : insights ? (
            <div className="space-y-6">
              {/* Cross-selling Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="mr-2 h-5 w-5 text-yellow-500" />
                    Cross-Selling Opportunities
                  </CardTitle>
                  <CardDescription>
                    Potential revenue through cross-store customer synergies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.synergies.crossSellingOpportunities.map((opportunity, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">
                            {opportunity.sourceStore} → {opportunity.targetStore}
                          </div>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            {formatCurrency(opportunity.potentialRevenue)} potential
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Target segment: {opportunity.customerSegment}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cannibalization Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                    Cannibalization Analysis
                  </CardTitle>
                  <CardDescription>
                    Potential overlap and competition between your stores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.cannibalizationAnalysis.potentialCannibalization.map((cannibalization, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">
                            {cannibalization.store1} ↔ {cannibalization.store2}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`${
                              cannibalization.impactAssessment === 'high' ? 'bg-red-100 text-red-800' :
                              cannibalization.impactAssessment === 'medium' ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {cannibalization.impactAssessment} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Overlap score: {(cannibalization.overlapScore * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                    
                    <div className="mt-6">
                      <h4 className="font-semibold mb-3">Recommendations</h4>
                      <ul className="space-y-2">
                        {insights.cannibalizationAnalysis.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-center text-sm">
                            <div className="w-1 h-1 bg-blue-500 rounded-full mr-2" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Store-Specific Opportunities */}
              <div className="grid gap-6 md:grid-cols-2">
                {comparisons.map((store) => (
                  <Card key={store.storeId}>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Target className="mr-2 h-5 w-5" />
                        {store.storeName} Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h5 className="font-semibold text-sm mb-2">Growth Opportunities</h5>
                          <ul className="text-sm space-y-1">
                            {store.opportunities.map((opportunity, index) => (
                              <li key={index} className="flex items-center">
                                <ArrowUpRight className="mr-2 h-3 w-3 text-green-500" />
                                {opportunity}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-semibold text-sm mb-2">Action Items</h5>
                          <ul className="text-sm space-y-1">
                            {store.recommendations.slice(0, 3).map((rec, index) => (
                              <li key={index} className="flex items-center">
                                <Clock className="mr-2 h-3 w-3 text-blue-500" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}