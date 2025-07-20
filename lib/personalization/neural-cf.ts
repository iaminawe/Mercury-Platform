/**
 * Neural Collaborative Filtering
 * Deep learning approach for generating personalized recommendations
 */

import * as tf from '@tensorflow/tfjs';
import { Redis } from 'ioredis';

interface NeuralCFConfig {
  embeddingDim: number;
  hiddenLayers: number[];
  learningRate: number;
  batchSize: number;
  epochs: number;
  regularization: number;
}

interface UserItemInteraction {
  userId: string;
  itemId: string;
  rating: number;
  timestamp: Date;
  context?: Record<string, any>;
}

interface NeuralRecommendation {
  itemId: string;
  score: number;
  confidence: number;
  explanation: string;
  neuralFeatures: Float32Array;
}

export class NeuralCollaborativeFiltering {
  private static instance: NeuralCollaborativeFiltering;
  private model: tf.LayersModel | null = null;
  private userEmbeddings: Map<string, tf.Tensor> = new Map();
  private itemEmbeddings: Map<string, tf.Tensor> = new Map();
  private userIndex: Map<string, number> = new Map();
  private itemIndex: Map<string, number> = new Map();
  private config: NeuralCFConfig;
  private isTraining = false;
  private redis: Redis | null = null;

  static getInstance(redis?: Redis): NeuralCollaborativeFiltering {
    if (!NeuralCollaborativeFiltering.instance) {
      NeuralCollaborativeFiltering.instance = new NeuralCollaborativeFiltering();
      if (redis) {
        NeuralCollaborativeFiltering.instance.redis = redis;
      }
    }
    return NeuralCollaborativeFiltering.instance;
  }

  constructor() {
    this.config = {
      embeddingDim: 128,
      hiddenLayers: [256, 128, 64],
      learningRate: 0.001,
      batchSize: 256,
      epochs: 50,
      regularization: 0.01
    };
    this.initialize();
  }

  /**
   * Initialize the neural collaborative filtering model
   */
  private async initialize() {
    try {
      await tf.ready();
      await this.loadOrCreateModel();
      await this.loadEmbeddings();
    } catch (error) {
      console.error('Failed to initialize Neural CF:', error);
    }
  }

  /**
   * Get neural recommendations for a user
   */
  async getNeuralRecommendations(
    userId: string,
    context: any,
    options: {
      limit?: number;
      excludeViewed?: boolean;
      categoryFilter?: string[];
      includeExplanations?: boolean;
    } = {}
  ): Promise<NeuralRecommendation[]> {
    if (!this.model || this.isTraining) {
      return this.getFallbackRecommendations(userId, options.limit || 10);
    }

    const userIdx = this.userIndex.get(userId);
    if (userIdx === undefined) {
      // Cold start - use content-based approach
      return this.getColdStartRecommendations(context, options.limit || 10);
    }

    // Get all items for scoring
    const items = Array.from(this.itemIndex.keys());
    const recommendations: NeuralRecommendation[] = [];

    // Batch prediction for efficiency
    const batchSize = 1000;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchRecs = await this.predictBatch(userIdx, batch, context);
      recommendations.push(...batchRecs);
    }

    // Sort by score and apply filters
    let filteredRecs = recommendations
      .sort((a, b) => b.score - a.score);

    // Apply category filter
    if (options.categoryFilter && options.categoryFilter.length > 0) {
      filteredRecs = filteredRecs.filter(rec => 
        this.itemBelongsToCategory(rec.itemId, options.categoryFilter!)
      );
    }

    // Exclude viewed items
    if (options.excludeViewed) {
      const viewedItems = await this.getUserViewedItems(userId);
      filteredRecs = filteredRecs.filter(rec => 
        !viewedItems.includes(rec.itemId)
      );
    }

    // Add explanations if requested
    if (options.includeExplanations) {
      for (const rec of filteredRecs.slice(0, options.limit || 10)) {
        rec.explanation = await this.generateExplanation(userId, rec);
      }
    }

    return filteredRecs.slice(0, options.limit || 10);
  }

  /**
   * Train the neural collaborative filtering model
   */
  async trainModel(interactions: UserItemInteraction[]): Promise<{
    loss: number;
    accuracy: number;
    trainingTime: number;
  }> {
    const startTime = Date.now();
    this.isTraining = true;

    try {
      // Prepare training data
      const { userIds, itemIds, ratings, features } = this.prepareTrainingData(interactions);
      
      // Build indices
      this.buildIndices(userIds, itemIds);
      
      // Create model if not exists
      if (!this.model) {
        this.model = this.createNeuralCFModel();
      }

      // Prepare tensors
      const userTensor = tf.tensor1d(userIds.map(id => this.userIndex.get(id)!), 'int32');
      const itemTensor = tf.tensor1d(itemIds.map(id => this.itemIndex.get(id)!), 'int32');
      const ratingTensor = tf.tensor1d(ratings);
      const featureTensor = tf.tensor2d(features);

      // Training configuration
      const validationSplit = 0.2;
      const callbacks = {
        onEpochEnd: (epoch: number, logs: any) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs.loss}, val_loss = ${logs.val_loss}`);
        }
      };

      // Train model
      const history = await this.model.fit(
        [userTensor, itemTensor, featureTensor],
        ratingTensor,
        {
          epochs: this.config.epochs,
          batchSize: this.config.batchSize,
          validationSplit,
          callbacks,
          shuffle: true
        }
      );

      // Extract embeddings
      await this.extractEmbeddings();

      // Save model and embeddings
      await this.saveModel();
      await this.saveEmbeddings();

      // Cleanup tensors
      userTensor.dispose();
      itemTensor.dispose();
      ratingTensor.dispose();
      featureTensor.dispose();

      const trainingTime = Date.now() - startTime;
      const finalLoss = history.history.loss[history.history.loss.length - 1];
      const finalAccuracy = history.history.acc ? history.history.acc[history.history.acc.length - 1] : 0;

      return {
        loss: finalLoss,
        accuracy: finalAccuracy,
        trainingTime
      };
    } catch (error) {
      console.error('Neural CF training failed:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Update model with new interaction
   */
  async updateWithInteraction(interaction: UserItemInteraction): Promise<void> {
    if (this.isTraining) return;

    // Store interaction for batch retraining
    if (this.redis) {
      await this.redis.lpush('neural_cf:interactions', JSON.stringify(interaction));
      await this.redis.ltrim('neural_cf:interactions', 0, 9999); // Keep last 10k
    }

    // Check if retraining is needed
    const interactionCount = this.redis ? await this.redis.llen('neural_cf:interactions') : 0;
    if (interactionCount > 1000 && interactionCount % 100 === 0) {
      // Schedule retraining
      this.scheduleRetraining();
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(): Promise<{
    modelSize: number;
    embeddingDimension: number;
    userCount: number;
    itemCount: number;
    lastTraining: Date | null;
    accuracy: number;
    coverage: number;
  }> {
    return {
      modelSize: this.model ? this.model.countParams() : 0,
      embeddingDimension: this.config.embeddingDim,
      userCount: this.userIndex.size,
      itemCount: this.itemIndex.size,
      lastTraining: await this.getLastTrainingTime(),
      accuracy: await this.getModelAccuracy(),
      coverage: await this.getRecommendationCoverage()
    };
  }

  // Private methods

  private async loadOrCreateModel(): Promise<void> {
    try {
      // Try to load existing model
      if (this.redis) {
        const modelData = await this.redis.get('neural_cf:model');
        if (modelData) {
          this.model = await tf.loadLayersModel(tf.io.fromMemory(JSON.parse(modelData)));
          return;
        }
      }
    } catch (error) {
      console.log('No existing model found, creating new one');
    }

    // Create new model
    this.model = this.createNeuralCFModel();
  }

  private createNeuralCFModel(): tf.LayersModel {
    // User input
    const userInput = tf.input({ shape: [], dtype: 'int32', name: 'user_input' });
    const userEmbedding = tf.layers.embedding({
      inputDim: 10000, // Max users
      outputDim: this.config.embeddingDim,
      inputLength: 1,
      name: 'user_embedding'
    }).apply(userInput) as tf.SymbolicTensor;

    // Item input
    const itemInput = tf.input({ shape: [], dtype: 'int32', name: 'item_input' });
    const itemEmbedding = tf.layers.embedding({
      inputDim: 50000, // Max items
      outputDim: this.config.embeddingDim,
      inputLength: 1,
      name: 'item_embedding'
    }).apply(itemInput) as tf.SymbolicTensor;

    // Feature input
    const featureInput = tf.input({ shape: [20], name: 'feature_input' });

    // Flatten embeddings
    const userFlat = tf.layers.flatten().apply(userEmbedding) as tf.SymbolicTensor;
    const itemFlat = tf.layers.flatten().apply(itemEmbedding) as tf.SymbolicTensor;

    // Concatenate all inputs
    const concat = tf.layers.concatenate().apply([userFlat, itemFlat, featureInput]) as tf.SymbolicTensor;

    // Deep neural network
    let dense = concat;
    for (const units of this.config.hiddenLayers) {
      dense = tf.layers.dense({
        units,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: this.config.regularization })
      }).apply(dense) as tf.SymbolicTensor;
      
      dense = tf.layers.dropout({ rate: 0.2 }).apply(dense) as tf.SymbolicTensor;
    }

    // Output layer
    const output = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'output'
    }).apply(dense) as tf.SymbolicTensor;

    // Create model
    const model = tf.model({
      inputs: [userInput, itemInput, featureInput],
      outputs: output
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  private prepareTrainingData(interactions: UserItemInteraction[]): {
    userIds: string[];
    itemIds: string[];
    ratings: number[];
    features: number[][];
  } {
    const userIds: string[] = [];
    const itemIds: string[] = [];
    const ratings: number[] = [];
    const features: number[][] = [];

    for (const interaction of interactions) {
      userIds.push(interaction.userId);
      itemIds.push(interaction.itemId);
      ratings.push(interaction.rating);
      
      // Extract contextual features
      const featureVector = this.extractContextualFeatures(interaction);
      features.push(featureVector);
    }

    return { userIds, itemIds, ratings, features };
  }

  private extractContextualFeatures(interaction: UserItemInteraction): number[] {
    const features = new Array(20).fill(0);
    
    // Time features
    const hour = interaction.timestamp.getHours();
    features[0] = hour / 24;
    features[1] = interaction.timestamp.getDay() / 7;
    features[2] = interaction.timestamp.getMonth() / 12;

    // Rating features
    features[3] = interaction.rating / 5;
    
    // Context features
    if (interaction.context) {
      features[4] = interaction.context.device === 'mobile' ? 1 : 0;
      features[5] = interaction.context.device === 'desktop' ? 1 : 0;
      features[6] = interaction.context.referrer === 'search' ? 1 : 0;
      features[7] = interaction.context.referrer === 'social' ? 1 : 0;
      
      // Category features (top categories)
      const categories = ['electronics', 'fashion', 'home', 'sports', 'beauty'];
      categories.forEach((cat, idx) => {
        features[8 + idx] = interaction.context?.category === cat ? 1 : 0;
      });
    }

    return features;
  }

  private buildIndices(userIds: string[], itemIds: string[]): void {
    // Build user index
    const uniqueUsers = [...new Set(userIds)];
    uniqueUsers.forEach((userId, idx) => {
      this.userIndex.set(userId, idx);
    });

    // Build item index
    const uniqueItems = [...new Set(itemIds)];
    uniqueItems.forEach((itemId, idx) => {
      this.itemIndex.set(itemId, idx);
    });
  }

  private async predictBatch(
    userIdx: number,
    items: string[],
    context: any
  ): Promise<NeuralRecommendation[]> {
    if (!this.model) return [];

    const itemIndices = items
      .map(item => this.itemIndex.get(item))
      .filter(idx => idx !== undefined) as number[];

    if (itemIndices.length === 0) return [];

    // Prepare input tensors
    const userTensor = tf.fill([itemIndices.length], userIdx, 'int32');
    const itemTensor = tf.tensor1d(itemIndices, 'int32');
    const featureTensor = tf.tensor2d(
      itemIndices.map(() => this.extractContextualFeatures({
        userId: '',
        itemId: '',
        rating: 0,
        timestamp: new Date(),
        context
      }))
    );

    // Predict
    const predictions = this.model.predict([userTensor, itemTensor, featureTensor]) as tf.Tensor;
    const scores = await predictions.data();

    // Cleanup
    userTensor.dispose();
    itemTensor.dispose();
    featureTensor.dispose();
    predictions.dispose();

    // Create recommendations
    const recommendations: NeuralRecommendation[] = [];
    for (let i = 0; i < itemIndices.length; i++) {
      const itemId = items[items.findIndex(item => this.itemIndex.get(item) === itemIndices[i])];
      const score = scores[i];
      
      recommendations.push({
        itemId,
        score,
        confidence: this.calculateConfidence(score, userIdx, itemIndices[i]),
        explanation: '',
        neuralFeatures: new Float32Array([score, userIdx, itemIndices[i]])
      });
    }

    return recommendations;
  }

  private calculateConfidence(score: number, userIdx: number, itemIdx: number): number {
    // Calculate confidence based on score and embedding quality
    const baseConfidence = Math.abs(score - 0.5) * 2; // Distance from neutral
    
    // Adjust based on user/item popularity (more data = higher confidence)
    const userPopularity = Math.min(1, (userIdx + 1) / this.userIndex.size);
    const itemPopularity = Math.min(1, (itemIdx + 1) / this.itemIndex.size);
    
    return baseConfidence * 0.7 + (userPopularity + itemPopularity) * 0.15;
  }

  private async generateExplanation(userId: string, rec: NeuralRecommendation): Promise<string> {
    // Generate explanation based on neural features and user history
    const explanations = [
      'Based on users with similar preferences',
      'Recommended by our deep learning model',
      'Similar to items you\'ve liked before',
      'Trending among users like you',
      'Matches your interaction patterns'
    ];

    // Use neural features to select explanation
    const idx = Math.floor(rec.neuralFeatures[0] * explanations.length);
    return explanations[Math.min(idx, explanations.length - 1)];
  }

  private async getFallbackRecommendations(userId: string, limit: number): Promise<NeuralRecommendation[]> {
    // Return popular items as fallback
    const popularItems = ['item_001', 'item_002', 'item_003', 'item_004', 'item_005'];
    
    return popularItems.slice(0, limit).map(itemId => ({
      itemId,
      score: 0.7 + Math.random() * 0.3,
      confidence: 0.5,
      explanation: 'Popular recommendation',
      neuralFeatures: new Float32Array([0.7, 0, 0])
    }));
  }

  private async getColdStartRecommendations(context: any, limit: number): Promise<NeuralRecommendation[]> {
    // Content-based recommendations for new users
    const contentRecs = ['content_001', 'content_002', 'content_003'];
    
    return contentRecs.slice(0, limit).map(itemId => ({
      itemId,
      score: 0.6 + Math.random() * 0.2,
      confidence: 0.4,
      explanation: 'Content-based recommendation for new user',
      neuralFeatures: new Float32Array([0.6, -1, 0])
    }));
  }

  private async extractEmbeddings(): Promise<void> {
    if (!this.model) return;

    // Extract user embeddings
    const userEmbeddingLayer = this.model.getLayer('user_embedding') as tf.layers.Layer;
    // Extract item embeddings
    const itemEmbeddingLayer = this.model.getLayer('item_embedding') as tf.layers.Layer;

    // Store embeddings (simplified - in production would extract weights)
    // This is a placeholder for the actual embedding extraction
  }

  private async loadEmbeddings(): Promise<void> {
    if (!this.redis) return;

    try {
      const userEmbeddings = await this.redis.get('neural_cf:user_embeddings');
      const itemEmbeddings = await this.redis.get('neural_cf:item_embeddings');
      
      if (userEmbeddings) {
        // Load user embeddings
      }
      
      if (itemEmbeddings) {
        // Load item embeddings
      }
    } catch (error) {
      console.log('No existing embeddings found');
    }
  }

  private async saveModel(): Promise<void> {
    if (!this.model || !this.redis) return;

    try {
      const modelData = await this.model.save(tf.io.withSaveHandler(async (artifacts) => artifacts));
      await this.redis.set('neural_cf:model', JSON.stringify(modelData));
      await this.redis.set('neural_cf:last_training', Date.now().toString());
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  }

  private async saveEmbeddings(): Promise<void> {
    if (!this.redis) return;

    // Save embeddings to Redis
    // Implementation would serialize and store embeddings
  }

  private itemBelongsToCategory(itemId: string, categories: string[]): boolean {
    // In production, this would check item categories
    return true; // Placeholder
  }

  private async getUserViewedItems(userId: string): Promise<string[]> {
    if (!this.redis) return [];
    
    const viewed = await this.redis.lrange(`user:${userId}:viewed`, 0, -1);
    return viewed;
  }

  private scheduleRetraining(): void {
    // Schedule background retraining
    setTimeout(async () => {
      if (this.isTraining) return;
      
      try {
        if (this.redis) {
          const interactions = await this.redis.lrange('neural_cf:interactions', 0, -1);
          const parsedInteractions = interactions.map(i => JSON.parse(i));
          await this.trainModel(parsedInteractions);
        }
      } catch (error) {
        console.error('Scheduled retraining failed:', error);
      }
    }, 5000); // 5 second delay
  }

  private async getLastTrainingTime(): Promise<Date | null> {
    if (!this.redis) return null;
    
    const timestamp = await this.redis.get('neural_cf:last_training');
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }

  private async getModelAccuracy(): Promise<number> {
    // Return cached accuracy from last training
    if (!this.redis) return 0;
    
    const accuracy = await this.redis.get('neural_cf:accuracy');
    return accuracy ? parseFloat(accuracy) : 0;
  }

  private async getRecommendationCoverage(): Promise<number> {
    // Calculate what percentage of items the model can recommend
    return this.itemIndex.size > 0 ? Math.min(1, this.itemIndex.size / 50000) : 0;
  }
}

export const neuralCollaborativeFiltering = NeuralCollaborativeFiltering.getInstance();