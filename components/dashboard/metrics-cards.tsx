"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon, DollarSignIcon, ShoppingCartIcon, UsersIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface MetricData {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ComponentType<{ className?: string }>
  format?: "currency" | "number" | "percent"
}

interface MetricsCardsProps {
  metrics: MetricData[]
  isLoading?: boolean
}

const formatValue = (value: string | number, format?: MetricData["format"]) => {
  if (typeof value === "string") return value
  
  switch (format) {
    case "currency":
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case "percent":
      return `${value}%`
    case "number":
    default:
      return new Intl.NumberFormat('en-US').format(value)
  }
}

const defaultIcons = {
  revenue: DollarSignIcon,
  orders: ShoppingCartIcon,
  customers: UsersIcon,
  growth: TrendingUpIcon,
}

export function MetricsCards({ metrics, isLoading = false }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-[120px]" />
              <Skeleton className="h-3 w-[80px] mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon || defaultIcons.revenue
        const isPositive = metric.change && metric.change > 0
        const isNegative = metric.change && metric.change < 0

        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatValue(metric.value, metric.format)}
              </div>
              {metric.change !== undefined && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {isPositive && (
                    <ArrowUpIcon className="h-3 w-3 text-green-600" />
                  )}
                  {isNegative && (
                    <ArrowDownIcon className="h-3 w-3 text-red-600" />
                  )}
                  <span className={cn(
                    isPositive && "text-green-600",
                    isNegative && "text-red-600"
                  )}>
                    {Math.abs(metric.change)}%
                  </span>
                  <span>{metric.changeLabel || "from last period"}</span>
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}