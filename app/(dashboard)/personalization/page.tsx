'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Users, 
  Zap, 
  BarChart3,
  Settings,
  Eye,
  Heart,
  ShoppingCart,
  Clock,
  Activity,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  DollarSign,
  Percent,
  Network,
  Cpu,
  Database,
  Award,
  Play,
  Pause,
  MousePointer,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PersonalizationMetrics {
  conversionLift: number;
  engagementIncrease: number;
  revenueImpact: number;
  confidence: number;
  totalUsers: number;
  activePersonalizations: number;
  mlModelAccuracy: number;
  realTimeProcessing: number;
  neuralCFAccuracy: number;
  rlReward: number;
  crossDeviceLinking: number;
  abTestsRunning: number;
}

interface MLModelStatus {
  name: string;
  type: string;
  accuracy: number;
  lastTrained: string;
  status: 'healthy' | 'warning' | 'error';
  predictions: number;
  latency: number;
  coverage: number;
}

interface ExperimentData {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused';
  variants: Array<{
    name: string;
    conversionRate: number;
    traffic: number;
    winning: boolean;
  }>;
  significance: boolean;
  confidence: number;
}

interface SegmentData {
  name: string;
  users: number;
  conversionRate: number;
  revenue: number;
  lift: number;
  color: string;
}

// Mock data for demonstration
const mockPerformanceData = [
  { name: 'Jan', conversions: 4200, revenue: 125000, engagement: 68, neuralCF: 0.85, rlReward: 0.72 },
  { name: 'Feb', conversions: 4800, revenue: 142000, engagement: 72, neuralCF: 0.87, rlReward: 0.74 },
  { name: 'Mar', conversions: 5200, revenue: 158000, engagement: 75, neuralCF: 0.88, rlReward: 0.76 },
  { name: 'Apr', conversions: 5800, revenue: 172000, engagement: 78, neuralCF: 0.89, rlReward: 0.78 },
  { name: 'May', conversions: 6400, revenue: 195000, engagement: 82, neuralCF: 0.91, rlReward: 0.80 },
  { name: 'Jun', conversions: 7100, revenue: 218000, engagement: 85, neuralCF: 0.92, rlReward: 0.82 }
];

const mockSegmentData: SegmentData[] = [
  { name: 'High Value', users: 1250, conversionRate: 12.4, revenue: 89000, lift: 45.2, color: '#8b5cf6' },
  { name: 'Frequent Buyers', users: 2100, conversionRate: 8.7, revenue: 67000, lift: 32.8, color: '#06b6d4' },
  { name: 'New Users', users: 3800, conversionRate: 3.2, revenue: 24000, lift: 18.5, color: '#10b981' },
  { name: 'Cart Abandoners', users: 1900, conversionRate: 5.8, revenue: 18000, lift: 28.3, color: '#f59e0b' },
  { name: 'Price Sensitive', users: 2300, conversionRate: 4.1, revenue: 15000, lift: 22.1, color: '#ef4444' }
];

const mockExperiments: ExperimentData[] = [
  {
    id: 'exp1',
    name: 'Neural CF vs Collaborative Filtering',
    status: 'running',
    variants: [
      { name: 'Control (CF)', conversionRate: 8.1, traffic: 40, winning: false },
      { name: 'Neural CF', conversionRate: 9.7, traffic: 60, winning: true }
    ],
    significance: true,
    confidence: 0.95
  },
  {
    id: 'exp2', 
    name: 'Dynamic Pricing with RL',
    status: 'running',
    variants: [
      { name: 'Static Pricing', conversionRate: 12.3, traffic: 50, winning: false },
      { name: 'RL Pricing', conversionRate: 14.8, traffic: 50, winning: true }
    ],
    significance: false,
    confidence: 0.87
  }
];

const mockDeviceData = [
  { name: 'Desktop', value: 45, users: 2845, conversionRate: 8.9, crossDevice: 85 },
  { name: 'Mobile', value: 42, users: 2656, conversionRate: 6.2, crossDevice: 78 },
  { name: 'Tablet', value: 13, users: 821, conversionRate: 7.4, crossDevice: 92 }
];

export default function PersonalizationPage() {
  const [metrics, setMetrics] = useState<PersonalizationMetrics>({
    conversionLift: 42.8,
    engagementIncrease: 35.2,
    revenueImpact: 185750,
    confidence: 0.89,
    totalUsers: 8924,
    activePersonalizations: 6745,
    mlModelAccuracy: 0.91,
    realTimeProcessing: 28,
    neuralCFAccuracy: 0.92,
    rlReward: 0.78,
    crossDeviceLinking: 0.84,
    abTestsRunning: 12
  });

  const [mlModels, setMlModels] = useState<MLModelStatus[]>([
    {
      name: 'Neural Collaborative Filtering',
      type: 'Deep Learning',
      accuracy: 0.92,
      lastTrained: '2 hours ago',
      status: 'healthy',
      predictions: 145680,
      latency: 23,
      coverage: 0.89
    },
    {
      name: 'Reinforcement Learning',
      type: 'Multi-Armed Bandit',
      accuracy: 0.78,
      lastTrained: '15 minutes ago',
      status: 'healthy',
      predictions: 89234,
      latency: 12,
      coverage: 0.76
    },
    {
      name: 'Cross-Device Tracking',
      type: 'Fingerprinting + ML',
      accuracy: 0.84,
      lastTrained: '1 hour ago',
      status: 'healthy',
      predictions: 67891,
      latency: 18,
      coverage: 0.92
    },
    {
      name: 'A/B Testing Engine',
      type: 'Statistical Analysis',
      accuracy: 0.96,
      lastTrained: '30 minutes ago',
      status: 'healthy',
      predictions: 234567,
      latency: 8,
      coverage: 1.0
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [mlEnabled, setMlEnabled] = useState(true);
  const [abTestingEnabled, setAbTestingEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + Math.floor(Math.random() * 10),
        activePersonalizations: prev.activePersonalizations + Math.floor(Math.random() * 5)
      }));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const handleConfigChange = async (key: string, value: boolean) => {
    switch (key) {
      case 'realTimeEnabled':
        setRealTimeEnabled(value);
        break;
      case 'mlEnabled':
        setMlEnabled(value);
        break;
      case 'abTestingEnabled':
        setAbTestingEnabled(value);
        break;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    trend = 'up',
    prefix = '',
    suffix = '',
    description = '',
    color = 'blue'
  }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold text-${color}-600`}>
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            {change && (
              <p className={`text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}>
                <TrendingUp className="h-3 w-3" />
                {change}% vs last month
              </p>
            )}
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <Icon className={`h-8 w-8 text-${color}-600`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              AI Personalization Engine
            </h1>
            <p className="text-muted-foreground mt-2">
              Neural networks, reinforcement learning, and cross-device tracking for 40%+ conversion lift
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch 
                checked={realTimeEnabled}
                onCheckedChange={(value) => handleConfigChange('realTimeEnabled', value)}
              />
              <span className="text-sm">Real-time Active</span>
            </div>
            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </motion.div>

        {/* Status Banner */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  All ML Models Operating at Peak Performance
                </p>
                <p className="text-xs text-green-600">
                  Neural CF: 92% accuracy • RL: 78% reward rate • {metrics.activePersonalizations.toLocaleString()} active personalizations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <MetricCard
            title="Conversion Lift"
            value={metrics.conversionLift}
            change={12.4}
            icon={TrendingUp}
            suffix="%"
            description="vs non-personalized traffic"
            color="green"
          />
          <MetricCard
            title="Revenue Impact"
            value={metrics.revenueImpact}
            change={18.7}
            icon={DollarSign}
            prefix="$"
            description="additional revenue this month"
            color="purple"
          />
          <MetricCard
            title="Active Users"
            value={metrics.totalUsers}
            change={25.3}
            icon={Users}
            description="with personalization active"
            color="blue"
          />
          <MetricCard
            title="Decision Speed"
            value={metrics.realTimeProcessing}
            change={-8.2}
            icon={Zap}
            suffix="ms"
            trend="down"
            description="avg ML prediction time"
            color="orange"
          />
        </motion.div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ml-models">ML Models</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="experiments">A/B Tests</TabsTrigger>
            <TabsTrigger value="real-time">Real-time</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Personalization Performance Trends</CardTitle>
                <CardDescription>
                  Monthly performance metrics showing the impact of ML-powered personalization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="conversions" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Conversions"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="engagement" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      name="Engagement %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Device and Cross-Device Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cross-Device Performance</CardTitle>
                  <CardDescription>Personalization effectiveness across devices</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={mockDeviceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {mockDeviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8b5cf6', '#06b6d4', '#10b981'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Real-time Activity Feed</CardTitle>
                  <CardDescription>Live ML predictions and user interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {[
                      { time: '2s ago', event: 'Neural CF recommendation', user: 'User #1247', confidence: 0.92 },
                      { time: '5s ago', event: 'Cross-device sync', user: 'User #1246', confidence: 0.87 },
                      { time: '8s ago', event: 'RL pricing optimization', user: 'User #1245', confidence: 0.94 },
                      { time: '12s ago', event: 'Segment classification', user: 'User #1244', confidence: 0.89 },
                      { time: '15s ago', event: 'A/B test assignment', user: 'User #1243', confidence: 1.0 }
                    ].map((event, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <div>
                            <p className="text-sm font-medium">{event.event}</p>
                            <p className="text-xs text-muted-foreground">{event.user}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{event.time}</p>
                          <p className="text-xs font-medium">{(event.confidence * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ML Models Tab */}
          <TabsContent value="ml-models" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mlModels.map((model, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      <Badge variant={model.status === 'healthy' ? 'default' : 'secondary'}>
                        {model.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Accuracy</span>
                        <span className="text-sm font-medium">{(model.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Latency</span>
                        <span className="text-sm font-medium">{model.latency}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Coverage</span>
                        <span className="text-sm font-medium">{(model.coverage * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Predictions</span>
                        <span className="text-sm font-medium">{model.predictions.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated User Segments</CardTitle>
                <CardDescription>
                  Machine learning models automatically identify and target user segments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSegmentData.map((segment, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: segment.color }}
                          />
                          <h3 className="font-medium">{segment.name}</h3>
                        </div>
                        <Badge variant="outline">{segment.users.toLocaleString()} users</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Conversion Rate</p>
                          <p className="font-medium">{segment.conversionRate}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium">${segment.revenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Personalization Lift</p>
                          <p className="font-medium text-green-600">+{segment.lift}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Order Value</p>
                          <p className="font-medium">${Math.round(segment.revenue / (segment.users * segment.conversionRate / 100))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Experiments Tab */}
          <TabsContent value="experiments" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Active A/B Tests</h2>
                <p className="text-muted-foreground">{metrics.abTestsRunning} experiments running</p>
              </div>
              <Button>
                <Lightbulb className="h-4 w-4 mr-2" />
                New Experiment
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockExperiments.map((experiment, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{experiment.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={experiment.status === 'running' ? 'default' : 'secondary'}>
                          {experiment.status}
                        </Badge>
                        {experiment.status === 'running' ? (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Pause className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        {experiment.variants.map((variant, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span>{variant.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={variant.winning ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                {variant.conversionRate}%
                              </span>
                              {variant.winning && <Award className="h-3 w-3 text-green-600" />}
                            </div>
                          </div>
                        ))}
                      </div>
                      {experiment.significance && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Statistically significant ({(experiment.confidence * 100).toFixed(0)}% confidence)
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="real-time" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Neural CF Accuracy"
                value={metrics.neuralCFAccuracy * 100}
                icon={Brain}
                suffix="%"
                description="deep learning model"
                color="purple"
              />
              <MetricCard
                title="RL Reward Rate"
                value={metrics.rlReward * 100}
                icon={Target}
                suffix="%"
                description="reinforcement learning"
                color="blue"
              />
              <MetricCard
                title="Cross-Device Linking"
                value={metrics.crossDeviceLinking * 100}
                icon={Network}
                suffix="%"
                description="device fingerprinting accuracy"
                color="green"
              />
              <MetricCard
                title="Processing Speed"
                value={metrics.realTimeProcessing}
                icon={Zap}
                suffix="ms"
                description="avg ML decision time"
                color="orange"
              />
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Impact by ML Model</CardTitle>
                <CardDescription>Attribution of revenue to different personalization models</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { model: 'Neural CF', revenue: 85000, baseline: 60000 },
                    { model: 'RL Pricing', revenue: 52000, baseline: 38000 },
                    { model: 'Cross-Device', revenue: 28000, baseline: 22000 },
                    { model: 'A/B Testing', revenue: 21000, baseline: 18000 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8b5cf6" name="With ML" />
                    <Bar dataKey="baseline" fill="#e5e7eb" name="Baseline" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}