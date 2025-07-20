'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Brain, Users, Zap, TrendingUp, TrendingDown,
  Settings, Play, Pause, RefreshCw, AlertCircle, CheckCircle,
  Eye, ShoppingCart, Heart, Target, Cpu, Activity,
  Calendar, Clock, Filter, Download, Upload, Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface RecommendationDashboardProps {
  className?: string;
}

interface ModelMetrics {
  name: string;
  type: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  coverage: number;
  diversity: number;
  novelty: number;
  latency: number;
  throughput: number;
  isActive: boolean;
  lastTrained: string;
  version: string;
}

interface PerformanceData {
  date: string;
  clickThrough: number;
  conversion: number;
  revenue: number;
  sessions: number;
}

interface ABTestResult {
  variant: string;
  traffic: number;
  conversion: number;
  revenue: number;
  confidence: number;
  significance: boolean;
}

export function RecommendationDashboard({ className }: RecommendationDashboardProps) {
  const [models, setModels] = useState<ModelMetrics[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [abTests, setABTests] = useState<ABTestResult[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [businessRules, setBusinessRules] = useState({
    minMargin: 0.2,
    inventoryThreshold: 10,
    seasonalBoost: 1.2,
    diversityWeight: 0.3,
    noveltyWeight: 0.2
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Mock data - in production, fetch from API
      setModels([
        {
          name: 'Neural Collaborative Filtering',
          type: 'neural',
          accuracy: 0.94,
          precision: 0.91,
          recall: 0.89,
          f1Score: 0.90,
          coverage: 0.81,
          diversity: 0.75,
          novelty: 0.58,
          latency: 45,
          throughput: 1200,
          isActive: true,
          lastTrained: '2024-01-15T10:30:00Z',
          version: '2.1.0'
        },
        {
          name: 'Matrix Factorization',
          type: 'matrix_factorization',
          accuracy: 0.87,
          precision: 0.84,
          recall: 0.82,
          f1Score: 0.83,
          coverage: 0.78,
          diversity: 0.68,
          novelty: 0.45,
          latency: 25,
          throughput: 2400,
          isActive: true,
          lastTrained: '2024-01-14T15:45:00Z',
          version: '1.8.2'
        },
        {
          name: 'Content-Based Filtering',
          type: 'content',
          accuracy: 0.82,
          precision: 0.79,
          recall: 0.76,
          f1Score: 0.78,
          coverage: 0.71,
          diversity: 0.62,
          novelty: 0.52,
          latency: 15,
          throughput: 3600,
          isActive: true,
          lastTrained: '2024-01-13T09:15:00Z',
          version: '1.5.1'
        },
        {
          name: 'LSTM Sequence Model',
          type: 'lstm',
          accuracy: 0.90,
          precision: 0.87,
          recall: 0.85,
          f1Score: 0.86,
          coverage: 0.73,
          diversity: 0.71,
          novelty: 0.64,
          latency: 85,
          throughput: 800,
          isActive: false,
          lastTrained: '2024-01-12T14:20:00Z',
          version: '1.2.0'
        }
      ]);

      setPerformanceData([
        { date: '2024-01-01', clickThrough: 3.2, conversion: 2.8, revenue: 15420, sessions: 12500 },
        { date: '2024-01-02', clickThrough: 3.4, conversion: 3.1, revenue: 16890, sessions: 13200 },
        { date: '2024-01-03', clickThrough: 3.1, conversion: 2.9, revenue: 14760, sessions: 11800 },
        { date: '2024-01-04', clickThrough: 3.8, conversion: 3.4, revenue: 18230, sessions: 14100 },
        { date: '2024-01-05', clickThrough: 4.1, conversion: 3.7, revenue: 19850, sessions: 15300 },
        { date: '2024-01-06', clickThrough: 3.9, conversion: 3.5, revenue: 18940, sessions: 14600 },
        { date: '2024-01-07', clickThrough: 4.3, conversion: 3.9, revenue: 21470, sessions: 16200 }
      ]);

      setABTests([
        { variant: 'Neural Heavy', traffic: 25, conversion: 3.8, revenue: 21500, confidence: 95, significance: true },
        { variant: 'Balanced', traffic: 25, conversion: 3.2, revenue: 18200, confidence: 87, significance: false },
        { variant: 'Business Focused', traffic: 25, conversion: 3.6, revenue: 20100, confidence: 92, significance: true },
        { variant: 'Collaborative', traffic: 25, conversion: 3.1, revenue: 17800, confidence: 83, significance: false }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleModelToggle = async (modelName: string, isActive: boolean) => {
    setModels(prev => prev.map(model => 
      model.name === modelName ? { ...model, isActive } : model
    ));
    
    // In production, make API call to toggle model
    console.log(`${isActive ? 'Activating' : 'Deactivating'} model: ${modelName}`);
  };

  const handleTrainModel = async (modelName: string) => {
    setIsTraining(true);
    try {
      // Simulate training process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setModels(prev => prev.map(model => 
        model.name === modelName 
          ? { 
              ...model, 
              lastTrained: new Date().toISOString(),
              accuracy: Math.min(model.accuracy + 0.01, 1),
              version: incrementVersion(model.version)
            } 
          : model
      ));
      
      console.log(`Training completed for model: ${modelName}`);
    } catch (error) {
      console.error('Training failed:', error);
    } finally {
      setIsTraining(false);
    }
  };

  const incrementVersion = (version: string): string => {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  };

  return (
    <div className={className}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Recommendation Engine Dashboard</h1>
        <p className="text-muted-foreground">Monitor and manage AI-powered recommendation systems</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
          <TabsTrigger value="business">Business Rules</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab 
            models={models} 
            performanceData={performanceData} 
            abTests={abTests} 
          />
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <ModelsTab 
            models={models}
            isTraining={isTraining}
            onModelToggle={handleModelToggle}
            onTrainModel={handleTrainModel}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceTab performanceData={performanceData} />
        </TabsContent>

        <TabsContent value="abtests" className="space-y-6">
          <ABTestsTab abTests={abTests} />
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <BusinessRulesTab 
            rules={businessRules}
            onRulesChange={setBusinessRules}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ 
  models, 
  performanceData, 
  abTests 
}: { 
  models: ModelMetrics[]; 
  performanceData: PerformanceData[];
  abTests: ABTestResult[];
}) {
  const activeModels = models.filter(m => m.isActive).length;
  const avgAccuracy = models.reduce((sum, m) => sum + m.accuracy, 0) / models.length;
  const latestPerformance = performanceData[performanceData.length - 1];
  const bestVariant = abTests.reduce((best, variant) => 
    variant.conversion > best.conversion ? variant : best
  );

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Models</p>
                <p className="text-2xl font-bold">{activeModels}/{models.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Accuracy</p>
                <p className="text-2xl font-bold">{(avgAccuracy * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{latestPerformance?.conversion.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Revenue (24h)</p>
                <p className="text-2xl font-bold">${latestPerformance?.revenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="clickThrough" stroke="#8884d8" name="Click Through %" />
              <Line type="monotone" dataKey="conversion" stroke="#82ca9d" name="Conversion %" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Real-time Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Real-time Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {models.slice(0, 3).map((model) => (
              <div key={model.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${model.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">{model.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{model.latency}ms</span>
                  <Badge variant={model.isActive ? 'default' : 'secondary'}>
                    {model.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Best Performing Variant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{bestVariant.variant}</span>
                <Badge variant="default">{bestVariant.confidence}% confidence</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Conversion:</span>
                  <span className="ml-2 font-medium">{bestVariant.conversion}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue:</span>
                  <span className="ml-2 font-medium">${bestVariant.revenue.toLocaleString()}</span>
                </div>
              </div>
              <Progress value={bestVariant.conversion * 10} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModelsTab({ 
  models, 
  isTraining, 
  onModelToggle, 
  onTrainModel 
}: { 
  models: ModelMetrics[];
  isTraining: boolean;
  onModelToggle: (modelName: string, isActive: boolean) => void;
  onTrainModel: (modelName: string) => void;
}) {
  return (
    <div className="space-y-6">
      {models.map((model) => (
        <Card key={model.name}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${model.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">v{model.version} • {model.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={model.isActive}
                  onCheckedChange={(checked) => onModelToggle(model.name, checked)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTrainModel(model.name)}
                  disabled={isTraining}
                >
                  {isTraining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isTraining ? 'Training...' : 'Train'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{(model.accuracy * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{(model.precision * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Precision</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{(model.recall * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Recall</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{(model.coverage * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Coverage</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-600">{(model.diversity * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Diversity</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-pink-600">{(model.novelty * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Novelty</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{model.latency}ms</p>
                <p className="text-xs text-muted-foreground">Latency</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-600">{model.throughput}</p>
                <p className="text-xs text-muted-foreground">Throughput</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Last trained: {new Date(model.lastTrained).toLocaleDateString()}</span>
              <span>Type: {model.type}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PerformanceTab({ performanceData }: { performanceData: PerformanceData[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clickThrough" fill="#8884d8" name="Click Through %" />
                <Bar dataKey="conversion" fill="#82ca9d" name="Conversion %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue & Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="revenue" orientation="left" />
                <YAxis yAxisId="sessions" orientation="right" />
                <Tooltip />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
                <Line yAxisId="sessions" type="monotone" dataKey="sessions" stroke="#82ca9d" name="Sessions" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ABTestsTab({ abTests }: { abTests: ABTestResult[] }) {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Traffic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={abTests}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} (${value}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="traffic"
                  nameKey="variant"
                >
                  {abTests.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion by Variant</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={abTests}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="variant" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="conversion" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>A/B Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {abTests.map((test) => (
              <div key={test.variant} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${test.significance ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div>
                    <h4 className="font-medium">{test.variant}</h4>
                    <p className="text-sm text-muted-foreground">{test.traffic}% traffic allocation</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{test.conversion}% conversion</p>
                  <p className="text-sm text-muted-foreground">${test.revenue.toLocaleString()} revenue</p>
                </div>
                <div className="text-right">
                  <Badge variant={test.significance ? 'default' : 'secondary'}>
                    {test.confidence}% conf
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {test.significance ? 'Significant' : 'Not significant'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BusinessRulesTab({ 
  rules, 
  onRulesChange 
}: { 
  rules: any;
  onRulesChange: (rules: any) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Rule Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Minimum Profit Margin</Label>
              <Slider
                value={[rules.minMargin * 100]}
                onValueChange={([value]) => onRulesChange({ ...rules, minMargin: value / 100 })}
                max={50}
                step={1}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">{(rules.minMargin * 100).toFixed(0)}%</p>
            </div>

            <div className="space-y-2">
              <Label>Inventory Threshold</Label>
              <Slider
                value={[rules.inventoryThreshold]}
                onValueChange={([value]) => onRulesChange({ ...rules, inventoryThreshold: value })}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">{rules.inventoryThreshold} units</p>
            </div>

            <div className="space-y-2">
              <Label>Seasonal Boost Factor</Label>
              <Slider
                value={[rules.seasonalBoost * 100]}
                onValueChange={([value]) => onRulesChange({ ...rules, seasonalBoost: value / 100 })}
                min={100}
                max={200}
                step={5}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">{(rules.seasonalBoost * 100).toFixed(0)}%</p>
            </div>

            <div className="space-y-2">
              <Label>Diversity Weight</Label>
              <Slider
                value={[rules.diversityWeight * 100]}
                onValueChange={([value]) => onRulesChange({ ...rules, diversityWeight: value / 100 })}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">{(rules.diversityWeight * 100).toFixed(0)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Real-time Updates</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>A/B Testing</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Deep Learning</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Business Rules</Label>
                <Switch defaultChecked />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Embedding Dimension</Label>
                <Input type="number" defaultValue="128" />
              </div>
              <div>
                <Label>Batch Size</Label>
                <Input type="number" defaultValue="256" />
              </div>
              <div>
                <Label>Learning Rate</Label>
                <Input type="number" step="0.001" defaultValue="0.001" />
              </div>
              <div>
                <Label>Cache TTL (seconds)</Label>
                <Input type="number" defaultValue="300" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Export Models
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Import Models
            </Button>
            <Button variant="outline">
              <Database className="w-4 h-4 mr-2" />
              Backup Data
            </Button>
            <Button variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset Cache
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}