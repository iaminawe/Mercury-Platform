import React from 'react';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit, 
  Search,
  BookOpen,
  Zap,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  FileText,
  Database
} from 'lucide-react';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  type: 'faq' | 'policy' | 'guide' | 'product_info';
  tags: string[];
  lastUpdated: Date;
  status: 'active' | 'draft' | 'archived';
  usage: number;
}

interface TrainingMetric {
  metric: string;
  current: number;
  target: number;
  improvement: number;
  status: 'good' | 'warning' | 'poor';
}

async function getKnowledgeBase(): Promise<KnowledgeEntry[]> {
  // In a real app, this would fetch from your database
  return [
    {
      id: '1',
      title: 'Shipping Information',
      content: 'We offer several shipping options including standard, express, and overnight delivery...',
      category: 'Shipping',
      type: 'policy',
      tags: ['shipping', 'delivery', 'policy'],
      lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'active',
      usage: 324
    },
    {
      id: '2',
      title: 'Return Policy',
      content: 'Items can be returned within 30 days of purchase. All items must be unused...',
      category: 'Returns',
      type: 'policy',
      tags: ['returns', 'refund', 'policy'],
      lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: 'active',
      usage: 267
    },
    {
      id: '3',
      title: 'Product Care Instructions',
      content: 'To maintain your products in optimal condition...',
      category: 'Product Info',
      type: 'guide',
      tags: ['care', 'maintenance', 'guide'],
      lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'active',
      usage: 89
    },
    {
      id: '4',
      title: 'Account Creation',
      content: 'Creating an account allows you to track orders, save favorites...',
      category: 'Account',
      type: 'guide',
      tags: ['account', 'registration', 'guide'],
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: 'draft',
      usage: 156
    }
  ];
}

async function getTrainingMetrics(): Promise<TrainingMetric[]> {
  return [
    {
      metric: 'Response Accuracy',
      current: 89.2,
      target: 95.0,
      improvement: 2.1,
      status: 'warning'
    },
    {
      metric: 'Intent Recognition',
      current: 94.7,
      target: 98.0,
      improvement: 1.3,
      status: 'good'
    },
    {
      metric: 'Knowledge Coverage',
      current: 76.3,
      target: 90.0,
      improvement: -0.8,
      status: 'poor'
    },
    {
      metric: 'Customer Satisfaction',
      current: 92.1,
      target: 95.0,
      improvement: 3.2,
      status: 'good'
    }
  ];
}

export default async function TrainingPage() {
  const knowledgeBase = await getKnowledgeBase();
  const trainingMetrics = await getTrainingMetrics();

  const stats = {
    totalEntries: knowledgeBase.length,
    activeEntries: knowledgeBase.filter(e => e.status === 'active').length,
    categories: [...new Set(knowledgeBase.map(e => e.category))].length,
    totalUsage: knowledgeBase.reduce((sum, e) => sum + e.usage, 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Training & Knowledge Base</h1>
          <p className="text-gray-600 mt-2">
            Train your chatbot and manage knowledge content
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Training Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {trainingMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">{metric.metric}</h3>
                {metric.status === 'good' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : metric.status === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metric.current}%</span>
                  <span className="text-sm text-gray-500">
                    Target: {metric.target}%
                  </span>
                </div>
                <Progress 
                  value={(metric.current / metric.target) * 100} 
                  className="h-2"
                />
                <div className={`text-xs flex items-center ${
                  metric.improvement > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {metric.improvement > 0 ? '+' : ''}{metric.improvement}% this week
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="knowledge" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="training">Training Data</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-6">
          {/* Knowledge Base Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Entries</p>
                    <p className="text-2xl font-bold">{stats.totalEntries}</p>
                  </div>
                  <Database className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl font-bold">{stats.activeEntries}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Categories</p>
                    <p className="text-2xl font-bold">{stats.categories}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Usage</p>
                    <p className="text-2xl font-bold">{stats.totalUsage.toLocaleString()}</p>
                  </div>
                  <Target className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search knowledge base entries..."
                    className="pl-10"
                  />
                </div>
                <Button variant="outline">
                  Filter by Category
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Entries</CardTitle>
              <CardDescription>
                Manage your chatbot's knowledge content
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {knowledgeBase.map((entry) => (
                  <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-900">{entry.title}</h3>
                          <Badge 
                            variant={entry.status === 'active' ? 'default' : 'secondary'}
                          >
                            {entry.status}
                          </Badge>
                          <Badge variant="outline">{entry.type}</Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {entry.content.substring(0, 150)}...
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Category: {entry.category}</span>
                            <span>•</span>
                            <span>Used {entry.usage} times</span>
                            <span>•</span>
                            <span>Updated {entry.lastUpdated.toLocaleDateString()}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex space-x-1 mt-2">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Session</CardTitle>
                <CardDescription>
                  Start a new training session to improve AI performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Training Type</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Intent Recognition</option>
                    <option>Response Generation</option>
                    <option>Product Recommendations</option>
                    <option>Knowledge Base</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Source</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Recent Conversations</option>
                    <option>Customer Feedback</option>
                    <option>Knowledge Base</option>
                    <option>Custom Dataset</option>
                  </select>
                </div>
                
                <Button className="w-full">
                  <Brain className="w-4 h-4 mr-2" />
                  Start Training
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Training Sessions</CardTitle>
                <CardDescription>
                  History of AI training activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { type: 'Intent Recognition', date: '2 hours ago', improvement: '+2.3%', status: 'completed' },
                    { type: 'Knowledge Base', date: '1 day ago', improvement: '+1.8%', status: 'completed' },
                    { type: 'Response Generation', date: '3 days ago', improvement: '+0.9%', status: 'completed' },
                  ].map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{session.type}</p>
                        <p className="text-sm text-gray-600">{session.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">{session.improvement}</p>
                        <Badge variant="outline">{session.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Analytics</CardTitle>
              <CardDescription>
                Detailed insights into AI performance and training effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 mb-4">
                  Detailed training analytics and performance insights
                </p>
                <Button>
                  View Full Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Optimization</CardTitle>
                <CardDescription>
                  Automated suggestions to improve chatbot performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    title: 'Update Product Information',
                    description: 'Add more detailed product descriptions to knowledge base',
                    impact: 'High',
                    effort: 'Medium'
                  },
                  {
                    title: 'Improve Return Policy Clarity',
                    description: 'Customers often ask follow-up questions about returns',
                    impact: 'Medium',
                    effort: 'Low'
                  },
                  {
                    title: 'Add Shipping Calculator',
                    description: 'Integrate real-time shipping cost calculations',
                    impact: 'High',
                    effort: 'High'
                  }
                ].map((suggestion, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{suggestion.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                        <div className="flex space-x-2">
                          <Badge variant="outline">Impact: {suggestion.impact}</Badge>
                          <Badge variant="outline">Effort: {suggestion.effort}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Implement
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>A/B Testing</CardTitle>
                <CardDescription>
                  Test different response strategies and configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Response Tone Test</h4>
                      <Badge variant="secondary">Running</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Testing formal vs. casual response tone
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Formal (50%)</span>
                        <span>4.2★</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Casual (50%)</span>
                        <span>4.6★</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}