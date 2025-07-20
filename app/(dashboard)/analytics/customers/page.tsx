"use client"

import * as React from "react"
import { DateRangePicker, type DateRange } from "@/components/dashboard/date-range-picker"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { CustomerSegments } from "@/components/dashboard/customer-segments"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Users, UserPlus, UserCheck, TrendingUp } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Mock data
const customerMetrics = [
  {
    title: "Total Customers",
    value: 2456,
    change: 12.5,
    changeLabel: "from last month",
    format: "number" as const,
    icon: Users,
  },
  {
    title: "New Customers",
    value: 245,
    change: 18.2,
    changeLabel: "from last month",
    format: "number" as const,
    icon: UserPlus,
  },
  {
    title: "Returning Rate",
    value: 68.5,
    change: 5.3,
    changeLabel: "from last month",
    format: "percent" as const,
    icon: UserCheck,
  },
  {
    title: "Customer Lifetime Value",
    value: 485,
    change: 22.1,
    changeLabel: "from last month",
    format: "currency" as const,
  },
]

const mockCustomerGrowth = Array.from({ length: 12 }, (_, i) => {
  const month = new Date()
  month.setMonth(month.getMonth() - 11 + i)
  return {
    month: month.toLocaleDateString('en-US', { month: 'short' }),
    total: 1500 + i * 100 + Math.floor(Math.random() * 50),
    new: 100 + Math.floor(Math.random() * 50),
    returning: 50 + Math.floor(Math.random() * 30),
  }
})

const mockCustomerSegments = [
  { name: "One-time buyers", value: 856, percentage: 35, color: "hsl(var(--chart-1))" },
  { name: "Occasional buyers", value: 612, percentage: 25, color: "hsl(var(--chart-2))" },
  { name: "Regular customers", value: 490, percentage: 20, color: "hsl(var(--chart-3))" },
  { name: "VIP customers", value: 245, percentage: 10, color: "hsl(var(--chart-4))" },
  { name: "Inactive", value: 253, percentage: 10, color: "hsl(var(--chart-5))" },
]

const mockTopCustomers = [
  { id: 1, name: "John Smith", orders: 45, totalSpent: 5420, avgOrderValue: 120.44, lastOrder: "2 days ago" },
  { id: 2, name: "Emma Johnson", orders: 38, totalSpent: 4180, avgOrderValue: 110.00, lastOrder: "5 days ago" },
  { id: 3, name: "Michael Brown", orders: 32, totalSpent: 3840, avgOrderValue: 120.00, lastOrder: "1 week ago" },
  { id: 4, name: "Sarah Davis", orders: 28, totalSpent: 3220, avgOrderValue: 115.00, lastOrder: "3 days ago" },
  { id: 5, name: "James Wilson", orders: 25, totalSpent: 2875, avgOrderValue: 115.00, lastOrder: "2 weeks ago" },
]

const mockCustomerActivity = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  active: Math.floor(Math.random() * 100) + 20,
  purchases: Math.floor(Math.random() * 20) + 5,
}))

const mockGeographicData = [
  { location: "United States", customers: 1245, percentage: 50.7 },
  { location: "Canada", customers: 356, percentage: 14.5 },
  { location: "United Kingdom", customers: 234, percentage: 9.5 },
  { location: "Germany", customers: 189, percentage: 7.7 },
  { location: "Australia", customers: 156, percentage: 6.4 },
  { location: "Others", customers: 276, percentage: 11.2 },
]

export default function CustomerAnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date(),
  })

  const handleExport = () => {
    console.log("Exporting customer data...")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Analytics</h1>
          <p className="text-muted-foreground">
            Understand your customer base and behavior patterns
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

      {/* Customer Metrics */}
      <MetricsCards metrics={customerMetrics} />

      {/* Customer Growth and Segments */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth</CardTitle>
              <CardDescription>Monthly customer acquisition and retention</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockCustomerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="new"
                    stackId="2"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="returning"
                    stackId="2"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <CustomerSegments data={mockCustomerSegments} />
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <CardDescription>Your most valuable customers by total spend</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Avg. Order Value</TableHead>
                <TableHead className="text-right">Last Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTopCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-right">{customer.orders}</TableCell>
                  <TableCell className="text-right">
                    ${customer.totalSpent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${customer.avgOrderValue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {customer.lastOrder}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer Activity and Geographic Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Activity Pattern */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Activity Pattern</CardTitle>
            <CardDescription>Active customers by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockCustomerActivity}>
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
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
            <CardDescription>Customers by location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockGeographicData.map((location) => (
                <div key={location.location} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{location.location}</span>
                    <span className="text-muted-foreground">
                      {location.customers.toLocaleString()} ({location.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${location.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}