"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle,
  BarChart2,
  Users,
  DollarSign,
  Target,
  Clock,
  Zap,
  Award,
  Info
} from 'lucide-react';
import { ExperimentResults, Variant, StatisticalSignificance } from '@/lib/ab-testing/types';

interface ExperimentResultsChartProps {
  experimentId: string;
  results: ExperimentResults;
  variants: Variant[];
  onStopExperiment?: () => void;
  onDeclareWinner?: (variantId: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ExperimentResultsChart({
  experimentId,
  results,
  variants,
  onStopExperiment,
  onDeclareWinner
}: ExperimentResultsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'conversion' | 'revenue' | 'engagement'>('conversion');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');

  // Calculate key metrics
  const controlVariant = variants.find(v => v.is_control);
  const controlResults = results.conversion_rates[controlVariant?.id || ''];
  
  const getVariantColor = (index: number) => COLORS[index % COLORS.length];

  // Format time series data
  const formatTimeSeriesData = () => {
    // This would typically come from the API with real time-based data
    // For now, we'll create sample data
    const days = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = 0; i < days; i++) {
      const dataPoint: any = {
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString()
      };
      
      variants.forEach(variant => {
        const baseRate = results.conversion_rates[variant.id]?.conversion_rate || 0;
        const noise = (Math.random() - 0.5) * 0.02;
        dataPoint[variant.name] = Math.max(0, baseRate + noise);
      });
      
      data.push(dataPoint);
    }
    
    return data;
  };

  const timeSeriesData = formatTimeSeriesData();

  // Calculate statistical significance status
  const getSignificanceStatus = (significance: StatisticalSignificance) => {
    if (!significance.sample_size_reached) {
      return {
        icon: <Clock className="h-4 w-4" />,
        text: 'Gathering data...',
        color: 'text-yellow-600'
      };
    }
    
    if (significance.is_significant) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: 'Statistically significant',
        color: 'text-green-600'
      };
    }
    
    return {
      icon: <AlertCircle className="h-4 w-4" />,
      text: 'Not significant',
      color: 'text-gray-600'
    };
  };

  const significanceStatus = getSignificanceStatus(results.statistical_significance);

  // Render metric card
  const renderMetricCard = (
    title: string,
    value: string | number,
    change?: number,
    icon?: React.ReactNode
  ) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {results.winner && (
        <Alert className="border-green-200 bg-green-50">
          <Award className="h-4 w-4" />
          <AlertDescription>
            <strong>{variants.find(v => v.id === results.winner)?.name}</strong> is the winner with a {results.lift[results.winner]?.toFixed(1)}% improvement!
            {onDeclareWinner && (
              <Button
                size="sm"
                className="ml-4"
                onClick={() => onDeclareWinner(results.winner!)}
              >
                Implement Winner
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {renderMetricCard(
          'Total Participants',
          results.total_participants.toLocaleString(),
          undefined,
          <Users className="h-5 w-5" />
        )}
        {renderMetricCard(
          'Overall Conversion Rate',
          `${((Object.values(results.conversion_rates).reduce((sum, cr) => sum + cr.conversion_rate, 0) / variants.length) * 100).toFixed(2)}%`,
          controlResults ? results.lift[controlVariant?.id || ''] : undefined,
          <Target className="h-5 w-5" />
        )}
        {renderMetricCard(
          'Revenue Impact',
          `$${results.revenue_impact.toLocaleString()}`,
          undefined,
          <DollarSign className="h-5 w-5" />
        )}
        {renderMetricCard(
          'Statistical Power',
          `${(results.statistical_significance.confidence_level * 100).toFixed(0)}%`,
          undefined,
          <Zap className="h-5 w-5" />
        )}
      </div>

      {/* Statistical Significance Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={significanceStatus.color}>
                {significanceStatus.icon}
              </div>
              <span className="font-medium">{significanceStatus.text}</span>
              <Badge variant="outline">p-value: {results.statistical_significance.p_value.toFixed(4)}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {results.statistical_significance.sample_size_reached 
                ? 'Sample size reached' 
                : `${Math.round((results.total_participants / (results.statistical_significance.confidence_level * 10000)) * 100)}% of required sample size`}
            </div>
          </div>
          {!results.statistical_significance.sample_size_reached && (
            <Progress 
              value={(results.total_participants / (results.statistical_significance.confidence_level * 10000)) * 100} 
              className="mt-2"
            />
          )}
        </CardContent>
      </Card>

      {/* Results Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Rates by Variant */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates by Variant</CardTitle>
                <CardDescription>Comparison of conversion rates across all variants</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={variants.map((variant, index) => ({
                    name: variant.name,
                    conversionRate: results.conversion_rates[variant.id]?.conversion_rate * 100 || 0,
                    fill: getVariantColor(index)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `${value.toFixed(2)}%`} />
                    <Bar dataKey="conversionRate" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Confidence Intervals */}
            <Card>
              <CardHeader>
                <CardTitle>Confidence Intervals</CardTitle>
                <CardDescription>95% confidence intervals for each variant</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {variants.map((variant, index) => {
                    const ci = results.confidence_intervals[variant.id];
                    const conversionRate = results.conversion_rates[variant.id]?.conversion_rate * 100 || 0;
                    
                    return (
                      <div key={variant.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getVariantColor(index) }}
                            />
                            <span className="font-medium">{variant.name}</span>
                            {variant.is_control && <Badge variant="outline">Control</Badge>}
                          </div>
                          <span className="text-sm font-medium">{conversionRate.toFixed(2)}%</span>
                        </div>
                        <div className="relative h-2 bg-gray-200 rounded-full">
                          <div 
                            className="absolute h-full rounded-full"
                            style={{
                              backgroundColor: getVariantColor(index),
                              left: `${(ci?.lower_bound * 100) || 0}%`,
                              width: `${((ci?.upper_bound - ci?.lower_bound) * 100) || 0}%`
                            }}
                          />
                          <div 
                            className="absolute w-1 h-4 -top-1 bg-black"
                            style={{ left: `${conversionRate}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{((ci?.lower_bound * 100) || 0).toFixed(2)}%</span>
                          <span>{((ci?.upper_bound * 100) || 0).toFixed(2)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conversion Rate Over Time</CardTitle>
                  <CardDescription>Track how conversion rates change over the experiment duration</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                {chartType === 'line' ? (
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(2)}%`} />
                    <Legend />
                    {variants.map((variant, index) => (
                      <Line
                        key={variant.id}
                        type="monotone"
                        dataKey={variant.name}
                        stroke={getVariantColor(index)}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(2)}%`} />
                    <Legend />
                    {variants.map((variant, index) => (
                      <Area
                        key={variant.id}
                        type="monotone"
                        dataKey={variant.name}
                        stroke={getVariantColor(index)}
                        fill={getVariantColor(index)}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <BarChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(2)}%`} />
                    <Legend />
                    {variants.map((variant, index) => (
                      <Bar
                        key={variant.id}
                        dataKey={variant.name}
                        fill={getVariantColor(index)}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Distribution</CardTitle>
                <CardDescription>How users were distributed across variants</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={variants.map((variant, index) => ({
                        name: variant.name,
                        value: results.conversion_rates[variant.id]?.participants || 0
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {variants.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getVariantColor(index)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
                <CardDescription>Revenue generated by each variant</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={variants.map((variant, index) => ({
                        name: variant.name,
                        value: results.conversion_rates[variant.id]?.revenue || 0
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                    >
                      {variants.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getVariantColor(index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <Card>
            <CardHeader>
              <CardTitle>Segment Analysis</CardTitle>
              <CardDescription>Performance breakdown by user segments</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Segment analysis helps identify which user groups respond best to each variant.
                  This feature requires additional tracking implementation.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        {results.recommendations.map((rec, index) => (
          <Alert key={index} className="flex-1">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{rec}</AlertDescription>
          </Alert>
        ))}
        {onStopExperiment && (
          <Button variant="outline" onClick={onStopExperiment}>
            Stop Experiment
          </Button>
        )}
      </div>
    </div>
  );
}

export default ExperimentResultsChart;