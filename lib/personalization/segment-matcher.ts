import { Redis } from 'ioredis';
import { supabase } from '@/lib/supabase/client';

// Advanced segment types
export type SegmentType = 
  | 'behavioral' 
  | 'demographic' 
  | 'psychographic' 
  | 'transactional' 
  | 'lifecycle' 
  | 'intent' 
  | 'predictive' 
  | 'cluster';

export type LifecycleStage = 
  | 'new' 
  | 'active' 
  | 'returning' 
  | 'vip' 
  | 'at_risk' 
  | 'churned' 
  | 'win_back';

export type IntentLevel = 
  | 'high_intent' 
  | 'medium_intent' 
  | 'browsers' 
  | 'price_sensitive' 
  | 'research_mode';

interface SegmentRule {
  id: string;
  name: string;
  description: string;
  type: SegmentType;
  conditions: {
    all?: SegmentCondition[];
    any?: SegmentCondition[];
    none?: SegmentCondition[];
  };
  priority: number;
  enabled: boolean;
  dynamicUpdate: boolean;
  mlModel?: string;
  metadata: {
    created: Date;
    updated: Date;
    matchCount: number;
    accuracy: number;
    performance: SegmentPerformance;
  };
}

interface SegmentCondition {
  type: 'behavior' | 'demographic' | 'purchase' | 'engagement' | 'psychographic' | 'intent' | 'predictive' | 'custom';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'between' | 'regex' | 'similarity' | 'ml_predict';
  value: any;
  weight?: number;
  confidence?: number;
}

interface SegmentStats {
  segmentId: string;
  name: string;
  type: SegmentType;
  size: number;
  growth: number; // percentage
  avgOrderValue: number;
  conversionRate: number;
  engagementScore: number;
  churnRate: number;
  lifetimeValue: number;
  cohortData: CohortData[];
}

interface SegmentPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  updateFrequency: number;
  lastUpdated: Date;
}

interface CohortData {
  period: string;
  retentionRate: number;
  revenue: number;
  activeUsers: number;
}

// Machine Learning interfaces
interface MLModel {
  id: string;
  name: string;
  type: 'clustering' | 'classification' | 'prediction';
  algorithm: 'kmeans' | 'dbscan' | 'random_forest' | 'neural_network';
  features: string[];
  accuracy: number;
  trained: Date;
  version: string;
}

interface ClusterResult {
  clusterId: string;
  centroid: number[];
  members: string[];
  characteristics: string[];
  confidence: number;
}

export class AdvancedSegmentMatcher {
  private redis: Redis;
  private config: any;
  private segments: Map<string, SegmentRule> = new Map();
  private segmentCache: Map<string, Set<string>> = new Map(); // userId -> segments
  private mlModels: Map<string, MLModel> = new Map();
  private clusterCache: Map<string, ClusterResult> = new Map();
  private realTimeUpdates: Map<string, Date> = new Map();
  private segmentHistory: Map<string, any[]> = new Map();

  constructor(redis: Redis, config: any) {
    this.redis = redis;
    this.config = config;
    this.loadSegments();
    this.loadMLModels();
    this.initializeRealTimeTracking();
  }

  async match(context: any): Promise<{
    segments: string[];
    confidence: number;
    predictive: {
      lifecycle: LifecycleStage;
      intent: IntentLevel;
      churnRisk: number;
      ltv: number;
    };
    clusters: string[];
  }> {
    const userId = context.userId || context.sessionId;
    
    // Check cache for real-time updates
    const cached = this.segmentCache.get(userId);
    const lastUpdate = this.realTimeUpdates.get(userId);
    const cacheValid = cached && lastUpdate && 
      (Date.now() - lastUpdate.getTime() < this.config.cacheTimeout);
    
    if (cacheValid && !context.forceRefresh) {
      return await this.getCachedResult(userId);
    }

    // Get comprehensive user data
    const userData = await this.getEnhancedUserData(context);
    
    // Run rule-based segmentation
    const ruleBasedSegments = await this.runRuleBasedSegmentation(userData);
    
    // Run ML-based clustering
    const clusterSegments = await this.runMLClustering(userData);
    
    // Run predictive modeling
    const predictions = await this.runPredictiveModeling(userData);
    
    // Combine results with confidence scoring
    const result = await this.combineSegmentationResults(
      ruleBasedSegments,
      clusterSegments,
      predictions,
      userData
    );

    // Cache and persist results
    await this.cacheSegmentationResult(userId, result);
    
    // Update segment performance metrics
    await this.updateSegmentMetrics(result.segments, userId);
    
    // Store in segment history for learning
    await this.storeSegmentHistory(userId, result);

    return result;
  }

  // Enhanced segmentation methods
  private async runRuleBasedSegmentation(userData: any): Promise<{
    segments: string[];
    confidence: number;
  }> {
    const matchedSegments: string[] = ['all_users'];
    let totalConfidence = 0;
    let segmentCount = 0;

    for (const [id, segment] of this.segments) {
      if (!segment.enabled || segment.type === 'cluster') continue;
      
      const result = await this.matchesSegmentWithConfidence(segment, userData);
      if (result.matches) {
        matchedSegments.push(id);
        totalConfidence += result.confidence;
        segmentCount++;
      }
    }

    return {
      segments: matchedSegments,
      confidence: segmentCount > 0 ? totalConfidence / segmentCount : 0
    };
  }

  private async matchesSegmentWithConfidence(segment: SegmentRule, userData: any): Promise<{
    matches: boolean;
    confidence: number;
  }> {
    const { conditions } = segment;
    let totalWeight = 0;
    let weightedScore = 0;
    
    // Check ALL conditions with weighted scoring
    if (conditions.all && conditions.all.length > 0) {
      for (const cond of conditions.all) {
        const result = await this.evaluateConditionWithConfidence(cond, userData);
        const weight = cond.weight || 1;
        totalWeight += weight;
        if (result.matches) {
          weightedScore += weight * result.confidence;
        } else {
          return { matches: false, confidence: 0 };
        }
      }
    }

    // Check ANY conditions
    if (conditions.any && conditions.any.length > 0) {
      let anyMatched = false;
      let bestConfidence = 0;
      
      for (const cond of conditions.any) {
        const result = await this.evaluateConditionWithConfidence(cond, userData);
        if (result.matches) {
          anyMatched = true;
          bestConfidence = Math.max(bestConfidence, result.confidence);
        }
      }
      
      if (!anyMatched) return { matches: false, confidence: 0 };
      weightedScore += bestConfidence;
      totalWeight += 1;
    }

    // Check NONE conditions
    if (conditions.none && conditions.none.length > 0) {
      for (const cond of conditions.none) {
        const result = await this.evaluateConditionWithConfidence(cond, userData);
        if (result.matches) {
          return { matches: false, confidence: 0 };
        }
      }
    }

    const confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Update segment metrics
    segment.metadata.matchCount++;
    segment.metadata.accuracy = (segment.metadata.accuracy + confidence) / 2;
    
    return {
      matches: confidence >= (segment.metadata.performance?.accuracy || 0.7),
      confidence
    };
  }

  private async evaluateConditionWithConfidence(condition: SegmentCondition, userData: any): Promise<{
    matches: boolean;
    confidence: number;
  }> {
    const value = this.getFieldValue(condition.field, userData);
    
    switch (condition.operator) {
      case 'equals':
        return {
          matches: value === condition.value,
          confidence: value === condition.value ? 1.0 : 0.0
        };
        
      case 'not_equals':
        return {
          matches: value !== condition.value,
          confidence: value !== condition.value ? 1.0 : 0.0
        };
        
      case 'greater_than':
        const numValue = Number(value);
        const threshold = Number(condition.value);
        const gtMatches = numValue > threshold;
        const gtConfidence = gtMatches ? 
          Math.min(1.0, (numValue - threshold) / threshold) : 0.0;
        return { matches: gtMatches, confidence: gtConfidence };
        
      case 'less_than':
        const ltNumValue = Number(value);
        const ltThreshold = Number(condition.value);
        const ltMatches = ltNumValue < ltThreshold;
        const ltConfidence = ltMatches ? 
          Math.min(1.0, (ltThreshold - ltNumValue) / ltThreshold) : 0.0;
        return { matches: ltMatches, confidence: ltConfidence };
        
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          const [min, max] = condition.value;
          const betweenMatches = value >= min && value <= max;
          const range = max - min;
          const distance = Math.min(Math.abs(value - min), Math.abs(value - max));
          const betweenConfidence = betweenMatches ? 
            1.0 - (distance / range) : 0.0;
          return { matches: betweenMatches, confidence: betweenConfidence };
        }
        return { matches: false, confidence: 0.0 };
        
      case 'contains':
        const containsMatches = String(value).includes(String(condition.value));
        return { matches: containsMatches, confidence: containsMatches ? 1.0 : 0.0 };
        
      case 'similarity':
        // Use Levenshtein distance for similarity matching
        const similarity = this.calculateSimilarity(String(value), String(condition.value));
        const simThreshold = condition.confidence || 0.8;
        return {
          matches: similarity >= simThreshold,
          confidence: similarity
        };
        
      case 'ml_predict':
        // Use ML model for prediction
        return await this.evaluateMLCondition(condition, userData);
        
      case 'regex':
        try {
          const regex = new RegExp(condition.value);
          const regexMatches = regex.test(String(value));
          return { matches: regexMatches, confidence: regexMatches ? 1.0 : 0.0 };
        } catch {
          return { matches: false, confidence: 0.0 };
        }
        
      case 'in':
        const inMatches = Array.isArray(condition.value) && condition.value.includes(value);
        return { matches: inMatches, confidence: inMatches ? 1.0 : 0.0 };
        
      case 'not_in':
        const notInMatches = Array.isArray(condition.value) && !condition.value.includes(value);
        return { matches: notInMatches, confidence: notInMatches ? 1.0 : 0.0 };
        
      default:
        return { matches: false, confidence: 0.0 };
    }
  }

  private getFieldValue(field: string, userData: any): any {
    // Navigate nested fields using dot notation
    const parts = field.split('.');
    let value = userData;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return value;
  }

  async createSegment(segment: Omit<SegmentRule, 'metadata'>): Promise<SegmentRule> {
    const newSegment: SegmentRule = {
      ...segment,
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0
      }
    };
    
    this.segments.set(segment.id, newSegment);
    await this.saveSegments();
    
    // Clear cache to force re-evaluation
    this.segmentCache.clear();
    
    return newSegment;
  }

  async updateSegment(id: string, updates: Partial<SegmentRule>): Promise<SegmentRule | null> {
    const segment = this.segments.get(id);
    if (!segment) return null;
    
    const updatedSegment = {
      ...segment,
      ...updates,
      metadata: {
        ...segment.metadata,
        updated: new Date()
      }
    };
    
    this.segments.set(id, updatedSegment);
    await this.saveSegments();
    
    // Clear cache
    this.segmentCache.clear();
    
    return updatedSegment;
  }

  async deleteSegment(id: string): Promise<boolean> {
    const deleted = this.segments.delete(id);
    if (deleted) {
      await this.saveSegments();
      this.segmentCache.clear();
    }
    return deleted;
  }

  async getSegmentStats(): Promise<SegmentStats[]> {
    const stats: SegmentStats[] = [];
    
    for (const [id, segment] of this.segments) {
      const segmentStats = await this.calculateSegmentStats(id, segment);
      stats.push(segmentStats);
    }
    
    return stats.sort((a, b) => b.size - a.size);
  }

  private async calculateSegmentStats(segmentId: string, segment: SegmentRule): Promise<SegmentStats> {
    // Get segment members
    const members = await this.getSegmentMembers(segmentId);
    
    // Calculate metrics
    const [
      avgOrderValue,
      conversionRate,
      engagementScore,
      previousSize
    ] = await Promise.all([
      this.calculateAvgOrderValue(members),
      this.calculateConversionRate(members),
      this.calculateEngagementScore(members),
      this.getPreviousSegmentSize(segmentId)
    ]);

    const currentSize = members.length;
    const growth = previousSize > 0 
      ? ((currentSize - previousSize) / previousSize) * 100 
      : 0;

    return {
      segmentId,
      name: segment.name,
      size: currentSize,
      growth,
      avgOrderValue,
      conversionRate,
      engagementScore
    };
  }

  private async getSegmentMembers(segmentId: string): Promise<string[]> {
    // In production, this would query from a database
    // For now, check cached segments
    const members: string[] = [];
    
    for (const [userId, segments] of this.segmentCache) {
      if (segments.has(segmentId)) {
        members.push(userId);
      }
    }
    
    return members;
  }

  private async getEnhancedUserData(context: any): Promise<any> {
    const userId = context.userId || context.sessionId;
    
    // Get comprehensive data from multiple sources
    const [
      profile,
      behavior,
      purchases,
      sessions,
      interactions,
      demographics
    ] = await Promise.all([
      this.redis.get(`profile:${userId}`),
      this.redis.get(`behavior:${userId}`),
      this.redis.get(`purchases:${userId}`),
      this.redis.get(`sessions:${userId}`),
      this.redis.get(`interactions:${userId}`),
      this.getSupabaseUserData(userId)
    ]);

    const parsedBehavior = behavior ? JSON.parse(behavior) : {
      totalVisits: 0,
      totalPurchases: 0,
      lastVisit: new Date(),
      cartAbandonment: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      pagesPerSession: 0
    };

    const parsedSessions = sessions ? JSON.parse(sessions) : [];
    const parsedInteractions = interactions ? JSON.parse(interactions) : [];
    const parsedPurchases = purchases ? JSON.parse(purchases) : [];

    // Calculate advanced behavioral metrics
    const behaviorMetrics = this.calculateBehaviorMetrics(parsedSessions, parsedInteractions);
    const purchaseMetrics = this.calculatePurchaseMetrics(parsedPurchases);
    const engagementMetrics = this.calculateEngagementMetrics(parsedInteractions);
    const lifecycleStage = this.determineLifecycleStage(parsedBehavior, parsedPurchases);
    const intentLevel = this.determineIntentLevel(parsedInteractions, context);

    return {
      userId,
      sessionId: context.sessionId,
      device: context.device,
      location: context.location,
      timestamp: Date.now(),
      profile: profile ? JSON.parse(profile) : {},
      behavior: {
        ...parsedBehavior,
        ...behaviorMetrics
      },
      purchases: parsedPurchases,
      purchaseMetrics,
      engagementMetrics,
      lifecycleStage,
      intentLevel,
      demographics,
      psychographics: await this.derivePsychographics(parsedInteractions, parsedPurchases),
      realTimeContext: {
        currentPage: context.currentPage,
        referrer: context.referrer,
        timeOnPage: context.timeOnPage,
        scrollDepth: context.scrollDepth,
        clickPattern: context.clickPattern
      }
    };
  }

  private async calculateAvgOrderValue(members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    
    let total = 0;
    let count = 0;
    
    for (const userId of members.slice(0, 100)) { // Sample first 100
      const purchases = await this.redis.get(`purchases:${userId}`);
      if (purchases) {
        const purchaseData = JSON.parse(purchases);
        total += purchaseData.reduce((sum: number, p: any) => sum + p.amount, 0);
        count += purchaseData.length;
      }
    }
    
    return count > 0 ? total / count : 0;
  }

  private async calculateConversionRate(members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    
    let conversions = 0;
    
    for (const userId of members.slice(0, 100)) { // Sample
      const purchases = await this.redis.get(`purchases:${userId}`);
      if (purchases && JSON.parse(purchases).length > 0) {
        conversions++;
      }
    }
    
    return (conversions / Math.min(members.length, 100)) * 100;
  }

  private async calculateEngagementScore(members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    
    let totalScore = 0;
    
    for (const userId of members.slice(0, 100)) { // Sample
      const behavior = await this.redis.get(`behavior:${userId}`);
      if (behavior) {
        const data = JSON.parse(behavior);
        // Simple engagement score based on visits
        totalScore += Math.min(data.totalVisits / 10, 1);
      }
    }
    
    return totalScore / Math.min(members.length, 100);
  }

  private async getPreviousSegmentSize(segmentId: string): Promise<number> {
    const previousSize = await this.redis.get(`segment:${segmentId}:size`);
    return previousSize ? parseInt(previousSize) : 0;
  }

  private async loadSegments(): Promise<void> {
    const segmentsData = await this.redis.get('personalization:segments');
    if (segmentsData) {
      const segments = JSON.parse(segmentsData);
      segments.forEach((segment: SegmentRule) => {
        this.segments.set(segment.id, segment);
      });
    } else {
      this.initializeAdvancedSegments();
    }
  }

  private async saveSegments(): Promise<void> {
    const segmentsArray = Array.from(this.segments.values());
    await this.redis.set('personalization:segments', JSON.stringify(segmentsArray));
  }

  private initializeAdvancedSegments(): void {
    // Behavioral Segments
    this.segments.set('high_intent_browsers', {
      id: 'high_intent_browsers',
      name: 'High Intent Browsers',
      description: 'Users showing strong purchase intent through behavior',
      type: 'behavioral',
      conditions: {
        all: [
          {
            type: 'behavior',
            field: 'engagementMetrics.productViewTime',
            operator: 'greater_than',
            value: 120,
            weight: 0.3
          },
          {
            type: 'behavior',
            field: 'behavior.pagesPerSession',
            operator: 'greater_than',
            value: 5,
            weight: 0.2
          }
        ],
        any: [
          {
            type: 'behavior',
            field: 'realTimeContext.currentPage',
            operator: 'contains',
            value: 'checkout',
            weight: 0.5
          },
          {
            type: 'behavior',
            field: 'engagementMetrics.cartAdditions',
            operator: 'greater_than',
            value: 1,
            weight: 0.4
          }
        ]
      },
      priority: 9,
      enabled: true,
      dynamicUpdate: true,
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.85,
        performance: {
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.85,
          updateFrequency: 300,
          lastUpdated: new Date()
        }
      }
    });

    // Lifecycle Segments  
    this.segments.set('new_visitors', {
      id: 'new_visitors',
      name: 'New Visitors',
      description: 'First-time visitors in their discovery phase',
      type: 'lifecycle',
      conditions: {
        all: [
          {
            type: 'behavior',
            field: 'behavior.totalVisits',
            operator: 'equals',
            value: 1,
            weight: 1.0
          },
          {
            type: 'purchase',
            field: 'purchases.length',
            operator: 'equals',
            value: 0,
            weight: 1.0
          }
        ]
      },
      priority: 8,
      enabled: true,
      dynamicUpdate: true,
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.95,
        performance: {
          accuracy: 0.95,
          precision: 0.92,
          recall: 0.98,
          f1Score: 0.95,
          updateFrequency: 60,
          lastUpdated: new Date()
        }
      }
    });

    // High value customers with enhanced conditions
    this.segments.set('vip_customers', {
      id: 'vip_customers',
      name: 'VIP Customers',
      description: 'High-value customers with exceptional loyalty',
      type: 'transactional',
      conditions: {
        all: [
          {
            type: 'purchase',
            field: 'purchaseMetrics.lifetimeValue',
            operator: 'greater_than',
            value: 1000,
            weight: 0.4
          },
          {
            type: 'purchase',
            field: 'purchaseMetrics.avgOrderValue',
            operator: 'greater_than',
            value: 150,
            weight: 0.3
          },
          {
            type: 'behavior',
            field: 'purchaseMetrics.purchaseFrequency',
            operator: 'greater_than',
            value: 4,
            weight: 0.3
          }
        ]
      },
      priority: 10,
      enabled: true,
      dynamicUpdate: true,
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.92,
        performance: {
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.95,
          f1Score: 0.92,
          updateFrequency: 3600,
          lastUpdated: new Date()
        }
      }
    });

    // Price-sensitive segment with predictive modeling
    this.segments.set('price_sensitive_shoppers', {
      id: 'price_sensitive_shoppers',
      name: 'Price-Sensitive Shoppers',
      description: 'Users who respond strongly to discounts and deals',
      type: 'psychographic',
      conditions: {
        any: [
          {
            type: 'behavior',
            field: 'engagementMetrics.discountInteraction',
            operator: 'greater_than',
            value: 0.7,
            weight: 0.4
          },
          {
            type: 'behavior',
            field: 'behavior.couponUsage',
            operator: 'greater_than',
            value: 2,
            weight: 0.3
          }
        ],
        all: [
          {
            type: 'purchase',
            field: 'purchaseMetrics.avgOrderValue',
            operator: 'less_than',
            value: 75,
            weight: 0.3
          }
        ]
      },
      priority: 7,
      enabled: true,
      dynamicUpdate: true,
      mlModel: 'price_sensitivity_classifier',
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.78,
        performance: {
          accuracy: 0.78,
          precision: 0.75,
          recall: 0.82,
          f1Score: 0.78,
          updateFrequency: 1800,
          lastUpdated: new Date()
        }
      }
    });

    // At-risk customers with churn prediction
    this.segments.set('at_risk_customers', {
      id: 'at_risk_customers',
      name: 'At-Risk Customers',
      description: 'Customers showing signs of potential churn',
      type: 'predictive',
      conditions: {
        any: [
          {
            type: 'behavior',
            field: 'behavior.daysSinceLastVisit',
            operator: 'greater_than',
            value: 30,
            weight: 0.3
          },
          {
            type: 'purchase',
            field: 'purchaseMetrics.daysSinceLastPurchase',
            operator: 'greater_than',
            value: 60,
            weight: 0.4
          }
        ],
        all: [
          {
            type: 'engagement',
            field: 'engagementMetrics.recentEngagementScore',
            operator: 'less_than',
            value: 0.3,
            weight: 0.3
          }
        ]
      },
      priority: 9,
      enabled: true,
      dynamicUpdate: true,
      mlModel: 'churn_prediction_model',
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.83,
        performance: {
          accuracy: 0.83,
          precision: 0.79,
          recall: 0.87,
          f1Score: 0.83,
          updateFrequency: 3600,
          lastUpdated: new Date()
        }
      }
    });

    // Mobile-optimized shoppers
    this.segments.set('mobile_native_shoppers', {
      id: 'mobile_native_shoppers',
      name: 'Mobile-Native Shoppers',
      description: 'Users who prefer and excel at mobile shopping',
      type: 'demographic',
      conditions: {
        all: [
          {
            type: 'demographic',
            field: 'device.type',
            operator: 'equals',
            value: 'mobile',
            weight: 0.4
          },
          {
            type: 'behavior',
            field: 'behavior.mobileSessionRatio',
            operator: 'greater_than',
            value: 0.8,
            weight: 0.3
          },
          {
            type: 'engagement',
            field: 'engagementMetrics.mobileConversionRate',
            operator: 'greater_than',
            value: 0.05,
            weight: 0.3
          }
        ]
      },
      priority: 6,
      enabled: true,
      dynamicUpdate: true,
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.91,
        performance: {
          accuracy: 0.91,
          precision: 0.88,
          recall: 0.94,
          f1Score: 0.91,
          updateFrequency: 1800,
          lastUpdated: new Date()
        }
      }
    });

    // Emerging high-value prospects
    this.segments.set('emerging_high_value', {
      id: 'emerging_high_value',
      name: 'Emerging High-Value Prospects',
      description: 'Users showing early signs of becoming high-value customers',
      type: 'predictive',
      conditions: {
        all: [
          {
            type: 'behavior',
            field: 'behavior.totalVisits',
            operator: 'between',
            value: [3, 10],
            weight: 0.2
          },
          {
            type: 'engagement',
            field: 'engagementMetrics.engagementTrend',
            operator: 'greater_than',
            value: 0.6,
            weight: 0.3
          }
        ],
        any: [
          {
            type: 'purchase',
            field: 'purchaseMetrics.firstOrderValue',
            operator: 'greater_than',
            value: 100,
            weight: 0.3
          },
          {
            type: 'behavior',
            field: 'engagementMetrics.premiumCategoryInterest',
            operator: 'greater_than',
            value: 0.7,
            weight: 0.2
          }
        ]
      },
      priority: 8,
      enabled: true,
      dynamicUpdate: true,
      mlModel: 'ltv_prediction_model',
      metadata: {
        created: new Date(),
        updated: new Date(),
        matchCount: 0,
        accuracy: 0.74,
        performance: {
          accuracy: 0.74,
          precision: 0.71,
          recall: 0.78,
          f1Score: 0.74,
          updateFrequency: 7200,
          lastUpdated: new Date()
        }
      }
    });
  }

  // Machine Learning and Advanced Analytics Methods
  private async runMLClustering(userData: any): Promise<string[]> {
    try {
      // Extract features for clustering
      const features = this.extractFeatureVector(userData);
      
      // Run K-means clustering
      const clusterResult = await this.performKMeansClustering(features, userData.userId);
      
      // Get cluster-based segments
      const clusterSegments = this.getClusterSegments(clusterResult);
      
      return clusterSegments;
    } catch (error) {
      console.error('ML clustering error:', error);
      return [];
    }
  }

  private async runPredictiveModeling(userData: any): Promise<{
    lifecycle: LifecycleStage;
    intent: IntentLevel;
    churnRisk: number;
    ltv: number;
  }> {
    try {
      const features = this.extractFeatureVector(userData);
      
      const [lifecycle, intent, churnRisk, ltv] = await Promise.all([
        this.predictLifecycleStage(features),
        this.predictIntentLevel(features),
        this.predictChurnRisk(features),
        this.predictLifetimeValue(features)
      ]);
      
      return { lifecycle, intent, churnRisk, ltv };
    } catch (error) {
      console.error('Predictive modeling error:', error);
      return {
        lifecycle: 'new' as LifecycleStage,
        intent: 'medium_intent' as IntentLevel,
        churnRisk: 0.5,
        ltv: 0
      };
    }
  }

  private extractFeatureVector(userData: any): number[] {
    return [
      userData.behavior.totalVisits || 0,
      userData.behavior.totalPurchases || 0,
      userData.behavior.avgSessionDuration || 0,
      userData.behavior.bounceRate || 0,
      userData.behavior.pagesPerSession || 0,
      userData.purchaseMetrics?.avgOrderValue || 0,
      userData.purchaseMetrics?.lifetimeValue || 0,
      userData.purchaseMetrics?.purchaseFrequency || 0,
      userData.engagementMetrics?.engagementScore || 0,
      userData.engagementMetrics?.productViewTime || 0,
      userData.engagementMetrics?.cartAdditions || 0,
      userData.engagementMetrics?.discountInteraction || 0,
      userData.behavior.daysSinceLastVisit || 0,
      userData.purchaseMetrics?.daysSinceLastPurchase || 0,
      userData.device?.type === 'mobile' ? 1 : 0,
      userData.behavior.mobileSessionRatio || 0
    ];
  }

  private async performKMeansClustering(features: number[], userId: string): Promise<ClusterResult> {
    // Simplified K-means implementation
    // In production, use a proper ML library like TensorFlow.js or call ML service
    
    const k = 8; // Number of clusters
    const maxIterations = 100;
    
    // Get or initialize centroids
    let centroids = await this.getClusterCentroids();
    if (!centroids || centroids.length !== k) {
      centroids = this.initializeCentroids(k, features.length);
    }
    
    // Find closest centroid
    let minDistance = Infinity;
    let clusterId = '0';
    
    for (let i = 0; i < centroids.length; i++) {
      const distance = this.euclideanDistance(features, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        clusterId = i.toString();
      }
    }
    
    // Calculate confidence based on distance
    const confidence = Math.max(0, 1 - (minDistance / 10)); // Normalized confidence
    
    return {
      clusterId,
      centroid: centroids[parseInt(clusterId)],
      members: [userId],
      characteristics: this.getClusterCharacteristics(clusterId),
      confidence
    };
  }

  private initializeCentroids(k: number, dimensions: number): number[][] {
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      const centroid: number[] = [];
      for (let j = 0; j < dimensions; j++) {
        centroid.push(Math.random() * 10); // Random initialization
      }
      centroids.push(centroid);
    }
    return centroids;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private getClusterCharacteristics(clusterId: string): string[] {
    const characteristics: { [key: string]: string[] } = {
      '0': ['High-value', 'Frequent buyer', 'Premium categories'],
      '1': ['Price-sensitive', 'Deal seeker', 'Budget conscious'],
      '2': ['Mobile-first', 'Quick decisions', 'App user'],
      '3': ['Research-heavy', 'Comparison shopper', 'Detail-oriented'],
      '4': ['Impulse buyer', 'Social influenced', 'Trend follower'],
      '5': ['Loyal customer', 'Brand advocate', 'Regular patterns'],
      '6': ['New visitor', 'Exploring', 'Learning'],
      '7': ['At-risk', 'Declining engagement', 'Potential churn']
    };
    
    return characteristics[clusterId] || ['General shopper'];
  }

  private getClusterSegments(clusterResult: ClusterResult): string[] {
    const clusterSegmentMap: { [key: string]: string } = {
      '0': 'cluster_high_value',
      '1': 'cluster_price_sensitive',
      '2': 'cluster_mobile_first',
      '3': 'cluster_researchers',
      '4': 'cluster_impulse_buyers',
      '5': 'cluster_loyal_customers',
      '6': 'cluster_new_visitors',
      '7': 'cluster_at_risk'
    };
    
    const segmentId = clusterSegmentMap[clusterResult.clusterId];
    return segmentId ? [segmentId] : [];
  }

  private async predictLifecycleStage(features: number[]): Promise<LifecycleStage> {
    const [visits, purchases, daysSinceLastVisit, daysSinceLastPurchase] = [
      features[0], features[1], features[12], features[13]
    ];
    
    // Rule-based lifecycle determination
    if (purchases === 0 && visits <= 2) return 'new';
    if (purchases === 0 && visits > 2) return 'active';
    if (purchases > 0 && daysSinceLastPurchase <= 30) return 'active';
    if (purchases > 0 && daysSinceLastPurchase <= 90) return 'returning';
    if (purchases >= 10 && features[6] > 500) return 'vip'; // LTV > 500
    if (daysSinceLastVisit > 90) return 'churned';
    if (daysSinceLastVisit > 30) return 'at_risk';
    
    return 'active';
  }

  private async predictIntentLevel(features: number[]): Promise<IntentLevel> {
    const [, , , , pagesPerSession, , , , engagementScore, productViewTime, cartAdditions] = features;
    
    let intentScore = 0;
    
    if (cartAdditions > 0) intentScore += 0.4;
    if (productViewTime > 120) intentScore += 0.3;
    if (pagesPerSession > 5) intentScore += 0.2;
    if (engagementScore > 0.7) intentScore += 0.1;
    
    if (intentScore >= 0.8) return 'high_intent';
    if (intentScore >= 0.5) return 'medium_intent';
    if (intentScore >= 0.3) return 'browsers';
    if (features[11] > 0.5) return 'price_sensitive'; // discount interaction
    
    return 'research_mode';
  }

  private async predictChurnRisk(features: number[]): Promise<number> {
    const [visits, purchases, , , , , , , engagementScore, , , , daysSinceLastVisit, daysSinceLastPurchase] = features;
    
    let riskScore = 0;
    
    // Days since last visit/purchase
    if (daysSinceLastVisit > 60) riskScore += 0.3;
    else if (daysSinceLastVisit > 30) riskScore += 0.2;
    
    if (daysSinceLastPurchase > 120) riskScore += 0.3;
    else if (daysSinceLastPurchase > 60) riskScore += 0.2;
    
    // Engagement decline
    if (engagementScore < 0.3) riskScore += 0.2;
    else if (engagementScore < 0.5) riskScore += 0.1;
    
    // Activity patterns
    if (visits > 0 && purchases === 0) riskScore += 0.1;
    if (visits < 3 && purchases > 0) riskScore += 0.1;
    
    return Math.min(1, riskScore);
  }

  private async predictLifetimeValue(features: number[]): Promise<number> {
    const [visits, purchases, , , pagesPerSession, avgOrderValue, currentLTV, frequency, engagementScore] = features;
    
    if (currentLTV > 0) return currentLTV;
    
    // Simple LTV prediction based on early indicators
    let predictedLTV = 0;
    
    if (avgOrderValue > 0) {
      predictedLTV = avgOrderValue * frequency * 5; // 5x multiplier
    } else {
      // For users without purchases, predict based on engagement
      const baseValue = 50; // Base expected order value
      const engagementMultiplier = 1 + engagementScore;
      const activityMultiplier = Math.log(visits + 1) / 5;
      
      predictedLTV = baseValue * engagementMultiplier * activityMultiplier;
    }
    
    return Math.max(0, predictedLTV);
  }

  // Advanced utility methods
  private calculateBehaviorMetrics(sessions: any[], interactions: any[]): any {
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalPageViews = sessions.reduce((sum, s) => sum + (s.pageViews || 0), 0);
    
    return {
      avgSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
      pagesPerSession: totalSessions > 0 ? totalPageViews / totalSessions : 0,
      bounceRate: totalSessions > 0 ? sessions.filter(s => s.pageViews === 1).length / totalSessions : 0,
      sessionFrequency: totalSessions,
      mobileSessionRatio: totalSessions > 0 ? 
        sessions.filter(s => s.device === 'mobile').length / totalSessions : 0
    };
  }

  private calculatePurchaseMetrics(purchases: any[]): any {
    if (purchases.length === 0) {
      return {
        lifetimeValue: 0,
        avgOrderValue: 0,
        purchaseFrequency: 0,
        daysSinceLastPurchase: null,
        firstOrderValue: 0
      };
    }
    
    const totalValue = purchases.reduce((sum, p) => sum + p.amount, 0);
    const lastPurchase = Math.max(...purchases.map(p => new Date(p.date).getTime()));
    const daysSinceLastPurchase = Math.floor((Date.now() - lastPurchase) / (1000 * 60 * 60 * 24));
    
    return {
      lifetimeValue: totalValue,
      avgOrderValue: totalValue / purchases.length,
      purchaseFrequency: purchases.length,
      daysSinceLastPurchase,
      firstOrderValue: purchases.length > 0 ? purchases[0].amount : 0
    };
  }

  private calculateEngagementMetrics(interactions: any[]): any {
    const productViews = interactions.filter(i => i.type === 'product_view');
    const cartAdditions = interactions.filter(i => i.type === 'add_to_cart');
    const discountInteractions = interactions.filter(i => i.type === 'discount_interaction');
    
    const totalViewTime = productViews.reduce((sum, i) => sum + (i.duration || 0), 0);
    const avgProductViewTime = productViews.length > 0 ? totalViewTime / productViews.length : 0;
    
    return {
      engagementScore: this.calculateEngagementScore(interactions),
      productViewTime: avgProductViewTime,
      cartAdditions: cartAdditions.length,
      discountInteraction: discountInteractions.length / Math.max(interactions.length, 1),
      recentEngagementScore: this.calculateRecentEngagementScore(interactions),
      engagementTrend: this.calculateEngagementTrend(interactions),
      premiumCategoryInterest: this.calculatePremiumInterest(interactions)
    };
  }

  private calculateEngagementScore(interactions: any[]): number {
    if (interactions.length === 0) return 0;
    
    let score = 0;
    const weights = {
      'page_view': 0.1,
      'product_view': 0.2,
      'add_to_cart': 0.4,
      'purchase': 0.6,
      'review': 0.3,
      'share': 0.2
    };
    
    interactions.forEach(interaction => {
      const weight = weights[interaction.type as keyof typeof weights] || 0.1;
      score += weight;
    });
    
    return Math.min(1, score / 10); // Normalize to 0-1
  }

  private calculateRecentEngagementScore(interactions: any[]): number {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentInteractions = interactions.filter(i => 
      new Date(i.timestamp).getTime() > thirtyDaysAgo
    );
    
    return this.calculateEngagementScore(recentInteractions);
  }

  private calculateEngagementTrend(interactions: any[]): number {
    if (interactions.length < 2) return 0.5;
    
    const sorted = interactions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const halfPoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, halfPoint);
    const secondHalf = sorted.slice(halfPoint);
    
    const firstScore = this.calculateEngagementScore(firstHalf);
    const secondScore = this.calculateEngagementScore(secondHalf);
    
    // Return trend: >0.5 improving, <0.5 declining
    return secondScore > firstScore ? 0.8 : 0.2;
  }

  private calculatePremiumInterest(interactions: any[]): number {
    const premiumCategories = ['luxury', 'premium', 'high-end', 'designer'];
    const premiumInteractions = interactions.filter(i => 
      i.category && premiumCategories.some(cat => 
        i.category.toLowerCase().includes(cat)
      )
    );
    
    return interactions.length > 0 ? premiumInteractions.length / interactions.length : 0;
  }

  private determineLifecycleStage(behavior: any, purchases: any[]): LifecycleStage {
    const daysSinceLastVisit = behavior.daysSinceLastVisit || 0;
    const totalPurchases = purchases.length;
    
    if (totalPurchases === 0 && behavior.totalVisits <= 2) return 'new';
    if (totalPurchases >= 10) return 'vip';
    if (daysSinceLastVisit > 90) return 'churned';
    if (daysSinceLastVisit > 30) return 'at_risk';
    if (totalPurchases > 0) return 'returning';
    
    return 'active';
  }

  private determineIntentLevel(interactions: any[], context: any): IntentLevel {
    const cartAdditions = interactions.filter(i => i.type === 'add_to_cart').length;
    const productViews = interactions.filter(i => i.type === 'product_view').length;
    const timeOnPage = context.timeOnPage || 0;
    
    if (cartAdditions > 0 || context.currentPage?.includes('checkout')) return 'high_intent';
    if (productViews > 3 && timeOnPage > 120) return 'medium_intent';
    if (interactions.some(i => i.type === 'discount_interaction')) return 'price_sensitive';
    if (productViews > 5) return 'browsers';
    
    return 'research_mode';
  }

  private async derivePsychographics(interactions: any[], purchases: any[]): Promise<any> {
    return {
      priceConsciousness: this.calculatePriceConsciousness(interactions, purchases),
      brandLoyalty: this.calculateBrandLoyalty(purchases),
      innovatorProfile: this.calculateInnovatorProfile(interactions),
      socialInfluence: this.calculateSocialInfluence(interactions)
    };
  }

  private calculatePriceConsciousness(interactions: any[], purchases: any[]): number {
    const discountInteractions = interactions.filter(i => i.type === 'discount_interaction').length;
    const totalInteractions = interactions.length;
    const discountPurchases = purchases.filter(p => p.discountUsed).length;
    
    if (totalInteractions === 0) return 0.5;
    
    return (discountInteractions / totalInteractions + (discountPurchases / Math.max(purchases.length, 1))) / 2;
  }

  private calculateBrandLoyalty(purchases: any[]): number {
    if (purchases.length < 2) return 0.5;
    
    const brands = purchases.map(p => p.brand).filter(Boolean);
    const uniqueBrands = new Set(brands).size;
    
    return 1 - (uniqueBrands / brands.length);
  }

  private calculateInnovatorProfile(interactions: any[]): number {
    const newProductViews = interactions.filter(i => 
      i.type === 'product_view' && i.isNewProduct
    ).length;
    
    return interactions.length > 0 ? newProductViews / interactions.length : 0.5;
  }

  private calculateSocialInfluence(interactions: any[]): number {
    const socialActions = interactions.filter(i => 
      ['share', 'review', 'social_login'].includes(i.type)
    ).length;
    
    return interactions.length > 0 ? socialActions / interactions.length : 0.5;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async evaluateMLCondition(condition: SegmentCondition, userData: any): Promise<{
    matches: boolean;
    confidence: number;
  }> {
    try {
      const model = this.mlModels.get(condition.field);
      if (!model) {
        return { matches: false, confidence: 0 };
      }
      
      const features = this.extractFeatureVector(userData);
      const prediction = await this.runMLPrediction(model, features);
      
      return {
        matches: prediction.score > (condition.confidence || 0.7),
        confidence: prediction.score
      };
    } catch (error) {
      console.error('ML condition evaluation error:', error);
      return { matches: false, confidence: 0 };
    }
  }

  private async runMLPrediction(model: MLModel, features: number[]): Promise<{ score: number }> {
    // Placeholder for ML prediction
    // In production, this would call TensorFlow.js or ML API
    return { score: Math.random() };
  }

  // Cache and performance methods
  private async getCachedResult(userId: string): Promise<any> {
    const cached = await this.redis.get(`segment_result:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheSegmentationResult(userId: string, result: any): Promise<void> {
    this.segmentCache.set(userId, new Set(result.segments));
    this.realTimeUpdates.set(userId, new Date());
    
    await this.redis.setex(
      `segment_result:${userId}`,
      this.config.cacheTimeout || 3600,
      JSON.stringify(result)
    );
  }

  private async combineSegmentationResults(
    ruleBasedSegments: any,
    clusterSegments: string[],
    predictions: any,
    userData: any
  ): Promise<any> {
    return {
      segments: [...ruleBasedSegments.segments, ...clusterSegments],
      confidence: ruleBasedSegments.confidence,
      predictive: predictions,
      clusters: clusterSegments,
      timestamp: Date.now(),
      userId: userData.userId
    };
  }

  private async updateSegmentMetrics(segments: string[], userId: string): Promise<void> {
    for (const segmentId of segments) {
      const segment = this.segments.get(segmentId);
      if (segment) {
        segment.metadata.matchCount++;
        await this.redis.incr(`segment_metrics:${segmentId}:matches`);
      }
    }
  }

  private async storeSegmentHistory(userId: string, result: any): Promise<void> {
    const history = this.segmentHistory.get(userId) || [];
    history.push({
      timestamp: Date.now(),
      segments: result.segments,
      confidence: result.confidence,
      predictive: result.predictive
    });
    
    // Keep only last 50 entries
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.segmentHistory.set(userId, history);
    
    await this.redis.setex(
      `segment_history:${userId}`,
      86400 * 30, // 30 days
      JSON.stringify(history)
    );
  }

  private async getSupabaseUserData(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_demographics')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      return {};
    }
  }

  private async loadMLModels(): Promise<void> {
    // Load pre-trained models from storage
    const models = [
      'churn_prediction_model',
      'ltv_prediction_model',
      'price_sensitivity_classifier'
    ];
    
    for (const modelId of models) {
      try {
        const modelData = await this.redis.get(`ml_model:${modelId}`);
        if (modelData) {
          this.mlModels.set(modelId, JSON.parse(modelData));
        }
      } catch (error) {
        console.error(`Failed to load model ${modelId}:`, error);
      }
    }
  }

  private async initializeRealTimeTracking(): Promise<void> {
    // Set up real-time tracking intervals
    setInterval(() => {
      this.updateRealTimeSegments();
    }, this.config.realTimeUpdateInterval || 300000); // 5 minutes
  }

  private async updateRealTimeSegments(): Promise<void> {
    // Update segments for users with dynamic update enabled
    const dynamicSegments = Array.from(this.segments.values()).filter(s => s.dynamicUpdate);
    
    for (const [userId] of this.segmentCache) {
      try {
        const context = { userId, forceRefresh: true };
        await this.match(context);
      } catch (error) {
        console.error(`Real-time update failed for user ${userId}:`, error);
      }
    }
  }

  private async getClusterCentroids(): Promise<number[][] | null> {
    try {
      const data = await this.redis.get('cluster_centroids');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}