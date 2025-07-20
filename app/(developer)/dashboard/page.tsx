'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Key,
  Puzzle,
  BookOpen,
  Code,
  ExternalLink,
  Rocket,
  Zap
} from 'lucide-react'

export default function DeveloperDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to Mercury Developer Portal</h1>
            <p className="text-blue-100 text-lg mb-4">
              Build powerful e-commerce solutions with Mercury's AI-powered APIs
            </p>
            <div className="flex items-center space-x-4">
              <Button className="bg-white text-blue-600 hover:bg-blue-50">
                <Rocket className="w-4 h-4 mr-2" />
                Get Started
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <BookOpen className="w-4 h-4 mr-2" />
                View Docs
              </Button>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="w-48 h-32 bg-white/10 rounded-lg flex items-center justify-center">
              <Code className="w-16 h-16 text-white/60" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">API Calls</p>
              <p className="text-2xl font-bold">2.5M</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12% from last month
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Extensions</p>
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +2 this week
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Puzzle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Revenue Share</p>
              <p className="text-2xl font-bold">$4,250</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +18% from last month
              </p>
            </div>
            <div className="h-12 w-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Installs</p>
              <p className="text-2xl font-bold">1,284</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +24% from last month
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Key className="w-4 h-4 mr-2" />
              Generate New API Key
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Puzzle className="w-4 h-4 mr-2" />
              Create Extension
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <BookOpen className="w-4 h-4 mr-2" />
              Browse Documentation
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <ExternalLink className="w-4 h-4 mr-2" />
              Test API Endpoints
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">API key "prod-key-2024" created</p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Extension "Smart Recommendations" updated</p>
                <p className="text-xs text-muted-foreground">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">New webhook endpoint configured</p>
                <p className="text-xs text-muted-foreground">3 days ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Rate limit increased to 10,000/hour</p>
                <p className="text-xs text-muted-foreground">1 week ago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Featured Resources */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Featured Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold">Quick Start Guide</h4>
                <Badge variant="secondary" className="text-xs">New</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Get up and running with Mercury APIs in under 5 minutes
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Start Tutorial
            </Button>
          </div>

          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold">API Reference</h4>
                <Badge variant="outline" className="text-xs">Updated</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Complete API documentation with interactive examples
            </p>
            <Button variant="outline" size="sm" className="w-full">
              View Docs
            </Button>
          </div>

          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Puzzle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold">Extension Gallery</h4>
                <Badge variant="secondary" className="text-xs">Popular</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Browse community extensions and templates
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Explore
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}