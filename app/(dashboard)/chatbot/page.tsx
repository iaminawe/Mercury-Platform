import React from 'react';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Brain,
  Languages,
  BarChart3
} from 'lucide-react';
import { ChatAnalytics } from '@/components/dashboard/chat-analytics';

async function getChatbotStats() {
  // In a real app, this would fetch from your database
  return {
    totalConversations: 1847,
    activeConversations: 23,
    resolutionRate: 74.2,
    averageResponseTime: 1.3,
    customerSatisfaction: 4.6,
    languagesSupported: 82,
    topQuestions: [
      { question: 'Order status', count: 324 },
      { question: 'Return policy', count: 267 },
      { question: 'Shipping info', count: 198 },
      { question: 'Product availability', count: 156 },
      { question: 'Account help', count: 143 }
    ],
    recentActivity: [
      { time: '2 mins ago', event: 'Customer escalated to human support', type: 'escalation' },
      { time: '5 mins ago', event: 'Product recommendation clicked', type: 'success' },
      { time: '8 mins ago', event: 'Order #12345 tracked successfully', type: 'success' },
      { time: '12 mins ago', event: 'FAQ answered automatically', type: 'success' },
      { time: '15 mins ago', event: 'New conversation started', type: 'info' }
    ]
  };
}

export default async function ChatbotDashboard() {
  const stats = await getChatbotStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chatbot Management</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage your AI customer service assistant
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button>
            <Brain className="w-4 h-4 mr-2" />
            Train AI
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConversations}</div>
            <p className="text-xs text-green-600">
              +12% from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolutionRate}%</div>
            <p className="text-xs text-green-600">
              +2.1% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageResponseTime}s</div>
            <p className="text-xs text-green-600">
              -0.3s from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerSatisfaction}/5.0</div>
            <p className="text-xs text-green-600">
              +0.2 from last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Questions */}
            <Card>
              <CardHeader>
                <CardTitle>Most Common Questions</CardTitle>
                <CardDescription>
                  Questions customers ask most frequently
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.topQuestions.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="font-medium">{item.question}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest chatbot interactions and events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'escalation' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.event}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Capabilities Overview */}
          <Card>
            <CardHeader>
              <CardTitle>AI Capabilities</CardTitle>
              <CardDescription>
                Current chatbot features and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <Languages className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Multilingual Support</h3>
                  <p className="text-sm text-gray-600">
                    {stats.languagesSupported} languages supported
                  </p>
                  <Badge variant="outline" className="mt-2">Active</Badge>
                </div>

                <div className="text-center">
                  <Brain className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">AI Intelligence</h3>
                  <p className="text-sm text-gray-600">
                    GPT-4 powered responses
                  </p>
                  <Badge variant="outline" className="mt-2">Optimized</Badge>
                </div>

                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Analytics</h3>
                  <p className="text-sm text-gray-600">
                    Real-time performance tracking
                  </p>
                  <Badge variant="outline" className="mt-2">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Suspense fallback={<div>Loading analytics...</div>}>
            <ChatAnalytics />
          </Suspense>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Management</CardTitle>
              <CardDescription>
                Manage FAQ content and training data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Knowledge Base</h3>
                <p className="text-gray-600 mb-4">
                  Train your chatbot with store-specific information
                </p>
                <Button>
                  Go to Training Section
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic chatbot behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Auto-responses</h4>
                    <p className="text-sm text-gray-600">Enable automatic responses</p>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Human handoff</h4>
                    <p className="text-sm text-gray-600">Transfer complex queries to humans</p>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Product recommendations</h4>
                    <p className="text-sm text-gray-600">Show product suggestions in chat</p>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Settings</CardTitle>
                <CardDescription>
                  Optimize chatbot performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Response caching</h4>
                    <p className="text-sm text-gray-600">Cache common responses</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Analytics tracking</h4>
                    <p className="text-sm text-gray-600">Track conversation metrics</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">A/B testing</h4>
                    <p className="text-sm text-gray-600">Test different response strategies</p>
                  </div>
                  <Badge variant="secondary">Beta</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle>AI Training & Optimization</CardTitle>
              <CardDescription>
                Improve chatbot performance through training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Training Center</h3>
                <p className="text-gray-600 mb-4">
                  Access advanced training tools and analytics
                </p>
                <div className="flex justify-center space-x-3">
                  <Button variant="outline">
                    View Training Data
                  </Button>
                  <Button>
                    Start Training Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}