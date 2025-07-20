'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, Target, Users, Package, MessageSquare, BarChart3, Zap, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { InsightCard } from '@/components/advisor/insight-card';
import { ConfidenceBadge } from '@/components/advisor/confidence-badge';
import { ActionButtons } from '@/components/advisor/action-buttons';

export default function AdvisorPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '14d' | '30d' | '90d'>('30d');
  const [question, setQuestion] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch insights
  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['advisor', 'insights', selectedTimeRange, selectedCategories],
    queryFn: () => trpc.advisor.getInsights.query({
      timeRange: selectedTimeRange,
      categories: selectedCategories.length > 0 ? selectedCategories as any : undefined,
    }),
  });

  // Fetch performance analysis
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['advisor', 'performance', selectedTimeRange],
    queryFn: () => trpc.advisor.getPerformanceAnalysis.query({
      timeRange: selectedTimeRange,
    }),
  });

  // Fetch advisor metrics
  const { data: metricsData } = useQuery({
    queryKey: ['advisor', 'metrics', selectedTimeRange],
    queryFn: () => trpc.advisor.getMetrics.query({
      timeRange: selectedTimeRange,
    }),
  });

  // Ask question mutation
  const askQuestionMutation = useMutation({
    mutationFn: (question: string) => trpc.advisor.askQuestion.mutate({ question }),
    onSuccess: () => {
      setQuestion('');
      queryClient.invalidateQueries({ queryKey: ['advisor'] });
    },
  });

  // Implement action mutation
  const implementActionMutation = useMutation({
    mutationFn: ({ actionId, insightId, parameters }: { actionId: string; insightId: string; parameters?: any }) =>
      trpc.advisor.implementAction.mutate({ actionId, insightId, parameters }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor'] });
    },
  });

  const categories = [
    { id: 'sales', name: 'Sales', icon: TrendingUp },
    { id: 'traffic', name: 'Traffic', icon: BarChart3 },
    { id: 'conversion', name: 'Conversion', icon: Target },
    { id: 'products', name: 'Products', icon: Package },
    { id: 'customers', name: 'Customers', icon: Users },
  ];

  const timeRanges = [
    { value: '7d', label: '7 days' },
    { value: '14d', label: '14 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'trend': return BarChart3;
      case 'recommendation': return Target;
      default: return AlertCircle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AI Advisor</h1>
        <p className="text-gray-600 mt-2">
          Get AI-powered insights and recommendations for your store with ≥85% precision anomaly detection
        </p>
      </div>

      {/* Performance Overview */}
      {performanceData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Store Performance Score
            </CardTitle>
            <CardDescription>
              Overall health assessment of your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold text-blue-600">
                {performanceData.performanceScore}/100
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${performanceData.performanceScore}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-600">Revenue Growth</div>
                <div className={`font-semibold ${performanceData.keyMetrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceData.keyMetrics.revenueGrowth > 0 ? '+' : ''}{performanceData.keyMetrics.revenueGrowth.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Conversion Rate</div>
                <div className="font-semibold">{performanceData.keyMetrics.conversionRate.toFixed(2)}%</div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Avg Order Value</div>
                <div className="font-semibold">${performanceData.keyMetrics.avgOrderValue.toFixed(2)}</div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Bounce Rate</div>
                <div className="font-semibold">{performanceData.keyMetrics.avgBounceRate.toFixed(1)}%</div>
              </div>
            </div>

            {performanceData.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-800 mb-2">Top Recommendations:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {performanceData.recommendations.slice(0, 3).map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              variant={selectedTimeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange(range.value as any)}
            >
              {range.label}
            </Button>
          ))}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategories.includes(category.id);
            return (
              <Button
                key={category.id}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (isSelected) {
                    setSelectedCategories(selectedCategories.filter(c => c !== category.id));
                  } else {
                    setSelectedCategories([...selectedCategories, category.id]);
                  }
                }}
                className="flex items-center gap-1"
              >
                <Icon className="h-4 w-4" />
                {category.name}
              </Button>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights & Recommendations</TabsTrigger>
          <TabsTrigger value="qa">Ask Questions</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {insightsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-8 bg-gray-200 rounded w-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : insightsData?.insights.length ? (
            <div className="grid gap-4">
              {insightsData.insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onImplementAction={(actionId, parameters) => 
                    implementActionMutation.mutate({ 
                      actionId, 
                      insightId: insight.id, 
                      parameters 
                    })
                  }
                  isImplementing={implementActionMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No insights available</h3>
                <p className="text-gray-600">
                  We need more data to generate insights. Check back after your store has more activity.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="qa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Ask About Your Store
              </CardTitle>
              <CardDescription>
                Ask questions about your sales, traffic, products, or customers in natural language
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="e.g., How are my sales performing this month? Why is my bounce rate high? Which products need restocking?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={() => question.trim() && askQuestionMutation.mutate(question)}
                  disabled={!question.trim() || askQuestionMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {askQuestionMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Ask Question'
                  )}
                </Button>
              </div>

              {askQuestionMutation.data && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="mb-2">
                          <ConfidenceBadge confidence={askQuestionMutation.data.confidence} />
                        </div>
                        <p className="text-gray-800">{askQuestionMutation.data.answer}</p>
                        {askQuestionMutation.data.sources.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            Sources: {askQuestionMutation.data.sources.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">Example questions:</h4>
                <ul className="space-y-1">
                  <li>• "How are my sales trending this month?"</li>
                  <li>• "Which products have the highest conversion rates?"</li>
                  <li>• "Why is my bounce rate higher than usual?"</li>
                  <li>• "What products are running low on inventory?"</li>
                  <li>• "How can I improve my customer retention?"</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metricsData && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Anomaly Detection Accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {(metricsData.anomalyDetectionAccuracy * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Target: ≥85%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Recommendation Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {(metricsData.recommendationSuccessRate * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Based on implemented actions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {(metricsData.averageConfidenceScore * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Across all insights</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Insights Generated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {metricsData.totalInsightsGenerated}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">In selected timeframe</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Actions Implemented</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">
                    {metricsData.actionsImplemented}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">One-click implementations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600">
                    {metricsData.userSatisfactionScore > 0 ? 
                      (metricsData.userSatisfactionScore * 100).toFixed(1) + '%' : 
                      'N/A'
                    }
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Based on feedback</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}