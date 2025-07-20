import { createClient } from '@supabase/supabase-js';
import { generateBatchEmbeddings, generateEmbedding } from '../embedding-service';
import { createLogger } from '@/lib/logger';
import { Document } from '@langchain/core/documents';

const logger = createLogger('document-indexer');

export interface IndexingOptions {
  batchSize?: number;
  maxChunkSize?: number;
  overlapSize?: number;
  enableClustering?: boolean;
  contentType: ContentType;
  storeId: string;
  sourceId?: string;
  sourceUrl?: string;
  language?: string;
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

export interface DocumentChunk {
  content: string;
  title?: string;
  summary?: string;
  metadata: Record<string, any>;
  chunkIndex: number;
  chunkCount: number;
  parentId?: string;
}

export interface IndexingResult {
  documentId: string;
  chunkIds: string[];
  totalChunks: number;
  processingTime: number;
  tokenCount: number;
  success: boolean;
  errors?: string[];
}

export interface BatchIndexingResult {
  results: IndexingResult[];
  totalDocuments: number;
  successCount: number;
  failureCount: number;
  totalProcessingTime: number;
  totalTokens: number;
  averageChunksPerDocument: number;
}

/**
 * Advanced document indexer with chunking and content type specialization
 */
export class DocumentIndexer {
  private client: any;
  private storeId: string;

  constructor(storeId: string) {
    this.storeId = storeId;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for document indexing');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Index a single document with automatic chunking
   */
  async indexDocument(
    content: string,
    title: string,
    options: IndexingOptions
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      logger.info('Starting document indexing', {
        title: title.substring(0, 100),
        contentLength: content.length,
        contentType: options.contentType,
        storeId: this.storeId,
      });

      // Generate document summary
      const summary = await this.generateSummary(content, title);

      // Split document into chunks if needed
      const chunks = await this.createChunks(content, title, summary, options);
      
      // Generate embeddings for all chunks
      const chunkTexts = chunks.map(chunk => this.buildChunkText(chunk));
      const embeddings = await generateBatchEmbeddings(chunkTexts, undefined, options.batchSize);

      // Insert parent document first
      const parentDoc = await this.insertDocument({
        content,
        title,
        summary,
        contentType: options.contentType,
        metadata: options,
        embedding: embeddings.embeddings[0]?.embedding, // Use first chunk embedding as parent
        isParent: chunks.length > 1,
      });

      const chunkIds: string[] = [];
      let totalTokens = 0;

      // Insert chunks if document was split
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings.embeddings[i];
          
          if (embedding) {
            try {
              const chunkId = await this.insertDocument({
                content: chunk.content,
                title: chunk.title || title,
                summary: chunk.summary,
                contentType: options.contentType,
                metadata: { ...chunk.metadata, chunk_index: i, chunk_count: chunks.length },
                embedding: embedding.embedding,
                parentId: parentDoc.id,
                chunkIndex: i,
                chunkCount: chunks.length,
              });
              
              chunkIds.push(chunkId);
              totalTokens += embedding.tokens;
            } catch (error) {
              logger.error(`Failed to insert chunk ${i}`, error);
              errors.push(`Chunk ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      } else {
        chunkIds.push(parentDoc.id);
        totalTokens = embeddings.totalTokens;
      }

      // Create specialized embedding based on content type
      await this.createSpecializedEmbedding(parentDoc.id, options, chunks[0]?.metadata || {});

      // Cluster the document if enabled
      if (options.enableClustering) {
        await this.assignToCluster(parentDoc.id, embeddings.embeddings[0].embedding, options.contentType);
      }

      const processingTime = Date.now() - startTime;

      logger.info('Document indexing completed', {
        documentId: parentDoc.id,
        chunkCount: chunkIds.length,
        totalTokens,
        processingTime,
        hasErrors: errors.length > 0,
      });

      return {
        documentId: parentDoc.id,
        chunkIds,
        totalChunks: chunks.length,
        processingTime,
        tokenCount: totalTokens,
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      logger.error('Document indexing failed', error);
      
      return {
        documentId: '',
        chunkIds: [],
        totalChunks: 0,
        processingTime: Date.now() - startTime,
        tokenCount: 0,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(
    documents: Array<{
      content: string;
      title: string;
      options: IndexingOptions;
    }>
  ): Promise<BatchIndexingResult> {
    const startTime = Date.now();
    const results: IndexingResult[] = [];

    logger.info('Starting batch document indexing', {
      documentCount: documents.length,
      storeId: this.storeId,
    });

    // Process documents in batches to manage memory
    const batchSize = 10;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const batchPromises = batch.map(doc => 
        this.indexDocument(doc.content, doc.title, doc.options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            documentId: '',
            chunkIds: [],
            totalChunks: 0,
            processingTime: 0,
            tokenCount: 0,
            success: false,
            errors: [result.reason?.message || 'Batch processing failed'],
          });
        }
      });

      // Add delay between batches
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);
    const totalChunks = results.reduce((sum, r) => sum + r.totalChunks, 0);

    logger.info('Batch document indexing completed', {
      totalDocuments: documents.length,
      successCount,
      failureCount,
      totalTokens,
      totalChunks,
      totalProcessingTime,
      averageTimePerDocument: totalProcessingTime / documents.length,
    });

    return {
      results,
      totalDocuments: documents.length,
      successCount,
      failureCount,
      totalProcessingTime,
      totalTokens,
      averageChunksPerDocument: totalChunks / documents.length,
    };
  }

  /**
   * Create chunks from document content
   */
  private async createChunks(
    content: string,
    title: string,
    summary: string,
    options: IndexingOptions
  ): Promise<DocumentChunk[]> {
    const maxChunkSize = options.maxChunkSize || 1000;
    const overlapSize = options.overlapSize || 100;

    if (content.length <= maxChunkSize) {
      return [{
        content,
        title,
        summary,
        metadata: {},
        chunkIndex: 0,
        chunkCount: 1,
      }];
    }

    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(content);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          content: currentChunk.trim(),
          title: `${title} (Part ${chunkIndex + 1})`,
          summary: chunkIndex === 0 ? summary : undefined,
          metadata: {
            original_title: title,
            chunk_type: chunkIndex === 0 ? 'intro' : 'continuation',
          },
          chunkIndex,
          chunkCount: 0, // Will be set after all chunks are created
        });

        // Start new chunk with overlap
        if (overlapSize > 0) {
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.min(overlapSize / 6, words.length / 2));
          currentChunk = overlapWords.join(' ') + ' ';
        } else {
          currentChunk = '';
        }
        
        chunkIndex++;
      }
      
      currentChunk += sentence + ' ';
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        title: `${title} (Part ${chunkIndex + 1})`,
        metadata: {
          original_title: title,
          chunk_type: 'continuation',
        },
        chunkIndex,
        chunkCount: 0,
      });
    }

    // Update chunk counts
    chunks.forEach(chunk => {
      chunk.chunkCount = chunks.length;
    });

    logger.info('Document chunked', {
      originalLength: content.length,
      chunkCount: chunks.length,
      maxChunkSize,
      overlapSize,
    });

    return chunks;
  }

  /**
   * Split text into sentences for better chunking
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with NLP libraries
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 0);
  }

  /**
   * Build searchable text from chunk
   */
  private buildChunkText(chunk: DocumentChunk): string {
    let text = '';
    
    if (chunk.title) {
      text += `Title: ${chunk.title}\n`;
    }
    
    if (chunk.summary) {
      text += `Summary: ${chunk.summary}\n`;
    }
    
    text += `Content: ${chunk.content}`;
    
    return text;
  }

  /**
   * Generate document summary
   */
  private async generateSummary(content: string, title: string): Promise<string> {
    // Simple extractive summary - first few sentences
    // In production, could use AI summarization
    const sentences = this.splitIntoSentences(content);
    const summaryLength = Math.min(3, sentences.length);
    
    return sentences.slice(0, summaryLength).join(' ').substring(0, 500);
  }

  /**
   * Insert document into enhanced table
   */
  private async insertDocument(doc: {
    content: string;
    title?: string;
    summary?: string;
    contentType: ContentType;
    metadata: Record<string, any>;
    embedding: number[];
    parentId?: string;
    chunkIndex?: number;
    chunkCount?: number;
    isParent?: boolean;
  }): Promise<{ id: string }> {
    const { data, error } = await this.client
      .from('documents_enhanced')
      .insert({
        content: doc.content,
        title: doc.title,
        summary: doc.summary,
        content_type: doc.contentType,
        metadata: doc.metadata,
        embedding: doc.embedding,
        parent_document_id: doc.parentId,
        chunk_index: doc.chunkIndex || 0,
        chunk_count: doc.chunkCount || 1,
        store_id: this.storeId,
        source_id: doc.metadata.sourceId,
        source_url: doc.metadata.sourceUrl,
        language: doc.metadata.language || 'en',
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to insert document', error);
      throw new Error(`Failed to insert document: ${error.message}`);
    }

    return data;
  }

  /**
   * Create specialized embedding entry based on content type
   */
  private async createSpecializedEmbedding(
    documentId: string,
    options: IndexingOptions,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      switch (options.contentType) {
        case 'product':
          await this.createProductEmbedding(documentId, options, metadata);
          break;
        case 'customer':
        case 'review':
        case 'support_ticket':
          await this.createCustomerEmbedding(documentId, options, metadata);
          break;
        case 'knowledge_base':
        case 'faq':
          await this.createKnowledgeEmbedding(documentId, options, metadata);
          break;
        default:
          // No specialized embedding needed
          break;
      }
    } catch (error) {
      logger.error('Failed to create specialized embedding', error);
      // Don't throw - specialized embeddings are optional
    }
  }

  /**
   * Create product-specific embedding
   */
  private async createProductEmbedding(
    documentId: string,
    options: IndexingOptions,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await this.client
      .from('product_embeddings')
      .insert({
        document_id: documentId,
        product_id: options.sourceId || metadata.productId,
        store_id: this.storeId,
        title: metadata.title || metadata.name,
        description: metadata.description,
        product_type: metadata.productType || metadata.type,
        vendor: metadata.vendor,
        handle: metadata.handle,
        tags: metadata.tags || [],
        price_range: metadata.priceRange ? `[${metadata.priceRange.min},${metadata.priceRange.max}]` : null,
        inventory_count: metadata.inventory,
        variants: metadata.variants || [],
        collections: metadata.collections || [],
        images: metadata.images || [],
        seo_data: metadata.seo || {},
        performance_metrics: metadata.performance || {},
      });

    if (error) {
      logger.error('Failed to create product embedding', error);
    }
  }

  /**
   * Create customer interaction embedding
   */
  private async createCustomerEmbedding(
    documentId: string,
    options: IndexingOptions,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await this.client
      .from('customer_embeddings')
      .insert({
        document_id: documentId,
        customer_id: options.sourceId || metadata.customerId,
        store_id: this.storeId,
        interaction_type: options.contentType,
        sentiment_score: metadata.sentiment,
        intent_classification: metadata.intent,
        priority_level: metadata.priority || 1,
        resolution_status: metadata.status,
        satisfaction_rating: metadata.rating,
        contact_info: metadata.contact || {},
        purchase_history: metadata.purchases || [],
        preferences: metadata.preferences || {},
      });

    if (error) {
      logger.error('Failed to create customer embedding', error);
    }
  }

  /**
   * Create knowledge base embedding
   */
  private async createKnowledgeEmbedding(
    documentId: string,
    options: IndexingOptions,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await this.client
      .from('knowledge_embeddings')
      .insert({
        document_id: documentId,
        article_id: options.sourceId || metadata.articleId,
        store_id: this.storeId,
        category: metadata.category,
        subcategory: metadata.subcategory,
        difficulty_level: metadata.difficulty || 1,
        view_count: metadata.views || 0,
        helpful_votes: metadata.helpfulVotes || 0,
        outdated: metadata.outdated || false,
        author: metadata.author,
        reviewer: metadata.reviewer,
        approval_status: metadata.approvalStatus || 'draft',
        related_articles: metadata.relatedArticles || [],
        required_permissions: metadata.permissions || [],
      });

    if (error) {
      logger.error('Failed to create knowledge embedding', error);
    }
  }

  /**
   * Assign document to appropriate cluster
   */
  private async assignToCluster(
    documentId: string,
    embedding: number[],
    contentType: ContentType
  ): Promise<void> {
    try {
      // Find the most similar existing cluster
      const { data: clusters, error } = await this.client
        .rpc('find_closest_cluster', {
          query_embedding: embedding,
          search_content_type: contentType,
          search_store_id: this.storeId,
        });

      if (error) {
        logger.error('Failed to find clusters', error);
        return;
      }

      let clusterId: string;

      if (clusters && clusters.length > 0 && clusters[0].similarity > 0.8) {
        // Assign to existing cluster
        clusterId = clusters[0].id;
      } else {
        // Create new cluster
        const { data: newCluster, error: clusterError } = await this.client
          .from('vector_clusters')
          .insert({
            cluster_name: `${contentType}_cluster_${Date.now()}`,
            content_type: contentType,
            store_id: this.storeId,
            centroid: embedding,
            member_count: 0,
            average_similarity: 1.0,
            cluster_metadata: { auto_created: true },
          })
          .select('id')
          .single();

        if (clusterError) {
          logger.error('Failed to create cluster', clusterError);
          return;
        }

        clusterId = newCluster.id;
      }

      // Add document to cluster
      await this.client
        .from('document_clusters')
        .insert({
          document_id: documentId,
          cluster_id: clusterId,
          similarity_to_centroid: 1.0, // Will be calculated properly later
        });

    } catch (error) {
      logger.error('Failed to assign to cluster', error);
    }
  }

  /**
   * Re-index existing document
   */
  async reindexDocument(documentId: string): Promise<IndexingResult> {
    try {
      // Get existing document
      const { data: doc, error } = await this.client
        .from('documents_enhanced')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Delete existing chunks and specialized embeddings
      await this.deleteDocumentAndChunks(documentId);

      // Re-index with original content
      return await this.indexDocument(doc.content, doc.title || '', {
        contentType: doc.content_type,
        storeId: doc.store_id,
        sourceId: doc.source_id,
        sourceUrl: doc.source_url,
        language: doc.language,
        enableClustering: true,
      });

    } catch (error) {
      logger.error('Failed to re-index document', error);
      throw new Error(`Re-indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete document and all its chunks
   */
  async deleteDocumentAndChunks(documentId: string): Promise<void> {
    try {
      // Delete specialized embeddings first (foreign key constraints)
      await Promise.all([
        this.client.from('product_embeddings').delete().eq('document_id', documentId),
        this.client.from('customer_embeddings').delete().eq('document_id', documentId),
        this.client.from('knowledge_embeddings').delete().eq('document_id', documentId),
      ]);

      // Delete cluster assignments
      await this.client
        .from('document_clusters')
        .delete()
        .eq('document_id', documentId);

      // Delete chunks (cascades to parent)
      await this.client
        .from('documents_enhanced')
        .delete()
        .eq('parent_document_id', documentId);

      // Delete parent document
      await this.client
        .from('documents_enhanced')
        .delete()
        .eq('id', documentId);

      logger.info('Document and chunks deleted', { documentId });

    } catch (error) {
      logger.error('Failed to delete document', error);
      throw new Error(`Deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get indexing statistics for store
   */
  async getIndexingStats(): Promise<{
    totalDocuments: number;
    documentsByType: Record<string, number>;
    totalChunks: number;
    averageChunksPerDocument: number;
    indexingErrors: number;
    lastIndexedAt: Date | null;
  }> {
    try {
      const { data: stats, error } = await this.client
        .from('vector_store_analytics')
        .select('*')
        .eq('store_id', this.storeId);

      if (error) {
        logger.error('Failed to get indexing stats', error);
        throw new Error(`Stats query failed: ${error.message}`);
      }

      const totalDocuments = stats.reduce((sum, s) => sum + s.document_count, 0);
      const totalChunks = stats.reduce((sum, s) => sum + s.chunks, 0);
      const documentsByType = stats.reduce((acc, s) => {
        acc[s.content_type] = s.document_count;
        return acc;
      }, {} as Record<string, number>);

      const latestDates = stats.map(s => new Date(s.latest_document)).filter(d => !isNaN(d.getTime()));
      const lastIndexedAt = latestDates.length > 0 ? new Date(Math.max(...latestDates.map(d => d.getTime()))) : null;

      return {
        totalDocuments,
        documentsByType,
        totalChunks,
        averageChunksPerDocument: totalDocuments > 0 ? totalChunks / totalDocuments : 0,
        indexingErrors: 0, // Could be tracked separately
        lastIndexedAt,
      };

    } catch (error) {
      logger.error('Failed to get indexing statistics', error);
      throw new Error(`Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create document indexer
 */
export function createDocumentIndexer(storeId: string): DocumentIndexer {
  return new DocumentIndexer(storeId);
}

/**
 * Index Shopify product data
 */
export async function indexShopifyProducts(
  products: any[],
  storeId: string,
  indexer?: DocumentIndexer
): Promise<BatchIndexingResult> {
  const documentIndexer = indexer || createDocumentIndexer(storeId);

  const documents = products.map(product => ({
    content: `Product: ${product.title}
Description: ${product.body_html || product.description || ''}
Type: ${product.product_type || ''}
Vendor: ${product.vendor || ''}
Tags: ${Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || ''}
Price Range: ${product.variants?.map((v: any) => v.price).join(', ') || ''}
SKUs: ${product.variants?.map((v: any) => v.sku).filter(Boolean).join(', ') || ''}`,
    title: product.title,
    options: {
      contentType: 'product' as ContentType,
      storeId,
      sourceId: product.id.toString(),
      sourceUrl: product.handle ? `/products/${product.handle}` : undefined,
      enableClustering: true,
      maxChunkSize: 1500,
      metadata: {
        productId: product.id,
        handle: product.handle,
        productType: product.product_type,
        vendor: product.vendor,
        tags: Array.isArray(product.tags) ? product.tags : product.tags?.split(',').map((t: string) => t.trim()) || [],
        variants: product.variants || [],
        collections: product.collections || [],
        images: product.images || [],
        priceRange: product.variants?.length > 0 ? {
          min: Math.min(...product.variants.map((v: any) => parseFloat(v.price) || 0)),
          max: Math.max(...product.variants.map((v: any) => parseFloat(v.price) || 0)),
        } : undefined,
        inventory: product.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0),
        seo: {
          title: product.seo_title,
          description: product.seo_description,
        },
      },
    },
  }));

  return await documentIndexer.indexDocuments(documents);
}

/**
 * Index customer reviews and feedback
 */
export async function indexCustomerReviews(
  reviews: Array<{
    id: string;
    content: string;
    rating: number;
    customerId?: string;
    productId?: string;
    title?: string;
  }>,
  storeId: string,
  indexer?: DocumentIndexer
): Promise<BatchIndexingResult> {
  const documentIndexer = indexer || createDocumentIndexer(storeId);

  const documents = reviews.map(review => ({
    content: review.content,
    title: review.title || `Customer Review - Rating: ${review.rating}/5`,
    options: {
      contentType: 'review' as ContentType,
      storeId,
      sourceId: review.id,
      enableClustering: true,
      maxChunkSize: 800,
      metadata: {
        customerId: review.customerId,
        productId: review.productId,
        rating: review.rating,
        sentiment: review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral',
        priority: review.rating <= 2 ? 3 : 1, // Low ratings get higher priority
      },
    },
  }));

  return await documentIndexer.indexDocuments(documents);
}

/**
 * Index knowledge base articles
 */
export async function indexKnowledgeBase(
  articles: Array<{
    id: string;
    title: string;
    content: string;
    category?: string;
    subcategory?: string;
    author?: string;
    difficulty?: number;
  }>,
  storeId: string,
  indexer?: DocumentIndexer
): Promise<BatchIndexingResult> {
  const documentIndexer = indexer || createDocumentIndexer(storeId);

  const documents = articles.map(article => ({
    content: article.content,
    title: article.title,
    options: {
      contentType: 'knowledge_base' as ContentType,
      storeId,
      sourceId: article.id,
      enableClustering: true,
      maxChunkSize: 1200,
      overlapSize: 150,
      metadata: {
        articleId: article.id,
        category: article.category,
        subcategory: article.subcategory,
        author: article.author,
        difficulty: article.difficulty || 1,
        approvalStatus: 'approved',
      },
    },
  }));

  return await documentIndexer.indexDocuments(documents);
}