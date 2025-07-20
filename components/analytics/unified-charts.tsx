'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface UnifiedChartsProps {
  data: any;
  chartType?: 'revenue' | 'orders' | 'conversion' | 'comparison' | 'geographic';
  timeframe?: 'day' | 'week' | 'month' | 'year';
  selectedStores?: string[];
}

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export function UnifiedCharts({ 
  data, 
  chartType = 'revenue', 
  timeframe = 'day',
  selectedStores = []
}: UnifiedChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-medium">
                {entry.dataKey.includes('revenue') || entry.dataKey.includes('value')
                  ? formatCurrency(entry.value)
                  : entry.dataKey.includes('rate') || entry.dataKey.includes('percentage')
                  ? formatPercent(entry.value)
                  : formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderRevenueChart = () => {
    const chartData = data?.timeSeriesData || [];
    const hasMultipleStores = selectedStores.length > 1;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Revenue Trends</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{timeframe}</Badge>
              {data?.growth?.revenue !== undefined && (
                <div className="flex items-center gap-1">
                  {getTrendIcon(data.growth.revenue)}
                  <span className="text-sm font-medium">
                    {Math.abs(data.growth.revenue).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="area" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="area">Area</TabsTrigger>
              <TabsTrigger value="bar">Bar</TabsTrigger>
              <TabsTrigger value="composed">Composed</TabsTrigger>
            </TabsList>
            <TabsContent value="area">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData}>
                  <defs>
                    {selectedStores.map((storeId, index) => (
                      <linearGradient key={storeId} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.1}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {hasMultipleStores && <Legend />}
                  {selectedStores.map((storeId, index) => (
                    <Area
                      key={storeId}
                      type="monotone"
                      dataKey={`revenue_${storeId}`}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      fillOpacity={1}
                      fill={`url(#color${index})`}
                      name={data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="bar">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {hasMultipleStores && <Legend />}
                  {selectedStores.map((storeId, index) => (
                    <Bar
                      key={storeId}
                      dataKey={`revenue_${storeId}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      name={data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="composed">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    className="text-xs"
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={formatCurrency}
                    className="text-xs"
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatNumber}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {selectedStores.map((storeId, index) => (
                    <React.Fragment key={storeId}>
                      <Bar
                        yAxisId="left"
                        dataKey={`revenue_${storeId}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        opacity={0.8}
                        name={`Revenue - ${data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}`}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={`orders_${storeId}`}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        strokeWidth={2}
                        name={`Orders - ${data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}`}
                      />
                    </React.Fragment>
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  };

  const renderComparisonChart = () => {
    const storeData = data?.storeComparison || [];

    return (
      <Card>
        <CardHeader>
          <CardTitle>Store Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="radar" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="radar">Radar</TabsTrigger>
              <TabsTrigger value="treemap">Treemap</TabsTrigger>
              <TabsTrigger value="pie">Distribution</TabsTrigger>
            </TabsList>
            <TabsContent value="radar">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={storeData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" className="text-xs" />
                  <PolarRadiusAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {selectedStores.map((storeId, index) => (
                    <Radar
                      key={storeId}
                      name={data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}
                      dataKey={storeId}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      fillOpacity={0.6}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="treemap">
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={data?.treemapData || []}
                  dataKey="value"
                  ratio={4 / 3}
                  stroke="#fff"
                  fill={CHART_COLORS[0]}
                  content={({ x, y, width, height, name, value }: any) => (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        style={{
                          fill: CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)],
                          stroke: '#fff',
                          strokeWidth: 2,
                        }}
                      />
                      {width > 50 && height > 30 && (
                        <>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 - 10}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={14}
                            fontWeight="bold"
                          >
                            {name}
                          </text>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 + 10}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={12}
                          >
                            {formatCurrency(value)}
                          </text>
                        </>
                      )}
                    </g>
                  )}
                />
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="pie">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={data?.pieData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(data?.pieData || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  };

  const renderConversionChart = () => {
    const conversionData = data?.conversionData || [];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Conversion Rates</CardTitle>
            {data?.avgConversionRate !== undefined && (
              <Badge variant="secondary">
                Avg: {formatPercent(data.avgConversionRate)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {selectedStores.map((storeId, index) => (
                <Line
                  key={storeId}
                  type="monotone"
                  dataKey={`conversionRate_${storeId}`}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={data?.stores?.find((s: any) => s.id === storeId)?.name || storeId}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderGeographicChart = () => {
    // This would typically integrate with a map library like react-simple-maps
    // For now, we'll show a placeholder
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geographic Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Geographic visualization would be rendered here with a map library
          </div>
        </CardContent>
      </Card>
    );
  };

  switch (chartType) {
    case 'revenue':
      return renderRevenueChart();
    case 'orders':
      return renderRevenueChart(); // Reuse with different data
    case 'conversion':
      return renderConversionChart();
    case 'comparison':
      return renderComparisonChart();
    case 'geographic':
      return renderGeographicChart();
    default:
      return renderRevenueChart();
  }
}