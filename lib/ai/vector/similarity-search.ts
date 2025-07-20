import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../embedding-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('similarity-search');

export interface SearchOptions {
  contentTypes?: ContentType[];
  storeId?: string;
  k?: number;
  threshold?: number;
  includeChunks?: boolean;
  minChunkSimilarity?: number;
  useHybridSearch?: boolean;
  hybridWeights?: {
    vector: number;
    text: number;
  };
  useClusterSearch?: boolean;
  clusterParams?: {
    clusterCount: number;
    documentsPerCluster: number;
  };
  filters?: Record<string, any>;
  boosts?: {
    recentDocuments?: number;
    highRatedContent?: number;
    userPreferences?: Record<string, number>;
  };
  rerankingOptions?: {
    enabled: boolean;
    model?: 'semantic' | 'cross-encoder' | 'hybrid';
    topK?: number;
  };
}

export type ContentType = 
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

export interface SearchResult {
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
  boostScore?: number;
  rerankScore?: number;
  explanation?: string;
}

export interface SearchAnalytics {
  queryTime: number;
  totalResults: number;
  resultsByType: Record<string, number>;
  averageSimilarity: number;
  searchMethod: 'vector' | 'hybrid' | 'cluster';
  clustersSearched?: number;
  reranked?: boolean;
  cacheHit?: boolean;
}

export interface AggregatedSearchResult {
  parentDocument: SearchResult;
  relevantChunks: SearchResult[];
  aggregatedScore: number;
  chunkCount: number;
  bestChunkSimilarity: number;
}

/**
 * Advanced similarity search with multiple strategies
 */
export class SimilaritySearchEngine {
  private client: any;
  private cache: Map<string, { results: SearchResult[]; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for similarity search');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);
    this.cache = new Map();
  }

  /**
   * Main search method with automatic strategy selection
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    analytics: SearchAnalytics;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting similarity search', {
        query: query.substring(0, 100) + '...',
        options: {
          ...options,
          boosts: options.boosts ? Object.keys(options.boosts) : undefined,
        },
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(query, options);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info('Returning cached results', { cacheKey });
        
        return {
          results: cached.results,
          analytics: {
            queryTime: Date.now() - startTime,
            totalResults: cached.results.length,
            resultsByType: this.calculateResultsByType(cached.results),
            averageSimilarity: this.calculateAverageSimilarity(cached.results),
            searchMethod: 'vector',
            cacheHit: true,
          },
        };
      }

      // Generate query embedding
      const queryEmbedding = await generateEmbedding(query);

      let results: SearchResult[] = [];
      let searchMethod: 'vector' | 'hybrid' | 'cluster' = 'vector';
      let clustersSearched = 0;

      // Select search strategy based on options and query characteristics
      if (options.useClusterSearch && this.shouldUseClusterSearch(options)) {
        const clusterResults = await this.clusterBasedSearch(queryEmbedding.embedding, query, options);
        results = clusterResults.results;
        clustersSearched = clusterResults.clustersSearched;
        searchMethod = 'cluster';
      } else if (options.useHybridSearch) {
        results = await this.hybridSearch(queryEmbedding.embedding, query, options);
        searchMethod = 'hybrid';
      } else {
        results = await this.vectorSearch(queryEmbedding.embedding, options);
        searchMethod = 'vector';
      }

      // Apply boosting
      if (options.boosts) {
        results = await this.applyBoosting(results, options.boosts);
      }

      // Apply re-ranking if enabled
      if (options.rerankingOptions?.enabled) {
        results = await this.rerankResults(query, results, options.rerankingOptions);
      }

      // Sort by final score
      results.sort((a, b) => (b.combinedScore || b.similarity) - (a.combinedScore || a.similarity));

      // Limit results
      const k = options.k || 10;
      results = results.slice(0, k);

      // Cache results
      this.cache.set(cacheKey, { results, timestamp: Date.now() });

      const analytics: SearchAnalytics = {
        queryTime: Date.now() - startTime,
        totalResults: results.length,
        resultsByType: this.calculateResultsByType(results),
        averageSimilarity: this.calculateAverageSimilarity(results),
        searchMethod,
        clustersSearched: clustersSearched > 0 ? clustersSearched : undefined,
        reranked: options.rerankingOptions?.enabled,
        cacheHit: false,
      };

      logger.info('Similarity search completed', {
        queryTime: analytics.queryTime,
        resultCount: results.length,
        searchMethod,
        averageSimilarity: analytics.averageSimilarity,
      });

      return { results, analytics };

    } catch (error) {
      logger.error('Similarity search failed', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vector-only similarity search
   */
  private async vectorSearch(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { data, error } = await this.client
      .rpc('enhanced_similarity_search', {
        query_embedding: queryEmbedding,
        search_content_type: options.contentTypes?.[0] || null,
        search_store_id: options.storeId || null,
        match_threshold: options.threshold || 0.7,
        match_count: (options.k || 10) * 2, // Get more to allow for filtering
        filter_metadata: options.filters || null,
        exclude_chunks: !options.includeChunks,
        min_chunk_similarity: options.minChunkSimilarity || 0.8,
      });

    if (error) {
      logger.error('Vector search failed', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return this.formatSearchResults(data, 'vector');
  }

  /**
   * Hybrid search combining vector and full-text search
   */
  private async hybridSearch(
    queryEmbedding: number[],
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const weights = options.hybridWeights || { vector: 0.7, text: 0.3 };
    
    const { data, error } = await this.client
      .rpc('hybrid_search', {
        query_text: query,
        query_embedding: queryEmbedding,
        search_store_id: options.storeId || null,
        vector_weight: weights.vector,
        text_weight: weights.text,
        match_count: (options.k || 10) * 2,
        match_threshold: options.threshold || 0.5,
      });

    if (error) {
      logger.error('Hybrid search failed', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }

    return this.formatSearchResults(data, 'hybrid');
  }

  /**
   * Cluster-based search for better performance
   */
  private async clusterBasedSearch(
    queryEmbedding: number[],
    query: string,
    options: SearchOptions
  ): Promise<{ results: SearchResult[]; clustersSearched: number }> {
    const clusterParams = options.clusterParams || {
      clusterCount: 3,
      documentsPerCluster: 5,
    };

    const { data, error } = await this.client
      .rpc('cluster_similarity_search', {
        query_embedding: queryEmbedding,
        search_content_type: options.contentTypes?.[0] || null,
        search_store_id: options.storeId || null,
        cluster_count: clusterParams.clusterCount,
        documents_per_cluster: clusterParams.documentsPerCluster,
      });

    if (error) {
      logger.error('Cluster search failed', error);
      throw new Error(`Cluster search failed: ${error.message}`);
    }

    const results = this.formatSearchResults(data, 'cluster');
    
    return {
      results,
      clustersSearched: clusterParams.clusterCount,
    };
  }

  /**
   * Apply boosting to search results
   */
  private async applyBoosting(
    results: SearchResult[],
    boosts: NonNullable<SearchOptions['boosts']>
  ): Promise<SearchResult[]> {
    return results.map(result => {
      let boostScore = 1.0;
      
      // Recent documents boost
      if (boosts.recentDocuments && result.metadata.created_at) {
        const age = Date.now() - new Date(result.metadata.created_at).getTime();
        const daysSinceCreation = age / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreation < 7) {
          boostScore *= boosts.recentDocuments;
        }
      }

      // High-rated content boost
      if (boosts.highRatedContent && result.metadata.rating) {
        if (result.metadata.rating >= 4) {
          boostScore *= boosts.highRatedContent;
        }
      }

      // User preferences boost
      if (boosts.userPreferences && result.metadata.category) {
        const categoryBoost = boosts.userPreferences[result.metadata.category];
        if (categoryBoost) {
          boostScore *= categoryBoost;
        }
      }

      // Apply boost to similarity score
      const originalScore = result.combinedScore || result.similarity;
      const boostedScore = originalScore * boostScore;

      return {
        ...result,
        boostScore,
        combinedScore: boostedScore,
      };
    });
  }

  /**
   * Re-rank search results using advanced methods
   */
  private async rerankResults(
    query: string,
    results: SearchResult[],
    rerankOptions: NonNullable<SearchOptions['rerankingOptions']>
  ): Promise<SearchResult[]> {
    const topK = rerankOptions.topK || results.length;
    const resultsToRerank = results.slice(0, topK);

    try {
      switch (rerankOptions.model) {
        case 'semantic':
          return await this.semanticReranking(query, resultsToRerank);
        case 'cross-encoder':
          return await this.crossEncoderReranking(query, resultsToRerank);
        case 'hybrid':
        default:
          return await this.hybridReranking(query, resultsToRerank);
      }
    } catch (error) {
      logger.error('Re-ranking failed, returning original results', error);
      return results;
    }
  }

  /**
   * Semantic re-ranking using embeddings
   */
  private async semanticReranking(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // For now, return results as-is since we already use semantic similarity
    // In a full implementation, this could use a different embedding model
    return results.map(result => ({
      ...result,
      rerankScore: result.similarity,
    }));
  }

  /**
   * Cross-encoder re-ranking (placeholder)
   */
  private async crossEncoderReranking(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Placeholder for cross-encoder implementation
    // Would require additional ML models
    return results.map(result => ({
      ...result,
      rerankScore: result.similarity,
    }));
  }

  /**
   * Hybrid re-ranking combining multiple signals
   */
  private async hybridReranking(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    return results.map(result => {
      let rerankScore = result.similarity;

      // Content length factor
      const contentLength = result.content.length;
      if (contentLength > 100 && contentLength < 2000) {
        rerankScore *= 1.1; // Prefer medium-length content
      }

      // Title relevance
      if (result.title && result.title.toLowerCase().includes(query.toLowerCase().split(' ')[0])) {
        rerankScore *= 1.2;
      }

      // Content type preferences
      const typeBoosts = {
        'knowledge_base': 1.3,
        'faq': 1.2,
        'product': 1.1,
        'review': 1.0,
      };
      
      const typeBoost = typeBoosts[result.contentType as keyof typeof typeBoosts] || 1.0;
      rerankScore *= typeBoost;

      return {
        ...result,
        rerankScore,
        combinedScore: rerankScore,
      };
    });
  }

  /**
   * Aggregate chunks into parent documents
   */
  async aggregateChunks(
    results: SearchResult[],
    options: { maxChunksPerDocument?: number } = {}
  ): Promise<AggregatedSearchResult[]> {
    const maxChunksPerDocument = options.maxChunksPerDocument || 3;
    const parentGroups = new Map<string, SearchResult[]>();
    const standaloneResults: SearchResult[] = [];

    // Group results by parent document
    results.forEach(result => {
      const parentId = result.chunkInfo?.parentId;
      
      if (parentId) {
        if (!parentGroups.has(parentId)) {
          parentGroups.set(parentId, []);
        }
        parentGroups.get(parentId)!.push(result);
      } else {
        standaloneResults.push(result);
      }
    });

    const aggregatedResults: AggregatedSearchResult[] = [];

    // Process grouped chunks
    for (const [parentId, chunks] of parentGroups) {
      // Sort chunks by similarity
      chunks.sort((a, b) => b.similarity - a.similarity);
      
      // Get parent document info (use first chunk as reference)
      const parentDocument = chunks[0];
      const relevantChunks = chunks.slice(0, maxChunksPerDocument);
      
      // Calculate aggregated score
      const weights = relevantChunks.map((_, i) => Math.pow(0.8, i)); // Decreasing weights
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      const aggregatedScore = relevantChunks.reduce((sum, chunk, i) => 
        sum + chunk.similarity * weights[i], 0) / weightSum;

      aggregatedResults.push({
        parentDocument: {
          ...parentDocument,
          similarity: aggregatedScore,
          combinedScore: aggregatedScore,
        },
        relevantChunks,
        aggregatedScore,
        chunkCount: chunks.length,
        bestChunkSimilarity: chunks[0].similarity,
      });
    }

    // Add standalone results
    standaloneResults.forEach(result => {
      aggregatedResults.push({
        parentDocument: result,
        relevantChunks: [],
        aggregatedScore: result.similarity,
        chunkCount: 1,
        bestChunkSimilarity: result.similarity,
      });
    });

    // Sort by aggregated score
    aggregatedResults.sort((a, b) => b.aggregatedScore - a.aggregatedScore);

    return aggregatedResults;
  }

  /**
   * Search with context awareness
   */
  async contextualSearch(
    query: string,
    context: {
      previousQueries?: string[];
      userProfile?: Record<string, any>;
      sessionData?: Record<string, any>;
    },
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    analytics: SearchAnalytics;
    contextualInsights?: string[];
  }> {
    // Enhance query with context
    let enhancedQuery = query;
    const insights: string[] = [];

    if (context.previousQueries && context.previousQueries.length > 0) {
      const lastQuery = context.previousQueries[context.previousQueries.length - 1];
      if (this.isFollowUpQuery(query, lastQuery)) {
        enhancedQuery = `${lastQuery} ${query}`;
        insights.push('Query enhanced with previous context');
      }
    }

    // Adjust search options based on user profile
    if (context.userProfile) {
      if (context.userProfile.preferredCategories) {
        options.boosts = {
          ...options.boosts,
          userPreferences: context.userProfile.preferredCategories,
        };
        insights.push('Search boosted for user preferences');
      }
    }

    const searchResults = await this.search(enhancedQuery, options);

    return {
      ...searchResults,
      contextualInsights: insights,
    };
  }

  /**
   * Multi-modal search (text + metadata filters)
   */
  async multiModalSearch(
    queries: {
      text?: string;
      metadata?: Record<string, any>;
      semanticFilters?: {
        similarTo?: string; // ID of document to find similar content
        excludeSimilarTo?: string; // ID of document to exclude similar content
      };
    },
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    analytics: SearchAnalytics;
  }> {
    let results: SearchResult[] = [];

    // Text search
    if (queries.text) {
      const textResults = await this.search(queries.text, {
        ...options,
        filters: queries.metadata,
      });
      results = textResults.results;
    }

    // Semantic filtering
    if (queries.semanticFilters?.similarTo) {
      const { data: refDoc, error } = await this.client
        .from('documents_enhanced')
        .select('embedding')
        .eq('id', queries.semanticFilters.similarTo)
        .single();

      if (!error && refDoc?.embedding) {
        const similarResults = await this.vectorSearch(refDoc.embedding, {
          ...options,
          k: (options.k || 10) * 2, // Get more results for filtering
        });
        
        // Merge with text results or use as primary results
        if (results.length > 0) {
          results = this.mergeSearchResults(results, similarResults);
        } else {
          results = similarResults;
        }
      }
    }

    // Filter out excluded similar documents
    if (queries.semanticFilters?.excludeSimilarTo) {
      const { data: excludeDoc, error } = await this.client
        .from('documents_enhanced')
        .select('embedding')
        .eq('id', queries.semanticFilters.excludeSimilarTo)
        .single();

      if (!error && excludeDoc?.embedding) {
        results = results.filter(result => {
          // Calculate similarity to excluded document
          // Filter out highly similar results (threshold: 0.9)
          return true; // Placeholder - would need similarity calculation
        });
      }
    }

    const analytics: SearchAnalytics = {
      queryTime: 0, // Would be calculated
      totalResults: results.length,
      resultsByType: this.calculateResultsByType(results),
      averageSimilarity: this.calculateAverageSimilarity(results),
      searchMethod: 'hybrid',
    };

    return { results, analytics };
  }

  // Helper methods

  private generateCacheKey(query: string, options: SearchOptions): string {
    return `${query}_${JSON.stringify(options)}`;
  }

  private shouldUseClusterSearch(options: SearchOptions): boolean {
    // Use cluster search for large result sets or when performance is critical
    return (options.k || 10) > 20 || options.clusterParams !== undefined;
  }

  private isFollowUpQuery(current: string, previous: string): boolean {
    // Simple heuristic - check for pronouns or continuation words
    const followUpIndicators = ['it', 'that', 'this', 'also', 'more', 'other'];
    const currentWords = current.toLowerCase().split(' ');
    
    return followUpIndicators.some(indicator => 
      currentWords.includes(indicator)
    );
  }

  private formatSearchResults(data: any[], searchType: string): SearchResult[] {
    return data.map(item => ({
      id: item.id,
      content: item.content,
      title: item.title,
      contentType: item.content_type,
      metadata: item.metadata || {},
      similarity: item.similarity || item.vector_similarity,
      textSimilarity: item.text_similarity,
      combinedScore: item.combined_score || item.similarity,
      chunkInfo: item.chunk_info ? {
        chunkIndex: item.chunk_info.chunk_index,
        chunkCount: item.chunk_info.chunk_count,
        parentId: item.chunk_info.parent_id,
      } : undefined,
      clusterInfo: item.cluster_name ? {
        clusterId: item.cluster_id || '',
        clusterName: item.cluster_name,
      } : undefined,
    }));
  }

  private calculateResultsByType(results: SearchResult[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.contentType] = (acc[result.contentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAverageSimilarity(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, result) => acc + result.similarity, 0);
    return sum / results.length;
  }

  private mergeSearchResults(results1: SearchResult[], results2: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();
    
    // Add all results from first set
    results1.forEach(result => {
      merged.set(result.id, result);
    });
    
    // Add results from second set, combining scores if duplicate
    results2.forEach(result => {
      const existing = merged.get(result.id);
      if (existing) {
        // Combine scores
        merged.set(result.id, {
          ...existing,
          combinedScore: (existing.similarity + result.similarity) / 2,
        });
      } else {
        merged.set(result.id, result);
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }
}

/**
 * Factory function to create similarity search engine
 */
export function createSimilaritySearchEngine(): SimilaritySearchEngine {
  return new SimilaritySearchEngine();
}

/**
 * Quick search function for simple use cases
 */
export async function quickSearch(
  query: string,
  storeId: string,
  contentType?: ContentType,
  k: number = 5
): Promise<SearchResult[]> {
  const engine = createSimilaritySearchEngine();
  
  const { results } = await engine.search(query, {
    storeId,
    contentTypes: contentType ? [contentType] : undefined,
    k,
    threshold: 0.7,
    useHybridSearch: true,
  });
  
  return results;
}

/**
 * Product search with e-commerce specific features
 */
export async function searchProducts(
  query: string,
  storeId: string,
  filters?: {
    priceRange?: { min: number; max: number };
    category?: string;
    vendor?: string;
    inStock?: boolean;
  },
  k: number = 10
): Promise<SearchResult[]> {
  const engine = createSimilaritySearchEngine();
  
  const metadata: Record<string, any> = {};
  if (filters?.category) metadata.category = filters.category;
  if (filters?.vendor) metadata.vendor = filters.vendor;
  if (filters?.inStock) metadata.in_stock = true;
  
  const { results } = await engine.search(query, {
    storeId,
    contentTypes: ['product'],
    k,
    threshold: 0.6,
    useHybridSearch: true,
    filters: Object.keys(metadata).length > 0 ? metadata : undefined,
    boosts: {
      highRatedContent: 1.2,
      recentDocuments: 1.1,
    },
  });
  
  return results;
}

/**
 * Knowledge base search with approval filtering
 */
export async function searchKnowledgeBase(
  query: string,
  storeId: string,
  options?: {
    category?: string;
    difficulty?: number;
    approvalStatus?: string;
  },
  k: number = 8
): Promise<SearchResult[]> {
  const engine = createSimilaritySearchEngine();
  
  const filters: Record<string, any> = {
    approval_status: options?.approvalStatus || 'approved',
  };
  
  if (options?.category) filters.category = options.category;
  if (options?.difficulty) filters.difficulty = options.difficulty;
  
  const { results } = await engine.search(query, {
    storeId,
    contentTypes: ['knowledge_base', 'faq'],
    k,
    threshold: 0.7,
    useHybridSearch: true,
    filters,
    boosts: {
      recentDocuments: 1.15,
    },
    rerankingOptions: {
      enabled: true,
      model: 'hybrid',
      topK: k * 2,
    },
  });
  
  return results;
}