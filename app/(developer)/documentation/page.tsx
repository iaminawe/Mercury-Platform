'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BookOpen, 
  Search, 
  Code, 
  Zap, 
  Shield,
  Database,
  Webhook,
  Puzzle,
  PlayCircle,
  ExternalLink,
  Copy,
  Download,
  Star,
  ChevronRight,
  GitBranch
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface DocSection {
  id: string
  title: string
  description: string
  icon: any
  sections: {
    id: string
    title: string
    description: string
    path: string
  }[]
}

export default function DocumentationPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedExample, setSelectedExample] = useState('')

  const docSections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Quick start guides and basic concepts',
      icon: Zap,
      sections: [
        { id: 'quickstart', title: 'Quick Start', description: 'Get up and running in 5 minutes', path: '/docs/quickstart' },
        { id: 'authentication', title: 'Authentication', description: 'API key setup and authentication', path: '/docs/auth' },
        { id: 'first-request', title: 'Your First Request', description: 'Making your first API call', path: '/docs/first-request' },
        { id: 'sdks', title: 'SDKs & Libraries', description: 'Official SDKs and client libraries', path: '/docs/sdks' }
      ]
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      description: 'Complete API documentation with examples',
      icon: Code,
      sections: [
        { id: 'products', title: 'Products API', description: 'Manage products and inventory', path: '/docs/api/products' },
        { id: 'orders', title: 'Orders API', description: 'Handle orders and transactions', path: '/docs/api/orders' },
        { id: 'customers', title: 'Customers API', description: 'Customer management and profiles', path: '/docs/api/customers' },
        { id: 'analytics', title: 'Analytics API', description: 'Access insights and metrics', path: '/docs/api/analytics' },
        { id: 'ai', title: 'AI Services API', description: 'Machine learning and recommendations', path: '/docs/api/ai' }
      ]
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      description: 'Real-time event notifications',
      icon: Webhook,
      sections: [
        { id: 'webhook-setup', title: 'Webhook Setup', description: 'Configure webhook endpoints', path: '/docs/webhooks/setup' },
        { id: 'webhook-events', title: 'Event Types', description: 'Available webhook events', path: '/docs/webhooks/events' },
        { id: 'webhook-security', title: 'Security', description: 'Verify webhook authenticity', path: '/docs/webhooks/security' },
        { id: 'webhook-examples', title: 'Examples', description: 'Real-world webhook implementations', path: '/docs/webhooks/examples' }
      ]
    },
    {
      id: 'extensions',
      title: 'Extensions',
      description: 'Build and publish extensions',
      icon: Puzzle,
      sections: [
        { id: 'extension-overview', title: 'Extension Overview', description: 'Understanding the extension system', path: '/docs/extensions/overview' },
        { id: 'extension-development', title: 'Development Guide', description: 'Building your first extension', path: '/docs/extensions/development' },
        { id: 'extension-api', title: 'Extension API', description: 'Available APIs for extensions', path: '/docs/extensions/api' },
        { id: 'extension-publishing', title: 'Publishing', description: 'Submit and manage extensions', path: '/docs/extensions/publishing' }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Security best practices and guidelines',
      icon: Shield,
      sections: [
        { id: 'security-overview', title: 'Security Overview', description: 'Security principles and practices', path: '/docs/security/overview' },
        { id: 'api-security', title: 'API Security', description: 'Secure API usage guidelines', path: '/docs/security/api' },
        { id: 'data-protection', title: 'Data Protection', description: 'GDPR and privacy compliance', path: '/docs/security/data-protection' },
        { id: 'vulnerability-reporting', title: 'Vulnerability Reporting', description: 'Report security issues', path: '/docs/security/reporting' }
      ]
    }
  ]

  const codeExamples = [
    {
      id: 'auth-example',
      title: 'Authentication',
      language: 'javascript',
      code: `// Initialize Mercury SDK
import { Mercury } from '@mercury/sdk'

const mercury = new Mercury({
  apiKey: 'your-api-key',
  environment: 'production' // or 'sandbox'
})

// Verify API key
try {
  const auth = await mercury.auth.verify()
  console.log('Authentication successful:', auth)
} catch (error) {
  console.error('Authentication failed:', error)
}`
    },
    {
      id: 'products-example',
      title: 'Fetch Products',
      language: 'javascript',
      code: `// Get all products
const products = await mercury.products.list({
  limit: 50,
  status: 'active'
})

// Get specific product
const product = await mercury.products.get('product-id')

// Create new product
const newProduct = await mercury.products.create({
  title: 'Amazing Product',
  price: 29.99,
  description: 'This product is amazing!',
  inventory: 100
})`
    },
    {
      id: 'ai-recommendations',
      title: 'AI Recommendations',
      language: 'javascript',
      code: `// Get personalized recommendations
const recommendations = await mercury.ai.recommendations.get({
  customerId: 'customer-123',
  productId: 'product-456',
  context: 'product_page',
  limit: 4
})

// Track recommendation events
await mercury.ai.recommendations.track({
  customerId: 'customer-123',
  recommendationId: recommendations.id,
  event: 'view'
})`
    },
    {
      id: 'webhook-example',
      title: 'Webhook Handler',
      language: 'javascript',
      code: `// Express.js webhook handler
app.post('/webhooks/mercury', (req, res) => {
  const signature = req.headers['x-mercury-signature']
  const payload = req.body
  
  // Verify webhook signature
  const isValid = mercury.webhooks.verify(payload, signature)
  
  if (!isValid) {
    return res.status(401).send('Invalid signature')
  }
  
  // Handle different event types
  switch (payload.event) {
    case 'order.created':
      handleOrderCreated(payload.data)
      break
    case 'product.updated':
      handleProductUpdated(payload.data)
      break
  }
  
  res.status(200).send('OK')
})`
    }
  ]

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Code example has been copied to your clipboard."
    })
  }

  const filteredSections = docSections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.sections.some(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Documentation</h2>
          <p className="text-muted-foreground">
            Complete guides and API reference for Mercury developers
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline">
            <GitBranch className="w-4 h-4 mr-2" />
            v2.0.0
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search documentation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Docs</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
          <TabsTrigger value="interactive">Interactive Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredSections.map((section) => (
              <Card key={section.id} className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <div className="space-y-2">
                      {section.sections.map((subsection) => (
                        <div
                          key={subsection.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="font-medium text-sm">{subsection.title}</p>
                            <p className="text-xs text-muted-foreground">{subsection.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {codeExamples.map((example) => (
              <Card key={example.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Code className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">{example.title}</h3>
                    <Badge variant="outline">{example.language}</Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(example.code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <PlayCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100">
                    <code>{example.code}</code>
                  </pre>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="interactive" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <PlayCircle className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Interactive API Playground</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">API Endpoint</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option value="/api/products">GET /api/products</option>
                    <option value="/api/orders">GET /api/orders</option>
                    <option value="/api/customers">GET /api/customers</option>
                    <option value="/api/ai/recommendations">POST /api/ai/recommendations</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Headers</label>
                  <textarea 
                    className="w-full mt-1 p-2 border rounded-md h-24 font-mono text-sm"
                    placeholder={`{
  "Authorization": "Bearer your-api-key",
  "Content-Type": "application/json"
}`}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Request Body</label>
                  <textarea 
                    className="w-full mt-1 p-2 border rounded-md h-32 font-mono text-sm"
                    placeholder={`{
  "limit": 10,
  "status": "active"
}`}
                  />
                </div>
                
                <Button className="w-full">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Send Request
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Response</label>
                  <div className="mt-1 bg-gray-900 rounded-lg p-4 h-80 overflow-auto">
                    <pre className="text-sm text-gray-100">
                      <code>{`{
  "status": "success",
  "data": [
    {
      "id": "prod_1234567890",
      "title": "Amazing Product",
      "price": 29.99,
      "description": "This product is amazing!",
      "inventory": 100,
      "status": "active",
      "created_at": "2024-01-19T10:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "per_page": 10
  }
}`}</code>
                    </pre>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>200 OK</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">124ms</span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold">Quick Start Guide</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Get up and running with Mercury APIs in under 5 minutes
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Getting Started</Badge>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-2">
              <Database className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold">API Reference</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Complete API documentation with interactive examples
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Reference</Badge>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-3 mb-2">
              <Puzzle className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold">Extension Development</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Learn how to build and publish Mercury extensions
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Extensions</Badge>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}