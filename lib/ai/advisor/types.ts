export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  metricName: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  timestamp: string;
  context: Record<string, any>;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'anomaly' | 'opportunity' | 'trend' | 'recommendation';
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'sales' | 'traffic' | 'conversion' | 'products' | 'customers';
  actionable: boolean;
  actions?: InsightAction[];
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface InsightAction {
  id: string;
  title: string;
  description: string;
  type: 'shopify_update' | 'price_change' | 'inventory_alert' | 'marketing_action' | 'custom';
  confidence: number;
  estimatedImpact: string;
  parameters: Record<string, any>;
  canAutoImplement: boolean;
}

export interface RecommendationEngine {
  generateRecommendations(data: any[], context: Record<string, any>): Promise<Insight[]>;
  scoreConfidence(recommendation: Insight): number;
}

export interface ConfidenceScore {
  overall: number;
  factors: {
    dataQuality: number;
    historicalAccuracy: number;
    contextRelevance: number;
    modelPerformance: number;
  };
  explanation: string;
}

export interface AdvisorQuestion {
  id: string;
  question: string;
  context?: Record<string, any>;
  storeId: string;
  createdAt: string;
}

export interface AdvisorAnswer {
  id: string;
  questionId: string;
  answer: string;
  confidence: number;
  sources: string[];
  relatedInsights: string[];
  createdAt: string;
}

export interface AdvisorMetrics {
  anomalyDetectionAccuracy: number;
  recommendationSuccessRate: number;
  userSatisfactionScore: number;
  totalInsightsGenerated: number;
  actionsImplemented: number;
  averageConfidenceScore: number;
}