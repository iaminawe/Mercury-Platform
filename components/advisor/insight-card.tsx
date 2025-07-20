'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, Target, BarChart3, ChevronDown, ChevronUp, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { ConfidenceBadge } from './confidence-badge';
import { ActionButtons } from './action-buttons';

interface InsightCardProps {
  insight: {
    id: string;
    title: string;
    description: string;
    type: 'anomaly' | 'opportunity' | 'trend' | 'recommendation';
    confidence: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'sales' | 'traffic' | 'conversion' | 'products' | 'customers';
    actionable: boolean;
    actions?: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      confidence: number;
      estimatedImpact: string;
      canAutoImplement: boolean;
    }>;
    data: any;
    confidenceScore?: {
      overall: number;
      factors: {
        dataQuality: number;
        historicalAccuracy: number;
        contextRelevance: number;
        modelPerformance: number;
      };
      explanation: string;
    };
  };
  onImplementAction: (actionId: string, parameters?: any) => void;
  isImplementing: boolean;
}

export function InsightCard({ insight, onImplementAction, isImplementing }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'trend': return BarChart3;
      case 'recommendation': return Target;
      default: return AlertCircle;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'anomaly': return 'text-red-600 bg-red-50 border-red-200';
      case 'opportunity': return 'text-green-600 bg-green-50 border-green-200';
      case 'trend': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'recommendation': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return '💰';
      case 'traffic': return '🚦';
      case 'conversion': return '🎯';
      case 'products': return '📦';
      case 'customers': return '👥';
      default: return '📊';
    }
  };

  const TypeIcon = getTypeIcon(insight.type);

  return (
    <Card className={`transition-all duration-200 ${insight.priority === 'critical' ? 'ring-2 ring-red-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg border ${getTypeColor(insight.type)}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight">{insight.title}</CardTitle>
              <CardDescription className="mt-1">{insight.description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <ConfidenceBadge confidence={insight.confidence} />
            <div className="flex gap-2">
              <Badge className={getPriorityColor(insight.priority)} variant="outline">
                {insight.priority}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {getCategoryIcon(insight.category)} {insight.category}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        {insight.data && Object.keys(insight.data).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Key Data</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(insight.data).slice(0, 4).map(([key, value]) => (
                <div key={key}>
                  <div className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="font-medium">
                    {typeof value === 'number' ? 
                      (key.includes('Rate') || key.includes('Growth') ? `${value.toFixed(1)}%` : 
                       key.includes('Revenue') || key.includes('Value') ? `$${value.toFixed(2)}` : 
                       value.toLocaleString()) : 
                      String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Score Details */}
        {insight.confidenceScore && (
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between text-xs"
              onClick={() => setShowConfidenceDetails(!showConfidenceDetails)}
            >
              <span>Confidence Details</span>
              {showConfidenceDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {showConfidenceDetails && (
              <div className="space-y-2 pt-2">
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-gray-600">Data Quality</div>
                      <div className="font-medium">{(insight.confidenceScore.factors.dataQuality * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Historical Accuracy</div>
                      <div className="font-medium">{(insight.confidenceScore.factors.historicalAccuracy * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Context Relevance</div>
                      <div className="font-medium">{(insight.confidenceScore.factors.contextRelevance * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Model Performance</div>
                      <div className="font-medium">{(insight.confidenceScore.factors.modelPerformance * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    {insight.confidenceScore.explanation}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {insight.actionable && insight.actions && insight.actions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Recommended Actions</span>
            </div>
            
            <div className="space-y-2">
              {insight.actions.map((action) => (
                <div key={action.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{action.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{action.description}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <ConfidenceBadge confidence={action.confidence} size="sm" />
                      {action.canAutoImplement && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Auto
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Impact:</span> {action.estimatedImpact}
                    </div>
                    <ActionButtons
                      action={action}
                      onImplement={(parameters) => onImplementAction(action.id, parameters)}
                      isImplementing={isImplementing}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Details Toggle */}
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>Details</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {isExpanded && (
            <div className="space-y-3 pt-3">
              {/* Raw Data */}
              {insight.data && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Technical Details</div>
                  <div className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-600 max-h-40 overflow-y-auto">
                    <pre>{JSON.stringify(insight.data, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              {/* Metadata */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Insight ID: {insight.id}</div>
                <div>Type: {insight.type}</div>
                <div>Generated: {new Date().toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}