"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Plus, 
  Upload, 
  Edit3, 
  Filter,
  Download,
  Grid,
  List
} from "lucide-react"

// Mock product data
const mockProducts = Array.from({ length: 100 }, (_, i) => ({
  id: `prod_${i + 1}`,
  title: `Product ${i + 1}`,
  sku: `SKU-${String(i + 1).padStart(5, '0')}`,
  price: (Math.random() * 100 + 10).toFixed(2),
  compareAtPrice: (Math.random() * 150 + 20).toFixed(2),
  inventory: Math.floor(Math.random() * 100),
  status: Math.random() > 0.7 ? 'draft' : 'active',
  vendor: ['Vendor A', 'Vendor B', 'Vendor C'][Math.floor(Math.random() * 3)],
  tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1),
  image: `https://via.placeholder.com/200x200?text=Product+${i + 1}`,
}))

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [products] = useState(mockProducts)

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Link href="/products/bulk-edit">
            <Button variant="outline">
              <Edit3 className="h-4 w-4 mr-2" />
              Bulk Edit
            </Button>
          </Link>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            <SelectItem value="vendorA">Vendor A</SelectItem>
            <SelectItem value="vendorB">Vendor B</SelectItem>
            <SelectItem value="vendorC">Vendor C</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      <div className={viewMode === "grid" 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
        : "space-y-2"
      }>
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            {viewMode === "grid" ? (
              <>
                <div className="aspect-square bg-gray-100 rounded-md mb-3">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover rounded-md"
                  />
                </div>
                <h3 className="font-semibold truncate">{product.title}</h3>
                <p className="text-sm text-muted-foreground">{product.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold">${product.price}</span>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                    {product.status}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded-md"
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{product.title}</h3>
                  <p className="text-sm text-muted-foreground">{product.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${product.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.inventory} in stock
                  </p>
                </div>
                <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                  {product.status}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}