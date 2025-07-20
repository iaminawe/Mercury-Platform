'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Puzzle, 
  Plus, 
  Download, 
  Users, 
  Star, 
  TrendingUp,
  Code,
  Settings,
  Upload,
  Trash2,
  ExternalLink,
  Search,
  Filter
} from 'lucide-react'

interface Extension {
  id: string
  name: string
  description: string
  version: string
  status: 'published' | 'draft' | 'review'
  installs: number
  rating: number
  category: string
  author: string
  createdAt: string
  updatedAt: string
  revenue: number
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: '1',
      name: 'Smart Product Recommendations',
      description: 'AI-powered product recommendations that increase conversion rates by 25%',
      version: '2.1.0',
      status: 'published',
      installs: 1284,
      rating: 4.8,
      category: 'AI & Machine Learning',
      author: 'Mercury Labs',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-18',
      revenue: 2450
    },
    {
      id: '2',
      name: 'Advanced Analytics Dashboard',
      description: 'Comprehensive analytics with predictive insights and custom reports',
      version: '1.3.2',
      status: 'published',
      installs: 892,
      rating: 4.6,
      category: 'Analytics',
      author: 'Mercury Labs',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-16',
      revenue: 1800
    },
    {
      id: '3',
      name: 'Email Marketing Automation',
      description: 'Automated email campaigns with personalization and A/B testing',
      version: '1.0.0',
      status: 'review',
      installs: 0,
      rating: 0,
      category: 'Marketing',
      author: 'Mercury Labs',
      createdAt: '2024-01-19',
      updatedAt: '2024-01-19',
      revenue: 0
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categories = [
    'AI & Machine Learning',
    'Analytics',
    'Marketing',
    'Payments',
    'Shipping',
    'Customer Service',
    'Inventory',
    'SEO'
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800">Published</Badge>
      case 'draft':
        return <Badge variant="outline">Draft</Badge>
      case 'review':
        return <Badge className="bg-orange-100 text-orange-800">Under Review</Badge>
      default:
        return null
    }
  }

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ext.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extensions</h2>
          <p className="text-muted-foreground">
            Manage and publish your Mercury extensions
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Extension
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Extension</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Extension Name</label>
                  <Input placeholder="My Awesome Extension" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select className="w-full px-3 py-2 border rounded-md">
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-md h-24"
                  placeholder="Describe what your extension does..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload Extension Package</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Drop your .zip file here or click to browse
                  </p>
                  <Button variant="outline" className="mt-2">
                    Choose File
                  </Button>
                </div>
              </div>
              <Button className="w-full">
                Create Extension
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search extensions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="my-extensions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-extensions">My Extensions</TabsTrigger>
          <TabsTrigger value="marketplace">Extension Marketplace</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="my-extensions" className="space-y-4">
          {filteredExtensions.map((extension) => (
            <Card key={extension.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Puzzle className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">{extension.name}</h3>
                      {getStatusBadge(extension.status)}
                    </div>
                    <p className="text-muted-foreground text-sm max-w-2xl">
                      {extension.description}
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center space-x-1">
                        <Code className="w-4 h-4" />
                        <span>v{extension.version}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Download className="w-4 h-4" />
                        <span>{extension.installs.toLocaleString()} installs</span>
                      </span>
                      {extension.rating > 0 && (
                        <span className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>{extension.rating}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <TrendingUp className="w-4 h-4" />
                        <span>${extension.revenue}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{extension.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Updated {extension.updatedAt}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Featured Extensions */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Community Reviews Widget</h3>
                  <p className="text-sm text-muted-foreground">
                    Add customer reviews and ratings to your store
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>4.9</span>
                    <span className="text-muted-foreground">(234)</span>
                  </div>
                  <Badge variant="outline">Marketing</Badge>
                </div>
                <Button className="w-full" size="sm">
                  Install Extension
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Advanced Inventory Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Multi-channel inventory synchronization
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>4.7</span>
                    <span className="text-muted-foreground">(89)</span>
                  </div>
                  <Badge variant="outline">Inventory</Badge>
                </div>
                <Button className="w-full" size="sm">
                  Install Extension
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">SEO Optimizer Pro</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatic SEO optimization and meta tags
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>4.8</span>
                    <span className="text-muted-foreground">(156)</span>
                  </div>
                  <Badge variant="outline">SEO</Badge>
                </div>
                <Button className="w-full" size="sm">
                  Install Extension
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Extensions</p>
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-green-600">+2 this month</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Installs</p>
                <p className="text-2xl font-bold">2,176</p>
                <p className="text-xs text-green-600">+324 this month</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">$4,250</p>
                <p className="text-xs text-green-600">+18% this month</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">4.7</p>
                <p className="text-xs text-green-600">+0.2 this month</p>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Extension Performance</h3>
            <div className="space-y-4">
              {extensions.filter(ext => ext.status === 'published').map(extension => (
                <div key={extension.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{extension.name}</p>
                    <p className="text-sm text-muted-foreground">{extension.category}</p>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{extension.installs.toLocaleString()}</p>
                      <p className="text-muted-foreground">Installs</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{extension.rating}</p>
                      <p className="text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">${extension.revenue}</p>
                      <p className="text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}