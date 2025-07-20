'use client';

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Info,
  ArrowUpDown,
  MoreVertical,
  Download,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StoreMetrics {
  storeId: string;
  storeName: string;
  shopDomain: string;
  status: 'active' | 'inactive' | 'trial';
  metrics: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    conversionRate: number;
    visitors: number;
    returnRate: number;
    cartAbandonmentRate: number;
    customerLifetimeValue: number;
  };
  trends: {
    revenue: number;
    orders: number;
    conversionRate: number;
    visitors: number;
  };
  scores: {
    performance: number;
    efficiency: number;
    growth: number;
    overall: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
  }>;
}

interface PerformanceMatrixProps {
  stores: StoreMetrics[];
  onStoreClick?: (storeId: string) => void;
  onExport?: () => void;
  className?: string;
}

type SortField = keyof StoreMetrics['metrics'] | 'overall' | 'storeName';
type SortOrder = 'asc' | 'desc';

export function PerformanceMatrix({
  stores,
  onStoreClick,
  onExport,
  className
}: PerformanceMatrixProps) {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedMetric, setSelectedMetric] = useState<keyof StoreMetrics['metrics']>('revenue');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusIcon = (status: StoreMetrics['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'trial':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const sortedStores = useMemo(() => {
    return [...stores].sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortField === 'overall') {
        aVal = a.scores.overall;
        bVal = b.scores.overall;
      } else if (sortField === 'storeName') {
        aVal = a.storeName.toLowerCase();
        bVal = b.storeName.toLowerCase();
      } else {
        aVal = a.metrics[sortField];
        bVal = b.metrics[sortField];
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [stores, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderMetricCell = (store: StoreMetrics, metric: keyof StoreMetrics['metrics']) => {
    const value = store.metrics[metric];
    const trend = store.trends[metric as keyof StoreMetrics['trends']] || 0;

    let formattedValue = '';
    switch (metric) {
      case 'revenue':
      case 'avgOrderValue':
      case 'customerLifetimeValue':
        formattedValue = formatCurrency(value);
        break;
      case 'orders':
      case 'visitors':
        formattedValue = formatNumber(value);
        break;
      case 'conversionRate':
      case 'returnRate':
      case 'cartAbandonmentRate':
        formattedValue = formatPercent(value);
        break;
      default:
        formattedValue = value.toString();
    }

    return (
      <div className="flex items-center justify-between">
        <span className="font-medium">{formattedValue}</span>
        {trend !== undefined && (
          <div className="flex items-center gap-1">
            {getTrendIcon(trend)}
            <span className="text-xs text-muted-foreground">
              {Math.abs(trend).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  const getTopPerformers = () => {
    return [...stores]
      .sort((a, b) => b.scores.overall - a.scores.overall)
      .slice(0, 3);
  };

  const getBottomPerformers = () => {
    return [...stores]
      .sort((a, b) => a.scores.overall - b.scores.overall)
      .slice(0, 3);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getTopPerformers().map((store, index) => (
                <div key={store.storeId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[150px]">
                      {store.storeName}
                    </span>
                  </div>
                  <Badge className={cn("text-xs", getScoreColor(store.scores.overall))}>
                    {store.scores.overall}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getBottomPerformers().map((store) => (
                <div key={store.storeId} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate max-w-[150px]">
                    {store.storeName}
                  </span>
                  <div className="flex items-center gap-2">
                    {store.alerts.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{store.alerts[0].message}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Badge className={cn("text-xs", getScoreColor(store.scores.overall))}>
                      {store.scores.overall}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Stores</span>
                <span className="font-medium">
                  {stores.filter(s => s.status === 'active').length} / {stores.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Performance</span>
                <span className="font-medium">
                  {Math.round(stores.reduce((acc, s) => acc + s.scores.overall, 0) / stores.length)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-medium">
                  {formatCurrency(stores.reduce((acc, s) => acc + s.metrics.revenue, 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Matrix Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Store Performance Matrix</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>All Stores</DropdownMenuItem>
                  <DropdownMenuItem>Active Only</DropdownMenuItem>
                  <DropdownMenuItem>Trial Only</DropdownMenuItem>
                  <DropdownMenuItem>Inactive Only</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('storeName')}
                    >
                      Store
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('revenue')}
                    >
                      Revenue
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('orders')}
                    >
                      Orders
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('conversionRate')}
                    >
                      Conversion
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('avgOrderValue')}
                    >
                      AOV
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('overall')}
                    >
                      Score
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStores.map((store) => (
                  <TableRow
                    key={store.storeId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onStoreClick?.(store.storeId)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-medium">{store.storeName}</p>
                        <p className="text-xs text-muted-foreground">{store.shopDomain}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getStatusIcon(store.status)}
                        <span className="text-xs capitalize">{store.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{renderMetricCell(store, 'revenue')}</TableCell>
                    <TableCell>{renderMetricCell(store, 'orders')}</TableCell>
                    <TableCell>{renderMetricCell(store, 'conversionRate')}</TableCell>
                    <TableCell>{renderMetricCell(store, 'avgOrderValue')}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", getScoreColor(store.scores.overall))}
                        >
                          {store.scores.overall}
                        </Badge>
                        <Progress 
                          value={store.scores.overall} 
                          className="w-16 h-1"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onStoreClick?.(store.storeId)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Compare with Others</DropdownMenuItem>
                          <DropdownMenuItem>Export Data</DropdownMenuItem>
                          <DropdownMenuItem>Generate Report</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}