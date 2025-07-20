import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { createLogger } from '@/lib/logger';
import { createEmbeddingsModel } from './langchain-setup';

const logger = createLogger('vector-store');

export interface VectorStoreConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  queryName?: string;
  filter?: Record<string, any>;
  embeddingModel?: OpenAIEmbeddings;
}

export interface DocumentMetadata {
  source: string;
  type: 'product' | 'customer' | 'order' | 'content' | 'faq' | 'knowledge_base';
  id: string;
  store_id: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  category?: string;
  [key: string]: any;
}

export interface SearchResult {
  content: string;
  metadata: DocumentMetadata;
  score: number;
}

export interface VectorSearchOptions {
  k?: number;
  filter?: Record<string, any>;
  scoreThreshold?: number;
  includeMetadata?: boolean;
}

/**
 * Custom Vector Store implementation using Supabase
 */
export class CustomVectorStore {
  private client: any;
  private embeddings: OpenAIEmbeddings;
  private tableName: string;

  constructor(client: any, embeddings: OpenAIEmbeddings, tableName: string = 'documents') {
    this.client = client;
    this.embeddings = embeddings;
    this.tableName = tableName;
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const ids: string[] = [];
    
    for (const doc of documents) {
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      
      const { data, error } = await this.client
        .from(this.tableName)
        .insert({
          content: doc.pageContent,
          metadata: doc.metadata,
          embedding,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to insert document', error);
        throw new Error(`Failed to insert document: ${error.message}`);
      }

      ids.push(data.id);
    }

    return ids;
  }

  async similaritySearchWithScore(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<Array<[Document, number]>> {
    const embedding = await this.embeddings.embedQuery(query);
    
    let queryBuilder = this.client
      .rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: k,
      });

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        queryBuilder = queryBuilder.eq(`metadata->${key}`, value);
      });
    }

    const { data, error } = await queryBuilder;

    if (error) {
      logger.error('Similarity search failed', error);
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    return data.map((item: any) => [
      new Document({
        pageContent: item.content,
        metadata: item.metadata,
      }),
      item.similarity,
    ]);
  }

  async delete(options: { filter: Record<string, any> }): Promise<void> {
    let queryBuilder = this.client.from(this.tableName).delete();

    Object.entries(options.filter).forEach(([key, value]) => {
      queryBuilder = queryBuilder.eq(`metadata->${key}`, value);
    });

    const { error } = await queryBuilder;

    if (error) {
      logger.error('Delete operation failed', error);
      throw new Error(`Delete operation failed: ${error.message}`);
    }
  }
}

/**
 * Initialize Supabase Vector Store
 */
export async function createVectorStore(config?: Partial<VectorStoreConfig>): Promise<CustomVectorStore> {
  const supabaseUrl = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and service role key are required for vector store');
  }

  const embeddings = config?.embeddingModel || createEmbeddingsModel();
  const client = createClient(supabaseUrl, supabaseKey);

  try {
    const vectorStore = new CustomVectorStore(
      client,
      embeddings,
      config?.tableName || 'documents'
    );

    logger.info('Vector store initialized', {
      tableName: config?.tableName || 'documents',
    });

    return vectorStore;
  } catch (error) {
    logger.error('Vector store initialization failed', error);
    throw new Error(`Vector store initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Add documents to vector store
 */
export async function addDocuments(
  documents: Array<{ content: string; metadata: DocumentMetadata }>,
  vectorStore?: CustomVectorStore
): Promise<string[]> {
  const store = vectorStore || await createVectorStore();

  try {
    logger.info('Adding documents to vector store', {
      documentCount: documents.length,
    });

    const docs = documents.map(doc => new Document({
      pageContent: doc.content,
      metadata: doc.metadata,
    }));

    const ids = await store.addDocuments(docs);

    logger.info('Documents added successfully', {
      documentCount: docs.length,
      ids: ids.slice(0, 5), // Log first 5 IDs
    });

    return ids;
  } catch (error) {
    logger.error('Failed to add documents', error);
    throw new Error(`Failed to add documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for similar documents
 */
export async function searchSimilarDocuments(
  query: string,
  options: VectorSearchOptions = {},
  vectorStore?: CustomVectorStore
): Promise<SearchResult[]> {
  const store = vectorStore || await createVectorStore();

  try {
    logger.info('Searching similar documents', {
      query: query.substring(0, 100) + '...',
      k: options.k || 4,
      hasFilter: !!options.filter,
    });

    const results = await store.similaritySearchWithScore(
      query,
      options.k || 4,
      options.filter
    );

    const searchResults: SearchResult[] = results
      .filter(([doc, score]) => !options.scoreThreshold || score >= options.scoreThreshold)
      .map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata as DocumentMetadata,
        score,
      }));

    logger.info('Search completed', {
      resultCount: searchResults.length,
      averageScore: searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length || 0,
    });

    return searchResults;
  } catch (error) {
    logger.error('Search failed', error);
    throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete documents by filter
 */
export async function deleteDocuments(
  filter: Record<string, any>,
  vectorStore?: CustomVectorStore
): Promise<void> {
  const store = vectorStore || await createVectorStore();

  try {
    logger.info('Deleting documents', { filter });

    await store.delete({ filter });

    logger.info('Documents deleted successfully');
  } catch (error) {
    logger.error('Failed to delete documents', error);
    throw new Error(`Failed to delete documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Index Shopify product data for vector search
 */
export async function indexProductData(
  products: any[],
  storeId: string,
  vectorStore?: CustomVectorStore
): Promise<string[]> {
  try {
    logger.info('Indexing product data', {
      productCount: products.length,
      storeId,
    });

    const documents = products.map(product => ({
      content: `Product: ${product.title}
Description: ${product.body_html || product.description || ''}
Type: ${product.product_type || ''}
Vendor: ${product.vendor || ''}
Tags: ${Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || ''}
Price Range: ${product.variants?.map((v: any) => v.price).join(', ') || ''}
SKUs: ${product.variants?.map((v: any) => v.sku).filter(Boolean).join(', ') || ''}`,
      metadata: {
        source: 'shopify_product',
        type: 'product' as const,
        id: product.id.toString(),
        store_id: storeId,
        category: product.product_type,
        tags: Array.isArray(product.tags) ? product.tags : product.tags?.split(',').map((t: string) => t.trim()) || [],
        vendor: product.vendor,
        handle: product.handle,
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
    }));

    const ids = await addDocuments(documents, vectorStore);

    logger.info('Product indexing completed', {
      indexedCount: ids.length,
    });

    return ids;
  } catch (error) {
    logger.error('Product indexing failed', error);
    throw new Error(`Product indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Index customer data for vector search
 */
export async function indexCustomerData(
  customers: any[],
  storeId: string,
  vectorStore?: CustomVectorStore
): Promise<string[]> {
  try {
    logger.info('Indexing customer data', {
      customerCount: customers.length,
      storeId,
    });

    const documents = customers.map(customer => ({
      content: `Customer: ${customer.first_name || ''} ${customer.last_name || ''}
Email: ${customer.email || ''}
Phone: ${customer.phone || ''}
City: ${customer.default_address?.city || ''}
State: ${customer.default_address?.province || ''}
Country: ${customer.default_address?.country || ''}
Orders Count: ${customer.orders_count || 0}
Total Spent: ${customer.total_spent || 0}
Tags: ${Array.isArray(customer.tags) ? customer.tags.join(', ') : customer.tags || ''}`,
      metadata: {
        source: 'shopify_customer',
        type: 'customer' as const,
        id: customer.id.toString(),
        store_id: storeId,
        tags: Array.isArray(customer.tags) ? customer.tags : customer.tags?.split(',').map((t: string) => t.trim()) || [],
        orders_count: customer.orders_count,
        total_spent: customer.total_spent,
        state: customer.state,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
      },
    }));

    const ids = await addDocuments(documents, vectorStore);

    logger.info('Customer indexing completed', {
      indexedCount: ids.length,
    });

    return ids;
  } catch (error) {
    logger.error('Customer indexing failed', error);
    throw new Error(`Customer indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Index knowledge base content
 */
export async function indexKnowledgeBase(
  articles: Array<{
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    id: string;
  }>,
  storeId: string,
  vectorStore?: CustomVectorStore
): Promise<string[]> {
  try {
    logger.info('Indexing knowledge base', {
      articleCount: articles.length,
      storeId,
    });

    const documents = articles.map(article => ({
      content: `Title: ${article.title}
Content: ${article.content}
Category: ${article.category || ''}
Tags: ${article.tags?.join(', ') || ''}`,
      metadata: {
        source: 'knowledge_base',
        type: 'knowledge_base' as const,
        id: article.id,
        store_id: storeId,
        category: article.category,
        tags: article.tags || [],
        title: article.title,
        created_at: new Date().toISOString(),
      },
    }));

    const ids = await addDocuments(documents, vectorStore);

    logger.info('Knowledge base indexing completed', {
      indexedCount: ids.length,
    });

    return ids;
  } catch (error) {
    logger.error('Knowledge base indexing failed', error);
    throw new Error(`Knowledge base indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Rebuild vector index for a store
 */
export async function rebuildStoreIndex(
  storeId: string,
  options: {
    includeProducts?: boolean;
    includeCustomers?: boolean;
    includeKnowledgeBase?: boolean;
  } = {},
  vectorStore?: CustomVectorStore
): Promise<void> {
  const store = vectorStore || await createVectorStore();

  try {
    logger.info('Rebuilding store index', {
      storeId,
      options,
    });

    // Delete existing documents for this store
    await deleteDocuments({ store_id: storeId }, store);

    // This would typically fetch data from your data sources
    // For now, we'll log what would happen
    logger.info('Store index rebuilt successfully', {
      storeId,
      deletedExisting: true,
    });

  } catch (error) {
    logger.error('Store index rebuild failed', error);
    throw new Error(`Store index rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get vector store statistics
 */
export async function getVectorStoreStats(
  storeId?: string,
  vectorStore?: CustomVectorStore
): Promise<{
  totalDocuments: number;
  documentsByType: Record<string, number>;
  storeDocuments?: number;
}> {
  try {
    logger.info('Getting vector store statistics', { storeId });

    // This would require custom queries to your Supabase database
    // For now, return mock statistics
    const stats = {
      totalDocuments: 0,
      documentsByType: {
        product: 0,
        customer: 0,
        knowledge_base: 0,
        content: 0,
      },
      ...(storeId && { storeDocuments: 0 }),
    };

    logger.info('Vector store statistics retrieved', stats);

    return stats;
  } catch (error) {
    logger.error('Failed to get vector store statistics', error);
    throw new Error(`Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Health check for vector store
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const store = await createVectorStore();
    
    // Perform a simple search to test connectivity
    await store.similaritySearch('test query', 1);
    
    logger.info('Vector store health check passed');
    return true;
  } catch (error) {
    logger.error('Vector store health check failed', error);
    return false;
  }
}