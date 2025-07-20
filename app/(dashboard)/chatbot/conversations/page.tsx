import React from 'react';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Download, 
  MessageCircle, 
  Clock, 
  User,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal
} from 'lucide-react';

interface Conversation {
  id: string;
  sessionId: string;
  customerEmail?: string;
  customerName?: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  status: 'active' | 'completed' | 'escalated' | 'abandoned';
  satisfaction?: number;
  intent: string;
  resolved: boolean;
  tags: string[];
  lastMessage: string;
  assignedAgent?: string;
}

async function getConversations(): Promise<Conversation[]> {
  // In a real app, this would fetch from your database
  return [
    {
      id: '1',
      sessionId: 'sess_abc123',
      customerEmail: 'john@example.com',
      customerName: 'John Smith',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
      messageCount: 8,
      status: 'completed',
      satisfaction: 5,
      intent: 'order_status',
      resolved: true,
      tags: ['order', 'tracking'],
      lastMessage: 'Thank you for your help!',
      assignedAgent: 'Mercury AI'
    },
    {
      id: '2',
      sessionId: 'sess_def456',
      customerEmail: 'sarah@example.com',
      customerName: 'Sarah Johnson',
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      messageCount: 12,
      status: 'escalated',
      intent: 'return_exchange',
      resolved: false,
      tags: ['return', 'escalated'],
      lastMessage: 'I need to speak with a manager',
      assignedAgent: 'Agent Mike'
    },
    {
      id: '3',
      sessionId: 'sess_ghi789',
      customerEmail: 'mike@example.com',
      startTime: new Date(Date.now() - 30 * 60 * 1000),
      messageCount: 5,
      status: 'active',
      intent: 'product_search',
      resolved: false,
      tags: ['product', 'recommendation'],
      lastMessage: 'Can you show me more options?',
      assignedAgent: 'Mercury AI'
    },
    {
      id: '4',
      sessionId: 'sess_jkl012',
      customerEmail: 'emma@example.com',
      customerName: 'Emma Davis',
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 23 * 60 * 60 * 1000),
      messageCount: 6,
      status: 'completed',
      satisfaction: 4,
      intent: 'shipping_info',
      resolved: true,
      tags: ['shipping', 'info'],
      lastMessage: 'Perfect, thank you!',
      assignedAgent: 'Mercury AI'
    },
    {
      id: '5',
      sessionId: 'sess_mno345',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      messageCount: 3,
      status: 'abandoned',
      intent: 'general_inquiry',
      resolved: false,
      tags: ['abandoned'],
      lastMessage: 'Hello, I need help with...',
      assignedAgent: 'Mercury AI'
    }
  ];
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <MessageCircle className="w-4 h-4 text-blue-600" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'escalated':
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    case 'abandoned':
      return <Clock className="w-4 h-4 text-gray-400" />;
    default:
      return <MessageCircle className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusBadge(status: string) {
  const variants = {
    active: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    escalated: 'bg-orange-100 text-orange-800',
    abandoned: 'bg-gray-100 text-gray-800'
  };
  
  return (
    <Badge className={variants[status as keyof typeof variants] || variants.abandoned}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatDuration(start: Date, end?: Date) {
  const endTime = end || new Date();
  const duration = endTime.getTime() - start.getTime();
  const minutes = Math.floor(duration / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

export default async function ConversationsPage() {
  const conversations = await getConversations();

  const stats = {
    total: conversations.length,
    active: conversations.filter(c => c.status === 'active').length,
    completed: conversations.filter(c => c.status === 'completed').length,
    escalated: conversations.filter(c => c.status === 'escalated').length,
    avgSatisfaction: conversations
      .filter(c => c.satisfaction)
      .reduce((acc, c) => acc + (c.satisfaction || 0), 0) / 
      conversations.filter(c => c.satisfaction).length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conversations</h1>
          <p className="text-gray-600 mt-2">
            Monitor and analyze customer chat interactions
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Conversations</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Now</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Escalated</p>
                <p className="text-2xl font-bold">{stats.escalated}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Satisfaction</p>
                <p className="text-2xl font-bold">{stats.avgSatisfaction.toFixed(1)}/5</p>
              </div>
              <ThumbsUp className="w-8 h-8 text-green-600" />
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
                placeholder="Search by customer email, session ID, or message content..."
                className="pl-10"
              />
            </div>
            <Tabs defaultValue="all" className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="escalated">Escalated</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
          <CardDescription>
            Latest customer chat sessions and their outcomes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(conversation.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-medium text-gray-900">
                          {conversation.customerName || conversation.customerEmail || 'Anonymous'}
                        </h3>
                        {getStatusBadge(conversation.status)}
                        
                        {conversation.satisfaction && (
                          <div className="flex items-center space-x-1">
                            {conversation.satisfaction >= 4 ? (
                              <ThumbsUp className="w-4 h-4 text-green-600" />
                            ) : (
                              <ThumbsDown className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm text-gray-600">
                              {conversation.satisfaction}/5
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span>Session: {conversation.sessionId}</span>
                        <span>•</span>
                        <span>{conversation.messageCount} messages</span>
                        <span>•</span>
                        <span>Duration: {formatDuration(conversation.startTime, conversation.endTime)}</span>
                        <span>•</span>
                        <span>Intent: {conversation.intent.replace('_', ' ')}</span>
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-3 line-clamp-2">
                        Last message: "{conversation.lastMessage}"
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {conversation.assignedAgent}
                          </span>
                          
                          <div className="flex space-x-1 ml-4">
                            {conversation.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {conversation.startTime.toLocaleString()}
                          </span>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Load More */}
      <div className="text-center">
        <Button variant="outline">
          Load More Conversations
        </Button>
      </div>
    </div>
  );
}