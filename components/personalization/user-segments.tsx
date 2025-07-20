'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  Eye,
  ShoppingBag,
  Heart,
  Clock
} from 'lucide-react';

interface UserSegment {
  id: string;
  name: string;
  description: string;
  userCount: number;
  percentage: number;
  averageValue: number;
  engagementScore: number;
  churnRisk: number;
  growthRate: number;
  characteristics: string[];
  color: string;
}

interface SegmentAnalytics {
  conversionRate: number;
  averageOrderValue: number;
  lifetimeValue: number;
  retentionRate: number;
  sessionDuration: number;
  pagesPerSession: number;
}

interface UserSegmentsProps {
  selectedSegment: string;
  onSegmentSelect: (segmentId: string) => void;
}

export function UserSegments({ selectedSegment, onSegmentSelect }: UserSegmentsProps) {
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, SegmentAnalytics>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      setIsLoading(true);
      const [segmentsRes, analyticsRes] = await Promise.all([
        fetch('/api/personalization/segments'),
        fetch('/api/personalization/segment-analytics')
      ]);
      
      const segmentsData = await segmentsRes.json();
      const analyticsData = await analyticsRes.json();
      
      setSegments(segmentsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching segments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSegmentIcon = (segmentName: string) => {
    switch (segmentName.toLowerCase()) {
      case 'high-value':
        return <DollarSign className="h-4 w-4" />;
      case 'highly-engaged':
        return <Heart className="h-4 w-4" />;
      case 'at-risk':
      case 'high-churn-risk':
        return <AlertTriangle className="h-4 w-4" />;
      case 'new-customers':
        return <Users className="h-4 w-4" />;
      case 'frequent-buyers':
        return <ShoppingBag className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getSegmentColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      pink: 'bg-pink-500',
      indigo: 'bg-indigo-500'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  const selectedSegmentData = segments.find(s => s.id === selectedSegment);
  const selectedAnalytics = selectedSegment ? analytics[selectedSegment] : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Segment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment) => (
          <Card 
            key={segment.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedSegment === segment.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSegmentSelect(segment.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSegmentIcon(segment.name)}
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </div>
                <div className={`h-3 w-3 rounded-full ${getSegmentColorClass(segment.color)}`} />
              </div>
              <CardDescription className="text-sm">{segment.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{segment.userCount.toLocaleString()}</span>
                <Badge variant="secondary">{segment.percentage.toFixed(1)}%</Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Avg Value</span>
                  <span className="font-mono">${segment.averageValue.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Engagement</span>
                  <span className="font-mono">{segment.engagementScore}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Churn Risk</span>
                  <span className={`font-mono ${segment.churnRisk > 70 ? 'text-red-600' : segment.churnRisk > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {segment.churnRisk}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Growth Rate</span>
                  <span className={segment.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {segment.growthRate >= 0 ? '+' : ''}{segment.growthRate.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.abs(segment.growthRate) * 2} 
                  className={segment.growthRate >= 0 ? 'bg-green-100' : 'bg-red-100'}
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {segment.characteristics.slice(0, 3).map((char, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {char}
                  </Badge>
                ))}
                {segment.characteristics.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{segment.characteristics.length - 3}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Segment Details */}
      {selectedSegmentData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {getSegmentIcon(selectedSegmentData.name)}
                  {selectedSegmentData.name} Segment Analysis
                </CardTitle>
                <CardDescription>
                  Detailed analytics for {selectedSegmentData.userCount.toLocaleString()} users
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Export Data
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="behavior">Behavior</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Key Characteristics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedSegmentData.characteristics.map((char, index) => (
                          <Badge key={index} variant="secondary" className="mr-1 mb-1">
                            {char}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Segment Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Engagement</span>
                          <span>{selectedSegmentData.engagementScore}%</span>
                        </div>
                        <Progress value={selectedSegmentData.engagementScore} />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Retention Risk</span>
                          <span>{selectedSegmentData.churnRisk}%</span>
                        </div>
                        <Progress 
                          value={100 - selectedSegmentData.churnRisk} 
                          className="bg-red-100"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Segment Value</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Avg Order Value</span>
                        <span className="font-mono">${selectedSegmentData.averageValue}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Growth Rate</span>
                        <span className={`font-mono ${selectedSegmentData.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedSegmentData.growthRate >= 0 ? '+' : ''}{selectedSegmentData.growthRate.toFixed(1)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="behavior" className="space-y-4">
                {selectedAnalytics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Shopping Behavior</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">Session Duration</span>
                          </div>
                          <span className="font-mono">{Math.round(selectedAnalytics.sessionDuration / 60)}m</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Pages per Session</span>
                          </div>
                          <span className="font-mono">{selectedAnalytics.pagesPerSession.toFixed(1)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            <span className="text-sm">Conversion Rate</span>
                          </div>
                          <span className="font-mono">{(selectedAnalytics.conversionRate * 100).toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Value Metrics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Average Order Value</span>
                          </div>
                          <span className="font-mono">${selectedAnalytics.averageOrderValue.toFixed(0)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            <span className="text-sm">Lifetime Value</span>
                          </div>
                          <span className="font-mono">${selectedAnalytics.lifetimeValue.toFixed(0)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">Retention Rate</span>
                          </div>
                          <span className="font-mono">{(selectedAnalytics.retentionRate * 100).toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Personalization Impact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Recommendation CTR</span>
                          <span className="font-mono text-green-600">+23.4%</span>
                        </div>
                        <Progress value={78} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Conversion Lift</span>
                          <span className="font-mono text-green-600">+15.7%</span>
                        </div>
                        <Progress value={65} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Revenue per User</span>
                          <span className="font-mono text-green-600">+31.2%</span>
                        </div>
                        <Progress value={85} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Engagement Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Email Open Rate</span>
                          <span className="font-mono">34.2%</span>
                        </div>
                        <Progress value={68} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Push Notification CTR</span>
                          <span className="font-mono">12.8%</span>
                        </div>
                        <Progress value={51} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Return Visit Rate</span>
                          <span className="font-mono">67.3%</span>
                        </div>
                        <Progress value={67} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Segment Growth Trends</CardTitle>
                    <CardDescription>
                      30-day trends for {selectedSegmentData.name} segment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="text-center text-gray-500">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                        <p>Trend chart would be rendered here</p>
                        <p className="text-sm">Integration with charting library needed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}