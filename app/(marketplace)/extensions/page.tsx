'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Star, Download, Heart, Eye, 
  TrendingUp, Users, Zap, Shield, Award, 
  Calendar, Tag, ArrowUpRight, ExternalLink,
  Grid3X3, List, SortAsc, SortDesc, Clock,
  CheckCircle, AlertCircle, Package, Puzzle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Extension {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  version: string;
  author: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  category: string;
  tags: string[];
  price: number;
  currency: string;
  rating: number;
  reviews: number;
  downloads: number;
  lastUpdated: string;
  featured: boolean;
  verified: boolean;
  screenshots: string[];
  permissions: string[];
  compatibility: string[];
  size: string;
  documentation: string;
  support: string;
  website: string;
  repository: string;
}

// Mock extension data
const mockExtensions: Extension[] = [
  {
    id: 'ext-1',
    name: 'Advanced Analytics Pro',
    description: 'Comprehensive analytics dashboard with AI-powered insights, custom reports, and real-time monitoring for your e-commerce store.',
    shortDescription: 'AI-powered analytics with custom reports and real-time monitoring',
    version: '2.1.0',
    author: {
      name: 'DataFlow Labs',
      avatar: '/avatars/dataflow.png',
      verified: true
    },
    category: 'Analytics',
    tags: ['analytics', 'ai', 'reports', 'dashboard'],
    price: 29.99,
    currency: 'USD',
    rating: 4.8,
    reviews: 342,
    downloads: 12500,
    lastUpdated: '2024-01-15',
    featured: true,
    verified: true,
    screenshots: ['/screenshots/analytics-1.png', '/screenshots/analytics-2.png'],
    permissions: ['read:analytics', 'read:orders', 'read:customers'],
    compatibility: ['Mercury v1.0+', 'Mercury v2.0+'],
    size: '2.4 MB',
    documentation: 'https://docs.dataflowlabs.com/analytics-pro',
    support: 'support@dataflowlabs.com',
    website: 'https://dataflowlabs.com',
    repository: 'https://github.com/dataflowlabs/analytics-pro'
  },
  {
    id: 'ext-2',
    name: 'Email Marketing Automation',
    description: 'Complete email marketing solution with automated campaigns, A/B testing, and advanced segmentation.',
    shortDescription: 'Automated email campaigns with A/B testing and segmentation',
    version: '1.8.2',
    author: {
      name: 'MailCraft',
      avatar: '/avatars/mailcraft.png',
      verified: true
    },
    category: 'Marketing',
    tags: ['email', 'automation', 'campaigns', 'ab-testing'],
    price: 19.99,
    currency: 'USD',
    rating: 4.6,
    reviews: 189,
    downloads: 8900,
    lastUpdated: '2024-01-12',
    featured: true,
    verified: true,
    screenshots: ['/screenshots/email-1.png', '/screenshots/email-2.png'],
    permissions: ['read:customers', 'write:emails', 'read:orders'],
    compatibility: ['Mercury v1.5+'],
    size: '1.8 MB',
    documentation: 'https://docs.mailcraft.io/automation',
    support: 'help@mailcraft.io',
    website: 'https://mailcraft.io',
    repository: 'https://github.com/mailcraft/automation'
  },
  {
    id: 'ext-3',
    name: 'Inventory Optimizer',
    description: 'AI-powered inventory management with demand forecasting, automatic reordering, and supplier integration.',
    shortDescription: 'AI inventory management with demand forecasting',
    version: '3.0.1',
    author: {
      name: 'StockSense',
      avatar: '/avatars/stocksense.png',
      verified: false
    },
    category: 'Inventory',
    tags: ['inventory', 'ai', 'forecasting', 'automation'],
    price: 0,
    currency: 'USD',
    rating: 4.4,
    reviews: 76,
    downloads: 3200,
    lastUpdated: '2024-01-10',
    featured: false,
    verified: false,
    screenshots: ['/screenshots/inventory-1.png'],
    permissions: ['read:products', 'write:inventory', 'read:suppliers'],
    compatibility: ['Mercury v2.0+'],
    size: '3.1 MB',
    documentation: 'https://stocksense.com/docs',
    support: 'support@stocksense.com',
    website: 'https://stocksense.com',
    repository: ''
  },
  {
    id: 'ext-4',
    name: 'Customer Support Chat',
    description: 'Integrated live chat system with AI-powered responses, ticket management, and customer satisfaction tracking.',
    shortDescription: 'Live chat with AI responses and ticket management',
    version: '1.5.3',
    author: {
      name: 'ChatFlow',
      avatar: '/avatars/chatflow.png',
      verified: true
    },
    category: 'Customer Service',
    tags: ['chat', 'support', 'ai', 'tickets'],
    price: 15.99,
    currency: 'USD',
    rating: 4.7,
    reviews: 234,
    downloads: 6700,
    lastUpdated: '2024-01-14',
    featured: false,
    verified: true,
    screenshots: ['/screenshots/chat-1.png', '/screenshots/chat-2.png'],
    permissions: ['read:customers', 'write:messages', 'read:orders'],
    compatibility: ['Mercury v1.0+', 'Mercury v2.0+'],
    size: '1.2 MB',
    documentation: 'https://chatflow.dev/docs',
    support: 'help@chatflow.dev',
    website: 'https://chatflow.dev',
    repository: 'https://github.com/chatflow/mercury-extension'
  },
  {
    id: 'ext-5',
    name: 'Social Media Sync',
    description: 'Automatically sync products to Facebook, Instagram, Google Shopping, and other platforms with inventory management.',
    shortDescription: 'Multi-platform product sync with inventory management',
    version: '2.3.0',
    author: {
      name: 'SocialCommerce Inc',
      avatar: '/avatars/socialcommerce.png',
      verified: true
    },
    category: 'Social Media',
    tags: ['social', 'sync', 'facebook', 'instagram', 'google'],
    price: 24.99,
    currency: 'USD',
    rating: 4.5,
    reviews: 156,
    downloads: 5400,
    lastUpdated: '2024-01-13',
    featured: false,
    verified: true,
    screenshots: ['/screenshots/social-1.png', '/screenshots/social-2.png', '/screenshots/social-3.png'],
    permissions: ['read:products', 'write:products', 'read:inventory'],
    compatibility: ['Mercury v1.8+', 'Mercury v2.0+'],
    size: '2.8 MB',
    documentation: 'https://socialcommerce.com/mercury-docs',
    support: 'support@socialcommerce.com',
    website: 'https://socialcommerce.com',
    repository: ''
  },
  {
    id: 'ext-6',
    name: 'SEO Optimizer',
    description: 'Complete SEO toolkit with automated meta tags, schema markup, sitemap generation, and performance monitoring.',
    shortDescription: 'Complete SEO toolkit with automation and monitoring',
    version: '1.9.4',
    author: {
      name: 'SEOCraft',
      avatar: '/avatars/seocraft.png',
      verified: false
    },
    category: 'SEO',
    tags: ['seo', 'meta-tags', 'schema', 'sitemap'],
    price: 0,
    currency: 'USD',
    rating: 4.3,
    reviews: 89,
    downloads: 2800,
    lastUpdated: '2024-01-09',
    featured: false,
    verified: false,
    screenshots: ['/screenshots/seo-1.png'],
    permissions: ['read:products', 'write:meta', 'read:pages'],
    compatibility: ['Mercury v1.5+'],
    size: '1.5 MB',
    documentation: 'https://seocraft.tools/docs',
    support: 'help@seocraft.tools',
    website: 'https://seocraft.tools',
    repository: 'https://github.com/seocraft/mercury-seo'
  }
];

const categories = ['All', 'Analytics', 'Marketing', 'Inventory', 'Customer Service', 'Social Media', 'SEO', 'Payments', 'Shipping'];
const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' }
];

export default function ExtensionsMarketplacePage() {
  const [extensions, setExtensions] = useState<Extension[]>(mockExtensions);
  const [filteredExtensions, setFilteredExtensions] = useState<Extension[]>(mockExtensions);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  // Filter and sort extensions
  useEffect(() => {
    let filtered = extensions;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(ext =>
        ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(ext => ext.category === selectedCategory);
    }

    // Price filter
    if (showFreeOnly) {
      filtered = filtered.filter(ext => ext.price === 0);
    }

    // Verified filter
    if (showVerifiedOnly) {
      filtered = filtered.filter(ext => ext.verified);
    }

    // Sort
    switch (sortBy) {
      case 'featured':
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
      case 'popular':
        filtered.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        break;
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
    }

    setFilteredExtensions(filtered);
  }, [extensions, searchQuery, selectedCategory, sortBy, showFreeOnly, showVerifiedOnly]);

  const handleInstallExtension = (extensionId: string) => {
    console.log('Installing extension:', extensionId);
    // In production, this would trigger the installation process
  };

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}k`;
    }
    return downloads.toString();
  };

  const ExtensionCard = ({ extension }: { extension: Extension }) => (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200 group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                {extension.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="w-4 h-4">
                  <AvatarFallback className="text-xs">
                    {extension.author.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{extension.author.name}</span>
                {extension.author.verified && (
                  <CheckCircle className="w-3 h-3 text-blue-500" />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {extension.featured && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Award className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
            {extension.verified && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="line-clamp-2 mb-3">
          {extension.shortDescription}
        </CardDescription>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{extension.rating}</span>
            <span className="text-sm text-muted-foreground">({extension.reviews})</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Download className="w-4 h-4" />
            {formatDownloads(extension.downloads)}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {extension.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-green-600">
            {formatPrice(extension.price, extension.currency)}
          </div>
          <Button size="sm" onClick={() => handleInstallExtension(extension.id)}>
            Install
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ExtensionListItem = ({ extension }: { extension: Extension }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-8 h-8 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold hover:text-blue-600 transition-colors cursor-pointer">
                  {extension.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="w-4 h-4">
                    <AvatarFallback className="text-xs">
                      {extension.author.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{extension.author.name}</span>
                  {extension.author.verified && (
                    <CheckCircle className="w-3 h-3 text-blue-500" />
                  )}
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">v{extension.version}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {extension.featured && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <Award className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}
                {extension.verified && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            
            <p className="text-muted-foreground mb-3 line-clamp-2">
              {extension.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{extension.rating}</span>
                  <span className="text-sm text-muted-foreground">({extension.reviews})</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Download className="w-4 h-4" />
                  {formatDownloads(extension.downloads)} installs
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Updated {new Date(extension.lastUpdated).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-green-600">
                  {formatPrice(extension.price, extension.currency)}
                </div>
                <Button onClick={() => handleInstallExtension(extension.id)}>
                  Install
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold tracking-tight">Extension Marketplace</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover powerful extensions to enhance your Mercury store with advanced features and integrations
          </p>
        </motion.div>

        {/* Featured Extensions Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Featured Extensions</h2>
              <p className="text-blue-100">
                Hand-picked extensions by our team to supercharge your e-commerce store
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{extensions.filter(e => e.featured).length}</div>
                <div className="text-sm text-blue-100">Featured</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{extensions.filter(e => e.verified).length}</div>
                <div className="text-sm text-blue-100">Verified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{extensions.filter(e => e.price === 0).length}</div>
                <div className="text-sm text-blue-100">Free</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="free-only"
                checked={showFreeOnly}
                onCheckedChange={setShowFreeOnly}
              />
              <Label htmlFor="free-only">Free only</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="verified-only"
                checked={showVerifiedOnly}
                onCheckedChange={setShowVerifiedOnly}
              />
              <Label htmlFor="verified-only">Verified only</Label>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredExtensions.length} of {extensions.length} extensions
            </div>
          </div>
        </motion.div>

        {/* Extensions Grid/List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExtensions.map((extension) => (
                <motion.div
                  key={extension.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <ExtensionCard extension={extension} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div>
              {filteredExtensions.map((extension) => (
                <motion.div
                  key={extension.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ExtensionListItem extension={extension} />
                </motion.div>
              ))}
            </div>
          )}

          {filteredExtensions.length === 0 && (
            <div className="text-center py-12">
              <Puzzle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No extensions found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or browse different categories
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}