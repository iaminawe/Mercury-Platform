'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users,
  Download,
  Calendar,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  MousePointer,
  ShoppingCart
} from 'lucide-react'

export default function DeveloperAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('revenue')

  const metrics = {
    apiCalls: {
      current: 2500000,
      previous: 2200000,
      change: 13.6
    },
    extensions: {
      current: 8,
      previous: 6,
      change: 33.3
    },
    revenue: {
      current: 4250,
      previous: 3600,
      change: 18.1
    },
    installs: {
      current: 1284,
      previous: 1035,
      change: 24.1
    }
  }

  const extensionPerformance = [
    {
      name: 'Smart Product Recommendations',
      installs: 1284,
      revenue: 2450,
      rating: 4.8,
      growth: 24,
      status: 'growing'
    },
    {
      name: 'Advanced Analytics Dashboard',
      installs: 892,
      revenue: 1800,
      rating: 4.6,
      growth: 15,
      status: 'stable'
    },
    {
      name: 'Email Marketing Automation',
      installs: 234,
      revenue: 0,
      rating: 0,
      growth: 0,
      status: 'review'
    }
  ]

  const apiUsage = [
    { endpoint: '/api/v2/products', calls: 850000, percentage: 34 },
    { endpoint: '/api/v2/ai/recommendations', calls: 625000, percentage: 25 },
    { endpoint: '/api/v2/orders', calls: 375000, percentage: 15 },
    { endpoint: '/api/v2/customers', calls: 300000, percentage: 12 },
    { endpoint: '/api/v2/analytics', calls: 350000, percentage: 14 }
  ]

  const revenueData = [
    { month: 'Jan', revenue: 2100, installs: 156 },
    { month: 'Feb', revenue: 2450, installs: 189 },
    { month: 'Mar', revenue: 2800, installs: 234 },
    { month: 'Apr', revenue: 3200, installs: 278 },
    { month: 'May', revenue: 3650, installs: 312 },
    { month: 'Jun', revenue: 4250, installs: 356 }
  ]

  const getChangeIcon = (change: number) => {
    return change > 0 ? (
      <div className="flex items-center text-green-600">
        <TrendingUp className="w-3 h-3 mr-1" />
        <span className="text-xs">+{change.toFixed(1)}%</span>
      </div>
    ) : (
      <div className="flex items-center text-red-600">
        <TrendingUp className="w-3 h-3 mr-1 rotate-180" />
        <span className="text-xs">{change.toFixed(1)}%</span>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'growing':
        return <Badge className="bg-green-100 text-green-800">Growing</Badge>
      case 'stable':
        return <Badge className="bg-blue-100 text-blue-800">Stable</Badge>
      case 'review':
        return <Badge className="bg-orange-100 text-orange-800">Under Review</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics & Revenue</h2>
          <p className="text-muted-foreground">
            Track your extension performance and developer revenue
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">API Calls</p>
              <p className="text-2xl font-bold">{metrics.apiCalls.current.toLocaleString()}</p>
              {getChangeIcon(metrics.apiCalls.change)}
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Extensions</p>
              <p className="text-2xl font-bold">{metrics.extensions.current}</p>
              {getChangeIcon(metrics.extensions.change)}
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Revenue Share</p>
              <p className="text-2xl font-bold">${metrics.revenue.current.toLocaleString()}</p>
              {getChangeIcon(metrics.revenue.change)}
            </div>
            <div className="h-12 w-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Installs</p>
              <p className="text-2xl font-bold">{metrics.installs.current.toLocaleString()}</p>
              {getChangeIcon(metrics.installs.change)}
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="extensions">Extension Performance</TabsTrigger>
          <TabsTrigger value="api-usage">API Usage</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
              <div className="space-y-4">
                {revenueData.slice(-6).map((data, index) => (
                  <div key={data.month} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{data.month}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm">${data.revenue}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                          style={{ width: `${(data.revenue / 5000) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Extensions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top Performing Extensions</h3>
              <div className="space-y-4">
                {extensionPerformance.map((ext, index) => (
                  <div key={ext.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{ext.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ext.installs} installs • ${ext.revenue} revenue
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(ext.status)}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Extension "Smart Recommendations" reached 1,000 installs</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
                <Badge variant="outline">Milestone</Badge>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">API usage increased by 15% this week</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
                <Badge variant="outline">Growth</Badge>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New review: 5 stars for Analytics Dashboard</p>
                  <p className="text-xs text-muted-foreground">3 days ago</p>
                </div>
                <Badge variant="outline">Review</Badge>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="extensions" className="space-y-6">
          <div className="space-y-4">
            {extensionPerformance.map((extension) => (
              <Card key={extension.name} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold">{extension.name}</h4>
                    {getStatusBadge(extension.status)}
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Installs</p>
                    <p className="text-xl font-bold">{extension.installs.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-xl font-bold">${extension.revenue}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="text-xl font-bold">{extension.rating || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Growth</p>
                    <p className={`text-xl font-bold ${extension.growth > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {extension.growth > 0 ? `+${extension.growth}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api-usage" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">API Endpoint Usage</h3>
            <div className="space-y-4">
              {apiUsage.map((api) => (
                <div key={api.endpoint} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{api.endpoint}</p>
                    <p className="text-xs text-muted-foreground">
                      {api.calls.toLocaleString()} calls this month
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium">{api.percentage}%</span>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${api.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Eye className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold">Response Time</h4>
              </div>
              <p className="text-2xl font-bold">124ms</p>
              <p className="text-sm text-muted-foreground">Average response time</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold">Success Rate</h4>
              </div>
              <p className="text-2xl font-bold">99.8%</p>
              <p className="text-sm text-muted-foreground">API success rate</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <h4 className="font-semibold">Error Rate</h4>
              </div>
              <p className="text-2xl font-bold">0.2%</p>
              <p className="text-sm text-muted-foreground">Error rate this month</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Extension Sales</span>
                  <span className="font-medium">$3,200</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Revenue Share</span>
                  <span className="font-medium">$1,050</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Total Revenue</span>
                  <span className="font-bold">$4,250</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Schedule</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Next Payment</span>
                  <span className="font-medium">Feb 1, 2024</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Amount</span>
                  <span className="font-medium">$4,250</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Method</span>
                  <span className="font-medium">Bank Transfer</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue History</h3>
            <div className="space-y-3">
              {revenueData.slice(-6).map((data) => (
                <div key={data.month} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{data.month} 2024</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {data.installs} installs
                    </span>
                    <span className="font-medium">${data.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}