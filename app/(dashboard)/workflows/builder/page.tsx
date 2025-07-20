'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Play, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Copy,
  Settings,
  Zap,
  Mail,
  Package,
  Users,
  Calendar,
  Activity,
  AlertCircle,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas';
import { TriggerPicker } from '@/components/workflows/trigger-picker';
import { ActionPicker } from '@/components/workflows/action-picker';

interface WorkflowBuilderState {
  workflow: {
    id?: string;
    name: string;
    description: string;
    enabled: boolean;
    trigger: any;
    actions: any[];
    tags: string[];
  };
  isNew: boolean;
  hasChanges: boolean;
  isSaving: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  variables: any[];
}

export default function WorkflowBuilderPage() {
  const [state, setState] = useState<WorkflowBuilderState>({
    workflow: {
      name: '',
      description: '',
      enabled: false,
      trigger: null,
      actions: [],
      tags: []
    },
    isNew: true,
    hasChanges: false,
    isSaving: false
  });

  const [currentStep, setCurrentStep] = useState<'template' | 'trigger' | 'actions' | 'settings'>('template');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTemplates();
    // Check if editing existing workflow
    const urlParams = new URLSearchParams(window.location.search);
    const workflowId = urlParams.get('id');
    if (workflowId) {
      loadWorkflow(workflowId);
    }
  }, []);

  const loadTemplates = async () => {
    try {
      // Mock templates data
      const mockTemplates: Template[] = [
        {
          id: 'low_inventory_alert',
          name: 'Low Inventory Alert',
          description: 'Automatically notify when product inventory falls below a threshold',
          category: 'inventory',
          tags: ['inventory', 'alerts'],
          variables: [
            { key: 'threshold', name: 'Stock Threshold', type: 'number', required: true, default_value: 10 },
            { key: 'admin_email', name: 'Admin Email', type: 'string', required: true }
          ]
        },
        {
          id: 'abandoned_cart_recovery',
          name: 'Abandoned Cart Recovery',
          description: 'Automatically send recovery emails for abandoned carts',
          category: 'marketing',
          tags: ['marketing', 'email'],
          variables: [
            { key: 'delay_hours', name: 'Email Delay (hours)', type: 'number', required: true, default_value: 24 },
            { key: 'discount_code', name: 'Discount Code', type: 'string', required: false }
          ]
        },
        {
          id: 'new_customer_welcome',
          name: 'New Customer Welcome',
          description: 'Welcome new customers with an automated email sequence',
          category: 'customer',
          tags: ['customer', 'welcome'],
          variables: [
            { key: 'discount_percent', name: 'Welcome Discount (%)', type: 'number', required: true, default_value: 10 },
            { key: 'store_name', name: 'Store Name', type: 'string', required: true }
          ]
        },
        {
          id: 'daily_sales_report',
          name: 'Daily Sales Report',
          description: 'Generate and send daily sales reports',
          category: 'analytics',
          tags: ['analytics', 'reporting'],
          variables: [
            { key: 'report_recipients', name: 'Report Recipients', type: 'string', required: true },
            { key: 'report_format', name: 'Report Format', type: 'select', required: true, default_value: 'csv' }
          ]
        }
      ];
      
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadWorkflow = async (id: string) => {
    try {
      // Mock workflow data
      setState(prev => ({
        ...prev,
        workflow: {
          id,
          name: 'Low Inventory Alert',
          description: 'Notify when products are running low on stock',
          enabled: true,
          trigger: {
            type: 'threshold',
            config: { metric: 'low_inventory', operator: 'gt', value: 10 }
          },
          actions: [
            {
              id: '1',
              name: 'Send Email Alert',
              type: 'email',
              config: { recipient: 'admin@store.com', subject: 'Low Stock Alert' },
              order: 1
            }
          ],
          tags: ['inventory', 'alerts']
        },
        isNew: false
      }));
      setCurrentStep('settings');
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    
    // Initialize template variables with defaults
    const initialVariables: Record<string, any> = {};
    template.variables.forEach(variable => {
      if (variable.default_value !== undefined) {
        initialVariables[variable.key] = variable.default_value;
      }
    });
    setTemplateVariables(initialVariables);
  };

  const createFromTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      // Validate required variables
      const missingVariables = selectedTemplate.variables
        .filter(v => v.required && !templateVariables[v.key])
        .map(v => v.name);

      if (missingVariables.length > 0) {
        alert(`Please fill in required fields: ${missingVariables.join(', ')}`);
        return;
      }

      // Create workflow from template
      setState(prev => ({
        ...prev,
        workflow: {
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          enabled: false,
          trigger: {
            type: 'data_change',
            config: { table: 'products', operation: 'update' }
          },
          actions: [],
          tags: selectedTemplate.tags
        },
        hasChanges: true
      }));

      setCurrentStep('trigger');
    } catch (error) {
      console.error('Failed to create from template:', error);
    }
  };

  const saveWorkflow = async () => {
    if (!state.workflow.name.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    if (!state.workflow.trigger) {
      alert('Please configure a trigger');
      return;
    }

    if (state.workflow.actions.length === 0) {
      alert('Please add at least one action');
      return;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      // API call to save workflow
      console.log('Saving workflow:', state.workflow);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setState(prev => ({ ...prev, hasChanges: false }));
      
      // Redirect to workflows list
      window.location.href = '/workflows';
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow. Please try again.');
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  };

  const testWorkflow = async () => {
    try {
      console.log('Testing workflow:', state.workflow);
      alert('Workflow test completed successfully!');
    } catch (error) {
      console.error('Failed to test workflow:', error);
      alert('Workflow test failed. Please check your configuration.');
    }
  };

  const updateWorkflow = (updates: Partial<typeof state.workflow>) => {
    setState(prev => ({
      ...prev,
      workflow: { ...prev.workflow, ...updates },
      hasChanges: true
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'inventory': return <Package className="w-5 h-5" />;
      case 'marketing': return <Mail className="w-5 h-5" />;
      case 'customer': return <Users className="w-5 h-5" />;
      case 'analytics': return <Activity className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getStepIcon = (step: string, isActive: boolean, isCompleted: boolean) => {
    const className = `w-5 h-5 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`;
    
    switch (step) {
      case 'template': return <Copy className={className} />;
      case 'trigger': return <Zap className={className} />;
      case 'actions': return <Activity className={className} />;
      case 'settings': return <Settings className={className} />;
      default: return <Activity className={className} />;
    }
  };

  const isStepCompleted = (step: string) => {
    switch (step) {
      case 'template': return selectedTemplate !== null || !state.isNew;
      case 'trigger': return state.workflow.trigger !== null;
      case 'actions': return state.workflow.actions.length > 0;
      case 'settings': return state.workflow.name.trim() !== '';
      default: return false;
    }
  };

  const canProceedToStep = (step: string) => {
    switch (step) {
      case 'trigger': return selectedTemplate !== null || !state.isNew;
      case 'actions': return state.workflow.trigger !== null;
      case 'settings': return state.workflow.actions.length > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/workflows">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Workflows
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                {state.isNew ? 'Create Workflow' : 'Edit Workflow'}
              </h1>
              <p className="text-gray-600">
                {state.workflow.name || 'Build automated workflows for your store'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={testWorkflow} disabled={!state.workflow.trigger}>
              <Play className="w-4 h-4 mr-2" />
              Test
            </Button>
            <Button onClick={saveWorkflow} disabled={state.isSaving}>
              {state.isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {state.isSaving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Progress Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <div className="space-y-2">
            {[
              { key: 'template', label: 'Choose Template', description: 'Start with a template' },
              { key: 'trigger', label: 'Configure Trigger', description: 'When to run' },
              { key: 'actions', label: 'Add Actions', description: 'What to do' },
              { key: 'settings', label: 'Workflow Settings', description: 'Name and details' }
            ].map((step, index) => {
              const isActive = currentStep === step.key;
              const isCompleted = isStepCompleted(step.key);
              const canProceed = canProceedToStep(step.key);
              
              return (
                <button
                  key={step.key}
                  onClick={() => canProceed && setCurrentStep(step.key as any)}
                  disabled={!canProceed}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-50 border-blue-200 border'
                      : isCompleted
                      ? 'bg-green-50 hover:bg-green-100'
                      : canProceed
                      ? 'hover:bg-gray-50'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        getStepIcon(step.key, isActive, isCompleted)
                      )}
                    </div>
                    <div>
                      <div className={`font-medium ${isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-900'}`}>
                        {step.label}
                      </div>
                      <div className="text-sm text-gray-500">
                        {step.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {currentStep === 'template' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Choose a Template</h2>
                <p className="text-gray-600">Start with a pre-built template or create from scratch</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Custom Workflow Option */}
                <Card 
                  className={`cursor-pointer transition-colors ${
                    selectedTemplate === null ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                  }`}
                  onClick={() => {
                    setSelectedTemplate(null);
                    setCurrentStep('trigger');
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-lg">Create from Scratch</CardTitle>
                    </div>
                    <CardDescription>
                      Build a custom workflow with full control over triggers and actions
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Template Options */}
                {templates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(template.category)}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Template Variables */}
              {selectedTemplate && (
                <Card>
                  <CardHeader>
                    <CardTitle>Configure Template</CardTitle>
                    <CardDescription>
                      Customize the template settings for your store
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable.key} className="space-y-2">
                        <Label htmlFor={variable.key}>
                          {variable.name}
                          {variable.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {variable.type === 'select' ? (
                          <Select
                            value={templateVariables[variable.key] || ''}
                            onValueChange={(value) => 
                              setTemplateVariables(prev => ({ ...prev, [variable.key]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {variable.options?.map((option: any) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={variable.key}
                            type={variable.type === 'number' ? 'number' : 'text'}
                            value={templateVariables[variable.key] || ''}
                            onChange={(e) => 
                              setTemplateVariables(prev => ({ 
                                ...prev, 
                                [variable.key]: variable.type === 'number' ? Number(e.target.value) : e.target.value 
                              }))
                            }
                            placeholder={variable.description}
                          />
                        )}
                        <p className="text-sm text-gray-500">{variable.description}</p>
                      </div>
                    ))}
                    
                    <Button onClick={createFromTemplate} className="w-full">
                      Create Workflow from Template
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {currentStep === 'trigger' && (
            <TriggerPicker
              trigger={state.workflow.trigger}
              onTriggerChange={(trigger) => updateWorkflow({ trigger })}
              onNext={() => setCurrentStep('actions')}
            />
          )}

          {currentStep === 'actions' && (
            <ActionPicker
              actions={state.workflow.actions}
              onActionsChange={(actions) => updateWorkflow({ actions })}
              onNext={() => setCurrentStep('settings')}
            />
          )}

          {currentStep === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Workflow Settings</h2>
                <p className="text-gray-600">Configure the basic settings for your workflow</p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Workflow Name *</Label>
                    <Input
                      id="name"
                      value={state.workflow.name}
                      onChange={(e) => updateWorkflow({ name: e.target.value })}
                      placeholder="Enter workflow name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={state.workflow.description}
                      onChange={(e) => updateWorkflow({ description: e.target.value })}
                      placeholder="Describe what this workflow does"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={state.workflow.tags.join(', ')}
                      onChange={(e) => updateWorkflow({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      placeholder="Enter tags separated by commas"
                    />
                    <p className="text-sm text-gray-500">
                      Tags help organize and filter your workflows
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Workflow Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Summary</CardTitle>
                  <CardDescription>
                    Review your workflow configuration before saving
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WorkflowCanvas
                    trigger={state.workflow.trigger}
                    actions={state.workflow.actions}
                    readonly={true}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}