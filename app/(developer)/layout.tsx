import { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Code, 
  Key, 
  Puzzle, 
  BarChart3, 
  BookOpen, 
  Users, 
  Rocket,
  Settings,
  HelpCircle,
  ExternalLink
} from 'lucide-react'

interface DeveloperLayoutProps {
  children: ReactNode
}

export default function DeveloperLayout({ children }: DeveloperLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Mercury Developer Portal</h1>
                  <p className="text-sm text-muted-foreground">Build the future of e-commerce</p>
                </div>
              </div>
              <Badge variant="secondary" className="ml-4">
                API v2.0
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <HelpCircle className="w-4 h-4 mr-2" />
                Support
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Main App
              </Button>
              <Button size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Account
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <aside className="col-span-3">
            <Card className="p-6 sticky top-24">
              <nav className="space-y-6">
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    Dashboard
                  </h3>
                  <ul className="space-y-2">
                    <li>
                      <Link 
                        href="/developer/dashboard" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Overview</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/analytics" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Analytics</span>
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    Development
                  </h3>
                  <ul className="space-y-2">
                    <li>
                      <Link 
                        href="/developer/api-keys" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Key className="w-4 h-4" />
                        <span>API Keys</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/extensions" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Puzzle className="w-4 h-4" />
                        <span>Extensions</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/examples" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Code className="w-4 h-4" />
                        <span>Code Examples</span>
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    Resources
                  </h3>
                  <ul className="space-y-2">
                    <li>
                      <Link 
                        href="/developer/documentation" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Documentation</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/tutorials" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Rocket className="w-4 h-4" />
                        <span>Tutorials</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/onboarding" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span>Getting Started</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/developer/support" 
                        className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Support</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              </nav>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}