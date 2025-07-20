/**
 * Data Transformer
 * Handles data transformation between different integration formats
 */

import { z } from 'zod';
import { format, parse, parseISO } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  sourceFormat: string;
  targetFormat: string;
  rules: TransformRule[];
  validation?: {
    input?: z.ZodSchema;
    output?: z.ZodSchema;
  };
}

export interface TransformRule {
  type: 'map' | 'convert' | 'calculate' | 'conditional' | 'aggregate' | 'split' | 'merge' | 'lookup';
  config: any;
}

export interface FieldMapping {
  source: string | string[];
  target: string;
  transform?: FieldTransform;
  defaultValue?: any;
  required?: boolean;
}

export interface FieldTransform {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'custom';
  format?: string;
  timezone?: string;
  precision?: number;
  customFunction?: (value: any, context?: any) => any;
}

export interface TransformContext {
  sourceData: any;
  targetData?: any;
  metadata?: Record<string, any>;
  errors: TransformError[];
}

export interface TransformError {
  field: string;
  message: string;
  value?: any;
  type: 'validation' | 'conversion' | 'missing' | 'unknown';
}

export class DataTransformer {
  private transformationRules: Map<string, TransformationRule> = new Map();
  private customTransformers: Map<string, (value: any, context?: any) => any> = new Map();

  // Register a transformation rule
  registerTransformationRule(rule: TransformationRule): void {
    this.transformationRules.set(rule.id, rule);
  }

  // Register custom transformer function
  registerCustomTransformer(name: string, transformer: (value: any, context?: any) => any): void {
    this.customTransformers.set(name, transformer);
  }

  // Transform data using a specific rule
  async transform(
    data: any,
    ruleId: string,
    options?: {
      strict?: boolean;
      includeNulls?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<{ data: any; errors: TransformError[] }> {
    const rule = this.transformationRules.get(ruleId);
    if (!rule) {
      throw new Error(`Transformation rule ${ruleId} not found`);
    }

    const context: TransformContext = {
      sourceData: data,
      metadata: options?.metadata,
      errors: []
    };

    try {
      // Validate input if schema provided
      if (rule.validation?.input) {
        const validation = rule.validation.input.safeParse(data);
        if (!validation.success) {
          validation.error.errors.forEach(err => {
            context.errors.push({
              field: err.path.join('.'),
              message: err.message,
              type: 'validation'
            });
          });

          if (options?.strict) {
            return { data: null, errors: context.errors };
          }
        }
      }

      // Apply transformation rules
      const transformed = await this.applyTransformationRules(data, rule.rules, context);

      // Validate output if schema provided
      if (rule.validation?.output) {
        const validation = rule.validation.output.safeParse(transformed);
        if (!validation.success) {
          validation.error.errors.forEach(err => {
            context.errors.push({
              field: err.path.join('.'),
              message: `Output validation failed: ${err.message}`,
              type: 'validation'
            });
          });

          if (options?.strict) {
            return { data: null, errors: context.errors };
          }
        }
      }

      return { data: transformed, errors: context.errors };
    } catch (error) {
      context.errors.push({
        field: 'root',
        message: error instanceof Error ? error.message : 'Unknown transformation error',
        type: 'unknown'
      });
      return { data: null, errors: context.errors };
    }
  }

  // Apply transformation rules
  private async applyTransformationRules(
    data: any,
    rules: TransformRule[],
    context: TransformContext
  ): Promise<any> {
    let result = data;

    for (const rule of rules) {
      switch (rule.type) {
        case 'map':
          result = await this.applyMapRule(result, rule.config, context);
          break;
        case 'convert':
          result = await this.applyConvertRule(result, rule.config, context);
          break;
        case 'calculate':
          result = await this.applyCalculateRule(result, rule.config, context);
          break;
        case 'conditional':
          result = await this.applyConditionalRule(result, rule.config, context);
          break;
        case 'aggregate':
          result = await this.applyAggregateRule(result, rule.config, context);
          break;
        case 'split':
          result = await this.applySplitRule(result, rule.config, context);
          break;
        case 'merge':
          result = await this.applyMergeRule(result, rule.config, context);
          break;
        case 'lookup':
          result = await this.applyLookupRule(result, rule.config, context);
          break;
      }
    }

    return result;
  }

  // Map fields from source to target
  private async applyMapRule(
    data: any,
    config: { mappings: FieldMapping[] },
    context: TransformContext
  ): Promise<any> {
    const result: any = {};

    for (const mapping of config.mappings) {
      try {
        let value: any;

        if (Array.isArray(mapping.source)) {
          // Multiple source fields
          value = mapping.source.map(field => this.getNestedValue(data, field));
        } else {
          // Single source field
          value = this.getNestedValue(data, mapping.source);
        }

        // Apply transformation if specified
        if (mapping.transform) {
          value = await this.transformField(value, mapping.transform, context);
        }

        // Use default value if needed
        if (value === undefined || value === null) {
          if (mapping.defaultValue !== undefined) {
            value = mapping.defaultValue;
          } else if (mapping.required) {
            context.errors.push({
              field: mapping.target,
              message: `Required field missing: ${mapping.source}`,
              type: 'missing'
            });
            continue;
          }
        }

        // Set the value in result
        this.setNestedValue(result, mapping.target, value);
      } catch (error) {
        context.errors.push({
          field: mapping.target,
          message: error instanceof Error ? error.message : 'Mapping error',
          value: mapping.source,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Convert data types
  private async applyConvertRule(
    data: any,
    config: { fields: Array<{ path: string; from: string; to: string; format?: string }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const field of config.fields) {
      try {
        const value = this.getNestedValue(result, field.path);
        if (value === undefined || value === null) continue;

        const converted = this.convertType(value, field.from, field.to, field.format);
        this.setNestedValue(result, field.path, converted);
      } catch (error) {
        context.errors.push({
          field: field.path,
          message: `Failed to convert from ${field.from} to ${field.to}`,
          value: this.getNestedValue(result, field.path),
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Calculate new fields
  private async applyCalculateRule(
    data: any,
    config: { calculations: Array<{ target: string; expression: string; fields: string[] }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const calc of config.calculations) {
      try {
        const values: Record<string, any> = {};
        for (const field of calc.fields) {
          values[field] = this.getNestedValue(data, field);
        }

        // Simple expression evaluator (in production, use a proper expression parser)
        const calculated = this.evaluateExpression(calc.expression, values);
        this.setNestedValue(result, calc.target, calculated);
      } catch (error) {
        context.errors.push({
          field: calc.target,
          message: `Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Apply conditional transformations
  private async applyConditionalRule(
    data: any,
    config: { conditions: Array<{ if: any; then: TransformRule; else?: TransformRule }> },
    context: TransformContext
  ): Promise<any> {
    let result = data;

    for (const condition of config.conditions) {
      const conditionMet = this.evaluateCondition(result, condition.if);
      
      if (conditionMet && condition.then) {
        result = await this.applyTransformationRules(result, [condition.then], context);
      } else if (!conditionMet && condition.else) {
        result = await this.applyTransformationRules(result, [condition.else], context);
      }
    }

    return result;
  }

  // Aggregate data
  private async applyAggregateRule(
    data: any,
    config: { aggregations: Array<{ source: string; target: string; function: string; groupBy?: string }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const agg of config.aggregations) {
      try {
        const sourceData = this.getNestedValue(data, agg.source);
        if (!Array.isArray(sourceData)) continue;

        let aggregated: any;

        switch (agg.function) {
          case 'sum':
            aggregated = sourceData.reduce((sum, item) => sum + (Number(item) || 0), 0);
            break;
          case 'avg':
            aggregated = sourceData.reduce((sum, item) => sum + (Number(item) || 0), 0) / sourceData.length;
            break;
          case 'count':
            aggregated = sourceData.length;
            break;
          case 'min':
            aggregated = Math.min(...sourceData.map(item => Number(item) || 0));
            break;
          case 'max':
            aggregated = Math.max(...sourceData.map(item => Number(item) || 0));
            break;
          case 'first':
            aggregated = sourceData[0];
            break;
          case 'last':
            aggregated = sourceData[sourceData.length - 1];
            break;
          case 'unique':
            aggregated = [...new Set(sourceData)];
            break;
          default:
            throw new Error(`Unknown aggregation function: ${agg.function}`);
        }

        this.setNestedValue(result, agg.target, aggregated);
      } catch (error) {
        context.errors.push({
          field: agg.target,
          message: `Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Split fields
  private async applySplitRule(
    data: any,
    config: { splits: Array<{ source: string; targets: string[]; delimiter?: string; regex?: string }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const split of config.splits) {
      try {
        const value = this.getNestedValue(data, split.source);
        if (typeof value !== 'string') continue;

        let parts: string[];
        if (split.regex) {
          parts = value.split(new RegExp(split.regex));
        } else {
          parts = value.split(split.delimiter || ',');
        }

        split.targets.forEach((target, index) => {
          if (index < parts.length) {
            this.setNestedValue(result, target, parts[index].trim());
          }
        });
      } catch (error) {
        context.errors.push({
          field: split.source,
          message: `Split failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Merge fields
  private async applyMergeRule(
    data: any,
    config: { merges: Array<{ sources: string[]; target: string; separator?: string; template?: string }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const merge of config.merges) {
      try {
        const values = merge.sources.map(source => this.getNestedValue(data, source));

        let merged: string;
        if (merge.template) {
          // Use template string
          merged = merge.template;
          merge.sources.forEach((source, index) => {
            merged = merged.replace(`{${index}}`, values[index] || '');
            merged = merged.replace(`{${source}}`, values[index] || '');
          });
        } else {
          // Simple join
          merged = values.filter(v => v !== undefined && v !== null).join(merge.separator || ' ');
        }

        this.setNestedValue(result, merge.target, merged);
      } catch (error) {
        context.errors.push({
          field: merge.target,
          message: `Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Lookup values
  private async applyLookupRule(
    data: any,
    config: { lookups: Array<{ source: string; target: string; table: Record<string, any>; default?: any }> },
    context: TransformContext
  ): Promise<any> {
    const result = { ...data };

    for (const lookup of config.lookups) {
      try {
        const key = String(this.getNestedValue(data, lookup.source));
        const value = lookup.table[key] ?? lookup.default;
        
        if (value !== undefined) {
          this.setNestedValue(result, lookup.target, value);
        }
      } catch (error) {
        context.errors.push({
          field: lookup.target,
          message: `Lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'conversion'
        });
      }
    }

    return result;
  }

  // Transform individual field
  private async transformField(value: any, transform: FieldTransform, context: TransformContext): Promise<any> {
    if (value === undefined || value === null) return value;

    switch (transform.type) {
      case 'string':
        return String(value);

      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Cannot convert "${value}" to number`);
        return transform.precision !== undefined ? Number(num.toFixed(transform.precision)) : num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);

      case 'date':
        return this.transformDate(value, transform.format, transform.timezone);

      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
          return value.split(',').map(s => s.trim());
        }
        return [value];

      case 'object':
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            throw new Error(`Cannot parse "${value}" as object`);
          }
        }
        return { value };

      case 'custom':
        if (transform.customFunction) {
          return transform.customFunction(value, context);
        }
        throw new Error('Custom transformer function not provided');

      default:
        return value;
    }
  }

  // Transform date values
  private transformDate(value: any, format?: string, timezone?: string): Date | string {
    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      // Try to parse ISO format first
      try {
        date = parseISO(value);
        if (isNaN(date.getTime())) throw new Error();
      } catch {
        // Try custom format if provided
        if (format) {
          date = parse(value, format, new Date());
          if (isNaN(date.getTime())) {
            throw new Error(`Cannot parse date "${value}" with format "${format}"`);
          }
        } else {
          // Try standard Date constructor
          date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Cannot parse date "${value}"`);
          }
        }
      }
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      throw new Error(`Cannot convert ${typeof value} to date`);
    }

    // Apply timezone if specified
    if (timezone) {
      date = utcToZonedTime(date, timezone);
    }

    // Return formatted string if format specified
    if (format) {
      return format(date, format);
    }

    return date;
  }

  // Convert between types
  private convertType(value: any, from: string, to: string, format?: string): any {
    if (from === to) return value;

    // Special handling for date conversions
    if (to === 'date' || from === 'date') {
      if (to === 'date') {
        return this.transformDate(value, format);
      } else if (from === 'date' && to === 'string') {
        return format ? format(value, format) : value.toISOString();
      } else if (from === 'date' && to === 'number') {
        return value.getTime();
      }
    }

    // Standard conversions
    const transform: FieldTransform = { type: to as any, format };
    return this.transformField(value, transform, { sourceData: value, errors: [] });
  }

  // Evaluate simple expressions
  private evaluateExpression(expression: string, values: Record<string, any>): any {
    // Simple arithmetic expression evaluator
    // In production, use a proper expression parser like math.js
    let expr = expression;
    
    // Replace field names with values
    Object.entries(values).forEach(([field, value]) => {
      expr = expr.replace(new RegExp(`\\b${field}\\b`, 'g'), String(value));
    });

    // Basic arithmetic operations only
    try {
      // Validate expression contains only allowed characters
      if (!/^[\d\s+\-*/().,]+$/.test(expr)) {
        throw new Error('Invalid expression');
      }
      
      // Use Function constructor with restricted scope
      const result = new Function('return ' + expr)();
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${expression}`);
    }
  }

  // Evaluate conditions
  private evaluateCondition(data: any, condition: any): boolean {
    if (typeof condition === 'boolean') return condition;

    if (typeof condition === 'object' && condition !== null) {
      // Handle different condition types
      if ('field' in condition && 'operator' in condition) {
        const value = this.getNestedValue(data, condition.field);
        
        switch (condition.operator) {
          case 'equals':
            return value === condition.value;
          case 'notEquals':
            return value !== condition.value;
          case 'greater':
            return value > condition.value;
          case 'less':
            return value < condition.value;
          case 'greaterOrEqual':
            return value >= condition.value;
          case 'lessOrEqual':
            return value <= condition.value;
          case 'contains':
            return String(value).includes(String(condition.value));
          case 'startsWith':
            return String(value).startsWith(String(condition.value));
          case 'endsWith':
            return String(value).endsWith(String(condition.value));
          case 'in':
            return Array.isArray(condition.value) && condition.value.includes(value);
          case 'notIn':
            return Array.isArray(condition.value) && !condition.value.includes(value);
          case 'exists':
            return value !== undefined && value !== null;
          case 'notExists':
            return value === undefined || value === null;
          default:
            return false;
        }
      }

      // Handle logical operators
      if ('and' in condition && Array.isArray(condition.and)) {
        return condition.and.every((cond: any) => this.evaluateCondition(data, cond));
      }
      if ('or' in condition && Array.isArray(condition.or)) {
        return condition.or.some((cond: any) => this.evaluateCondition(data, cond));
      }
      if ('not' in condition) {
        return !this.evaluateCondition(data, condition.not);
      }
    }

    return false;
  }

  // Utility methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      // Handle array indices
      const match = key.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        const [, arrayKey, index] = match;
        const array = current[arrayKey];
        return Array.isArray(array) ? array[parseInt(index)] : undefined;
      }
      
      return current[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, key) => {
      // Handle array indices
      const match = key.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        const [, arrayKey, index] = match;
        if (!current[arrayKey]) current[arrayKey] = [];
        if (!current[arrayKey][parseInt(index)]) current[arrayKey][parseInt(index)] = {};
        return current[arrayKey][parseInt(index)];
      }
      
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    // Handle array index in last key
    const match = lastKey.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const [, arrayKey, index] = match;
      if (!target[arrayKey]) target[arrayKey] = [];
      target[arrayKey][parseInt(index)] = value;
    } else {
      target[lastKey] = value;
    }
  }

  // Batch transformation
  async transformBatch(
    items: any[],
    ruleId: string,
    options?: {
      strict?: boolean;
      includeNulls?: boolean;
      metadata?: Record<string, any>;
      concurrency?: number;
    }
  ): Promise<Array<{ data: any; errors: TransformError[] }>> {
    const concurrency = options?.concurrency || 10;
    const results: Array<{ data: any; errors: TransformError[] }> = [];

    // Process in chunks
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(item => this.transform(item, ruleId, options))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  // Create transformation rule from sample data
  inferTransformationRule(
    sourceData: any,
    targetData: any,
    options?: {
      includeTypes?: boolean;
      detectPatterns?: boolean;
    }
  ): TransformationRule {
    const mappings: FieldMapping[] = [];
    
    // Analyze source and target structures
    const sourcePaths = this.extractPaths(sourceData);
    const targetPaths = this.extractPaths(targetData);

    // Try to match fields
    for (const targetPath of targetPaths) {
      const targetValue = this.getNestedValue(targetData, targetPath);
      
      // Find matching source field
      let sourceMatch: string | undefined;
      let transform: FieldTransform | undefined;

      for (const sourcePath of sourcePaths) {
        const sourceValue = this.getNestedValue(sourceData, sourcePath);
        
        // Check if values match
        if (this.valuesMatch(sourceValue, targetValue)) {
          sourceMatch = sourcePath;
          
          // Detect type transformation if needed
          if (options?.includeTypes && typeof sourceValue !== typeof targetValue) {
            transform = this.detectTransform(sourceValue, targetValue);
          }
          break;
        }
      }

      if (sourceMatch) {
        mappings.push({
          source: sourceMatch,
          target: targetPath,
          transform
        });
      }
    }

    return {
      id: crypto.randomUUID(),
      name: 'Inferred Transformation',
      sourceFormat: 'inferred',
      targetFormat: 'inferred',
      rules: [{
        type: 'map',
        config: { mappings }
      }]
    };
  }

  // Extract all paths from an object
  private extractPaths(obj: any, prefix: string = ''): string[] {
    const paths: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.extractPaths(value, path));
      } else {
        paths.push(path);
      }
    }

    return paths;
  }

  // Check if two values match (considering type differences)
  private valuesMatch(value1: any, value2: any): boolean {
    if (value1 === value2) return true;
    
    // Try string comparison
    if (String(value1) === String(value2)) return true;
    
    // Try numeric comparison
    if (!isNaN(Number(value1)) && !isNaN(Number(value2)) && Number(value1) === Number(value2)) return true;
    
    // Try date comparison
    try {
      const date1 = new Date(value1);
      const date2 = new Date(value2);
      if (!isNaN(date1.getTime()) && !isNaN(date2.getTime()) && date1.getTime() === date2.getTime()) {
        return true;
      }
    } catch {}

    return false;
  }

  // Detect transformation needed between values
  private detectTransform(sourceValue: any, targetValue: any): FieldTransform | undefined {
    const sourceType = typeof sourceValue;
    const targetType = typeof targetValue;

    if (sourceType === targetType) return undefined;

    // Detect date transformations
    if (targetValue instanceof Date || (typeof targetValue === 'string' && !isNaN(Date.parse(targetValue)))) {
      return { type: 'date' };
    }

    // Detect numeric transformations
    if (targetType === 'number') {
      return { type: 'number' };
    }

    // Detect boolean transformations
    if (targetType === 'boolean') {
      return { type: 'boolean' };
    }

    // Detect array transformations
    if (Array.isArray(targetValue)) {
      return { type: 'array' };
    }

    // Default to string
    return { type: 'string' };
  }
}

export default new DataTransformer();