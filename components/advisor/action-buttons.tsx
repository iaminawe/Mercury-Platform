'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, Settings, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface ActionButtonsProps {
  action: {
    id: string;
    title: string;
    description: string;
    type: string;
    confidence: number;
    estimatedImpact: string;
    canAutoImplement: boolean;
    parameters?: Record<string, any>;
  };
  onImplement: (parameters?: any) => void;
  isImplementing: boolean;
}

export function ActionButtons({ action, onImplement, isImplementing }: ActionButtonsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [parameters, setParameters] = useState<Record<string, any>>(action.parameters || {});

  const handleImplement = () => {
    onImplement(Object.keys(parameters).length > 0 ? parameters : undefined);
    setIsDialogOpen(false);
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'shopify_update': return 'bg-green-50 text-green-700 border-green-200';
      case 'inventory_alert': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'price_change': return 'bg-red-50 text-red-700 border-red-200';
      case 'marketing_action': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'custom': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'shopify_update': return '🛍️';
      case 'inventory_alert': return '📦';
      case 'price_change': return '💰';
      case 'marketing_action': return '📢';
      case 'custom': return '⚙️';
      default: return '🔧';
    }
  };

  const needsParameters = action.parameters && Object.keys(action.parameters).length > 0;
  const requiresApproval = !action.canAutoImplement;

  if (action.canAutoImplement && !needsParameters) {
    // Simple one-click implementation
    return (
      <Button
        size="sm"
        onClick={() => onImplement()}
        disabled={isImplementing}
        className="flex items-center gap-1"
      >
        {isImplementing ? (
          <>
            <Clock className="h-3 w-3 animate-spin" />
            Implementing...
          </>
        ) : (
          <>
            <Play className="h-3 w-3" />
            Implement
          </>
        )}
      </Button>
    );
  }

  // Complex implementation with dialog
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={requiresApproval ? "outline" : "default"}
          disabled={isImplementing}
          className="flex items-center gap-1"
        >
          {requiresApproval ? (
            <>
              <Settings className="h-3 w-3" />
              Configure
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Implement
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{getActionTypeIcon(action.type)}</span>
            {action.title}
          </DialogTitle>
          <DialogDescription>
            {action.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Action Type</span>
              <Badge className={getActionTypeColor(action.type)} variant="outline">
                {action.type.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estimated Impact</span>
              <span className="text-sm text-gray-600">{action.estimatedImpact}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Confidence</span>
              <span className="text-sm font-semibold text-blue-600">
                {Math.round(action.confidence * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Implementation</span>
              <div className="flex items-center gap-1">
                {action.canAutoImplement ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Automated</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-600">Manual Review Required</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Parameters */}
          {needsParameters && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Configuration</h4>
              {Object.entries(action.parameters || {}).map(([key, defaultValue]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={key} className="text-sm capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <Input
                    id={key}
                    value={parameters[key] || defaultValue || ''}
                    onChange={(e) => setParameters(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${key}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {requiresApproval && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-yellow-800">Manual Review Required</div>
                  <div className="text-yellow-700 mt-1">
                    This action requires manual approval and cannot be automatically implemented. 
                    You will need to complete this action manually in your Shopify admin or other systems.
                  </div>
                </div>
              </div>
            </div>
          )}

          {action.type === 'price_change' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-red-800">Price Change Warning</div>
                  <div className="text-red-700 mt-1">
                    Price changes can significantly impact your business. Please review carefully 
                    and consider testing with a small subset of products first.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImplement} disabled={isImplementing}>
            {isImplementing ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                {action.canAutoImplement ? 'Implementing...' : 'Processing...'}
              </>
            ) : (
              <>
                {action.canAutoImplement ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Implement Now
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Planned
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}