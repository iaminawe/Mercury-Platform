-- Visitor Segmentation System Migration
-- Advanced user segmentation with ML and real-time updates

-- User demographics and behavior tracking
CREATE TABLE IF NOT EXISTS user_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  age_range TEXT,
  gender TEXT,
  location JSONB,
  device_preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segment definitions
CREATE TABLE IF NOT EXISTS segment_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'behavioral', 'demographic', 'psychographic', etc.
  conditions JSONB NOT NULL,
  priority INTEGER DEFAULT 5,
  enabled BOOLEAN DEFAULT true,
  dynamic_update BOOLEAN DEFAULT false,
  ml_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- User segment assignments
CREATE TABLE IF NOT EXISTS user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.0,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'rule_based', -- 'rule_based', 'ml_clustering', 'predictive'
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Segment performance tracking
CREATE TABLE IF NOT EXISTS segment_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id TEXT NOT NULL,
  date DATE NOT NULL,
  user_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0.0,
  avg_order_value DECIMAL(10,2) DEFAULT 0.0,
  engagement_score DECIMAL(3,2) DEFAULT 0.0,
  churn_rate DECIMAL(5,4) DEFAULT 0.0,
  lifetime_value DECIMAL(10,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(segment_id, date)
);

-- User behavior events for segmentation
CREATE TABLE IF NOT EXISTS user_behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  page_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_type TEXT,
  location JSONB
);

-- ML model metadata
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'clustering', 'classification', 'prediction'
  algorithm TEXT NOT NULL,
  features TEXT[] DEFAULT '{}',
  accuracy DECIMAL(3,2) DEFAULT 0.0,
  version TEXT DEFAULT '1.0.0',
  trained_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Cluster analysis results
CREATE TABLE IF NOT EXISTS cluster_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  centroid DECIMAL[] DEFAULT '{}',
  distance DECIMAL(10,6) DEFAULT 0.0,
  confidence DECIMAL(3,2) DEFAULT 0.0,
  characteristics TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cohort analysis tracking
CREATE TABLE IF NOT EXISTS cohort_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_name TEXT NOT NULL,
  segment_id TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  retention_rate DECIMAL(5,4) DEFAULT 0.0,
  revenue DECIMAL(10,2) DEFAULT 0.0,
  active_users INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time session tracking
CREATE TABLE IF NOT EXISTS session_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  device_type TEXT,
  initial_page TEXT,
  current_segments TEXT[] DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.0,
  events_count INTEGER DEFAULT 0,
  predictive_data JSONB DEFAULT '{}'::jsonb,
  real_time_context JSONB DEFAULT '{}'::jsonb
);

-- Segment migration tracking
CREATE TABLE IF NOT EXISTS segment_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  from_segment TEXT,
  to_segment TEXT NOT NULL,
  migration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Predictive modeling results
CREATE TABLE IF NOT EXISTS predictive_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prediction_type TEXT NOT NULL, -- 'churn_risk', 'ltv', 'lifecycle_stage', 'intent_level'
  predicted_value DECIMAL(10,4),
  confidence DECIMAL(3,2) DEFAULT 0.0,
  prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_demographics_user_id ON user_demographics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_segments_user_id ON user_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_segments_segment_id ON user_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_user_segments_assigned_at ON user_segments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_segment_performance_segment_id ON segment_performance(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_performance_date ON segment_performance(date);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_user_id ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_session_id ON user_behavior_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_timestamp ON user_behavior_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_event_type ON user_behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cluster_analysis_user_id ON cluster_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_analysis_cluster_id ON cluster_analysis(cluster_id);
CREATE INDEX IF NOT EXISTS idx_session_tracking_user_id ON session_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tracking_session_id ON session_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_segment_migrations_user_id ON segment_migrations(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_results_user_id ON predictive_results(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_results_model_id ON predictive_results(model_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_segments_user_segment ON user_segments(user_id, segment_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_timestamp ON user_behavior_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_segment_performance_segment_date ON segment_performance(segment_id, date);

-- Create functions for segment statistics
CREATE OR REPLACE FUNCTION calculate_segment_stats(segment_id_param TEXT, date_param DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  user_count BIGINT,
  avg_confidence DECIMAL,
  conversion_rate DECIMAL,
  engagement_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT us.user_id)::BIGINT as user_count,
    AVG(us.confidence) as avg_confidence,
    COALESCE(sp.conversion_rate, 0.0) as conversion_rate,
    COALESCE(sp.engagement_score, 0.0) as engagement_score
  FROM user_segments us
  LEFT JOIN segment_performance sp ON sp.segment_id = segment_id_param AND sp.date = date_param
  WHERE us.segment_id = segment_id_param
    AND (us.expires_at IS NULL OR us.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current segments
CREATE OR REPLACE FUNCTION get_user_segments(user_id_param TEXT)
RETURNS TABLE (
  segment_id TEXT,
  confidence DECIMAL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.segment_id,
    us.confidence,
    us.assigned_at,
    us.source
  FROM user_segments us
  WHERE us.user_id = user_id_param
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.confidence DESC, us.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to track segment migration
CREATE OR REPLACE FUNCTION track_segment_migration(
  user_id_param TEXT,
  from_segment_param TEXT,
  to_segment_param TEXT,
  reason_param TEXT DEFAULT NULL,
  confidence_param DECIMAL DEFAULT 1.0
) RETURNS UUID AS $$
DECLARE
  migration_id UUID;
BEGIN
  INSERT INTO segment_migrations (user_id, from_segment, to_segment, reason, confidence)
  VALUES (user_id_param, from_segment_param, to_segment_param, reason_param, confidence_param)
  RETURNING id INTO migration_id;
  
  RETURN migration_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired segments
CREATE OR REPLACE FUNCTION cleanup_expired_segments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_segments 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_demographics_updated_at 
  BEFORE UPDATE ON user_demographics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segment_definitions_updated_at 
  BEFORE UPDATE ON segment_definitions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default segment definitions
INSERT INTO segment_definitions (segment_id, name, description, type, conditions, priority, enabled, dynamic_update, metadata) VALUES
('all_users', 'All Users', 'Base segment for all website visitors', 'behavioral', '{"all": [{"type": "behavior", "field": "totalVisits", "operator": "greater_than", "value": 0}]}', 1, true, false, '{"default": true}'),

('new_visitors', 'New Visitors', 'First-time visitors in their discovery phase', 'lifecycle', '{"all": [{"type": "behavior", "field": "behavior.totalVisits", "operator": "equals", "value": 1, "weight": 1.0}, {"type": "purchase", "field": "purchases.length", "operator": "equals", "value": 0, "weight": 1.0}]}', 8, true, true, '{"accuracy": 0.95, "precision": 0.92, "recall": 0.98, "f1Score": 0.95}'),

('high_intent_browsers', 'High Intent Browsers', 'Users showing strong purchase intent through behavior', 'behavioral', '{"all": [{"type": "behavior", "field": "engagementMetrics.productViewTime", "operator": "greater_than", "value": 120, "weight": 0.3}, {"type": "behavior", "field": "behavior.pagesPerSession", "operator": "greater_than", "value": 5, "weight": 0.2}], "any": [{"type": "behavior", "field": "realTimeContext.currentPage", "operator": "contains", "value": "checkout", "weight": 0.5}, {"type": "behavior", "field": "engagementMetrics.cartAdditions", "operator": "greater_than", "value": 1, "weight": 0.4}]}', 9, true, true, '{"accuracy": 0.85, "precision": 0.82, "recall": 0.88, "f1Score": 0.85}'),

('vip_customers', 'VIP Customers', 'High-value customers with exceptional loyalty', 'transactional', '{"all": [{"type": "purchase", "field": "purchaseMetrics.lifetimeValue", "operator": "greater_than", "value": 1000, "weight": 0.4}, {"type": "purchase", "field": "purchaseMetrics.avgOrderValue", "operator": "greater_than", "value": 150, "weight": 0.3}, {"type": "behavior", "field": "purchaseMetrics.purchaseFrequency", "operator": "greater_than", "value": 4, "weight": 0.3}]}', 10, true, true, '{"accuracy": 0.92, "precision": 0.89, "recall": 0.95, "f1Score": 0.92}'),

('price_sensitive_shoppers', 'Price-Sensitive Shoppers', 'Users who respond strongly to discounts and deals', 'psychographic', '{"any": [{"type": "behavior", "field": "engagementMetrics.discountInteraction", "operator": "greater_than", "value": 0.7, "weight": 0.4}, {"type": "behavior", "field": "behavior.couponUsage", "operator": "greater_than", "value": 2, "weight": 0.3}], "all": [{"type": "purchase", "field": "purchaseMetrics.avgOrderValue", "operator": "less_than", "value": 75, "weight": 0.3}]}', 7, true, true, '{"accuracy": 0.78, "precision": 0.75, "recall": 0.82, "f1Score": 0.78, "mlModel": "price_sensitivity_classifier"}'),

('at_risk_customers', 'At-Risk Customers', 'Customers showing signs of potential churn', 'predictive', '{"any": [{"type": "behavior", "field": "behavior.daysSinceLastVisit", "operator": "greater_than", "value": 30, "weight": 0.3}, {"type": "purchase", "field": "purchaseMetrics.daysSinceLastPurchase", "operator": "greater_than", "value": 60, "weight": 0.4}], "all": [{"type": "engagement", "field": "engagementMetrics.recentEngagementScore", "operator": "less_than", "value": 0.3, "weight": 0.3}]}', 9, true, true, '{"accuracy": 0.83, "precision": 0.79, "recall": 0.87, "f1Score": 0.83, "mlModel": "churn_prediction_model"}'),

('mobile_native_shoppers', 'Mobile-Native Shoppers', 'Users who prefer and excel at mobile shopping', 'demographic', '{"all": [{"type": "demographic", "field": "device.type", "operator": "equals", "value": "mobile", "weight": 0.4}, {"type": "behavior", "field": "behavior.mobileSessionRatio", "operator": "greater_than", "value": 0.8, "weight": 0.3}, {"type": "engagement", "field": "engagementMetrics.mobileConversionRate", "operator": "greater_than", "value": 0.05, "weight": 0.3}]}', 6, true, true, '{"accuracy": 0.91, "precision": 0.88, "recall": 0.94, "f1Score": 0.91}'),

('emerging_high_value', 'Emerging High-Value Prospects', 'Users showing early signs of becoming high-value customers', 'predictive', '{"all": [{"type": "behavior", "field": "behavior.totalVisits", "operator": "between", "value": [3, 10], "weight": 0.2}, {"type": "engagement", "field": "engagementMetrics.engagementTrend", "operator": "greater_than", "value": 0.6, "weight": 0.3}], "any": [{"type": "purchase", "field": "purchaseMetrics.firstOrderValue", "operator": "greater_than", "value": 100, "weight": 0.3}, {"type": "behavior", "field": "engagementMetrics.premiumCategoryInterest", "operator": "greater_than", "value": 0.7, "weight": 0.2}]}', 8, true, true, '{"accuracy": 0.74, "precision": 0.71, "recall": 0.78, "f1Score": 0.74, "mlModel": "ltv_prediction_model"}')

ON CONFLICT (segment_id) DO NOTHING;

-- Insert ML model definitions
INSERT INTO ml_models (model_id, name, type, algorithm, features, accuracy, version, metadata) VALUES
('churn_prediction_model', 'Customer Churn Prediction', 'classification', 'random_forest', ARRAY['daysSinceLastVisit', 'daysSinceLastPurchase', 'engagementScore', 'purchaseFrequency', 'avgOrderValue'], 0.83, '2.1.0', '{"training_date": "2024-07-15", "feature_importance": {"daysSinceLastVisit": 0.35, "engagementScore": 0.28, "daysSinceLastPurchase": 0.22}}'),

('ltv_prediction_model', 'Lifetime Value Prediction', 'prediction', 'neural_network', ARRAY['firstOrderValue', 'engagementScore', 'categoryInterest', 'devicePreference', 'sessionFrequency'], 0.74, '1.8.0', '{"training_date": "2024-07-10", "architecture": "3-layer-mlp", "neurons": [16, 8, 1]}'),

('price_sensitivity_classifier', 'Price Sensitivity Classification', 'classification', 'gradient_boosting', ARRAY['discountInteraction', 'couponUsage', 'avgOrderValue', 'priceComparison', 'dealEngagement'], 0.78, '1.5.0', '{"training_date": "2024-07-12", "boost_rounds": 100, "learning_rate": 0.1}')

ON CONFLICT (model_id) DO NOTHING;

-- Create materialized view for segment analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS segment_analytics_summary AS
SELECT 
  sd.segment_id,
  sd.name,
  sd.type,
  COUNT(DISTINCT us.user_id) as current_users,
  AVG(us.confidence) as avg_confidence,
  COALESCE(sp.conversion_rate, 0.0) as conversion_rate,
  COALESCE(sp.avg_order_value, 0.0) as avg_order_value,
  COALESCE(sp.engagement_score, 0.0) as engagement_score,
  COALESCE(sp.churn_rate, 0.0) as churn_rate,
  COUNT(ube.id) as total_events,
  sd.metadata
FROM segment_definitions sd
LEFT JOIN user_segments us ON sd.segment_id = us.segment_id 
  AND (us.expires_at IS NULL OR us.expires_at > NOW())
LEFT JOIN segment_performance sp ON sd.segment_id = sp.segment_id 
  AND sp.date = CURRENT_DATE
LEFT JOIN user_behavior_events ube ON us.user_id = ube.user_id 
  AND ube.timestamp > CURRENT_DATE - INTERVAL '30 days'
WHERE sd.enabled = true
GROUP BY sd.segment_id, sd.name, sd.type, sp.conversion_rate, sp.avg_order_value, sp.engagement_score, sp.churn_rate, sd.metadata;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_analytics_summary_segment_id 
ON segment_analytics_summary(segment_id);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_segment_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY segment_analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables and important columns
COMMENT ON TABLE user_demographics IS 'Stores demographic information for user segmentation';
COMMENT ON TABLE segment_definitions IS 'Defines segment rules and ML model associations';
COMMENT ON TABLE user_segments IS 'Current segment assignments for users with confidence scores';
COMMENT ON TABLE segment_performance IS 'Daily performance metrics for each segment';
COMMENT ON TABLE user_behavior_events IS 'Event tracking for behavioral segmentation';
COMMENT ON TABLE ml_models IS 'ML model metadata and performance tracking';
COMMENT ON TABLE cluster_analysis IS 'Results from ML clustering algorithms';
COMMENT ON TABLE predictive_results IS 'Predictions from ML models (churn, LTV, etc.)';

COMMENT ON COLUMN user_segments.confidence IS 'Confidence score (0.0-1.0) for segment assignment';
COMMENT ON COLUMN user_segments.source IS 'How the segment was assigned: rule_based, ml_clustering, predictive';
COMMENT ON COLUMN segment_definitions.dynamic_update IS 'Whether segment should be updated in real-time';
COMMENT ON COLUMN segment_definitions.ml_model IS 'Associated ML model ID for predictive segments';

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;