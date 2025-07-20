"use client"

import React, { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Undo2, Redo2, History, ChevronDown } from "lucide-react"
import { format } from "date-fns"

interface HistoryEntry {
  id: string
  timestamp: Date
  description: string
  changes: any[]
  userId?: string
  undone?: boolean
}

interface UndoRedoProps {
  history: HistoryEntry[]
  currentIndex: number
  onUndo: () => void
  onRedo: () => void
  onJumpToState: (index: number) => void
  maxHistorySize?: number
}

export function UndoRedo({
  history,
  currentIndex,
  onUndo,
  onRedo,
  onJumpToState,
  maxHistorySize = 100,
}: UndoRedoProps) {
  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) onUndo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) onRedo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canUndo, canRedo, onUndo, onRedo])

  const getActionDescription = (entry: HistoryEntry) => {
    const changeCount = entry.changes.length
    const time = format(entry.timestamp, "HH:mm")
    return `${entry.description} (${changeCount} changes) - ${time}`
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 w-8"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (⌘Z)</p>
            {canUndo && (
              <p className="text-xs text-muted-foreground">
                {getActionDescription(history[currentIndex - 1])}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (⌘⇧Z)</p>
            {canRedo && (
              <p className="text-xs text-muted-foreground">
                {getActionDescription(history[currentIndex + 1])}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <History className="h-4 w-4 mr-1" />
              History
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[300px]">
            <div className="px-2 py-1.5 text-sm font-semibold">
              Edit History ({history.length} entries)
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-[400px] overflow-y-auto">
              {history.map((entry, index) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() => onJumpToState(index)}
                  className={`cursor-pointer ${
                    index === currentIndex
                      ? "bg-accent"
                      : index > currentIndex
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{entry.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(entry.timestamp, "MMM d, HH:mm")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.changes.length} changes
                      {entry.userId && ` by User ${entry.userId}`}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}

// Hook for managing undo/redo state
export function useUndoRedo<T>(
  initialState: T,
  options: {
    maxHistorySize?: number
    debounceMs?: number
    persist?: boolean
    persistKey?: string
  } = {}
) {
  const {
    maxHistorySize = 100,
    debounceMs = 500,
    persist = false,
    persistKey = "undo-redo-history",
  } = options

  const [state, setState] = React.useState<T>(initialState)
  const [history, setHistory] = React.useState<HistoryEntry[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(-1)
  const debounceTimerRef = React.useRef<NodeJS.Timeout>()

  // Load from localStorage if persist is enabled
  React.useEffect(() => {
    if (persist && typeof window !== "undefined") {
      const saved = localStorage.getItem(persistKey)
      if (saved) {
        try {
          const { state: savedState, history: savedHistory, currentIndex: savedIndex } = JSON.parse(saved)
          setState(savedState)
          setHistory(savedHistory.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          })))
          setCurrentIndex(savedIndex)
        } catch (e) {
          console.error("Failed to load undo/redo history:", e)
        }
      }
    }
  }, [persist, persistKey])

  // Save to localStorage if persist is enabled
  const saveToStorage = useCallback(() => {
    if (persist && typeof window !== "undefined") {
      localStorage.setItem(
        persistKey,
        JSON.stringify({ state, history, currentIndex })
      )
    }
  }, [persist, persistKey, state, history, currentIndex])

  const addToHistory = useCallback(
    (newState: T, description: string) => {
      clearTimeout(debounceTimerRef.current)
      
      debounceTimerRef.current = setTimeout(() => {
        setHistory((prev) => {
          // Remove any entries after current index (for branching history)
          const newHistory = prev.slice(0, currentIndex + 1)
          
          // Add new entry
          const entry: HistoryEntry = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            description,
            changes: [], // In real implementation, calculate diff
          }
          
          newHistory.push(entry)
          
          // Limit history size
          if (newHistory.length > maxHistorySize) {
            newHistory.shift()
          }
          
          return newHistory
        })
        
        setCurrentIndex((prev) => Math.min(prev + 1, maxHistorySize - 1))
        setState(newState)
        saveToStorage()
      }, debounceMs)
    },
    [currentIndex, maxHistorySize, debounceMs, saveToStorage]
  )

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      // In real implementation, apply the previous state
      saveToStorage()
    }
  }, [currentIndex, saveToStorage])

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1)
      // In real implementation, apply the next state
      saveToStorage()
    }
  }, [currentIndex, history.length, saveToStorage])

  const jumpToState = useCallback(
    (index: number) => {
      if (index >= 0 && index < history.length) {
        setCurrentIndex(index)
        // In real implementation, apply the state at index
        saveToStorage()
      }
    },
    [history.length, saveToStorage]
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentIndex(-1)
    if (persist && typeof window !== "undefined") {
      localStorage.removeItem(persistKey)
    }
  }, [persist, persistKey])

  return {
    state,
    setState: (newState: T, description: string) => addToHistory(newState, description),
    history,
    currentIndex,
    undo,
    redo,
    jumpToState,
    clearHistory,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  }
}