'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Package, 
  Calendar, 
  AlertCircle, 
  ExternalLink,
  Plus,
  Trash2,
  ArrowRight
} from 'lucide-react';

interface TriggerPickerProps {
  trigger: any;
  onTriggerChange: (trigger: any) => void;
  onNext: () => void;
}

export function TriggerPicker({ trigger, onTriggerChange, onNext }: TriggerPickerProps) {
  const [selectedType, setSelectedType] = useState(trigger?.type || '');
  const [config, setConfig] = useState(trigger?.config || {});
  const [filters, setFilters] = useState(trigger?.config?.filters || []);

  const triggerTypes = [
    {
      id: 'data_change',
      name: 'Data Change',
      description: 'Trigger when data in your store changes',
      icon: <Package className="w-6 h-6" />,
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    },
    {
      id: 'time_based',
      name: 'Scheduled',
      description: 'Trigger at specific times or intervals',
      icon: <Calendar className="w-6 h-6" />,
      color: 'bg-green-50 border-green-200 text-green-800'
    },
    {
      id: 'threshold',
      name: 'Threshold',
      description: 'Trigger when metrics reach certain values',
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'bg-orange-50 border-orange-200 text-orange-800'
    },
    {
      id: 'external_event',
      name: 'External Event',
      description: 'Trigger from webhooks or external systems',
      icon: <ExternalLink className="w-6 h-6" />,
      color: 'bg-purple-50 border-purple-200 text-purple-800'
    }
  ];

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    onTriggerChange({
      id: trigger?.id || crypto.randomUUID(),
      name: getTriggerName(selectedType, newConfig),
      type: selectedType,
      config: newConfig,
      enabled: true
    });
  };

  const addFilter = () => {
    const newFilter = {
      field: '',
      operator: 'equals',
      value: ''
    };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    updateConfig('filters', newFilters);
  };

  const updateFilter = (index: number, key: string, value: any) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [key]: value };
    setFilters(newFilters);
    updateConfig('filters', newFilters);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    updateConfig('filters', newFilters);
  };

  const getTriggerName = (type: string, config: any) => {
    switch (type) {
      case 'data_change':
        return `${config.table || 'Data'} ${config.operation || 'Change'} Trigger`;
      case 'time_based':
        return `Scheduled Trigger`;
      case 'threshold':
        return `${config.metric || 'Metric'} Threshold Trigger`;
      case 'external_event':
        return `${config.event_type || 'External'} Event Trigger`;
      default:
        return 'Trigger';
    }
  };

  const isConfigValid = () => {
    if (!selectedType) return false;
    
    switch (selectedType) {
      case 'data_change':
        return config.table && config.operation;
      case 'time_based':
        return config.schedule;
      case 'threshold':
        return config.metric && config.operator && config.value !== undefined;
      case 'external_event':
        return config.event_type;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Configure Trigger</h2>
        <p className="text-gray-600">Choose when your workflow should run</p>
      </div>

      {/* Trigger Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {triggerTypes.map((type) => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all ${
              selectedType === type.id
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:shadow-md'
            }`}
            onClick={() => {
              setSelectedType(type.id);
              setConfig({});
              setFilters([]);
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${type.color}`}>
                  {type.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{type.name}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Trigger Configuration */}
      {selectedType && (
        <Card>
          <CardHeader>
            <CardTitle>Trigger Configuration</CardTitle>
            <CardDescription>
              Configure the specific settings for your {triggerTypes.find(t => t.id === selectedType)?.name} trigger
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedType === 'data_change' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Table</Label>
                    <Select value={config.table || ''} onValueChange={(value) => updateConfig('table', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="products">Products</SelectItem>
                        <SelectItem value="orders">Orders</SelectItem>
                        <SelectItem value="customers">Customers</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="carts">Carts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Operation</Label>
                    <Select value={config.operation || ''} onValueChange={(value) => updateConfig('operation', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insert">Insert (Create)</SelectItem>
                        <SelectItem value="update">Update (Modify)</SelectItem>
                        <SelectItem value="delete">Delete (Remove)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {selectedType === 'time_based' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Schedule Type</Label>
                  <Select 
                    value={config.schedule_type || 'interval'} 
                    onValueChange={(value) => updateConfig('schedule_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interval">Interval</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom Cron</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.schedule_type === 'interval' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Interval</Label>
                      <Input
                        type="number"
                        value={config.interval_value || ''}
                        onChange={(e) => updateConfig('interval_value', Number(e.target.value))}
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select value={config.interval_unit || 'minutes'} onValueChange={(value) => updateConfig('interval_unit', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {config.schedule_type === 'daily' && (
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={config.daily_time || '09:00'}
                      onChange={(e) => updateConfig('daily_time', e.target.value)}
                    />
                  </div>
                )}

                {config.schedule_type === 'custom' && (
                  <div className="space-y-2">
                    <Label>Cron Expression</Label>
                    <Input
                      value={config.cron_expression || ''}
                      onChange={(e) => updateConfig('cron_expression', e.target.value)}
                      placeholder="0 9 * * *"
                    />
                    <p className="text-sm text-gray-500">
                      Example: "0 9 * * *" runs daily at 9 AM
                    </p>
                  </div>
                )}

                {/* Generate schedule based on type */}
                {config.schedule_type && (() => {
                  let schedule = '';
                  switch (config.schedule_type) {
                    case 'interval':
                      if (config.interval_value && config.interval_unit) {
                        schedule = config.interval_unit === 'minutes' 
                          ? `*/${config.interval_value} * * * *`
                          : config.interval_unit === 'hours'
                          ? `0 */${config.interval_value} * * *`
                          : `0 0 */${config.interval_value} * *`;
                        updateConfig('schedule', schedule);
                      }
                      break;
                    case 'daily':
                      if (config.daily_time) {
                        const [hour, minute] = config.daily_time.split(':');
                        schedule = `${minute} ${hour} * * *`;
                        updateConfig('schedule', schedule);
                      }
                      break;
                    case 'weekly':
                      schedule = '0 9 * * 1'; // Monday at 9 AM
                      updateConfig('schedule', schedule);
                      break;
                    case 'monthly':
                      schedule = '0 9 1 * *'; // 1st of month at 9 AM
                      updateConfig('schedule', schedule);
                      break;
                    case 'custom':
                      updateConfig('schedule', config.cron_expression);
                      break;
                  }
                  return null;
                })()}
              </div>
            )}

            {selectedType === 'threshold' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select value={config.metric || ''} onValueChange={(value) => updateConfig('metric', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low_inventory">Low Inventory Count</SelectItem>
                        <SelectItem value="daily_revenue">Daily Revenue</SelectItem>
                        <SelectItem value="abandoned_carts">Abandoned Carts</SelectItem>
                        <SelectItem value="new_customers">New Customers</SelectItem>
                        <SelectItem value="order_count">Order Count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={config.operator || ''} onValueChange={(value) => updateConfig('operator', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">Greater than</SelectItem>
                        <SelectItem value="lt">Less than</SelectItem>
                        <SelectItem value="eq">Equal to</SelectItem>
                        <SelectItem value="gte">Greater than or equal</SelectItem>
                        <SelectItem value="lte">Less than or equal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      type="number"
                      value={config.value || ''}
                      onChange={(e) => updateConfig('value', Number(e.target.value))}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedType === 'external_event' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Input
                    value={config.event_type || ''}
                    onChange={(e) => updateConfig('event_type', e.target.value)}
                    placeholder="webhook_received"
                  />
                  <p className="text-sm text-gray-500">
                    The type of external event to listen for
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Webhook URL (Optional)</Label>
                  <Input
                    value={config.webhook_url || ''}
                    onChange={(e) => updateConfig('webhook_url', e.target.value)}
                    placeholder="/api/webhooks/my-webhook"
                  />
                  <p className="text-sm text-gray-500">
                    Custom webhook endpoint for this trigger
                  </p>
                </div>
              </div>
            )}

            {/* Filters Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Conditions (Optional)</h4>
                  <p className="text-sm text-gray-500">Add conditions to filter when the trigger should fire</p>
                </div>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </div>

              {filters.map((filter, index) => (
                <Card key={index} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-2">
                        <Label>Field</Label>
                        <Input
                          value={filter.field}
                          onChange={(e) => updateFilter(index, 'field', e.target.value)}
                          placeholder="field_name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <Select value={filter.operator} onValueChange={(value) => updateFilter(index, 'operator', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greater_than">Greater than</SelectItem>
                            <SelectItem value="less_than">Less than</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          value={filter.value}
                          onChange={(e) => updateFilter(index, 'value', e.target.value)}
                          placeholder="value"
                        />
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeFilter(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {selectedType && isConfigValid() && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Trigger Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {triggerTypes.find(t => t.id === selectedType)?.icon}
              <span className="font-medium">{getTriggerName(selectedType, config)}</span>
              <Badge variant="outline">{selectedType.replace('_', ' ')}</Badge>
            </div>
            {filters.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                With {filters.length} condition{filters.length !== 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button 
          onClick={onNext} 
          disabled={!isConfigValid()}
          className="min-w-32"
        >
          Continue to Actions
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}