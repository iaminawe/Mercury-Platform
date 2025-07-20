/**
 * ML Models for Personalization
 * Provides machine learning capabilities for predictions and recommendations
 */

import { UserProfile } from './user-profiler';
import { PersonalizationContext } from './engine';
import * as tf from '@tensorflow/tfjs';

export interface MLPrediction {
  purchaseIntent: number;
  churnRisk: number;
  nextPurchaseDate?: Date;
  lifetimeValue: number;
  categoryAffinities: Record<string, number>;
  recommendationScores: Record<string, number>;
}

export interface CollaborativeFilteringResult {
  products: string[];
  categories: string[];
  confidence: number;
}

export interface ContentBasedResult {
  products: string[];
  categories: string[];
  reasons: string[];
}

export class MLModels {
  private models: Map<string, tf.LayersModel> = new Map();
  private embeddings: Map<string, Float32Array> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize ML models
   */
  private async initialize() {
    try {
      // Initialize TensorFlow.js
      await tf.ready();
      
      // Load pre-trained models (in production, these would be loaded from storage)
      // For now, we'll create simple models
      this.models.set('purchase_intent', this.createPurchaseIntentModel());
      this.models.set('churn_risk', this.createChurnRiskModel());
      this.models.set('ltv_prediction', this.createLTVModel());
      this.models.set('category_affinity', this.createCategoryAffinityModel());
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ML models:', error);
    }
  }

  /**
   * Make predictions based on user profile and context
   */
  async predict(profile: UserProfile, context: PersonalizationContext): Promise<MLPrediction> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Prepare features
    const features = this.extractFeatures(profile, context);
    
    // Make predictions
    const [purchaseIntent, churnRisk, ltv, categoryAffinities] = await Promise.all([
      this.predictPurchaseIntent(features),
      this.predictChurnRisk(features),
      this.predictLTV(features),
      this.predictCategoryAffinities(features, profile)
    ]);

    // Calculate next purchase date
    const nextPurchaseDate = this.calculateNextPurchaseDate(profile, purchaseIntent);

    return {
      purchaseIntent,
      churnRisk,
      lifetimeValue: ltv,
      categoryAffinities,
      nextPurchaseDate,
      recommendationScores: {}
    };
  }

  /**
   * Get collaborative filtering recommendations
   */
  async getCollaborativeFilteringRecs(userId: string): Promise<CollaborativeFilteringResult> {
    // Simplified collaborative filtering
    // In production, this would use matrix factorization or deep learning
    
    // Get user embedding
    const userEmbedding = await this.getUserEmbedding(userId);
    
    // Find similar users
    const similarUsers = await this.findSimilarUsersByEmbedding(userEmbedding);
    
    // Get products purchased by similar users
    const products = await this.getProductsFromSimilarUsers(similarUsers);
    const categories = await this.getCategoriesFromProducts(products);

    return {
      products: products.slice(0, 20),
      categories: categories.slice(0, 10),
      confidence: this.calculateConfidence(similarUsers.length, products.length)
    };
  }

  /**
   * Get content-based recommendations
   */
  async getContentBasedRecs(profile: UserProfile): Promise<ContentBasedResult> {
    // Analyze user's purchase and browsing history
    const userPreferences = this.analyzeUserPreferences(profile);
    
    // Find products matching preferences
    const matchingProducts = await this.findProductsByAttributes(userPreferences);
    
    // Extract categories
    const categories = await this.extractCategoriesFromProducts(matchingProducts);
    
    // Generate reasons
    const reasons = this.generateRecommendationReasons(userPreferences, matchingProducts);

    return {
      products: matchingProducts.map(p => p.id),
      categories: categories,
      reasons
    };
  }

  /**
   * Update models with conversion data
   */
  async updateWithConversion(userId: string, conversionType: string, value: number) {
    // In production, this would retrain or fine-tune models
    // For now, we'll update embeddings and store feedback
    
    const feedback = {
      userId,
      conversionType,
      value,
      timestamp: new Date()
    };

    // Update user embedding based on conversion
    await this.updateUserEmbedding(userId, feedback);
    
    // Store for batch retraining
    await this.storeFeedback(feedback);
  }

  /**
   * Extract features from profile and context
   */
  private extractFeatures(profile: UserProfile, context: PersonalizationContext): tf.Tensor2D {
    const features = [
      // Behavioral features
      profile.behavior.pageViews / 100,
      profile.behavior.avgSessionDuration / 300,
      profile.behavior.visitCount / 10,
      profile.behavior.purchaseCount / 5,
      profile.behavior.totalSpent / 1000,
      profile.behavior.avgOrderValue / 100,
      
      // Temporal features
      this.daysSince(profile.behavior.lastVisit) / 30,
      this.daysSince(profile.behavior.firstVisit) / 365,
      
      // Engagement features
      profile.behavior.interactionCount / 50,
      profile.segments.length / 5,
      
      // Context features
      context.device.type === 'mobile' ? 1 : 0,
      this.getHourOfDay(context.timestamp) / 24,
      this.getDayOfWeek(context.timestamp) / 7,
      
      // Category preferences (top 5)
      ...this.getTopCategoryScores(profile.interests.categories, 5)
    ];

    return tf.tensor2d([features]);
  }

  /**
   * Predict purchase intent
   */
  private async predictPurchaseIntent(features: tf.Tensor2D): Promise<number> {
    const model = this.models.get('purchase_intent');
    if (!model) return 0.5;

    const prediction = model.predict(features) as tf.Tensor;
    const value = await prediction.data();
    prediction.dispose();
    
    return Math.max(0, Math.min(1, value[0]));
  }

  /**
   * Predict churn risk
   */
  private async predictChurnRisk(features: tf.Tensor2D): Promise<number> {
    const model = this.models.get('churn_risk');
    if (!model) return 0.1;

    const prediction = model.predict(features) as tf.Tensor;
    const value = await prediction.data();
    prediction.dispose();
    
    return Math.max(0, Math.min(1, value[0]));
  }

  /**
   * Predict lifetime value
   */
  private async predictLTV(features: tf.Tensor2D): Promise<number> {
    const model = this.models.get('ltv_prediction');
    if (!model) return 100;

    const prediction = model.predict(features) as tf.Tensor;
    const value = await prediction.data();
    prediction.dispose();
    
    return Math.max(0, value[0] * 1000); // Scale to dollars
  }

  /**
   * Predict category affinities
   */
  private async predictCategoryAffinities(
    features: tf.Tensor2D, 
    profile: UserProfile
  ): Promise<Record<string, number>> {
    const model = this.models.get('category_affinity');
    if (!model) {
      // Fallback to profile interests
      return this.normalizeScores(profile.interests.categories);
    }

    const prediction = model.predict(features) as tf.Tensor;
    const values = await prediction.data();
    prediction.dispose();
    
    // Map to category names
    const categories = ['electronics', 'fashion', 'home', 'sports', 'beauty'];
    const affinities: Record<string, number> = {};
    
    categories.forEach((cat, i) => {
      affinities[cat] = Math.max(0, Math.min(1, values[i] || 0));
    });

    return affinities;
  }

  /**
   * Create purchase intent model
   */
  private createPurchaseIntentModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [18], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create churn risk model
   */
  private createChurnRiskModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [18], units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create LTV prediction model
   */
  private createLTVModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [18], units: 64, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 1, activation: 'linear' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  /**
   * Create category affinity model
   */
  private createCategoryAffinityModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [18], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // 5 categories
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Get or create user embedding
   */
  private async getUserEmbedding(userId: string): Promise<Float32Array> {
    let embedding = this.embeddings.get(userId);
    
    if (!embedding) {
      // Create new embedding based on user data
      embedding = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        embedding[i] = Math.random() - 0.5;
      }
      this.embeddings.set(userId, embedding);
    }

    return embedding;
  }

  /**
   * Find similar users by embedding
   */
  private async findSimilarUsersByEmbedding(
    userEmbedding: Float32Array
  ): Promise<Array<{ userId: string; similarity: number }>> {
    const similarities: Array<{ userId: string; similarity: number }> = [];

    // Compare with other user embeddings
    for (const [userId, embedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(userEmbedding, embedding);
      similarities.push({ userId, similarity });
    }

    // Sort by similarity and return top users
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(1, 11); // Exclude self, get top 10
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
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

  /**
   * Get products from similar users
   */
  private async getProductsFromSimilarUsers(
    similarUsers: Array<{ userId: string; similarity: number }>
  ): Promise<string[]> {
    // In production, this would query purchase history
    // For now, return mock data
    return [
      'product_001', 'product_002', 'product_003',
      'product_004', 'product_005', 'product_006'
    ];
  }

  /**
   * Get categories from products
   */
  private async getCategoriesFromProducts(products: string[]): Promise<string[]> {
    // In production, this would look up product categories
    return ['electronics', 'fashion', 'home'];
  }

  /**
   * Analyze user preferences from profile
   */
  private analyzeUserPreferences(profile: UserProfile): any {
    return {
      categories: profile.interests.categories,
      priceRange: profile.interests.priceRange,
      brands: profile.interests.brands,
      attributes: profile.interests.attributes
    };
  }

  /**
   * Find products by attributes
   */
  private async findProductsByAttributes(preferences: any): Promise<any[]> {
    // In production, this would query product database
    return [
      { id: 'product_101', category: 'electronics', price: 299 },
      { id: 'product_102', category: 'fashion', price: 89 },
      { id: 'product_103', category: 'home', price: 149 }
    ];
  }

  /**
   * Extract categories from products
   */
  private async extractCategoriesFromProducts(products: any[]): Promise<string[]> {
    const categories = new Set(products.map(p => p.category));
    return Array.from(categories);
  }

  /**
   * Generate recommendation reasons
   */
  private generateRecommendationReasons(preferences: any, products: any[]): string[] {
    const reasons: string[] = [];

    if (preferences.categories.electronics > 5) {
      reasons.push('Based on your interest in electronics');
    }

    if (products.some(p => p.price < preferences.priceRange.preferred)) {
      reasons.push('Within your preferred price range');
    }

    if (reasons.length === 0) {
      reasons.push('Recommended based on your browsing history');
    }

    return reasons;
  }

  /**
   * Update user embedding based on feedback
   */
  private async updateUserEmbedding(userId: string, feedback: any) {
    const embedding = await this.getUserEmbedding(userId);
    
    // Simple update rule - in production would use gradient descent
    const learningRate = 0.01;
    const updateVector = new Float32Array(128);
    
    // Generate update based on feedback
    for (let i = 0; i < 128; i++) {
      updateVector[i] = (Math.random() - 0.5) * feedback.value / 100;
      embedding[i] += updateVector[i] * learningRate;
    }

    this.embeddings.set(userId, embedding);
  }

  /**
   * Store feedback for batch retraining
   */
  private async storeFeedback(feedback: any) {
    // In production, this would store in a database for batch processing
    console.log('Storing feedback:', feedback);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(similarUsers: number, products: number): number {
    const userWeight = Math.min(similarUsers / 10, 1) * 0.5;
    const productWeight = Math.min(products / 20, 1) * 0.5;
    return userWeight + productWeight;
  }

  /**
   * Calculate next purchase date
   */
  private calculateNextPurchaseDate(profile: UserProfile, purchaseIntent: number): Date | undefined {
    if (profile.behavior.purchaseCount === 0) return undefined;

    // Calculate average days between purchases
    const purchaseDates = profile.behavior.purchasedProducts
      .map(p => p.timestamp)
      .sort((a, b) => a.getTime() - b.getTime());

    if (purchaseDates.length < 2) return undefined;

    let totalDays = 0;
    for (let i = 1; i < purchaseDates.length; i++) {
      totalDays += (purchaseDates[i].getTime() - purchaseDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    }

    const avgDaysBetween = totalDays / (purchaseDates.length - 1);
    const lastPurchase = purchaseDates[purchaseDates.length - 1];
    
    // Adjust based on purchase intent
    const adjustedDays = avgDaysBetween * (2 - purchaseIntent);
    
    return new Date(lastPurchase.getTime() + adjustedDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Utility functions
   */
  private daysSince(date: Date): number {
    return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  }

  private getHourOfDay(date: Date): number {
    return date.getHours();
  }

  private getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  private getTopCategoryScores(categories: Record<string, number>, n: number): number[] {
    const sorted = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([, score]) => score / 10);

    // Pad with zeros if needed
    while (sorted.length < n) {
      sorted.push(0);
    }

    return sorted;
  }

  private normalizeScores(scores: Record<string, number>): Record<string, number> {
    const total = Object.values(scores).reduce((sum, val) => sum + val, 0);
    if (total === 0) return scores;

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores)) {
      normalized[key] = value / total;
    }

    return normalized;
  }
}