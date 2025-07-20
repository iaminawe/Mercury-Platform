"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type CellType = "text" | "number" | "select" | "tags" | "currency"

interface CellEditorProps {
  value: any
  type: CellType
  options?: string[] // For select type
  onSave: (value: any) => void
  onCancel: () => void
  className?: string
}

export function CellEditor({
  value,
  type,
  options = [],
  onSave,
  onCancel,
  className,
}: CellEditorProps) {
  const [editValue, setEditValue] = useState(value)
  const [tagInput, setTagInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (type !== "select" && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [type])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  const handleSave = () => {
    let saveValue = editValue
    
    if (type === "number" || type === "currency") {
      saveValue = parseFloat(editValue) || 0
    }
    
    onSave(saveValue)
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault()
      const newTags = Array.isArray(editValue) ? [...editValue] : []
      if (!newTags.includes(tagInput.trim())) {
        newTags.push(tagInput.trim())
        setEditValue(newTags)
        setTagInput("")
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = editValue.filter((tag: string) => tag !== tagToRemove)
    setEditValue(newTags)
  }

  switch (type) {
    case "select":
      return (
        <Select
          value={editValue}
          onValueChange={(value) => {
            setEditValue(value)
            onSave(value)
          }}
          open
        >
          <SelectTrigger className={cn("h-8", className)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "tags":
      return (
        <div className={cn("p-2 border rounded-md bg-background", className)}>
          <div className="flex flex-wrap gap-1 mb-2">
            {Array.isArray(editValue) &&
              editValue.map((tag: string) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
          </div>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag..."
              className="h-7 text-sm"
            />
            <button
              onClick={handleSave}
              className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )

    case "currency":
      return (
        <div className="flex items-center">
          <span className="text-muted-foreground mr-1">$</span>
          <Input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={cn("h-8", className)}
          />
        </div>
      )

    case "number":
      return (
        <Input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn("h-8", className)}
        />
      )

    default:
      return (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn("h-8", className)}
        />
      )
  }
}

// Cell wrapper component for inline editing
interface EditableCellProps {
  value: any
  type: CellType
  options?: string[]
  onUpdate: (value: any) => void
  displayFormatter?: (value: any) => React.ReactNode
}

export function EditableCell({
  value,
  type,
  options,
  onUpdate,
  displayFormatter,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = (newValue: any) => {
    onUpdate(newValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <CellEditor
        value={value}
        type={type}
        options={options}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <div
      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
      onClick={() => setIsEditing(true)}
    >
      {displayFormatter ? displayFormatter(value) : value}
    </div>
  )
}