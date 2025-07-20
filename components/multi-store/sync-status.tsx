'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  SyncOperation, 
  SyncProgress, 
  EnhancedStore 
} from '@/lib/multi-store/types';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Pause,
  Play,
  AlertTriangle,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  operations: SyncOperation[];
  stores: EnhancedStore[];
  onRefresh?: () => void;
  onCancelOperation?: (operationId: string) => void;
  onRetryOperation?: (operationId: string) => void;
}

export function SyncStatus({
  operations,
  stores,
  onRefresh,
  onCancelOperation,
  onRetryOperation
}: SyncStatusProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const getOperationIcon = (status: SyncOperation['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOperationStatusColor = (status: SyncOperation['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatOperationType = (type: SyncOperation['operation_type']) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started';
    
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStoreName = (storeId: string) => {
    return stores.find(s => s.id === storeId)?.shop_name || storeId;
  };

  // Group operations by status
  const runningOps = operations.filter(op => op.status === 'running');
  const pendingOps = operations.filter(op => op.status === 'pending');
  const recentOps = operations
    .filter(op => ['completed', 'failed', 'cancelled'].includes(op.status))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Sync Status</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold text-blue-600">{runningOps.length}</p>
              </div>
              <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingOps.length}</p>
              </div>
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {operations.length > 0 
                    ? Math.round((operations.filter(op => op.status === 'completed').length / operations.length) * 100)
                    : 100
                  }%
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Operations</p>
                <p className="text-2xl font-bold">{operations.length}</p>
              </div>
              <Zap className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Operations */}
      {runningOps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Active Syncs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {runningOps.map((operation) => (
              <div
                key={operation.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getOperationIcon(operation.status)}
                      <span className="font-medium">
                        {formatOperationType(operation.operation_type)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {operation.sync_mode}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {operation.source_store_id && (
                        <>From: {getStoreName(operation.source_store_id)} • </>
                      )}
                      To: {operation.target_stores.length} store(s)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(operation.started_at)}
                    </span>
                    {onCancelOperation && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancelOperation(operation.operation_id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{operation.progress}%</span>
                  </div>
                  <Progress value={operation.progress} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {operation.processed_items} / {operation.total_items} items
                    </span>
                    {operation.failed_items > 0 && (
                      <span className="text-red-500">
                        {operation.failed_items} failed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Operations */}
      {pendingOps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Pending Syncs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingOps.map((operation) => (
              <div
                key={operation.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getOperationIcon(operation.status)}
                  <div>
                    <span className="font-medium">
                      {formatOperationType(operation.operation_type)}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {operation.source_store_id && (
                        <>From: {getStoreName(operation.source_store_id)} • </>
                      )}
                      To: {operation.target_stores.length} store(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {operation.sync_mode}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {formatDuration(operation.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Operations */}
      {recentOps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOps.map((operation) => (
              <div
                key={operation.id}
                className={cn(
                  "flex items-center justify-between p-3 border rounded-lg",
                  getOperationStatusColor(operation.status)
                )}
              >
                <div className="flex items-center space-x-3">
                  {getOperationIcon(operation.status)}
                  <div>
                    <span className="font-medium">
                      {formatOperationType(operation.operation_type)}
                    </span>
                    <p className="text-sm opacity-75">
                      {operation.source_store_id && (
                        <>From: {getStoreName(operation.source_store_id)} • </>
                      )}
                      To: {operation.target_stores.length} store(s)
                    </p>
                    {operation.status === 'failed' && operation.error_details?.message && (
                      <p className="text-xs opacity-75 mt-1">
                        Error: {operation.error_details.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <p className="text-sm font-medium capitalize">
                      {operation.status}
                    </p>
                    <p className="text-xs opacity-75">
                      {formatDuration(operation.started_at, operation.completed_at)}
                    </p>
                    {operation.status === 'completed' && (
                      <p className="text-xs opacity-75">
                        {operation.processed_items} items
                      </p>
                    )}
                  </div>
                  {operation.status === 'failed' && onRetryOperation && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetryOperation(operation.operation_id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {operations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No sync operations
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Sync operations will appear here when you start synchronizing data between stores.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Real-time Sync Progress Component
interface RealTimeSyncProgressProps {
  operationId: string;
  onComplete?: () => void;
}

export function RealTimeSyncProgress({ 
  operationId, 
  onComplete 
}: RealTimeSyncProgressProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/multi-store/sync/${operationId}/status`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          
          if (data.status === 'completed' && onComplete) {
            onComplete();
          }
        } else {
          setError('Failed to fetch progress');
        }
      } catch (err) {
        setError('Failed to fetch progress');
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [operationId, onComplete]);

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center space-x-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading progress...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{progress.current_step}</span>
        <span>{progress.progress_percentage}%</span>
      </div>
      <Progress value={progress.progress_percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {progress.completed_steps} of {progress.total_steps}
        </span>
        {progress.estimated_completion && (
          <span>
            ETA: {new Date(progress.estimated_completion).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}