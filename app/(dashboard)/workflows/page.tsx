'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Copy,
  Activity,
  Calendar,
  Mail,
  Package,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  actions_count: number;
  run_count: number;
  success_rate: number;
  last_run?: string;
  created_at: string;
  tags: string[];
  status: 'active' | 'paused' | 'error';
}

interface WorkflowMetrics {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  success_rate: number;
  executions_today: number;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
    loadMetrics();
  }, []);

  const loadWorkflows = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockWorkflows: Workflow[] = [
        {
          id: '1',
          name: 'Low Inventory Alert',
          description: 'Notify when products are running low on stock',
          enabled: true,
          trigger_type: 'threshold',
          actions_count: 2,
          run_count: 156,
          success_rate: 98.7,
          last_run: '2024-01-15T10:30:00Z',
          created_at: '2024-01-01T00:00:00Z',
          tags: ['inventory', 'alerts'],
          status: 'active'
        },
        {
          id: '2',
          name: 'Abandoned Cart Recovery',
          description: 'Send recovery emails for abandoned shopping carts',
          enabled: true,
          trigger_type: 'data_change',
          actions_count: 3,
          run_count: 45,
          success_rate: 76.8,
          last_run: '2024-01-15T09:15:00Z',
          created_at: '2024-01-05T00:00:00Z',
          tags: ['marketing', 'email'],
          status: 'active'
        },
        {
          id: '3',
          name: 'Daily Sales Report',
          description: 'Generate and send daily sales reports to team',
          enabled: false,
          trigger_type: 'time_based',
          actions_count: 2,
          run_count: 30,
          success_rate: 100,
          last_run: '2024-01-14T08:00:00Z',
          created_at: '2024-01-10T00:00:00Z',
          tags: ['reporting', 'analytics'],
          status: 'paused'
        },
        {
          id: '4',
          name: 'New Customer Welcome',
          description: 'Welcome new customers with personalized emails',
          enabled: true,
          trigger_type: 'data_change',
          actions_count: 2,
          run_count: 23,
          success_rate: 95.7,
          last_run: '2024-01-15T11:45:00Z',
          created_at: '2024-01-12T00:00:00Z',
          tags: ['customer', 'welcome'],
          status: 'active'
        }
      ];
      
      setWorkflows(mockWorkflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      // Mock metrics data
      const mockMetrics: WorkflowMetrics = {
        total_workflows: 4,
        active_workflows: 3,
        total_executions: 254,
        success_rate: 92.8,
        executions_today: 12
      };
      
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const toggleWorkflow = async (id: string, enabled: boolean) => {
    try {
      // API call to toggle workflow
      setWorkflows(workflows.map(w => 
        w.id === id ? { ...w, enabled, status: enabled ? 'active' : 'paused' } : w
      ));
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
                           workflow.tags.includes(selectedCategory) ||
                           (selectedCategory === 'active' && workflow.enabled) ||
                           (selectedCategory === 'paused' && !workflow.enabled);
    
    return matchesSearch && matchesCategory;
  });

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'data_change': return <Package className="w-4 h-4" />;
      case 'time_based': return <Calendar className="w-4 h-4" />;
      case 'threshold': return <AlertCircle className="w-4 h-4" />;
      case 'external_event': return <Activity className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflow Automation</h1>
          <p className="text-gray-600 mt-1">
            Automate your store operations with intelligent workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/workflows/builder">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Workflows</p>
                  <p className="text-2xl font-bold">{metrics.total_workflows}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.active_workflows}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.success_rate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Runs</p>
                  <p className="text-2xl font-bold">{metrics.executions_today}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
            <TabsTrigger value="customer">Customer</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredWorkflows.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {getTriggerIcon(workflow.trigger_type)}
                  <CardTitle className="text-lg">{workflow.name}</CardTitle>
                </div>
                <Switch
                  checked={workflow.enabled}
                  onCheckedChange={(enabled) => toggleWorkflow(workflow.id, enabled)}
                />
              </div>
              <CardDescription className="line-clamp-2">
                {workflow.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Status and Tags */}
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(workflow.status)}>
                  {workflow.status}
                </Badge>
                <div className="flex gap-1">
                  {workflow.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {workflow.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{workflow.tags.length - 2}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <p className="font-medium">{workflow.actions_count}</p>
                  <p className="text-gray-500">Actions</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{workflow.run_count}</p>
                  <p className="text-gray-500">Runs</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{workflow.success_rate}%</p>
                  <p className="text-gray-500">Success</p>
                </div>
              </div>

              {/* Last Run */}
              {workflow.last_run && (
                <div className="text-sm text-gray-500">
                  Last run: {formatDate(workflow.last_run)}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Link href={`/workflows/builder?id=${workflow.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button variant="outline" size="sm">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredWorkflows.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No workflows found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first workflow'
              }
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <Link href="/workflows/builder">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Workflow
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}