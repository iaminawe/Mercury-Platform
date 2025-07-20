"use client"

import * as React from "react"
import { DateRangePicker, type DateRange } from "@/components/dashboard/date-range-picker"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, TrendingUp, TrendingDown } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"

// Mock data for sales by channel
const mockSalesByChannel = [
  { name: "Online Store", value: 45000, percentage: 55 },
  { name: "POS", value: 25000, percentage: 30 },
  { name: "Marketplace", value: 8000, percentage: 10 },
  { name: "Social", value: 4000, percentage: 5 },
]

// Mock data for hourly sales
const mockHourlySales = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  sales: Math.floor(Math.random() * 50) + 10,
  orders: Math.floor(Math.random() * 10) + 2,
}))

// Mock data for sales by region
const mockSalesByRegion = [
  { region: "North America", sales: 32000, growth: 15 },
  { region: "Europe", sales: 28000, growth: 22 },
  { region: "Asia Pacific", sales: 15000, growth: 35 },
  { region: "Latin America", sales: 5000, growth: -5 },
  { region: "Middle East", sales: 2000, growth: 10 },
]

const salesMetrics = [
  {
    title: "Gross Sales",
    value: 82000,
    change: 18.5,
    changeLabel: "from last period",
    format: "currency" as const,
  },
  {
    title: "Net Sales",
    value: 75000,
    change: 16.2,
    changeLabel: "from last period",
    format: "currency" as const,
  },
  {
    title: "Total Discounts",
    value: 5000,
    change: 25.3,
    changeLabel: "from last period",
    format: "currency" as const,
  },
  {
    title: "Sales Tax",
    value: 2000,
    change: 12.1,
    changeLabel: "from last period",
    format: "currency" as const,
  },
]

export default function SalesAnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date(),
  })

  const handleExport = () => {
    console.log("Exporting sales data...")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into your sales performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Sales Metrics */}
      <MetricsCards metrics={salesMetrics} />

      {/* Sales Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend</CardTitle>
          <CardDescription>Daily sales performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={Array.from({ length: 30 }, (_, i) => {
                const date = new Date()
                date.setDate(date.getDate() - 29 + i)
                return {
                  date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  sales: Math.floor(Math.random() * 5000) + 2000,
                }
              })}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sales by Channel and Hourly Sales */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales by Channel */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
            <CardDescription>Revenue distribution across sales channels</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockSalesByChannel}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value: number) => [
                    new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(value),
                    'Sales'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Sales Pattern */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Sales Pattern</CardTitle>
            <CardDescription>Sales distribution throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockHourlySales}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="orders" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Region */}
      <Card>
        <CardHeader>
          <CardTitle>Sales by Region</CardTitle>
          <CardDescription>Geographic distribution of sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockSalesByRegion.map((region) => (
              <div key={region.region} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{region.region}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                      }).format(region.sales)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(region.sales / 32000) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-1">
                  {region.growth > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${
                    region.growth > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(region.growth)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}