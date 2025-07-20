'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  Target,
  Clock,
  Users,
  Tag
} from 'lucide-react';

interface PersonalizationRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  conditions: {
    segments?: string[];
    userProperties?: Record<string, any>;
    timeConstraints?: {
      startTime?: string;
      endTime?: string;
      daysOfWeek?: number[];
      dateRange?: { start: Date; end: Date };
    };
    contextFilters?: {
      deviceTypes?: string[];
      locations?: string[];
      channels?: string[];
    };
  };
  actions: {
    type: 'content_layout' | 'recommendations' | 'pricing' | 'messaging';
    parameters: Record<string, any>;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cvr: number;
    lift: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export function PersonalizationRules() {
  const [rules, setRules] = useState<PersonalizationRule[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PersonalizationRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 5,
    conditions: {
      segments: [] as string[],
      userProperties: {},
      timeConstraints: {},
      contextFilters: {}
    },
    actions: {
      type: 'recommendations' as const,
      parameters: {}
    }
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/personalization/rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const response = await fetch('/api/personalization/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchRules();
        setIsCreateDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating rule:', error);
    }
  };

  const handleUpdateRule = async (id: string) => {
    try {
      const response = await fetch(`/api/personalization/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchRules();
        setEditingRule(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating rule:', error);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const response = await fetch(`/api/personalization/rules/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/personalization/rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      
      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 5,
      conditions: {
        segments: [],
        userProperties: {},
        timeConstraints: {},
        contextFilters: {}
      },
      actions: {
        type: 'recommendations',
        parameters: {}
      }
    });
  };

  const startEdit = (rule: PersonalizationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions
    });
  };

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case 'content_layout': return <Settings className="h-4 w-4" />;
      case 'recommendations': return <Target className="h-4 w-4" />;
      case 'pricing': return <Tag className="h-4 w-4" />;
      case 'messaging': return <Users className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'content_layout': return 'bg-blue-500';
      case 'recommendations': return 'bg-green-500';
      case 'pricing': return 'bg-purple-500';
      case 'messaging': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Personalization Rules</h2>
          <p className="text-muted-foreground">
            Create and manage rules that control personalization behavior
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Personalization Rule</DialogTitle>
              <DialogDescription>
                Define conditions and actions for personalized experiences
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter rule name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this rule does"
                />
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Conditions</h3>
                
                <div className="space-y-2">
                  <Label>Target Segments</Label>
                  <Input
                    placeholder="Enter segments (comma-separated)"
                    value={formData.conditions.segments?.join(', ') || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        segments: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Device Types</Label>
                    <Select
                      value={formData.conditions.contextFilters?.deviceTypes?.[0] || ''}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          contextFilters: {
                            ...prev.conditions.contextFilters,
                            deviceTypes: value ? [value] : []
                          }
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All devices" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All devices</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Channels</Label>
                    <Select
                      value={formData.conditions.contextFilters?.channels?.[0] || ''}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          contextFilters: {
                            ...prev.conditions.contextFilters,
                            channels: value ? [value] : []
                          }
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All channels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All channels</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="mobile_app">Mobile App</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Actions</h3>
                
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={formData.actions.type}
                    onValueChange={(value: any) => setFormData(prev => ({
                      ...prev,
                      actions: { ...prev.actions, type: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="content_layout">Content Layout</SelectItem>
                      <SelectItem value="recommendations">Recommendations</SelectItem>
                      <SelectItem value="pricing">Dynamic Pricing</SelectItem>
                      <SelectItem value="messaging">Personalized Messaging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Parameters based on type */}
                {formData.actions.type === 'recommendations' && (
                  <div className="space-y-2">
                    <Label>Recommendation Parameters</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Categories"
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          actions: {
                            ...prev.actions,
                            parameters: { ...prev.actions.parameters, categories: e.target.value.split(',') }
                          }
                        }))}
                      />
                      <Input
                        placeholder="Algorithm weight"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          actions: {
                            ...prev.actions,
                            parameters: { ...prev.actions.parameters, weight: parseFloat(e.target.value) }
                          }
                        }))}
                      />
                    </div>
                  </div>
                )}

                {formData.actions.type === 'pricing' && (
                  <div className="space-y-2">
                    <Label>Pricing Parameters</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Max discount %"
                        type="number"
                        min="0"
                        max="50"
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          actions: {
                            ...prev.actions,
                            parameters: { ...prev.actions.parameters, maxDiscount: parseInt(e.target.value) }
                          }
                        }))}
                      />
                      <Input
                        placeholder="Offer type"
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          actions: {
                            ...prev.actions,
                            parameters: { ...prev.actions.parameters, offerType: e.target.value }
                          }
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRule}>
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rules Created</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Create your first personalization rule to start delivering customized experiences.
              </p>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className={`p-1 rounded ${getRuleTypeColor(rule.actions.type)} text-white`}>
                        {getRuleTypeIcon(rule.actions.type)}
                      </div>
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        Priority {rule.priority}
                      </Badge>
                    </div>
                    <CardDescription>{rule.description}</CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Conditions */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Conditions</h4>
                    <div className="space-y-2 text-sm">
                      {rule.conditions.segments && rule.conditions.segments.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span>Segments: {rule.conditions.segments.join(', ')}</span>
                        </div>
                      )}
                      
                      {rule.conditions.contextFilters?.deviceTypes && (
                        <div className="flex items-center gap-2">
                          <Settings className="h-3 w-3 text-muted-foreground" />
                          <span>Devices: {rule.conditions.contextFilters.deviceTypes.join(', ')}</span>
                        </div>
                      )}
                      
                      {rule.conditions.contextFilters?.channels && (
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span>Channels: {rule.conditions.contextFilters.channels.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Performance (30 days)</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-2xl font-bold">{rule.performance.impressions.toLocaleString()}</div>
                        <div className="text-muted-foreground">Impressions</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{(rule.performance.ctr * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground">CTR</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{rule.performance.conversions.toLocaleString()}</div>
                        <div className="text-muted-foreground">Conversions</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${rule.performance.lift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rule.performance.lift >= 0 ? '+' : ''}{(rule.performance.lift * 100).toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">Lift</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Personalization Rule</DialogTitle>
              <DialogDescription>
                Update rule conditions and actions
              </DialogDescription>
            </DialogHeader>
            
            {/* Same form content as create dialog */}
            <div className="space-y-4">
              {/* Form content would be identical to create dialog */}
              <p className="text-sm text-muted-foreground">
                Edit form would be rendered here with current rule values
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRule(null)}>
                Cancel
              </Button>
              <Button onClick={() => handleUpdateRule(editingRule.id)}>
                Update Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}