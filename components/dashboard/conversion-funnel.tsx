"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface FunnelData {
  name: string
  value: number
  percentage: number
  color?: string
}

interface ConversionFunnelProps {
  data: FunnelData[]
  isLoading?: boolean
}

const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function ConversionFunnel({ data, isLoading = false }: ConversionFunnelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Customer journey from visit to purchase</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {data.name}
              </span>
              <span className="font-bold text-muted-foreground">
                {data.value.toLocaleString()} ({data.percentage}%)
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>Customer journey from visit to purchase</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="horizontal"
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || defaultColors[index % defaultColors.length]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {data.map((step, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: step.color || defaultColors[index % defaultColors.length] }}
                  />
                  <span className="font-medium">{step.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {step.value.toLocaleString()} ({step.percentage}%)
                </span>
              </div>
              {index < data.length - 1 && (
                <div className="ml-5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>→</span>
                  <span>
                    {((data[index + 1].value / step.value) * 100).toFixed(1)}% conversion rate
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}