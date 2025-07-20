'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Search, 
  Filter, 
  BarChart3, 
  Clock, 
  Zap,
  FileText, 
  Package, 
  MessageCircle, 
  HelpCircle,
  Star,
  ArrowUpDown,
  Settings,
  Eye,
  Copy,
  ExternalLink
} from 'lucide-react';

type ContentType = 
  | 'product' 
  | 'customer' 
  | 'order' 
  | 'content' 
  | 'faq' 
  | 'knowledge_base' 
  | 'review' 
  | 'marketing' 
  | 'support_ticket' 
  | 'conversation';

interface SearchResult {
  id: string;
  content: string;
  title?: string;
  contentType: ContentType;
  metadata: Record<string, any>;
  similarity: number;
  textSimilarity?: number;
  combinedScore?: number;
  chunkInfo?: {
    chunkIndex: number;
    chunkCount: number;
    parentId?: string;
  };
  clusterInfo?: {
    clusterId: string;
    clusterName: string;
  };
}

interface SearchOptions {
  contentTypes?: ContentType[];
  k?: number;
  threshold?: number;
  useHybridSearch?: boolean;
  hybridWeights?: {
    vector: number;
    text: number;
  };
  useClusterSearch?: boolean;
  filters?: Record<string, any>;
  boosts?: {
    recentDocuments?: number;
    highRatedContent?: number;
  };
}

interface SearchAnalytics {
  queryTime: number;
  totalResults: number;
  resultsByType: Record<string, number>;
  averageSimilarity: number;
  searchMethod: 'vector' | 'hybrid' | 'cluster';
  clustersSearched?: number;
  cacheHit?: boolean;
}

export function SearchInterface() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    k: 10,
    threshold: 0.7,
    useHybridSearch: true,
    hybridWeights: { vector: 0.7, text: 0.3 },
    useClusterSearch: false,
    boosts: {
      recentDocuments: 1.1,
      highRatedContent: 1.2,
    },
  });

  const [recentQueries, setRecentQueries] = useState<string[]>([
    'wireless headphones',
    'return policy',
    'shipping information',
    'product reviews',
  ]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    
    try {
      // Add to recent queries if not already there
      if (!recentQueries.includes(query)) {
        setRecentQueries(prev => [query, ...prev.slice(0, 9)]);
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock search results
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Wireless Bluetooth Headphones - Premium Sound',
          content: 'Experience premium sound quality with our wireless Bluetooth headphones. Features noise cancellation, 30-hour battery life, and comfortable over-ear design. Perfect for music lovers and professionals.',
          contentType: 'product',
          metadata: {
            category: 'Electronics',
            price: 199.99,
            vendor: 'AudioTech',
            tags: ['wireless', 'bluetooth', 'headphones', 'noise-cancellation'],
            rating: 4.5,
            created_at: '2024-01-15T10:00:00Z',
          },
          similarity: 0.92,
          textSimilarity: 0.85,
          combinedScore: 0.89,
          chunkInfo: {
            chunkIndex: 0,
            chunkCount: 1,
          },
        },
        {
          id: '2',
          title: 'How to Connect Wireless Headphones',
          content: 'Step-by-step guide to connect your wireless headphones to various devices. Includes troubleshooting tips for common connection issues and pairing instructions for different operating systems.',
          contentType: 'knowledge_base',
          metadata: {
            category: 'Setup Guides',
            difficulty: 1,
            helpful_votes: 45,
            author: 'Support Team',
            created_at: '2024-01-10T14:30:00Z',
          },
          similarity: 0.87,
          textSimilarity: 0.82,
          combinedScore: 0.85,
          chunkInfo: {
            chunkIndex: 0,
            chunkCount: 3,
          },
        },
        {
          id: '3',
          title: 'Customer Review: Amazing Sound Quality!',
          content: 'I love these wireless headphones! The sound quality is incredible and the battery lasts all day. The noise cancellation works perfectly in noisy environments. Highly recommended!',
          contentType: 'review',
          metadata: {
            rating: 5,
            verified_purchase: true,
            sentiment: 'positive',
            product_id: 'headphones-001',
            created_at: '2024-01-20T09:15:00Z',
          },
          similarity: 0.84,
          textSimilarity: 0.79,
          combinedScore: 0.82,
          clusterInfo: {
            clusterId: 'cluster-reviews-positive',
            clusterName: 'Positive Product Reviews',
          },
        },
        {
          id: '4',
          title: 'Wireless Headphones FAQ',
          content: 'Frequently asked questions about wireless headphones including battery life, compatibility, warranty information, and troubleshooting common issues.',
          contentType: 'faq',
          metadata: {
            category: 'Product Support',
            view_count: 156,
            last_updated: '2024-01-18T16:45:00Z',
          },
          similarity: 0.81,
          textSimilarity: 0.88,
          combinedScore: 0.83,
        },
      ];

      // Filter results based on search options
      let filteredResults = mockResults;
      
      if (searchOptions.contentTypes?.length) {
        filteredResults = filteredResults.filter(r => 
          searchOptions.contentTypes!.includes(r.contentType)
        );
      }

      if (searchOptions.threshold) {
        filteredResults = filteredResults.filter(r => 
          (r.combinedScore || r.similarity) >= searchOptions.threshold!
        );
      }

      // Limit results
      filteredResults = filteredResults.slice(0, searchOptions.k || 10);

      setResults(filteredResults);

      // Mock analytics
      const mockAnalytics: SearchAnalytics = {
        queryTime: Math.floor(Math.random() * 300) + 150,
        totalResults: filteredResults.length,
        resultsByType: filteredResults.reduce((acc, result) => {
          acc[result.contentType] = (acc[result.contentType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        averageSimilarity: filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length,
        searchMethod: searchOptions.useHybridSearch ? 'hybrid' : 'vector',
        clustersSearched: searchOptions.useClusterSearch ? 3 : undefined,
        cacheHit: Math.random() > 0.7,
      };

      setAnalytics(mockAnalytics);

    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const copyResultContent = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'product': return <Package className="h-4 w-4" />;
      case 'knowledge_base': return <FileText className="h-4 w-4" />;
      case 'faq': return <HelpCircle className="h-4 w-4" />;
      case 'review': return <Star className="h-4 w-4" />;
      case 'customer': return <MessageCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getContentTypeColor = (type: ContentType) => {
    switch (type) {
      case 'product': return 'bg-blue-100 text-blue-800';
      case 'knowledge_base': return 'bg-green-100 text-green-800';
      case 'faq': return 'bg-yellow-100 text-yellow-800';
      case 'review': return 'bg-purple-100 text-purple-800';
      case 'customer': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const highlightQuery = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle>Vector Search</CardTitle>
          <CardDescription>
            Search through your indexed documents using AI-powered semantic search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search for products, documentation, reviews..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={performSearch} 
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Recent Queries */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Recent:</span>
            {recentQueries.slice(0, 4).map((recentQuery, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(recentQuery);
                  inputRef.current?.focus();
                }}
                className="text-xs"
              >
                {recentQuery}
              </Button>
            ))}
          </div>

          {/* Search Filters */}
          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Content Types */}
                  <div>
                    <Label>Content Types</Label>
                    <Select
                      value={searchOptions.contentTypes?.[0] || 'all'}
                      onValueChange={(value) => 
                        setSearchOptions(prev => ({
                          ...prev,
                          contentTypes: value === 'all' ? undefined : [value as ContentType]
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="product">Products</SelectItem>
                        <SelectItem value="knowledge_base">Knowledge Base</SelectItem>
                        <SelectItem value="faq">FAQ</SelectItem>
                        <SelectItem value="review">Reviews</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Max Results */}
                  <div>
                    <Label>Max Results: {searchOptions.k}</Label>
                    <Slider
                      value={[searchOptions.k || 10]}
                      onValueChange={([value]) => 
                        setSearchOptions(prev => ({ ...prev, k: value }))
                      }
                      max={50}
                      min={5}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  {/* Similarity Threshold */}
                  <div>
                    <Label>Similarity Threshold: {searchOptions.threshold?.toFixed(2)}</Label>
                    <Slider
                      value={[searchOptions.threshold || 0.7]}
                      onValueChange={([value]) => 
                        setSearchOptions(prev => ({ ...prev, threshold: value }))
                      }
                      max={1}
                      min={0.3}
                      step={0.05}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search Method */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="hybridSearch"
                      checked={searchOptions.useHybridSearch}
                      onCheckedChange={(checked) => 
                        setSearchOptions(prev => ({ ...prev, useHybridSearch: checked }))
                      }
                    />
                    <Label htmlFor="hybridSearch">Hybrid Search (Vector + Text)</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="clusterSearch"
                      checked={searchOptions.useClusterSearch}
                      onCheckedChange={(checked) => 
                        setSearchOptions(prev => ({ ...prev, useClusterSearch: checked }))
                      }
                    />
                    <Label htmlFor="clusterSearch">Cluster-based Search</Label>
                  </div>
                </div>

                {/* Hybrid Weights */}
                {searchOptions.useHybridSearch && (
                  <div className="space-y-2">
                    <Label>Hybrid Search Weights</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Vector: {searchOptions.hybridWeights?.vector.toFixed(2)}</Label>
                        <Slider
                          value={[searchOptions.hybridWeights?.vector || 0.7]}
                          onValueChange={([value]) => 
                            setSearchOptions(prev => ({
                              ...prev,
                              hybridWeights: { 
                                vector: value, 
                                text: 1 - value 
                              }
                            }))
                          }
                          max={1}
                          min={0}
                          step={0.1}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Text: {searchOptions.hybridWeights?.text.toFixed(2)}</Label>
                        <Slider
                          value={[searchOptions.hybridWeights?.text || 0.3]}
                          onValueChange={([value]) => 
                            setSearchOptions(prev => ({
                              ...prev,
                              hybridWeights: { 
                                vector: 1 - value, 
                                text: value 
                              }
                            }))
                          }
                          max={1}
                          min={0}
                          step={0.1}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Search Analytics */}
      {analytics && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{analytics.totalResults}</div>
                <div className="text-sm text-muted-foreground">Results</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics.queryTime}ms</div>
                <div className="text-sm text-muted-foreground">Query Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{(analytics.averageSimilarity * 100).toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Avg Similarity</div>
              </div>
              <div>
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  {analytics.searchMethod === 'hybrid' && <Zap className="h-4 w-4" />}
                  {analytics.searchMethod === 'cluster' && <BarChart3 className="h-4 w-4" />}
                  {analytics.searchMethod}
                </div>
                <div className="text-sm text-muted-foreground">Method</div>
              </div>
            </div>

            {analytics.cacheHit && (
              <Alert className="mt-4">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Results served from cache for faster response
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Search Results</h3>
            <div className="flex gap-2">
              <Select defaultValue="similarity">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="similarity">By Similarity</SelectItem>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="relevance">By Relevance</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {results.map((result, index) => (
            <Card key={result.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Result Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge className={getContentTypeColor(result.contentType)}>
                        <div className="flex items-center space-x-1">
                          {getContentTypeIcon(result.contentType)}
                          <span>{result.contentType.replace('_', ' ')}</span>
                        </div>
                      </Badge>
                      {result.chunkInfo && result.chunkInfo.chunkCount > 1 && (
                        <Badge variant="outline">
                          Chunk {result.chunkInfo.chunkIndex + 1}/{result.chunkInfo.chunkCount}
                        </Badge>
                      )}
                      {result.clusterInfo && (
                        <Badge variant="outline">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {result.clusterInfo.clusterName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-muted-foreground">
                        {(result.combinedScore || result.similarity * 100).toFixed(1)}% match
                      </div>
                      <Button variant="outline" size="sm" onClick={() => copyResultContent(result.content)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedResult(result)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Result Title */}
                  {result.title && (
                    <h4 
                      className="text-lg font-medium"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightQuery(result.title, query) 
                      }}
                    />
                  )}

                  {/* Result Content */}
                  <p 
                    className="text-sm text-muted-foreground line-clamp-3"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightQuery(result.content.substring(0, 300) + '...', query) 
                    }}
                  />

                  {/* Result Metadata */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {result.metadata.rating && (
                      <span className="flex items-center">
                        <Star className="h-3 w-3 mr-1 fill-current text-yellow-500" />
                        {result.metadata.rating}
                      </span>
                    )}
                    {result.metadata.price && (
                      <span>${result.metadata.price}</span>
                    )}
                    {result.metadata.category && (
                      <span>{result.metadata.category}</span>
                    )}
                    {result.metadata.created_at && (
                      <span>{new Date(result.metadata.created_at).toLocaleDateString()}</span>
                    )}
                    {result.textSimilarity && (
                      <span>Text: {(result.textSimilarity * 100).toFixed(1)}%</span>
                    )}
                  </div>

                  {/* Similarity Breakdown */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Similarity Score</span>
                      <span>{(result.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={result.similarity * 100} className="h-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search query or filters
            </p>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Settings className="h-4 w-4 mr-2" />
              Adjust Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedResult.title || 'Document Content'}</CardTitle>
                  <CardDescription>
                    {selectedResult.contentType} • {(selectedResult.similarity * 100).toFixed(1)}% similarity
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedResult(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: highlightQuery(selectedResult.content, query) 
                }}
              />
              
              {/* Metadata */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Metadata</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(selectedResult.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span>{' '}
                      <span className="text-muted-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => copyResultContent(selectedResult.content)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Content
                </Button>
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Original
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}