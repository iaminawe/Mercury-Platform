'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Search, 
  FileText, 
  BarChart3, 
  Settings, 
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { DocumentUploader } from '@/components/knowledge/document-uploader';
import { SearchInterface } from '@/components/knowledge/search-interface';
import { VectorAnalytics } from '@/components/knowledge/vector-analytics';

interface VectorStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  totalEmbeddings: number;
  totalClusters: number;
  storageSize: number;
  lastUpdated: Date;
  searchPerformance: {
    averageQueryTime: number;
    cacheHitRate: number;
    totalSearches: number;
  };
}

interface MaintenanceStatus {
  reindexing: {
    inProgress: boolean;
    progress?: number;
    startedAt?: Date;
  };
  clustering: {
    inProgress: boolean;
    progress?: number;
    lastRun?: Date;
  };
  cleanup: {
    orphanedEmbeddings?: number;
    lastCleanup?: Date;
  };
}

interface RecentActivity {
  id: string;
  type: 'indexed' | 'searched' | 'clustered' | 'deleted';
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

export default function KnowledgePage() {
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Load initial data
  useEffect(() => {
    loadVectorStats();
    loadMaintenanceStatus();
    loadRecentActivity();
  }, []);

  const loadVectorStats = async () => {
    try {
      // In a real implementation, this would call your API
      const mockStats: VectorStats = {
        totalDocuments: 1247,
        documentsByType: {
          product: 823,
          knowledge_base: 156,
          review: 189,
          faq: 79,
        },
        totalEmbeddings: 1247,
        totalClusters: 24,
        storageSize: 52428800, // 50MB
        lastUpdated: new Date(),
        searchPerformance: {
          averageQueryTime: 187,
          cacheHitRate: 0.73,
          totalSearches: 8932,
        },
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load vector stats:', error);
    }
  };

  const loadMaintenanceStatus = async () => {
    try {
      const mockMaintenance: MaintenanceStatus = {
        reindexing: {
          inProgress: false,
          progress: 0,
        },
        clustering: {
          inProgress: false,
          lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        cleanup: {
          orphanedEmbeddings: 0,
          lastCleanup: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      };
      setMaintenance(mockMaintenance);
    } catch (error) {
      console.error('Failed to load maintenance status:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'indexed',
          description: 'Indexed 23 new product descriptions',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: 'success',
          metadata: { documentCount: 23, contentType: 'product' },
        },
        {
          id: '2',
          type: 'searched',
          description: 'Product search: "wireless headphones"',
          timestamp: new Date(Date.now() - 32 * 60 * 1000),
          status: 'success',
          metadata: { query: 'wireless headphones', results: 12 },
        },
        {
          id: '3',
          type: 'clustered',
          description: 'Rebalanced clusters for review content',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: 'success',
          metadata: { clustersCreated: 3, documentsMoved: 45 },
        },
        {
          id: '4',
          type: 'indexed',
          description: 'Failed to index FAQ document',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          status: 'error',
          metadata: { error: 'Embedding generation failed' },
        },
      ];
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    try {
      setMaintenance(prev => prev ? {
        ...prev,
        reindexing: { inProgress: true, progress: 0, startedAt: new Date() }
      } : null);

      // Simulate reindexing progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setMaintenance(prev => prev ? {
          ...prev,
          reindexing: { ...prev.reindexing, progress: i }
        } : null);
      }

      setMaintenance(prev => prev ? {
        ...prev,
        reindexing: { inProgress: false, progress: 100 }
      } : null);

      // Refresh stats
      await loadVectorStats();
    } catch (error) {
      console.error('Reindexing failed:', error);
    }
  };

  const handleClusterRebalance = async () => {
    try {
      setMaintenance(prev => prev ? {
        ...prev,
        clustering: { inProgress: true, progress: 0 }
      } : null);

      // Simulate clustering
      await new Promise(resolve => setTimeout(resolve, 3000));

      setMaintenance(prev => prev ? {
        ...prev,
        clustering: { inProgress: false, lastRun: new Date() }
      } : null);

      await loadVectorStats();
    } catch (error) {
      console.error('Clustering failed:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'indexed': return <Upload className="h-4 w-4" />;
      case 'searched': return <Search className="h-4 w-4" />;
      case 'clustered': return <BarChart3 className="h-4 w-4" />;
      case 'deleted': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading vector database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Manage your vector database and AI-powered search
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadVectorStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {maintenance?.reindexing.inProgress && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Reindexing in progress... {maintenance.reindexing.progress}%
            <Progress value={maintenance.reindexing.progress} className="mt-2" />
          </AlertDescription>
        </Alert>
      )}

      {maintenance?.clustering.inProgress && (
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            Cluster rebalancing in progress...
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalDocuments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +12% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clusters</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalClusters}</div>
                <p className="text-xs text-muted-foreground">
                  Optimally organized
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats ? formatBytes(stats.storageSize) : '0 B'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vector embeddings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Search Performance</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.searchPerformance.averageQueryTime}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average query time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Content Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Distribution</CardTitle>
                <CardDescription>
                  Documents by content type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats && Object.entries(stats.documentsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {count.toLocaleString()} documents
                      </span>
                    </div>
                    <div className="text-sm font-medium">
                      {((count / stats.totalDocuments) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest vector database operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activity.description}</p>
                        {getStatusIcon(activity.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Maintenance Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance</CardTitle>
              <CardDescription>
                Optimize and maintain your vector database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  onClick={handleReindex}
                  disabled={maintenance?.reindexing.inProgress}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${maintenance?.reindexing.inProgress ? 'animate-spin' : ''}`} />
                  Full Reindex
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleClusterRebalance}
                  disabled={maintenance?.clustering.inProgress}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Rebalance Clusters
                </Button>
                
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Database Settings
                </Button>
              </div>

              {/* Maintenance Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium">Last Clustering</p>
                  <p className="text-muted-foreground">
                    {maintenance?.clustering.lastRun?.toLocaleDateString() || 'Never'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Last Cleanup</p>
                  <p className="text-muted-foreground">
                    {maintenance?.cleanup.lastCleanup?.toLocaleDateString() || 'Never'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Orphaned Embeddings</p>
                  <p className="text-muted-foreground">
                    {maintenance?.cleanup.orphanedEmbeddings || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <SearchInterface />
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <DocumentUploader onUploadComplete={loadVectorStats} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <VectorAnalytics stats={stats} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Vector Database Settings</CardTitle>
              <CardDescription>
                Configure your vector database behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Indexing Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Auto-indexing</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Automatically index new content
                    </p>
                    <Button variant="outline" size="sm">
                      Enabled
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Clustering</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Group similar content automatically
                    </p>
                    <Button variant="outline" size="sm">
                      Enabled
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Search Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Hybrid Search</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Combine vector and text search
                    </p>
                    <Button variant="outline" size="sm">
                      Enabled
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Cache Results</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Cache frequent searches
                    </p>
                    <Button variant="outline" size="sm">
                      Enabled
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Performance Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Max Clusters</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Maximum number of clusters per content type
                    </p>
                    <Button variant="outline" size="sm">
                      50
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Similarity Threshold</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Minimum similarity for search results
                    </p>
                    <Button variant="outline" size="sm">
                      0.7
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}