'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ConflictResolution, 
  EnhancedStore 
} from '@/lib/multi-store/types';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  ArrowRight,
  Merge,
  Crown,
  Calendar,
  Eye,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConflictResolverUIProps {
  conflicts: ConflictResolution[];
  stores: EnhancedStore[];
  onResolveConflict: (
    conflictId: string,
    strategy: ConflictResolution['resolution_strategy'],
    customData?: Record<string, any>
  ) => void;
  onIgnoreConflict: (conflictId: string) => void;
  onBulkResolve?: (
    conflictIds: string[],
    strategy: ConflictResolution['resolution_strategy']
  ) => void;
}

export function ConflictResolverUI({
  conflicts,
  stores,
  onResolveConflict,
  onIgnoreConflict,
  onBulkResolve
}: ConflictResolverUIProps) {
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(new Set());
  const [resolutionDialog, setResolutionDialog] = useState<{
    conflict: ConflictResolution | null;
    strategy: ConflictResolution['resolution_strategy'] | null;
  }>({ conflict: null, strategy: null });
  const [bulkStrategy, setBulkStrategy] = useState<ConflictResolution['resolution_strategy']>('auto_master_wins');

  const getConflictIcon = (type: ConflictResolution['conflict_type']) => {
    switch (type) {
      case 'inventory_mismatch':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'price_conflict':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'data_conflict':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'duplicate_product':
        return <AlertTriangle className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConflictSeverity = (conflict: ConflictResolution) => {
    const { conflict_type, conflict_data } = conflict;
    
    switch (conflict_type) {
      case 'inventory_mismatch':
        const sourceCast = parseInt(conflict_data.source_value?.toString() || '0');
        const targetCast = parseInt(conflict_data.target_value?.toString() || '0');
        const diff = Math.abs(sourceCast - targetCast);
        if (diff > 100) return 'high';
        if (diff > 20) return 'medium';
        return 'low';
      
      case 'price_conflict':
        const sourcePrice = parseFloat(conflict_data.source_value?.toString() || '0');
        const targetPrice = parseFloat(conflict_data.target_value?.toString() || '0');
        const priceDiff = Math.abs(sourcePrice - targetPrice) / Math.max(sourcePrice, targetPrice) * 100;
        if (priceDiff > 20) return 'high';
        if (priceDiff > 10) return 'medium';
        return 'low';
      
      default:
        return 'medium';
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-green-50 border-green-200 text-green-800';
    }
  };

  const getStoreName = (storeId: string) => {
    return stores.find(s => s.id === storeId)?.shop_name || storeId;
  };

  const getMasterStore = (sourceStoreId: string, targetStoreId: string) => {
    const sourceStore = stores.find(s => s.id === sourceStoreId);
    const targetStore = stores.find(s => s.id === targetStoreId);
    
    if (sourceStore?.is_master) return sourceStore;
    if (targetStore?.is_master) return targetStore;
    return null;
  };

  const formatConflictValue = (value: any, type: ConflictResolution['conflict_type']) => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'price_conflict':
        return `$${parseFloat(value.toString()).toFixed(2)}`;
      case 'inventory_mismatch':
        return `${parseInt(value.toString())} units`;
      default:
        return value.toString();
    }
  };

  const handleBulkAction = (strategy: ConflictResolution['resolution_strategy']) => {
    if (selectedConflicts.size === 0) return;
    
    if (onBulkResolve) {
      onBulkResolve(Array.from(selectedConflicts), strategy);
      setSelectedConflicts(new Set());
    }
  };

  const handleConflictSelection = (conflictId: string, selected: boolean) => {
    const newSelection = new Set(selectedConflicts);
    if (selected) {
      newSelection.add(conflictId);
    } else {
      newSelection.delete(conflictId);
    }
    setSelectedConflicts(newSelection);
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');

  return (
    <div className="space-y-6">
      {/* Header with Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Conflict Resolution</h3>
          <Badge variant="outline">
            {pendingConflicts.length} pending
          </Badge>
        </div>
        
        {selectedConflicts.size > 0 && onBulkResolve && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {selectedConflicts.size} selected
            </span>
            <Select
              value={bulkStrategy}
              onValueChange={(value) => setBulkStrategy(value as ConflictResolution['resolution_strategy'])}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_master_wins">Master Wins</SelectItem>
                <SelectItem value="auto_latest_wins">Latest Wins</SelectItem>
                <SelectItem value="auto_merge">Auto Merge</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleBulkAction(bulkStrategy)}
              size="sm"
            >
              Resolve Selected
            </Button>
          </div>
        )}
      </div>

      {/* Pending Conflicts */}
      {pendingConflicts.length > 0 ? (
        <div className="space-y-4">
          {pendingConflicts.map((conflict) => {
            const severity = getConflictSeverity(conflict);
            const masterStore = getMasterStore(conflict.source_store_id, conflict.target_store_id);
            
            return (
              <Card
                key={conflict.id}
                className={cn("border-l-4", getSeverityColor(severity))}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {onBulkResolve && (
                        <input
                          type="checkbox"
                          checked={selectedConflicts.has(conflict.id)}
                          onChange={(e) => handleConflictSelection(conflict.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      )}
                      {getConflictIcon(conflict.conflict_type)}
                      <div>
                        <CardTitle className="text-lg">
                          {conflict.conflict_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Field: {conflict.conflict_data.field_name}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getSeverityColor(severity)}>
                      {severity} severity
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Store Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Source Store</span>
                        {stores.find(s => s.id === conflict.source_store_id)?.is_master && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="font-medium">{getStoreName(conflict.source_store_id)}</p>
                        <p className="text-sm text-blue-600">
                          {formatConflictValue(conflict.conflict_data.source_value, conflict.conflict_type)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-6 w-6 text-gray-400" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Target Store</span>
                        {stores.find(s => s.id === conflict.target_store_id)?.is_master && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="font-medium">{getStoreName(conflict.target_store_id)}</p>
                        <p className="text-sm text-red-600">
                          {formatConflictValue(conflict.conflict_data.target_value, conflict.conflict_type)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Details */}
                  {conflict.conflict_data.conflict_reason && (
                    <div className="p-3 bg-gray-50 border rounded">
                      <p className="text-sm text-gray-700">
                        <strong>Reason:</strong> {conflict.conflict_data.conflict_reason}
                      </p>
                    </div>
                  )}

                  {/* Resolution Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResolveConflict(conflict.id, 'auto_master_wins')}
                      disabled={!masterStore}
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      Master Wins
                      {masterStore && ` (${masterStore.shop_name})`}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResolveConflict(conflict.id, 'auto_latest_wins')}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Latest Wins
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResolveConflict(conflict.id, 'auto_merge')}
                    >
                      <Merge className="h-3 w-3 mr-1" />
                      Auto Merge
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResolutionDialog({ conflict, strategy: 'manual' })}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Manual
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onIgnoreConflict(conflict.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ignore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No pending conflicts
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              All sync conflicts have been resolved. New conflicts will appear here automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recently Resolved */}
      {resolvedConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Recently Resolved</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolvedConflicts.slice(0, 5).map((conflict) => (
              <div
                key={conflict.id}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded"
              >
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <span className="font-medium">
                      {conflict.conflict_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <p className="text-sm text-green-700">
                      {getStoreName(conflict.source_store_id)} → {getStoreName(conflict.target_store_id)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium capitalize">
                    {conflict.resolution_strategy?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-green-600">
                    {conflict.resolved_at && new Date(conflict.resolved_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Manual Resolution Dialog */}
      <Dialog
        open={resolutionDialog.conflict !== null}
        onOpenChange={() => setResolutionDialog({ conflict: null, strategy: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Conflict Resolution</DialogTitle>
            <DialogDescription>
              Provide a custom resolution for this conflict.
            </DialogDescription>
          </DialogHeader>
          
          {resolutionDialog.conflict && (
            <ManualResolutionForm
              conflict={resolutionDialog.conflict}
              stores={stores}
              onSubmit={(data) => {
                onResolveConflict(resolutionDialog.conflict!.id, 'manual', data);
                setResolutionDialog({ conflict: null, strategy: null });
              }}
              onCancel={() => setResolutionDialog({ conflict: null, strategy: null })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Manual Resolution Form Component
interface ManualResolutionFormProps {
  conflict: ConflictResolution;
  stores: EnhancedStore[];
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
}

function ManualResolutionForm({
  conflict,
  stores,
  onSubmit,
  onCancel
}: ManualResolutionFormProps) {
  const [resolutionValue, setResolutionValue] = useState('');
  const [applyToStore, setApplyToStore] = useState<'source' | 'target' | 'both'>('target');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    onSubmit({
      resolution_value: resolutionValue,
      apply_to_store: applyToStore,
      notes
    });
  };

  const getStoreName = (storeId: string) => {
    return stores.find(s => s.id === storeId)?.shop_name || storeId;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
        <div>
          <Label className="text-sm font-medium">Source Store</Label>
          <p className="text-sm">{getStoreName(conflict.source_store_id)}</p>
          <p className="text-xs text-muted-foreground">
            Current: {conflict.conflict_data.source_value}
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium">Target Store</Label>
          <p className="text-sm">{getStoreName(conflict.target_store_id)}</p>
          <p className="text-xs text-muted-foreground">
            Current: {conflict.conflict_data.target_value}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resolution-value">Resolution Value</Label>
        <Input
          id="resolution-value"
          value={resolutionValue}
          onChange={(e) => setResolutionValue(e.target.value)}
          placeholder="Enter the correct value"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="apply-to">Apply To</Label>
        <Select value={applyToStore} onValueChange={(value) => setApplyToStore(value as 'source' | 'target' | 'both')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="source">Source Store Only</SelectItem>
            <SelectItem value="target">Target Store Only</SelectItem>
            <SelectItem value="both">Both Stores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this resolution..."
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!resolutionValue}>
          Apply Resolution
        </Button>
      </DialogFooter>
    </div>
  );
}