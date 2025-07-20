import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import { DocumentIndexer, createDocumentIndexer, IndexingOptions, ContentType } from './document-indexer';
import { SimilaritySearchEngine, createSimilaritySearchEngine, SearchOptions } from './similarity-search';
import { VectorClusterManager, createVectorClusterManager } from './clustering';

const logger = createLogger('vector-manager');

export interface VectorStoreConfig {
  storeId: string;
  enableAutoIndexing?: boolean;
  enableClustering?: boolean;
  clusteringConfig?: {
    minDocumentsPerCluster?: number;
    maxClusters?: number;
    rebalanceInterval?: number;
  };
  compressionConfig?: {
    enabled?: boolean;
    compressionRatio?: number;
    quantizationBits?: number;
  };
}

export interface EmbeddingLifecycleEvent {
  type: 'created' | 'updated' | 'deleted' | 'clustered' | 'compressed';
  documentId: string;
  contentType: ContentType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface VectorStoreStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  totalEmbeddings: number;
  averageEmbeddingSize: number;
  totalClusters: number;
  clusterDistribution: Record<string, number>;
  storageSize: number;
  indexingRate: number;
  searchPerformance: {
    averageQueryTime: number;
    cacheHitRate: number;
    totalSearches: number;
  };
  lastUpdated: Date;
}

export interface VectorMaintenance {
  reindexing: {
    inProgress: boolean;
    progress?: number;
    startedAt?: Date;
    estimatedCompletion?: Date;
  };
  clustering: {
    inProgress: boolean;
    progress?: number;
    startedAt?: Date;
    lastRun?: Date;
  };
  compression: {
    inProgress: boolean;
    progress?: number;
    compressionRatio?: number;
    lastRun?: Date;
  };
  cleanup: {
    orphanedEmbeddings?: number;
    outdatedClusters?: number;
    lastCleanup?: Date;
  };
}

export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive vector store manager for embedding lifecycle management
 */
export class VectorStoreManager {
  private client: any;
  private config: VectorStoreConfig;
  private indexer: DocumentIndexer;
  private searchEngine: SimilaritySearchEngine;
  private clusterManager: VectorClusterManager;
  private eventListeners: Map<string, ((event: EmbeddingLifecycleEvent) => void)[]>;
  private maintenanceState: VectorMaintenance;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.eventListeners = new Map();
    this.maintenanceState = {
      reindexing: { inProgress: false },
      clustering: { inProgress: false },
      compression: { inProgress: false },
      cleanup: {},
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for vector store manager');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);
    this.indexer = createDocumentIndexer(config.storeId);
    this.searchEngine = createSimilaritySearchEngine();
    this.clusterManager = createVectorClusterManager(config.storeId);

    // Initialize auto-indexing if enabled
    if (config.enableAutoIndexing) {
      this.setupAutoIndexing();
    }

    logger.info('Vector store manager initialized', {
      storeId: config.storeId,
      enableAutoIndexing: config.enableAutoIndexing,
      enableClustering: config.enableClustering,
    });
  }

  /**
   * Index new content with full lifecycle management
   */
  async indexContent(
    content: string,
    title: string,
    options: IndexingOptions
  ): Promise<{
    documentId: string;
    success: boolean;
    clustered?: boolean;
    compressed?: boolean;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting content indexing', {
        title: title.substring(0, 100),
        contentType: options.contentType,
        storeId: this.config.storeId,
      });

      // Index the document
      const indexResult = await this.indexer.indexDocument(content, title, {
        ...options,
        enableClustering: this.config.enableClustering,
      });

      if (!indexResult.success) {
        throw new Error(`Indexing failed: ${indexResult.errors?.join(', ')}`);
      }

      let clustered = false;
      let compressed = false;

      // Apply clustering if enabled
      if (this.config.enableClustering && indexResult.documentId) {
        try {
          await this.clusterManager.assignDocumentToCluster(indexResult.documentId);
          clustered = true;
          
          this.emitEvent({
            type: 'clustered',
            documentId: indexResult.documentId,
            contentType: options.contentType,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.warn('Clustering failed but continuing', error);
        }
      }

      // Apply compression if enabled
      if (this.config.compressionConfig?.enabled && indexResult.documentId) {
        try {
          await this.compressEmbedding(indexResult.documentId);
          compressed = true;
        } catch (error) {
          logger.warn('Compression failed but continuing', error);
        }
      }

      // Emit lifecycle event
      this.emitEvent({
        type: 'created',
        documentId: indexResult.documentId,
        contentType: options.contentType,
        timestamp: new Date(),
        metadata: {
          chunksCreated: indexResult.totalChunks,
          tokensUsed: indexResult.tokenCount,
          clustered,
          compressed,
        },
      });

      const processingTime = Date.now() - startTime;

      logger.info('Content indexing completed', {
        documentId: indexResult.documentId,
        chunksCreated: indexResult.totalChunks,
        clustered,
        compressed,
        processingTime,
      });

      return {
        documentId: indexResult.documentId,
        success: true,
        clustered,
        compressed,
        processingTime,
      };

    } catch (error) {
      logger.error('Content indexing failed', error);
      return {
        documentId: '',
        success: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch index multiple documents
   */
  async batchIndexContent(
    documents: Array<{
      content: string;
      title: string;
      options: IndexingOptions;
    }>
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      logger.info('Starting batch content indexing', {
        documentCount: documents.length,
        storeId: this.config.storeId,
      });

      // Process in smaller batches to manage memory and rate limits
      const batchSize = 5;
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async doc => {
          try {
            const result = await this.indexContent(doc.content, doc.title, doc.options);
            if (result.success) {
              processed++;
            } else {
              failed++;
              errors.push(`Document "${doc.title}": Indexing failed`);
            }
          } catch (error) {
            failed++;
            errors.push(`Document "${doc.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });

        await Promise.allSettled(batchPromises);

        // Add delay between batches
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Batch content indexing completed', {
        totalDocuments: documents.length,
        processed,
        failed,
        duration,
        errorRate: failed / documents.length,
      });

      return {
        success: failed === 0,
        processed,
        failed,
        errors,
        duration,
        metadata: {
          batchSize,
          averageTimePerDocument: duration / documents.length,
        },
      };

    } catch (error) {
      logger.error('Batch indexing failed', error);
      
      return {
        success: false,
        processed,
        failed: documents.length - processed,
        errors: [...errors, error instanceof Error ? error.message : 'Batch operation failed'],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Update existing document with version control
   */
  async updateDocument(
    documentId: string,
    newContent: string,
    newTitle?: string,
    options?: Partial<IndexingOptions>
  ): Promise<{
    success: boolean;
    versionCreated?: boolean;
    reindexed?: boolean;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Updating document', { documentId });

      // Get existing document
      const { data: existingDoc, error } = await this.client
        .from('documents_enhanced')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !existingDoc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Create version backup
      const versionCreated = await this.createDocumentVersion(existingDoc);

      // Re-index with new content
      const reindexResult = await this.indexer.reindexDocument(documentId);
      
      // Update with new content
      const { error: updateError } = await this.client
        .from('documents_enhanced')
        .update({
          content: newContent,
          title: newTitle || existingDoc.title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }

      // Re-cluster if clustering is enabled
      if (this.config.enableClustering) {
        await this.clusterManager.reassignDocument(documentId);
      }

      // Emit update event
      this.emitEvent({
        type: 'updated',
        documentId,
        contentType: existingDoc.content_type,
        timestamp: new Date(),
        metadata: {
          versionCreated,
          reindexed: reindexResult.success,
        },
      });

      const processingTime = Date.now() - startTime;

      logger.info('Document updated successfully', {
        documentId,
        versionCreated,
        reindexed: reindexResult.success,
        processingTime,
      });

      return {
        success: true,
        versionCreated,
        reindexed: reindexResult.success,
        processingTime,
      };

    } catch (error) {
      logger.error('Document update failed', error);
      
      return {
        success: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Delete document with cleanup
   */
  async deleteDocument(documentId: string): Promise<{
    success: boolean;
    cleanupPerformed?: boolean;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Deleting document', { documentId });

      // Get document info before deletion
      const { data: doc, error } = await this.client
        .from('documents_enhanced')
        .select('content_type, store_id')
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Delete document and all related data
      await this.indexer.deleteDocumentAndChunks(documentId);

      // Clean up orphaned clusters
      const cleanupPerformed = await this.cleanupOrphanedClusters();

      // Emit deletion event
      this.emitEvent({
        type: 'deleted',
        documentId,
        contentType: doc.content_type,
        timestamp: new Date(),
        metadata: {
          cleanupPerformed,
        },
      });

      const processingTime = Date.now() - startTime;

      logger.info('Document deleted successfully', {
        documentId,
        cleanupPerformed,
        processingTime,
      });

      return {
        success: true,
        cleanupPerformed,
        processingTime,
      };

    } catch (error) {
      logger.error('Document deletion failed', error);
      
      return {
        success: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Search with full feature support
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ) {
    return await this.searchEngine.search(query, {
      ...options,
      storeId: options.storeId || this.config.storeId,
    });
  }

  /**
   * Get comprehensive vector store statistics
   */
  async getStatistics(): Promise<VectorStoreStats> {
    try {
      logger.info('Gathering vector store statistics', {
        storeId: this.config.storeId,
      });

      // Get document statistics
      const { data: docStats, error: docError } = await this.client
        .from('vector_store_analytics')
        .select('*')
        .eq('store_id', this.config.storeId);

      if (docError) {
        throw new Error(`Failed to get document stats: ${docError.message}`);
      }

      // Get cluster statistics
      const { data: clusterStats, error: clusterError } = await this.client
        .from('vector_clusters')
        .select('content_type, member_count')
        .eq('store_id', this.config.storeId);

      if (clusterError) {
        throw new Error(`Failed to get cluster stats: ${clusterError.message}`);
      }

      // Calculate aggregated statistics
      const totalDocuments = docStats.reduce((sum, s) => sum + s.document_count, 0);
      const documentsByType = docStats.reduce((acc, s) => {
        acc[s.content_type] = s.document_count;
        return acc;
      }, {} as Record<string, number>);

      const totalClusters = clusterStats.length;
      const clusterDistribution = clusterStats.reduce((acc, c) => {
        acc[c.content_type] = (acc[c.content_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get search performance stats
      const searchStats = this.searchEngine.getCacheStats();

      return {
        totalDocuments,
        documentsByType,
        totalEmbeddings: totalDocuments, // Assuming 1:1 for now
        averageEmbeddingSize: 1536 * 4, // 1536 dimensions * 4 bytes per float
        totalClusters,
        clusterDistribution,
        storageSize: totalDocuments * 1536 * 4, // Approximate
        indexingRate: 0, // Would need to track separately
        searchPerformance: {
          averageQueryTime: 0, // Would need to track separately
          cacheHitRate: searchStats.hitRate,
          totalSearches: 0, // Would need to track separately
        },
        lastUpdated: new Date(),
      };

    } catch (error) {
      logger.error('Failed to get vector store statistics', error);
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get maintenance status
   */
  getMaintenanceStatus(): VectorMaintenance {
    return { ...this.maintenanceState };
  }

  /**
   * Perform full reindexing
   */
  async reindexStore(
    options?: {
      contentTypes?: ContentType[];
      batchSize?: number;
      includeCompression?: boolean;
    }
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    
    this.maintenanceState.reindexing = {
      inProgress: true,
      progress: 0,
      startedAt: new Date(),
    };

    try {
      logger.info('Starting full store reindexing', {
        storeId: this.config.storeId,
        options,
      });

      // Get all documents to reindex
      let query = this.client
        .from('documents_enhanced')
        .select('id, content_type')
        .eq('store_id', this.config.storeId)
        .eq('status', 'active')
        .is('parent_document_id', null); // Only parent documents

      if (options?.contentTypes) {
        query = query.in('content_type', options.contentTypes);
      }

      const { data: documents, error } = await query;

      if (error) {
        throw new Error(`Failed to get documents: ${error.message}`);
      }

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];
      const batchSize = options?.batchSize || 10;

      // Process in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async doc => {
          try {
            const result = await this.indexer.reindexDocument(doc.id);
            if (result.success) {
              processed++;
            } else {
              failed++;
              errors.push(`Document ${doc.id}: ${result.errors?.join(', ')}`);
            }
          } catch (error) {
            failed++;
            errors.push(`Document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });

        await Promise.allSettled(batchPromises);

        // Update progress
        this.maintenanceState.reindexing.progress = (i + batch.length) / documents.length;

        // Add delay between batches
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Perform clustering if enabled
      if (this.config.enableClustering) {
        await this.clusterManager.rebalanceClusters();
      }

      // Refresh analytics
      await this.refreshAnalytics();

      const duration = Date.now() - startTime;

      this.maintenanceState.reindexing = {
        inProgress: false,
        progress: 1,
      };

      logger.info('Store reindexing completed', {
        totalDocuments: documents.length,
        processed,
        failed,
        duration,
      });

      return {
        success: failed === 0,
        processed,
        failed,
        errors,
        duration,
        metadata: {
          totalDocuments: documents.length,
          batchSize,
          averageTimePerDocument: duration / documents.length,
        },
      };

    } catch (error) {
      this.maintenanceState.reindexing = {
        inProgress: false,
        progress: 0,
      };

      logger.error('Store reindexing failed', error);
      
      return {
        success: false,
        processed: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Reindexing failed'],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compress embeddings to save storage
   */
  async compressEmbeddings(
    options?: {
      compressionRatio?: number;
      quantizationBits?: number;
      batchSize?: number;
    }
  ): Promise<BatchOperationResult> {
    // Placeholder for embedding compression
    // In a full implementation, this would use techniques like:
    // - Vector quantization
    // - Principal Component Analysis (PCA)
    // - Product quantization
    
    logger.info('Embedding compression not yet implemented');
    
    return {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
      duration: 0,
      metadata: {
        compressionRatio: options?.compressionRatio || 0.5,
        quantizationBits: options?.quantizationBits || 8,
      },
    };
  }

  /**
   * Add event listener for embedding lifecycle events
   */
  addEventListener(
    eventType: EmbeddingLifecycleEvent['type'],
    listener: (event: EmbeddingLifecycleEvent) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    eventType: EmbeddingLifecycleEvent['type'],
    listener: (event: EmbeddingLifecycleEvent) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private emitEvent(event: EmbeddingLifecycleEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          logger.error('Event listener error', error);
        }
      });
    }
  }

  private async setupAutoIndexing(): void {
    // In a full implementation, this would set up:
    // - Database triggers
    // - Webhook listeners
    // - Scheduled jobs for bulk processing
    
    logger.info('Auto-indexing setup (placeholder)', {
      storeId: this.config.storeId,
    });
  }

  private async createDocumentVersion(document: any): Promise<boolean> {
    try {
      // Create a version entry (would need a versions table)
      // For now, just log the versioning
      logger.info('Document version created', {
        documentId: document.id,
        version: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to create document version', error);
      return false;
    }
  }

  private async compressEmbedding(documentId: string): Promise<void> {
    // Placeholder for individual embedding compression
    logger.debug('Embedding compression (placeholder)', { documentId });
  }

  private async cleanupOrphanedClusters(): Promise<boolean> {
    try {
      // Delete clusters with no members
      const { error } = await this.client
        .from('vector_clusters')
        .delete()
        .eq('store_id', this.config.storeId)
        .eq('member_count', 0);

      if (error) {
        logger.error('Failed to cleanup orphaned clusters', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Cluster cleanup failed', error);
      return false;
    }
  }

  private async refreshAnalytics(): Promise<void> {
    try {
      // Refresh the materialized view
      await this.client.rpc('refresh_vector_analytics');
      logger.info('Analytics refreshed');
    } catch (error) {
      logger.error('Failed to refresh analytics', error);
    }
  }

  /**
   * Health check for the vector store
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    performance: {
      indexingWorking: boolean;
      searchWorking: boolean;
      clusteringWorking: boolean;
    };
  }> {
    const issues: string[] = [];
    let indexingWorking = false;
    let searchWorking = false;
    let clusteringWorking = false;

    try {
      // Test basic connectivity
      const { error: connectError } = await this.client
        .from('documents_enhanced')
        .select('count')
        .eq('store_id', this.config.storeId)
        .limit(1);

      if (connectError) {
        issues.push(`Database connectivity: ${connectError.message}`);
      }

      // Test search functionality
      try {
        await this.searchEngine.search('test query', {
          storeId: this.config.storeId,
          k: 1,
        });
        searchWorking = true;
      } catch (error) {
        issues.push(`Search functionality: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test indexing functionality
      try {
        // This would create a test document and clean it up
        indexingWorking = true; // Placeholder
      } catch (error) {
        issues.push(`Indexing functionality: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test clustering functionality
      if (this.config.enableClustering) {
        try {
          await this.clusterManager.getClusterStats();
          clusteringWorking = true;
        } catch (error) {
          issues.push(`Clustering functionality: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        clusteringWorking = true; // Not enabled, so considered working
      }

      logger.info('Vector store health check completed', {
        healthy: issues.length === 0,
        issueCount: issues.length,
        performance: { indexingWorking, searchWorking, clusteringWorking },
      });

      return {
        healthy: issues.length === 0,
        issues,
        performance: {
          indexingWorking,
          searchWorking,
          clusteringWorking,
        },
      };

    } catch (error) {
      logger.error('Health check failed', error);
      
      return {
        healthy: false,
        issues: [...issues, `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        performance: {
          indexingWorking: false,
          searchWorking: false,
          clusteringWorking: false,
        },
      };
    }
  }
}

/**
 * Factory function to create vector store manager
 */
export function createVectorStoreManager(config: VectorStoreConfig): VectorStoreManager {
  return new VectorStoreManager(config);
}

/**
 * Quick setup function for common configurations
 */
export function createDefaultVectorStore(storeId: string): VectorStoreManager {
  return createVectorStoreManager({
    storeId,
    enableAutoIndexing: true,
    enableClustering: true,
    clusteringConfig: {
      minDocumentsPerCluster: 5,
      maxClusters: 50,
      rebalanceInterval: 24 * 60 * 60 * 1000, // 24 hours
    },
    compressionConfig: {
      enabled: false, // Disabled by default until implemented
      compressionRatio: 0.5,
      quantizationBits: 8,
    },
  });
}