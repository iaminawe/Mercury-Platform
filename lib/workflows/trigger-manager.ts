import { SupabaseClient } from '@supabase/supabase-js';
import { WorkflowTrigger } from './types';
import { logger } from '../logger';

export class TriggerManager {
  private supabase: SupabaseClient;
  private registeredTriggers = new Map<string, WorkflowTrigger>();
  private scheduledJobs = new Map<string, NodeJS.Timeout>();
  private webhookListeners = new Map<string, (data: any) => void>();
  private thresholdCheckers = new Map<string, NodeJS.Timeout>();
  private onTriggerCallback?: (workflowId: string, data: any) => void;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Trigger Manager');
    
    // Set up database change listeners
    await this.setupDatabaseTriggers();
    
    // Set up webhook endpoints
    await this.setupWebhookTriggers();
    
    logger.info('Trigger Manager initialized');
  }

  onTrigger(callback: (workflowId: string, data: any) => void): void {
    this.onTriggerCallback = callback;
  }

  async registerTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    this.registeredTriggers.set(workflowId, trigger);
    
    switch (trigger.type) {
      case 'data_change':
        await this.registerDataChangeTrigger(workflowId, trigger);
        break;
      
      case 'time_based':
        await this.registerTimeTrigger(workflowId, trigger);
        break;
      
      case 'external_event':
        await this.registerExternalTrigger(workflowId, trigger);
        break;
      
      case 'threshold':
        await this.registerThresholdTrigger(workflowId, trigger);
        break;
    }
    
    logger.info(`Registered trigger for workflow: ${workflowId} (${trigger.type})`);
  }

  async unregisterTrigger(workflowId: string): Promise<void> {
    const trigger = this.registeredTriggers.get(workflowId);
    if (!trigger) return;

    switch (trigger.type) {
      case 'time_based':
        const job = this.scheduledJobs.get(workflowId);
        if (job) {
          clearInterval(job);
          this.scheduledJobs.delete(workflowId);
        }
        break;
      
      case 'external_event':
        this.webhookListeners.delete(workflowId);
        break;
      
      case 'threshold':
        const checker = this.thresholdCheckers.get(workflowId);
        if (checker) {
          clearInterval(checker);
          this.thresholdCheckers.delete(workflowId);
        }
        break;
    }
    
    this.registeredTriggers.delete(workflowId);
    logger.info(`Unregistered trigger for workflow: ${workflowId}`);
  }

  private async setupDatabaseTriggers(): Promise<void> {
    // Set up real-time subscriptions for data changes
    const tables = ['products', 'orders', 'customers', 'inventory'];
    
    for (const table of tables) {
      this.supabase
        .channel(`workflow_${table}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table }, 
          (payload) => this.handleDatabaseChange(table, payload)
        )
        .subscribe();
    }
  }

  private async handleDatabaseChange(table: string, payload: any): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Find workflows that should trigger on this change
    for (const [workflowId, trigger] of this.registeredTriggers) {
      if (trigger.type !== 'data_change') continue;
      
      const { config } = trigger;
      if (config.table !== table) continue;
      
      // Check if operation matches
      const operationMap = {
        INSERT: 'insert',
        UPDATE: 'update',
        DELETE: 'delete'
      };
      
      if (config.operation && config.operation !== operationMap[eventType]) {
        continue;
      }
      
      // Check conditions
      if (config.conditions && !this.matchesConditions(newRecord || oldRecord, config.conditions)) {
        continue;
      }
      
      // Trigger workflow
      await this.triggerWorkflow(workflowId, {
        event_type: eventType,
        table,
        new_record: newRecord,
        old_record: oldRecord,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async registerDataChangeTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    // Database triggers are handled globally in setupDatabaseTriggers
    // Just register the trigger for event filtering
  }

  private async registerTimeTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    const { schedule, timezone = 'UTC' } = trigger.config;
    
    if (!schedule) {
      throw new Error('Schedule is required for time-based triggers');
    }
    
    // Parse cron expression and set up interval
    const intervalMs = this.parseCronToInterval(schedule);
    
    if (intervalMs) {
      const job = setInterval(async () => {
        await this.triggerWorkflow(workflowId, {
          trigger_type: 'scheduled',
          schedule,
          timestamp: new Date().toISOString(),
          timezone
        });
      }, intervalMs);
      
      this.scheduledJobs.set(workflowId, job);
    } else {
      // For complex cron expressions, use a more sophisticated scheduler
      logger.warn(`Complex cron expression not supported yet: ${schedule}`);
    }
  }

  private parseCronToInterval(cron: string): number | null {
    // Simple cron parser for basic intervals
    // Format: "*/5 * * * *" (every 5 minutes)
    // Format: "0 * * * *" (every hour)
    // Format: "0 0 * * *" (daily)
    
    const parts = cron.split(' ');
    if (parts.length !== 5) return null;
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Every X minutes
    if (minute.startsWith('*/') && hour === '*') {
      const minutes = parseInt(minute.substring(2));
      return minutes * 60 * 1000;
    }
    
    // Every hour
    if (minute === '0' && hour === '*') {
      return 60 * 60 * 1000;
    }
    
    // Daily
    if (minute === '0' && hour === '0' && day === '*') {
      return 24 * 60 * 60 * 1000;
    }
    
    return null;
  }

  private async registerExternalTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    const { webhook_url, event_type } = trigger.config;
    
    // Register webhook listener
    this.webhookListeners.set(workflowId, (data: any) => {
      if (!event_type || data.event_type === event_type) {
        this.triggerWorkflow(workflowId, {
          trigger_type: 'webhook',
          event_type: data.event_type,
          payload: data,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private async registerThresholdTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    const { metric, operator, value } = trigger.config;
    
    if (!metric || !operator || value === undefined) {
      throw new Error('Threshold triggers require metric, operator, and value');
    }
    
    // Set up periodic checking
    const checker = setInterval(async () => {
      const currentValue = await this.getMetricValue(metric);
      const shouldTrigger = this.evaluateThreshold(currentValue, operator, value);
      
      if (shouldTrigger) {
        await this.triggerWorkflow(workflowId, {
          trigger_type: 'threshold',
          metric,
          current_value: currentValue,
          threshold_value: value,
          operator,
          timestamp: new Date().toISOString()
        });
      }
    }, 60000); // Check every minute
    
    this.thresholdCheckers.set(workflowId, checker);
  }

  private async getMetricValue(metric: string): Promise<number> {
    switch (metric) {
      case 'low_inventory':
        const { data: lowStockProducts } = await this.supabase
          .from('products')
          .select('id')
          .lt('inventory_quantity', 10);
        return lowStockProducts?.length || 0;
      
      case 'daily_revenue':
        const today = new Date().toISOString().split('T')[0];
        const { data: orders } = await this.supabase
          .from('orders')
          .select('total_price')
          .gte('created_at', `${today}T00:00:00Z`)
          .lt('created_at', `${today}T23:59:59Z`);
        return orders?.reduce((sum, order) => sum + order.total_price, 0) || 0;
      
      case 'abandoned_carts':
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: carts } = await this.supabase
          .from('carts')
          .select('id')
          .eq('status', 'abandoned')
          .lt('updated_at', oneHourAgo);
        return carts?.length || 0;
      
      default:
        logger.warn(`Unknown metric: ${metric}`);
        return 0;
    }
  }

  private evaluateThreshold(currentValue: number, operator: string, thresholdValue: number): boolean {
    switch (operator) {
      case 'gt': return currentValue > thresholdValue;
      case 'lt': return currentValue < thresholdValue;
      case 'eq': return currentValue === thresholdValue;
      case 'gte': return currentValue >= thresholdValue;
      case 'lte': return currentValue <= thresholdValue;
      default: return false;
    }
  }

  private matchesConditions(record: any, conditions: Record<string, any>): boolean {
    for (const [field, expectedValue] of Object.entries(conditions)) {
      if (record[field] !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private async triggerWorkflow(workflowId: string, data: any): Promise<void> {
    logger.info(`Triggering workflow: ${workflowId}`, { data });
    
    if (this.onTriggerCallback) {
      await this.onTriggerCallback(workflowId, data);
    }
  }

  private async setupWebhookTriggers(): Promise<void> {
    // Webhook endpoints will be handled by the API routes
    // This method sets up the internal webhook processing
  }

  // Public method to handle incoming webhooks
  async handleWebhook(eventType: string, payload: any): Promise<void> {
    for (const [workflowId, listener] of this.webhookListeners) {
      try {
        listener({ event_type: eventType, ...payload });
      } catch (error) {
        logger.error(`Error handling webhook for workflow ${workflowId}:`, error);
      }
    }
  }

  // Public method to manually trigger a workflow
  async manualTrigger(workflowId: string, data: any = {}): Promise<void> {
    await this.triggerWorkflow(workflowId, {
      trigger_type: 'manual',
      data,
      timestamp: new Date().toISOString()
    });
  }

  stop(): void {
    // Clear all scheduled jobs
    for (const [workflowId, job] of this.scheduledJobs) {
      clearInterval(job);
    }
    this.scheduledJobs.clear();
    
    // Clear all threshold checkers
    for (const [workflowId, checker] of this.thresholdCheckers) {
      clearInterval(checker);
    }
    this.thresholdCheckers.clear();
    
    // Clear webhook listeners
    this.webhookListeners.clear();
    
    // Clear registered triggers
    this.registeredTriggers.clear();
    
    logger.info('Trigger Manager stopped');
  }
}