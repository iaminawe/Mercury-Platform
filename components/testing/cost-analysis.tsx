'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Target, Download, RefreshCw } from 'lucide-react';

interface CostData {
  date: string;
  advisor: number;
  chatbot: number;
  emailGenerator: number;
  vectorSearch: number;
  total: number;
}

interface ServiceCost {
  service: string;
  cost: number;
  tokens: number;
  requests: number;
  avgCostPerRequest: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface BudgetAlert {
  id: string;
  name: string;
  current: number;
  limit: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical' | 'exceeded';
  type: 'daily' | 'weekly' | 'monthly';
}

interface OptimizationSuggestion {
  type: 'model_optimization' | 'usage_optimization' | 'batching_opportunity';
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const mockCostData: CostData[] = [
  { date: '2024-01-01', advisor: 25.40, chatbot: 15.20, emailGenerator: 8.90, vectorSearch: 12.30, total: 61.80 },
  { date: '2024-01-02', advisor: 28.10, chatbot: 17.50, emailGenerator: 9.40, vectorSearch: 13.20, total: 68.20 },
  { date: '2024-01-03', advisor: 26.80, chatbot: 16.30, emailGenerator: 8.70, vectorSearch: 12.80, total: 64.60 },
  { date: '2024-01-04', advisor: 30.20, chatbot: 18.90, emailGenerator: 10.10, vectorSearch: 14.50, total: 73.70 },
  { date: '2024-01-05', advisor: 27.60, chatbot: 16.80, emailGenerator: 9.20, vectorSearch: 13.10, total: 66.70 },
  { date: '2024-01-06', advisor: 32.40, chatbot: 20.10, emailGenerator: 11.30, vectorSearch: 15.80, total: 79.60 },
  { date: '2024-01-07', advisor: 29.90, chatbot: 18.40, emailGenerator: 10.60, vectorSearch: 14.20, total: 73.10 }
];

const mockServiceCosts: ServiceCost[] = [
  { service: 'AI Advisor', cost: 29.90, tokens: 245000, requests: 1250, avgCostPerRequest: 0.024, change: 8.2, trend: 'up' },
  { service: 'Chatbot', cost: 18.40, tokens: 180000, requests: 2100, avgCostPerRequest: 0.009, change: -2.1, trend: 'down' },
  { service: 'Email Generator', cost: 10.60, tokens: 95000, requests: 580, avgCostPerRequest: 0.018, change: 15.3, trend: 'up' },
  { service: 'Vector Search', cost: 14.20, tokens: 320000, requests: 8500, avgCostPerRequest: 0.002, change: 3.7, trend: 'up' }
];

const mockBudgetAlerts: BudgetAlert[] = [
  { id: '1', name: 'Daily AI Budget', current: 73.10, limit: 100.00, percentage: 73.1, status: 'warning', type: 'daily' },
  { id: '2', name: 'Monthly AI Budget', current: 1845.20, limit: 2500.00, percentage: 73.8, status: 'safe', type: 'monthly' },
  { id: '3', name: 'Advisor Weekly Budget', current: 198.50, limit: 200.00, percentage: 99.3, status: 'critical', type: 'weekly' }
];

const mockOptimizations: OptimizationSuggestion[] = [
  {
    type: 'model_optimization',
    description: 'Switch 45% of GPT-4 requests to GPT-3.5-Turbo for non-critical advisor operations',
    potentialSavings: 156.40,
    effort: 'low'
  },
  {
    type: 'batching_opportunity',
    description: 'Batch embedding requests for vector search to reduce API overhead',
    potentialSavings: 23.80,
    effort: 'medium'
  },
  {
    type: 'usage_optimization',
    description: 'Implement caching for frequently requested product recommendations',
    potentialSavings: 89.30,
    effort: 'high'
  }
];

export function CostAnalysis() {
  const [timeframe, setTimeframe] = useState('7d');
  const [costData, setCostData] = useState<CostData[]>(mockCostData);
  const [serviceCosts, setServiceCosts] = useState<ServiceCost[]>(mockServiceCosts);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>(mockBudgetAlerts);
  const [optimizations, setOptimizations] = useState<OptimizationSuggestion[]>(mockOptimizations);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadCostData(timeframe);
  }, [timeframe]);

  const loadCostData = async (period: string) => {
    try {
      setIsRefreshing(true);
      // In a real implementation, this would fetch from an API
      // const response = await fetch(`/api/testing/costs?timeframe=${period}`);
      // const data = await response.json();
      
      // For now, use mock data
      setCostData(mockCostData);
      setServiceCosts(mockServiceCosts);
      setBudgetAlerts(mockBudgetAlerts);
      setOptimizations(mockOptimizations);
    } catch (error) {
      console.error('Failed to load cost data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportCostData = async () => {
    try {
      const response = await fetch(`/api/testing/costs/export?timeframe=${timeframe}&format=csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-costs-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export cost data:', error);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-orange-100 text-orange-800';
      case 'exceeded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();

  const totalCost = serviceCosts.reduce((sum, service) => sum + service.cost, 0);
  const totalTokens = serviceCosts.reduce((sum, service) => sum + service.tokens, 0);
  const totalRequests = serviceCosts.reduce((sum, service) => sum + service.requests, 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cost Analysis</h2>
          <p className="text-gray-600">Monitor AI usage costs and optimize spending</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => loadCostData(timeframe)}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportCostData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
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
        </div>
      </div>

      {/* Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCost)}</p>
                <p className="text-xs text-gray-500">Last 24 hours</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tokens</p>
                <p className="text-2xl font-bold text-gray-900">{formatTokens(totalTokens)}</p>
                <p className="text-xs text-gray-500">Processed</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{totalRequests.toLocaleString()}</p>
                <p className="text-xs text-gray-500">API calls</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Cost/Request</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalCost / totalRequests)}
                </p>
                <p className="text-xs text-gray-500">Per API call</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Budget Alerts
            </CardTitle>
            <CardDescription>Current budget usage and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgetAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{alert.name}</h4>
                      <Badge className={getBudgetStatusColor(alert.status)}>
                        {alert.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{formatCurrency(alert.current)} of {formatCurrency(alert.limit)}</span>
                        <span>{alert.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={alert.percentage} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Cost Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Service Breakdown</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="usage">Usage Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Trends Over Time</CardTitle>
              <CardDescription>Daily AI usage costs by service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={costData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="advisor" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8"
                      name="AI Advisor"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="chatbot" 
                      stackId="1"
                      stroke="#82ca9d" 
                      fill="#82ca9d"
                      name="Chatbot"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="emailGenerator" 
                      stackId="1"
                      stroke="#ffc658" 
                      fill="#ffc658"
                      name="Email Generator"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="vectorSearch" 
                      stackId="1"
                      stroke="#ff7300" 
                      fill="#ff7300"
                      name="Vector Search"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution</CardTitle>
                <CardDescription>Current spending by service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={serviceCosts.map((service, index) => ({
                          name: service.service,
                          value: service.cost,
                          color: COLORS[index % COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {serviceCosts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Details</CardTitle>
                <CardDescription>Detailed cost breakdown by service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serviceCosts.map((service) => (
                    <div key={service.service} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{service.service}</h4>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(service.trend)}
                          <span className={`text-sm ${service.trend === 'up' ? 'text-red-600' : service.trend === 'down' ? 'text-green-600' : 'text-gray-600'}`}>
                            {service.change > 0 ? '+' : ''}{service.change.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total Cost</p>
                          <p className="font-semibold">{formatCurrency(service.cost)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Tokens</p>
                          <p className="font-semibold">{formatTokens(service.tokens)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Requests</p>
                          <p className="font-semibold">{service.requests.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Avg/Request</p>
                          <p className="font-semibold">{formatCurrency(service.avgCostPerRequest)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Optimization Opportunities</CardTitle>
              <CardDescription>AI-recommended ways to reduce costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optimizations.map((optimization, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{optimization.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                          <Badge className={getEffortColor(optimization.effort)}>
                            {optimization.effort.toUpperCase()} EFFORT
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm">{optimization.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(optimization.potentialSavings)}
                        </p>
                        <p className="text-xs text-gray-500">potential savings</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Implement Suggestion
                    </Button>
                  </div>
                ))}
                
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-green-600" />
                    <h4 className="font-semibold text-green-800">Total Potential Savings</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0))}
                  </p>
                  <p className="text-sm text-green-700">per month if all optimizations are implemented</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Usage by Service</CardTitle>
                <CardDescription>Token consumption comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceCosts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="service" angle={-45} textAnchor="end" height={100} />
                      <YAxis tickFormatter={(value) => formatTokens(value)} />
                      <Tooltip formatter={(value: number) => [formatTokens(value), 'Tokens']} />
                      <Bar dataKey="tokens" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Volume</CardTitle>
                <CardDescription>API request frequency by service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceCosts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="service" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Requests']} />
                      <Bar dataKey="requests" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}