import { Insight, InsightAction, RecommendationEngine } from './types';
import { AnomalyDetector } from './anomaly-detector';
import { createLogger } from '@/lib/logger';

const logger = createLogger('recommendation-engine');

export class ShopifyRecommendationEngine implements RecommendationEngine {
  private anomalyDetector: AnomalyDetector;

  constructor() {
    this.anomalyDetector = new AnomalyDetector();
  }

  /**
   * Generate actionable recommendations from store data
   */
  async generateRecommendations(
    data: any[],
    context: Record<string, any>
  ): Promise<Insight[]> {
    try {
      const insights: Insight[] = [];
      
      // Generate anomaly-based insights
      if (context.salesData) {
        const salesInsights = await this.generateSalesInsights(context.salesData, context);
        insights.push(...salesInsights);
      }
      
      if (context.trafficData) {
        const trafficInsights = await this.generateTrafficInsights(context.trafficData, context);
        insights.push(...trafficInsights);
      }
      
      if (context.productData) {
        const productInsights = await this.generateProductInsights(context.productData, context);
        insights.push(...productInsights);
      }
      
      if (context.customerData) {
        const customerInsights = await this.generateCustomerInsights(context.customerData, context);
        insights.push(...customerInsights);
      }
      
      // Generate trend-based insights
      const trendInsights = await this.generateTrendInsights(data, context);
      insights.push(...trendInsights);
      
      // Generate opportunity insights
      const opportunityInsights = await this.generateOpportunityInsights(data, context);
      insights.push(...opportunityInsights);
      
      // Sort by priority and confidence
      const sortedInsights = this.sortInsightsByPriority(insights);
      
      logger.info('Recommendations generated', {
        totalInsights: sortedInsights.length,
        highPriority: sortedInsights.filter(i => i.priority === 'high' || i.priority === 'critical').length,
        actionable: sortedInsights.filter(i => i.actionable).length
      });
      
      return sortedInsights;
    } catch (error) {
      logger.error('Error generating recommendations', error);
      return [];
    }
  }

  /**
   * Generate sales-focused insights and recommendations
   */
  private async generateSalesInsights(
    salesData: Array<{ date: string; amount: number; orders: number }>,
    context: Record<string, any>
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Detect sales anomalies
    const anomalies = await this.anomalyDetector.detectSalesAnomalies(salesData, context);
    
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        // Sales drop anomaly
        if (!anomaly.context.isPositiveAnomaly) {
          insights.push({
            id: `sales-drop-${anomaly.timestamp}`,
            title: 'Significant Sales Drop Detected',
            description: `Sales dropped by ${Math.abs(anomaly.deviation).toFixed(1)}% on ${new Date(anomaly.timestamp).toLocaleDateString()}. This is ${anomaly.deviation < -50 ? 'critically' : 'significantly'} below expected levels.`,
            type: 'anomaly',
            confidence: anomaly.confidence,
            priority: anomaly.severity,
            category: 'sales',
            actionable: true,
            actions: this.generateSalesDropActions(anomaly, context),
            data: { anomaly, historicalAverage: anomaly.expectedValue },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        
        // Sales spike analysis
        if (anomaly.context.isPositiveAnomaly && anomaly.deviation > 25) {
          insights.push({
            id: `sales-spike-${anomaly.timestamp}`,
            title: 'Exceptional Sales Performance',
            description: `Sales increased by ${anomaly.deviation.toFixed(1)}% on ${new Date(anomaly.timestamp).toLocaleDateString()}. Analyze and replicate this success.`,
            type: 'opportunity',
            confidence: anomaly.confidence,
            priority: 'medium',
            category: 'sales',
            actionable: true,
            actions: this.generateSalesSpikeActions(anomaly, context),
            data: { anomaly, historicalAverage: anomaly.expectedValue },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
    
    // Analyze sales trends
    const recentData = salesData.slice(-30); // Last 30 days
    if (recentData.length >= 7) {
      const trendInsight = this.analyzeSalesTrend(recentData, context);
      if (trendInsight) insights.push(trendInsight);
    }
    
    return insights;
  }

  /**
   * Generate traffic-focused insights
   */
  private async generateTrafficInsights(
    trafficData: Array<{ date: string; visitors: number; pageViews: number; bounceRate: number }>,
    context: Record<string, any>
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    const anomalies = await this.anomalyDetector.detectTrafficAnomalies(trafficData, context);
    
    for (const anomaly of anomalies) {
      if (anomaly.metricName === 'bounce_rate' && anomaly.context.isPositiveAnomaly) {
        insights.push({
          id: `bounce-rate-spike-${anomaly.timestamp}`,
          title: 'High Bounce Rate Alert',
          description: `Bounce rate increased to ${anomaly.actualValue.toFixed(1)}% on ${new Date(anomaly.timestamp).toLocaleDateString()}, which is ${Math.abs(anomaly.deviation).toFixed(1)}% above normal.`,
          type: 'anomaly',
          confidence: anomaly.confidence,
          priority: anomaly.severity,
          category: 'traffic',
          actionable: true,
          actions: this.generateBounceRateActions(anomaly, context),
          data: { anomaly },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      if (anomaly.metricName === 'visitors' && !anomaly.context.isPositiveAnomaly) {
        insights.push({
          id: `traffic-drop-${anomaly.timestamp}`,
          title: 'Traffic Decline Detected',
          description: `Website visitors dropped by ${Math.abs(anomaly.deviation).toFixed(1)}% on ${new Date(anomaly.timestamp).toLocaleDateString()}.`,
          type: 'anomaly',
          confidence: anomaly.confidence,
          priority: anomaly.severity,
          category: 'traffic',
          actionable: true,
          actions: this.generateTrafficDropActions(anomaly, context),
          data: { anomaly },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    return insights;
  }

  /**
   * Generate product-focused insights
   */
  private async generateProductInsights(
    productData: Array<{ id: string; title: string; sales: number; views: number; inventory: number }>,
    context: Record<string, any>
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Low inventory alerts
    const lowInventoryProducts = productData.filter(p => p.inventory < 10 && p.sales > 0);
    if (lowInventoryProducts.length > 0) {
      insights.push({
        id: `low-inventory-${Date.now()}`,
        title: 'Low Inventory Alert',
        description: `${lowInventoryProducts.length} products have low inventory levels and are still generating sales.`,
        type: 'recommendation',
        confidence: 0.95,
        priority: 'high',
        category: 'products',
        actionable: true,
        actions: this.generateInventoryActions(lowInventoryProducts, context),
        data: { products: lowInventoryProducts },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Underperforming products
    const avgConversionRate = productData.reduce((sum, p) => sum + (p.sales / Math.max(p.views, 1)), 0) / productData.length;
    const underperformers = productData.filter(p => {
      const conversionRate = p.sales / Math.max(p.views, 1);
      return p.views > 100 && conversionRate < avgConversionRate * 0.5;
    });
    
    if (underperformers.length > 0) {
      insights.push({
        id: `underperforming-products-${Date.now()}`,
        title: 'Underperforming Products Identified',
        description: `${underperformers.length} products have high traffic but low conversion rates.`,
        type: 'opportunity',
        confidence: 0.8,
        priority: 'medium',
        category: 'products',
        actionable: true,
        actions: this.generateProductOptimizationActions(underperformers, context),
        data: { products: underperformers, avgConversionRate },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return insights;
  }

  /**
   * Generate customer-focused insights
   */
  private async generateCustomerInsights(
    customerData: Array<{ segment: string; count: number; avgOrderValue: number; retention: number }>,
    context: Record<string, any>
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // High-value customer opportunities
    const highValueSegments = customerData.filter(c => c.avgOrderValue > 100 && c.retention < 0.3);
    if (highValueSegments.length > 0) {
      insights.push({
        id: `high-value-retention-${Date.now()}`,
        title: 'High-Value Customer Retention Opportunity',
        description: `${highValueSegments.length} customer segments have high order values but low retention rates.`,
        type: 'opportunity',
        confidence: 0.85,
        priority: 'high',
        category: 'customers',
        actionable: true,
        actions: this.generateRetentionActions(highValueSegments, context),
        data: { segments: highValueSegments },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return insights;
  }

  /**
   * Generate trend-based insights
   */
  private async generateTrendInsights(data: any[], context: Record<string, any>): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Seasonal trend analysis would go here
    // For MVP, we'll add basic trend detection
    
    return insights;
  }

  /**
   * Generate opportunity insights
   */
  private async generateOpportunityInsights(data: any[], context: Record<string, any>): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Cross-selling opportunities, pricing optimizations, etc.
    // For MVP, we'll focus on basic opportunities
    
    return insights;
  }

  /**
   * Generate actions for sales drop anomalies
   */
  private generateSalesDropActions(anomaly: any, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'check-inventory',
        title: 'Check Product Inventory',
        description: 'Verify that popular products are still in stock',
        type: 'inventory_alert',
        confidence: 0.9,
        estimatedImpact: 'High - Prevent lost sales',
        parameters: { action: 'inventory_check' },
        canAutoImplement: true
      },
      {
        id: 'review-pricing',
        title: 'Review Recent Pricing Changes',
        description: 'Check if recent price changes affected sales',
        type: 'custom',
        confidence: 0.8,
        estimatedImpact: 'Medium - Identify pricing issues',
        parameters: { action: 'pricing_review' },
        canAutoImplement: false
      },
      {
        id: 'marketing-boost',
        title: 'Launch Emergency Marketing Campaign',
        description: 'Create targeted ads to boost traffic and sales',
        type: 'marketing_action',
        confidence: 0.7,
        estimatedImpact: 'High - Increase visibility',
        parameters: { budget: 100, duration: '3 days' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Generate actions for sales spikes
   */
  private generateSalesSpikeActions(anomaly: any, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'analyze-traffic-source',
        title: 'Analyze Traffic Sources',
        description: 'Identify what drove the sales increase',
        type: 'custom',
        confidence: 0.95,
        estimatedImpact: 'High - Replicate success',
        parameters: { action: 'traffic_analysis' },
        canAutoImplement: true
      },
      {
        id: 'increase-inventory',
        title: 'Increase Inventory for Hot Products',
        description: 'Ensure adequate stock for trending products',
        type: 'inventory_alert',
        confidence: 0.85,
        estimatedImpact: 'High - Capitalize on demand',
        parameters: { action: 'inventory_increase' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Generate actions for bounce rate issues
   */
  private generateBounceRateActions(anomaly: any, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'page-speed-check',
        title: 'Check Page Load Speed',
        description: 'High bounce rates often correlate with slow loading pages',
        type: 'custom',
        confidence: 0.8,
        estimatedImpact: 'High - Improve user experience',
        parameters: { action: 'speed_test' },
        canAutoImplement: true
      },
      {
        id: 'landing-page-review',
        title: 'Review Landing Page Content',
        description: 'Ensure landing pages match visitor expectations',
        type: 'custom',
        confidence: 0.75,
        estimatedImpact: 'Medium - Better content alignment',
        parameters: { action: 'content_review' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Generate actions for traffic drops
   */
  private generateTrafficDropActions(anomaly: any, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'seo-check',
        title: 'Check SEO Rankings',
        description: 'Verify search engine rankings haven\'t dropped',
        type: 'custom',
        confidence: 0.85,
        estimatedImpact: 'High - Maintain organic traffic',
        parameters: { action: 'seo_audit' },
        canAutoImplement: true
      },
      {
        id: 'ad-campaign-review',
        title: 'Review Ad Campaigns',
        description: 'Check if paid advertising campaigns are still active',
        type: 'marketing_action',
        confidence: 0.9,
        estimatedImpact: 'High - Restore paid traffic',
        parameters: { action: 'campaign_review' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Generate inventory-related actions
   */
  private generateInventoryActions(products: any[], context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'restock-products',
        title: 'Restock Low Inventory Products',
        description: `Reorder inventory for ${products.length} products`,
        type: 'inventory_alert',
        confidence: 0.95,
        estimatedImpact: 'Critical - Prevent stockouts',
        parameters: { productIds: products.map(p => p.id) },
        canAutoImplement: false
      },
      {
        id: 'low-stock-notification',
        title: 'Enable Low Stock Notifications',
        description: 'Set up automatic alerts for low inventory',
        type: 'shopify_update',
        confidence: 0.9,
        estimatedImpact: 'Medium - Proactive management',
        parameters: { threshold: 10 },
        canAutoImplement: true
      }
    ];
  }

  /**
   * Generate product optimization actions
   */
  private generateProductOptimizationActions(products: any[], context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'improve-product-images',
        title: 'Improve Product Images',
        description: 'Update product photos to increase conversion',
        type: 'shopify_update',
        confidence: 0.8,
        estimatedImpact: 'Medium - Better visual appeal',
        parameters: { productIds: products.map(p => p.id) },
        canAutoImplement: false
      },
      {
        id: 'optimize-descriptions',
        title: 'Optimize Product Descriptions',
        description: 'Enhance product descriptions with AI',
        type: 'shopify_update',
        confidence: 0.75,
        estimatedImpact: 'Medium - Clearer value proposition',
        parameters: { productIds: products.map(p => p.id) },
        canAutoImplement: true
      }
    ];
  }

  /**
   * Generate customer retention actions
   */
  private generateRetentionActions(segments: any[], context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'loyalty-program',
        title: 'Create Loyalty Program',
        description: 'Implement a loyalty program for high-value customers',
        type: 'marketing_action',
        confidence: 0.8,
        estimatedImpact: 'High - Increase retention',
        parameters: { segments: segments.map(s => s.segment) },
        canAutoImplement: false
      },
      {
        id: 'personalized-offers',
        title: 'Send Personalized Offers',
        description: 'Create targeted offers for each customer segment',
        type: 'marketing_action',
        confidence: 0.85,
        estimatedImpact: 'High - Improve retention',
        parameters: { segments: segments.map(s => s.segment) },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Analyze sales trend for the given period
   */
  private analyzeSalesTrend(
    salesData: Array<{ date: string; amount: number; orders: number }>,
    context: Record<string, any>
  ): Insight | null {
    if (salesData.length < 7) return null;
    
    const firstWeek = salesData.slice(0, 7);
    const lastWeek = salesData.slice(-7);
    
    const firstWeekAvg = firstWeek.reduce((sum, d) => sum + d.amount, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, d) => sum + d.amount, 0) / lastWeek.length;
    
    const trendChange = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;
    
    if (Math.abs(trendChange) > 10) {
      return {
        id: `sales-trend-${Date.now()}`,
        title: trendChange > 0 ? 'Positive Sales Trend' : 'Declining Sales Trend',
        description: `Sales have ${trendChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(trendChange).toFixed(1)}% over the last week compared to the first week.`,
        type: 'trend',
        confidence: 0.8,
        priority: Math.abs(trendChange) > 20 ? 'high' : 'medium',
        category: 'sales',
        actionable: true,
        actions: trendChange > 0 ? 
          this.generatePositiveTrendActions(trendChange, context) : 
          this.generateNegativeTrendActions(trendChange, context),
        data: { trendChange, firstWeekAvg, lastWeekAvg },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    return null;
  }

  /**
   * Generate actions for positive trends
   */
  private generatePositiveTrendActions(trendChange: number, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'capitalize-on-trend',
        title: 'Capitalize on Positive Trend',
        description: 'Increase marketing spend to amplify the positive trend',
        type: 'marketing_action',
        confidence: 0.8,
        estimatedImpact: 'High - Maximize growth',
        parameters: { budgetIncrease: '20%' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Generate actions for negative trends
   */
  private generateNegativeTrendActions(trendChange: number, context: Record<string, any>): InsightAction[] {
    return [
      {
        id: 'address-decline',
        title: 'Address Sales Decline',
        description: 'Investigate and address the declining sales trend',
        type: 'custom',
        confidence: 0.9,
        estimatedImpact: 'Critical - Stop revenue loss',
        parameters: { action: 'trend_analysis' },
        canAutoImplement: false
      }
    ];
  }

  /**
   * Sort insights by priority and confidence
   */
  private sortInsightsByPriority(insights: Insight[]): Insight[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return insights.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Score confidence for a recommendation
   */
  scoreConfidence(recommendation: Insight): number {
    return recommendation.confidence;
  }
}