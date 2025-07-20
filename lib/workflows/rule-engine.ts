import { WorkflowFilter } from './types';
import { logger } from '../logger';

export class RuleEngine {
  /**
   * Evaluates a set of filters against provided data
   */
  async evaluateFilters(filters: WorkflowFilter[], data: any): Promise<boolean> {
    if (!filters || filters.length === 0) {
      return true;
    }

    try {
      // All filters must pass (AND logic)
      for (const filter of filters) {
        const result = await this.evaluateFilter(filter, data);
        if (!result) {
          logger.debug(`Filter failed: ${filter.field} ${filter.operator} ${filter.value}`);
          return false;
        }
      }

      return true;
    } catch (error: any) {
      logger.error('Error evaluating filters:', error);
      return false;
    }
  }

  /**
   * Evaluates a single filter against data
   */
  private async evaluateFilter(filter: WorkflowFilter, data: any): Promise<boolean> {
    const { field, operator, value } = filter;
    
    // Get the field value from data using dot notation
    const fieldValue = this.getNestedValue(data, field);
    
    switch (operator) {
      case 'equals':
        return this.compareValues(fieldValue, value, '===');
      
      case 'not_equals':
        return this.compareValues(fieldValue, value, '!==');
      
      case 'greater_than':
        return this.compareValues(fieldValue, value, '>');
      
      case 'less_than':
        return this.compareValues(fieldValue, value, '<');
      
      case 'contains':
        return this.containsValue(fieldValue, value);
      
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      
      case 'not_in':
        return !(Array.isArray(value) && value.includes(fieldValue));
      
      default:
        logger.warn(`Unknown filter operator: ${operator}`);
        return false;
    }
  }

  /**
   * Gets nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Compares two values based on operator
   */
  private compareValues(a: any, b: any, operator: string): boolean {
    // Handle null/undefined cases
    if (a === null || a === undefined || b === null || b === undefined) {
      switch (operator) {
        case '===':
          return a === b;
        case '!==':
          return a !== b;
        default:
          return false;
      }
    }

    // Convert to numbers if both can be converted
    const aNum = Number(a);
    const bNum = Number(b);
    const bothNumbers = !isNaN(aNum) && !isNaN(bNum);

    if (bothNumbers && (operator === '>' || operator === '<')) {
      switch (operator) {
        case '>':
          return aNum > bNum;
        case '<':
          return aNum < bNum;
      }
    }

    // String/general comparison
    switch (operator) {
      case '===':
        return a === b;
      case '!==':
        return a !== b;
      case '>':
        return a > b;
      case '<':
        return a < b;
      default:
        return false;
    }
  }

  /**
   * Checks if field value contains the search value
   */
  private containsValue(fieldValue: any, searchValue: any): boolean {
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    // String contains
    if (typeof fieldValue === 'string') {
      return fieldValue.toLowerCase().includes(String(searchValue).toLowerCase());
    }

    // Array contains
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(item => 
        typeof item === 'string' 
          ? item.toLowerCase().includes(String(searchValue).toLowerCase())
          : item === searchValue
      );
    }

    // Object property contains
    if (typeof fieldValue === 'object') {
      return Object.values(fieldValue).some(value =>
        typeof value === 'string'
          ? value.toLowerCase().includes(String(searchValue).toLowerCase())
          : value === searchValue
      );
    }

    return false;
  }

  /**
   * Evaluates complex business rules with JavaScript expressions
   */
  async evaluateExpression(expression: string, context: any): Promise<boolean> {
    try {
      // Create a safe evaluation context
      const safeContext = this.createSafeContext(context);
      
      // Simple expression evaluation (could be enhanced with a proper parser)
      const func = new Function(...Object.keys(safeContext), `return ${expression}`);
      const result = func(...Object.values(safeContext));
      
      return Boolean(result);
    } catch (error: any) {
      logger.error(`Error evaluating expression: ${expression}`, error);
      return false;
    }
  }

  /**
   * Creates a safe context for expression evaluation
   */
  private createSafeContext(context: any): Record<string, any> {
    const safe: Record<string, any> = {};
    
    // Add safe built-in functions
    safe.Math = Math;
    safe.Date = Date;
    safe.JSON = JSON;
    safe.parseFloat = parseFloat;
    safe.parseInt = parseInt;
    safe.isNaN = isNaN;
    safe.isFinite = isFinite;
    
    // Add context data with safe keys
    for (const [key, value] of Object.entries(context)) {
      if (typeof key === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        safe[key] = value;
      }
    }
    
    return safe;
  }

  /**
   * Validates filter structure
   */
  validateFilter(filter: WorkflowFilter): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!filter.field || typeof filter.field !== 'string') {
      errors.push('Field is required and must be a string');
    }
    
    const validOperators = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in'];
    if (!filter.operator || !validOperators.includes(filter.operator)) {
      errors.push(`Operator must be one of: ${validOperators.join(', ')}`);
    }
    
    if (filter.value === undefined) {
      errors.push('Value is required');
    }
    
    // Operator-specific validation
    if (['in', 'not_in'].includes(filter.operator) && !Array.isArray(filter.value)) {
      errors.push('Value must be an array for "in" and "not_in" operators');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates a set of filters
   */
  validateFilters(filters: WorkflowFilter[]): { valid: boolean; errors: string[] } {
    const allErrors: string[] = [];
    
    if (!Array.isArray(filters)) {
      return { valid: false, errors: ['Filters must be an array'] };
    }
    
    filters.forEach((filter, index) => {
      const validation = this.validateFilter(filter);
      if (!validation.valid) {
        validation.errors.forEach(error => {
          allErrors.push(`Filter ${index + 1}: ${error}`);
        });
      }
    });
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Creates common filter presets
   */
  static createPresets() {
    return {
      // Inventory filters
      lowStock: (threshold: number): WorkflowFilter => ({
        field: 'inventory_quantity',
        operator: 'less_than',
        value: threshold
      }),
      
      outOfStock: (): WorkflowFilter => ({
        field: 'inventory_quantity',
        operator: 'equals',
        value: 0
      }),
      
      priceChanged: (): WorkflowFilter => ({
        field: 'price',
        operator: 'not_equals',
        value: '{{previous_price}}'
      }),
      
      // Customer filters
      newCustomer: (): WorkflowFilter => ({
        field: 'orders_count',
        operator: 'equals',
        value: 0
      }),
      
      highValueCustomer: (threshold: number): WorkflowFilter => ({
        field: 'total_spent',
        operator: 'greater_than',
        value: threshold
      }),
      
      // Order filters
      highValueOrder: (threshold: number): WorkflowFilter => ({
        field: 'total_price',
        operator: 'greater_than',
        value: threshold
      }),
      
      abandonedCart: (hoursThreshold: number): WorkflowFilter => ({
        field: 'updated_at',
        operator: 'less_than',
        value: new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString()
      }),
      
      // Product filters
      productCategory: (category: string): WorkflowFilter => ({
        field: 'product_type',
        operator: 'equals',
        value: category
      }),
      
      productTag: (tag: string): WorkflowFilter => ({
        field: 'tags',
        operator: 'contains',
        value: tag
      })
    };
  }
}