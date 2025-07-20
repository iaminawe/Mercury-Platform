import { SupabaseClient } from '@supabase/supabase-js';
import { WorkflowAction, WorkflowContext } from './types';
import { logger } from '../logger';

export class ActionExecutor {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async executeAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    logger.info(`Executing action: ${action.name} (${action.type})`);

    try {
      switch (action.type) {
        case 'email':
          return await this.executeEmailAction(action, context);
        
        case 'inventory':
          return await this.executeInventoryAction(action, context);
        
        case 'customer':
          return await this.executeCustomerAction(action, context);
        
        case 'integration':
          return await this.executeIntegrationAction(action, context);
        
        case 'data_export':
          return await this.executeDataExportAction(action, context);
        
        case 'custom':
          return await this.executeCustomAction(action, context);
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error: any) {
      logger.error(`Action execution failed: ${action.name}`, error);
      throw error;
    }
  }

  private async executeEmailAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { template_id, recipient, subject, body } = config;

    // Replace variables in email content
    const processedSubject = this.replaceVariables(subject || '', context);
    const processedBody = this.replaceVariables(body || '', context);
    const processedRecipient = this.replaceVariables(recipient || '', context);

    // Email sending logic (integrate with your email service)
    const emailData = {
      to: processedRecipient,
      subject: processedSubject,
      body: processedBody,
      template_id,
      context: {
        store_id: context.store_id,
        workflow_id: context.workflow.id,
        execution_id: context.execution_id
      }
    };

    // Log email for now (replace with actual email service)
    logger.info('Email sent:', emailData);

    // Store email log
    await this.supabase.from('email_logs').insert([{
      store_id: context.store_id,
      workflow_id: context.workflow.id,
      execution_id: context.execution_id,
      recipient: processedRecipient,
      subject: processedSubject,
      status: 'sent',
      sent_at: new Date().toISOString()
    }]);

    return { success: true, recipient: processedRecipient, subject: processedSubject };
  }

  private async executeInventoryAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { product_ids, operation, parameters } = config;

    let affectedProducts: string[] = [];

    if (product_ids?.length) {
      affectedProducts = product_ids;
    } else if (context.trigger_data.product_id) {
      affectedProducts = [context.trigger_data.product_id];
    } else if (context.trigger_data.new_record?.id) {
      affectedProducts = [context.trigger_data.new_record.id];
    }

    if (affectedProducts.length === 0) {
      throw new Error('No products specified for inventory action');
    }

    const results = [];

    for (const productId of affectedProducts) {
      switch (operation) {
        case 'reorder':
          const reorderResult = await this.reorderProduct(productId, parameters, context);
          results.push({ productId, operation: 'reorder', result: reorderResult });
          break;

        case 'price_update':
          const priceResult = await this.updateProductPrice(productId, parameters, context);
          results.push({ productId, operation: 'price_update', result: priceResult });
          break;

        case 'status_change':
          const statusResult = await this.updateProductStatus(productId, parameters, context);
          results.push({ productId, operation: 'status_change', result: statusResult });
          break;

        default:
          throw new Error(`Unknown inventory operation: ${operation}`);
      }
    }

    return { success: true, affected_products: affectedProducts.length, results };
  }

  private async executeCustomerAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { segment, tags } = config;

    let customerId: string | null = null;

    if (context.trigger_data.customer_id) {
      customerId = context.trigger_data.customer_id;
    } else if (context.trigger_data.new_record?.customer_id) {
      customerId = context.trigger_data.new_record.customer_id;
    }

    if (!customerId) {
      throw new Error('No customer specified for customer action');
    }

    const results: any = { customerId };

    // Add to segment
    if (segment) {
      await this.addCustomerToSegment(customerId, segment, context);
      results.segment_added = segment;
    }

    // Add tags
    if (tags?.length) {
      await this.addCustomerTags(customerId, tags, context);
      results.tags_added = tags;
    }

    return { success: true, ...results };
  }

  private async executeIntegrationAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { service, endpoint, payload } = config;

    const processedPayload = this.replaceVariablesInObject(payload || {}, context);

    switch (service) {
      case 'slack':
        return await this.sendSlackMessage(processedPayload, context);
      
      case 'discord':
        return await this.sendDiscordMessage(processedPayload, context);
      
      case 'webhook':
        return await this.sendWebhook(endpoint!, processedPayload, context);
      
      case 'api':
        return await this.callAPI(endpoint!, processedPayload, context);
      
      default:
        throw new Error(`Unknown integration service: ${service}`);
    }
  }

  private async executeDataExportAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { format, destination } = config;

    // Determine what data to export based on trigger
    let data: any[] = [];
    
    if (context.trigger_data.table) {
      // Export from triggered table
      const { data: tableData } = await this.supabase
        .from(context.trigger_data.table)
        .select('*')
        .eq('store_id', context.store_id);
      
      data = tableData || [];
    } else {
      // Default to exporting products
      const { data: productData } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', context.store_id);
      
      data = productData || [];
    }

    const exportResult = await this.exportData(data, format!, destination, context);
    
    return { success: true, exported_records: data.length, ...exportResult };
  }

  private async executeCustomAction(action: WorkflowAction, context: WorkflowContext): Promise<any> {
    const { config } = action;
    const { script, function_name } = config;

    if (function_name) {
      // Call a predefined function
      return await this.callCustomFunction(function_name, context);
    } else if (script) {
      // Execute custom script (be very careful with this in production)
      logger.warn('Custom script execution - ensure this is secure');
      return await this.executeCustomScript(script, context);
    } else {
      throw new Error('Custom action requires either function_name or script');
    }
  }

  // Helper methods for specific operations

  private async reorderProduct(productId: string, parameters: any, context: WorkflowContext): Promise<any> {
    const { quantity = 100 } = parameters;
    
    // Log reorder request
    await this.supabase.from('reorder_requests').insert([{
      store_id: context.store_id,
      product_id: productId,
      quantity,
      workflow_id: context.workflow.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);

    return { quantity, status: 'requested' };
  }

  private async updateProductPrice(productId: string, parameters: any, context: WorkflowContext): Promise<any> {
    const { price, price_adjustment, adjustment_type } = parameters;
    
    let newPrice = price;
    
    if (price_adjustment && adjustment_type) {
      const { data: product } = await this.supabase
        .from('products')
        .select('data')
        .eq('id', productId)
        .single();
      
      if (product?.data?.variants?.[0]?.price) {
        const currentPrice = parseFloat(product.data.variants[0].price);
        
        if (adjustment_type === 'percentage') {
          newPrice = currentPrice * (1 + price_adjustment / 100);
        } else if (adjustment_type === 'fixed') {
          newPrice = currentPrice + price_adjustment;
        }
      }
    }

    // Update price in database
    // This would typically sync with Shopify
    logger.info(`Price update requested for product ${productId}: ${newPrice}`);
    
    return { new_price: newPrice, status: 'updated' };
  }

  private async updateProductStatus(productId: string, parameters: any, context: WorkflowContext): Promise<any> {
    const { status } = parameters;
    
    await this.supabase
      .from('products')
      .update({ status })
      .eq('id', productId);
    
    return { new_status: status, status: 'updated' };
  }

  private async addCustomerToSegment(customerId: string, segment: string, context: WorkflowContext): Promise<void> {
    await this.supabase.from('customer_segments').insert([{
      store_id: context.store_id,
      customer_id: customerId,
      segment_name: segment,
      added_at: new Date().toISOString()
    }]);
  }

  private async addCustomerTags(customerId: string, tags: string[], context: WorkflowContext): Promise<void> {
    for (const tag of tags) {
      await this.supabase.from('customer_tags').insert([{
        store_id: context.store_id,
        customer_id: customerId,
        tag,
        added_at: new Date().toISOString()
      }]);
    }
  }

  private async sendSlackMessage(payload: any, context: WorkflowContext): Promise<any> {
    // Integrate with Slack API
    logger.info('Slack message sent:', payload);
    return { success: true, channel: payload.channel, message: payload.text };
  }

  private async sendDiscordMessage(payload: any, context: WorkflowContext): Promise<any> {
    // Integrate with Discord API
    logger.info('Discord message sent:', payload);
    return { success: true, channel: payload.channel, message: payload.content };
  }

  private async sendWebhook(endpoint: string, payload: any, context: WorkflowContext): Promise<any> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      return { success: response.ok, status: response.status, response: await response.text() };
    } catch (error: any) {
      throw new Error(`Webhook failed: ${error.message}`);
    }
  }

  private async callAPI(endpoint: string, payload: any, context: WorkflowContext): Promise<any> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error: any) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  private async exportData(data: any[], format: string, destination: string | undefined, context: WorkflowContext): Promise<any> {
    // Export data logic
    const filename = `export-${context.execution_id}.${format}`;
    
    let exportedContent: string;
    
    switch (format) {
      case 'json':
        exportedContent = JSON.stringify(data, null, 2);
        break;
      
      case 'csv':
        exportedContent = this.jsonToCSV(data);
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // In a real implementation, save to file system or cloud storage
    logger.info(`Data exported: ${filename} (${data.length} records)`);
    
    return { filename, format, size: exportedContent.length };
  }

  private async callCustomFunction(functionName: string, context: WorkflowContext): Promise<any> {
    // Registry of custom functions
    const customFunctions: Record<string, (context: WorkflowContext) => Promise<any>> = {
      'notify_admin': async (ctx) => {
        // Send admin notification
        return { success: true, message: 'Admin notified' };
      },
      
      'backup_data': async (ctx) => {
        // Backup store data
        return { success: true, message: 'Data backup initiated' };
      },
      
      'generate_report': async (ctx) => {
        // Generate custom report
        return { success: true, report_id: `report-${Date.now()}` };
      }
    };

    const func = customFunctions[functionName];
    if (!func) {
      throw new Error(`Unknown custom function: ${functionName}`);
    }

    return await func(context);
  }

  private async executeCustomScript(script: string, context: WorkflowContext): Promise<any> {
    // WARNING: This is potentially dangerous - only use in secure environments
    // In production, consider using a sandboxed environment
    logger.warn('Executing custom script - ensure security measures are in place');
    
    try {
      // Create a limited context for script execution
      const scriptContext = {
        trigger_data: context.trigger_data,
        store_id: context.store_id,
        shared_data: context.shared_data,
        console: { log: logger.info.bind(logger) }
      };
      
      // Execute script (this is a simplified example)
      const func = new Function('context', script);
      return func(scriptContext);
    } catch (error: any) {
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  private replaceVariables(text: string, context: WorkflowContext): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = this.getVariableValue(variable.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  private replaceVariablesInObject(obj: any, context: WorkflowContext): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariablesInObject(item, context));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariablesInObject(value, context);
      }
      return result;
    }
    return obj;
  }

  private getVariableValue(variable: string, context: WorkflowContext): any {
    // Support dot notation for nested values
    const parts = variable.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private jsonToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }
}