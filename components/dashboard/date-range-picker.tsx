"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type DateRange = {
  from: Date
  to: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const presets = [
  {
    name: "Today",
    getValue: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const end = new Date(today)
      end.setHours(23, 59, 59, 999)
      return { from: today, to: end }
    }
  },
  {
    name: "Yesterday",
    getValue: () => {
      const yesterday = subDays(new Date(), 1)
      yesterday.setHours(0, 0, 0, 0)
      const end = new Date(yesterday)
      end.setHours(23, 59, 59, 999)
      return { from: yesterday, to: end }
    }
  },
  {
    name: "Last 7 days",
    getValue: () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const from = subDays(new Date(), 6)
      from.setHours(0, 0, 0, 0)
      return { from, to: today }
    }
  },
  {
    name: "Last 30 days",
    getValue: () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const from = subDays(new Date(), 29)
      from.setHours(0, 0, 0, 0)
      return { from, to: today }
    }
  },
  {
    name: "This month",
    getValue: () => {
      const start = startOfMonth(new Date())
      const end = endOfMonth(new Date())
      end.setHours(23, 59, 59, 999)
      return { from: start, to: end }
    }
  },
  {
    name: "Last month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1)
      const start = startOfMonth(lastMonth)
      const end = endOfMonth(lastMonth)
      end.setHours(23, 59, 59, 999)
      return { from: start, to: end }
    }
  },
  {
    name: "This year",
    getValue: () => {
      const start = startOfYear(new Date())
      const end = endOfYear(new Date())
      end.setHours(23, 59, 59, 999)
      return { from: start, to: end }
    }
  },
  {
    name: "Last year",
    getValue: () => {
      const lastYear = subYears(new Date(), 1)
      const start = startOfYear(lastYear)
      const end = endOfYear(lastYear)
      end.setHours(23, 59, 59, 999)
      return { from: start, to: end }
    }
  },
]

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<string>("")

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find(p => p.name === presetName)
    if (preset) {
      setSelectedPreset(presetName)
      onChange(preset.getValue())
    }
  }

  const formatDateRange = () => {
    if (value.from && value.to) {
      return `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`
    }
    return "Select date range"
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[280px]">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 opacity-50" />
            <SelectValue placeholder={formatDateRange()} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.name} value={preset.name}>
              {preset.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}