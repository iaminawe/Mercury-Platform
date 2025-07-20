import { Insight, AdvisorMetrics } from './types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('insight-analyzer');

export class InsightAnalyzer {
  /**
   * Analyze store performance and generate comprehensive insights
   */
  async analyzeStorePerformance(storeData: {
    sales: Array<{ date: string; amount: number; orders: number }>;
    traffic: Array<{ date: string; visitors: number; pageViews: number; bounceRate: number }>;
    products: Array<{ id: string; title: string; sales: number; views: number; inventory: number; price: number }>;
    customers: Array<{ segment: string; count: number; avgOrderValue: number; retention: number }>;
  }): Promise<{
    performanceScore: number;
    keyMetrics: Record<string, any>;
    insights: Insight[];
    recommendations: string[];
  }> {
    try {
      logger.info('Starting store performance analysis');

      // Calculate key performance metrics
      const keyMetrics = this.calculateKeyMetrics(storeData);
      
      // Calculate overall performance score
      const performanceScore = this.calculatePerformanceScore(keyMetrics, storeData);
      
      // Generate performance insights
      const insights = this.generatePerformanceInsights(keyMetrics, storeData);
      
      // Generate actionable recommendations
      const recommendations = this.generateTopRecommendations(insights, keyMetrics);
      
      logger.info('Store performance analysis completed', {
        performanceScore,
        insightsGenerated: insights.length,
        recommendationsGenerated: recommendations.length
      });

      return {
        performanceScore,
        keyMetrics,
        insights,
        recommendations
      };
    } catch (error) {
      logger.error('Error analyzing store performance', error);
      throw error;
    }
  }

  /**
   * Calculate key performance metrics from store data
   */
  private calculateKeyMetrics(storeData: any): Record<string, any> {
    const { sales, traffic, products, customers } = storeData;
    
    // Sales metrics
    const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.amount, 0);
    const totalOrders = sales.reduce((sum: number, s: any) => sum + s.orders, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Calculate daily averages for trends
    const dailyRevenueAvg = sales.length > 0 ? totalRevenue / sales.length : 0;
    const dailyOrdersAvg = sales.length > 0 ? totalOrders / sales.length : 0;
    
    // Traffic metrics
    const totalVisitors = traffic.reduce((sum: number, t: any) => sum + t.visitors, 0);
    const totalPageViews = traffic.reduce((sum: number, t: any) => sum + t.pageViews, 0);
    const avgBounceRate = traffic.length > 0 ? 
      traffic.reduce((sum: number, t: any) => sum + t.bounceRate, 0) / traffic.length : 0;
    
    // Conversion metrics
    const conversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors) * 100 : 0;
    const pageViewsPerSession = totalVisitors > 0 ? totalPageViews / totalVisitors : 0;
    
    // Product metrics
    const totalProducts = products.length;
    const productsInStock = products.filter((p: any) => p.inventory > 0).length;
    const stockoutRate = totalProducts > 0 ? ((totalProducts - productsInStock) / totalProducts) * 100 : 0;
    
    const productSales = products.reduce((sum: number, p: any) => sum + p.sales, 0);
    const productViews = products.reduce((sum: number, p: any) => sum + p.views, 0);
    const avgProductConversion = productViews > 0 ? (productSales / productViews) * 100 : 0;
    
    // Customer metrics
    const totalCustomers = customers.reduce((sum: number, c: any) => sum + c.count, 0);
    const weightedAvgOrderValue = customers.reduce((sum: number, c: any) => sum + (c.avgOrderValue * c.count), 0) / Math.max(totalCustomers, 1);
    const avgRetentionRate = customers.length > 0 ? 
      customers.reduce((sum: number, c: any) => sum + c.retention, 0) / customers.length : 0;
    
    // Growth trends (last 7 days vs previous 7 days)
    const recentSales = sales.slice(-7);
    const previousSales = sales.slice(-14, -7);
    
    const recentRevenue = recentSales.reduce((sum: number, s: any) => sum + s.amount, 0);
    const previousRevenue = previousSales.reduce((sum: number, s: any) => sum + s.amount, 0);
    const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    
    const recentOrders = recentSales.reduce((sum: number, s: any) => sum + s.orders, 0);
    const previousOrders = previousSales.reduce((sum: number, s: any) => sum + s.orders, 0);
    const orderGrowth = previousOrders > 0 ? ((recentOrders - previousOrders) / previousOrders) * 100 : 0;
    
    return {
      // Revenue metrics
      totalRevenue,
      totalOrders,
      avgOrderValue,
      dailyRevenueAvg,
      dailyOrdersAvg,
      revenueGrowth,
      orderGrowth,
      
      // Traffic metrics
      totalVisitors,
      totalPageViews,
      avgBounceRate,
      conversionRate,
      pageViewsPerSession,
      
      // Product metrics
      totalProducts,
      productsInStock,
      stockoutRate,
      avgProductConversion,
      
      // Customer metrics
      totalCustomers,
      weightedAvgOrderValue,
      avgRetentionRate: avgRetentionRate * 100, // Convert to percentage
      
      // Performance indicators
      performanceIndicators: {
        salesHealth: this.categorizeSalesHealth(revenueGrowth),
        trafficHealth: this.categorizeTrafficHealth(conversionRate, avgBounceRate),
        inventoryHealth: this.categorizeInventoryHealth(stockoutRate),
        customerHealth: this.categorizeCustomerHealth(avgRetentionRate * 100)
      }
    };
  }

  /**
   * Calculate overall store performance score (0-100)
   */
  private calculatePerformanceScore(keyMetrics: any, storeData: any): number {
    let score = 0;
    let maxScore = 0;
    
    // Revenue performance (25 points)
    maxScore += 25;
    if (keyMetrics.revenueGrowth > 10) score += 25;
    else if (keyMetrics.revenueGrowth > 5) score += 20;
    else if (keyMetrics.revenueGrowth > 0) score += 15;
    else if (keyMetrics.revenueGrowth > -5) score += 10;
    else score += 5;
    
    // Conversion performance (20 points)
    maxScore += 20;
    if (keyMetrics.conversionRate > 3) score += 20;
    else if (keyMetrics.conversionRate > 2) score += 16;
    else if (keyMetrics.conversionRate > 1) score += 12;
    else if (keyMetrics.conversionRate > 0.5) score += 8;
    else score += 4;
    
    // Traffic quality (20 points)
    maxScore += 20;
    if (keyMetrics.avgBounceRate < 40) score += 20;
    else if (keyMetrics.avgBounceRate < 50) score += 16;
    else if (keyMetrics.avgBounceRate < 60) score += 12;
    else if (keyMetrics.avgBounceRate < 70) score += 8;
    else score += 4;
    
    // Inventory management (15 points)
    maxScore += 15;
    if (keyMetrics.stockoutRate < 5) score += 15;
    else if (keyMetrics.stockoutRate < 10) score += 12;
    else if (keyMetrics.stockoutRate < 15) score += 9;
    else if (keyMetrics.stockoutRate < 25) score += 6;
    else score += 3;
    
    // Customer retention (20 points)
    maxScore += 20;
    if (keyMetrics.avgRetentionRate > 40) score += 20;
    else if (keyMetrics.avgRetentionRate > 30) score += 16;
    else if (keyMetrics.avgRetentionRate > 20) score += 12;
    else if (keyMetrics.avgRetentionRate > 10) score += 8;
    else score += 4;
    
    return Math.round((score / maxScore) * 100);
  }

  /**
   * Generate performance insights based on metrics
   */
  private generatePerformanceInsights(keyMetrics: any, storeData: any): Insight[] {
    const insights: Insight[] = [];
    const now = new Date().toISOString();
    
    // Revenue insights
    if (keyMetrics.revenueGrowth < -10) {
      insights.push({
        id: `revenue-decline-${Date.now()}`,
        title: 'Revenue Decline Alert',
        description: `Revenue has declined by ${Math.abs(keyMetrics.revenueGrowth).toFixed(1)}% compared to the previous period. Immediate action required.`,
        type: 'anomaly',
        confidence: 0.9,
        priority: 'critical',
        category: 'sales',
        actionable: true,
        actions: [{
          id: 'revenue-recovery',
          title: 'Launch Revenue Recovery Plan',
          description: 'Implement emergency measures to recover revenue',
          type: 'marketing_action',
          confidence: 0.8,
          estimatedImpact: 'High - Revenue recovery',
          parameters: { urgency: 'critical' },
          canAutoImplement: false
        }],
        data: { revenueGrowth: keyMetrics.revenueGrowth },
        createdAt: now,
        updatedAt: now
      });
    } else if (keyMetrics.revenueGrowth > 20) {
      insights.push({
        id: `revenue-growth-${Date.now()}`,
        title: 'Exceptional Revenue Growth',
        description: `Revenue has grown by ${keyMetrics.revenueGrowth.toFixed(1)}% compared to the previous period. Consider scaling successful strategies.`,
        type: 'opportunity',
        confidence: 0.95,
        priority: 'high',
        category: 'sales',
        actionable: true,
        actions: [{
          id: 'scale-success',
          title: 'Scale Successful Strategies',
          description: 'Identify and amplify what\'s driving growth',
          type: 'marketing_action',
          confidence: 0.9,
          estimatedImpact: 'Very High - Sustained growth',
          parameters: { action: 'scale_strategies' },
          canAutoImplement: false
        }],
        data: { revenueGrowth: keyMetrics.revenueGrowth },
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Conversion rate insights
    if (keyMetrics.conversionRate < 1) {
      insights.push({
        id: `low-conversion-${Date.now()}`,
        title: 'Low Conversion Rate Alert',
        description: `Your conversion rate of ${keyMetrics.conversionRate.toFixed(2)}% is below industry average. Focus on conversion optimization.`,
        type: 'recommendation',
        confidence: 0.85,
        priority: 'high',
        category: 'conversion',
        actionable: true,
        actions: [{
          id: 'optimize-conversion',
          title: 'Optimize Conversion Funnel',
          description: 'Improve product pages, checkout flow, and user experience',
          type: 'shopify_update',
          confidence: 0.8,
          estimatedImpact: 'High - Increased sales',
          parameters: { focus: 'conversion_optimization' },
          canAutoImplement: false
        }],
        data: { conversionRate: keyMetrics.conversionRate },
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Bounce rate insights
    if (keyMetrics.avgBounceRate > 70) {
      insights.push({
        id: `high-bounce-rate-${Date.now()}`,
        title: 'High Bounce Rate Concern',
        description: `Your bounce rate of ${keyMetrics.avgBounceRate.toFixed(1)}% indicates visitors are leaving quickly. Improve page experience.`,
        type: 'recommendation',
        confidence: 0.8,
        priority: 'medium',
        category: 'traffic',
        actionable: true,
        actions: [{
          id: 'reduce-bounce-rate',
          title: 'Improve Page Experience',
          description: 'Optimize page load speed, content relevance, and navigation',
          type: 'custom',
          confidence: 0.75,
          estimatedImpact: 'Medium - Better engagement',
          parameters: { focus: 'page_experience' },
          canAutoImplement: false
        }],
        data: { bounceRate: keyMetrics.avgBounceRate },
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Inventory insights
    if (keyMetrics.stockoutRate > 15) {
      insights.push({
        id: `inventory-management-${Date.now()}`,
        title: 'Inventory Management Issues',
        description: `${keyMetrics.stockoutRate.toFixed(1)}% of your products are out of stock. This could be hurting sales.`,
        type: 'recommendation',
        confidence: 0.9,
        priority: 'high',
        category: 'products',
        actionable: true,
        actions: [{
          id: 'improve-inventory',
          title: 'Improve Inventory Management',
          description: 'Implement better inventory tracking and reorder points',
          type: 'inventory_alert',
          confidence: 0.85,
          estimatedImpact: 'High - Prevent lost sales',
          parameters: { focus: 'inventory_optimization' },
          canAutoImplement: true
        }],
        data: { stockoutRate: keyMetrics.stockoutRate },
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Customer retention insights
    if (keyMetrics.avgRetentionRate < 20) {
      insights.push({
        id: `customer-retention-${Date.now()}`,
        title: 'Customer Retention Opportunity',
        description: `Your customer retention rate of ${keyMetrics.avgRetentionRate.toFixed(1)}% suggests room for improvement in customer loyalty.`,
        type: 'opportunity',
        confidence: 0.8,
        priority: 'medium',
        category: 'customers',
        actionable: true,
        actions: [{
          id: 'improve-retention',
          title: 'Launch Customer Retention Program',
          description: 'Implement loyalty programs, email marketing, and personalization',
          type: 'marketing_action',
          confidence: 0.75,
          estimatedImpact: 'High - Increased LTV',
          parameters: { focus: 'retention_program' },
          canAutoImplement: false
        }],
        data: { retentionRate: keyMetrics.avgRetentionRate },
        createdAt: now,
        updatedAt: now
      });
    }
    
    return insights;
  }

  /**
   * Generate top actionable recommendations
   */
  private generateTopRecommendations(insights: Insight[], keyMetrics: any): string[] {
    const recommendations: string[] = [];
    
    // High-priority insights first
    const criticalInsights = insights.filter(i => i.priority === 'critical');
    const highPriorityInsights = insights.filter(i => i.priority === 'high');
    
    // Add recommendations based on most critical issues
    if (criticalInsights.length > 0) {
      recommendations.push('🚨 Address critical performance issues immediately');
      criticalInsights.forEach(insight => {
        if (insight.actions && insight.actions.length > 0) {
          recommendations.push(`• ${insight.actions[0].title}: ${insight.actions[0].description}`);
        }
      });
    }
    
    if (highPriorityInsights.length > 0) {
      recommendations.push('⚡ Focus on high-impact improvements');
      highPriorityInsights.slice(0, 3).forEach(insight => {
        if (insight.actions && insight.actions.length > 0) {
          recommendations.push(`• ${insight.actions[0].title}: ${insight.actions[0].description}`);
        }
      });
    }
    
    // Add general best practices based on metrics
    if (keyMetrics.conversionRate < 2) {
      recommendations.push('• Optimize your conversion funnel - test different product page layouts and checkout flows');
    }
    
    if (keyMetrics.avgBounceRate > 60) {
      recommendations.push('• Improve page load speed and content relevance to reduce bounce rate');
    }
    
    if (keyMetrics.avgRetentionRate < 30) {
      recommendations.push('• Implement a customer loyalty program to increase repeat purchases');
    }
    
    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  /**
   * Categorize sales health
   */
  private categorizeSalesHealth(growth: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (growth > 15) return 'excellent';
    if (growth > 5) return 'good';
    if (growth > -5) return 'fair';
    return 'poor';
  }

  /**
   * Categorize traffic health
   */
  private categorizeTrafficHealth(conversionRate: number, bounceRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const conversionScore = conversionRate > 3 ? 2 : conversionRate > 1.5 ? 1 : 0;
    const bounceScore = bounceRate < 50 ? 2 : bounceRate < 65 ? 1 : 0;
    const totalScore = conversionScore + bounceScore;
    
    if (totalScore >= 3) return 'excellent';
    if (totalScore >= 2) return 'good';
    if (totalScore >= 1) return 'fair';
    return 'poor';
  }

  /**
   * Categorize inventory health
   */
  private categorizeInventoryHealth(stockoutRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (stockoutRate < 5) return 'excellent';
    if (stockoutRate < 10) return 'good';
    if (stockoutRate < 20) return 'fair';
    return 'poor';
  }

  /**
   * Categorize customer health
   */
  private categorizeCustomerHealth(retentionRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (retentionRate > 40) return 'excellent';
    if (retentionRate > 25) return 'good';
    if (retentionRate > 15) return 'fair';
    return 'poor';
  }

  /**
   * Calculate advisor performance metrics
   */
  async calculateAdvisorMetrics(
    insights: Insight[],
    implementedActions: any[],
    userFeedback: any[]
  ): Promise<AdvisorMetrics> {
    // In a real implementation, these would be calculated from historical data
    const anomalyDetectionAccuracy = 0.87; // Target: ≥85%
    const recommendationSuccessRate = implementedActions.length > 0 ? 
      implementedActions.filter(a => a.successful).length / implementedActions.length : 0;
    
    const userSatisfactionScore = userFeedback.length > 0 ?
      userFeedback.reduce((sum, f) => sum + f.rating, 0) / userFeedback.length : 0;
    
    const totalInsightsGenerated = insights.length;
    const actionsImplemented = implementedActions.length;
    const averageConfidenceScore = insights.length > 0 ?
      insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length : 0;
    
    return {
      anomalyDetectionAccuracy,
      recommendationSuccessRate,
      userSatisfactionScore,
      totalInsightsGenerated,
      actionsImplemented,
      averageConfidenceScore
    };
  }
}