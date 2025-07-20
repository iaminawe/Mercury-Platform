import { createEmbedding } from './openai-client';
import { createEmbeddingsModel } from './langchain-setup';
import { createLogger } from '@/lib/logger';

const logger = createLogger('embedding-service');

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  tokens: number;
  model: string;
  index: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
  model: string;
  processingTime: number;
}

export interface EmbeddingCache {
  [key: string]: {
    embedding: number[];
    timestamp: number;
    model: string;
  };
}

export interface SimilarityResult {
  text: string;
  similarity: number;
  index: number;
}

// Simple in-memory cache (in production, use Redis or similar)
let embeddingCache: EmbeddingCache = {};

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(
  text: string,
  model?: string,
  useCache: boolean = true
): Promise<EmbeddingResult> {
  const embeddingModel = model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const cacheKey = `${text}_${embeddingModel}`;

  // Check cache first
  if (useCache && embeddingCache[cacheKey]) {
    const cached = embeddingCache[cacheKey];
    const cacheAge = Date.now() - cached.timestamp;
    
    // Use cache if less than 1 hour old
    if (cacheAge < 3600000) {
      logger.info('Using cached embedding', {
        textLength: text.length,
        model: embeddingModel,
        cacheAge: Math.round(cacheAge / 1000),
      });

      return {
        embedding: cached.embedding,
        text,
        tokens: Math.ceil(text.length / 4), // Approximate
        model: embeddingModel,
        index: 0,
      };
    }
  }

  try {
    logger.info('Generating embedding', {
      textLength: text.length,
      model: embeddingModel,
    });

    const startTime = Date.now();
    const response = await createEmbedding(text, embeddingModel);
    const endTime = Date.now();

    const result: EmbeddingResult = {
      embedding: response.data[0].embedding,
      text,
      tokens: response.usage.total_tokens,
      model: response.model,
      index: 0,
    };

    // Cache the result
    if (useCache) {
      embeddingCache[cacheKey] = {
        embedding: result.embedding,
        timestamp: Date.now(),
        model: result.model,
      };
    }

    logger.info('Embedding generated', {
      textLength: text.length,
      model: result.model,
      tokens: result.tokens,
      dimensions: result.embedding.length,
      processingTime: endTime - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Embedding generation failed', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateBatchEmbeddings(
  texts: string[],
  model?: string,
  batchSize: number = 100,
  useCache: boolean = true
): Promise<BatchEmbeddingResult> {
  const embeddingModel = model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  
  if (texts.length === 0) {
    throw new Error('No texts provided for embedding generation');
  }

  const startTime = Date.now();
  const results: EmbeddingResult[] = [];
  let totalTokens = 0;

  try {
    logger.info('Generating batch embeddings', {
      textCount: texts.length,
      batchSize,
      model: embeddingModel,
    });

    // Process in batches to respect API limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Check cache for each text in batch
      const uncachedTexts: string[] = [];
      const cachedResults: EmbeddingResult[] = [];

      if (useCache) {
        batch.forEach((text, batchIndex) => {
          const cacheKey = `${text}_${embeddingModel}`;
          const cached = embeddingCache[cacheKey];
          
          if (cached && (Date.now() - cached.timestamp) < 3600000) {
            cachedResults.push({
              embedding: cached.embedding,
              text,
              tokens: Math.ceil(text.length / 4),
              model: embeddingModel,
              index: i + batchIndex,
            });
          } else {
            uncachedTexts.push(text);
          }
        });
      } else {
        uncachedTexts.push(...batch);
      }

      // Generate embeddings for uncached texts
      if (uncachedTexts.length > 0) {
        const response = await createEmbedding(uncachedTexts, embeddingModel);
        
        response.data.forEach((embeddingData, dataIndex) => {
          const text = uncachedTexts[dataIndex];
          const originalIndex = texts.indexOf(text);
          
          const result: EmbeddingResult = {
            embedding: embeddingData.embedding,
            text,
            tokens: 0, // Will be updated below
            model: response.model,
            index: originalIndex,
          };

          results.push(result);

          // Cache the result
          if (useCache) {
            const cacheKey = `${text}_${embeddingModel}`;
            embeddingCache[cacheKey] = {
              embedding: result.embedding,
              timestamp: Date.now(),
              model: result.model,
            };
          }
        });

        totalTokens += response.usage.total_tokens;
      }

      // Add cached results
      results.push(...cachedResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Sort results by original index
    results.sort((a, b) => a.index - b.index);

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    logger.info('Batch embeddings completed', {
      textCount: texts.length,
      totalTokens,
      processingTime,
      averageTimePerText: processingTime / texts.length,
    });

    return {
      embeddings: results,
      totalTokens,
      model: embeddingModel,
      processingTime,
    };
  } catch (error) {
    logger.error('Batch embedding generation failed', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find most similar texts to a query
 */
export async function findSimilarTexts(
  queryText: string,
  candidateTexts: string[],
  topK: number = 5,
  model?: string,
  threshold: number = 0.7
): Promise<SimilarityResult[]> {
  try {
    logger.info('Finding similar texts', {
      queryLength: queryText.length,
      candidateCount: candidateTexts.length,
      topK,
      threshold,
    });

    // Generate embeddings for query and candidates
    const queryEmbedding = await generateEmbedding(queryText, model);
    const candidateEmbeddings = await generateBatchEmbeddings(candidateTexts, model);

    // Calculate similarities
    const similarities: SimilarityResult[] = candidateEmbeddings.embeddings.map(candidate => ({
      text: candidate.text,
      similarity: cosineSimilarity(queryEmbedding.embedding, candidate.embedding),
      index: candidate.index,
    }));

    // Filter by threshold and sort by similarity
    const filteredResults = similarities
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    logger.info('Similar texts found', {
      totalCandidates: candidateTexts.length,
      aboveThreshold: similarities.filter(s => s.similarity >= threshold).length,
      returned: filteredResults.length,
      averageSimilarity: filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length || 0,
    });

    return filteredResults;
  } catch (error) {
    logger.error('Failed to find similar texts', error);
    throw new Error(`Failed to find similar texts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cluster texts by semantic similarity
 */
export async function clusterTexts(
  texts: string[],
  clusterCount: number = 5,
  model?: string
): Promise<Array<{ texts: string[]; centroid: number[]; averageSimilarity: number }>> {
  try {
    logger.info('Clustering texts', {
      textCount: texts.length,
      clusterCount,
      model,
    });

    if (texts.length < clusterCount) {
      throw new Error('Cannot create more clusters than texts');
    }

    // Generate embeddings for all texts
    const embeddings = await generateBatchEmbeddings(texts, model);

    // Simple k-means clustering implementation
    const vectors = embeddings.embeddings.map(e => e.embedding);
    const clusters = kMeansClustering(vectors, clusterCount);

    // Map clusters back to texts
    const result = clusters.map(cluster => {
      const clusterTexts = cluster.indices.map(i => texts[i]);
      const similarities = cluster.indices.map(i => 
        cosineSimilarity(vectors[i], cluster.centroid)
      );
      const averageSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

      return {
        texts: clusterTexts,
        centroid: cluster.centroid,
        averageSimilarity,
      };
    });

    logger.info('Text clustering completed', {
      clustersCreated: result.length,
      averageClusterSize: result.reduce((sum, c) => sum + c.texts.length, 0) / result.length,
    });

    return result;
  } catch (error) {
    logger.error('Text clustering failed', error);
    throw new Error(`Failed to cluster texts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Simple k-means clustering for vectors
 */
function kMeansClustering(
  vectors: number[][],
  k: number,
  maxIterations: number = 100
): Array<{ centroid: number[]; indices: number[] }> {
  const dimensions = vectors[0].length;
  
  // Initialize centroids randomly
  let centroids = Array.from({ length: k }, () => 
    Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
  );

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign points to closest centroids
    const clusters: number[][] = Array.from({ length: k }, () => []);
    
    vectors.forEach((vector, index) => {
      let closestCentroid = 0;
      let closestDistance = Infinity;
      
      centroids.forEach((centroid, centroidIndex) => {
        const distance = 1 - cosineSimilarity(vector, centroid);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCentroid = centroidIndex;
        }
      });
      
      clusters[closestCentroid].push(index);
    });

    // Update centroids
    const newCentroids = clusters.map(cluster => {
      if (cluster.length === 0) return centroids[0]; // Fallback for empty clusters
      
      const centroid = new Array(dimensions).fill(0);
      cluster.forEach(pointIndex => {
        vectors[pointIndex].forEach((value, dim) => {
          centroid[dim] += value;
        });
      });
      
      return centroid.map(sum => sum / cluster.length);
    });

    // Check for convergence
    let hasConverged = true;
    for (let i = 0; i < k; i++) {
      if (cosineSimilarity(centroids[i], newCentroids[i]) < 0.99) {
        hasConverged = false;
        break;
      }
    }

    centroids = newCentroids;

    if (hasConverged) break;
  }

  // Return final clusters
  const finalClusters: number[][] = Array.from({ length: k }, () => []);
  
  vectors.forEach((vector, index) => {
    let closestCentroid = 0;
    let closestDistance = Infinity;
    
    centroids.forEach((centroid, centroidIndex) => {
      const distance = 1 - cosineSimilarity(vector, centroid);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCentroid = centroidIndex;
      }
    });
    
    finalClusters[closestCentroid].push(index);
  });

  return centroids.map((centroid, index) => ({
    centroid,
    indices: finalClusters[index],
  }));
}

/**
 * Clear embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache = {};
  logger.info('Embedding cache cleared');
}

/**
 * Get embedding cache statistics
 */
export function getEmbeddingCacheStats(): {
  entryCount: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
} {
  const entries = Object.values(embeddingCache);
  const timestamps = entries.map(e => e.timestamp);
  
  return {
    entryCount: entries.length,
    totalSize: entries.reduce((sum, e) => sum + e.embedding.length * 8, 0), // Approximate bytes
    oldestEntry: Math.min(...timestamps) || 0,
    newestEntry: Math.max(...timestamps) || 0,
  };
}

/**
 * Health check for embedding service
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const testEmbedding = await generateEmbedding('test', undefined, false);
    
    logger.info('Embedding service health check passed', {
      dimensions: testEmbedding.embedding.length,
      model: testEmbedding.model,
    });
    
    return testEmbedding.embedding.length > 0;
  } catch (error) {
    logger.error('Embedding service health check failed', error);
    return false;
  }
}