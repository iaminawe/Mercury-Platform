import { Workflow, WorkflowTrigger, WorkflowAction, WorkflowTemplate, TemplateVariable, WORKFLOW_TEMPLATES } from './types';
import { RuleEngine } from './rule-engine';

export class WorkflowBuilder {
  private ruleEngine: RuleEngine;

  constructor() {
    this.ruleEngine = new RuleEngine();
  }

  /**
   * Creates a new workflow from scratch
   */
  createWorkflow(name: string, storeId: string): Workflow {
    return {
      id: crypto.randomUUID(),
      name,
      description: '',
      store_id: storeId,
      trigger: this.createDefaultTrigger(),
      actions: [],
      enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      run_count: 0,
      success_count: 0,
      error_count: 0,
      version: 1,
      tags: []
    };
  }

  /**
   * Creates a workflow from a template
   */
  createFromTemplate(templateId: string, storeId: string, variables: Record<string, any>): Workflow {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    this.validateTemplateVariables(template, variables);

    // Create workflow from template
    const workflow: Workflow = {
      ...template.template,
      id: crypto.randomUUID(),
      store_id: storeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      run_count: 0,
      success_count: 0,
      error_count: 0
    };

    // Replace template variables
    return this.replaceTemplateVariables(workflow, variables);
  }

  /**
   * Gets all available workflow templates
   */
  getTemplates(): WorkflowTemplate[] {
    return [
      this.getLowInventoryAlertTemplate(),
      this.getAbandonedCartRecoveryTemplate(),
      this.getNewCustomerWelcomeTemplate(),
      this.getProductReviewRequestTemplate(),
      this.getPriceOptimizationTemplate(),
      this.getBulkInventoryUpdateTemplate(),
      this.getDailySalesReportTemplate(),
      this.getCustomerLifecycleTemplate(),
      this.getSeasonalCampaignTemplate(),
      this.getStockReorderTemplate()
    ];
  }

  /**
   * Gets a specific template by ID
   */
  getTemplate(id: string): WorkflowTemplate | null {
    const templates = this.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Validates a workflow configuration
   */
  validateWorkflow(workflow: Partial<Workflow>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!workflow.name?.trim()) {
      errors.push('Workflow name is required');
    }

    if (!workflow.store_id) {
      errors.push('Store ID is required');
    }

    // Trigger validation
    if (!workflow.trigger) {
      errors.push('Trigger is required');
    } else {
      const triggerValidation = this.validateTrigger(workflow.trigger);
      if (!triggerValidation.valid) {
        errors.push(...triggerValidation.errors.map(e => `Trigger: ${e}`));
      }
    }

    // Actions validation
    if (!workflow.actions || workflow.actions.length === 0) {
      errors.push('At least one action is required');
    } else {
      workflow.actions.forEach((action, index) => {
        const actionValidation = this.validateAction(action);
        if (!actionValidation.valid) {
          errors.push(...actionValidation.errors.map(e => `Action ${index + 1}: ${e}`));
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates a trigger configuration
   */
  validateTrigger(trigger: WorkflowTrigger): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!trigger.name?.trim()) {
      errors.push('Trigger name is required');
    }

    if (!trigger.type) {
      errors.push('Trigger type is required');
    }

    // Type-specific validation
    switch (trigger.type) {
      case 'data_change':
        if (!trigger.config.table) {
          errors.push('Table is required for data change triggers');
        }
        break;

      case 'time_based':
        if (!trigger.config.schedule) {
          errors.push('Schedule is required for time-based triggers');
        }
        break;

      case 'threshold':
        if (!trigger.config.metric || !trigger.config.operator || trigger.config.value === undefined) {
          errors.push('Metric, operator, and value are required for threshold triggers');
        }
        break;

      case 'external_event':
        if (!trigger.config.event_type) {
          errors.push('Event type is required for external event triggers');
        }
        break;
    }

    // Validate filters
    if (trigger.config.filters) {
      const filterValidation = this.ruleEngine.validateFilters(trigger.config.filters);
      if (!filterValidation.valid) {
        errors.push(...filterValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates an action configuration
   */
  validateAction(action: WorkflowAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!action.name?.trim()) {
      errors.push('Action name is required');
    }

    if (!action.type) {
      errors.push('Action type is required');
    }

    if (action.order === undefined || action.order < 0) {
      errors.push('Action order must be a non-negative number');
    }

    // Type-specific validation
    switch (action.type) {
      case 'email':
        if (!action.config.recipient && !action.config.template_id) {
          errors.push('Email recipient or template ID is required');
        }
        break;

      case 'inventory':
        if (!action.config.operation) {
          errors.push('Inventory operation is required');
        }
        break;

      case 'integration':
        if (!action.config.service) {
          errors.push('Integration service is required');
        }
        if (action.config.service === 'webhook' && !action.config.endpoint) {
          errors.push('Webhook endpoint is required');
        }
        break;

      case 'data_export':
        if (!action.config.format) {
          errors.push('Export format is required');
        }
        break;

      case 'custom':
        if (!action.config.function_name && !action.config.script) {
          errors.push('Custom function name or script is required');
        }
        break;
    }

    // Validate conditions
    if (action.conditions) {
      const conditionValidation = this.ruleEngine.validateFilters(action.conditions);
      if (!conditionValidation.valid) {
        errors.push(...conditionValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Private helper methods

  private createDefaultTrigger(): WorkflowTrigger {
    return {
      id: crypto.randomUUID(),
      name: 'Data Change Trigger',
      type: 'data_change',
      config: {
        table: 'products',
        operation: 'update'
      },
      enabled: true
    };
  }

  private validateTemplateVariables(template: WorkflowTemplate, variables: Record<string, any>): void {
    for (const variable of template.variables) {
      if (variable.required && !variables.hasOwnProperty(variable.key)) {
        throw new Error(`Required variable missing: ${variable.key}`);
      }

      if (variables[variable.key] !== undefined) {
        const value = variables[variable.key];
        
        // Type validation
        switch (variable.type) {
          case 'number':
            if (typeof value !== 'number' && isNaN(Number(value))) {
              throw new Error(`Variable ${variable.key} must be a number`);
            }
            break;
          
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Variable ${variable.key} must be a boolean`);
            }
            break;
          
          case 'select':
          case 'multi_select':
            if (variable.options && !variable.options.some(opt => opt.value === value)) {
              throw new Error(`Variable ${variable.key} must be one of the allowed options`);
            }
            break;
        }
      }
    }
  }

  private replaceTemplateVariables(workflow: Workflow, variables: Record<string, any>): Workflow {
    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          return variables.hasOwnProperty(key) ? String(variables[key]) : match;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (value && typeof value === 'object') {
        const result: any = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = processValue(v);
        }
        return result;
      }
      return value;
    };

    return processValue(workflow);
  }

  // Template definitions

  private getLowInventoryAlertTemplate(): WorkflowTemplate {
    return {
      id: 'low_inventory_alert',
      name: 'Low Inventory Alert',
      description: 'Automatically notify when product inventory falls below a threshold',
      category: 'inventory',
      template: {
        name: 'Low Inventory Alert - {{product_name}}',
        description: 'Automatically created workflow to monitor inventory levels',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Low Stock Trigger',
          type: 'threshold',
          config: {
            metric: 'low_inventory',
            operator: 'gt',
            value: 0
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Send Low Stock Email',
            type: 'email',
            config: {
              recipient: '{{admin_email}}',
              subject: 'Low Stock Alert: {{product_name}}',
              body: 'Product {{product_name}} is running low on inventory. Current stock: {{current_stock}}'
            },
            order: 1
          }
        ],
        enabled: true,
        version: 1,
        tags: ['inventory', 'alert']
      },
      variables: [
        {
          key: 'threshold',
          name: 'Stock Threshold',
          description: 'Alert when inventory falls below this number',
          type: 'number',
          required: true,
          default_value: 10
        },
        {
          key: 'admin_email',
          name: 'Admin Email',
          description: 'Email address to receive alerts',
          type: 'string',
          required: true
        }
      ],
      tags: ['inventory', 'monitoring', 'alerts']
    };
  }

  private getAbandonedCartRecoveryTemplate(): WorkflowTemplate {
    return {
      id: 'abandoned_cart_recovery',
      name: 'Abandoned Cart Recovery',
      description: 'Automatically send recovery emails for abandoned carts',
      category: 'marketing',
      template: {
        name: 'Abandoned Cart Recovery',
        description: 'Recover abandoned carts with automated email sequence',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Cart Abandonment Trigger',
          type: 'data_change',
          config: {
            table: 'carts',
            operation: 'update',
            conditions: { status: 'abandoned' }
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Send Recovery Email',
            type: 'email',
            config: {
              recipient: '{{customer_email}}',
              subject: 'Complete your purchase - Items waiting in your cart',
              body: 'Hi {{customer_name}}, you left some great items in your cart. Complete your purchase now!'
            },
            order: 1
          }
        ],
        enabled: true,
        version: 1,
        tags: ['marketing', 'recovery']
      },
      variables: [
        {
          key: 'delay_hours',
          name: 'Email Delay (hours)',
          description: 'How long to wait before sending recovery email',
          type: 'number',
          required: true,
          default_value: 24
        },
        {
          key: 'discount_code',
          name: 'Discount Code',
          description: 'Optional discount code to include',
          type: 'string',
          required: false
        }
      ],
      tags: ['marketing', 'email', 'conversion']
    };
  }

  private getNewCustomerWelcomeTemplate(): WorkflowTemplate {
    return {
      id: 'new_customer_welcome',
      name: 'New Customer Welcome',
      description: 'Welcome new customers with an automated email sequence',
      category: 'customer',
      template: {
        name: 'New Customer Welcome',
        description: 'Automated welcome sequence for new customers',
        trigger: {
          id: crypto.randomUUID(),
          name: 'New Customer Trigger',
          type: 'data_change',
          config: {
            table: 'customers',
            operation: 'insert'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Send Welcome Email',
            type: 'email',
            config: {
              recipient: '{{customer_email}}',
              subject: 'Welcome to {{store_name}}!',
              body: 'Thank you for joining us! Here\'s a special {{discount_percent}}% discount for your first order.'
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Add to VIP Segment',
            type: 'customer',
            config: {
              segment: 'new_customers',
              tags: ['welcome_sent']
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['customer', 'welcome']
      },
      variables: [
        {
          key: 'discount_percent',
          name: 'Welcome Discount (%)',
          description: 'Discount percentage for new customers',
          type: 'number',
          required: true,
          default_value: 10
        },
        {
          key: 'store_name',
          name: 'Store Name',
          description: 'Your store name for personalization',
          type: 'string',
          required: true
        }
      ],
      tags: ['customer', 'welcome', 'email']
    };
  }

  private getProductReviewRequestTemplate(): WorkflowTemplate {
    return {
      id: 'product_review_request',
      name: 'Product Review Request',
      description: 'Request product reviews from customers after purchase',
      category: 'customer',
      template: {
        name: 'Product Review Request',
        description: 'Automated review requests after order fulfillment',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Order Fulfilled Trigger',
          type: 'data_change',
          config: {
            table: 'orders',
            operation: 'update',
            conditions: { fulfillment_status: 'fulfilled' }
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Send Review Request',
            type: 'email',
            config: {
              recipient: '{{customer_email}}',
              subject: 'How was your recent purchase?',
              body: 'We hope you love your recent purchase! Please take a moment to leave a review.'
            },
            order: 1
          }
        ],
        enabled: true,
        version: 1,
        tags: ['reviews', 'customer']
      },
      variables: [
        {
          key: 'delay_days',
          name: 'Email Delay (days)',
          description: 'Days to wait after fulfillment before sending review request',
          type: 'number',
          required: true,
          default_value: 7
        },
        {
          key: 'review_incentive',
          name: 'Review Incentive',
          description: 'Optional incentive for leaving a review',
          type: 'string',
          required: false
        }
      ],
      tags: ['reviews', 'customer', 'email']
    };
  }

  private getPriceOptimizationTemplate(): WorkflowTemplate {
    return {
      id: 'price_optimization',
      name: 'Dynamic Price Optimization',
      description: 'Automatically adjust prices based on inventory and demand',
      category: 'inventory',
      template: {
        name: 'Price Optimization',
        description: 'Dynamic pricing based on inventory levels',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Daily Price Check',
          type: 'time_based',
          config: {
            schedule: '0 9 * * *', // Daily at 9 AM
            timezone: 'UTC'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Adjust Prices',
            type: 'inventory',
            config: {
              operation: 'price_update',
              parameters: {
                adjustment_type: 'percentage',
                price_adjustment: '{{price_adjustment_percent}}'
              }
            },
            order: 1
          }
        ],
        enabled: true,
        version: 1,
        tags: ['pricing', 'optimization']
      },
      variables: [
        {
          key: 'price_adjustment_percent',
          name: 'Price Adjustment (%)',
          description: 'Percentage to adjust prices (positive to increase, negative to decrease)',
          type: 'number',
          required: true,
          default_value: 5
        },
        {
          key: 'inventory_threshold',
          name: 'Low Inventory Threshold',
          description: 'Increase prices when inventory falls below this level',
          type: 'number',
          required: true,
          default_value: 20
        }
      ],
      tags: ['pricing', 'automation', 'inventory']
    };
  }

  private getBulkInventoryUpdateTemplate(): WorkflowTemplate {
    return {
      id: 'bulk_inventory_update',
      name: 'Bulk Inventory Update',
      description: 'Update inventory levels in bulk based on external data',
      category: 'inventory',
      template: {
        name: 'Bulk Inventory Update',
        description: 'Automated bulk inventory updates',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Inventory File Upload',
          type: 'external_event',
          config: {
            event_type: 'file_upload',
            webhook_url: '/api/webhooks/inventory-update'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Process Inventory File',
            type: 'custom',
            config: {
              function_name: 'process_inventory_file'
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Send Update Summary',
            type: 'email',
            config: {
              recipient: '{{admin_email}}',
              subject: 'Inventory Update Complete',
              body: 'Bulk inventory update completed. {{updated_count}} products updated.'
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['inventory', 'bulk']
      },
      variables: [
        {
          key: 'admin_email',
          name: 'Admin Email',
          description: 'Email for update notifications',
          type: 'string',
          required: true
        },
        {
          key: 'file_format',
          name: 'File Format',
          description: 'Expected file format',
          type: 'select',
          required: true,
          default_value: 'csv',
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'Excel', value: 'xlsx' },
            { label: 'JSON', value: 'json' }
          ]
        }
      ],
      tags: ['inventory', 'bulk', 'import']
    };
  }

  private getDailySalesReportTemplate(): WorkflowTemplate {
    return {
      id: 'daily_sales_report',
      name: 'Daily Sales Report',
      description: 'Generate and send daily sales reports',
      category: 'analytics',
      template: {
        name: 'Daily Sales Report',
        description: 'Automated daily sales reporting',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Daily Report Trigger',
          type: 'time_based',
          config: {
            schedule: '0 8 * * *', // Daily at 8 AM
            timezone: 'UTC'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Generate Sales Report',
            type: 'data_export',
            config: {
              format: 'csv',
              destination: 'email'
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Send Report Email',
            type: 'email',
            config: {
              recipient: '{{report_recipients}}',
              subject: 'Daily Sales Report - {{date}}',
              body: 'Please find attached your daily sales report for {{date}}.'
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['analytics', 'reporting']
      },
      variables: [
        {
          key: 'report_recipients',
          name: 'Report Recipients',
          description: 'Email addresses to receive reports (comma-separated)',
          type: 'string',
          required: true
        },
        {
          key: 'report_format',
          name: 'Report Format',
          description: 'Format for the sales report',
          type: 'select',
          required: true,
          default_value: 'csv',
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'Excel', value: 'xlsx' },
            { label: 'PDF', value: 'pdf' }
          ]
        }
      ],
      tags: ['analytics', 'reporting', 'sales']
    };
  }

  private getCustomerLifecycleTemplate(): WorkflowTemplate {
    return {
      id: 'customer_lifecycle_automation',
      name: 'Customer Lifecycle Automation',
      description: 'Automated customer journey based on purchase behavior',
      category: 'customer',
      template: {
        name: 'Customer Lifecycle Automation',
        description: 'Automated customer journey workflows',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Customer Behavior Trigger',
          type: 'data_change',
          config: {
            table: 'customers',
            operation: 'update'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Update Customer Segment',
            type: 'customer',
            config: {
              segment: 'lifecycle_{{segment_name}}',
              tags: ['lifecycle_managed']
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Send Lifecycle Email',
            type: 'email',
            config: {
              recipient: '{{customer_email}}',
              subject: 'Special offer just for you!',
              body: 'Based on your purchase history, we have a special offer for you.'
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['customer', 'lifecycle']
      },
      variables: [
        {
          key: 'lifecycle_stages',
          name: 'Lifecycle Stages',
          description: 'Define customer lifecycle stages',
          type: 'multi_select',
          required: true,
          options: [
            { label: 'New Customer', value: 'new' },
            { label: 'Regular Customer', value: 'regular' },
            { label: 'VIP Customer', value: 'vip' },
            { label: 'At Risk', value: 'at_risk' },
            { label: 'Churned', value: 'churned' }
          ]
        }
      ],
      tags: ['customer', 'lifecycle', 'automation']
    };
  }

  private getSeasonalCampaignTemplate(): WorkflowTemplate {
    return {
      id: 'seasonal_campaign_trigger',
      name: 'Seasonal Campaign Trigger',
      description: 'Launch campaigns based on seasonal events',
      category: 'marketing',
      template: {
        name: 'Seasonal Campaign - {{season}}',
        description: 'Automated seasonal marketing campaigns',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Seasonal Date Trigger',
          type: 'time_based',
          config: {
            schedule: '0 9 {{campaign_date}} * *', // Specific date
            timezone: 'UTC'
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Launch Campaign',
            type: 'email',
            config: {
              recipient: '{{customer_segments}}',
              subject: '{{season}} Sale - Special Offers Inside!',
              body: 'Don\'t miss our {{season}} sale with up to {{discount_percent}}% off!'
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Update Product Prices',
            type: 'inventory',
            config: {
              operation: 'price_update',
              parameters: {
                adjustment_type: 'percentage',
                price_adjustment: -10 // 10% discount
              }
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['marketing', 'seasonal']
      },
      variables: [
        {
          key: 'season',
          name: 'Season',
          description: 'Season for the campaign',
          type: 'select',
          required: true,
          options: [
            { label: 'Spring', value: 'spring' },
            { label: 'Summer', value: 'summer' },
            { label: 'Fall', value: 'fall' },
            { label: 'Winter', value: 'winter' },
            { label: 'Holiday', value: 'holiday' }
          ]
        },
        {
          key: 'discount_percent',
          name: 'Discount Percentage',
          description: 'Discount percentage for the campaign',
          type: 'number',
          required: true,
          default_value: 20
        }
      ],
      tags: ['marketing', 'seasonal', 'campaigns']
    };
  }

  private getStockReorderTemplate(): WorkflowTemplate {
    return {
      id: 'stock_reorder_automation',
      name: 'Automated Stock Reordering',
      description: 'Automatically reorder stock when inventory is low',
      category: 'inventory',
      template: {
        name: 'Stock Reorder Automation',
        description: 'Automated stock reordering system',
        trigger: {
          id: crypto.randomUUID(),
          name: 'Low Stock Trigger',
          type: 'threshold',
          config: {
            metric: 'low_inventory',
            operator: 'gt',
            value: 0
          },
          enabled: true
        },
        actions: [
          {
            id: crypto.randomUUID(),
            name: 'Create Reorder Request',
            type: 'inventory',
            config: {
              operation: 'reorder',
              parameters: {
                quantity: '{{reorder_quantity}}'
              }
            },
            order: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Notify Supplier',
            type: 'integration',
            config: {
              service: 'webhook',
              endpoint: '{{supplier_webhook}}',
              payload: {
                product_id: '{{product_id}}',
                quantity: '{{reorder_quantity}}',
                urgency: 'normal'
              }
            },
            order: 2
          }
        ],
        enabled: true,
        version: 1,
        tags: ['inventory', 'automation']
      },
      variables: [
        {
          key: 'reorder_threshold',
          name: 'Reorder Threshold',
          description: 'Minimum stock level before reordering',
          type: 'number',
          required: true,
          default_value: 10
        },
        {
          key: 'reorder_quantity',
          name: 'Reorder Quantity',
          description: 'How many units to reorder',
          type: 'number',
          required: true,
          default_value: 50
        },
        {
          key: 'supplier_webhook',
          name: 'Supplier Webhook URL',
          description: 'Webhook URL to notify supplier',
          type: 'string',
          required: false
        }
      ],
      tags: ['inventory', 'automation', 'suppliers']
    };
  }
}