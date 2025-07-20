'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Settings, 
  ExternalLink,
  RefreshCw,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface ConnectorCardProps {
  id: string;
  name: string;
  description: string;
  icon: string | React.ReactNode;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  category: string;
  lastSync?: Date;
  syncProgress?: number;
  stats?: {
    label: string;
    value: string | number;
  }[];
  onConnect?: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onSync?: () => Promise<void>;
}

export function ConnectorCard({
  id,
  name,
  description,
  icon,
  status,
  category,
  lastSync,
  syncProgress,
  stats,
  onConnect,
  onDisconnect,
  onSync
}: ConnectorCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'syncing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-600">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'syncing':
        return <Badge variant="secondary">Syncing...</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {typeof icon === 'string' ? (
              <span className="text-3xl">{icon}</span>
            ) : (
              <div className="p-2 bg-muted rounded-lg">{icon}</div>
            )}
            <div>
              <CardTitle className="flex items-center gap-2">
                {name}
                {getStatusIcon()}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sync Progress */}
        {status === 'syncing' && syncProgress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Syncing data...</span>
              <span>{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </div>
        )}

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-2 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Last Sync */}
        {lastSync && status === 'connected' && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Last synced</span>
            <span>{new Date(lastSync).toLocaleString()}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === 'connected' ? (
            <>
              <Link href={`/integrations/${id}`} className="flex-1">
                <Button variant="outline" className="w-full" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </Link>
              {onSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(onSync)}
                  disabled={isLoading || status === 'syncing'}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : status === 'disconnected' ? (
            <Button
              className="w-full"
              size="sm"
              onClick={() => onConnect && handleAction(onConnect)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          ) : status === 'error' ? (
            <>
              <Button
                variant="destructive"
                className="flex-1"
                size="sm"
                onClick={() => onDisconnect && handleAction(onDisconnect)}
                disabled={isLoading}
              >
                Disconnect
              </Button>
              <Link href={`/integrations/${id}`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </>
          ) : null}
        </div>

        {/* Category Badge */}
        <div className="flex justify-between items-center pt-2 border-t">
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
          <Link 
            href={`https://docs.mercury.app/integrations/${id}`}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            target="_blank"
          >
            Docs
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}