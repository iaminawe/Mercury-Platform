/**
 * Core AI response types for the Mercury Shopify app
 */

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    model: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost: {
      prompt: number;
      completion: number;
      total: number;
      currency: string;
    };
    responseTime: number;
    requestId: string;
    timestamp: string;
  };
}

export interface StreamingAIResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason?: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Product Analysis Types
export interface ProductAnalysisRequest {
  productId: string;
  storeId: string;
  analysisType: 'seo' | 'description' | 'pricing' | 'competition' | 'optimization' | 'trends';
  context?: {
    targetMarket?: string;
    competitors?: string[];
    keywords?: string[];
    budget?: number;
    goals?: string[];
  };
}

export interface ProductSEOAnalysis {
  title: {
    current: string;
    optimized: string;
    score: number;
    improvements: string[];
  };
  description: {
    current: string;
    optimized: string;
    score: number;
    improvements: string[];
  };
  keywords: {
    primary: string[];
    secondary: string[];
    longTail: string[];
    missing: string[];
  };
  metaData: {
    metaTitle: string;
    metaDescription: string;
    altTexts: string[];
  };
  url: {
    current: string;
    optimized: string;
  };
  score: number;
  recommendations: Recommendation[];
}

export interface ProductDescriptionAnalysis {
  current: {
    text: string;
    score: number;
    issues: string[];
  };
  optimized: {
    text: string;
    improvements: string[];
    features: string[];
  };
  copywriting: {
    tone: string;
    readabilityScore: number;
    emotionalTriggers: string[];
    persuasionElements: string[];
  };
  formatting: {
    structure: string[];
    bulletPoints: string[];
    headers: string[];
  };
  recommendations: Recommendation[];
}

export interface ProductPricingAnalysis {
  current: {
    price: number;
    margin: number;
    competitiveness: 'low' | 'competitive' | 'high';
  };
  recommended: {
    price: number;
    reasoning: string;
    expectedImpact: {
      revenue: number;
      margin: number;
      salesVolume: number;
    };
  };
  psychological: {
    priceAnchoring: number;
    bundleOpportunities: string[];
    discountStrategies: string[];
  };
  competitive: {
    position: 'lowest' | 'below-average' | 'average' | 'above-average' | 'highest';
    nearestCompetitors: Array<{
      name: string;
      price: number;
      difference: number;
    }>;
  };
  recommendations: Recommendation[];
}

export interface CompetitorAnalysis {
  competitor: {
    name: string;
    url?: string;
    marketPosition: string;
  };
  comparison: {
    price: { ours: number; theirs: number; advantage: 'ours' | 'theirs' | 'neutral' };
    features: { ours: string[]; theirs: string[]; unique: string[]; missing: string[] };
    marketing: { ourApproach: string; theirApproach: string; opportunities: string[] };
    reviews: { ourRating: number; theirRating: number; sentimentComparison: string };
  };
  opportunities: {
    differentiation: string[];
    priceOptimization: string[];
    featureGaps: string[];
    marketingAngles: string[];
  };
  threats: {
    competitiveAdvantages: string[];
    marketShare: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

// Customer Analysis Types
export interface CustomerAnalysisRequest {
  customerId?: string;
  storeId: string;
  analysisType: 'behavior' | 'segmentation' | 'lifetime_value' | 'churn_prediction' | 'sentiment';
  timeframe?: {
    start: string;
    end: string;
  };
  context?: {
    segment?: string;
    products?: string[];
    channels?: string[];
  };
}

export interface CustomerBehaviorAnalysis {
  profile: {
    customerId: string;
    segment: string;
    lifetimeValue: number;
    acquisitionDate: string;
    lastActivity: string;
  };
  purchasing: {
    frequency: number;
    averageOrderValue: number;
    preferredCategories: string[];
    seasonalPatterns: Array<{
      period: string;
      activity: number;
    }>;
  };
  engagement: {
    emailOpenRate: number;
    clickThroughRate: number;
    websiteActivity: number;
    socialEngagement: number;
  };
  predictions: {
    nextPurchaseProbability: number;
    churnRisk: 'low' | 'medium' | 'high';
    recommendedProducts: string[];
    optimalContactTime: string;
  };
  recommendations: Recommendation[];
}

export interface CustomerSegmentation {
  segments: Array<{
    id: string;
    name: string;
    description: string;
    size: number;
    percentage: number;
    characteristics: {
      demographics: Record<string, any>;
      behavior: Record<string, any>;
      preferences: Record<string, any>;
    };
    value: {
      averageLifetimeValue: number;
      averageOrderValue: number;
      frequency: number;
    };
    marketing: {
      preferredChannels: string[];
      optimalTiming: string[];
      messageStyle: string;
      offers: string[];
    };
  }>;
  recommendations: {
    highValueSegments: string[];
    growthOpportunities: string[];
    retentionFocus: string[];
    acquisitionTargets: string[];
  };
}

// Marketing Analysis Types
export interface MarketingAnalysisRequest {
  storeId: string;
  campaignType: 'email' | 'social' | 'paid_ads' | 'content' | 'seo';
  target?: {
    audience: string;
    products: string[];
    goals: string[];
    budget?: number;
  };
  context?: {
    previousCampaigns?: any[];
    seasonality?: string;
    competitors?: string[];
  };
}

export interface EmailCampaignAnalysis {
  campaign: {
    type: string;
    target: string;
    goals: string[];
  };
  content: {
    subjectLines: Array<{
      text: string;
      score: number;
      reasoning: string;
    }>;
    emailBody: {
      structure: string[];
      copy: string;
      callsToAction: string[];
    };
    personalization: {
      elements: string[];
      dynamicContent: string[];
    };
  };
  strategy: {
    sendTime: string;
    frequency: string;
    segmentation: string[];
    abTesting: string[];
  };
  predictions: {
    openRate: number;
    clickRate: number;
    conversionRate: number;
    unsubscribeRate: number;
  };
  recommendations: Recommendation[];
}

export interface SocialMediaStrategy {
  platforms: Array<{
    name: string;
    priority: 'high' | 'medium' | 'low';
    audience: string;
    contentTypes: string[];
    postingFrequency: string;
  }>;
  content: {
    themes: string[];
    calendar: Array<{
      date: string;
      platform: string;
      contentType: string;
      caption: string;
      hashtags: string[];
      visualGuidelines: string[];
    }>;
  };
  engagement: {
    strategies: string[];
    communityBuilding: string[];
    userGeneratedContent: string[];
  };
  metrics: {
    kpis: string[];
    trackingMethods: string[];
    reportingFrequency: string;
  };
  recommendations: Recommendation[];
}

// Analytics and Insights Types
export interface AnalyticsRequest {
  storeId: string;
  analysisType: 'performance' | 'trends' | 'forecasting' | 'anomaly_detection';
  timeframe: {
    start: string;
    end: string;
  };
  metrics?: string[];
  context?: {
    compareToIndustry?: boolean;
    includePredictions?: boolean;
    granularity?: 'daily' | 'weekly' | 'monthly';
  };
}

export interface PerformanceAnalysis {
  summary: {
    period: string;
    revenue: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    orders: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    customers: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    conversionRate: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
  detailed: {
    sales: {
      byProduct: Array<{ productId: string; revenue: number; quantity: number }>;
      byChannel: Array<{ channel: string; revenue: number; orders: number }>;
      byRegion: Array<{ region: string; revenue: number; customers: number }>;
    };
    customers: {
      acquisition: { new: number; returning: number; ratio: number };
      retention: { rate: number; cohortAnalysis: any[] };
      lifetime: { averageValue: number; segments: any[] };
    };
    products: {
      topPerformers: string[];
      underperformers: string[];
      inventory: { turnover: number; stockouts: number };
    };
  };
  insights: Insight[];
  recommendations: Recommendation[];
}

export interface TrendAnalysis {
  trends: Array<{
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    strength: 'weak' | 'moderate' | 'strong';
    significance: number;
    description: string;
  }>;
  seasonal: {
    patterns: Array<{
      period: string;
      impact: number;
      description: string;
    }>;
    predictions: Array<{
      period: string;
      expectedValue: number;
      confidence: number;
    }>;
  };
  market: {
    position: string;
    opportunities: string[];
    threats: string[];
  };
  recommendations: Recommendation[];
}

export interface ForecastingAnalysis {
  forecasts: Array<{
    metric: string;
    period: string;
    predictedValue: number;
    confidence: number;
    range: { min: number; max: number };
    factors: string[];
  }>;
  scenarios: {
    optimistic: { description: string; impact: number };
    realistic: { description: string; impact: number };
    pessimistic: { description: string; impact: number };
  };
  recommendations: {
    inventory: string[];
    marketing: string[];
    staffing: string[];
    strategic: string[];
  };
}

// Shared Types
export interface Recommendation {
  id: string;
  type: 'immediate' | 'short_term' | 'long_term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  implementation: {
    steps: string[];
    effort: 'low' | 'medium' | 'high';
    timeframe: string;
    cost: 'free' | 'low' | 'medium' | 'high';
  };
  expectedImpact: {
    metric: string;
    change: number;
    confidence: number;
  };
  risks: string[];
}

export interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'anomaly';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: {
    metric: string;
    value: number;
    change?: number;
    benchmark?: number;
  };
  actions: string[];
  confidence: number;
  createdAt: string;
}

// Error Types
export interface AIError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

export interface AIErrorTypes {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED';
  INVALID_INPUT: 'INVALID_INPUT';
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE';
  TIMEOUT: 'TIMEOUT';
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS';
  CONTENT_FILTERED: 'CONTENT_FILTERED';
  UNKNOWN_ERROR: 'UNKNOWN_ERROR';
}

// Configuration Types
export interface AIServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    embeddingModel: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
  };
  langchain: {
    apiKey?: string;
    tracing: boolean;
  };
  vectorStore: {
    enabled: boolean;
    dimensions: number;
    similarity: 'cosine' | 'euclidean' | 'dot_product';
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    burstAllowance: number;
  };
  costs: {
    trackUsage: boolean;
    alertThreshold: number;
    currency: string;
  };
  quality: {
    confidenceThreshold: number;
    enableValidation: boolean;
    enableSafetyCheck: boolean;
  };
}

// Usage Tracking Types
export interface UsageMetrics {
  period: string;
  requests: {
    total: number;
    successful: number;
    failed: number;
    byModel: Record<string, number>;
  };
  tokens: {
    total: number;
    prompt: number;
    completion: number;
    byModel: Record<string, number>;
  };
  costs: {
    total: number;
    byModel: Record<string, number>;
    currency: string;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  };
}

// Health Check Types
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: {
    apiKey: boolean;
    modelAccess: boolean;
    vectorStore: boolean;
    rateLimits: boolean;
  };
  error?: string;
  timestamp: string;
}

// Export utility type helpers
export type AIAnalysisType = 
  | ProductAnalysisRequest['analysisType']
  | CustomerAnalysisRequest['analysisType']
  | MarketingAnalysisRequest['campaignType']
  | AnalyticsRequest['analysisType'];

export type AIResponseData = 
  | ProductSEOAnalysis
  | ProductDescriptionAnalysis
  | ProductPricingAnalysis
  | CustomerBehaviorAnalysis
  | CustomerSegmentation
  | EmailCampaignAnalysis
  | SocialMediaStrategy
  | PerformanceAnalysis
  | TrendAnalysis
  | ForecastingAnalysis;