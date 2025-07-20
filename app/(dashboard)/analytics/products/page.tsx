"use client"

import * as React from "react"
import { DateRangePicker, type DateRange } from "@/components/dashboard/date-range-picker"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { TopProductsTable } from "@/components/dashboard/top-products-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Package, TrendingUp, AlertCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Mock data
const productMetrics = [
  {
    title: "Total Products",
    value: 156,
    change: 8,
    changeLabel: "from last month",
    format: "number" as const,
    icon: Package,
  },
  {
    title: "Top Product Revenue",
    value: 12500,
    change: 25.5,
    changeLabel: "from last month",
    format: "currency" as const,
  },
  {
    title: "Avg. Product Views",
    value: 1250,
    change: -5.2,
    changeLabel: "from last month",
    format: "number" as const,
  },
  {
    title: "Product Conversion",
    value: 4.8,
    change: 0.3,
    changeLabel: "from last month",
    format: "percent" as const,
  },
]

const mockProductCategories = [
  { name: "Electronics", value: 35, color: "hsl(var(--chart-1))" },
  { name: "Clothing", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Home & Garden", value: 20, color: "hsl(var(--chart-3))" },
  { name: "Sports", value: 10, color: "hsl(var(--chart-4))" },
  { name: "Other", value: 7, color: "hsl(var(--chart-5))" },
]

const mockInventoryAlerts = [
  { product: "Premium Widget Pro", stock: 5, status: "critical", trend: "decreasing" },
  { product: "Deluxe Widget Plus", stock: 12, status: "low", trend: "stable" },
  { product: "Widget Accessories Pack", stock: 18, status: "low", trend: "decreasing" },
]

const mockProductPerformance = [
  { product: "Premium Widget Pro", views: 5420, cartAdds: 542, purchases: 125, conversionRate: 2.3 },
  { product: "Standard Widget", views: 4200, cartAdds: 630, purchases: 178, conversionRate: 4.2 },
  { product: "Deluxe Widget Plus", views: 3100, cartAdds: 248, purchases: 76, conversionRate: 2.5 },
  { product: "Basic Widget", views: 2800, cartAdds: 420, purchases: 216, conversionRate: 7.7 },
  { product: "Widget Accessories Pack", views: 2400, cartAdds: 360, purchases: 160, conversionRate: 6.7 },
]

const mockTopProducts = [
  { id: "1", name: "Premium Widget Pro", revenue: 12500, units: 125, avgOrderValue: 100 },
  { id: "2", name: "Standard Widget", revenue: 8900, units: 178, avgOrderValue: 50 },
  { id: "3", name: "Deluxe Widget Plus", revenue: 7600, units: 76, avgOrderValue: 100 },
  { id: "4", name: "Basic Widget", revenue: 5400, units: 216, avgOrderValue: 25 },
  { id: "5", name: "Widget Accessories Pack", revenue: 3200, units: 160, avgOrderValue: 20 },
]

export default function ProductAnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date(),
  })

  const handleExport = (format: 'csv' | 'json') => {
    console.log(`Exporting as ${format}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Analytics</h1>
          <p className="text-muted-foreground">
            Monitor product performance and inventory insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button onClick={() => handleExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Product Metrics */}
      <MetricsCards metrics={productMetrics} />

      {/* Top Products and Category Distribution */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2">
          <TopProductsTable 
            products={mockTopProducts} 
            onExport={handleExport}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>Products by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={mockProductCategories}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {mockProductCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance Funnel</CardTitle>
          <CardDescription>Detailed conversion metrics for each product</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Cart Adds</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProductPerformance.map((product) => (
                <TableRow key={product.product}>
                  <TableCell className="font-medium">{product.product}</TableCell>
                  <TableCell className="text-right">{product.views.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{product.cartAdds.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{product.purchases.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className={product.conversionRate > 5 ? "text-green-600 font-medium" : ""}>
                      {product.conversionRate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inventory Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Inventory Alerts</CardTitle>
            <CardDescription>Products with low stock levels</CardDescription>
          </div>
          <AlertCircle className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockInventoryAlerts.map((alert) => (
              <div key={alert.product} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{alert.product}</p>
                  <p className="text-sm text-muted-foreground">
                    {alert.stock} units remaining
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${
                    alert.status === 'critical' ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {alert.status.toUpperCase()}
                  </span>
                  {alert.trend === 'decreasing' && (
                    <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}