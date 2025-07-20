import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { WorkflowEngine } from '../../workflows/workflow-engine';
import { WorkflowBuilder } from '../../workflows/workflow-builder';
import { createClient } from '@supabase/supabase-js';

// Initialize workflow engine
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const workflowEngine = new WorkflowEngine(supabaseUrl, supabaseServiceKey);
const workflowBuilder = new WorkflowBuilder();

// Initialize the engine
workflowEngine.initialize().catch(console.error);

// Validation schemas
const WorkflowFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in']),
  value: z.any()
});

const TriggerConfigSchema = z.object({
  table: z.string().optional(),
  operation: z.enum(['insert', 'update', 'delete']).optional(),
  conditions: z.record(z.any()).optional(),
  schedule: z.string().optional(),
  timezone: z.string().optional(),
  metric: z.string().optional(),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']).optional(),
  value: z.number().optional(),
  webhook_url: z.string().optional(),
  event_type: z.string().optional(),
  filters: z.array(WorkflowFilterSchema).optional()
});

const WorkflowTriggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['data_change', 'time_based', 'threshold', 'external_event']),
  config: TriggerConfigSchema,
  enabled: z.boolean()
});

const ActionConfigSchema = z.object({
  template_id: z.string().optional(),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  product_ids: z.array(z.string()).optional(),
  operation: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  segment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  service: z.string().optional(),
  endpoint: z.string().optional(),
  payload: z.record(z.any()).optional(),
  format: z.string().optional(),
  destination: z.string().optional(),
  script: z.string().optional(),
  function_name: z.string().optional()
});

const WorkflowActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['email', 'inventory', 'customer', 'integration', 'data_export', 'custom']),
  config: ActionConfigSchema,
  order: z.number(),
  conditions: z.array(WorkflowFilterSchema).optional()
});

const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  store_id: z.string(),
  trigger: WorkflowTriggerSchema,
  actions: z.array(WorkflowActionSchema),
  enabled: z.boolean(),
  tags: z.array(z.string()).optional()
});

export const workflowsRouter = createTRPCRouter({
  // Get all workflows for a store
  getWorkflows: protectedProcedure
    .input(z.object({
      storeId: z.string(),
      enabled: z.boolean().optional()
    }))
    .query(async ({ input }) => {
      try {
        const workflows = await workflowEngine.getWorkflows(input.storeId, input.enabled);
        return {
          success: true,
          data: workflows
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get a specific workflow
  getWorkflow: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ input }) => {
      try {
        const workflow = await workflowEngine.getWorkflow(input.id);
        return {
          success: true,
          data: workflow
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Create a new workflow
  createWorkflow: protectedProcedure
    .input(WorkflowSchema.omit({ id: true }))
    .mutation(async ({ input }) => {
      try {
        // Validate workflow
        const validation = workflowBuilder.validateWorkflow(input);
        if (!validation.valid) {
          return {
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }

        const workflowId = await workflowEngine.createWorkflow(input);
        return {
          success: true,
          data: { id: workflowId }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Update an existing workflow
  updateWorkflow: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: WorkflowSchema.partial()
    }))
    .mutation(async ({ input }) => {
      try {
        await workflowEngine.updateWorkflow(input.id, input.updates);
        return {
          success: true,
          data: { id: input.id }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Delete a workflow
  deleteWorkflow: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ input }) => {
      try {
        await workflowEngine.deleteWorkflow(input.id);
        return {
          success: true,
          data: { id: input.id }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Execute a workflow manually
  executeWorkflow: protectedProcedure
    .input(z.object({
      id: z.string(),
      triggerData: z.record(z.any()).optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const workflow = await workflowEngine.getWorkflow(input.id);
        if (!workflow) {
          return {
            success: false,
            error: 'Workflow not found'
          };
        }

        const executionId = await workflowEngine.executeWorkflow(
          workflow,
          input.triggerData || { manual_trigger: true, timestamp: new Date().toISOString() }
        );

        return {
          success: true,
          data: { executionId }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get workflow executions
  getExecutions: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ input }) => {
      try {
        const executions = await workflowEngine.getExecutions(input.workflowId, input.limit);
        return {
          success: true,
          data: executions
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get specific execution
  getExecution: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ input }) => {
      try {
        const execution = await workflowEngine.getExecution(input.id);
        return {
          success: true,
          data: execution
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Cancel execution
  cancelExecution: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ input }) => {
      try {
        await workflowEngine.cancelExecution(input.id);
        return {
          success: true,
          data: { id: input.id }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get workflow templates
  getTemplates: protectedProcedure
    .query(async () => {
      try {
        const templates = workflowBuilder.getTemplates();
        return {
          success: true,
          data: templates
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get specific template
  getTemplate: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ input }) => {
      try {
        const template = workflowBuilder.getTemplate(input.id);
        return {
          success: true,
          data: template
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Create workflow from template
  createFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      storeId: z.string(),
      variables: z.record(z.any())
    }))
    .mutation(async ({ input }) => {
      try {
        const workflow = workflowBuilder.createFromTemplate(
          input.templateId,
          input.storeId,
          input.variables
        );

        // Validate the generated workflow
        const validation = workflowBuilder.validateWorkflow(workflow);
        if (!validation.valid) {
          return {
            success: false,
            error: `Template validation failed: ${validation.errors.join(', ')}`
          };
        }

        const workflowId = await workflowEngine.createWorkflow(workflow);
        return {
          success: true,
          data: { id: workflowId, workflow }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Validate workflow configuration
  validateWorkflow: protectedProcedure
    .input(WorkflowSchema.partial())
    .mutation(async ({ input }) => {
      try {
        const validation = workflowBuilder.validateWorkflow(input);
        return {
          success: true,
          data: validation
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Get workflow metrics
  getMetrics: protectedProcedure
    .input(z.object({
      storeId: z.string(),
      timeRange: z.enum(['24h', '7d', '30d']).optional().default('24h')
    }))
    .query(async ({ input }) => {
      try {
        // Mock metrics for now - replace with actual database queries
        const metrics = {
          total_workflows: 4,
          active_workflows: 3,
          total_executions: 254,
          success_rate: 92.8,
          executions_today: 12,
          executions_this_week: 87,
          top_performing_workflows: [
            {
              workflow_id: '1',
              name: 'Low Inventory Alert',
              success_rate: 98.7,
              execution_count: 156
            },
            {
              workflow_id: '2',
              name: 'Abandoned Cart Recovery',
              success_rate: 76.8,
              execution_count: 45
            }
          ]
        };

        return {
          success: true,
          data: metrics
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Toggle workflow enabled state
  toggleWorkflow: protectedProcedure
    .input(z.object({
      id: z.string(),
      enabled: z.boolean()
    }))
    .mutation(async ({ input }) => {
      try {
        await workflowEngine.updateWorkflow(input.id, { enabled: input.enabled });
        return {
          success: true,
          data: { id: input.id, enabled: input.enabled }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Duplicate workflow
  duplicateWorkflow: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const originalWorkflow = await workflowEngine.getWorkflow(input.id);
        if (!originalWorkflow) {
          return {
            success: false,
            error: 'Workflow not found'
          };
        }

        // Create duplicate
        const duplicateWorkflow = {
          ...originalWorkflow,
          name: input.name || `${originalWorkflow.name} (Copy)`,
          enabled: false // Start disabled
        };

        // Remove fields that shouldn't be copied
        delete duplicateWorkflow.id;
        delete duplicateWorkflow.created_at;
        delete duplicateWorkflow.updated_at;
        delete duplicateWorkflow.last_run;
        duplicateWorkflow.run_count = 0;
        duplicateWorkflow.success_count = 0;
        duplicateWorkflow.error_count = 0;
        duplicateWorkflow.version = 1;

        const workflowId = await workflowEngine.createWorkflow(duplicateWorkflow);
        return {
          success: true,
          data: { id: workflowId }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  // Handle external webhooks
  handleWebhook: protectedProcedure
    .input(z.object({
      eventType: z.string(),
      payload: z.record(z.any())
    }))
    .mutation(async ({ input }) => {
      try {
        // This would typically be called from a webhook endpoint
        // For now, just log the webhook
        console.log('Webhook received:', input);
        
        return {
          success: true,
          data: { processed: true }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })
});