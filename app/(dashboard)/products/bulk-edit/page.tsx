"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DataGrid } from "@/components/bulk-editor/data-grid"
import { EditableCell, CellType } from "@/components/bulk-editor/cell-editor"
import { BulkActions, BulkAction, ScheduledAction } from "@/components/bulk-editor/bulk-actions"
import { UndoRedo, useUndoRedo } from "@/components/bulk-editor/undo-redo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastViewport,
} from "@/components/ui/toast"
import { ArrowLeft, Save, Download, Upload } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import Papa from "papaparse"

// Product type definition
interface Product {
  id: string
  title: string
  sku: string
  price: number
  compareAtPrice: number
  inventory: number
  status: "active" | "draft" | "archived"
  vendor: string
  tags: string[]
  image: string
}

// Mock data - same as products page
const initialProducts: Product[] = Array.from({ length: 100 }, (_, i) => ({
  id: `prod_${i + 1}`,
  title: `Product ${i + 1}`,
  sku: `SKU-${String(i + 1).padStart(5, '0')}`,
  price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
  compareAtPrice: parseFloat((Math.random() * 150 + 20).toFixed(2)),
  inventory: Math.floor(Math.random() * 100),
  status: Math.random() > 0.7 ? 'draft' : 'active',
  vendor: ['Vendor A', 'Vendor B', 'Vendor C'][Math.floor(Math.random() * 3)],
  tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1),
  image: `https://via.placeholder.com/200x200?text=Product+${i + 1}`,
}))

export default function BulkEditPage() {
  const router = useRouter()
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [showSaveNotification, setShowSaveNotification] = useState(false)
  
  const {
    state: products,
    setState: setProducts,
    history,
    currentIndex,
    undo,
    redo,
    jumpToState,
    canUndo,
    canRedo,
  } = useUndoRedo(initialProducts, {
    maxHistorySize: 50,
    debounceMs: 500,
    persist: true,
    persistKey: "bulk-editor-history",
  })

  // Update cell value
  const updateCellValue = useCallback(
    (rowIndex: number, columnId: string, value: any) => {
      const newProducts = [...products]
      newProducts[rowIndex] = {
        ...newProducts[rowIndex],
        [columnId]: value,
      }
      setProducts(newProducts, `Updated ${columnId} for ${newProducts[rowIndex].title}`)
    },
    [products, setProducts]
  )

  // Handle bulk actions
  const handleBulkUpdate = useCallback(
    (action: BulkAction) => {
      if (selectedProducts.length === 0) return

      const selectedIds = new Set(selectedProducts.map(p => p.id))
      let newProducts = [...products]
      let description = ""

      switch (action.type) {
        case "update":
          if (action.field === "price" && action.value) {
            newProducts = newProducts.map(product => {
              if (!selectedIds.has(product.id)) return product
              
              let newPrice = product.price
              switch (action.operation) {
                case "set":
                  newPrice = action.value
                  break
                case "increase":
                  newPrice = product.price + action.value
                  break
                case "decrease":
                  newPrice = Math.max(0, product.price - action.value)
                  break
                case "multiply":
                  newPrice = product.price * action.value
                  break
              }
              
              return { ...product, price: parseFloat(newPrice.toFixed(2)) }
            })
            description = `Updated prices for ${selectedProducts.length} products`
          } else if (action.field === "status" && action.value) {
            newProducts = newProducts.map(product => {
              if (!selectedIds.has(product.id)) return product
              return { ...product, status: action.value }
            })
            description = `Changed status to ${action.value} for ${selectedProducts.length} products`
          } else if (action.field === "tags" && action.value) {
            newProducts = newProducts.map(product => {
              if (!selectedIds.has(product.id)) return product
              let newTags = [...product.tags]
              
              if (action.value.add) {
                newTags = [...new Set([...newTags, ...action.value.add])]
              }
              if (action.value.remove) {
                newTags = newTags.filter(tag => !action.value.remove.includes(tag))
              }
              
              return { ...product, tags: newTags }
            })
            description = `Updated tags for ${selectedProducts.length} products`
          }
          break
          
        case "delete":
          newProducts = newProducts.filter(product => !selectedIds.has(product.id))
          description = `Deleted ${selectedProducts.length} products`
          break
          
        case "archive":
          newProducts = newProducts.map(product => {
            if (!selectedIds.has(product.id)) return product
            return { ...product, status: "archived" as const }
          })
          description = `Archived ${selectedProducts.length} products`
          break
      }

      setProducts(newProducts, description)
      setSelectedProducts([])
    },
    [products, selectedProducts, setProducts]
  )

  // Handle scheduled updates
  const handleScheduleUpdate = useCallback(
    (action: ScheduledAction) => {
      console.log("Scheduled update:", action)
      // In a real app, this would send to a backend to schedule the update
      setShowSaveNotification(true)
      setTimeout(() => setShowSaveNotification(false), 3000)
    },
    []
  )

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const csv = Papa.unparse(products)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `products-export-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [products])

  // Import from CSV
  const importFromCSV = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const importedProducts = results.data.map((row: any) => ({
            id: row.id || `prod_${Date.now()}_${Math.random()}`,
            title: row.title || "",
            sku: row.sku || "",
            price: parseFloat(row.price) || 0,
            compareAtPrice: parseFloat(row.compareAtPrice) || 0,
            inventory: parseInt(row.inventory) || 0,
            status: row.status || "draft",
            vendor: row.vendor || "",
            tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
            image: row.image || "",
          }))
          
          setProducts(importedProducts, `Imported ${importedProducts.length} products from CSV`)
        },
      })
    },
    [setProducts]
  )

  // Define columns
  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        id: "image",
        header: "Image",
        size: 80,
        cell: ({ row }) => (
          <img
            src={row.original.image}
            alt={row.original.title}
            className="w-12 h-12 object-cover rounded"
          />
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        size: 200,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="text"
            onUpdate={(value) => updateCellValue(row.index, "title", value)}
          />
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        size: 120,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="text"
            onUpdate={(value) => updateCellValue(row.index, "sku", value)}
          />
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 100,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="currency"
            onUpdate={(value) => updateCellValue(row.index, "price", value)}
            displayFormatter={(value) => `$${parseFloat(value).toFixed(2)}`}
          />
        ),
      },
      {
        accessorKey: "compareAtPrice",
        header: "Compare at",
        size: 100,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="currency"
            onUpdate={(value) => updateCellValue(row.index, "compareAtPrice", value)}
            displayFormatter={(value) => `$${parseFloat(value).toFixed(2)}`}
          />
        ),
      },
      {
        accessorKey: "inventory",
        header: "Inventory",
        size: 100,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="number"
            onUpdate={(value) => updateCellValue(row.index, "inventory", value)}
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="select"
            options={["active", "draft", "archived"]}
            onUpdate={(value) => updateCellValue(row.index, "status", value)}
            displayFormatter={(value) => (
              <Badge
                variant={
                  value === "active"
                    ? "default"
                    : value === "archived"
                    ? "secondary"
                    : "outline"
                }
              >
                {value}
              </Badge>
            )}
          />
        ),
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        size: 120,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="select"
            options={["Vendor A", "Vendor B", "Vendor C"]}
            onUpdate={(value) => updateCellValue(row.index, "vendor", value)}
          />
        ),
      },
      {
        accessorKey: "tags",
        header: "Tags",
        size: 200,
        cell: ({ getValue, row }) => (
          <EditableCell
            value={getValue()}
            type="tags"
            onUpdate={(value) => updateCellValue(row.index, "tags", value)}
            displayFormatter={(value: string[]) => (
              <div className="flex gap-1 flex-wrap">
                {value.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          />
        ),
      },
    ],
    [updateCellValue]
  )

  return (
    <ToastProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/products")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Bulk Edit Products</h1>
              <p className="text-sm text-muted-foreground">
                Edit multiple products at once
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <UndoRedo
              history={history}
              currentIndex={currentIndex}
              onUndo={undo}
              onRedo={redo}
              onJumpToState={jumpToState}
            />
            
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            
            <label>
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                onChange={importFromCSV}
                className="hidden"
              />
            </label>
            
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex items-center justify-between mb-4 p-4 bg-muted/50 rounded-lg">
          <BulkActions
            selectedCount={selectedProducts.length}
            onBulkUpdate={handleBulkUpdate}
            onScheduleUpdate={handleScheduleUpdate}
          />
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={columns}
            data={products}
            onDataChange={setProducts}
            enableSelection={true}
            enableVirtualization={true}
            onSelectionChange={setSelectedProducts}
          />
        </div>
      </div>

      {/* Toast Notifications */}
      {showSaveNotification && (
        <Toast>
          <ToastTitle>Success</ToastTitle>
          <ToastDescription>
            Your changes have been saved successfully.
          </ToastDescription>
        </Toast>
      )}
      <ToastViewport />
    </ToastProvider>
  )
}