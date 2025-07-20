"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Edit3,
  Trash2,
  Archive,
  Tag,
  DollarSign,
  Package,
  Clock,
  ChevronDown,
  X,
  Plus,
} from "lucide-react"
import { format } from "date-fns"

interface BulkActionsProps {
  selectedCount: number
  onBulkUpdate: (action: BulkAction) => void
  onScheduleUpdate: (action: ScheduledAction) => void
}

export interface BulkAction {
  type: "update" | "delete" | "archive"
  field?: string
  value?: any
  operation?: "set" | "increase" | "decrease" | "multiply"
}

export interface ScheduledAction extends BulkAction {
  scheduledFor: Date
  description?: string
}

export function BulkActions({
  selectedCount,
  onBulkUpdate,
  onScheduleUpdate,
}: BulkActionsProps) {
  const [priceAction, setPriceAction] = useState<"set" | "increase" | "decrease" | "multiply">("set")
  const [priceValue, setPriceValue] = useState("")
  const [statusValue, setStatusValue] = useState<string>("")
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([])
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [scheduleDate, setScheduleDate] = useState<string>("")
  const [scheduleTime, setScheduleTime] = useState<string>("")
  const [scheduleDescription, setScheduleDescription] = useState("")

  const isDisabled = selectedCount === 0

  const handlePriceUpdate = () => {
    const numValue = parseFloat(priceValue)
    if (isNaN(numValue)) return

    onBulkUpdate({
      type: "update",
      field: "price",
      value: numValue,
      operation: priceAction,
    })
  }

  const handleStatusUpdate = () => {
    if (!statusValue) return

    onBulkUpdate({
      type: "update",
      field: "status",
      value: statusValue,
      operation: "set",
    })
  }

  const handleTagsUpdate = () => {
    if (tagsToAdd.length > 0) {
      onBulkUpdate({
        type: "update",
        field: "tags",
        value: { add: tagsToAdd },
        operation: "set",
      })
    }
    
    if (tagsToRemove.length > 0) {
      onBulkUpdate({
        type: "update",
        field: "tags",
        value: { remove: tagsToRemove },
        operation: "set",
      })
    }
  }

  const handleSchedule = (action: BulkAction) => {
    if (!scheduleDate || !scheduleTime) return

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`)
    
    onScheduleUpdate({
      ...action,
      scheduledFor,
      description: scheduleDescription,
    })
  }

  const addTag = (list: "add" | "remove") => {
    if (!tagInput.trim()) return
    
    if (list === "add") {
      setTagsToAdd([...tagsToAdd, tagInput.trim()])
    } else {
      setTagsToRemove([...tagsToRemove, tagInput.trim()])
    }
    setTagInput("")
  }

  const removeTag = (tag: string, list: "add" | "remove") => {
    if (list === "add") {
      setTagsToAdd(tagsToAdd.filter(t => t !== tag))
    } else {
      setTagsToRemove(tagsToRemove.filter(t => t !== tag))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {selectedCount} selected
      </span>
      
      {/* Quick Actions */}
      <div className="flex gap-1">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Price
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Prices</DialogTitle>
              <DialogDescription>
                Update prices for {selectedCount} selected products
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Action</Label>
                <Select
                  value={priceAction}
                  onValueChange={(value: any) => setPriceAction(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Set to</SelectItem>
                    <SelectItem value="increase">Increase by</SelectItem>
                    <SelectItem value="decrease">Decrease by</SelectItem>
                    <SelectItem value="multiply">Multiply by</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  placeholder={priceAction === "multiply" ? "1.5" : "10.00"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPriceValue("")}>
                Cancel
              </Button>
              <Button onClick={handlePriceUpdate}>
                Update Prices
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
            >
              <Tag className="h-4 w-4 mr-1" />
              Tags
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Tags</DialogTitle>
              <DialogDescription>
                Add or remove tags for {selectedCount} selected products
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Add Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Enter tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag("add")
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => addTag("add")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tagsToAdd.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeTag(tag, "add")}
                    >
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Remove Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Enter tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag("remove")
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => addTag("remove")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tagsToRemove.map((tag) => (
                    <Badge
                      key={tag}
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => removeTag(tag, "remove")}
                    >
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTagsToAdd([])
                  setTagsToRemove([])
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleTagsUpdate}>
                Update Tags
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
            >
              <Package className="h-4 w-4 mr-1" />
              Status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Status</DialogTitle>
              <DialogDescription>
                Change status for {selectedCount} selected products
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>New Status</Label>
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusValue("")}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate}>
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isDisabled}>
            More Actions
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Dialog>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Clock className="h-4 w-4 mr-2" />
                Schedule Updates
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Updates</DialogTitle>
                <DialogDescription>
                  Schedule bulk updates for a future date
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={scheduleDescription}
                    onChange={(e) => setScheduleDescription(e.target.value)}
                    placeholder="Optional description for this scheduled update"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">
                  Cancel
                </Button>
                <Button>
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => onBulkUpdate({ type: "archive" })}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive Selected
          </DropdownMenuItem>
          
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onBulkUpdate({ type: "delete" })}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}