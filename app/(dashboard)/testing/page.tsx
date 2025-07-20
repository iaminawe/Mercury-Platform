'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Brain, 
  Mail, 
  MessageSquare, 
  Search, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  Zap
} from 'lucide-react';

import { AccuracyCharts } from '@/components/testing/accuracy-charts';
import { CostAnalysis } from '@/components/testing/cost-analysis';
import { TestRunner } from '@/components/testing/test-runner';

interface PerformanceMetrics {
  advisor: {
    accuracy: number;
    responseTime: number;
    throughput: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  chatbot: {
    autoResolutionRate: number;
    responseTime: number;
    userSatisfaction: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  emailGenerator: {
    deliverability: number;
    personalization: number;
    engagement: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  vectorSearch: {
    accuracy: number;
    responseTime: number;
    relevanceScore: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  services: {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    lastCheck: Date;
    issues: string[];
  }[];
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export default function TestingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runningTests, setRunningTests] = useState<string[]>([]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API calls to get real metrics
      // In a real implementation, these would be actual API endpoints
      const [metricsResponse, healthResponse] = await Promise.all([
        fetch('/api/testing/metrics'),
        fetch('/api/testing/health')
      ]);

      if (metricsResponse.ok && healthResponse.ok) {
        const metricsData = await metricsResponse.json();
        const healthData = await healthResponse.json();
        
        setMetrics(metricsData);
        setSystemHealth(healthData);
      } else {
        // Mock data for development
        setMetrics({
          advisor: {
            accuracy: 0.87,
            responseTime: 2400,
            throughput: 45,
            status: 'healthy'
          },
          chatbot: {
            autoResolutionRate: 0.73,
            responseTime: 1200,
            userSatisfaction: 4.2,
            status: 'healthy'
          },
          emailGenerator: {
            deliverability: 0.94,
            personalization: 0.82,
            engagement: 0.15,
            status: 'warning'
          },
          vectorSearch: {
            accuracy: 0.78,
            responseTime: 450,
            relevanceScore: 0.81,
            status: 'healthy'
          }
        });

        setSystemHealth({
          overall: 'healthy',
          services: [
            {
              name: 'AI Advisor',
              status: 'healthy',
              uptime: 99.8,
              lastCheck: new Date(),
              issues: []
            },
            {
              name: 'Chatbot',
              status: 'healthy',
              uptime: 99.9,
              lastCheck: new Date(),
              issues: []
            },
            {
              name: 'Email Generator',
              status: 'warning',
              uptime: 98.5,
              lastCheck: new Date(),
              issues: ['Personalization rate below target']
            },
            {
              name: 'Vector Search',
              status: 'healthy',
              uptime: 99.7,
              lastCheck: new Date(),
              issues: []
            }
          ],
          alerts: {
            critical: 0,
            warning: 2,
            info: 1
          }
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    const testSuites = ['advisor', 'chatbot', 'email-generator', 'vector-search'];
    setRunningTests(testSuites);

    try {
      for (const suite of testSuites) {
        await fetch(`/api/testing/run/${suite}`, { method: 'POST' });
        // Remove from running tests as each completes
        setRunningTests(prev => prev.filter(t => t !== suite));
      }
      
      // Refresh data after tests complete
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to run tests:', error);
      setRunningTests([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI testing dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Testing Dashboard</h1>
            <p className="text-gray-600 mt-2">Monitor AI system performance, accuracy, and costs</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={runAllTests}
              disabled={runningTests.length > 0}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {runningTests.length > 0 ? 'Running Tests...' : 'Run All Tests'}
            </Button>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall Health</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(systemHealth?.overall || 'healthy')}
                    <span className={`text-sm font-semibold px-2 py-1 rounded-full ${getStatusColor(systemHealth?.overall || 'healthy')}`}>
                      {systemHealth?.overall?.toUpperCase() || 'HEALTHY'}
                    </span>
                  </div>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="destructive">{systemHealth?.alerts.critical || 0}</Badge>
                    <Badge variant="outline" className="text-yellow-600">{systemHealth?.alerts.warning || 0}</Badge>
                    <Badge variant="secondary">{systemHealth?.alerts.info || 0}</Badge>
                  </div>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Advisor Accuracy</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics ? (metrics.advisor.accuracy * 100).toFixed(1) : '0'}%
                  </p>
                  <p className="text-xs text-gray-500">Target: ≥85%</p>
                </div>
                <Brain className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Chatbot Resolution</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics ? (metrics.chatbot.autoResolutionRate * 100).toFixed(1) : '0'}%
                  </p>
                  <p className="text-xs text-gray-500">Target: ≥70%</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Service Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* AI Advisor */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-500" />
                    AI Advisor
                  </CardTitle>
                  <Badge className={getStatusColor(metrics?.advisor.status || 'healthy')}>
                    {metrics?.advisor.status || 'healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accuracy</span>
                  <span className="font-semibold">{metrics ? (metrics.advisor.accuracy * 100).toFixed(1) : '0'}%</span>
                </div>
                <Progress value={metrics ? metrics.advisor.accuracy * 100 : 0} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="font-semibold">{metrics?.advisor.responseTime || 0}ms</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Throughput</span>
                  <span className="font-semibold">{metrics?.advisor.throughput || 0} req/min</span>
                </div>
              </CardContent>
            </Card>

            {/* Chatbot */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    Chatbot
                  </CardTitle>
                  <Badge className={getStatusColor(metrics?.chatbot.status || 'healthy')}>
                    {metrics?.chatbot.status || 'healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Auto-Resolution</span>
                  <span className="font-semibold">{metrics ? (metrics.chatbot.autoResolutionRate * 100).toFixed(1) : '0'}%</span>
                </div>
                <Progress value={metrics ? metrics.chatbot.autoResolutionRate * 100 : 0} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="font-semibold">{metrics?.chatbot.responseTime || 0}ms</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">User Satisfaction</span>
                  <span className="font-semibold">{metrics?.chatbot.userSatisfaction || 0}/5</span>
                </div>
              </CardContent>
            </Card>

            {/* Email Generator */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-green-500" />
                    Email Generator
                  </CardTitle>
                  <Badge className={getStatusColor(metrics?.emailGenerator.status || 'healthy')}>
                    {metrics?.emailGenerator.status || 'healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Deliverability</span>
                  <span className="font-semibold">{metrics ? (metrics.emailGenerator.deliverability * 100).toFixed(1) : '0'}%</span>
                </div>
                <Progress value={metrics ? metrics.emailGenerator.deliverability * 100 : 0} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Personalization</span>
                  <span className="font-semibold">{metrics ? (metrics.emailGenerator.personalization * 100).toFixed(1) : '0'}%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Engagement</span>
                  <span className="font-semibold">{metrics ? (metrics.emailGenerator.engagement * 100).toFixed(1) : '0'}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Vector Search */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5 text-orange-500" />
                    Vector Search
                  </CardTitle>
                  <Badge className={getStatusColor(metrics?.vectorSearch.status || 'healthy')}>
                    {metrics?.vectorSearch.status || 'healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accuracy</span>
                  <span className="font-semibold">{metrics ? (metrics.vectorSearch.accuracy * 100).toFixed(1) : '0'}%</span>
                </div>
                <Progress value={metrics ? metrics.vectorSearch.accuracy * 100 : 0} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="font-semibold">{metrics?.vectorSearch.responseTime || 0}ms</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Relevance Score</span>
                  <span className="font-semibold">{metrics ? (metrics.vectorSearch.relevanceScore * 100).toFixed(1) : '0'}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest test runs and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">AI Advisor Accuracy Test Passed</p>
                    <p className="text-sm text-gray-600">Achieved 87.3% accuracy on product recommendation test suite</p>
                  </div>
                  <span className="text-xs text-gray-500">2 minutes ago</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <p className="font-medium">Email Generator Performance Warning</p>
                    <p className="text-sm text-gray-600">Personalization rate dropped below 85% threshold</p>
                  </div>
                  <span className="text-xs text-gray-500">15 minutes ago</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">Chatbot Auto-Resolution Target Met</p>
                    <p className="text-sm text-gray-600">73.2% of customer queries resolved automatically</p>
                  </div>
                  <span className="text-xs text-gray-500">1 hour ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy">
          <AccuracyCharts />
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
                <CardDescription>Average response times over the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Performance charts will be displayed here
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput Metrics</CardTitle>
                <CardDescription>Requests processed per minute</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Throughput charts will be displayed here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs">
          <CostAnalysis />
        </TabsContent>

        <TabsContent value="testing">
          <TestRunner />
        </TabsContent>
      </Tabs>
    </div>
  );
}