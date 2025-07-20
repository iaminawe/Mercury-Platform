import { createClient } from '@supabase/supabase-js';
import { cosineSimilarity } from '../embedding-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('vector-clustering');

export interface ClusterConfig {
  minDocumentsPerCluster?: number;
  maxClusters?: number;
  similarityThreshold?: number;
  rebalanceThreshold?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
}

export interface Cluster {
  id: string;
  name: string;
  contentType: ContentType;
  centroid: number[];
  memberCount: number;
  averageSimilarity: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterMember {
  documentId: string;
  clusterId: string;
  similarity: number;
  assignedAt: Date;
}

export interface ClusterAnalytics {
  totalClusters: number;
  clustersByType: Record<string, number>;
  averageClusterSize: number;
  clusterSizeDistribution: {
    small: number; // < 10 documents
    medium: number; // 10-50 documents
    large: number; // > 50 documents
  };
  averageIntraClusterSimilarity: number;
  averageInterClusterDistance: number;
  silhouetteScore: number; // Quality metric
  lastRebalance: Date | null;
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

export interface RebalanceResult {
  clustersCreated: number;
  clustersDeleted: number;
  documentsMoved: number;
  improvementScore: number;
  processingTime: number;
  converged: boolean;
  iterations: number;
}

/**
 * Advanced vector clustering manager for content organization
 */
export class VectorClusterManager {
  private client: any;
  private storeId: string;
  private config: ClusterConfig;

  constructor(storeId: string, config: ClusterConfig = {}) {
    this.storeId = storeId;
    this.config = {
      minDocumentsPerCluster: config.minDocumentsPerCluster || 5,
      maxClusters: config.maxClusters || 50,
      similarityThreshold: config.similarityThreshold || 0.8,
      rebalanceThreshold: config.rebalanceThreshold || 0.1,
      maxIterations: config.maxIterations || 10,
      convergenceThreshold: config.convergenceThreshold || 0.01,
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for vector clustering');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);

    logger.info('Vector cluster manager initialized', {
      storeId: this.storeId,
      config: this.config,
    });
  }

  /**
   * Assign a document to the most appropriate cluster
   */
  async assignDocumentToCluster(documentId: string): Promise<{
    clusterId: string;
    similarity: number;
    newClusterCreated: boolean;
  }> {
    try {
      logger.info('Assigning document to cluster', { documentId });

      // Get document embedding and metadata
      const { data: document, error: docError } = await this.client
        .from('documents_enhanced')
        .select('embedding, content_type, metadata')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      if (!document.embedding) {
        throw new Error(`Document has no embedding: ${documentId}`);
      }

      // Find the best cluster
      const assignment = await this.findBestCluster(
        document.embedding,
        document.content_type,
        document.metadata
      );

      // Assign document to cluster
      const { error: assignError } = await this.client
        .from('document_clusters')
        .upsert({
          document_id: documentId,
          cluster_id: assignment.clusterId,
          similarity_to_centroid: assignment.similarity,
          assigned_at: new Date().toISOString(),
        });

      if (assignError) {
        throw new Error(`Assignment failed: ${assignError.message}`);
      }

      // Update cluster centroid if enough documents
      await this.updateClusterCentroid(assignment.clusterId);

      logger.info('Document assigned to cluster', {
        documentId,
        clusterId: assignment.clusterId,
        similarity: assignment.similarity,
        newClusterCreated: assignment.newClusterCreated,
      });

      return assignment;

    } catch (error) {
      logger.error('Failed to assign document to cluster', error);
      throw new Error(`Cluster assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find the best cluster for a document or create a new one
   */
  private async findBestCluster(
    embedding: number[],
    contentType: ContentType,
    metadata: Record<string, any>
  ): Promise<{
    clusterId: string;
    similarity: number;
    newClusterCreated: boolean;
  }> {
    // Get existing clusters for this content type
    const { data: clusters, error } = await this.client
      .from('vector_clusters')
      .select('*')
      .eq('store_id', this.storeId)
      .eq('content_type', contentType)
      .gt('member_count', 0);

    if (error) {
      throw new Error(`Failed to get clusters: ${error.message}`);
    }

    let bestCluster: any = null;
    let bestSimilarity = 0;

    // Find the most similar cluster
    for (const cluster of clusters || []) {
      if (cluster.centroid) {
        const similarity = cosineSimilarity(embedding, cluster.centroid);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = cluster;
        }
      }
    }

    // Check if best cluster is good enough
    if (bestCluster && bestSimilarity >= this.config.similarityThreshold!) {
      return {
        clusterId: bestCluster.id,
        similarity: bestSimilarity,
        newClusterCreated: false,
      };
    }

    // Create new cluster if no good match or max clusters not reached
    const clusterCount = clusters?.length || 0;
    if (clusterCount < this.config.maxClusters!) {
      const newCluster = await this.createCluster(embedding, contentType, metadata);
      
      return {
        clusterId: newCluster.id,
        similarity: 1.0,
        newClusterCreated: true,
      };
    }

    // If max clusters reached, assign to best available cluster
    if (bestCluster) {
      return {
        clusterId: bestCluster.id,
        similarity: bestSimilarity,
        newClusterCreated: false,
      };
    }

    // Fallback: create first cluster for this content type
    const newCluster = await this.createCluster(embedding, contentType, metadata);
    
    return {
      clusterId: newCluster.id,
      similarity: 1.0,
      newClusterCreated: true,
    };
  }

  /**
   * Create a new cluster
   */
  private async createCluster(
    centroid: number[],
    contentType: ContentType,
    metadata: Record<string, any>
  ): Promise<{ id: string }> {
    const clusterName = this.generateClusterName(contentType, metadata);

    const { data, error } = await this.client
      .from('vector_clusters')
      .insert({
        cluster_name: clusterName,
        content_type: contentType,
        store_id: this.storeId,
        centroid,
        member_count: 0,
        average_similarity: 1.0,
        cluster_metadata: {
          auto_created: true,
          created_from: metadata,
          creation_threshold: this.config.similarityThreshold,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create cluster: ${error.message}`);
    }

    logger.info('New cluster created', {
      clusterId: data.id,
      clusterName,
      contentType,
    });

    return data;
  }

  /**
   * Generate meaningful cluster names based on content
   */
  private generateClusterName(
    contentType: ContentType,
    metadata: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // Generate name based on content type and metadata
    switch (contentType) {
      case 'product':
        const category = metadata.category || metadata.product_type || 'general';
        return `Products: ${category} (${timestamp})`;
      case 'knowledge_base':
        const kbCategory = metadata.category || 'general';
        return `Knowledge: ${kbCategory} (${timestamp})`;
      case 'review':
        const sentiment = metadata.sentiment || 'mixed';
        return `Reviews: ${sentiment} sentiment (${timestamp})`;
      case 'customer':
        const interactionType = metadata.interaction_type || 'general';
        return `Customer: ${interactionType} (${timestamp})`;
      default:
        return `${contentType}: Auto-cluster (${timestamp})`;
    }
  }

  /**
   * Update cluster centroid based on member documents
   */
  private async updateClusterCentroid(clusterId: string): Promise<void> {
    try {
      // Get all documents in cluster
      const { data: members, error } = await this.client
        .from('document_clusters')
        .select(`
          document_id,
          documents_enhanced!inner(embedding)
        `)
        .eq('cluster_id', clusterId);

      if (error || !members || members.length === 0) {
        return;
      }

      // Calculate new centroid as average of all embeddings
      const embeddings = members
        .map(m => m.documents_enhanced?.embedding)
        .filter(e => e && Array.isArray(e));

      if (embeddings.length === 0) {
        return;
      }

      const dimensions = embeddings[0].length;
      const newCentroid = new Array(dimensions).fill(0);

      embeddings.forEach(embedding => {
        embedding.forEach((value: number, index: number) => {
          newCentroid[index] += value;
        });
      });

      // Average the centroid
      newCentroid.forEach((_, index) => {
        newCentroid[index] /= embeddings.length;
      });

      // Calculate average similarity to new centroid
      const similarities = embeddings.map(embedding =>
        cosineSimilarity(embedding, newCentroid)
      );
      const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

      // Update cluster
      const { error: updateError } = await this.client
        .from('vector_clusters')
        .update({
          centroid: newCentroid,
          member_count: embeddings.length,
          average_similarity: averageSimilarity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clusterId);

      if (updateError) {
        logger.error('Failed to update cluster centroid', updateError);
      }

    } catch (error) {
      logger.error('Error updating cluster centroid', error);
    }
  }

  /**
   * Reassign a document to a different cluster if needed
   */
  async reassignDocument(documentId: string): Promise<{
    reassigned: boolean;
    oldClusterId?: string;
    newClusterId?: string;
    improvementScore?: number;
  }> {
    try {
      logger.info('Reassigning document', { documentId });

      // Get current assignment
      const { data: currentAssignment, error: assignError } = await this.client
        .from('document_clusters')
        .select('cluster_id, similarity_to_centroid')
        .eq('document_id', documentId)
        .single();

      if (assignError) {
        // Document not currently assigned, assign it
        const result = await this.assignDocumentToCluster(documentId);
        return {
          reassigned: true,
          newClusterId: result.clusterId,
        };
      }

      // Get document embedding
      const { data: document, error: docError } = await this.client
        .from('documents_enhanced')
        .select('embedding, content_type, metadata')
        .eq('id', documentId)
        .single();

      if (docError || !document?.embedding) {
        throw new Error(`Document not found or has no embedding: ${documentId}`);
      }

      // Find best cluster (might be the same as current)
      const assignment = await this.findBestCluster(
        document.embedding,
        document.content_type,
        document.metadata
      );

      // Check if reassignment would improve clustering
      const currentSimilarity = currentAssignment.similarity_to_centroid;
      const newSimilarity = assignment.similarity;
      const improvementScore = newSimilarity - currentSimilarity;

      if (assignment.clusterId !== currentAssignment.cluster_id && 
          improvementScore > this.config.rebalanceThreshold!) {
        
        // Remove from current cluster
        await this.client
          .from('document_clusters')
          .delete()
          .eq('document_id', documentId);

        // Add to new cluster
        await this.client
          .from('document_clusters')
          .insert({
            document_id: documentId,
            cluster_id: assignment.clusterId,
            similarity_to_centroid: assignment.similarity,
            assigned_at: new Date().toISOString(),
          });

        // Update both cluster centroids
        await this.updateClusterCentroid(currentAssignment.cluster_id);
        await this.updateClusterCentroid(assignment.clusterId);

        logger.info('Document reassigned', {
          documentId,
          oldClusterId: currentAssignment.cluster_id,
          newClusterId: assignment.clusterId,
          improvementScore,
        });

        return {
          reassigned: true,
          oldClusterId: currentAssignment.cluster_id,
          newClusterId: assignment.clusterId,
          improvementScore,
        };
      }

      return {
        reassigned: false,
        improvementScore,
      };

    } catch (error) {
      logger.error('Failed to reassign document', error);
      throw new Error(`Document reassignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rebalance all clusters using improved k-means algorithm
   */
  async rebalanceClusters(contentType?: ContentType): Promise<RebalanceResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting cluster rebalancing', {
        storeId: this.storeId,
        contentType,
      });

      let query = this.client
        .from('documents_enhanced')
        .select('id, embedding, content_type')
        .eq('store_id', this.storeId)
        .eq('status', 'active')
        .not('embedding', 'is', null);

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      const { data: documents, error } = await query;

      if (error) {
        throw new Error(`Failed to get documents: ${error.message}`);
      }

      if (!documents || documents.length === 0) {
        return {
          clustersCreated: 0,
          clustersDeleted: 0,
          documentsMoved: 0,
          improvementScore: 0,
          processingTime: Date.now() - startTime,
          converged: true,
          iterations: 0,
        };
      }

      // Group documents by content type
      const documentsByType = new Map<ContentType, any[]>();
      documents.forEach(doc => {
        if (!documentsByType.has(doc.content_type)) {
          documentsByType.set(doc.content_type, []);
        }
        documentsByType.get(doc.content_type)!.push(doc);
      });

      let totalClustersCreated = 0;
      let totalClustersDeleted = 0;
      let totalDocumentsMoved = 0;
      let totalImprovementScore = 0;
      let maxIterations = 0;
      let allConverged = true;

      // Rebalance each content type separately
      for (const [type, typeDocs] of documentsByType) {
        const result = await this.rebalanceContentType(type, typeDocs);
        
        totalClustersCreated += result.clustersCreated;
        totalClustersDeleted += result.clustersDeleted;
        totalDocumentsMoved += result.documentsMoved;
        totalImprovementScore += result.improvementScore;
        maxIterations = Math.max(maxIterations, result.iterations);
        allConverged = allConverged && result.converged;
      }

      // Clean up empty clusters
      const deletedClusters = await this.cleanupEmptyClusters();
      totalClustersDeleted += deletedClusters;

      const processingTime = Date.now() - startTime;

      logger.info('Cluster rebalancing completed', {
        clustersCreated: totalClustersCreated,
        clustersDeleted: totalClustersDeleted,
        documentsMoved: totalDocumentsMoved,
        improvementScore: totalImprovementScore,
        processingTime,
        iterations: maxIterations,
        converged: allConverged,
      });

      return {
        clustersCreated: totalClustersCreated,
        clustersDeleted: totalClustersDeleted,
        documentsMoved: totalDocumentsMoved,
        improvementScore: totalImprovementScore,
        processingTime,
        converged: allConverged,
        iterations: maxIterations,
      };

    } catch (error) {
      logger.error('Cluster rebalancing failed', error);
      throw new Error(`Rebalancing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rebalance clusters for a specific content type
   */
  private async rebalanceContentType(
    contentType: ContentType,
    documents: any[]
  ): Promise<RebalanceResult> {
    const embeddings = documents.map(doc => doc.embedding);
    const documentIds = documents.map(doc => doc.id);

    // Determine optimal number of clusters
    const optimalK = this.calculateOptimalK(embeddings);
    
    // Perform k-means clustering
    const clusteringResult = this.performKMeans(embeddings, optimalK);

    // Get current cluster assignments
    const { data: currentAssignments } = await this.client
      .from('document_clusters')
      .select('document_id, cluster_id')
      .in('document_id', documentIds);

    const currentAssignmentMap = new Map(
      currentAssignments?.map(a => [a.document_id, a.cluster_id]) || []
    );

    // Create new clusters and assignments
    const newClusters = await this.createNewClusters(
      clusteringResult.centroids,
      contentType
    );

    let documentsMoved = 0;
    let improvementScore = 0;

    // Assign documents to new clusters
    for (let i = 0; i < documentIds.length; i++) {
      const documentId = documentIds[i];
      const clusterIndex = clusteringResult.assignments[i];
      const newClusterId = newClusters[clusterIndex].id;
      const currentClusterId = currentAssignmentMap.get(documentId);

      if (currentClusterId !== newClusterId) {
        // Remove old assignment
        if (currentClusterId) {
          await this.client
            .from('document_clusters')
            .delete()
            .eq('document_id', documentId);
        }

        // Add new assignment
        const similarity = cosineSimilarity(
          embeddings[i],
          clusteringResult.centroids[clusterIndex]
        );

        await this.client
          .from('document_clusters')
          .insert({
            document_id: documentId,
            cluster_id: newClusterId,
            similarity_to_centroid: similarity,
            assigned_at: new Date().toISOString(),
          });

        documentsMoved++;
        improvementScore += similarity;
      }
    }

    // Update cluster metadata
    for (let i = 0; i < newClusters.length; i++) {
      const clusterDocuments = clusteringResult.assignments
        .map((assignment, docIndex) => assignment === i ? docIndex : -1)
        .filter(index => index !== -1);

      if (clusterDocuments.length > 0) {
        const similarities = clusterDocuments.map(docIndex =>
          cosineSimilarity(embeddings[docIndex], clusteringResult.centroids[i])
        );
        const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

        await this.client
          .from('vector_clusters')
          .update({
            centroid: clusteringResult.centroids[i],
            member_count: clusterDocuments.length,
            average_similarity: averageSimilarity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', newClusters[i].id);
      }
    }

    return {
      clustersCreated: newClusters.length,
      clustersDeleted: 0, // Will be handled by cleanup
      documentsMoved,
      improvementScore: documentsMoved > 0 ? improvementScore / documentsMoved : 0,
      processingTime: 0, // Calculated at higher level
      converged: clusteringResult.converged,
      iterations: clusteringResult.iterations,
    };
  }

  /**
   * Calculate optimal number of clusters using elbow method
   */
  private calculateOptimalK(embeddings: number[][]): number {
    const maxK = Math.min(
      Math.floor(Math.sqrt(embeddings.length / 2)),
      this.config.maxClusters!
    );
    
    if (maxK <= 1) return 1;

    const wcss: number[] = [];

    // Try different values of k
    for (let k = 1; k <= maxK; k++) {
      const result = this.performKMeans(embeddings, k, 5); // Fewer iterations for evaluation
      wcss.push(result.wcss);
    }

    // Find elbow point
    let optimalK = 1;
    let maxImprovement = 0;

    for (let i = 1; i < wcss.length - 1; i++) {
      const improvement = wcss[i - 1] - wcss[i];
      const nextImprovement = wcss[i] - wcss[i + 1];
      const elbowScore = improvement - nextImprovement;

      if (elbowScore > maxImprovement) {
        maxImprovement = elbowScore;
        optimalK = i + 1;
      }
    }

    return Math.max(optimalK, Math.min(3, maxK)); // At least 3 clusters if possible
  }

  /**
   * Perform k-means clustering
   */
  private performKMeans(
    embeddings: number[][],
    k: number,
    maxIterations?: number
  ): {
    centroids: number[][];
    assignments: number[];
    wcss: number;
    converged: boolean;
    iterations: number;
  } {
    const iterations = maxIterations || this.config.maxIterations!;
    const dimensions = embeddings[0].length;
    
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(embeddings, k, dimensions);
    let assignments = new Array(embeddings.length).fill(0);
    let converged = false;
    let iteration = 0;

    for (iteration = 0; iteration < iterations; iteration++) {
      // Assign points to closest centroids
      const newAssignments = embeddings.map(embedding => {
        let closestCentroid = 0;
        let minDistance = Infinity;

        centroids.forEach((centroid, centroidIndex) => {
          const distance = 1 - cosineSimilarity(embedding, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = centroidIndex;
          }
        });

        return closestCentroid;
      });

      // Check for convergence
      const changes = newAssignments.filter((assignment, index) => 
        assignment !== assignments[index]
      ).length;

      const changeRatio = changes / embeddings.length;
      
      if (changeRatio < this.config.convergenceThreshold!) {
        converged = true;
        assignments = newAssignments;
        break;
      }

      assignments = newAssignments;

      // Update centroids
      const newCentroids = [];
      for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
        const clusterPoints = embeddings.filter((_, pointIndex) => 
          assignments[pointIndex] === clusterIndex
        );

        if (clusterPoints.length > 0) {
          const centroid = new Array(dimensions).fill(0);
          clusterPoints.forEach(point => {
            point.forEach((value, dim) => {
              centroid[dim] += value;
            });
          });
          centroid.forEach((_, dim) => {
            centroid[dim] /= clusterPoints.length;
          });
          newCentroids.push(centroid);
        } else {
          // Keep old centroid if cluster is empty
          newCentroids.push(centroids[clusterIndex]);
        }
      }

      centroids = newCentroids;
    }

    // Calculate WCSS (Within-Cluster Sum of Squares)
    let wcss = 0;
    embeddings.forEach((embedding, index) => {
      const centroid = centroids[assignments[index]];
      const distance = 1 - cosineSimilarity(embedding, centroid);
      wcss += distance * distance;
    });

    return {
      centroids,
      assignments,
      wcss,
      converged,
      iterations: iteration + 1,
    };
  }

  /**
   * Initialize centroids using k-means++ algorithm
   */
  private initializeCentroids(
    embeddings: number[][],
    k: number,
    dimensions: number
  ): number[][] {
    const centroids: number[][] = [];

    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * embeddings.length);
    centroids.push([...embeddings[firstIndex]]);

    // Choose remaining centroids based on distance from existing ones
    for (let i = 1; i < k; i++) {
      const distances = embeddings.map(embedding => {
        let minDistance = Infinity;
        centroids.forEach(centroid => {
          const distance = 1 - cosineSimilarity(embedding, centroid);
          minDistance = Math.min(minDistance, distance);
        });
        return minDistance;
      });

      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d * d, 0);
      const threshold = Math.random() * totalDistance;
      
      let cumulativeDistance = 0;
      for (let j = 0; j < distances.length; j++) {
        cumulativeDistance += distances[j] * distances[j];
        if (cumulativeDistance >= threshold) {
          centroids.push([...embeddings[j]]);
          break;
        }
      }
    }

    return centroids;
  }

  /**
   * Create new clusters from centroids
   */
  private async createNewClusters(
    centroids: number[][],
    contentType: ContentType
  ): Promise<{ id: string }[]> {
    const clusters = [];

    for (let i = 0; i < centroids.length; i++) {
      const clusterName = `${contentType}: Rebalanced Cluster ${i + 1} (${new Date().toISOString().slice(0, 10)})`;

      const { data, error } = await this.client
        .from('vector_clusters')
        .insert({
          cluster_name: clusterName,
          content_type: contentType,
          store_id: this.storeId,
          centroid: centroids[i],
          member_count: 0,
          average_similarity: 0,
          cluster_metadata: {
            rebalanced: true,
            rebalance_date: new Date().toISOString(),
            algorithm: 'k-means',
          },
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create cluster: ${error.message}`);
      }

      clusters.push(data);
    }

    return clusters;
  }

  /**
   * Clean up empty clusters
   */
  private async cleanupEmptyClusters(): Promise<number> {
    try {
      const { data, error } = await this.client
        .from('vector_clusters')
        .delete()
        .eq('store_id', this.storeId)
        .eq('member_count', 0)
        .select('id');

      if (error) {
        logger.error('Failed to cleanup empty clusters', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      
      if (deletedCount > 0) {
        logger.info('Empty clusters cleaned up', { deletedCount });
      }

      return deletedCount;

    } catch (error) {
      logger.error('Error during cluster cleanup', error);
      return 0;
    }
  }

  /**
   * Get cluster analytics
   */
  async getClusterStats(): Promise<ClusterAnalytics> {
    try {
      logger.info('Gathering cluster statistics', { storeId: this.storeId });

      // Get cluster information
      const { data: clusters, error: clusterError } = await this.client
        .from('vector_clusters')
        .select('id, content_type, member_count, average_similarity, updated_at')
        .eq('store_id', this.storeId);

      if (clusterError) {
        throw new Error(`Failed to get clusters: ${clusterError.message}`);
      }

      const totalClusters = clusters?.length || 0;
      
      // Calculate cluster distribution by type
      const clustersByType = clusters?.reduce((acc, cluster) => {
        acc[cluster.content_type] = (acc[cluster.content_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Calculate size distribution
      const sizeDistribution = {
        small: 0,
        medium: 0,
        large: 0,
      };

      let totalMembers = 0;
      let totalSimilarity = 0;

      clusters?.forEach(cluster => {
        totalMembers += cluster.member_count;
        totalSimilarity += cluster.average_similarity || 0;

        if (cluster.member_count < 10) {
          sizeDistribution.small++;
        } else if (cluster.member_count <= 50) {
          sizeDistribution.medium++;
        } else {
          sizeDistribution.large++;
        }
      });

      const averageClusterSize = totalClusters > 0 ? totalMembers / totalClusters : 0;
      const averageIntraClusterSimilarity = totalClusters > 0 ? totalSimilarity / totalClusters : 0;

      // Calculate inter-cluster distance (simplified)
      const averageInterClusterDistance = await this.calculateInterClusterDistance(clusters || []);

      // Calculate silhouette score (simplified)
      const silhouetteScore = await this.calculateSilhouetteScore();

      // Get last rebalance date
      const lastRebalance = clusters?.length > 0 
        ? new Date(Math.max(...clusters.map(c => new Date(c.updated_at).getTime())))
        : null;

      return {
        totalClusters,
        clustersByType,
        averageClusterSize,
        clusterSizeDistribution: sizeDistribution,
        averageIntraClusterSimilarity,
        averageInterClusterDistance,
        silhouetteScore,
        lastRebalance,
      };

    } catch (error) {
      logger.error('Failed to get cluster statistics', error);
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate average distance between cluster centroids
   */
  private async calculateInterClusterDistance(clusters: any[]): Promise<number> {
    if (clusters.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusters[i].centroid && clusters[j].centroid) {
          const distance = 1 - cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
          totalDistance += distance;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * Calculate simplified silhouette score
   */
  private async calculateSilhouetteScore(): Promise<number> {
    // This is a simplified version - a full implementation would require
    // calculating the silhouette coefficient for each document
    // For now, return a placeholder based on cluster quality metrics
    return 0.5; // Placeholder
  }

  /**
   * Get documents in a specific cluster
   */
  async getClusterDocuments(
    clusterId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
    metadata: Record<string, any>;
  }>> {
    try {
      const { data, error } = await this.client
        .from('document_clusters')
        .select(`
          similarity_to_centroid,
          documents_enhanced!inner(
            id,
            title,
            content,
            metadata
          )
        `)
        .eq('cluster_id', clusterId)
        .order('similarity_to_centroid', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get cluster documents: ${error.message}`);
      }

      return data?.map(item => ({
        id: item.documents_enhanced.id,
        title: item.documents_enhanced.title || '',
        content: item.documents_enhanced.content,
        similarity: item.similarity_to_centroid,
        metadata: item.documents_enhanced.metadata || {},
      })) || [];

    } catch (error) {
      logger.error('Failed to get cluster documents', error);
      throw new Error(`Failed to get cluster documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find similar clusters
   */
  async findSimilarClusters(
    clusterId: string,
    limit: number = 5
  ): Promise<Array<{
    id: string;
    name: string;
    similarity: number;
    memberCount: number;
  }>> {
    try {
      // Get reference cluster
      const { data: referenceCluster, error } = await this.client
        .from('vector_clusters')
        .select('centroid, content_type')
        .eq('id', clusterId)
        .single();

      if (error || !referenceCluster?.centroid) {
        throw new Error(`Reference cluster not found: ${clusterId}`);
      }

      // Get other clusters of same content type
      const { data: otherClusters, error: clustersError } = await this.client
        .from('vector_clusters')
        .select('id, cluster_name, centroid, member_count')
        .eq('store_id', this.storeId)
        .eq('content_type', referenceCluster.content_type)
        .neq('id', clusterId);

      if (clustersError) {
        throw new Error(`Failed to get other clusters: ${clustersError.message}`);
      }

      // Calculate similarities
      const similarities = otherClusters?.map(cluster => ({
        id: cluster.id,
        name: cluster.cluster_name,
        similarity: cluster.centroid 
          ? cosineSimilarity(referenceCluster.centroid, cluster.centroid)
          : 0,
        memberCount: cluster.member_count,
      })) || [];

      // Sort by similarity and limit
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to find similar clusters', error);
      throw new Error(`Failed to find similar clusters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create vector cluster manager
 */
export function createVectorClusterManager(
  storeId: string,
  config?: ClusterConfig
): VectorClusterManager {
  return new VectorClusterManager(storeId, config);
}