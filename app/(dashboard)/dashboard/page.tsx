"use client"

import * as React from "react"
import { DateRangePicker, type DateRange } from "@/components/dashboard/date-range-picker"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { TopProductsTable } from "@/components/dashboard/top-products-table"
import { CustomerSegments } from "@/components/dashboard/customer-segments"
import { ConversionFunnel } from "@/components/dashboard/conversion-funnel"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

// Mock data for demonstration
const mockRevenueData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - 29 + i)
  return {
    date: date.toISOString().split('T')[0],
    revenue: Math.floor(Math.random() * 10000) + 5000,
    previousRevenue: Math.floor(Math.random() * 10000) + 4000,
  }
})

const mockMetrics = [
  {
    title: "Total Revenue",
    value: 45231,
    change: 20.1,
    changeLabel: "from last month",
    format: "currency" as const,
  },
  {
    title: "Orders",
    value: 356,
    change: 15.3,
    changeLabel: "from last month",
    format: "number" as const,
  },
  {
    title: "Average Order Value",
    value: 127,
    change: -5.2,
    changeLabel: "from last month",
    format: "currency" as const,
  },
  {
    title: "Conversion Rate",
    value: 3.4,
    change: 2.1,
    changeLabel: "from last month",
    format: "percent" as const,
  },
]

const mockProducts = [
  {
    id: "1",
    name: "Premium Widget Pro",
    revenue: 12500,
    units: 125,
    avgOrderValue: 100,
  },
  {
    id: "2",
    name: "Standard Widget",
    revenue: 8900,
    units: 178,
    avgOrderValue: 50,
  },
  {
    id: "3",
    name: "Deluxe Widget Plus",
    revenue: 7600,
    units: 76,
    avgOrderValue: 100,
  },
  {
    id: "4",
    name: "Basic Widget",
    revenue: 5400,
    units: 216,
    avgOrderValue: 25,
  },
  {
    id: "5",
    name: "Widget Accessories Pack",
    revenue: 3200,
    units: 160,
    avgOrderValue: 20,
  },
]

const mockCustomerSegments = [
  { name: "New Customers", value: 245, percentage: 35, color: "hsl(var(--chart-1))" },
  { name: "Returning Customers", value: 455, percentage: 65, color: "hsl(var(--chart-2))" },
]

const mockFunnelData = [
  { name: "Page Views", value: 10000, percentage: 100, color: "hsl(var(--chart-1))" },
  { name: "Product Views", value: 6500, percentage: 65, color: "hsl(var(--chart-2))" },
  { name: "Add to Cart", value: 3200, percentage: 32, color: "hsl(var(--chart-3))" },
  { name: "Checkout", value: 1800, percentage: 18, color: "hsl(var(--chart-4))" },
  { name: "Purchase", value: 980, percentage: 9.8, color: "hsl(var(--chart-5))" },
]

export default function DashboardPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date(),
  })
  const [isLoading, setIsLoading] = React.useState(false)

  const handleRefresh = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleExport = (format: 'csv' | 'json') => {
    // In a real app, this would generate and download the file
    console.log(`Exporting as ${format}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your store performance and analytics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricsCards metrics={mockMetrics} isLoading={isLoading} />

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <RevenueChart 
            data={mockRevenueData} 
            isLoading={isLoading}
            title="Revenue Trend"
            description="Daily revenue with previous period comparison"
          />
        </div>
        <div className="col-span-3">
          <CustomerSegments 
            data={mockCustomerSegments} 
            isLoading={isLoading} 
          />
        </div>
      </div>

      {/* Tables and Funnel Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopProductsTable 
          products={mockProducts} 
          isLoading={isLoading}
          onExport={handleExport}
        />
        <ConversionFunnel 
          data={mockFunnelData} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  )
}