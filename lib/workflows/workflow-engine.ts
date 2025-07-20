import { createClient } from '@supabase/supabase-js';
import { WorkflowContext, Workflow, WorkflowExecution, ActionResult, WorkflowFilter } from './types';
import { RuleEngine } from './rule-engine';
import { TriggerManager } from './trigger-manager';
import { ActionExecutor } from './action-executor';
import { logger } from '../logger';

export class WorkflowEngine {
  private supabase;
  private ruleEngine: RuleEngine;
  private triggerManager: TriggerManager;
  private actionExecutor: ActionExecutor;
  private isRunning = false;
  private executionQueue: Array<{ workflow: Workflow; triggerData: any }> = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.ruleEngine = new RuleEngine();
    this.triggerManager = new TriggerManager(this.supabase);
    this.actionExecutor = new ActionExecutor(this.supabase);
  }

  async initialize() {
    logger.info('Initializing Workflow Engine');
    
    // Create workflow tables if they don't exist
    await this.createWorkflowTables();
    
    // Initialize trigger manager
    await this.triggerManager.initialize();
    
    // Register trigger handlers
    this.triggerManager.onTrigger(this.handleTrigger.bind(this));
    
    // Start processing queue
    this.startProcessing();
    
    logger.info('Workflow Engine initialized successfully');
  }

  private async createWorkflowTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        trigger JSONB NOT NULL,
        actions JSONB NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_run TIMESTAMP WITH TIME ZONE,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        tags TEXT[]
      )`,
      
      `CREATE TABLE IF NOT EXISTS workflow_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        trigger_data JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        error TEXT,
        action_results JSONB DEFAULT '[]',
        context JSONB DEFAULT '{}'
      )`,
      
      `CREATE TABLE IF NOT EXISTS workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        template JSONB NOT NULL,
        variables JSONB NOT NULL,
        tags TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      `CREATE INDEX IF NOT EXISTS idx_workflows_store_enabled ON workflows(store_id, enabled)`,
      `CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id)`
    ];

    for (const table of tables) {
      await this.supabase.rpc('execute_sql', { sql: table });
    }
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'run_count' | 'success_count' | 'error_count'>): Promise<string> {
    const { data, error } = await this.supabase
      .from('workflows')
      .insert([workflow])
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create workflow:', error);
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    logger.info(`Created workflow: ${data.id}`);
    
    // Register trigger if workflow is enabled
    if (workflow.enabled) {
      await this.triggerManager.registerTrigger(data.id, workflow.trigger);
    }

    return data.id;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void> {
    const { error } = await this.supabase
      .from('workflows')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('Failed to update workflow:', error);
      throw new Error(`Failed to update workflow: ${error.message}`);
    }

    // Update trigger registration
    const workflow = await this.getWorkflow(id);
    if (workflow) {
      if (workflow.enabled) {
        await this.triggerManager.registerTrigger(id, workflow.trigger);
      } else {
        await this.triggerManager.unregisterTrigger(id);
      }
    }

    logger.info(`Updated workflow: ${id}`);
  }

  async deleteWorkflow(id: string): Promise<void> {
    // Unregister trigger
    await this.triggerManager.unregisterTrigger(id);

    const { error } = await this.supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete workflow:', error);
      throw new Error(`Failed to delete workflow: ${error.message}`);
    }

    logger.info(`Deleted workflow: ${id}`);
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const { data, error } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to get workflow:', error);
      return null;
    }

    return data;
  }

  async getWorkflows(storeId: string, enabled?: boolean): Promise<Workflow[]> {
    let query = this.supabase
      .from('workflows')
      .select('*')
      .eq('store_id', storeId);

    if (enabled !== undefined) {
      query = query.eq('enabled', enabled);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get workflows:', error);
      return [];
    }

    return data || [];
  }

  private async handleTrigger(workflowId: string, triggerData: any): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || !workflow.enabled) {
      return;
    }

    logger.info(`Workflow triggered: ${workflowId}`, { triggerData });

    // Add to execution queue
    this.executionQueue.push({ workflow, triggerData });
  }

  private startProcessing(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    const processQueue = async () => {
      while (this.isRunning) {
        if (this.executionQueue.length > 0) {
          const { workflow, triggerData } = this.executionQueue.shift()!;
          await this.executeWorkflow(workflow, triggerData);
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    processQueue().catch(error => {
      logger.error('Error in workflow processing:', error);
    });
  }

  async executeWorkflow(workflow: Workflow, triggerData: any): Promise<string> {
    const executionId = crypto.randomUUID();
    
    try {
      // Create execution record
      const { error: insertError } = await this.supabase
        .from('workflow_executions')
        .insert([{
          id: executionId,
          workflow_id: workflow.id,
          trigger_data: triggerData,
          status: 'running'
        }]);

      if (insertError) {
        throw new Error(`Failed to create execution: ${insertError.message}`);
      }

      logger.info(`Starting workflow execution: ${executionId}`);

      // Create execution context
      const context: WorkflowContext = {
        store_id: workflow.store_id,
        trigger_data: triggerData,
        execution_id: executionId,
        workflow,
        variables: {},
        shared_data: {}
      };

      // Evaluate trigger conditions
      const shouldExecute = await this.ruleEngine.evaluateFilters(
        workflow.trigger.config.filters || [],
        triggerData
      );

      if (!shouldExecute) {
        await this.updateExecution(executionId, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
        return executionId;
      }

      // Execute actions in order
      const actionResults: ActionResult[] = [];
      
      for (const action of workflow.actions.sort((a, b) => a.order - b.order)) {
        const actionResult: ActionResult = {
          action_id: action.id,
          status: 'running',
          started_at: new Date().toISOString()
        };

        try {
          // Evaluate action conditions
          const shouldExecuteAction = action.conditions
            ? await this.ruleEngine.evaluateFilters(action.conditions, { ...triggerData, ...context.shared_data })
            : true;

          if (!shouldExecuteAction) {
            actionResult.status = 'skipped';
            actionResult.completed_at = new Date().toISOString();
            actionResults.push(actionResult);
            continue;
          }

          // Execute action
          const result = await this.actionExecutor.executeAction(action, context);
          
          actionResult.status = 'completed';
          actionResult.completed_at = new Date().toISOString();
          actionResult.result = result;
          
          // Store result in shared data for subsequent actions
          context.shared_data[action.id] = result;
          
        } catch (error: any) {
          actionResult.status = 'failed';
          actionResult.completed_at = new Date().toISOString();
          actionResult.error = error.message;
          
          logger.error(`Action failed: ${action.id}`, error);
          
          // Continue with other actions unless it's a critical failure
          if (action.type === 'critical') {
            throw error;
          }
        }

        actionResults.push(actionResult);
      }

      // Update execution as completed
      await this.updateExecution(executionId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        action_results: actionResults
      });

      // Update workflow stats
      await this.updateWorkflowStats(workflow.id, true);

      logger.info(`Workflow execution completed: ${executionId}`);
      return executionId;

    } catch (error: any) {
      logger.error(`Workflow execution failed: ${executionId}`, error);

      await this.updateExecution(executionId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error.message
      });

      await this.updateWorkflowStats(workflow.id, false);
      throw error;
    }
  }

  private async updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_executions')
      .update(updates)
      .eq('id', id);

    if (error) {
      logger.error('Failed to update execution:', error);
    }
  }

  private async updateWorkflowStats(workflowId: string, success: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('update_workflow_stats', {
      workflow_id: workflowId,
      success: success
    });

    if (error) {
      logger.error('Failed to update workflow stats:', error);
    }
  }

  async getExecutions(workflowId: string, limit = 50): Promise<WorkflowExecution[]> {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get executions:', error);
      return [];
    }

    return data || [];
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to get execution:', error);
      return null;
    }

    return data;
  }

  async cancelExecution(id: string): Promise<void> {
    await this.updateExecution(id, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });

    logger.info(`Cancelled workflow execution: ${id}`);
  }

  stop(): void {
    this.isRunning = false;
    this.triggerManager.stop();
    logger.info('Workflow Engine stopped');
  }
}