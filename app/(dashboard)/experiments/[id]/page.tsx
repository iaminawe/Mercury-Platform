// Individual Experiment Details Page
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Settings,
  Download,
  Share,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Calendar,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ResultsDashboard } from '@/components/experiments/results-dashboard';
import { StatisticalAnalyzer } from '@/components/experiments/statistical-analyzer';

interface ExperimentDetails {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'archived';
  type: 'ab_test' | 'multivariate' | 'multi_armed_bandit';
  traffic_allocation: number;
  start_date?: Date;
  end_date?: Date;
  participants: number;
  conversion_rate: number;
  lift: number;
  confidence: number;
  p_value: number;
  is_significant: boolean;
  variants: Variant[];
  success_metrics: SuccessMetric[];
  targeting_rules: TargetingRule[];
  created_at: Date;
  created_by: string;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  traffic_percentage: number;
  is_control: boolean;
  participants: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  average_order_value: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

interface SuccessMetric {
  id: string;
  name: string;
  type: 'conversion' | 'revenue' | 'engagement';
  is_primary: boolean;
  current_value: number;
  target_value?: number;
}

interface TargetingRule {
  id: string;
  name: string;
  condition: string;
  value: string;
}

export default function ExperimentDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [experiment, setExperiment] = useState<ExperimentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadExperiment();
  }, [params.id]);

  const loadExperiment = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockExperiment: ExperimentDetails = {
        id: params.id,
        name: 'Product Page CTA Button Color Test',
        description: 'Testing different CTA button colors to optimize conversion rates on product pages.',
        hypothesis: 'A bright orange CTA button will increase conversions by at least 10% compared to the current blue button.',
        status: 'running',
        type: 'ab_test',
        traffic_allocation: 100,
        start_date: new Date('2024-01-15'),
        participants: 2547,
        conversion_rate: 3.2,
        lift: 12.5,
        confidence: 95,
        p_value: 0.023,
        is_significant: true,
        variants: [
          {
            id: 'control',
            name: 'Control (Blue Button)',
            description: 'Current blue CTA button',
            traffic_percentage: 50,
            is_control: true,
            participants: 1274,
            conversions: 35,
            conversion_rate: 2.75,
            revenue: 3520,
            average_order_value: 100.57,
            confidence_interval: { lower: 1.9, upper: 3.6 }
          },
          {
            id: 'treatment',
            name: 'Treatment (Orange Button)',
            description: 'New bright orange CTA button',
            traffic_percentage: 50,
            is_control: false,
            participants: 1273,
            conversions: 42,
            conversion_rate: 3.3,
            revenue: 4536,
            average_order_value: 108.00,
            confidence_interval: { lower: 2.4, upper: 4.2 }
          }
        ],
        success_metrics: [
          {
            id: 'primary_conversion',
            name: 'Add to Cart Rate',
            type: 'conversion',
            is_primary: true,
            current_value: 3.2,
            target_value: 3.5
          },
          {
            id: 'revenue',
            name: 'Revenue per Visitor',
            type: 'revenue',
            is_primary: false,
            current_value: 3.14,
            target_value: 3.50
          }
        ],
        targeting_rules: [
          {
            id: 'geo_rule',
            name: 'Geographic Targeting',
            condition: 'Country equals',
            value: 'United States'
          },
          {
            id: 'device_rule',
            name: 'Device Type',
            condition: 'Device type in',
            value: 'Desktop, Mobile'
          }
        ],
        created_at: new Date('2024-01-10'),
        created_by: 'john.doe@company.com'
      };
      
      setExperiment(mockExperiment);
    } catch (error) {
      console.error('Failed to load experiment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'start' | 'pause' | 'stop' | 'archive') => {
    if (!experiment) return;
    
    setActionLoading(action);
    try {
      // Implement API call
      console.log(`${action} experiment ${experiment.id}`);
      await loadExperiment(); // Reload to get updated status
    } catch (error) {
      console.error(`Failed to ${action} experiment:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVariantIcon = (variant: Variant) => {
    if (variant.is_control) return '🔵';
    return '🟠';
  };

  const calculateLift = (treatment: Variant, control: Variant) => {
    if (control.conversion_rate === 0) return 0;
    return ((treatment.conversion_rate - control.conversion_rate) / control.conversion_rate) * 100;
  };

  if (loading || !experiment) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const controlVariant = experiment.variants.find(v => v.is_control);
  const treatmentVariants = experiment.variants.filter(v => !v.is_control);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{experiment.name}</h1>
              <Badge className={getStatusColor(experiment.status)}>
                <span className="capitalize">{experiment.status}</span>
              </Badge>
              {experiment.is_significant && (
                <Badge className="bg-green-100 text-green-800">
                  <Target className="h-3 w-3 mr-1" />
                  Significant
                </Badge>
              )}
            </div>
            <p className="text-gray-600">{experiment.description}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

          {experiment.status === 'running' && (
            <Button 
              onClick={() => handleAction('pause')}
              disabled={actionLoading === 'pause'}
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
            </Button>
          )}

          {experiment.status === 'paused' && (
            <Button 
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {actionLoading === 'start' ? 'Starting...' : 'Resume'}
            </Button>
          )}

          {(experiment.status === 'running' || experiment.status === 'paused') && (
            <Button 
              variant="destructive"
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop'}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop Test'}
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Participants</p>
                <p className="text-2xl font-bold">{experiment.participants.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">{experiment.conversion_rate}%</p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lift</p>
                <p className={`text-2xl font-bold flex items-center ${
                  experiment.lift > 0 ? 'text-green-600' : 
                  experiment.lift < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {experiment.lift > 0 ? <TrendingUp className="h-6 w-6 mr-1" /> : 
                   experiment.lift < 0 ? <TrendingDown className="h-6 w-6 mr-1" /> : null}
                  {experiment.lift > 0 ? '+' : ''}{experiment.lift}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Confidence</p>
                <p className="text-2xl font-bold">{experiment.confidence}%</p>
                <p className="text-xs text-gray-500">p-value: {experiment.p_value}</p>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                experiment.is_significant ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {experiment.is_significant ? 
                  <CheckCircle className="h-5 w-5 text-green-600" /> :
                  <XCircle className="h-5 w-5 text-gray-400" />
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experiment Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Experiment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Experiment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Hypothesis</h4>
                  <p className="text-gray-600">{experiment.hypothesis}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Type</p>
                    <p className="font-medium capitalize">{experiment.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Traffic Allocation</p>
                    <p className="font-medium">{experiment.traffic_allocation}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Start Date</p>
                    <p className="font-medium">
                      {experiment.start_date?.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Created By</p>
                    <p className="font-medium">{experiment.created_by}</p>
                  </div>
                </div>

                {experiment.status === 'running' && (
                  <div>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span>Progress</span>
                      <span>{experiment.traffic_allocation}%</span>
                    </div>
                    <Progress value={experiment.traffic_allocation} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Success Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Success Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {experiment.success_metrics.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{metric.name}</h4>
                        <p className="text-sm text-gray-600 capitalize">{metric.type}</p>
                        {metric.is_primary && (
                          <Badge variant="outline" className="mt-1">Primary</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{metric.current_value}%</p>
                        {metric.target_value && (
                          <p className="text-sm text-gray-600">
                            Target: {metric.target_value}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Targeting Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Targeting Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {experiment.targeting_rules.map((rule) => (
                  <div key={rule.id} className="p-3 border rounded-lg">
                    <h4 className="font-medium">{rule.name}</h4>
                    <p className="text-sm text-gray-600">{rule.condition}</p>
                    <p className="text-sm font-medium">{rule.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-6">
          <div className="grid gap-6">
            {experiment.variants.map((variant) => (
              <Card key={variant.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getVariantIcon(variant)}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{variant.name}</h3>
                        <p className="text-gray-600">{variant.description}</p>
                      </div>
                      {variant.is_control && (
                        <Badge variant="outline">Control</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Traffic Split</p>
                      <p className="text-xl font-bold">{variant.traffic_percentage}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
                      <p className="font-medium">{variant.conversion_rate}%</p>
                      <p className="text-xs text-gray-500">
                        CI: {variant.confidence_interval.lower}% - {variant.confidence_interval.upper}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Revenue</p>
                      <p className="font-medium">${variant.revenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">AOV</p>
                      <p className="font-medium">${variant.average_order_value}</p>
                    </div>
                  </div>

                  {!variant.is_control && controlVariant && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Lift vs Control:
                        </span>
                        <span className={`font-medium ${
                          calculateLift(variant, controlVariant) > 0 ? 'text-green-600' :
                          calculateLift(variant, controlVariant) < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {calculateLift(variant, controlVariant) > 0 ? '+' : ''}
                          {calculateLift(variant, controlVariant).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results">
          <ResultsDashboard experimentId={experiment.id} />
        </TabsContent>

        <TabsContent value="analysis">
          <StatisticalAnalyzer experimentId={experiment.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Experiment Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Traffic Allocation</h4>
                    <p className="text-sm text-gray-600">
                      Percentage of traffic included in experiment
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{experiment.traffic_allocation}%</p>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Statistical Settings</h4>
                    <p className="text-sm text-gray-600">
                      Confidence level and significance thresholds
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{experiment.confidence}%</p>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Auto-stopping</h4>
                    <p className="text-sm text-gray-600">
                      Automatically stop when significance is reached
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">Enabled</Badge>
                    <Button variant="outline" size="sm" className="ml-2">Toggle</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}