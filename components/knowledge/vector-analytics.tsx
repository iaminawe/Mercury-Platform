'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  Database, 
  TrendingUp, 
  Clock, 
  Zap,
  BarChart3,
  Search,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Users,
  FileText
} from 'lucide-react';

interface VectorStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  totalEmbeddings: number;
  totalClusters: number;
  storageSize: number;
  lastUpdated: Date;
  searchPerformance: {
    averageQueryTime: number;
    cacheHitRate: number;
    totalSearches: number;
  };
}

interface VectorAnalyticsProps {
  stats: VectorStats | null;
}

interface ClusterData {
  id: string;
  name: string;
  contentType: string;
  memberCount: number;
  averageSimilarity: number;
  size: 'small' | 'medium' | 'large';
}

interface SearchTrend {
  date: string;
  searches: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

interface PerformanceMetric {
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  target: number;
}

export function VectorAnalytics({ stats }: VectorAnalyticsProps) {
  const [timeframe, setTimeframe] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [clusterData, setClusterData] = useState<ClusterData[]>([]);
  const [searchTrends, setSearchTrends] = useState<SearchTrend[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    loadClusterData();
    loadSearchTrends();
    loadPerformanceMetrics();
  }, [timeframe]);

  const loadClusterData = () => {
    // Mock cluster data
    const mockClusters: ClusterData[] = [
      {
        id: '1',
        name: 'Product Electronics',
        contentType: 'product',
        memberCount: 234,
        averageSimilarity: 0.87,
        size: 'large',
      },
      {
        id: '2',
        name: 'Support Documentation',
        contentType: 'knowledge_base',
        memberCount: 89,
        averageSimilarity: 0.82,
        size: 'medium',
      },
      {
        id: '3',
        name: 'Positive Reviews',
        contentType: 'review',
        memberCount: 156,
        averageSimilarity: 0.79,
        size: 'large',
      },
      {
        id: '4',
        name: 'FAQ General',
        contentType: 'faq',
        memberCount: 45,
        averageSimilarity: 0.91,
        size: 'small',
      },
      {
        id: '5',
        name: 'Customer Inquiries',
        contentType: 'customer',
        memberCount: 67,
        averageSimilarity: 0.75,
        size: 'medium',
      },
    ];
    setClusterData(mockClusters);
  };

  const loadSearchTrends = () => {
    // Mock search trend data
    const mockTrends: SearchTrend[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      searches: Math.floor(Math.random() * 200) + 50,
      averageResponseTime: Math.floor(Math.random() * 100) + 150,
      cacheHitRate: Math.random() * 0.4 + 0.6,
    }));
    setSearchTrends(mockTrends);
  };

  const loadPerformanceMetrics = () => {
    const mockMetrics: PerformanceMetric[] = [
      {
        metric: 'Average Query Time',
        value: 187,
        change: -12,
        trend: 'down',
        target: 200,
      },
      {
        metric: 'Cache Hit Rate',
        value: 73,
        change: 5,
        trend: 'up',
        target: 80,
      },
      {
        metric: 'Indexing Throughput',
        value: 145,
        change: 23,
        trend: 'up',
        target: 150,
      },
      {
        metric: 'Storage Efficiency',
        value: 82,
        change: -2,
        trend: 'down',
        target: 85,
      },
    ];
    setPerformanceMetrics(mockMetrics);
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getDistributionData = () => {
    if (!stats?.documentsByType) return [];
    
    return Object.entries(stats.documentsByType).map(([type, count]) => ({
      name: type.replace('_', ' ').toUpperCase(),
      value: count,
      percentage: ((count / stats.totalDocuments) * 100).toFixed(1),
    }));
  };

  const getClusterSizeData = () => {
    const sizeGroups = clusterData.reduce((acc, cluster) => {
      acc[cluster.size] = (acc[cluster.size] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sizeGroups).map(([size, count]) => ({
      name: size.charAt(0).toUpperCase() + size.slice(1),
      value: count,
    }));
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const getHealthStatus = (metric: PerformanceMetric) => {
    const percentage = (metric.value / metric.target) * 100;
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'fair';
    return 'poor';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      case 'stable': return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vector Database Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and usage statistics
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map((metric) => (
          <Card key={metric.metric}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.metric}</CardTitle>
              {getTrendIcon(metric.trend)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <span className={metric.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {metric.change >= 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="ml-2">vs previous period</span>
              </div>
              <Progress 
                value={(metric.value / metric.target) * 100} 
                className="mt-2" 
              />
              <div className="text-xs text-muted-foreground mt-1">
                Target: {metric.target}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Content Distribution
            </CardTitle>
            <CardDescription>
              Distribution of documents by content type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getDistributionData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getDistributionData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Search Performance Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Performance
            </CardTitle>
            <CardDescription>
              Query response times and cache performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={searchTrends.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [
                      name === 'averageResponseTime' ? `${value}ms` : 
                      name === 'cacheHitRate' ? `${(value * 100).toFixed(1)}%` : value,
                      name === 'averageResponseTime' ? 'Response Time' :
                      name === 'cacheHitRate' ? 'Cache Hit Rate' : 'Searches'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="averageResponseTime" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="searches" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cluster Performance
            </CardTitle>
            <CardDescription>
              Analysis of document clusters and their effectiveness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clusterData.map((cluster) => (
                <div key={cluster.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{cluster.name}</h4>
                      <Badge variant="outline">{cluster.contentType}</Badge>
                      <Badge variant={
                        cluster.size === 'large' ? 'default' :
                        cluster.size === 'medium' ? 'secondary' : 'outline'
                      }>
                        {cluster.size}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{cluster.memberCount} documents</span>
                      <span>{(cluster.averageSimilarity * 100).toFixed(1)}% avg similarity</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {(cluster.averageSimilarity * 100).toFixed(1)}%
                    </div>
                    <Progress 
                      value={cluster.averageSimilarity * 100} 
                      className="w-20 mt-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cluster Sizes</CardTitle>
            <CardDescription>
              Distribution of cluster sizes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getClusterSizeData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage and Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.storageSize)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalEmbeddings} embeddings
            </p>
            <Progress value={65} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              65% of allocated space
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.searchPerformance.totalSearches}</div>
            <p className="text-xs text-muted-foreground">
              +18% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.searchPerformance.cacheHitRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Excellent performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clusters</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClusters}</div>
            <p className="text-xs text-muted-foreground">
              Well organized
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Usage Patterns
          </CardTitle>
          <CardDescription>
            Search volume and performance trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={searchTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value, name) => [
                    name === 'searches' ? `${value} searches` : `${value}ms`,
                    name === 'searches' ? 'Daily Searches' : 'Avg Response Time'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="searches" 
                  stackId="1"
                  stroke="#8884d8" 
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>
            Overall health status of your vector database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performanceMetrics.map((metric) => {
              const status = getHealthStatus(metric);
              return (
                <div key={metric.metric} className="text-center">
                  <div className={`text-2xl font-bold ${getHealthColor(status)}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">{metric.metric}</div>
                  <div className="text-xs text-muted-foreground">
                    {metric.value} / {metric.target}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}