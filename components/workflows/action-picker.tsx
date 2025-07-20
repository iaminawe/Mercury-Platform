'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Mail, 
  Package, 
  Users, 
  ExternalLink, 
  FileText, 
  Code,
  Plus,
  Edit3,
  Trash2,
  ArrowRight,
  Move,
  Settings
} from 'lucide-react';

interface ActionPickerProps {
  actions: any[];
  onActionsChange: (actions: any[]) => void;
  onNext: () => void;
}

export function ActionPicker({ actions, onActionsChange, onNext }: ActionPickerProps) {
  const [editingAction, setEditingAction] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const actionTypes = [
    {
      id: 'email',
      name: 'Send Email',
      description: 'Send emails to customers, admins, or custom recipients',
      icon: <Mail className="w-6 h-6" />,
      color: 'bg-red-50 border-red-200 text-red-800'
    },
    {
      id: 'inventory',
      name: 'Inventory Management',
      description: 'Update inventory, prices, or product status',
      icon: <Package className="w-6 h-6" />,
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    },
    {
      id: 'customer',
      name: 'Customer Actions',
      description: 'Update customer segments, tags, or data',
      icon: <Users className="w-6 h-6" />,
      color: 'bg-green-50 border-green-200 text-green-800'
    },
    {
      id: 'integration',
      name: 'External Integration',
      description: 'Send data to external services like Slack, Discord, or webhooks',
      icon: <ExternalLink className="w-6 h-6" />,
      color: 'bg-purple-50 border-purple-200 text-purple-800'
    },
    {
      id: 'data_export',
      name: 'Data Export',
      description: 'Export data as CSV, JSON, or other formats',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    },
    {
      id: 'custom',
      name: 'Custom Function',
      description: 'Execute custom code or predefined functions',
      icon: <Code className="w-6 h-6" />,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-800'
    }
  ];

  const createAction = (type: string) => {
    const newAction = {
      id: crypto.randomUUID(),
      name: '',
      type,
      config: {},
      order: actions.length,
      conditions: []
    };
    
    setEditingAction(newAction);
    setIsDialogOpen(true);
  };

  const editAction = (action: any) => {
    setEditingAction({ ...action });
    setIsDialogOpen(true);
  };

  const saveAction = () => {
    if (!editingAction.name.trim()) {
      alert('Please enter an action name');
      return;
    }

    const existingIndex = actions.findIndex(a => a.id === editingAction.id);
    let newActions;

    if (existingIndex >= 0) {
      // Update existing action
      newActions = [...actions];
      newActions[existingIndex] = editingAction;
    } else {
      // Add new action
      newActions = [...actions, editingAction];
    }

    onActionsChange(newActions);
    setIsDialogOpen(false);
    setEditingAction(null);
  };

  const deleteAction = (actionId: string) => {
    const newActions = actions.filter(a => a.id !== actionId);
    // Reorder actions
    newActions.forEach((action, index) => {
      action.order = index;
    });
    onActionsChange(newActions);
  };

  const moveAction = (actionId: string, direction: 'up' | 'down') => {
    const actionIndex = actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;

    const newActions = [...actions];
    const targetIndex = direction === 'up' ? actionIndex - 1 : actionIndex + 1;

    if (targetIndex < 0 || targetIndex >= newActions.length) return;

    // Swap actions
    [newActions[actionIndex], newActions[targetIndex]] = [newActions[targetIndex], newActions[actionIndex]];
    
    // Update order
    newActions.forEach((action, index) => {
      action.order = index;
    });

    onActionsChange(newActions);
  };

  const getActionTypeInfo = (type: string) => {
    return actionTypes.find(t => t.id === type);
  };

  const renderActionConfig = () => {
    if (!editingAction) return null;

    const updateConfig = (key: string, value: any) => {
      setEditingAction({
        ...editingAction,
        config: { ...editingAction.config, [key]: value }
      });
    };

    switch (editingAction.type) {
      case 'email':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Input
                value={editingAction.config.recipient || ''}
                onChange={(e) => updateConfig('recipient', e.target.value)}
                placeholder="admin@store.com or {{customer_email}}"
              />
              <p className="text-sm text-gray-500">
                Use variables like {{customer_email}} for dynamic recipients
              </p>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={editingAction.config.subject || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={editingAction.config.body || ''}
                onChange={(e) => updateConfig('body', e.target.value)}
                placeholder="Email body content"
                rows={4}
              />
              <p className="text-sm text-gray-500">
                Use variables like {{product_name}}, {{customer_name}}, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template ID (Optional)</Label>
              <Input
                value={editingAction.config.template_id || ''}
                onChange={(e) => updateConfig('template_id', e.target.value)}
                placeholder="email-template-id"
              />
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select value={editingAction.config.operation || ''} onValueChange={(value) => updateConfig('operation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reorder">Reorder Stock</SelectItem>
                  <SelectItem value="price_update">Update Price</SelectItem>
                  <SelectItem value="status_change">Change Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingAction.config.operation === 'reorder' && (
              <div className="space-y-2">
                <Label>Reorder Quantity</Label>
                <Input
                  type="number"
                  value={editingAction.config.parameters?.quantity || ''}
                  onChange={(e) => updateConfig('parameters', { ...editingAction.config.parameters, quantity: Number(e.target.value) })}
                  placeholder="100"
                />
              </div>
            )}

            {editingAction.config.operation === 'price_update' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adjustment Type</Label>
                  <Select 
                    value={editingAction.config.parameters?.adjustment_type || ''} 
                    onValueChange={(value) => updateConfig('parameters', { ...editingAction.config.parameters, adjustment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="new_price">New Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={editingAction.config.parameters?.price_adjustment || ''}
                    onChange={(e) => updateConfig('parameters', { ...editingAction.config.parameters, price_adjustment: Number(e.target.value) })}
                    placeholder="10"
                  />
                </div>
              </div>
            )}

            {editingAction.config.operation === 'status_change' && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select 
                  value={editingAction.config.parameters?.status || ''} 
                  onValueChange={(value) => updateConfig('parameters', { ...editingAction.config.parameters, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 'customer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Segment (Optional)</Label>
              <Input
                value={editingAction.config.segment || ''}
                onChange={(e) => updateConfig('segment', e.target.value)}
                placeholder="vip_customers"
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (Comma-separated)</Label>
              <Input
                value={editingAction.config.tags?.join(', ') || ''}
                onChange={(e) => updateConfig('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="new_customer, welcome_sent"
              />
            </div>
          </div>
        );

      case 'integration':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={editingAction.config.service || ''} onValueChange={(value) => updateConfig('service', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="api">API Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editingAction.config.service === 'webhook' || editingAction.config.service === 'api') && (
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input
                  value={editingAction.config.endpoint || ''}
                  onChange={(e) => updateConfig('endpoint', e.target.value)}
                  placeholder="https://api.example.com/webhook"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Payload (JSON)</Label>
              <Textarea
                value={JSON.stringify(editingAction.config.payload || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const payload = JSON.parse(e.target.value);
                    updateConfig('payload', payload);
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='{\n  "message": "{{message}}",\n  "data": "{{trigger_data}}"\n}'
                rows={6}
              />
            </div>
          </div>
        );

      case 'data_export':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={editingAction.config.format || ''} onValueChange={(value) => updateConfig('format', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destination</Label>
              <Input
                value={editingAction.config.destination || ''}
                onChange={(e) => updateConfig('destination', e.target.value)}
                placeholder="email, s3://bucket/path, or /local/path"
              />
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Function Type</Label>
              <Select 
                value={editingAction.config.function_name ? 'predefined' : 'script'} 
                onValueChange={(value) => {
                  if (value === 'predefined') {
                    updateConfig('script', '');
                  } else {
                    updateConfig('function_name', '');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="predefined">Predefined Function</SelectItem>
                  <SelectItem value="script">Custom Script</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingAction.config.function_name !== undefined && (
              <div className="space-y-2">
                <Label>Function Name</Label>
                <Select value={editingAction.config.function_name || ''} onValueChange={(value) => updateConfig('function_name', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select function" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify_admin">Notify Admin</SelectItem>
                    <SelectItem value="backup_data">Backup Data</SelectItem>
                    <SelectItem value="generate_report">Generate Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingAction.config.script !== undefined && (
              <div className="space-y-2">
                <Label>Custom Script</Label>
                <Textarea
                  value={editingAction.config.script || ''}
                  onChange={(e) => updateConfig('script', e.target.value)}
                  placeholder="// Your custom JavaScript code here\nconsole.log('Action executed');\nreturn { success: true };"
                  rows={8}
                />
                <p className="text-sm text-red-600">
                  Warning: Custom scripts should only be used in secure environments
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Add Actions</h2>
        <p className="text-gray-600">Define what happens when your workflow is triggered</p>
      </div>

      {/* Action Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actionTypes.map((type) => (
          <Card
            key={type.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => createAction(type.id)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${type.color}`}>
                  {type.icon}
                </div>
                <div>
                  <CardTitle className="text-base">{type.name}</CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {type.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Current Actions */}
      {actions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Configured Actions</h3>
          
          <div className="space-y-3">
            {actions
              .sort((a, b) => a.order - b.order)
              .map((action, index) => {
                const typeInfo = getActionTypeInfo(action.type);
                return (
                  <Card key={action.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 bg-gray-100 border rounded-full text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className={`p-2 rounded-lg ${typeInfo?.color}`}>
                            {typeInfo?.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {action.name || `${typeInfo?.name || 'Action'}`}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {typeInfo?.name}
                              </Badge>
                              {action.conditions?.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {action.conditions.length} condition{action.conditions.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveAction(action.id, 'up')}
                            disabled={index === 0}
                          >
                            <Move className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editAction(action)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAction(action.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {actions.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No actions configured</h3>
            <p className="text-gray-500 mb-4">
              Add your first action to define what happens when the workflow is triggered
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAction && actions.find(a => a.id === editingAction.id) ? 'Edit' : 'Add'} Action
            </DialogTitle>
            <DialogDescription>
              Configure your {editingAction && getActionTypeInfo(editingAction.type)?.name?.toLowerCase()} action
            </DialogDescription>
          </DialogHeader>
          
          {editingAction && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Action Name</Label>
                <Input
                  value={editingAction.name}
                  onChange={(e) => setEditingAction({ ...editingAction, name: e.target.value })}
                  placeholder="Enter action name"
                />
              </div>

              {renderActionConfig()}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveAction}>
                  {actions.find(a => a.id === editingAction.id) ? 'Update' : 'Add'} Action
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Next Button */}
      <div className="flex justify-end">
        <Button 
          onClick={onNext} 
          disabled={actions.length === 0}
          className="min-w-32"
        >
          Continue to Settings
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}