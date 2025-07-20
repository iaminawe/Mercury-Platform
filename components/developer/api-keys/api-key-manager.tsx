'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Settings, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Clock,
  MoreHorizontal
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  status: 'active' | 'revoked' | 'expired'
  createdAt: string
  lastUsed: string
  expiresAt?: string
  rateLimit: number
}

export function ApiKeyManager() {
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production API Key',
      key: 'mk_live_1234567890abcdef',
      permissions: ['read:products', 'write:orders', 'read:analytics'],
      status: 'active',
      createdAt: '2024-01-15',
      lastUsed: '2024-01-19',
      rateLimit: 10000
    },
    {
      id: '2',
      name: 'Development Key',
      key: 'mk_test_abcdef1234567890',
      permissions: ['read:products', 'read:analytics'],
      status: 'active',
      createdAt: '2024-01-10',
      lastUsed: '2024-01-18',
      expiresAt: '2024-06-10',
      rateLimit: 1000
    }
  ])

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: [] as string[],
    expiresAt: '',
    rateLimit: 1000
  })

  const availablePermissions = [
    { id: 'read:products', label: 'Read Products', description: 'Access product data' },
    { id: 'write:products', label: 'Write Products', description: 'Create and update products' },
    { id: 'read:orders', label: 'Read Orders', description: 'Access order data' },
    { id: 'write:orders', label: 'Write Orders', description: 'Create and update orders' },
    { id: 'read:customers', label: 'Read Customers', description: 'Access customer data' },
    { id: 'write:customers', label: 'Write Customers', description: 'Create and update customers' },
    { id: 'read:analytics', label: 'Read Analytics', description: 'Access analytics data' },
    { id: 'read:ai', label: 'AI Services', description: 'Access AI recommendations and insights' },
    { id: 'write:webhooks', label: 'Webhooks', description: 'Manage webhook endpoints' }
  ]

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "API key has been copied to your clipboard."
    })
  }

  const generateApiKey = () => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyData.name,
      key: `mk_live_${Math.random().toString(36).substring(2)}`,
      permissions: newKeyData.permissions,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      expiresAt: newKeyData.expiresAt || undefined,
      rateLimit: newKeyData.rateLimit
    }

    setApiKeys(prev => [...prev, newKey])
    setNewKeyData({ name: '', permissions: [], expiresAt: '', rateLimit: 1000 })
    
    toast({
      title: "API key created",
      description: "Your new API key has been generated successfully."
    })
  }

  const revokeKey = (keyId: string) => {
    setApiKeys(prev => prev.map(key => 
      key.id === keyId ? { ...key, status: 'revoked' as const } : key
    ))
    
    toast({
      title: "API key revoked",
      description: "The API key has been revoked and is no longer valid."
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'revoked':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'expired':
        return <Clock className="w-4 h-4 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>
      case 'expired':
        return <Badge className="bg-orange-100 text-orange-800">Expired</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your API keys and permissions
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Generate New Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate New API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Production API Key"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-3">
                  {availablePermissions.map((permission) => (
                    <div key={permission.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={permission.id}
                        checked={newKeyData.permissions.includes(permission.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewKeyData(prev => ({
                              ...prev,
                              permissions: [...prev.permissions, permission.id]
                            }))
                          } else {
                            setNewKeyData(prev => ({
                              ...prev,
                              permissions: prev.permissions.filter(p => p !== permission.id)
                            }))
                          }
                        }}
                      />
                      <div className="space-y-1">
                        <Label htmlFor={permission.id} className="text-sm font-medium">
                          {permission.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={newKeyData.expiresAt}
                    onChange={(e) => setNewKeyData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate Limit (requests/hour)</Label>
                  <Select
                    value={newKeyData.rateLimit.toString()}
                    onValueChange={(value) => setNewKeyData(prev => ({ ...prev, rateLimit: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 requests/hour</SelectItem>
                      <SelectItem value="1000">1,000 requests/hour</SelectItem>
                      <SelectItem value="10000">10,000 requests/hour</SelectItem>
                      <SelectItem value="100000">100,000 requests/hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={generateApiKey} 
                className="w-full"
                disabled={!newKeyData.name || newKeyData.permissions.length === 0}
              >
                Generate API Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">{apiKey.name}</h3>
                  {getStatusIcon(apiKey.status)}
                  {getStatusBadge(apiKey.status)}
                </div>

                <div className="flex items-center space-x-4 font-mono text-sm">
                  <span className="text-muted-foreground">
                    {showKeys[apiKey.id] ? apiKey.key : '•'.repeat(apiKey.key.length)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                  >
                    {showKeys[apiKey.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(apiKey.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{apiKey.createdAt}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="font-medium">{apiKey.lastUsed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rate Limit</p>
                    <p className="font-medium">{apiKey.rateLimit.toLocaleString()}/hour</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Permissions</p>
                    <p className="font-medium">{apiKey.permissions.length} scopes</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {apiKey.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>

                {apiKey.expiresAt && (
                  <div className="flex items-center space-x-2 text-sm text-orange-600">
                    <Clock className="w-4 h-4" />
                    <span>Expires on {apiKey.expiresAt}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => revokeKey(apiKey.id)}
                  disabled={apiKey.status === 'revoked'}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Usage Guidelines */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">API Key Security Best Practices</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Never expose API keys in client-side code or version control</li>
              <li>• Use environment variables to store keys securely</li>
              <li>• Regularly rotate your API keys</li>
              <li>• Use the minimum required permissions for each key</li>
              <li>• Monitor API key usage and set up alerts for unusual activity</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}