'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle } from 'lucide-react';

interface AccuracyData {
  date: string;
  advisor: number;
  chatbot: number;
  emailGenerator: number;
  vectorSearch: number;
}

interface AccuracyMetric {
  service: string;
  current: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface TestResult {
  id: string;
  service: string;
  testName: string;
  accuracy: number;
  confidence: number;
  sampleSize: number;
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning';
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const mockAccuracyData: AccuracyData[] = [
  { date: '2024-01-01', advisor: 0.85, chatbot: 0.72, emailGenerator: 0.78, vectorSearch: 0.76 },
  { date: '2024-01-02', advisor: 0.87, chatbot: 0.74, emailGenerator: 0.80, vectorSearch: 0.78 },
  { date: '2024-01-03', advisor: 0.86, chatbot: 0.73, emailGenerator: 0.79, vectorSearch: 0.77 },
  { date: '2024-01-04', advisor: 0.88, chatbot: 0.75, emailGenerator: 0.81, vectorSearch: 0.79 },
  { date: '2024-01-05', advisor: 0.87, chatbot: 0.73, emailGenerator: 0.80, vectorSearch: 0.78 },
  { date: '2024-01-06', advisor: 0.89, chatbot: 0.76, emailGenerator: 0.82, vectorSearch: 0.80 },
  { date: '2024-01-07', advisor: 0.88, chatbot: 0.74, emailGenerator: 0.81, vectorSearch: 0.79 }
];

const mockMetrics: AccuracyMetric[] = [
  { service: 'AI Advisor', current: 0.87, target: 0.85, trend: 'up', change: 0.02 },
  { service: 'Chatbot', current: 0.73, target: 0.70, trend: 'up', change: 0.03 },
  { service: 'Email Generator', current: 0.80, target: 0.80, trend: 'stable', change: 0.00 },
  { service: 'Vector Search', current: 0.78, target: 0.75, trend: 'up', change: 0.03 }
];

const mockTestResults: TestResult[] = [
  {
    id: '1',
    service: 'advisor',
    testName: 'Product Recommendation Accuracy',
    accuracy: 0.89,
    confidence: 0.92,
    sampleSize: 500,
    timestamp: new Date('2024-01-07T10:30:00'),
    status: 'passed'
  },
  {
    id: '2',
    service: 'chatbot',
    testName: 'Intent Classification',
    accuracy: 0.85,
    confidence: 0.88,
    sampleSize: 1000,
    timestamp: new Date('2024-01-07T09:15:00'),
    status: 'passed'
  },
  {
    id: '3',
    service: 'emailGenerator',
    testName: 'Personalization Quality',
    accuracy: 0.76,
    confidence: 0.82,
    sampleSize: 300,
    timestamp: new Date('2024-01-07T08:45:00'),
    status: 'warning'
  },
  {
    id: '4',
    service: 'vectorSearch',
    testName: 'Search Relevance',
    accuracy: 0.82,
    confidence: 0.86,
    sampleSize: 750,
    timestamp: new Date('2024-01-07T08:00:00'),
    status: 'passed'
  }
];

export function AccuracyCharts() {
  const [timeframe, setTimeframe] = useState('7d');
  const [selectedService, setSelectedService] = useState('all');
  const [accuracyData, setAccuracyData] = useState<AccuracyData[]>(mockAccuracyData);
  const [metrics, setMetrics] = useState<AccuracyMetric[]>(mockMetrics);
  const [testResults, setTestResults] = useState<TestResult[]>(mockTestResults);

  useEffect(() => {
    // Load accuracy data based on timeframe
    loadAccuracyData(timeframe);
  }, [timeframe]);

  const loadAccuracyData = async (period: string) => {
    try {
      // In a real implementation, this would fetch from an API
      // const response = await fetch(`/api/testing/accuracy?timeframe=${period}&service=${selectedService}`);
      // const data = await response.json();
      // setAccuracyData(data.trends);
      // setMetrics(data.metrics);
      
      // For now, use mock data
      setAccuracyData(mockAccuracyData);
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load accuracy data:', error);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatAccuracy = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accuracy Analytics</h2>
          <p className="text-gray-600">Monitor AI system accuracy trends and performance</p>
        </div>
        <div className="flex gap-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="advisor">AI Advisor</SelectItem>
              <SelectItem value="chatbot">Chatbot</SelectItem>
              <SelectItem value="emailGenerator">Email Generator</SelectItem>
              <SelectItem value="vectorSearch">Vector Search</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Accuracy Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.service}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{metric.service}</h3>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{formatAccuracy(metric.current)}</span>
                  <span className={`text-sm ${metric.current >= metric.target ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change > 0 ? '+' : ''}{formatAccuracy(metric.change)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Target className="h-3 w-3" />
                  Target: {formatAccuracy(metric.target)}
                </div>
                <div className="flex items-center gap-1">
                  {metric.current >= metric.target ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs ${metric.current >= metric.target ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.current >= metric.target ? 'Meeting Target' : 'Below Target'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Accuracy Trends</TabsTrigger>
          <TabsTrigger value="comparison">Service Comparison</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Trends Over Time</CardTitle>
              <CardDescription>Track accuracy performance across all AI services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accuracyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis 
                      domain={[0.6, 1]} 
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="advisor" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="AI Advisor"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="chatbot" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Chatbot"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="emailGenerator" 
                      stroke="#ffc658" 
                      strokeWidth={2}
                      name="Email Generator"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="vectorSearch" 
                      stroke="#ff7300" 
                      strokeWidth={2}
                      name="Vector Search"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current vs Target Accuracy</CardTitle>
              <CardDescription>Compare current performance against target thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '']} />
                    <Bar dataKey="current" fill="#8884d8" name="Current" />
                    <Bar dataKey="target" fill="#82ca9d" name="Target" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Accuracy Distribution</CardTitle>
                <CardDescription>Current accuracy levels across services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.map((metric, index) => ({
                          name: metric.service,
                          value: metric.current,
                          color: COLORS[index % COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${(value * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {metrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Accuracy']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Key accuracy statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Average Accuracy</span>
                    <span className="text-lg font-bold">
                      {formatAccuracy(metrics.reduce((sum, m) => sum + m.current, 0) / metrics.length)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Services Meeting Target</span>
                    <span className="text-lg font-bold text-green-600">
                      {metrics.filter(m => m.current >= m.target).length} / {metrics.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Best Performing</span>
                    <span className="text-lg font-bold text-blue-600">
                      {metrics.reduce((best, current) => current.current > best.current ? current : best).service}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Needs Improvement</span>
                    <span className="text-lg font-bold text-orange-600">
                      {metrics.filter(m => m.current < m.target).length > 0 
                        ? metrics.filter(m => m.current < m.target)[0]?.service || 'None'
                        : 'None'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Results</CardTitle>
              <CardDescription>Latest accuracy test outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{result.testName}</h4>
                        {getStatusBadge(result.status)}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span>Service: {result.service}</span>
                        <span>Accuracy: {formatAccuracy(result.accuracy)}</span>
                        <span>Confidence: {formatAccuracy(result.confidence)}</span>
                        <span>Sample Size: {result.sampleSize.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {result.timestamp.toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {result.timestamp.toLocaleTimeString()}
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