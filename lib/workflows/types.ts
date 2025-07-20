// Workflow Engine Types and Interfaces

export interface WorkflowTrigger {
  id: string;
  name: string;
  type: 'data_change' | 'time_based' | 'external_event' | 'threshold';
  config: TriggerConfig;
  enabled: boolean;
}

export interface TriggerConfig {
  // Data change triggers
  table?: string;
  operation?: 'insert' | 'update' | 'delete';
  conditions?: Record<string, any>;
  
  // Time-based triggers
  schedule?: string; // cron expression
  timezone?: string;
  
  // Threshold triggers
  metric?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value?: number;
  
  // External event triggers
  webhook_url?: string;
  event_type?: string;
  
  // Common
  filters?: WorkflowFilter[];
}

export interface WorkflowFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface WorkflowAction {
  id: string;
  name: string;
  type: 'email' | 'inventory' | 'customer' | 'integration' | 'data_export' | 'custom';
  config: ActionConfig;
  order: number;
  conditions?: WorkflowFilter[];
}

export interface ActionConfig {
  // Email actions
  template_id?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  
  // Inventory actions
  product_ids?: string[];
  operation?: 'reorder' | 'price_update' | 'status_change';
  parameters?: Record<string, any>;
  
  // Customer actions
  segment?: string;
  tags?: string[];
  
  // Integration actions
  service?: 'slack' | 'discord' | 'webhook' | 'api';
  endpoint?: string;
  payload?: Record<string, any>;
  
  // Data export actions
  format?: 'csv' | 'json' | 'xlsx';
  destination?: string;
  
  // Custom actions
  script?: string;
  function_name?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  store_id: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_run?: string;
  run_count: number;
  success_count: number;
  error_count: number;
  version: number;
  tags?: string[];
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  trigger_data: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  error?: string;
  action_results: ActionResult[];
  context: Record<string, any>;
}

export interface ActionResult {
  action_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  result?: any;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'inventory' | 'customer' | 'marketing' | 'analytics' | 'general';
  template: Omit<Workflow, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'run_count' | 'success_count' | 'error_count'>;
  variables: TemplateVariable[];
  tags: string[];
}

export interface TemplateVariable {
  key: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multi_select';
  required: boolean;
  default_value?: any;
  options?: { label: string; value: any }[];
}

export interface WorkflowMetrics {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  success_rate: number;
  avg_execution_time: number;
  executions_today: number;
  executions_this_week: number;
  top_performing_workflows: Array<{
    workflow_id: string;
    name: string;
    success_rate: number;
    execution_count: number;
  }>;
}

export interface WorkflowContext {
  store_id: string;
  user_id?: string;
  trigger_data: any;
  execution_id: string;
  workflow: Workflow;
  variables: Record<string, any>;
  shared_data: Record<string, any>;
}

// Built-in workflow templates
export const WORKFLOW_TEMPLATES = [
  'low_inventory_alert',
  'abandoned_cart_recovery',
  'new_customer_welcome',
  'product_review_request',
  'price_optimization',
  'bulk_inventory_update',
  'daily_sales_report',
  'customer_lifecycle_automation',
  'seasonal_campaign_trigger',
  'stock_reorder_automation'
] as const;

export type WorkflowTemplateType = typeof WORKFLOW_TEMPLATES[number];