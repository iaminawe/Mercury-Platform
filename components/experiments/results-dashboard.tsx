// Results Visualization Dashboard
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  DollarSign,
  ShoppingCart,
  Eye,
  MousePointer,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Cell 
} from 'recharts';

interface ResultsDashboardProps {
  experimentId: string;
}

interface ExperimentResults {
  experiment: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    participants: number;
    is_significant: boolean;
    confidence: number;
    p_value: number;
  };
  variants: VariantResult[];
  metrics: MetricResult[];
  timeline: TimelineData[];
  funnel: FunnelData[];
  cohorts: CohortData[];
  statistical_analysis: StatisticalAnalysis;
}

interface VariantResult {
  id: string;
  name: string;
  is_control: boolean;
  participants: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  average_order_value: number;
  sessions: number;
  bounce_rate: number;
  time_on_page: number;
  lift: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  significance: {
    is_significant: boolean;
    p_value: number;
  };
}

interface MetricResult {
  id: string;
  name: string;
  type: 'conversion' | 'revenue' | 'engagement';
  is_primary: boolean;
  variants: Record<string, {
    value: number;
    lift: number;
    confidence_interval: { lower: number; upper: number };
    is_significant: boolean;
  }>;
}

interface TimelineData {
  date: string;
  control_conversions: number;
  treatment_conversions: number;
  control_participants: number;
  treatment_participants: number;
  cumulative_lift: number;
  significance: boolean;
}

interface FunnelData {
  step: string;
  control: number;
  treatment: number;
  lift: number;
}

interface CohortData {
  cohort: string;
  control_rate: number;
  treatment_rate: number;
  participants: number;
  lift: number;
}

interface StatisticalAnalysis {
  sample_size_analysis: {
    current_sample_size: number;
    required_sample_size: number;
    power_achieved: number;
    days_to_significance: number;
  };
  effect_size: number;
  practical_significance: boolean;
  recommendations: Array<{
    type: string;
    message: string;
    confidence: number;
  }>;
}

const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];

export function ResultsDashboard({ experimentId }: ResultsDashboardProps) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('all');

  useEffect(() => {
    loadResults();
  }, [experimentId]);

  const loadResults = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockResults: ExperimentResults = {
        experiment: {
          id: experimentId,
          name: 'Product Page CTA Button Test',
          status: 'running',
          start_date: '2024-01-15',
          participants: 2547,
          is_significant: true,
          confidence: 95,
          p_value: 0.023
        },
        variants: [
          {
            id: 'control',
            name: 'Control (Blue Button)',
            is_control: true,
            participants: 1274,
            conversions: 35,
            conversion_rate: 2.75,
            revenue: 3520,
            average_order_value: 100.57,
            sessions: 1205,
            bounce_rate: 42.3,
            time_on_page: 125,
            lift: 0,
            confidence_interval: { lower: 1.9, upper: 3.6 },
            significance: { is_significant: false, p_value: 1.0 }
          },
          {
            id: 'treatment',
            name: 'Treatment (Orange Button)',
            is_control: false,
            participants: 1273,
            conversions: 42,
            conversion_rate: 3.3,
            revenue: 4536,
            average_order_value: 108.00,
            sessions: 1198,
            bounce_rate: 38.7,
            time_on_page: 142,
            lift: 20.0,
            confidence_interval: { lower: 2.4, upper: 4.2 },
            significance: { is_significant: true, p_value: 0.023 }
          }
        ],
        metrics: [
          {
            id: 'conversion_rate',
            name: 'Conversion Rate',
            type: 'conversion',
            is_primary: true,
            variants: {
              control: { value: 2.75, lift: 0, confidence_interval: { lower: 1.9, upper: 3.6 }, is_significant: false },
              treatment: { value: 3.3, lift: 20.0, confidence_interval: { lower: 2.4, upper: 4.2 }, is_significant: true }
            }
          },
          {
            id: 'revenue_per_visitor',
            name: 'Revenue per Visitor',
            type: 'revenue',
            is_primary: false,
            variants: {
              control: { value: 2.76, lift: 0, confidence_interval: { lower: 2.1, upper: 3.4 }, is_significant: false },
              treatment: { value: 3.56, lift: 29.0, confidence_interval: { lower: 2.8, upper: 4.3 }, is_significant: true }
            }
          }
        ],
        timeline: Array.from({ length: 14 }, (_, i) => ({
          date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          control_conversions: Math.floor(Math.random() * 5) + 2,
          treatment_conversions: Math.floor(Math.random() * 6) + 3,
          control_participants: Math.floor(Math.random() * 50) + 80,
          treatment_participants: Math.floor(Math.random() * 50) + 85,
          cumulative_lift: Math.random() * 25 + 10,
          significance: Math.random() > 0.3
        })),
        funnel: [
          { step: 'Page View', control: 100, treatment: 100, lift: 0 },
          { step: 'Product Interest', control: 45, treatment: 52, lift: 15.6 },
          { step: 'Add to Cart', control: 12, treatment: 16, lift: 33.3 },
          { step: 'Checkout', control: 8, treatment: 11, lift: 37.5 },
          { step: 'Purchase', control: 2.75, treatment: 3.3, lift: 20.0 }
        ],
        cohorts: [
          { cohort: 'Week 1', control_rate: 2.1, treatment_rate: 2.8, participants: 450, lift: 33.3 },
          { cohort: 'Week 2', control_rate: 2.9, treatment_rate: 3.5, participants: 520, lift: 20.7 },
          { cohort: 'Week 3', control_rate: 2.6, treatment_rate: 3.2, participants: 480, lift: 23.1 },
          { cohort: 'Current Week', control_rate: 3.1, treatment_rate: 3.7, participants: 380, lift: 19.4 }
        ],
        statistical_analysis: {
          sample_size_analysis: {
            current_sample_size: 2547,
            required_sample_size: 3200,
            power_achieved: 76.5,
            days_to_significance: 8
          },
          effect_size: 0.28,
          practical_significance: true,
          recommendations: [
            {
              type: 'continue',
              message: 'Results show statistical significance but consider running for 8 more days to reach full power.',
              confidence: 0.85
            },
            {
              type: 'winner',
              message: 'Orange button variant shows clear improvement with practical significance.',
              confidence: 0.92
            }
          ]
        }
      };

      setResults(mockResults);
      setSelectedMetric(mockResults.metrics[0]?.id || '');
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !results) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getVariantIcon = (variant: VariantResult) => {
    return variant.is_control ? '🔵' : '🟠';
  };

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  const formatCurrency = (num: number): string => {
    return `$${num.toFixed(2)}`;
  };

  const selectedMetricData = results.metrics.find(m => m.id === selectedMetric);

  return (
    <div className="space-y-6">
      {/* Header with Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Participants</p>
                <p className="text-2xl font-bold">{results.experiment.participants.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Statistical Significance</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{results.experiment.confidence}%</p>
                  {results.experiment.is_significant ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Best Lift</p>
                <p className="text-2xl font-bold flex items-center text-green-600">
                  <TrendingUp className="h-6 w-6 mr-1" />
                  +{Math.max(...results.variants.filter(v => !v.is_control).map(v => v.lift)).toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue Impact</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(results.variants.find(v => !v.is_control)?.revenue || 0 - 
                                  results.variants.find(v => v.is_control)?.revenue || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Results */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList className="grid w-full grid-cols-5 max-w-md">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            <TabsTrigger value="statistical">Statistical</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="14d">Last 14 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Variant Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Variant Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.variants.map((variant) => (
                  <div key={variant.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getVariantIcon(variant)}</span>
                        <div>
                          <h4 className="font-semibold">{variant.name}</h4>
                          <div className="flex items-center gap-2">
                            {variant.is_control && <Badge variant="outline">Control</Badge>}
                            {variant.significance.is_significant && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Significant
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {!variant.is_control && (
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            variant.lift > 0 ? 'text-green-600' : 
                            variant.lift < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {variant.lift > 0 ? '+' : ''}{variant.lift.toFixed(1)}% lift
                          </p>
                          <p className="text-sm text-gray-600">
                            p-value: {variant.significance.p_value.toFixed(3)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Participants</p>
                        <p className="font-medium">{variant.participants.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Conversions</p>
                        <p className="font-medium">{variant.conversions}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Conversion Rate</p>
                        <p className="font-medium">{formatNumber(variant.conversion_rate)}%</p>
                        <p className="text-xs text-gray-500">
                          CI: {formatNumber(variant.confidence_interval.lower)}% - {formatNumber(variant.confidence_interval.upper)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Revenue</p>
                        <p className="font-medium">{formatCurrency(variant.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">AOV</p>
                        <p className="font-medium">{formatCurrency(variant.average_order_value)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Bounce Rate</p>
                        <p className="font-medium">{formatNumber(variant.bounce_rate)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Success Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Success Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {results.metrics.map((metric) => (
                  <div key={metric.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium">{metric.name}</h4>
                      {metric.is_primary && <Badge>Primary</Badge>}
                      <Badge variant="outline" className="capitalize">{metric.type}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(metric.variants).map(([variantId, data]) => {
                        const variant = results.variants.find(v => v.id === variantId);
                        return (
                          <div key={variantId} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{getVariantIcon(variant!)}</span>
                              <span className="font-medium">{variant?.name}</span>
                              {data.is_significant && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Value</p>
                                <p className="font-medium">
                                  {metric.type === 'revenue' ? formatCurrency(data.value) : `${formatNumber(data.value)}%`}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Lift</p>
                                <p className={`font-medium ${
                                  data.lift > 0 ? 'text-green-600' : 
                                  data.lift < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {data.lift > 0 ? '+' : ''}{formatNumber(data.lift)}%
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              CI: {formatNumber(data.confidence_interval.lower)}% - {formatNumber(data.confidence_interval.upper)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative_lift" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      name="Cumulative Lift (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={results.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="control_conversions" 
                      stackId="1"
                      stroke="#3B82F6" 
                      fill="#3B82F6"
                      fillOpacity={0.6}
                      name="Control Conversions"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="treatment_conversions" 
                      stackId="2"
                      stroke="#F59E0B" 
                      fill="#F59E0B"
                      fillOpacity={0.6}
                      name="Treatment Conversions"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.funnel.map((step, index) => (
                  <div key={step.step} className="relative">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{step.step}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Control: {formatNumber(step.control)}%</span>
                            <span>Treatment: {formatNumber(step.treatment)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          step.lift > 0 ? 'text-green-600' : 
                          step.lift < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {step.lift > 0 ? '+' : ''}{formatNumber(step.lift)}%
                        </p>
                        <p className="text-sm text-gray-600">lift</p>
                      </div>
                    </div>
                    
                    {index < results.funnel.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-0.5 h-4 bg-gray-300"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funnel Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.funnel} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="step" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="control" fill="#3B82F6" name="Control" />
                    <Bar dataKey="treatment" fill="#F59E0B" name="Treatment" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.cohorts.map((cohort) => (
                  <div key={cohort.cohort} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{cohort.cohort}</h4>
                      <Badge variant="outline">{cohort.participants} participants</Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Control Rate</p>
                        <p className="font-medium">{formatNumber(cohort.control_rate)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Treatment Rate</p>
                        <p className="font-medium">{formatNumber(cohort.treatment_rate)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Lift</p>
                        <p className={`font-medium ${
                          cohort.lift > 0 ? 'text-green-600' : 
                          cohort.lift < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {cohort.lift > 0 ? '+' : ''}{formatNumber(cohort.lift)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cohort Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.cohorts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="cohort" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="control_rate" fill="#3B82F6" name="Control Rate" />
                    <Bar dataKey="treatment_rate" fill="#F59E0B" name="Treatment Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistical" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sample Size Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Sample Size:</span>
                  <span className="font-medium">{results.statistical_analysis.sample_size_analysis.current_sample_size.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Required Sample Size:</span>
                  <span className="font-medium">{results.statistical_analysis.sample_size_analysis.required_sample_size.toLocaleString()}</span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Statistical Power:</span>
                    <span className="font-medium">{formatNumber(results.statistical_analysis.sample_size_analysis.power_achieved)}%</span>
                  </div>
                  <Progress value={results.statistical_analysis.sample_size_analysis.power_achieved} className="h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Days to Full Power:</span>
                  <span className="font-medium">{results.statistical_analysis.sample_size_analysis.days_to_significance} days</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Effect Size Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Effect Size (Cohen's h):</span>
                  <span className="font-medium">{formatNumber(results.statistical_analysis.effect_size, 3)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Practical Significance:</span>
                  <div className="flex items-center gap-2">
                    {results.statistical_analysis.practical_significance ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Yes</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-600 font-medium">No</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <h5 className="font-medium mb-2">Effect Size Interpretation:</h5>
                  <div className="text-sm text-gray-600">
                    {results.statistical_analysis.effect_size < 0.2 && "Small effect size"}
                    {results.statistical_analysis.effect_size >= 0.2 && results.statistical_analysis.effect_size < 0.5 && "Medium effect size"}
                    {results.statistical_analysis.effect_size >= 0.5 && "Large effect size"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.statistical_analysis.recommendations.map((rec, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        rec.type === 'winner' ? 'bg-green-500' :
                        rec.type === 'continue' ? 'bg-blue-500' :
                        rec.type === 'stop' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">{rec.type}</Badge>
                          <span className="text-sm text-gray-600">
                            {formatNumber(rec.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-sm">{rec.message}</p>
                      </div>
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