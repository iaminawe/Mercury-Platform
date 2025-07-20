-- AI Advisor Tables

-- Store advisor insights
CREATE TABLE advisor_insights (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('anomaly', 'opportunity', 'trend', 'recommendation')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('sales', 'traffic', 'conversion', 'products', 'customers')),
  actionable BOOLEAN NOT NULL DEFAULT FALSE,
  actions JSONB,
  data JSONB,
  confidence_score JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store advisor questions from users
CREATE TABLE advisor_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  question TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store advisor answers to questions
CREATE TABLE advisor_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES advisor_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sources TEXT[] DEFAULT '{}',
  related_insights TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store implemented actions
CREATE TABLE advisor_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  result JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  implemented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store advisor performance metrics
CREATE TABLE advisor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_advisor_insights_store_id ON advisor_insights(store_id);
CREATE INDEX idx_advisor_insights_priority ON advisor_insights(priority);
CREATE INDEX idx_advisor_insights_category ON advisor_insights(category);
CREATE INDEX idx_advisor_insights_created_at ON advisor_insights(created_at);

CREATE INDEX idx_advisor_questions_store_id ON advisor_questions(store_id);
CREATE INDEX idx_advisor_questions_created_at ON advisor_questions(created_at);

CREATE INDEX idx_advisor_answers_question_id ON advisor_answers(question_id);
CREATE INDEX idx_advisor_answers_created_at ON advisor_answers(created_at);

CREATE INDEX idx_advisor_implementations_store_id ON advisor_implementations(store_id);
CREATE INDEX idx_advisor_implementations_insight_id ON advisor_implementations(insight_id);
CREATE INDEX idx_advisor_implementations_status ON advisor_implementations(status);
CREATE INDEX idx_advisor_implementations_implemented_at ON advisor_implementations(implemented_at);

CREATE INDEX idx_advisor_metrics_store_id ON advisor_metrics(store_id);
CREATE INDEX idx_advisor_metrics_type ON advisor_metrics(metric_type);
CREATE INDEX idx_advisor_metrics_recorded_at ON advisor_metrics(recorded_at);

-- RLS Policies (assuming store_id corresponds to authenticated user's store)
ALTER TABLE advisor_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_metrics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your auth system)
CREATE POLICY "Users can access their store's insights" ON advisor_insights
  FOR ALL USING (store_id = current_user_store_id());

CREATE POLICY "Users can access their store's questions" ON advisor_questions
  FOR ALL USING (store_id = current_user_store_id());

CREATE POLICY "Users can access their store's answers" ON advisor_answers
  FOR ALL USING (
    question_id IN (
      SELECT id FROM advisor_questions WHERE store_id = current_user_store_id()
    )
  );

CREATE POLICY "Users can access their store's implementations" ON advisor_implementations
  FOR ALL USING (store_id = current_user_store_id());

CREATE POLICY "Users can access their store's metrics" ON advisor_metrics
  FOR ALL USING (store_id = current_user_store_id());

-- Function to get current user's store ID (implement based on your auth system)
CREATE OR REPLACE FUNCTION current_user_store_id()
RETURNS TEXT AS $$
BEGIN
  -- This should return the store_id for the current authenticated user
  -- Implement based on your authentication system
  RETURN auth.jwt() ->> 'store_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;