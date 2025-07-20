'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Calendar, 
  Package, 
  Activity, 
  AlertCircle,
  Mail,
  Users,
  Settings,
  ExternalLink,
  FileText,
  Code,
  ArrowDown,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react';

interface WorkflowCanvasProps {
  trigger: any;
  actions: any[];
  readonly?: boolean;
  onTriggerEdit?: () => void;
  onActionEdit?: (actionId: string) => void;
  onActionDelete?: (actionId: string) => void;
  onActionAdd?: () => void;
}

export function WorkflowCanvas({ 
  trigger, 
  actions, 
  readonly = false,
  onTriggerEdit,
  onActionEdit,
  onActionDelete,
  onActionAdd
}: WorkflowCanvasProps) {
  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'data_change': return <Package className="w-5 h-5" />;
      case 'time_based': return <Calendar className="w-5 h-5" />;
      case 'threshold': return <AlertCircle className="w-5 h-5" />;
      case 'external_event': return <ExternalLink className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-5 h-5" />;
      case 'inventory': return <Package className="w-5 h-5" />;
      case 'customer': return <Users className="w-5 h-5" />;
      case 'integration': return <ExternalLink className="w-5 h-5" />;
      case 'data_export': return <FileText className="w-5 h-5" />;
      case 'custom': return <Code className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getTriggerDescription = (trigger: any) => {
    if (!trigger) return 'No trigger configured';
    
    switch (trigger.type) {
      case 'data_change':
        return `When ${trigger.config?.table || 'data'} ${trigger.config?.operation || 'changes'}`;
      case 'time_based':
        return `Schedule: ${trigger.config?.schedule || 'Not set'}`;
      case 'threshold':
        return `When ${trigger.config?.metric || 'metric'} ${trigger.config?.operator || 'is'} ${trigger.config?.value || 'threshold'}`;
      case 'external_event':
        return `External event: ${trigger.config?.event_type || 'webhook'}`;
      default:
        return 'Trigger configured';
    }
  };

  const getActionDescription = (action: any) => {
    switch (action.type) {
      case 'email':
        return `Send email to ${action.config?.recipient || 'recipient'}`;
      case 'inventory':
        return `${action.config?.operation || 'Update'} inventory`;
      case 'customer':
        return `Update customer ${action.config?.segment ? `segment: ${action.config.segment}` : 'data'}`;
      case 'integration':
        return `${action.config?.service || 'External'} integration`;
      case 'data_export':
        return `Export data as ${action.config?.format || 'file'}`;
      case 'custom':
        return action.config?.function_name || 'Custom function';
      default:
        return action.name || 'Action';
    }
  };

  const getTriggerColor = (type: string) => {
    switch (type) {
      case 'data_change': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'time_based': return 'bg-green-100 border-green-300 text-green-800';
      case 'threshold': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'external_event': return 'bg-purple-100 border-purple-300 text-purple-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-red-50 border-red-200';
      case 'inventory': return 'bg-blue-50 border-blue-200';
      case 'customer': return 'bg-green-50 border-green-200';
      case 'integration': return 'bg-purple-50 border-purple-200';
      case 'data_export': return 'bg-yellow-50 border-yellow-200';
      case 'custom': return 'bg-indigo-50 border-indigo-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="workflow-canvas space-y-4">
      {/* Trigger */}
      <div className="relative">
        <Card className={`border-2 ${trigger ? getTriggerColor(trigger.type) : 'border-dashed border-gray-300'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {trigger ? getTriggerIcon(trigger.type) : <Zap className="w-5 h-5 text-gray-400" />}
                <CardTitle className="text-base">
                  {trigger ? 'Trigger' : 'No Trigger Set'}
                </CardTitle>
                {trigger && (
                  <Badge variant="outline" className="text-xs">
                    {trigger.type.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              {!readonly && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={onTriggerEdit}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-600">
              {getTriggerDescription(trigger)}
            </p>
            {trigger?.config?.filters && trigger.config.filters.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  {trigger.config.filters.length} condition(s) applied
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Arrow to first action */}
        {actions.length > 0 && (
          <div className="flex justify-center py-2">
            <ArrowDown className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 ? (
        <div className="space-y-4">
          {actions
            .sort((a, b) => a.order - b.order)
            .map((action, index) => (
            <div key={action.id} className="relative">
              <Card className={`border-2 ${getActionColor(action.type)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-white border-2 border-gray-300 rounded-full text-xs font-medium">
                        {index + 1}
                      </div>
                      {getActionIcon(action.type)}
                      <CardTitle className="text-base">
                        {action.name || `${action.type} Action`}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {action.type}
                      </Badge>
                    </div>
                    {!readonly && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onActionEdit?.(action.id)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onActionDelete?.(action.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600">
                    {getActionDescription(action)}
                  </p>
                  {action.conditions && action.conditions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        {action.conditions.length} condition(s) applied
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Arrow to next action */}
              {index < actions.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !readonly && (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-6 text-center">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 mb-4">No actions configured</p>
              <Button variant="outline" onClick={onActionAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Action
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Add Action Button */}
      {!readonly && actions.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onActionAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Another Action
          </Button>
        </div>
      )}

      {/* Workflow Summary */}
      {readonly && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {trigger ? '1 trigger' : '0 triggers'} • {actions.length} action{actions.length !== 1 ? 's' : ''}
            </span>
            {actions.length > 0 && (
              <span>
                Estimated execution time: {actions.length * 2}s
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}