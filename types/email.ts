export interface EmailTemplate {
  id: string;
  name: string;
  type: 'newsletter' | 'welcome' | 'abandoned_cart' | 'product_recommendation' | 'win_back' | 'promotional' | 'transactional';
  subject: string;
  html_content: string;
  text_content?: string;
  thumbnail_url?: string;
  variables: string[]; // Available template variables like {{firstName}}, {{productName}}
  created_at: string;
  updated_at: string;
  status: 'draft' | 'active' | 'archived';
}

export interface EmailCampaign {
  id: string;
  name: string;
  template_id: string;
  subject_line: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  schedule_type: 'immediate' | 'scheduled' | 'recurring';
  scheduled_at?: string;
  recurring_pattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    days_of_week?: number[];
    time: string;
  };
  segment_id?: string;
  ab_test_id?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
  recipients_count: number;
  sent_count: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
  created_at: string;
  updated_at: string;
  sent_at?: string;
}

export interface EmailMetrics {
  campaignId: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
}

export interface EmailSend {
  id: string;
  email_id?: string;
  campaign_id?: string;
  template_id?: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  customer_data?: Record<string, any>;
  sent_at: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  complained_at?: string;
  error_message?: string;
}

export interface EmailEvent {
  id: string;
  email_id: string;
  event_type: 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description?: string;
  criteria: Record<string, any>;
  customer_count: number;
  created_at: string;
  updated_at: string;
}

export interface ABTest {
  id: string;
  name: string;
  campaign_id: string;
  test_type: 'subject_line' | 'content' | 'send_time' | 'from_name' | 'full_email';
  status: 'draft' | 'running' | 'completed' | 'paused';
  start_date: string;
  end_date?: string;
  confidence_level: number;
  minimum_sample_size: number;
  winner_variant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ABTestVariant {
  id: string;
  test_id: string;
  name: string;
  subject_line?: string;
  content?: string;
  send_time?: string;
  from_name?: string;
  weight: number; // Percentage of traffic
}

export interface ABTestResult {
  id: string;
  test_id: string;
  variant_id: string;
  recipient_email: string;
  event_type: 'send' | 'open' | 'click' | 'conversion';
  metadata?: Record<string, any>;
  recorded_at: string;
}

export interface EmailFlow {
  id: string;
  name: string;
  description?: string;
  trigger_event: 'signup' | 'purchase' | 'cart_abandonment' | 'win_back' | 'birthday' | 'custom';
  trigger_conditions?: Record<string, any>;
  status: 'active' | 'paused' | 'draft';
  steps: EmailFlowStep[];
  created_at: string;
  updated_at: string;
}

export interface EmailFlowStep {
  id: string;
  flow_id: string;
  name: string;
  template_id: string;
  delay_hours: number;
  delay_type: 'hours' | 'days' | 'weeks';
  conditions?: Record<string, any>;
  ab_test_enabled: boolean;
  order_index: number;
}

export interface EmailFlowExecution {
  id: string;
  flow_id: string;
  customer_id: string;
  trigger_data?: Record<string, any>;
  status: 'active' | 'completed' | 'paused' | 'failed';
  current_step_index: number;
  started_at: string;
  completed_at?: string;
  last_step_sent_at?: string;
}

export interface EmailPreferences {
  customer_id: string;
  newsletter: boolean;
  promotions: boolean;
  product_updates: boolean;
  order_updates: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'never';
  unsubscribed: boolean;
  unsubscribed_at?: string;
  updated_at: string;
}

export interface EmailAnalytics {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  start_date: string;
  end_date: string;
  metrics: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    avg_open_rate: number;
    avg_click_rate: number;
    avg_bounce_rate: number;
    avg_unsubscribe_rate: number;
  };
  by_campaign: Array<{
    campaign_id: string;
    campaign_name: string;
    metrics: EmailMetrics;
  }>;
  by_template: Array<{
    template_id: string;
    template_name: string;
    metrics: EmailMetrics;
  }>;
  trends: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
}

export interface EmailBuilder {
  template: EmailTemplate;
  blocks: EmailBlock[];
  settings: EmailBuilderSettings;
}

export interface EmailBlock {
  id: string;
  type: 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'product' | 'products_grid' | 'social' | 'footer';
  content: Record<string, any>;
  styles: Record<string, any>;
  order_index: number;
}

export interface EmailBuilderSettings {
  width: number;
  background_color: string;
  font_family: string;
  brand_colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  header: {
    logo_url?: string;
    show_logo: boolean;
    background_color: string;
  };
  footer: {
    show_unsubscribe: boolean;
    show_social: boolean;
    background_color: string;
    text_color: string;
  };
}

export interface EmailAutomation {
  id: string;
  name: string;
  description?: string;
  type: 'welcome_series' | 'abandoned_cart' | 'win_back' | 'product_follow_up' | 'birthday' | 'custom';
  trigger: {
    event: string;
    conditions: Record<string, any>;
    delay_hours?: number;
  };
  emails: Array<{
    template_id: string;
    delay_hours: number;
    conditions?: Record<string, any>;
  }>;
  status: 'active' | 'paused' | 'draft';
  performance: {
    triggered: number;
    completed: number;
    conversion_rate: number;
    revenue_generated: number;
  };
  created_at: string;
  updated_at: string;
}

export interface EmailProvider {
  id: string;
  name: string;
  type: 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'postmark';
  config: Record<string, any>;
  status: 'active' | 'inactive';
  daily_limit?: number;
  monthly_limit?: number;
  current_usage: {
    daily: number;
    monthly: number;
  };
}

export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
  preview_text?: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  variables?: Record<string, any>;
}

export interface EmailSchedule {
  type: 'immediate' | 'scheduled' | 'optimal' | 'recurring';
  scheduled_at?: string;
  timezone?: string;
  optimal_send?: {
    enabled: boolean;
    time_window: {
      start_hour: number;
      end_hour: number;
    };
    days_of_week: number[];
  };
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    end_date?: string;
    days_of_week?: number[];
    time: string;
  };
}

export interface EmailList {
  id: string;
  name: string;
  description?: string;
  subscriber_count: number;
  active_subscriber_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface EmailSubscriber {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained';
  source: string;
  tags: string[];
  custom_fields: Record<string, any>;
  subscribed_at: string;
  unsubscribed_at?: string;
  last_activity_at?: string;
}

export interface EmailDomainHealth {
  domain: string;
  reputation_score: number; // 0-100
  deliverability_rate: number; // Percentage
  bounce_rate: number;
  complaint_rate: number;
  spam_rate: number;
  blacklist_status: Array<{
    list_name: string;
    listed: boolean;
    checked_at: string;
  }>;
  authentication: {
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
  };
  recommendations: string[];
  last_checked: string;
}