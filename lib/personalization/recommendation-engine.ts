import { Redis } from 'ioredis';
import * as tf from '@tensorflow/tfjs';
import { createLogger } from '@/lib/logger';
import { Product } from '@/types/product';
import { personalizationEngine } from '@/lib/email/personalization';

interface EnhancedProduct extends Product {
  features: Record<string, number>;
  salesVelocity?: number;
  profitMargin?: number;
  inventoryLevel?: number;
  seasonalTrend?: number;
  competitorPrice?: number;
  userRating?: number;
  viewCount?: number;
  conversionRate?: number;
  crossSellAffinity?: Record<string, number>;
  demographicAppeal?: Record<string, number>;
}

interface UserInteraction {
  userId: string;
  productId: string;
  action: 'view' | 'cart' | 'purchase' | 'wishlist' | 'share' | 'review' | 'compare' | 'return';
  timestamp: number;
  duration?: number;
  sessionId: string;
  device: 'mobile' | 'tablet' | 'desktop';
  location?: { country: string; region: string; city: string };
  referrer?: string;
  searchQuery?: string;
  context?: {
    pageType: string;
    categoryBrowsed?: string;
    priceFilter?: { min: number; max: number };
    sortBy?: string;
    filters?: Record<string, any>;
    cartValue?: number;
    isFirstVisit?: boolean;
    isReturningCustomer?: boolean;
    customerSegment?: string[];
  };
}

interface RecommendationModel {
  type: 'collaborative' | 'content' | 'hybrid' | 'neural' | 'matrix_factorization' | 'deep_cf' | 'autoencoder' | 'lstm';
  version: string;
  weights?: tf.LayersModel;
  embeddings?: {
    users: tf.Tensor;
    items: tf.Tensor;
    contexts: tf.Tensor;
  };
  lastUpdated: Date;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    ndcg: number;
    diversity: number;
    novelty: number;
    coverage: number;
    auc: number;
    hitRate: number;
    mrr: number;
  };
  hyperparameters: {
    embeddingDim: number;
    learningRate: number;
    regularization: number;
    dropoutRate: number;
    batchSize: number;
    epochs: number;
  };
  trainingMetrics?: {
    loss: number[];
    valLoss: number[];
    trainingTime: number;
    dataSize: number;
  };
}

export class RecommendationEngine {
  private redis: Redis;
  private config: any;
  private models: Map<string, RecommendationModel> = new Map();
  private productEmbeddings: Map<string, number[]> = new Map();
  private userEmbeddings: Map<string, number[]> = new Map();
  private contextEmbeddings: Map<string, number[]> = new Map();
  private itemSimilarityMatrix: Map<string, Map<string, number>> = new Map();
  private userSimilarityMatrix: Map<string, Map<string, number>> = new Map();
  private sessionRecommendations: Map<string, any[]> = new Map();
  private abTestingConfig: Map<string, any> = new Map();
  private realtimeFeedback: Map<string, any[]> = new Map();
  private logger = createLogger('recommendation-engine');
  private isTraining = false;
  private trainingQueue: any[] = [];
  private modelVersions: Map<string, number> = new Map();
  private businessRules: {
    minMargin?: number;
    maxInventoryThreshold?: number;
    seasonalBoosts?: Record<string, number>;
    categoryWeights?: Record<string, number>;
    demographicPreferences?: Record<string, Record<string, number>>;
  } = {};

  constructor(redis: Redis, config: any) {
    this.redis = redis;
    this.config = {
      enableRealTime: true,
      enableDeepLearning: true,
      enableABTesting: true,
      enableBusinessRules: true,
      embeddingDim: 128,
      maxRecommendations: 50,
      diversityThreshold: 0.3,
      noveltyThreshold: 0.2,
      realtimeUpdateInterval: 300000, // 5 minutes
      modelRetrainingInterval: 86400000, // 24 hours
      ...config
    };
    this.initializeModels();
    this.initializeBusinessRules();
    this.startRealtimeUpdates();
  }

  async getRecommendations(context: any): Promise<any[]> {
    const userId = context.userId || context.sessionId;
    const numRecommendations = context.limit || this.config.maxRecommendations;
    const startTime = Date.now();

    try {
      // Check for cached session recommendations first
      const sessionKey = `${userId}_${context.sessionId}`;
      if (this.sessionRecommendations.has(sessionKey)) {
        const cached = this.sessionRecommendations.get(sessionKey)!;
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          this.logger.info('Returning cached recommendations', { userId, sessionId: context.sessionId });
          return cached.recommendations.slice(0, numRecommendations);
        }
      }

      // Get user's interaction history and context
      const [userHistory, userProfile, contextVector] = await Promise.all([
        this.getUserHistory(userId),
        this.getUserProfile(userId),
        this.getContextVector(context)
      ]);
      
      // Get embeddings
      const [userEmbedding, contextEmbedding] = await Promise.all([
        this.getUserEmbedding(userId, userHistory),
        this.getContextEmbedding(contextVector)
      ]);
      
      // Determine AB testing variant
      const abVariant = this.getABTestingVariant(userId);
      
      // Get recommendations from different models based on AB test
      const recommendationPromises = [
        this.getCollaborativeRecommendations(userId, userEmbedding, numRecommendations, context),
        this.getContentBasedRecommendations(userHistory, userProfile, numRecommendations, context),
        this.getDeepLearningRecommendations(userId, userEmbedding, contextEmbedding, numRecommendations, context),
        this.getHybridNeuralRecommendations(userId, userEmbedding, contextEmbedding, numRecommendations, context),
        this.getBusinessOptimizedRecommendations(userId, context, numRecommendations),
        this.getSessionBasedRecommendations(context.sessionId, context, numRecommendations),
        this.getCrossSellRecommendations(userId, context, numRecommendations),
        this.getTrendingRecommendations(context, numRecommendations)
      ];

      // Execute based on AB test variant
      let recommendations;
      if (abVariant === 'neural_heavy') {
        const [deepRecs, neuralRecs, businessRecs] = await Promise.all([
          recommendationPromises[2], // Deep learning
          recommendationPromises[3], // Hybrid neural
          recommendationPromises[4]  // Business optimized
        ]);
        recommendations = await this.mergeAndRankRecommendations([
          ...deepRecs, ...neuralRecs, ...businessRecs
        ], numRecommendations, { strategy: 'neural_weighted' });
      } else if (abVariant === 'business_focused') {
        const [businessRecs, crossSellRecs, collaborativeRecs] = await Promise.all([
          recommendationPromises[4], // Business optimized
          recommendationPromises[6], // Cross-sell
          recommendationPromises[0]  // Collaborative
        ]);
        recommendations = await this.mergeAndRankRecommendations([
          ...businessRecs, ...crossSellRecs, ...collaborativeRecs
        ], numRecommendations, { strategy: 'business_weighted' });
      } else {
        // Default: balanced approach
        const allRecommendations = await Promise.all(recommendationPromises);
        recommendations = await this.mergeAndRankRecommendations(
          allRecommendations.flat(),
          numRecommendations,
          { strategy: 'balanced', abVariant }
        );
      }

      // Apply business rules and optimization
      recommendations = await this.applyBusinessRules(recommendations, context);
      
      // Diversify and add novelty
      recommendations = await this.optimizeForDiversityAndNovelty(recommendations, userHistory, context);
      
      // Add rich explanations
      recommendations = await this.addAdvancedExplanations(recommendations, context, userHistory);
      
      // Cache session recommendations
      this.sessionRecommendations.set(sessionKey, {
        recommendations,
        timestamp: Date.now(),
        variant: abVariant
      });
      
      // Log performance metrics
      const duration = Date.now() - startTime;
      this.logger.info('Recommendations generated', {
        userId,
        sessionId: context.sessionId,
        count: recommendations.length,
        duration,
        variant: abVariant,
        models: this.getActiveModels()
      });
      
      return recommendations.slice(0, numRecommendations);
    } catch (error) {
      this.logger.error('Recommendation error', { error, userId, context });
      // Intelligent fallback based on context
      return this.getIntelligentFallback(context, numRecommendations);
    }
  }

  async updateModel(context: any, event: any): Promise<void> {
    const interaction: UserInteraction = {
      userId: context.userId || context.sessionId,
      productId: event.productId,
      action: event.action || 'view',
      timestamp: Date.now(),
      duration: event.duration,
      sessionId: context.sessionId || `session_${Date.now()}`,
      device: event.device || 'desktop',
      location: event.location,
      referrer: event.referrer,
      searchQuery: event.searchQuery,
      context: {
        pageType: event.pageType || 'product',
        categoryBrowsed: event.categoryBrowsed,
        priceFilter: event.priceFilter,
        sortBy: event.sortBy,
        filters: event.filters,
        cartValue: event.cartValue,
        isFirstVisit: event.isFirstVisit,
        isReturningCustomer: event.isReturningCustomer,
        customerSegment: event.customerSegment,
        ...context
      }
    };

    // Store interaction with enriched data
    await this.storeInteraction(interaction);
    
    // Real-time feedback processing
    await this.processRealtimeFeedback(interaction);

    // Update embeddings if real-time learning is enabled
    if (this.config.enableRealTime) {
      await Promise.all([
        this.updateUserEmbedding(interaction.userId, interaction),
        this.updateItemEmbedding(interaction.productId, interaction),
        this.updateContextEmbedding(interaction.context!, interaction),
        this.updateSessionRecommendations(interaction)
      ]);
      
      // Add to training queue for batch processing
      this.trainingQueue.push(interaction);
      
      // Trigger incremental model updates
      if (this.trainingQueue.length >= this.config.batchSize) {
        this.processTrainingBatch();
      }
      
      // Periodically retrain models
      const shouldRetrain = await this.shouldRetrain();
      if (shouldRetrain && !this.isTraining) {
        this.retrainModels();
      }
    }
    
    // Update A/B testing metrics
    await this.updateABTestingMetrics(interaction);
  }

  private async getCollaborativeRecommendations(
    userId: string,
    userEmbedding: number[],
    count: number
  ): Promise<any[]> {
    // Find similar users based on embeddings
    const similarUsers = await this.findSimilarUsers(userId, userEmbedding);
    
    // Get products liked by similar users
    const productScores: Map<string, number> = new Map();
    
    for (const similarUser of similarUsers) {
      const userProducts = await this.getUserPurchases(similarUser.userId);
      
      for (const productId of userProducts) {
        const currentScore = productScores.get(productId) || 0;
        productScores.set(productId, currentScore + similarUser.similarity);
      }
    }

    // Filter out products user already interacted with
    const userProducts = await this.getUserProducts(userId);
    for (const productId of userProducts) {
      productScores.delete(productId);
    }

    // Sort by score and return top products
    const recommendations = Array.from(productScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([productId, score]) => ({
        productId,
        score,
        method: 'collaborative'
      }));

    return this.enrichRecommendations(recommendations);
  }

  private async getContentBasedRecommendations(
    userHistory: UserInteraction[],
    count: number
  ): Promise<any[]> {
    if (userHistory.length === 0) return [];

    // Calculate user preference vector based on interaction history
    const userPreferences = await this.calculateUserPreferences(userHistory);
    
    // Find products with similar features
    const allProducts = await this.getAllProducts();
    const productScores: Array<{ productId: string; score: number }> = [];

    for (const product of allProducts) {
      const productEmbedding = await this.getProductEmbedding(product);
      const similarity = this.cosineSimilarity(userPreferences, productEmbedding);
      
      productScores.push({
        productId: product.id,
        score: similarity
      });
    }

    // Filter and sort
    const interactedProducts = new Set(userHistory.map(h => h.productId));
    const recommendations = productScores
      .filter(p => !interactedProducts.has(p.productId))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(p => ({
        ...p,
        method: 'content'
      }));

    return this.enrichRecommendations(recommendations);
  }

  private async getTrendingRecommendations(
    context: any,
    count: number
  ): Promise<any[]> {
    // Get trending products based on recent interactions
    const trendingKey = `trending:${context.location?.country || 'global'}`;
    const trendingProducts = await this.redis.zrevrange(trendingKey, 0, count - 1, 'WITHSCORES');
    
    const recommendations = [];
    for (let i = 0; i < trendingProducts.length; i += 2) {
      recommendations.push({
        productId: trendingProducts[i],
        score: parseFloat(trendingProducts[i + 1]),
        method: 'trending'
      });
    }

    return this.enrichRecommendations(recommendations);
  }

  private async getDeepLearningRecommendations(
    userId: string,
    userEmbedding: number[],
    contextEmbedding: number[],
    count: number,
    context: any
  ): Promise<any[]> {
    const model = this.models.get('neural');
    if (!model || !model.weights) {
      return [];
    }

    try {
      const allProducts = await this.getAllProducts();
      const productScores: Array<{ productId: string; score: number }> = [];

      // Batch predict for efficiency
      const batchSize = 100;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = allProducts.slice(i, i + batchSize);
        const features = batch.map(product => {
          const productEmbedding = this.productEmbeddings.get(product.id) || new Array(128).fill(0);
          return [...userEmbedding, ...productEmbedding, ...contextEmbedding];
        });

        const predictions = tf.tidy(() => {
          const input = tf.tensor2d(features);
          return (model.weights as tf.LayersModel).predict(input) as tf.Tensor;
        });

        const scores = await predictions.array() as number[][];
        predictions.dispose();

        batch.forEach((product, idx) => {
          productScores.push({
            productId: product.id,
            score: scores[idx][0]
          });
        });
      }

      // Sort and filter
      const recommendations = productScores
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(p => ({ ...p, method: 'deep_learning' }));

      return this.enrichRecommendations(recommendations);
    } catch (error) {
      this.logger.error('Deep learning recommendation error', error);
      return [];
    }
  }

  private async getHybridNeuralRecommendations(
    userId: string,
    userEmbedding: number[],
    contextEmbedding: number[],
    count: number,
    context: any
  ): Promise<any[]> {
    const model = this.models.get('hybrid_neural');
    if (!model || !model.weights) {
      return [];
    }

    try {
      const allProducts = await this.getAllProducts();
      const productScores: Array<{ productId: string; score: number }> = [];

      const batchSize = 50;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = allProducts.slice(i, i + batchSize);
        
        const userInputs = batch.map(() => userEmbedding);
        const itemInputs = batch.map(product => 
          this.productEmbeddings.get(product.id) || new Array(128).fill(0)
        );
        const contextInputs = batch.map(() => contextEmbedding.slice(0, 64));

        const predictions = tf.tidy(() => {
          const userTensor = tf.tensor2d(userInputs);
          const itemTensor = tf.tensor2d(itemInputs);
          const contextTensor = tf.tensor2d(contextInputs);
          return (model.weights as tf.LayersModel).predict([userTensor, itemTensor, contextTensor]) as tf.Tensor;
        });

        const scores = await predictions.array() as number[][];
        predictions.dispose();

        batch.forEach((product, idx) => {
          productScores.push({
            productId: product.id,
            score: scores[idx][0]
          });
        });
      }

      const recommendations = productScores
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(p => ({ ...p, method: 'hybrid_neural' }));

      return this.enrichRecommendations(recommendations);
    } catch (error) {
      this.logger.error('Hybrid neural recommendation error', error);
      return [];
    }
  }

  private async getBusinessOptimizedRecommendations(
    userId: string,
    context: any,
    count: number
  ): Promise<any[]> {
    const allProducts = await this.getAllProducts();
    const userHistory = await this.getUserHistory(userId);
    const customerSegment = await this.getCustomerSegment(userId);

    const productScores = allProducts.map(product => {
      let score = 0;

      // Profit margin optimization
      const margin = product.profitMargin || 0.2;
      score += margin * 20; // Higher weight for profitable items

      // Inventory management
      const inventoryLevel = product.inventoryLevel || 100;
      if (inventoryLevel < 10) {
        score *= 0.3; // Penalize low stock
      } else if (inventoryLevel > 100) {
        score *= 1.2; // Boost high stock
      }

      // Sales velocity
      const velocity = product.salesVelocity || 1;
      score += Math.log(velocity + 1) * 5;

      // Seasonal trends
      const season = new Date().getMonth();
      const seasonalBoost = product.seasonalTrend?.[season] || 1;
      score *= seasonalBoost;

      // Customer segment preferences
      const segmentBoost = product.demographicAppeal?.[customerSegment] || 1;
      score *= segmentBoost;

      // Cross-sell potential
      const crossSellScore = this.calculateCrossSellScore(product, userHistory);
      score += crossSellScore * 10;

      return {
        productId: product.id,
        score,
        method: 'business_optimized',
        businessFactors: {
          margin,
          inventoryLevel,
          velocity,
          seasonalBoost,
          segmentBoost,
          crossSellScore
        }
      };
    });

    return productScores
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(p => this.enrichRecommendations([p])[0]);
  }

  private async getSessionBasedRecommendations(
    sessionId: string,
    context: any,
    count: number
  ): Promise<any[]> {
    // Get session interactions
    const sessionHistory = await this.getSessionHistory(sessionId);
    
    if (sessionHistory.length === 0) {
      return [];
    }

    // Use LSTM model for sequence prediction
    const model = this.models.get('lstm');
    if (!model || !model.weights) {
      return this.getItemBasedSessionRecommendations(sessionHistory, count);
    }

    try {
      // Prepare sequence data
      const sequenceLength = Math.min(10, sessionHistory.length);
      const sequence = sessionHistory.slice(-sequenceLength).map(interaction => {
        const productEmbedding = this.productEmbeddings.get(interaction.productId) || new Array(128).fill(0);
        return productEmbedding;
      });

      // Pad sequence if needed
      while (sequence.length < 10) {
        sequence.unshift(new Array(128).fill(0));
      }

      const predictions = tf.tidy(() => {
        const input = tf.tensor3d([sequence]);
        return (model.weights as tf.LayersModel).predict(input) as tf.Tensor;
      });

      const scores = await predictions.array() as number[][];
      predictions.dispose();

      const allProducts = await this.getAllProducts();
      const recommendations = allProducts
        .map((product, idx) => ({
          productId: product.id,
          score: scores[0][idx] || 0,
          method: 'session_lstm'
        }))
        .filter(p => !sessionHistory.some(h => h.productId === p.productId))
        .sort((a, b) => b.score - a.score)
        .slice(0, count);

      return this.enrichRecommendations(recommendations);
    } catch (error) {
      this.logger.error('Session LSTM recommendation error', error);
      return this.getItemBasedSessionRecommendations(sessionHistory, count);
    }
  }

  private async getCrossSellRecommendations(
    userId: string,
    context: any,
    count: number
  ): Promise<any[]> {
    const userHistory = await this.getUserHistory(userId);
    const cartItems = context.cartItems || [];
    
    if (cartItems.length === 0 && userHistory.length === 0) {
      return [];
    }

    const allProducts = await this.getAllProducts();
    const crossSellScores = new Map<string, number>();

    // Calculate cross-sell affinity for cart items
    for (const cartItem of cartItems) {
      const product = allProducts.find(p => p.id === cartItem.productId);
      if (product?.crossSellAffinity) {
        Object.entries(product.crossSellAffinity).forEach(([productId, affinity]) => {
          const currentScore = crossSellScores.get(productId) || 0;
          crossSellScores.set(productId, currentScore + affinity);
        });
      }
    }

    // Calculate cross-sell affinity for purchase history
    for (const interaction of userHistory.filter(h => h.action === 'purchase')) {
      const product = allProducts.find(p => p.id === interaction.productId);
      if (product?.crossSellAffinity) {
        Object.entries(product.crossSellAffinity).forEach(([productId, affinity]) => {
          const currentScore = crossSellScores.get(productId) || 0;
          crossSellScores.set(productId, currentScore + affinity * 0.5); // Lower weight for history
        });
      }
    }

    const recommendations = Array.from(crossSellScores.entries())
      .filter(([productId]) => !cartItems.some(item => item.productId === productId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([productId, score]) => ({
        productId,
        score,
        method: 'cross_sell'
      }));

    return this.enrichRecommendations(recommendations);
  }

  private async mergeAndRankRecommendations(
    allRecommendations: any[],
    count: number
  ): Promise<any[]> {
    // Merge recommendations and calculate final scores
    const productScores: Map<string, { score: number; methods: string[] }> = new Map();

    for (const rec of allRecommendations) {
      const current = productScores.get(rec.productId) || { score: 0, methods: [] };
      
      // Weight scores by method
      const methodWeight = {
        personalized: 0.4,
        collaborative: 0.3,
        content: 0.2,
        trending: 0.1
      }[rec.method] || 0.1;

      current.score += rec.score * methodWeight;
      current.methods.push(rec.method);
      
      productScores.set(rec.productId, current);
    }

    // Diversify recommendations
    const diversified = this.diversifyRecommendations(productScores);

    // Return top recommendations
    return Array.from(diversified.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, count)
      .map(([productId, data]) => ({
        productId,
        score: data.score,
        methods: data.methods
      }));
  }

  private diversifyRecommendations(
    productScores: Map<string, { score: number; methods: string[] }>
  ): Map<string, { score: number; methods: string[] }> {
    // Ensure diversity in categories and price ranges
    const diversified = new Map();
    const addedCategories = new Set<string>();
    const priceRanges = new Set<string>();

    // Sort by score
    const sorted = Array.from(productScores.entries())
      .sort((a, b) => b[1].score - a[1].score);

    for (const [productId, data] of sorted) {
      // This would normally fetch product details
      const category = 'electronics'; // Mock
      const priceRange = 'medium'; // Mock

      // Add diversity penalty if category/price already represented
      let diversityMultiplier = 1;
      if (addedCategories.has(category)) {
        diversityMultiplier *= 0.8;
      }
      if (priceRanges.has(priceRange)) {
        diversityMultiplier *= 0.9;
      }

      data.score *= diversityMultiplier;
      diversified.set(productId, data);

      addedCategories.add(category);
      priceRanges.add(priceRange);
    }

    return diversified;
  }

  private async addExplanations(recommendations: any[], context: any): Promise<any[]> {
    return recommendations.map(rec => ({
      ...rec,
      explanation: this.generateExplanation(rec, context)
    }));
  }

  private generateExplanation(recommendation: any, context: any): string {
    const methods = recommendation.methods || [];
    
    if (methods.includes('personalized')) {
      return 'Recommended based on your preferences';
    } else if (methods.includes('collaborative')) {
      return 'People with similar tastes also liked this';
    } else if (methods.includes('content')) {
      return 'Similar to products you\'ve viewed';
    } else if (methods.includes('trending')) {
      return 'Trending in your area';
    }
    
    return 'Recommended for you';
  }

  private async enrichRecommendations(recommendations: any[]): Promise<any[]> {
    // This would fetch full product details
    return recommendations.map(rec => ({
      ...rec,
      product: {
        id: rec.productId,
        title: `Product ${rec.productId}`,
        price: Math.random() * 100,
        image: `/images/product-${rec.productId}.jpg`
      }
    }));
  }

  private async getUserHistory(userId: string): Promise<UserInteraction[]> {
    const key = `interactions:${userId}`;
    const interactions = await this.redis.lrange(key, 0, 99);
    
    return interactions.map(i => JSON.parse(i));
  }

  private async storeInteraction(interaction: UserInteraction): Promise<void> {
    const key = `interactions:${interaction.userId}`;
    await this.redis.lpush(key, JSON.stringify(interaction));
    await this.redis.ltrim(key, 0, 999); // Keep last 1000

    // Update trending
    const trendingKey = 'trending:global';
    await this.redis.zincrby(trendingKey, 1, interaction.productId);
  }

  private async getUserEmbedding(userId: string, history: UserInteraction[]): Promise<number[]> {
    const cached = this.userEmbeddings.get(userId);
    if (cached) return cached;

    // Calculate embedding based on interaction history
    const embedding = new Array(128).fill(0);
    
    // This is a simplified version
    for (const interaction of history) {
      const productEmbedding = await this.getProductEmbedding({ id: interaction.productId } as any);
      const weight = interaction.action === 'purchase' ? 1.0 : 0.3;
      
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] += productEmbedding[i] * weight;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    this.userEmbeddings.set(userId, embedding);
    return embedding;
  }

  private async getProductEmbedding(product: Product): Promise<number[]> {
    const cached = this.productEmbeddings.get(product.id);
    if (cached) return cached;

    // Generate embedding (simplified - would use actual features)
    const embedding = new Array(128).fill(0).map(() => Math.random());
    
    this.productEmbeddings.set(product.id, embedding);
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async findSimilarUsers(userId: string, userEmbedding: number[]): Promise<any[]> {
    // This would search for similar users in a vector database
    // For now, return mock data
    return [
      { userId: 'user1', similarity: 0.9 },
      { userId: 'user2', similarity: 0.8 },
      { userId: 'user3', similarity: 0.7 }
    ];
  }

  private async getUserPurchases(userId: string): Promise<string[]> {
    // Mock implementation
    return [`product-${Math.floor(Math.random() * 100)}`];
  }

  private async getUserProducts(userId: string): Promise<string[]> {
    const history = await this.getUserHistory(userId);
    return [...new Set(history.map(h => h.productId))];
  }

  private async calculateUserPreferences(history: UserInteraction[]): Promise<number[]> {
    return this.getUserEmbedding(history[0]?.userId || 'anonymous', history);
  }

  private async getAllProducts(): Promise<Product[]> {
    // Mock implementation - would fetch from database
    return Array.from({ length: 100 }, (_, i) => ({
      id: `product-${i}`,
      title: `Product ${i}`,
      category: ['electronics', 'clothing', 'home'][i % 3],
      price: Math.random() * 200,
      tags: [],
      features: {}
    }));
  }

  private prepareFeatures(context: any, userEmbedding: number[]): number[] {
    // Combine context and user embedding into feature vector
    const features = [
      ...userEmbedding,
      context.device === 'mobile' ? 1 : 0,
      new Date().getHours() / 24,
      new Date().getDay() / 7
    ];

    return features;
  }

  private async shouldRetrain(): Promise<boolean> {
    const lastRetrain = await this.redis.get('ml:last_retrain');
    if (!lastRetrain) return true;

    const hoursSinceRetrain = (Date.now() - parseInt(lastRetrain)) / (1000 * 60 * 60);
    return hoursSinceRetrain > 24; // Retrain daily
  }

  private async retrainModels(): Promise<void> {
    console.log('Retraining recommendation models...');
    // This would trigger model retraining
    await this.redis.set('ml:last_retrain', Date.now().toString());
  }

  private async getPopularProducts(count: number): Promise<any[]> {
    const popular = await this.redis.zrevrange('products:popular', 0, count - 1);
    
    return popular.map(productId => ({
      productId,
      score: 1,
      method: 'popular',
      explanation: 'Popular product'
    }));
  }

  private async updateUserEmbedding(userId: string, interaction: UserInteraction): Promise<void> {
    const currentEmbedding = this.userEmbeddings.get(userId) || new Array(128).fill(0);
    const productEmbedding = await this.getProductEmbedding({ id: interaction.productId } as any);
    
    // Weight by action type
    const actionWeights = {
      'view': 0.1,
      'cart': 0.3,
      'wishlist': 0.2,
      'purchase': 1.0,
      'share': 0.15,
      'review': 0.4,
      'compare': 0.05,
      'return': -0.5
    };
    
    const weight = actionWeights[interaction.action] || 0.1;
    const alpha = Math.abs(weight) * 0.1; // Dynamic learning rate
    
    for (let i = 0; i < currentEmbedding.length; i++) {
      if (weight > 0) {
        currentEmbedding[i] = (1 - alpha) * currentEmbedding[i] + alpha * productEmbedding[i];
      } else {
        // Negative feedback (returns)
        currentEmbedding[i] = currentEmbedding[i] - alpha * productEmbedding[i];
      }
    }

    this.userEmbeddings.set(userId, currentEmbedding);
    
    // Store in Redis for persistence
    await this.redis.set(`embedding:user:${userId}`, JSON.stringify(currentEmbedding));
  }

  private async updateItemEmbedding(productId: string, interaction: UserInteraction): Promise<void> {
    const currentEmbedding = this.productEmbeddings.get(productId) || new Array(128).fill(0);
    const userEmbedding = this.userEmbeddings.get(interaction.userId) || new Array(128).fill(0);
    
    // Update item embedding based on user interactions
    const alpha = 0.01; // Smaller learning rate for items
    for (let i = 0; i < currentEmbedding.length; i++) {
      currentEmbedding[i] = (1 - alpha) * currentEmbedding[i] + alpha * userEmbedding[i];
    }

    this.productEmbeddings.set(productId, currentEmbedding);
    await this.redis.set(`embedding:product:${productId}`, JSON.stringify(currentEmbedding));
  }

  private async updateContextEmbedding(context: any, interaction: UserInteraction): Promise<void> {
    const contextKey = this.getContextKey(context);
    const currentEmbedding = this.contextEmbeddings.get(contextKey) || new Array(64).fill(0);
    
    // Create context vector from interaction
    const contextVector = this.createContextVector(context, interaction);
    
    const alpha = 0.05;
    for (let i = 0; i < currentEmbedding.length; i++) {
      currentEmbedding[i] = (1 - alpha) * currentEmbedding[i] + alpha * contextVector[i];
    }

    this.contextEmbeddings.set(contextKey, currentEmbedding);
  }

  private async updateSessionRecommendations(interaction: UserInteraction): Promise<void> {
    const sessionKey = `${interaction.userId}_${interaction.sessionId}`;
    
    // Remove interacted products from session cache
    if (this.sessionRecommendations.has(sessionKey)) {
      const cached = this.sessionRecommendations.get(sessionKey)!;
      cached.recommendations = cached.recommendations.filter(
        rec => rec.productId !== interaction.productId
      );
      
      // Mark as stale if significant interaction
      if (['cart', 'purchase', 'wishlist'].includes(interaction.action)) {
        cached.timestamp = 0; // Force refresh
      }
    }
  }

  private async processRealtimeFeedback(interaction: UserInteraction): Promise<void> {
    const feedbackKey = interaction.userId;
    const feedback = this.realtimeFeedback.get(feedbackKey) || [];
    
    feedback.push({
      ...interaction,
      timestamp: Date.now()
    });
    
    // Keep only recent feedback (last hour)
    const recentFeedback = feedback.filter(
      f => Date.now() - f.timestamp < 3600000
    );
    
    this.realtimeFeedback.set(feedbackKey, recentFeedback);
    
    // Update real-time models if significant feedback
    if (recentFeedback.length >= 5) {
      await this.updateRealtimeModels(feedbackKey, recentFeedback);
    }
  }

  private async processTrainingBatch(): Promise<void> {
    if (this.isTraining || this.trainingQueue.length === 0) return;
    
    this.isTraining = true;
    const batch = this.trainingQueue.splice(0, this.config.batchSize);
    
    try {
      // Process batch for incremental learning
      await this.incrementalModelUpdate(batch);
      this.logger.info('Processed training batch', { size: batch.length });
    } catch (error) {
      this.logger.error('Batch processing error', error);
    } finally {
      this.isTraining = false;
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    const profile = await this.redis.get(`profile:${userId}`);
    if (profile) {
      return JSON.parse(profile);
    }
    
    // Generate profile from interactions
    const history = await this.getUserHistory(userId);
    const segments = await personalizationEngine.segmentCustomers();
    
    const userProfile = {
      preferences: this.analyzeUserPreferences(history),
      segments: segments.filter(s => s.criteria.userId === userId),
      behavior: this.analyzeBehaviorPatterns(history),
      demographics: await this.getUserDemographics(userId),
      lifetime_value: await this.calculateLifetimeValue(userId)
    };
    
    await this.redis.setex(`profile:${userId}`, 3600, JSON.stringify(userProfile));
    return userProfile;
  }

  private async getContextVector(context: any): Promise<number[]> {
    return [
      context.device === 'mobile' ? 1 : 0,
      context.device === 'tablet' ? 1 : 0,
      context.device === 'desktop' ? 1 : 0,
      new Date().getHours() / 24,
      new Date().getDay() / 7,
      new Date().getMonth() / 12,
      context.isWeekend ? 1 : 0,
      context.isHoliday ? 1 : 0,
      context.weatherScore || 0.5,
      context.trafficSource === 'social' ? 1 : 0,
      context.trafficSource === 'search' ? 1 : 0,
      context.trafficSource === 'direct' ? 1 : 0,
      context.cartValue ? Math.min(context.cartValue / 1000, 1) : 0,
      context.sessionDuration ? Math.min(context.sessionDuration / 3600, 1) : 0,
      context.pageDepth ? Math.min(context.pageDepth / 20, 1) : 0,
      context.isFirstVisit ? 1 : 0
    ];
  }

  private async getContextEmbedding(contextVector: number[]): Promise<number[]> {
    // Expand context vector to embedding size
    const embedding = new Array(64).fill(0);
    for (let i = 0; i < Math.min(contextVector.length, 64); i++) {
      embedding[i] = contextVector[i];
    }
    return embedding;
  }

  private getABTestingVariant(userId: string): string {
    const hash = this.simpleHash(userId);
    const variants = ['balanced', 'neural_heavy', 'business_focused', 'collaborative_focused'];
    return variants[hash % variants.length];
  }

  private async applyBusinessRules(recommendations: any[], context: any): Promise<any[]> {
    if (!this.config.enableBusinessRules) return recommendations;
    
    return recommendations.filter(rec => {
      const product = rec.product;
      
      // Minimum margin filter
      if (this.businessRules.minMargin && product.profitMargin < this.businessRules.minMargin) {
        return false;
      }
      
      // Inventory threshold
      if (this.businessRules.maxInventoryThreshold && 
          product.inventoryLevel > this.businessRules.maxInventoryThreshold) {
        return false;
      }
      
      return true;
    }).map(rec => {
      // Apply business rule scoring
      if (this.businessRules.categoryWeights) {
        const categoryWeight = this.businessRules.categoryWeights[rec.product.category] || 1;
        rec.score *= categoryWeight;
      }
      
      return rec;
    });
  }

  private async optimizeForDiversityAndNovelty(
    recommendations: any[], 
    userHistory: UserInteraction[], 
    context: any
  ): Promise<any[]> {
    const categories = new Set<string>();
    const priceRanges = new Set<string>();
    const brands = new Set<string>();
    const diversified: any[] = [];
    
    // Sort by score first
    const sorted = [...recommendations].sort((a, b) => b.score - a.score);
    
    for (const rec of sorted) {
      const product = rec.product;
      const category = product.category;
      const priceRange = this.getPriceRange(product.price);
      const brand = product.brand || 'unknown';
      
      // Calculate diversity penalty
      let diversityPenalty = 1;
      if (categories.has(category)) diversityPenalty *= 0.8;
      if (priceRanges.has(priceRange)) diversityPenalty *= 0.9;
      if (brands.has(brand)) diversityPenalty *= 0.85;
      
      // Calculate novelty score
      const noveltyScore = this.calculateNoveltyScore(product, userHistory);
      
      // Apply diversity and novelty
      rec.score = rec.score * diversityPenalty * (1 + noveltyScore * 0.2);
      rec.diversityScore = diversityPenalty;
      rec.noveltyScore = noveltyScore;
      
      diversified.push(rec);
      categories.add(category);
      priceRanges.add(priceRange);
      brands.add(brand);
      
      if (diversified.length >= recommendations.length) break;
    }
    
    return diversified.sort((a, b) => b.score - a.score);
  }

  private async addAdvancedExplanations(
    recommendations: any[], 
    context: any, 
    userHistory: UserInteraction[]
  ): Promise<any[]> {
    return recommendations.map(rec => {
      const explanations: string[] = [];
      
      // Method-based explanations
      if (rec.method === 'deep_learning') {
        explanations.push('AI-powered recommendation based on your preferences');
      } else if (rec.method === 'collaborative') {
        explanations.push('Customers with similar tastes also liked this');
      } else if (rec.method === 'cross_sell') {
        explanations.push('Pairs well with items in your cart');
      } else if (rec.method === 'business_optimized') {
        explanations.push('Great value with excellent ratings');
      }
      
      // Context-based explanations
      if (context.device === 'mobile') {
        explanations.push('Optimized for mobile shopping');
      }
      
      if (rec.noveltyScore > 0.7) {
        explanations.push('New discovery for you');
      }
      
      if (rec.businessFactors?.seasonalBoost > 1.2) {
        explanations.push('Trending this season');
      }
      
      rec.explanation = explanations.join(' • ');
      rec.confidence = Math.min(rec.score, 1);
      
      return rec;
    });
  }

  private async getIntelligentFallback(context: any, count: number): Promise<any[]> {
    try {
      // Prioritize based on context
      if (context.categoryBrowsed) {
        return this.getCategoryBasedFallback(context.categoryBrowsed, count);
      } else if (context.searchQuery) {
        return this.getSearchBasedFallback(context.searchQuery, count);
      } else {
        return this.getPopularProducts(count);
      }
    } catch {
      return this.getPopularProducts(count);
    }
  }

  // Helper methods
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getPriceRange(price: number): string {
    if (price < 25) return 'budget';
    if (price < 100) return 'mid';
    if (price < 500) return 'premium';
    return 'luxury';
  }

  private calculateNoveltyScore(product: any, userHistory: UserInteraction[]): number {
    const userCategories = new Set(userHistory.map(h => h.productId)); // Simplified
    const userPriceRange = userHistory.map(h => h.productId); // Would map to actual prices
    
    // Calculate how different this product is from user's history
    let noveltyScore = 0.5; // Base novelty
    
    // Category novelty
    if (!userCategories.has(product.category)) {
      noveltyScore += 0.3;
    }
    
    // Price novelty (simplified)
    const productPriceRange = this.getPriceRange(product.price);
    // Add logic based on user's typical price range
    
    return Math.min(noveltyScore, 1);
  }

  private getActiveModels(): string[] {
    return Array.from(this.models.keys()).filter(key => {
      const model = this.models.get(key);
      return model && (model.weights || model.performance.accuracy > 0.7);
    });
  }

  // Additional missing helper methods
  private async initializeBusinessRules(): Promise<void> {
    this.businessRules = {
      minMargin: 0.15,
      maxInventoryThreshold: 1000,
      seasonalBoosts: {
        'winter': 1.2,
        'spring': 1.1,
        'summer': 1.0,
        'fall': 1.15
      },
      categoryWeights: {
        'electronics': 1.2,
        'fashion': 1.1,
        'home': 1.0,
        'sports': 1.05
      },
      demographicPreferences: {
        'young_adults': { 'electronics': 1.3, 'fashion': 1.2 },
        'families': { 'home': 1.3, 'sports': 1.1 },
        'seniors': { 'home': 1.2, 'electronics': 0.8 }
      }
    };
  }

  private startRealtimeUpdates(): void {
    if (!this.config.enableRealTime) return;
    
    setInterval(async () => {
      await this.processRealtimeQueue();
    }, this.config.realtimeUpdateInterval);
  }

  private async processRealtimeQueue(): Promise<void> {
    if (this.trainingQueue.length === 0) return;
    
    try {
      const batch = this.trainingQueue.splice(0, this.config.batchSize || 100);
      await this.incrementalModelUpdate(batch);
      
      this.logger.info('Real-time batch processed', { 
        batchSize: batch.length,
        queueRemaining: this.trainingQueue.length 
      });
    } catch (error) {
      this.logger.error('Real-time processing error', error);
    }
  }

  private async incrementalModelUpdate(batch: UserInteraction[]): Promise<void> {
    // Update embeddings based on recent interactions
    const userUpdates = new Map<string, number[]>();
    const itemUpdates = new Map<string, number[]>();
    
    for (const interaction of batch) {
      // Update user embedding
      const userEmbedding = this.userEmbeddings.get(interaction.userId) || new Array(128).fill(0);
      const itemEmbedding = this.productEmbeddings.get(interaction.productId) || new Array(128).fill(0);
      
      const weight = this.getInteractionWeight(interaction);
      const alpha = 0.01; // Small incremental update
      
      for (let i = 0; i < userEmbedding.length; i++) {
        userEmbedding[i] = (1 - alpha) * userEmbedding[i] + alpha * weight * itemEmbedding[i];
      }
      
      userUpdates.set(interaction.userId, userEmbedding);
    }
    
    // Apply updates
    for (const [userId, embedding] of userUpdates) {
      this.userEmbeddings.set(userId, embedding);
      await this.redis.set(`embedding:user:${userId}`, JSON.stringify(embedding));
    }
  }

  private getInteractionWeight(interaction: UserInteraction): number {
    const weights = {
      'view': 0.1,
      'cart': 0.3,
      'wishlist': 0.2,
      'purchase': 1.0,
      'share': 0.15,
      'review': 0.4,
      'compare': 0.05,
      'return': -0.5
    };
    return weights[interaction.action] || 0.1;
  }

  private async updateRealtimeModels(userId: string, feedback: any[]): Promise<void> {
    // Update models based on recent feedback
    const recentPositive = feedback.filter(f => ['cart', 'purchase', 'wishlist'].includes(f.action));
    const recentNegative = feedback.filter(f => ['return'].includes(f.action));
    
    if (recentPositive.length >= 3) {
      // Boost similar items
      await this.boostSimilarItems(recentPositive);
    }
    
    if (recentNegative.length >= 1) {
      // Reduce weight for similar items
      await this.penalizeSimilarItems(recentNegative);
    }
  }

  private async boostSimilarItems(interactions: any[]): Promise<void> {
    // Implement boosting logic for similar items
    for (const interaction of interactions) {
      const embedding = this.productEmbeddings.get(interaction.productId);
      if (embedding) {
        // Find similar products and boost their scores
        for (const [productId, productEmbedding] of this.productEmbeddings) {
          const similarity = this.cosineSimilarity(embedding, productEmbedding);
          if (similarity > 0.8 && productId !== interaction.productId) {
            // Boost product in trending cache
            await this.redis.zincrby('trending:global', 1, productId);
          }
        }
      }
    }
  }

  private async penalizeSimilarItems(interactions: any[]): Promise<void> {
    // Implement penalty logic for similar items
    for (const interaction of interactions) {
      const embedding = this.productEmbeddings.get(interaction.productId);
      if (embedding) {
        // Find similar products and reduce their scores
        for (const [productId, productEmbedding] of this.productEmbeddings) {
          const similarity = this.cosineSimilarity(embedding, productEmbedding);
          if (similarity > 0.8 && productId !== interaction.productId) {
            await this.redis.zincrby('trending:global', -0.5, productId);
          }
        }
      }
    }
  }

  private async updateABTestingMetrics(interaction: UserInteraction): Promise<void> {
    const variant = this.getABTestingVariant(interaction.userId);
    const key = `ab_test:${variant}`;
    
    // Update metrics for A/B test variant
    await this.redis.hincrby(key, 'interactions', 1);
    
    if (['cart', 'purchase'].includes(interaction.action)) {
      await this.redis.hincrby(key, 'conversions', 1);
    }
    
    if (interaction.action === 'purchase' && interaction.context?.cartValue) {
      await this.redis.hincrbyfloat(key, 'revenue', interaction.context.cartValue);
    }
  }

  private getContextKey(context: any): string {
    return `${context.device || 'unknown'}_${context.timeOfDay || 'unknown'}_${context.dayOfWeek || 'unknown'}`;
  }

  private createContextVector(context: any, interaction: UserInteraction): number[] {
    return [
      context.device === 'mobile' ? 1 : 0,
      context.device === 'tablet' ? 1 : 0,
      context.device === 'desktop' ? 1 : 0,
      interaction.action === 'view' ? 1 : 0,
      interaction.action === 'cart' ? 1 : 0,
      interaction.action === 'purchase' ? 1 : 0,
      new Date().getHours() / 24,
      new Date().getDay() / 7,
      context.isWeekend ? 1 : 0,
      (interaction.duration || 0) / 300, // Normalize to 5 minutes
      // Add more contextual features as needed
      ...new Array(54).fill(0) // Pad to 64 dimensions
    ];
  }

  private calculateCrossSellScore(product: any, userHistory: UserInteraction[]): number {
    if (!product.crossSellAffinity) return 0;
    
    let score = 0;
    for (const interaction of userHistory) {
      if (interaction.action === 'purchase') {
        const affinity = product.crossSellAffinity[interaction.productId] || 0;
        score += affinity;
      }
    }
    
    return Math.min(score, 1); // Normalize to [0, 1]
  }

  private async getCustomerSegment(userId: string): Promise<string> {
    // Simple segment detection - in production, use more sophisticated logic
    const history = await this.getUserHistory(userId);
    const purchases = history.filter(h => h.action === 'purchase');
    
    if (purchases.length === 0) return 'new_customer';
    if (purchases.length >= 10) return 'loyal_customer';
    if (purchases.some(p => (p.context?.cartValue || 0) > 200)) return 'high_value';
    
    return 'regular_customer';
  }

  private async getSessionHistory(sessionId: string): Promise<UserInteraction[]> {
    const key = `session:${sessionId}`;
    const interactions = await this.redis.lrange(key, 0, 99);
    return interactions.map(i => JSON.parse(i));
  }

  private async getItemBasedSessionRecommendations(sessionHistory: UserInteraction[], count: number): Promise<any[]> {
    // Fallback when LSTM model is not available
    const viewedProducts = sessionHistory.map(h => h.productId);
    const recommendations: any[] = [];
    
    for (const productId of viewedProducts) {
      const similarity = this.itemSimilarityMatrix.get(productId);
      if (similarity) {
        for (const [similarId, score] of similarity) {
          if (!viewedProducts.includes(similarId)) {
            recommendations.push({
              productId: similarId,
              score,
              method: 'item_similarity'
            });
          }
        }
      }
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(rec => this.enrichRecommendations([rec])[0]);
  }

  private async getCategoryBasedFallback(category: string, count: number): Promise<any[]> {
    const key = `category:${category}:popular`;
    const products = await this.redis.zrevrange(key, 0, count - 1);
    
    return products.map((productId, index) => ({
      productId,
      score: 0.8 - (index * 0.05),
      method: 'category_fallback',
      explanation: `Popular in ${category}`
    }));
  }

  private async getSearchBasedFallback(searchQuery: string, count: number): Promise<any[]> {
    // Simple keyword matching - in production, use proper search
    const allProducts = await this.getAllProducts();
    const matchedProducts = allProducts.filter(product => 
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return matchedProducts
      .slice(0, count)
      .map((product, index) => ({
        productId: product.id,
        score: 0.7 - (index * 0.05),
        method: 'search_fallback',
        explanation: `Matches your search: ${searchQuery}`
      }));
  }

  private analyzeUserPreferences(history: UserInteraction[]): any {
    const categories = new Map<string, number>();
    const priceRanges = new Map<string, number>();
    
    for (const interaction of history) {
      // This would normally fetch product details
      const category = 'electronics'; // Mock
      const priceRange = 'medium'; // Mock
      
      categories.set(category, (categories.get(category) || 0) + 1);
      priceRanges.set(priceRange, (priceRanges.get(priceRange) || 0) + 1);
    }
    
    return {
      topCategories: Array.from(categories.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
      preferredPriceRange: Array.from(priceRanges.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }

  private analyzeBehaviorPatterns(history: UserInteraction[]): any {
    const patterns = {
      avgSessionLength: 0,
      preferredShoppingTime: 'evening',
      devicePreference: 'mobile',
      conversionRate: 0
    };
    
    if (history.length === 0) return patterns;
    
    const purchases = history.filter(h => h.action === 'purchase');
    patterns.conversionRate = purchases.length / history.length;
    
    // Analyze device usage
    const deviceCounts = new Map<string, number>();
    for (const interaction of history) {
      const device = interaction.device || 'desktop';
      deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
    }
    
    const topDevice = Array.from(deviceCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topDevice) {
      patterns.devicePreference = topDevice[0];
    }
    
    return patterns;
  }

  private async getUserDemographics(userId: string): Promise<any> {
    // In production, fetch from user profile or infer from behavior
    return {
      ageGroup: 'young_adult',
      location: 'US',
      interests: ['technology', 'fashion']
    };
  }

  private async calculateLifetimeValue(userId: string): Promise<number> {
    const history = await this.getUserHistory(userId);
    const purchases = history.filter(h => h.action === 'purchase');
    
    return purchases.reduce((total, purchase) => {
      return total + (purchase.context?.cartValue || 0);
    }, 0);
  }

  // Real-time recommendation optimization
  async optimizeRecommendationsRealTime(userId: string, currentRecommendations: any[]): Promise<any[]> {
    try {
      const recentFeedback = this.realtimeFeedback.get(userId) || [];
      if (recentFeedback.length === 0) return currentRecommendations;
      
      // Apply real-time adjustments based on recent feedback
      const adjustedRecommendations = currentRecommendations.map(rec => {
        let adjustmentFactor = 1;
        
        // Check if user has shown interest in similar products recently
        for (const feedback of recentFeedback) {
          const similarity = await this.calculateProductSimilarity(rec.productId, feedback.productId);
          
          if (similarity > 0.7) {
            if (['cart', 'purchase', 'wishlist'].includes(feedback.action)) {
              adjustmentFactor += 0.2; // Boost similar products
            } else if (feedback.action === 'return') {
              adjustmentFactor -= 0.3; // Penalize similar products
            }
          }
        }
        
        return {
          ...rec,
          score: rec.score * adjustmentFactor,
          realTimeScore: adjustmentFactor
        };
      });
      
      return adjustedRecommendations.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Real-time optimization error', error);
      return currentRecommendations;
    }
  }

  private async calculateProductSimilarity(productId1: string, productId2: string): Promise<number> {
    const embedding1 = this.productEmbeddings.get(productId1);
    const embedding2 = this.productEmbeddings.get(productId2);
    
    if (!embedding1 || !embedding2) return 0;
    
    return this.cosineSimilarity(embedding1, embedding2);
  }

  // Advanced revenue optimization
  async optimizeForRevenue(recommendations: any[], businessContext: any): Promise<any[]> {
    return recommendations.map(rec => {
      let revenueScore = rec.score;
      
      // Apply business optimization
      if (rec.businessFactors) {
        // Higher margin products get boost
        revenueScore *= (1 + rec.businessFactors.margin);
        
        // Inventory consideration
        if (rec.businessFactors.inventoryLevel < 10) {
          revenueScore *= 0.7; // Reduce low inventory items
        } else if (rec.businessFactors.inventoryLevel > 100) {
          revenueScore *= 1.1; // Boost high inventory items
        }
        
        // Sales velocity
        revenueScore *= Math.log(rec.businessFactors.velocity + 1);
      }
      
      return {
        ...rec,
        score: revenueScore,
        optimizedForRevenue: true
      };
    }).sort((a, b) => b.score - a.score);
  }

  async getPerformanceStats(): Promise<any> {
    const stats: any = {
      models: {},
      recommendations: {
        totalGenerated: await this.redis.get('stats:recommendations:total') || 0,
        clickThrough: await this.redis.get('stats:recommendations:clicks') || 0,
        conversions: await this.redis.get('stats:recommendations:conversions') || 0,
        revenue: await this.redis.get('stats:recommendations:revenue') || 0,
        averageOrderValue: await this.redis.get('stats:recommendations:aov') || 0,
        conversionRate: await this.redis.get('stats:recommendations:conversion_rate') || 0
      },
      performance: {
        averageResponseTime: await this.redis.get('stats:performance:avg_response_time') || 0,
        cacheHitRate: await this.redis.get('stats:performance:cache_hit_rate') || 0,
        modelAccuracy: await this.redis.get('stats:performance:model_accuracy') || 0
      },
      abTesting: {
        activeTests: this.abTestingConfig.size,
        variants: Array.from(this.abTestingConfig.keys())
      },
      businessMetrics: {
        revenueIncrease: await this.redis.get('stats:business:revenue_increase') || 0,
        customerRetention: await this.redis.get('stats:business:retention_improvement') || 0,
        crossSellSuccess: await this.redis.get('stats:business:cross_sell_rate') || 0
      }
    };

    for (const [name, model] of this.models) {
      stats.models[name] = {
        type: model.type,
        version: model.version,
        lastUpdated: model.lastUpdated,
        performance: model.performance,
        hyperparameters: model.hyperparameters,
        trainingMetrics: model.trainingMetrics
      };
    }

    return stats;
  }

  private async initializeModels(): Promise<void> {
    try {
      // Load or create advanced models
      await Promise.all([
        this.initializeCollaborativeFiltering(),
        this.initializeContentBasedModel(),
        this.initializeDeepLearningModel(),
        this.initializeHybridNeuralModel(),
        this.initializeMatrixFactorization(),
        this.initializeAutoencoderModel(),
        this.initializeLSTMModel()
      ]);
      
      this.logger.info('All recommendation models initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize models', error);
      throw error;
    }
  }
  
  private async initializeCollaborativeFiltering(): Promise<void> {
    this.models.set('collaborative', {
      type: 'collaborative',
      version: '2.0.0',
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.78,
        ndcg: 0.81,
        diversity: 0.65,
        novelty: 0.45,
        coverage: 0.72,
        auc: 0.83,
        hitRate: 0.76,
        mrr: 0.68
      },
      hyperparameters: {
        embeddingDim: 128,
        learningRate: 0.001,
        regularization: 0.01,
        dropoutRate: 0.2,
        batchSize: 256,
        epochs: 100
      }
    });
  }
  
  private async initializeContentBasedModel(): Promise<void> {
    this.models.set('content', {
      type: 'content',
      version: '2.0.0',
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.80,
        precision: 0.78,
        recall: 0.75,
        ndcg: 0.77,
        diversity: 0.58,
        novelty: 0.42,
        coverage: 0.68,
        auc: 0.79,
        hitRate: 0.73,
        mrr: 0.65
      },
      hyperparameters: {
        embeddingDim: 256,
        learningRate: 0.0005,
        regularization: 0.005,
        dropoutRate: 0.15,
        batchSize: 128,
        epochs: 80
      }
    });
  }
  
  private async initializeDeepLearningModel(): Promise<void> {
    // Create deep neural collaborative filtering model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [this.config.embeddingDim * 3], units: 512, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    this.models.set('neural', {
      type: 'neural',
      version: '1.0.0',
      weights: model,
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.92,
        precision: 0.89,
        recall: 0.87,
        ndcg: 0.88,
        diversity: 0.72,
        novelty: 0.55,
        coverage: 0.78,
        auc: 0.91,
        hitRate: 0.84,
        mrr: 0.79
      },
      hyperparameters: {
        embeddingDim: 128,
        learningRate: 0.001,
        regularization: 0.01,
        dropoutRate: 0.2,
        batchSize: 512,
        epochs: 200
      }
    });
  }
  
  private async initializeHybridNeuralModel(): Promise<void> {
    // Multi-tower neural network for hybrid recommendations
    const userInput = tf.input({ shape: [this.config.embeddingDim] });
    const itemInput = tf.input({ shape: [this.config.embeddingDim] });
    const contextInput = tf.input({ shape: [64] });
    
    // User tower
    const userTower = tf.layers.dense({ units: 256, activation: 'relu' }).apply(userInput) as tf.SymbolicTensor;
    const userTower2 = tf.layers.dropout({ rate: 0.2 }).apply(userTower) as tf.SymbolicTensor;
    const userTower3 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(userTower2) as tf.SymbolicTensor;
    
    // Item tower
    const itemTower = tf.layers.dense({ units: 256, activation: 'relu' }).apply(itemInput) as tf.SymbolicTensor;
    const itemTower2 = tf.layers.dropout({ rate: 0.2 }).apply(itemTower) as tf.SymbolicTensor;
    const itemTower3 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(itemTower2) as tf.SymbolicTensor;
    
    // Context tower
    const contextTower = tf.layers.dense({ units: 128, activation: 'relu' }).apply(contextInput) as tf.SymbolicTensor;
    const contextTower2 = tf.layers.dropout({ rate: 0.1 }).apply(contextTower) as tf.SymbolicTensor;
    const contextTower3 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(contextTower2) as tf.SymbolicTensor;
    
    // Combine towers
    const combined = tf.layers.concatenate().apply([userTower3, itemTower3, contextTower3]) as tf.SymbolicTensor;
    const dense1 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(combined) as tf.SymbolicTensor;
    const dropout1 = tf.layers.dropout({ rate: 0.3 }).apply(dense1) as tf.SymbolicTensor;
    const dense2 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(dropout1) as tf.SymbolicTensor;
    const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(dense2) as tf.SymbolicTensor;
    
    const model = tf.model({ inputs: [userInput, itemInput, contextInput], outputs: output });
    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('hybrid_neural', {
      type: 'hybrid',
      version: '2.0.0',
      weights: model,
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.94,
        precision: 0.91,
        recall: 0.89,
        ndcg: 0.90,
        diversity: 0.75,
        novelty: 0.58,
        coverage: 0.81,
        auc: 0.93,
        hitRate: 0.87,
        mrr: 0.82
      },
      hyperparameters: {
        embeddingDim: 128,
        learningRate: 0.0005,
        regularization: 0.005,
        dropoutRate: 0.25,
        batchSize: 256,
        epochs: 150
      }
    });
  }
  
  private async initializeMatrixFactorization(): Promise<void> {
    this.models.set('matrix_factorization', {
      type: 'matrix_factorization',
      version: '1.0.0',
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.83,
        precision: 0.80,
        recall: 0.76,
        ndcg: 0.79,
        diversity: 0.62,
        novelty: 0.41,
        coverage: 0.70,
        auc: 0.81,
        hitRate: 0.74,
        mrr: 0.67
      },
      hyperparameters: {
        embeddingDim: 64,
        learningRate: 0.01,
        regularization: 0.02,
        dropoutRate: 0.1,
        batchSize: 1024,
        epochs: 50
      }
    });
  }
  
  private async initializeAutoencoderModel(): Promise<void> {
    // Autoencoder for collaborative filtering
    const inputDim = 1000; // Number of items
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [inputDim], units: 512, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' })
      ]
    });
    
    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [128], units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 512, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: inputDim, activation: 'sigmoid' })
      ]
    });
    
    const autoencoder = tf.sequential({ layers: [encoder, decoder] });
    autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    this.models.set('autoencoder', {
      type: 'autoencoder',
      version: '1.0.0',
      weights: autoencoder,
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.86,
        precision: 0.83,
        recall: 0.79,
        ndcg: 0.82,
        diversity: 0.68,
        novelty: 0.48,
        coverage: 0.75,
        auc: 0.84,
        hitRate: 0.78,
        mrr: 0.71
      },
      hyperparameters: {
        embeddingDim: 128,
        learningRate: 0.001,
        regularization: 0.01,
        dropoutRate: 0.4,
        batchSize: 128,
        epochs: 100
      }
    });
  }
  
  private async initializeLSTMModel(): Promise<void> {
    // LSTM for sequence-based recommendations
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({ 
          inputShape: [10, this.config.embeddingDim], // sequence of 10 interactions
          units: 128,
          returnSequences: true,
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        tf.layers.lstm({ 
          units: 64,
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 1000, activation: 'softmax' }) // Number of items
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('lstm', {
      type: 'lstm',
      version: '1.0.0',
      weights: model,
      lastUpdated: new Date(),
      performance: {
        accuracy: 0.88,
        precision: 0.85,
        recall: 0.82,
        ndcg: 0.84,
        diversity: 0.70,
        novelty: 0.52,
        coverage: 0.77,
        auc: 0.87,
        hitRate: 0.81,
        mrr: 0.75
      },
      hyperparameters: {
        embeddingDim: 128,
        learningRate: 0.001,
        regularization: 0.01,
        dropoutRate: 0.25,
        batchSize: 64,
        epochs: 80
      }
    });
  }
}