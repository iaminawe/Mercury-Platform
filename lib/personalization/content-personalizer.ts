import { Redis } from 'ioredis';

interface ContentRule {
  id: string;
  name: string;
  type: 'hero' | 'banner' | 'product_grid' | 'text' | 'cta';
  conditions: {
    segments?: string[];
    userAttributes?: Record<string, any>;
    contextual?: {
      page?: string;
      device?: string;
      time?: {
        hour?: number[];
        dayOfWeek?: number[];
      };
    };
  };
  content: {
    default: any;
    variants: Array<{
      id: string;
      conditions: any;
      content: any;
      priority: number;
    }>;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
}

export class ContentPersonalizer {
  private redis: Redis;
  private config: any;
  private rules: Map<string, ContentRule> = new Map();

  constructor(redis: Redis, config: any) {
    this.redis = redis;
    this.config = config;
    this.loadRules();
  }

  async personalizeContent(context: any): Promise<Record<string, any>> {
    const personalizedContent: Record<string, any> = {};
    
    // Get applicable rules for this context
    const applicableRules = await this.getApplicableRules(context);
    
    // Process each rule
    for (const rule of applicableRules) {
      const content = await this.selectContent(rule, context);
      personalizedContent[rule.id] = content;
      
      // Track impression
      await this.trackImpression(rule.id, content.variantId);
    }

    return personalizedContent;
  }

  private async getApplicableRules(context: any): Promise<ContentRule[]> {
    const rules: ContentRule[] = [];
    
    for (const [id, rule] of this.rules) {
      if (await this.matchesConditions(rule.conditions, context)) {
        rules.push(rule);
      }
    }
    
    return rules.sort((a, b) => b.performance.conversions - a.performance.conversions);
  }

  private async matchesConditions(conditions: any, context: any): Promise<boolean> {
    // Check segment conditions
    if (conditions.segments && conditions.segments.length > 0) {
      const userSegments = context.segments || [];
      const hasSegment = conditions.segments.some((seg: string) => 
        userSegments.includes(seg)
      );
      if (!hasSegment) return false;
    }

    // Check contextual conditions
    if (conditions.contextual) {
      const { page, device, time } = conditions.contextual;
      
      if (page && !context.currentPage.includes(page)) return false;
      if (device && context.device !== device) return false;
      
      if (time) {
        const now = new Date();
        if (time.hour && !time.hour.includes(now.getHours())) return false;
        if (time.dayOfWeek && !time.dayOfWeek.includes(now.getDay())) return false;
      }
    }

    return true;
  }

  private async selectContent(rule: ContentRule, context: any): Promise<any> {
    // Try to find matching variant
    for (const variant of rule.content.variants) {
      if (await this.matchesConditions(variant.conditions, context)) {
        return {
          ...variant.content,
          variantId: variant.id,
          ruleId: rule.id
        };
      }
    }
    
    // Return default content
    return {
      ...rule.content.default,
      variantId: 'default',
      ruleId: rule.id
    };
  }

  async trackInteraction(ruleId: string, variantId: string, interaction: string): Promise<void> {
    const key = `content:${ruleId}:${variantId}:${interaction}`;
    await this.redis.incr(key);
    
    // Update rule performance
    const rule = this.rules.get(ruleId);
    if (rule) {
      switch (interaction) {
        case 'click':
          rule.performance.clicks++;
          break;
        case 'conversion':
          rule.performance.conversions++;
          break;
      }
    }
  }

  private async trackImpression(ruleId: string, variantId: string): Promise<void> {
    const key = `content:${ruleId}:${variantId}:impressions`;
    await this.redis.incr(key);
  }

  async createRule(rule: Omit<ContentRule, 'performance'>): Promise<ContentRule> {
    const newRule: ContentRule = {
      ...rule,
      performance: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    };
    
    this.rules.set(rule.id, newRule);
    await this.saveRules();
    
    return newRule;
  }

  async updateRule(id: string, updates: Partial<ContentRule>): Promise<ContentRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;
    
    const updatedRule = { ...rule, ...updates };
    this.rules.set(id, updatedRule);
    await this.saveRules();
    
    return updatedRule;
  }

  async deleteRule(id: string): Promise<boolean> {
    const deleted = this.rules.delete(id);
    if (deleted) {
      await this.saveRules();
    }
    return deleted;
  }

  async getPerformanceStats(): Promise<any> {
    const stats: any = {
      totalRules: this.rules.size,
      rulePerformance: []
    };
    
    for (const [id, rule] of this.rules) {
      const ctr = rule.performance.impressions > 0 
        ? rule.performance.clicks / rule.performance.impressions 
        : 0;
      
      const conversionRate = rule.performance.clicks > 0
        ? rule.performance.conversions / rule.performance.clicks
        : 0;
      
      stats.rulePerformance.push({
        id,
        name: rule.name,
        type: rule.type,
        impressions: rule.performance.impressions,
        clicks: rule.performance.clicks,
        conversions: rule.performance.conversions,
        ctr,
        conversionRate,
        revenue: rule.performance.revenue
      });
    }
    
    // Sort by revenue
    stats.rulePerformance.sort((a: any, b: any) => b.revenue - a.revenue);
    
    return stats;
  }

  private async loadRules(): Promise<void> {
    // Load from Redis or database
    const rulesData = await this.redis.get('personalization:rules');
    if (rulesData) {
      const rules = JSON.parse(rulesData);
      rules.forEach((rule: ContentRule) => {
        this.rules.set(rule.id, rule);
      });
    } else {
      // Initialize with default rules
      this.initializeDefaultRules();
    }
  }

  private async saveRules(): Promise<void> {
    const rulesArray = Array.from(this.rules.values());
    await this.redis.set('personalization:rules', JSON.stringify(rulesArray));
  }

  private initializeDefaultRules(): void {
    // Hero banner for new users
    this.rules.set('hero_new_user', {
      id: 'hero_new_user',
      name: 'New User Hero Banner',
      type: 'hero',
      conditions: {
        segments: ['new_user']
      },
      content: {
        default: {
          title: 'Welcome to Our Store',
          subtitle: 'Discover amazing products',
          cta: 'Shop Now',
          image: '/images/hero-default.jpg'
        },
        variants: [
          {
            id: 'welcome_offer',
            conditions: { segments: ['new_user'] },
            content: {
              title: 'Welcome! Get 15% Off Your First Order',
              subtitle: 'Use code: WELCOME15',
              cta: 'Start Shopping',
              image: '/images/hero-welcome.jpg'
            },
            priority: 1
          }
        ]
      },
      performance: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    });

    // Product grid for high value customers
    this.rules.set('products_high_value', {
      id: 'products_high_value',
      name: 'Premium Products for VIP',
      type: 'product_grid',
      conditions: {
        segments: ['high_value']
      },
      content: {
        default: {
          title: 'Recommended for You',
          layout: 'grid',
          productCount: 8
        },
        variants: [
          {
            id: 'premium_selection',
            conditions: { segments: ['high_value'] },
            content: {
              title: 'Exclusive VIP Selection',
              layout: 'carousel',
              productCount: 12,
              filters: { premium: true }
            },
            priority: 1
          }
        ]
      },
      performance: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    });

    // Time-based content
    this.rules.set('morning_banner', {
      id: 'morning_banner',
      name: 'Morning Coffee Banner',
      type: 'banner',
      conditions: {
        contextual: {
          time: {
            hour: [6, 7, 8, 9, 10, 11]
          }
        }
      },
      content: {
        default: {
          text: 'Start Your Day Right',
          background: '#f0f0f0'
        },
        variants: [
          {
            id: 'coffee_promo',
            conditions: {
              contextual: {
                time: { hour: [6, 7, 8, 9] }
              }
            },
            content: {
              text: 'Morning Special: 20% Off Coffee Products',
              background: '#8B4513',
              link: '/collections/coffee'
            },
            priority: 1
          }
        ]
      },
      performance: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    });
  }
}