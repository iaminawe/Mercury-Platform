import { Variant, VariantModification } from './types';
import { createClient } from '@/lib/supabase/client';

export class VariantManager {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new variant for an experiment
   */
  async createVariant(
    experimentId: string,
    variant: Omit<Variant, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Variant> {
    const variantId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const fullVariant: Variant = {
      ...variant,
      id: variantId,
      experiment_id: experimentId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await this.supabase
      .from('experiment_variants')
      .insert(fullVariant)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update variant configuration
   */
  async updateVariant(
    variantId: string,
    updates: Partial<Variant>
  ): Promise<Variant> {
    const { data, error } = await this.supabase
      .from('experiment_variants')
      .update({
        ...updates,
        updated_at: new Date()
      })
      .eq('id', variantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Apply variant modifications to content
   */
  applyVariantModifications(
    originalContent: string,
    modifications: VariantModification[]
  ): string {
    let modifiedContent = originalContent;

    for (const mod of modifications) {
      switch (mod.type) {
        case 'element':
          modifiedContent = this.applyElementModification(modifiedContent, mod);
          break;
        
        case 'text':
          modifiedContent = this.applyTextModification(modifiedContent, mod);
          break;
        
        case 'style':
          modifiedContent = this.applyStyleModification(modifiedContent, mod);
          break;
        
        case 'feature_flag':
          modifiedContent = this.applyFeatureFlagModification(modifiedContent, mod);
          break;
        
        case 'code':
          modifiedContent = this.applyCodeModification(modifiedContent, mod);
          break;
      }
    }

    return modifiedContent;
  }

  /**
   * Apply element-level modifications (DOM manipulation)
   */
  private applyElementModification(
    content: string,
    modification: VariantModification
  ): string {
    if (!modification.target) return content;

    // This is a simplified example - in practice, you'd use a proper HTML parser
    const { action, value } = modification;
    
    switch (action) {
      case 'hide':
        return content.replace(
          new RegExp(`(<[^>]*id="${modification.target}"[^>]*>)`, 'g'),
          '$1 style="display: none;"'
        );
      
      case 'show':
        return content.replace(
          new RegExp(`style="[^"]*display:\\s*none[^"]*"`, 'g'),
          ''
        );
      
      case 'remove':
        return content.replace(
          new RegExp(`<[^>]*id="${modification.target}"[^>]*>.*?</[^>]+>`, 'gs'),
          ''
        );
      
      case 'replace':
        if (typeof value === 'string') {
          return content.replace(
            new RegExp(`(<[^>]*id="${modification.target}"[^>]*>).*?(</[^>]+>)`, 'gs'),
            `$1${value}$2`
          );
        }
        return content;
      
      default:
        return content;
    }
  }

  /**
   * Apply text modifications
   */
  private applyTextModification(
    content: string,
    modification: VariantModification
  ): string {
    const { target, value } = modification;
    
    if (target && typeof value === 'string') {
      return content.replace(new RegExp(target, 'g'), value);
    }
    
    return content;
  }

  /**
   * Apply style modifications
   */
  private applyStyleModification(
    content: string,
    modification: VariantModification
  ): string {
    const { target, value } = modification;
    
    if (target && typeof value === 'object') {
      const styleString = Object.entries(value)
        .map(([key, val]) => `${key}: ${val}`)
        .join('; ');
      
      return content.replace(
        new RegExp(`(<[^>]*id="${target}"[^>]*)(>)`, 'g'),
        `$1 style="${styleString}">$2`
      );
    }
    
    return content;
  }

  /**
   * Apply feature flag modifications
   */
  private applyFeatureFlagModification(
    content: string,
    modification: VariantModification
  ): string {
    const { target, value } = modification;
    
    if (target && value !== undefined) {
      // Inject feature flag configuration
      const flagScript = `
        <script>
          window.__FEATURE_FLAGS = window.__FEATURE_FLAGS || {};
          window.__FEATURE_FLAGS['${target}'] = ${JSON.stringify(value)};
        </script>
      `;
      
      // Insert before closing body tag
      return content.replace('</body>', `${flagScript}</body>`);
    }
    
    return content;
  }

  /**
   * Apply custom code modifications
   */
  private applyCodeModification(
    content: string,
    modification: VariantModification
  ): string {
    const { code, target } = modification;
    
    if (code) {
      const codeScript = `
        <script>
          (function() {
            ${code}
          })();
        </script>
      `;
      
      if (target) {
        // Insert after specific element
        return content.replace(
          new RegExp(`(<[^>]*id="${target}"[^>]*>.*?</[^>]+>)`, 'gs'),
          `$1${codeScript}`
        );
      } else {
        // Insert before closing body tag
        return content.replace('</body>', `${codeScript}</body>`);
      }
    }
    
    return content;
  }

  /**
   * Validate variant configuration
   */
  validateVariant(variant: Partial<Variant>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!variant.name || variant.name.trim().length === 0) {
      errors.push('Variant name is required');
    }

    if (variant.traffic_percentage !== undefined) {
      if (variant.traffic_percentage < 0 || variant.traffic_percentage > 100) {
        errors.push('Traffic percentage must be between 0 and 100');
      }
    }

    if (variant.config && typeof variant.config !== 'object') {
      errors.push('Variant config must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clone a variant
   */
  async cloneVariant(
    variantId: string,
    newName: string,
    experimentId?: string
  ): Promise<Variant> {
    const { data: original, error } = await this.supabase
      .from('experiment_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (error) throw error;

    const clonedVariant = {
      ...original,
      id: undefined,
      name: newName,
      experiment_id: experimentId || original.experiment_id,
      created_at: undefined,
      updated_at: undefined
    };

    return this.createVariant(clonedVariant.experiment_id, clonedVariant);
  }

  /**
   * Archive a variant (soft delete)
   */
  async archiveVariant(variantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('experiment_variants')
      .update({
        archived: true,
        archived_at: new Date(),
        updated_at: new Date()
      })
      .eq('id', variantId);

    if (error) throw error;
  }

  /**
   * Get variant performance metrics
   */
  async getVariantPerformance(variantId: string): Promise<{
    impressions: number;
    conversions: number;
    conversionRate: number;
    averageValue: number;
    confidenceInterval: { lower: number; upper: number };
  }> {
    // Get events for this variant
    const { data: events, error } = await this.supabase
      .from('experiment_events')
      .select('event_type, value')
      .eq('variant_id', variantId);

    if (error) throw error;

    const impressions = events?.filter(e => e.event_type === 'exposure').length || 0;
    const conversions = events?.filter(e => e.event_type === 'conversion').length || 0;
    const conversionRate = impressions > 0 ? conversions / impressions : 0;
    
    const conversionValues = events
      ?.filter(e => e.event_type === 'conversion' && e.value)
      .map(e => e.value) || [];
    
    const averageValue = conversionValues.length > 0
      ? conversionValues.reduce((sum, val) => sum + val, 0) / conversionValues.length
      : 0;

    // Calculate confidence interval using Wilson score interval
    const z = 1.96; // 95% confidence
    const n = impressions;
    const p = conversionRate;
    
    const denominator = 1 + z * z / n;
    const centerValue = p + z * z / (2 * n);
    const marginOfError = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    
    const confidenceInterval = {
      lower: Math.max(0, (centerValue - marginOfError) / denominator),
      upper: Math.min(1, (centerValue + marginOfError) / denominator)
    };

    return {
      impressions,
      conversions,
      conversionRate,
      averageValue,
      confidenceInterval
    };
  }
}

export default VariantManager;