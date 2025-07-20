-- Email Marketing System Tables

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('newsletter', 'welcome', 'abandoned_cart', 'product_recommendation', 'win_back', 'promotional', 'transactional')),
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    thumbnail_url TEXT,
    variables TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES email_templates(id),
    subject_line VARCHAR(255) NOT NULL,
    from_name VARCHAR(100) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    reply_to VARCHAR(255),
    schedule_type VARCHAR(20) DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled', 'recurring')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    recurring_pattern JSONB,
    segment_id UUID, -- References customer_segments
    ab_test_id UUID, -- References ab_tests
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')),
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_rate DECIMAL(5,2) DEFAULT 0,
    click_rate DECIMAL(5,2) DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    unsubscribe_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Email Sends (individual email tracking)
CREATE TABLE IF NOT EXISTS email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255), -- External email service ID
    campaign_id UUID REFERENCES email_campaigns(id),
    template_id UUID REFERENCES email_templates(id),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
    customer_data JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    complained_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Email Events (detailed tracking)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Segments
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    customer_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Tests
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    campaign_id UUID REFERENCES email_campaigns(id),
    test_type VARCHAR(20) NOT NULL CHECK (test_type IN ('subject_line', 'content', 'send_time', 'from_name', 'full_email')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    confidence_level INTEGER DEFAULT 95,
    minimum_sample_size INTEGER DEFAULT 100,
    winner_variant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Test Variants
CREATE TABLE IF NOT EXISTS ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject_line VARCHAR(255),
    content TEXT,
    send_time TIME,
    from_name VARCHAR(100),
    weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100)
);

-- A/B Test Assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_id VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_id, recipient_email)
);

-- A/B Test Results
CREATE TABLE IF NOT EXISTS ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_id VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('send', 'open', 'click', 'conversion')),
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Flows (Automation sequences)
CREATE TABLE IF NOT EXISTS email_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(50) NOT NULL CHECK (trigger_event IN ('signup', 'purchase', 'cart_abandonment', 'win_back', 'birthday', 'custom')),
    trigger_conditions JSONB,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Flow Steps
CREATE TABLE IF NOT EXISTS email_flow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID REFERENCES email_flows(id) ON DELETE CASCADE,
    step_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES email_templates(id),
    delay_hours INTEGER NOT NULL DEFAULT 0,
    delay_type VARCHAR(10) DEFAULT 'hours' CHECK (delay_type IN ('hours', 'days', 'weeks')),
    conditions JSONB,
    ab_test_enabled BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL
);

-- Email Flow Executions
CREATE TABLE IF NOT EXISTS email_flow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID REFERENCES email_flows(id),
    customer_id UUID NOT NULL, -- References customers table
    trigger_data JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
    current_step_index INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_step_sent_at TIMESTAMP WITH TIME ZONE
);

-- Email Triggers (Automation rules)
CREATE TABLE IF NOT EXISTS email_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event VARCHAR(100) NOT NULL,
    flow_id VARCHAR(50) NOT NULL,
    delay_hours INTEGER DEFAULT 0,
    conditions JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Preferences
CREATE TABLE IF NOT EXISTS email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL, -- References customers table
    newsletter BOOLEAN DEFAULT TRUE,
    promotions BOOLEAN DEFAULT TRUE,
    product_updates BOOLEAN DEFAULT TRUE,
    order_updates BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'never')),
    unsubscribed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id)
);

-- AI Generated Content (for learning and optimization)
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    request_data JSONB NOT NULL,
    generated_content JSONB NOT NULL,
    performance_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Analytics (aggregated data)
CREATE TABLE IF NOT EXISTS email_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) NOT NULL CHECK (period IN ('day', 'week', 'month', 'quarter', 'year')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    campaign_id UUID REFERENCES email_campaigns(id),
    template_id UUID REFERENCES email_templates(id),
    metrics JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(period, start_date, campaign_id, template_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_events_email_id ON email_events(email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_flow_executions_customer_id ON email_flow_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_flow_executions_status ON email_flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_recipient ON ab_test_assignments(test_id, recipient_email);

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamps
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_segments_updated_at BEFORE UPDATE ON customer_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ab_tests_updated_at BEFORE UPDATE ON ab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_flows_updated_at BEFORE UPDATE ON email_flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_triggers_updated_at BEFORE UPDATE ON email_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_preferences_updated_at BEFORE UPDATE ON email_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data for email templates
INSERT INTO email_templates (name, type, subject, html_content, variables, status) VALUES
(
    'Welcome Email - Step 1',
    'welcome',
    'Welcome to Mercury, {{firstName}}! 🎉',
    '<h1>Welcome to Mercury, {{firstName}}!</h1><p>We''re thrilled to have you join our community!</p>',
    ARRAY['firstName', 'lastName', 'email'],
    'active'
),
(
    'Abandoned Cart Recovery',
    'abandoned_cart',
    'Don''t forget your cart, {{firstName}}! 🛒',
    '<h1>Don''t forget your cart!</h1><p>Complete your purchase and get free shipping!</p>',
    ARRAY['firstName', 'cartItems', 'cartTotal'],
    'active'
),
(
    'Product Recommendations',
    'product_recommendation',
    'Handpicked for you, {{firstName}}! 💎',
    '<h1>Products we think you''ll love</h1><p>Based on your preferences and browsing history.</p>',
    ARRAY['firstName', 'recommendedProducts'],
    'active'
),
(
    'Win-Back Campaign',
    'win_back',
    'We miss you, {{firstName}}! Come back with 20% off 💔',
    '<h1>We miss you!</h1><p>Here''s 20% off to welcome you back!</p>',
    ARRAY['firstName', 'discountCode', 'lastOrderDate'],
    'active'
);

-- Seed data for customer segments
INSERT INTO customer_segments (name, description, criteria) VALUES
(
    'New Customers',
    'Customers who signed up in the last 30 days',
    '{"daysSinceSignup": {"lte": 30}, "orderCount": {"lte": 1}}'::jsonb
),
(
    'High Value Customers',
    'Customers who have spent over $1000',
    '{"totalSpent": {"gte": 1000}}'::jsonb
),
(
    'At-Risk Customers',
    'Customers who haven''t ordered in 60+ days',
    '{"daysSinceLastOrder": {"gte": 60}, "orderCount": {"gte": 1}}'::jsonb
),
(
    'Active Customers',
    'Customers with recent activity',
    '{"daysSinceLastOrder": {"lte": 30}, "orderCount": {"gte": 1}}'::jsonb
);

-- Seed data for email flows
INSERT INTO email_flows (name, description, trigger_event, status) VALUES
(
    'Welcome Series',
    '3-step welcome flow for new customers',
    'signup',
    'active'
),
(
    'Abandoned Cart Recovery',
    '2-step cart recovery sequence',
    'cart_abandonment',
    'active'
),
(
    'Win-Back Campaign',
    'Re-engage inactive customers',
    'win_back',
    'active'
);

-- Add RLS policies (Row Level Security)
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (adjust based on your auth setup)
CREATE POLICY "Allow authenticated users to read email templates" ON email_templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage email campaigns" ON email_campaigns
    FOR ALL USING (auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON TABLE email_templates IS 'Reusable email templates with variables';
COMMENT ON TABLE email_campaigns IS 'Individual email campaigns and their performance';
COMMENT ON TABLE email_sends IS 'Individual email delivery tracking';
COMMENT ON TABLE email_events IS 'Detailed email interaction events';
COMMENT ON TABLE customer_segments IS 'Customer segmentation for targeted campaigns';
COMMENT ON TABLE ab_tests IS 'A/B testing configurations for email optimization';
COMMENT ON TABLE email_flows IS 'Automated email sequences and workflows';
COMMENT ON TABLE email_preferences IS 'Customer email preferences and subscription status';