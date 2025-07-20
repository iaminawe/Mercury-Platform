// Visual Experiment Builder Component
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Minus, 
  Target, 
  Users, 
  Settings, 
  Brain,
  Zap,
  BarChart3,
  Calendar,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface ExperimentConfig {
  name: string;
  description: string;
  hypothesis: string;
  type: 'ab_test' | 'multivariate' | 'multi_armed_bandit';
  traffic_allocation: number;
  variants: Variant[];
  success_metrics: SuccessMetric[];
  targeting_rules: TargetingRule[];
  statistical_config: StatisticalConfig;
  duration_days?: number;
  auto_stop: boolean;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  traffic_percentage: number;
  is_control: boolean;
  config: VariantConfig;
}

interface VariantConfig {
  type: 'code_change' | 'feature_flag' | 'ui_component' | 'email_template' | 'pricing';
  changes: Record<string, any>;
}

interface SuccessMetric {
  id: string;
  name: string;
  type: 'conversion' | 'revenue' | 'engagement' | 'retention';
  event_name: string;
  is_primary: boolean;
  goal_direction: 'increase' | 'decrease';
  minimum_detectable_effect: number;
}

interface TargetingRule {
  id: string;
  condition_type: 'user_property' | 'session_property' | 'geographic' | 'device';
  property_name: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  property_value: string;
  inclusion: boolean;
}

interface StatisticalConfig {
  confidence_level: number;
  power: number;
  minimum_sample_size: number;
  sequential_testing: boolean;
  multiple_comparisons_correction: 'bonferroni' | 'benjamini_hochberg' | 'none';
}

const EXPERIMENT_TEMPLATES = {
  product_page: {
    name: 'Product Page Optimization',
    description: 'Test different product page layouts and elements',
    variants: [
      { name: 'Control', description: 'Current product page' },
      { name: 'Hero Image Variant', description: 'Larger hero image with different positioning' }
    ],
    metrics: [
      { name: 'Add to Cart Rate', type: 'conversion', event: 'add_to_cart' },
      { name: 'Purchase Rate', type: 'conversion', event: 'purchase' }
    ]
  },
  email_campaign: {
    name: 'Email Campaign Test',
    description: 'Optimize email subject lines and content',
    variants: [
      { name: 'Control Subject', description: 'Current email subject line' },
      { name: 'Personalized Subject', description: 'Subject line with user name' }
    ],
    metrics: [
      { name: 'Open Rate', type: 'engagement', event: 'email_open' },
      { name: 'Click Through Rate', type: 'engagement', event: 'email_click' }
    ]
  },
  checkout_flow: {
    name: 'Checkout Flow Optimization',
    description: 'Test different checkout processes',
    variants: [
      { name: 'Multi-step Checkout', description: 'Current 3-step checkout process' },
      { name: 'Single Page Checkout', description: 'All checkout steps on one page' }
    ],
    metrics: [
      { name: 'Checkout Completion Rate', type: 'conversion', event: 'checkout_complete' },
      { name: 'Cart Abandonment Rate', type: 'conversion', event: 'cart_abandon' }
    ]
  },
  pricing_strategy: {
    name: 'Pricing Strategy Test',
    description: 'Test different pricing displays and strategies',
    variants: [
      { name: 'Current Pricing', description: 'Standard price display' },
      { name: 'Bundle Pricing', description: 'Show bundle discounts prominently' }
    ],
    metrics: [
      { name: 'Purchase Rate', type: 'conversion', event: 'purchase' },
      { name: 'Average Order Value', type: 'revenue', event: 'purchase' }
    ]
  }
};

interface ExperimentBuilderProps {
  onSave: (experiment: ExperimentConfig) => void;
  initialData?: Partial<ExperimentConfig>;
}

export function ExperimentBuilder({ onSave, initialData }: ExperimentBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [experiment, setExperiment] = useState<ExperimentConfig>({
    name: '',
    description: '',
    hypothesis: '',
    type: 'ab_test',
    traffic_allocation: 100,
    variants: [
      {
        id: 'control',
        name: 'Control',
        description: 'Current version',
        traffic_percentage: 50,
        is_control: true,
        config: { type: 'ui_component', changes: {} }
      },
      {
        id: 'treatment',
        name: 'Treatment',
        description: 'New version',
        traffic_percentage: 50,
        is_control: false,
        config: { type: 'ui_component', changes: {} }
      }
    ],
    success_metrics: [],
    targeting_rules: [],
    statistical_config: {
      confidence_level: 95,
      power: 80,
      minimum_sample_size: 1000,
      sequential_testing: false,
      multiple_comparisons_correction: 'benjamini_hochberg'
    },
    auto_stop: true,
    ...initialData
  });

  const steps = [
    { id: 'basic', title: 'Basic Info', icon: Settings },
    { id: 'variants', title: 'Variants', icon: Target },
    { id: 'metrics', title: 'Success Metrics', icon: BarChart3 },
    { id: 'targeting', title: 'Targeting', icon: Users },
    { id: 'statistical', title: 'Statistical', icon: Brain },
    { id: 'review', title: 'Review', icon: CheckCircle }
  ];

  const applyTemplate = (templateKey: keyof typeof EXPERIMENT_TEMPLATES) => {
    const template = EXPERIMENT_TEMPLATES[templateKey];
    setExperiment(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      variants: template.variants.map((v, i) => ({
        id: i === 0 ? 'control' : `treatment_${i}`,
        name: v.name,
        description: v.description,
        traffic_percentage: 100 / template.variants.length,
        is_control: i === 0,
        config: { type: 'ui_component', changes: {} }
      })),
      success_metrics: template.metrics.map((m, i) => ({
        id: `metric_${i}`,
        name: m.name,
        type: m.type as any,
        event_name: m.event,
        is_primary: i === 0,
        goal_direction: 'increase',
        minimum_detectable_effect: 5
      }))
    }));
  };

  const addVariant = () => {
    const newVariant: Variant = {
      id: `variant_${Date.now()}`,
      name: `Variant ${experiment.variants.length + 1}`,
      description: '',
      traffic_percentage: 0,
      is_control: false,
      config: { type: 'ui_component', changes: {} }
    };

    setExperiment(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant]
    }));

    // Rebalance traffic allocation
    rebalanceTraffic();
  };

  const removeVariant = (variantId: string) => {
    if (experiment.variants.length <= 2) return; // Must have at least 2 variants

    setExperiment(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== variantId)
    }));

    rebalanceTraffic();
  };

  const rebalanceTraffic = () => {
    const variantCount = experiment.variants.length;
    const evenSplit = Math.floor(100 / variantCount);
    const remainder = 100 % variantCount;

    setExperiment(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => ({
        ...variant,
        traffic_percentage: evenSplit + (index < remainder ? 1 : 0)
      }))
    }));
  };

  const updateVariant = (variantId: string, updates: Partial<Variant>) => {
    setExperiment(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === variantId ? { ...v, ...updates } : v
      )
    }));
  };

  const addSuccessMetric = () => {
    const newMetric: SuccessMetric = {
      id: `metric_${Date.now()}`,
      name: '',
      type: 'conversion',
      event_name: '',
      is_primary: experiment.success_metrics.length === 0,
      goal_direction: 'increase',
      minimum_detectable_effect: 5
    };

    setExperiment(prev => ({
      ...prev,
      success_metrics: [...prev.success_metrics, newMetric]
    }));
  };

  const removeSuccessMetric = (metricId: string) => {
    setExperiment(prev => ({
      ...prev,
      success_metrics: prev.success_metrics.filter(m => m.id !== metricId)
    }));
  };

  const addTargetingRule = () => {
    const newRule: TargetingRule = {
      id: `rule_${Date.now()}`,
      condition_type: 'user_property',
      property_name: '',
      operator: 'equals',
      property_value: '',
      inclusion: true
    };

    setExperiment(prev => ({
      ...prev,
      targeting_rules: [...prev.targeting_rules, newRule]
    }));
  };

  const validateExperiment = () => {
    const errors: string[] = [];

    if (!experiment.name.trim()) errors.push('Experiment name is required');
    if (!experiment.description.trim()) errors.push('Description is required');
    if (!experiment.hypothesis.trim()) errors.push('Hypothesis is required');
    if (experiment.variants.length < 2) errors.push('At least 2 variants are required');
    if (experiment.success_metrics.length === 0) errors.push('At least 1 success metric is required');

    const totalTraffic = experiment.variants.reduce((sum, v) => sum + v.traffic_percentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.1) errors.push('Variant traffic must sum to 100%');

    const controlVariants = experiment.variants.filter(v => v.is_control);
    if (controlVariants.length !== 1) errors.push('Exactly one control variant is required');

    return errors;
  };

  const handleSave = () => {
    const errors = validateExperiment();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }

    onSave(experiment);
  };

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Choose a Template (Optional)</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {Object.entries(EXPERIMENT_TEMPLATES).map(([key, template]) => (
                  <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => applyTemplate(key as keyof typeof EXPERIMENT_TEMPLATES)}>
                    <CardContent className="p-4">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Experiment Name*</Label>
                <Input
                  id="name"
                  value={experiment.name}
                  onChange={(e) => setExperiment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Product Page CTA Button Test"
                />
              </div>

              <div>
                <Label htmlFor="description">Description*</Label>
                <Textarea
                  id="description"
                  value={experiment.description}
                  onChange={(e) => setExperiment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this experiment is testing..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="hypothesis">Hypothesis*</Label>
                <Textarea
                  id="hypothesis"
                  value={experiment.hypothesis}
                  onChange={(e) => setExperiment(prev => ({ ...prev, hypothesis: e.target.value }))}
                  placeholder="e.g., Changing the CTA button color from blue to orange will increase conversion rates by at least 10%"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Experiment Type</Label>
                  <Select value={experiment.type} onValueChange={(value: any) => 
                    setExperiment(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ab_test">A/B Test</SelectItem>
                      <SelectItem value="multivariate">Multivariate Test</SelectItem>
                      <SelectItem value="multi_armed_bandit">Multi-Armed Bandit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="traffic">Traffic Allocation (%)</Label>
                  <Input
                    id="traffic"
                    type="number"
                    min="1"
                    max="100"
                    value={experiment.traffic_allocation}
                    onChange={(e) => setExperiment(prev => ({ 
                      ...prev, 
                      traffic_allocation: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration">Expected Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={experiment.duration_days || ''}
                  onChange={(e) => setExperiment(prev => ({ 
                    ...prev, 
                    duration_days: parseInt(e.target.value) || undefined 
                  }))}
                  placeholder="Leave empty for indefinite"
                />
              </div>
            </div>
          </div>
        );

      case 'variants':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Configure Variants</h3>
              <Button onClick={addVariant} disabled={experiment.variants.length >= 5}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            </div>

            <div className="space-y-4">
              {experiment.variants.map((variant, index) => (
                <Card key={variant.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {variant.is_control ? '🔵' : `🟠`}
                        </span>
                        <Input
                          value={variant.name}
                          onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                          className="font-medium"
                          placeholder="Variant name"
                        />
                        {variant.is_control && (
                          <Badge variant="outline">Control</Badge>
                        )}
                      </div>
                      
                      {experiment.variants.length > 2 && !variant.is_control && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeVariant(variant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={variant.description}
                          onChange={(e) => updateVariant(variant.id, { description: e.target.value })}
                          placeholder="Describe this variant..."
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <Label>Traffic Percentage</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={variant.traffic_percentage}
                          onChange={(e) => updateVariant(variant.id, { 
                            traffic_percentage: parseInt(e.target.value) || 0 
                          })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Variant Configuration</Label>
                      <Select 
                        value={variant.config.type}
                        onValueChange={(value: any) => updateVariant(variant.id, {
                          config: { ...variant.config, type: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ui_component">UI Component</SelectItem>
                          <SelectItem value="feature_flag">Feature Flag</SelectItem>
                          <SelectItem value="code_change">Code Change</SelectItem>
                          <SelectItem value="email_template">Email Template</SelectItem>
                          <SelectItem value="pricing">Pricing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span>Total Traffic Allocation:</span>
                <span className={`font-medium ${
                  Math.abs(experiment.variants.reduce((sum, v) => sum + v.traffic_percentage, 0) - 100) > 0.1
                    ? 'text-red-600' : 'text-green-600'
                }`}>
                  {experiment.variants.reduce((sum, v) => sum + v.traffic_percentage, 0)}%
                </span>
              </div>
              <Progress 
                value={experiment.variants.reduce((sum, v) => sum + v.traffic_percentage, 0)} 
                className="mt-2"
              />
              {Math.abs(experiment.variants.reduce((sum, v) => sum + v.traffic_percentage, 0) - 100) > 0.1 && (
                <p className="text-red-600 text-xs mt-1">
                  Traffic percentages must sum to 100%
                </p>
              )}
            </div>
          </div>
        );

      case 'metrics':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Success Metrics</h3>
              <Button onClick={addSuccessMetric}>
                <Plus className="h-4 w-4 mr-2" />
                Add Metric
              </Button>
            </div>

            <div className="space-y-4">
              {experiment.success_metrics.map((metric, index) => (
                <Card key={metric.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        <Input
                          value={metric.name}
                          onChange={(e) => setExperiment(prev => ({
                            ...prev,
                            success_metrics: prev.success_metrics.map(m =>
                              m.id === metric.id ? { ...m, name: e.target.value } : m
                            )
                          }))}
                          placeholder="Metric name"
                        />
                        {metric.is_primary && (
                          <Badge>Primary</Badge>
                        )}
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeSuccessMetric(metric.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Metric Type</Label>
                        <Select 
                          value={metric.type}
                          onValueChange={(value: any) => setExperiment(prev => ({
                            ...prev,
                            success_metrics: prev.success_metrics.map(m =>
                              m.id === metric.id ? { ...m, type: value } : m
                            )
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conversion">Conversion</SelectItem>
                            <SelectItem value="revenue">Revenue</SelectItem>
                            <SelectItem value="engagement">Engagement</SelectItem>
                            <SelectItem value="retention">Retention</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Event Name</Label>
                        <Input
                          value={metric.event_name}
                          onChange={(e) => setExperiment(prev => ({
                            ...prev,
                            success_metrics: prev.success_metrics.map(m =>
                              m.id === metric.id ? { ...m, event_name: e.target.value } : m
                            )
                          }))}
                          placeholder="e.g., add_to_cart, purchase"
                        />
                      </div>

                      <div>
                        <Label>Goal Direction</Label>
                        <Select 
                          value={metric.goal_direction}
                          onValueChange={(value: any) => setExperiment(prev => ({
                            ...prev,
                            success_metrics: prev.success_metrics.map(m =>
                              m.id === metric.id ? { ...m, goal_direction: value } : m
                            )
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="increase">Increase</SelectItem>
                            <SelectItem value="decrease">Decrease</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Min Detectable Effect (%)</Label>
                        <Input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={metric.minimum_detectable_effect}
                          onChange={(e) => setExperiment(prev => ({
                            ...prev,
                            success_metrics: prev.success_metrics.map(m =>
                              m.id === metric.id ? { 
                                ...m, 
                                minimum_detectable_effect: parseFloat(e.target.value) || 0 
                              } : m
                            )
                          }))}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-2">
                      <Switch
                        checked={metric.is_primary}
                        onCheckedChange={(checked) => setExperiment(prev => ({
                          ...prev,
                          success_metrics: prev.success_metrics.map(m =>
                            m.id === metric.id ? { ...m, is_primary: checked } : 
                            checked ? { ...m, is_primary: false } : m
                          )
                        }))}
                      />
                      <Label>Primary metric</Label>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {experiment.success_metrics.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No success metrics defined yet.</p>
                  <p className="text-sm">Add at least one metric to measure experiment success.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'targeting':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Targeting Rules</h3>
                <p className="text-sm text-gray-600">Define who should be included in the experiment</p>
              </div>
              <Button onClick={addTargetingRule}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-4">
              {experiment.targeting_rules.map((rule, index) => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Condition Type</Label>
                        <Select 
                          value={rule.condition_type}
                          onValueChange={(value: any) => setExperiment(prev => ({
                            ...prev,
                            targeting_rules: prev.targeting_rules.map(r =>
                              r.id === rule.id ? { ...r, condition_type: value } : r
                            )
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user_property">User Property</SelectItem>
                            <SelectItem value="session_property">Session Property</SelectItem>
                            <SelectItem value="geographic">Geographic</SelectItem>
                            <SelectItem value="device">Device</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Property</Label>
                        <Input
                          value={rule.property_name}
                          onChange={(e) => setExperiment(prev => ({
                            ...prev,
                            targeting_rules: prev.targeting_rules.map(r =>
                              r.id === rule.id ? { ...r, property_name: e.target.value } : r
                            )
                          }))}
                          placeholder="e.g., country, device_type"
                        />
                      </div>

                      <div>
                        <Label>Operator</Label>
                        <Select 
                          value={rule.operator}
                          onValueChange={(value: any) => setExperiment(prev => ({
                            ...prev,
                            targeting_rules: prev.targeting_rules.map(r =>
                              r.id === rule.id ? { ...r, operator: value } : r
                            )
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                            <SelectItem value="in">In List</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Value</Label>
                        <div className="flex gap-2">
                          <Input
                            value={rule.property_value}
                            onChange={(e) => setExperiment(prev => ({
                              ...prev,
                              targeting_rules: prev.targeting_rules.map(r =>
                                r.id === rule.id ? { ...r, property_value: e.target.value } : r
                              )
                            }))}
                            placeholder="e.g., US, mobile"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setExperiment(prev => ({
                              ...prev,
                              targeting_rules: prev.targeting_rules.filter(r => r.id !== rule.id)
                            }))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-2">
                      <Switch
                        checked={rule.inclusion}
                        onCheckedChange={(checked) => setExperiment(prev => ({
                          ...prev,
                          targeting_rules: prev.targeting_rules.map(r =>
                            r.id === rule.id ? { ...r, inclusion: checked } : r
                          )
                        }))}
                      />
                      <Label>{rule.inclusion ? 'Include' : 'Exclude'} users matching this rule</Label>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {experiment.targeting_rules.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No targeting rules defined.</p>
                  <p className="text-sm">The experiment will include all visitors.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'statistical':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Statistical Configuration</h3>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Significance Testing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Confidence Level (%)</Label>
                    <Select 
                      value={experiment.statistical_config.confidence_level.toString()}
                      onValueChange={(value) => setExperiment(prev => ({
                        ...prev,
                        statistical_config: {
                          ...prev.statistical_config,
                          confidence_level: parseInt(value)
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="95">95%</SelectItem>
                        <SelectItem value="99">99%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Statistical Power (%)</Label>
                    <Select 
                      value={experiment.statistical_config.power.toString()}
                      onValueChange={(value) => setExperiment(prev => ({
                        ...prev,
                        statistical_config: {
                          ...prev.statistical_config,
                          power: parseInt(value)
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Minimum Sample Size</Label>
                    <Input
                      type="number"
                      min="100"
                      value={experiment.statistical_config.minimum_sample_size}
                      onChange={(e) => setExperiment(prev => ({
                        ...prev,
                        statistical_config: {
                          ...prev.statistical_config,
                          minimum_sample_size: parseInt(e.target.value) || 1000
                        }
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Advanced Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={experiment.statistical_config.sequential_testing}
                      onCheckedChange={(checked) => setExperiment(prev => ({
                        ...prev,
                        statistical_config: {
                          ...prev.statistical_config,
                          sequential_testing: checked
                        }
                      }))}
                    />
                    <div>
                      <Label>Sequential Testing</Label>
                      <p className="text-xs text-gray-600">Allow early stopping when significance is reached</p>
                    </div>
                  </div>

                  <div>
                    <Label>Multiple Comparisons Correction</Label>
                    <Select 
                      value={experiment.statistical_config.multiple_comparisons_correction}
                      onValueChange={(value: any) => setExperiment(prev => ({
                        ...prev,
                        statistical_config: {
                          ...prev.statistical_config,
                          multiple_comparisons_correction: value
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bonferroni">Bonferroni</SelectItem>
                        <SelectItem value="benjamini_hochberg">Benjamini-Hochberg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={experiment.auto_stop}
                      onCheckedChange={(checked) => setExperiment(prev => ({
                        ...prev,
                        auto_stop: checked
                      }))}
                    />
                    <div>
                      <Label>Auto-stop Experiment</Label>
                      <p className="text-xs text-gray-600">Automatically stop when statistical significance is reached</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'review':
        const errors = validateExperiment();
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review & Launch</h3>

            {errors.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h4 className="font-medium text-red-800">Please fix the following issues:</h4>
                  </div>
                  <ul className="space-y-1 text-red-700 text-sm">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Experiment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{experiment.name || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium capitalize">{experiment.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Variants:</span>
                    <span className="font-medium">{experiment.variants.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Traffic:</span>
                    <span className="font-medium">{experiment.traffic_allocation}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Metrics:</span>
                    <span className="font-medium">{experiment.success_metrics.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Targeting Rules:</span>
                    <span className="font-medium">{experiment.targeting_rules.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Statistical Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence Level:</span>
                    <span className="font-medium">{experiment.statistical_config.confidence_level}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Statistical Power:</span>
                    <span className="font-medium">{experiment.statistical_config.power}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Min Sample Size:</span>
                    <span className="font-medium">{experiment.statistical_config.minimum_sample_size.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sequential Testing:</span>
                    <span className="font-medium">{experiment.statistical_config.sequential_testing ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Auto-stop:</span>
                    <span className="font-medium">{experiment.auto_stop ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variants Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {experiment.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{variant.is_control ? '🔵' : '🟠'}</span>
                        <div>
                          <p className="font-medium">{variant.name}</p>
                          <p className="text-sm text-gray-600">{variant.description}</p>
                        </div>
                        {variant.is_control && <Badge variant="outline">Control</Badge>}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{variant.traffic_percentage}%</p>
                        <p className="text-sm text-gray-600">Traffic</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                index <= currentStep 
                  ? 'border-blue-600 bg-blue-600 text-white' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                <StepIcon className="h-5 w-5" />
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-1 mx-2 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Titles */}
      <div className="text-center">
        <h2 className="text-xl font-semibold">{steps[currentStep].title}</h2>
        <p className="text-gray-600">Step {currentStep + 1} of {steps.length}</p>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Previous
        </Button>

        <div className="flex gap-2">
          {currentStep < steps.length - 1 ? (
            <Button onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}>
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              disabled={validateExperiment().length > 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Create Experiment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}