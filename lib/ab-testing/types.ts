// A/B Testing Framework Types
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  type: ExperimentType;
  traffic_allocation: number;
  start_date: Date;
  end_date?: Date;
  hypothesis: string;
  success_metrics: SuccessMetric[];
  variants: Variant[];
  targeting_rules: TargetingRule[];
  statistical_config: StatisticalConfig;
  results?: ExperimentResults;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface Variant {
  id: string;
  name: string;
  description: string;
  traffic_percentage: number;
  is_control: boolean;
  config: VariantConfig;
  performance?: VariantPerformance;
  experiment_id?: string;
  created_at?: Date;
  updated_at?: Date;
  archived?: boolean;
  archived_at?: Date;
}

export interface VariantConfig {
  type: 'code_change' | 'feature_flag' | 'ui_component' | 'email_template' | 'pricing';
  changes: Record<string, any>;
  feature_flags?: Record<string, boolean>;
  ui_overrides?: Record<string, any>;
  email_template_id?: string;
  pricing_changes?: PricingConfig;
}

export interface PricingConfig {
  product_id?: string;
  discount_percentage?: number;
  discount_amount?: number;
  price_override?: number;
  shipping_changes?: Record<string, any>;
}

export interface SuccessMetric {
  id: string;
  name: string;
  type: MetricType;
  event_name: string;
  description: string;
  is_primary: boolean;
  goal_direction: 'increase' | 'decrease';
  threshold?: number;
  conversion_window_hours: number;
}

export interface TargetingRule {
  id: string;
  name: string;
  condition_type: 'user_property' | 'session_property' | 'custom_event' | 'geographic' | 'device';
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  property_name: string;
  property_value: any;
  inclusion: boolean; // true = include, false = exclude
}

export interface StatisticalConfig {
  confidence_level: number; // 0.95 for 95%
  minimum_sample_size: number;
  minimum_detectable_effect: number; // Percentage
  power: number; // Statistical power (typically 0.8)
  sequential_testing: boolean;
  bayesian_analysis: boolean;
  multiple_comparisons_correction: 'bonferroni' | 'benjamini_hochberg' | 'none';
}

export interface ExperimentResults {
  total_participants: number;
  conversion_rates: Record<string, ConversionResult>;
  statistical_significance: StatisticalSignificance;
  confidence_intervals: Record<string, ConfidenceInterval>;
  p_values: Record<string, number>;
  effect_sizes: Record<string, number>;
  recommendations: string[];
  winner?: string;
  lift: Record<string, number>;
  revenue_impact: number;
  last_updated: Date;
}

export interface ConversionResult {
  variant_id: string;
  participants: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  average_order_value: number;
  sessions: number;
  bounce_rate: number;
}

export interface StatisticalSignificance {
  is_significant: boolean;
  confidence_level: number;
  p_value: number;
  test_type: 'two_tailed' | 'one_tailed';
  sample_size_reached: boolean;
  minimum_runtime_met: boolean;
}

export interface ConfidenceInterval {
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
}

export interface ExperimentEvent {
  id: string;
  experiment_id: string;
  variant_id: string;
  user_id: string;
  session_id: string;
  event_type: EventType;
  event_name: string;
  properties: Record<string, any>;
  revenue?: number;
  timestamp: Date;
  user_agent?: string;
  ip_address?: string;
  page_url?: string;
}

export interface UserSegment {
  user_id: string;
  experiment_id: string;
  variant_id: string;
  assigned_at: Date;
  sticky_bucketing: boolean;
  user_properties: Record<string, any>;
  session_properties: Record<string, any>;
}

export interface ExperimentAnalysis {
  experiment_id: string;
  analysis_type: 'frequentist' | 'bayesian';
  results: AnalysisResult[];
  recommendations: Recommendation[];
  risk_assessment: RiskAssessment;
  sample_size_analysis: SampleSizeAnalysis;
  generated_at: Date;
}

export interface AnalysisResult {
  metric_id: string;
  metric_name: string;
  control_value: number;
  treatment_values: Record<string, number>;
  lift: Record<string, number>;
  p_value: number;
  confidence_interval: ConfidenceInterval;
  is_significant: boolean;
  effect_size: number;
  practical_significance: boolean;
}

export interface Recommendation {
  type: 'continue' | 'stop' | 'extend' | 'winner' | 'inconclusive';
  reason: string;
  confidence: number;
  suggested_action: string;
  impact_estimate: number;
}

export interface RiskAssessment {
  current_risk: number; // Probability of false positive
  estimated_loss: number; // Potential revenue loss
  confidence_in_result: number;
  sample_size_adequacy: 'insufficient' | 'adequate' | 'excellent';
}

export interface SampleSizeAnalysis {
  current_sample_size: number;
  required_sample_size: number;
  days_to_significance: number;
  power_achieved: number;
  mde_achieved: number; // Minimum Detectable Effect achieved
}

export interface MLOptimization {
  experiment_id: string;
  optimization_type: 'traffic_allocation' | 'early_stopping' | 'segment_targeting';
  model_type: 'bandit' | 'bayesian_optimization' | 'reinforcement_learning';
  parameters: Record<string, any>;
  performance_metrics: Record<string, number>;
  last_updated: Date;
}

// Enums
export enum ExperimentStatus {
  DRAFT = 'draft',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum ExperimentType {
  AB_TEST = 'ab_test',
  MULTIVARIATE = 'multivariate',
  MULTI_ARMED_BANDIT = 'multi_armed_bandit',
  SEQUENTIAL = 'sequential',
  FEATURE_FLAG = 'feature_flag'
}

export enum MetricType {
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  ENGAGEMENT = 'engagement',
  RETENTION = 'retention',
  CUSTOM = 'custom'
}

export enum EventType {
  EXPOSURE = 'exposure',
  CONVERSION = 'conversion',
  PURCHASE = 'purchase',
  CLICK = 'click',
  VIEW = 'view',
  CUSTOM = 'custom',
  GOAL = 'goal',
  REVENUE = 'revenue'
}

// Feature-specific experiment types
export interface ProductPageExperiment extends Experiment {
  type: ExperimentType.AB_TEST;
  page_elements: {
    hero_image?: boolean;
    product_description?: boolean;
    pricing_display?: boolean;
    add_to_cart_button?: boolean;
    reviews_section?: boolean;
    recommendations?: boolean;
  };
}

export interface EmailCampaignExperiment extends Experiment {
  type: ExperimentType.AB_TEST;
  email_elements: {
    subject_line?: boolean;
    sender_name?: boolean;
    content_layout?: boolean;
    cta_button?: boolean;
    personalization?: boolean;
    send_time?: boolean;
  };
}

export interface CheckoutFlowExperiment extends Experiment {
  type: ExperimentType.AB_TEST;
  checkout_elements: {
    form_fields?: boolean;
    payment_options?: boolean;
    guest_checkout?: boolean;
    progress_indicator?: boolean;
    shipping_options?: boolean;
    trust_signals?: boolean;
  };
}

export interface SearchRankingExperiment extends Experiment {
  type: ExperimentType.AB_TEST;
  ranking_factors: {
    relevance_weight?: number;
    popularity_weight?: number;
    recency_weight?: number;
    price_weight?: number;
    rating_weight?: number;
    personalization_weight?: number;
  };
}

export interface PersonalizationExperiment extends Experiment {
  type: ExperimentType.MULTI_ARMED_BANDIT;
  personalization_elements: {
    product_recommendations?: boolean;
    content_ordering?: boolean;
    pricing_display?: boolean;
    promotion_targeting?: boolean;
    email_frequency?: boolean;
    ui_customization?: boolean;
  };
}

// API Response Types
export interface ExperimentResponse {
  success: boolean;
  data?: Experiment;
  error?: string;
}

export interface ExperimentListResponse {
  success: boolean;
  data?: {
    experiments: Experiment[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

export interface ExperimentAnalysisResponse {
  success: boolean;
  data?: ExperimentAnalysis;
  error?: string;
}

// Additional types for variant modifications and goals
export interface VariantModification {
  type: 'element' | 'text' | 'style' | 'redirect' | 'code' | 'feature_flag';
  target?: string; // CSS selector or element ID
  action?: string; // Action to perform (hide, show, replace, etc.)
  value?: any; // Value to apply
  code?: string; // Custom code for code modifications
}

export interface Goal {
  id: string;
  name: string;
  type: 'conversion' | 'engagement' | 'revenue' | 'custom';
  target?: string; // URL pattern or event name
  value?: number; // For revenue goals
  metadata?: Record<string, any>;
}

export interface VariantPerformance {
  impressions: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  average_order_value: number;
  confidence_interval: ConfidenceInterval;
  statistical_significance: boolean;
  lift: number;
  last_updated: Date;
}