'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  MessageCircle, 
  Clock, 
  Users, 
  ThumbsUp,
  Target,
  Zap,
  Globe,
  Brain,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';

interface AnalyticsData {
  conversations: {
    total: number;
    growth: number;
    byPeriod: Array<{ period: string; count: number }>;
  };
  resolution: {
    rate: number;
    improvement: number;
    breakdown: Array<{ type: string; rate: number; count: number }>;
  };
  satisfaction: {
    average: number;
    trend: number;
    distribution: Array<{ rating: number; count: number }>;
  };
  performance: {
    avgResponseTime: number;
    improvement: number;
    byHour: Array<{ hour: number; time: number }>;
  };
  languages: {
    supported: number;
    usage: Array<{ language: string; percentage: number; conversations: number }>;
  };
  intents: {
    recognized: number;
    accuracy: number;
    distribution: Array<{ intent: string; count: number; accuracy: number }>;
  };
}

// Mock data - in real app, this would come from your analytics API
const mockData: AnalyticsData = {
  conversations: {
    total: 12453,
    growth: 18.2,
    byPeriod: [
      { period: 'Mon', count: 1450 },
      { period: 'Tue', count: 1670 },
      { period: 'Wed', count: 1890 },
      { period: 'Thu', count: 2100 },
      { period: 'Fri', count: 2340 },
      { period: 'Sat', count: 1850 },
      { period: 'Sun', count: 1153 },
    ]
  },
  resolution: {
    rate: 74.2,
    improvement: 5.3,
    breakdown: [
      { type: 'Auto-resolved', rate: 68.5, count: 8532 },
      { type: 'Escalated & resolved', rate: 5.7, count: 709 },
      { type: 'Unresolved', rate: 25.8, count: 3212 }
    ]
  },
  satisfaction: {
    average: 4.6,
    trend: 0.3,
    distribution: [
      { rating: 5, count: 7892 },
      { rating: 4, count: 3241 },
      { rating: 3, count: 892 },
      { rating: 2, count: 321 },
      { rating: 1, count: 107 }
    ]
  },
  performance: {
    avgResponseTime: 1.3,
    improvement: -0.4,
    byHour: [
      { hour: 0, time: 0.9 }, { hour: 1, time: 0.8 }, { hour: 2, time: 0.7 },
      { hour: 3, time: 0.8 }, { hour: 4, time: 0.9 }, { hour: 5, time: 1.1 },
      { hour: 6, time: 1.4 }, { hour: 7, time: 1.8 }, { hour: 8, time: 2.1 },
      { hour: 9, time: 1.9 }, { hour: 10, time: 1.7 }, { hour: 11, time: 1.5 },
      { hour: 12, time: 1.6 }, { hour: 13, time: 1.4 }, { hour: 14, time: 1.3 },
      { hour: 15, time: 1.2 }, { hour: 16, time: 1.4 }, { hour: 17, time: 1.6 },
      { hour: 18, time: 1.5 }, { hour: 19, time: 1.3 }, { hour: 20, time: 1.1 },
      { hour: 21, time: 1.0 }, { hour: 22, time: 0.9 }, { hour: 23, time: 0.8 }
    ]
  },
  languages: {
    supported: 82,
    usage: [
      { language: 'English', percentage: 78.3, conversations: 9752 },
      { language: 'Spanish', percentage: 8.7, conversations: 1083 },
      { language: 'French', percentage: 4.2, conversations: 523 },
      { language: 'German', percentage: 3.1, conversations: 386 },
      { language: 'Portuguese', percentage: 2.4, conversations: 299 },
      { language: 'Other', percentage: 3.3, conversations: 410 }
    ]
  },
  intents: {
    recognized: 94.7,
    accuracy: 89.3,
    distribution: [
      { intent: 'Order Status', count: 3241, accuracy: 96.2 },
      { intent: 'Product Search', count: 2876, accuracy: 91.8 },
      { intent: 'Return/Exchange', count: 1934, accuracy: 87.3 },
      { intent: 'Shipping Info', count: 1723, accuracy: 94.1 },
      { intent: 'Account Help', count: 1456, accuracy: 89.7 },
      { intent: 'Payment Issues', count: 892, accuracy: 82.4 },
      { intent: 'General Inquiry', count: 331, accuracy: 76.8 }
    ]
  }
};

export function ChatAnalytics() {
  const [timeframe, setTimeframe] = useState('7d');
  const data = mockData; // In real app, this would depend on timeframe

  const formatTrend = (value: number) => {
    const isPositive = value > 0;
    return (
      <span className={`flex items-center text-sm ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
        {isPositive ? '+' : ''}{value}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat Analytics</h2>
          <p className="text-gray-600">
            Comprehensive insights into chatbot performance and customer interactions
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            {timeframe === '24h' ? 'Last 24 Hours' : 
             timeframe === '7d' ? 'Last 7 Days' :
             timeframe === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.conversations.total.toLocaleString()}</div>
            {formatTrend(data.conversations.growth)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.resolution.rate}%</div>
            {formatTrend(data.resolution.improvement)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performance.avgResponseTime}s</div>
            {formatTrend(data.performance.improvement)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
            <ThumbsUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.satisfaction.average}/5.0</div>
            {formatTrend(data.satisfaction.trend * 10)} {/* Convert to percentage */}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="conversations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="intents">Intents</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Volume</CardTitle>
              <CardDescription>
                Daily conversation trends and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.conversations.byPeriod.map((period, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="font-medium w-12">{period.period}</span>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ 
                            width: `${(period.count / Math.max(...data.conversations.byPeriod.map(p => p.count))) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-16 text-right">
                      {period.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resolution Breakdown</CardTitle>
                <CardDescription>
                  How conversations are being resolved
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.resolution.breakdown.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.type}</span>
                        <span className="text-sm text-gray-600">{item.rate}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            index === 0 ? 'bg-green-600' :
                            index === 1 ? 'bg-blue-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${item.rate}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.count.toLocaleString()} conversations
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resolution Trends</CardTitle>
                <CardDescription>
                  Resolution rate improvements over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Resolution trend chart would be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Time by Hour</CardTitle>
              <CardDescription>
                Average response times throughout the day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1 mt-4">
                {data.performance.byHour.map((hour, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">
                      {hour.hour.toString().padStart(2, '0')}
                    </div>
                    <div 
                      className="bg-blue-600 rounded-sm mx-auto"
                      style={{ 
                        height: `${Math.max(4, (hour.time / Math.max(...data.performance.byHour.map(h => h.time))) * 60)}px`,
                        width: '8px'
                      }}
                      title={`${hour.time}s avg at ${hour.hour}:00`}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {hour.time}s
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Language Usage</CardTitle>
              <CardDescription>
                Distribution of conversations by language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">
                      {data.languages.supported} languages supported
                    </span>
                  </div>
                  <Badge variant="outline">Multilingual AI</Badge>
                </div>
                
                {data.languages.usage.map((lang, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{lang.language}</span>
                      <div className="text-right">
                        <span className="text-sm text-gray-600">{lang.percentage}%</span>
                        <div className="text-xs text-gray-500">
                          {lang.conversations.toLocaleString()} conversations
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Intent Recognition</CardTitle>
                <CardDescription>
                  AI accuracy in understanding customer intentions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Overall Accuracy</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{data.intents.accuracy}%</div>
                      <div className="text-sm text-gray-500">
                        {data.intents.recognized}% recognized
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-purple-600 h-3 rounded-full"
                      style={{ width: `${data.intents.accuracy}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intent Distribution</CardTitle>
                <CardDescription>
                  Most common customer intents and their accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.intents.distribution.slice(0, 5).map((intent, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-sm">{intent.intent}</span>
                          <span className="text-sm text-gray-600">
                            {intent.accuracy}% accurate
                          </span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ 
                              width: `${(intent.count / Math.max(...data.intents.distribution.map(i => i.count))) * 100}%` 
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {intent.count.toLocaleString()} conversations
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}