import { z } from 'zod';
import { router, storeProcedure } from '@/lib/trpc/init';
import { TRPCError } from '@trpc/server';
import { createLogger } from '@/lib/logger';
import { AnomalyDetector } from '@/lib/ai/advisor/anomaly-detector';
import { ShopifyRecommendationEngine } from '@/lib/ai/advisor/recommendation-engine';
import { InsightAnalyzer } from '@/lib/ai/advisor/insight-analyzer';
import { ConfidenceScorer } from '@/lib/ai/advisor/confidence-scorer';

const logger = createLogger('advisor-router');

// Initialize AI advisor components
const anomalyDetector = new AnomalyDetector();
const recommendationEngine = new ShopifyRecommendationEngine();
const insightAnalyzer = new InsightAnalyzer();
const confidenceScorer = new ConfidenceScorer();

const questionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  context: z.record(z.any()).optional(),
});

const implementActionSchema = z.object({
  actionId: z.string(),
  insightId: z.string(),
  parameters: z.record(z.any()).optional(),
});

export const advisorRouter = router({
  /**
   * Get AI-generated insights for the store
   */
  getInsights: storeProcedure
    .input(
      z.object({
        timeRange: z.enum(['7d', '14d', '30d', '90d']).default('30d'),
        categories: z.array(z.enum(['sales', 'traffic', 'conversion', 'products', 'customers'])).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { timeRange, categories, priority } = input;

      try {
        logger.info('Generating insights', { storeId: ctx.storeId, timeRange, categories, priority });

        // Get store data from database
        const storeData = await getStoreData(ctx, timeRange);
        
        // Generate recommendations using the AI engine
        const recommendations = await recommendationEngine.generateRecommendations(
          [],
          {
            storeId: ctx.storeId,
            timeRange,
            salesData: storeData.sales,
            trafficData: storeData.traffic,
            productData: storeData.products,
            customerData: storeData.customers,
          }
        );

        // Filter by categories and priority if specified
        let filteredRecommendations = recommendations;
        
        if (categories && categories.length > 0) {
          filteredRecommendations = filteredRecommendations.filter(r => 
            categories.includes(r.category)
          );
        }
        
        if (priority) {
          filteredRecommendations = filteredRecommendations.filter(r => 
            r.priority === priority
          );
        }

        // Calculate confidence scores for each insight
        const insightsWithConfidence = await Promise.all(
          filteredRecommendations.map(async (insight) => {
            const confidenceScore = confidenceScorer.calculateConfidenceScore(insight, {
              dataQuality: calculateDataQuality(storeData),
              historicalAccuracy: 0.87, // Our target accuracy
            });

            return {
              ...insight,
              confidenceScore,
            };
          })
        );

        // Store insights in database for tracking
        await storeInsights(ctx, insightsWithConfidence);

        logger.info('Insights generated successfully', {
          storeId: ctx.storeId,
          insightCount: insightsWithConfidence.length,
          highPriority: insightsWithConfidence.filter(i => i.priority === 'high' || i.priority === 'critical').length,
        });

        return {
          insights: insightsWithConfidence,
          metadata: {
            timeRange,
            generatedAt: new Date().toISOString(),
            dataQuality: calculateDataQuality(storeData),
          },
        };
      } catch (error) {
        logger.error('Error generating insights', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate insights',
        });
      }
    }),

  /**
   * Ask a question about store data using natural language
   */
  askQuestion: storeProcedure
    .input(questionSchema)
    .mutation(async ({ ctx, input }) => {
      const { question, context } = input;

      try {
        logger.info('Processing advisor question', { storeId: ctx.storeId, question });

        // Store the question
        const { data: questionRecord, error: questionError } = await ctx.supabase
          .from('advisor_questions')
          .insert({
            store_id: ctx.storeId!,
            question,
            context: context || {},
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (questionError) {
          logger.error('Error storing question', questionError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to store question',
          });
        }

        // Get relevant store data for context
        const storeData = await getStoreData(ctx, '30d');
        
        // Generate answer using AI
        const answer = await generateNaturalLanguageAnswer(question, storeData, context);
        
        // Calculate confidence score for the answer
        const confidence = calculateAnswerConfidence(question, answer, storeData);

        // Store the answer
        const { data: answerRecord, error: answerError } = await ctx.supabase
          .from('advisor_answers')
          .insert({
            question_id: questionRecord.id,
            answer: answer.text,
            confidence,
            sources: answer.sources,
            related_insights: answer.relatedInsights,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (answerError) {
          logger.error('Error storing answer', answerError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to store answer',
          });
        }

        logger.info('Question answered successfully', {
          storeId: ctx.storeId,
          questionId: questionRecord.id,
          confidence,
        });

        return {
          questionId: questionRecord.id,
          answer: answer.text,
          confidence,
          sources: answer.sources,
          relatedInsights: answer.relatedInsights,
          createdAt: answerRecord.created_at,
        };
      } catch (error) {
        logger.error('Error processing question', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process question',
        });
      }
    }),

  /**
   * Implement a suggested action
   */
  implementAction: storeProcedure
    .input(implementActionSchema)
    .mutation(async ({ ctx, input }) => {
      const { actionId, insightId, parameters } = input;

      try {
        logger.info('Implementing advisor action', { 
          storeId: ctx.storeId, 
          actionId, 
          insightId 
        });

        // Get the insight and action details
        const { data: insight, error: insightError } = await ctx.supabase
          .from('advisor_insights')
          .select('*')
          .eq('id', insightId)
          .eq('store_id', ctx.storeId!)
          .single();

        if (insightError || !insight) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Insight not found',
          });
        }

        const action = insight.actions?.find((a: any) => a.id === actionId);
        if (!action) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Action not found',
          });
        }

        // Implement the action based on its type
        const result = await implementActionByType(ctx, action, parameters);

        // Record the implementation
        const { data: implementation, error: implError } = await ctx.supabase
          .from('advisor_implementations')
          .insert({
            store_id: ctx.storeId!,
            insight_id: insightId,
            action_id: actionId,
            action_type: action.type,
            parameters: parameters || {},
            result,
            status: result.success ? 'completed' : 'failed',
            implemented_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (implError) {
          logger.error('Error recording implementation', implError);
        }

        logger.info('Action implemented successfully', {
          storeId: ctx.storeId,
          actionId,
          success: result.success,
        });

        return {
          success: result.success,
          message: result.message,
          details: result.details,
          implementationId: implementation?.id,
        };
      } catch (error) {
        logger.error('Error implementing action', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to implement action',
        });
      }
    }),

  /**
   * Get advisor performance metrics
   */
  getMetrics: storeProcedure
    .input(
      z.object({
        timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { timeRange } = input;

      try {
        logger.info('Getting advisor metrics', { storeId: ctx.storeId, timeRange });

        // Get insights, implementations, and feedback for the time range
        const [insights, implementations, feedback] = await Promise.all([
          getInsightsForMetrics(ctx, timeRange),
          getImplementationsForMetrics(ctx, timeRange),
          getFeedbackForMetrics(ctx, timeRange),
        ]);

        // Calculate metrics using the insight analyzer
        const metrics = await insightAnalyzer.calculateAdvisorMetrics(
          insights,
          implementations,
          feedback
        );

        logger.info('Advisor metrics calculated', {
          storeId: ctx.storeId,
          ...metrics,
        });

        return metrics;
      } catch (error) {
        logger.error('Error getting advisor metrics', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get advisor metrics',
        });
      }
    }),

  /**
   * Get store performance analysis
   */
  getPerformanceAnalysis: storeProcedure
    .input(
      z.object({
        timeRange: z.enum(['7d', '14d', '30d', '90d']).default('30d'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { timeRange } = input;

      try {
        logger.info('Analyzing store performance', { storeId: ctx.storeId, timeRange });

        // Get comprehensive store data
        const storeData = await getStoreData(ctx, timeRange);
        
        // Perform analysis using the insight analyzer
        const analysis = await insightAnalyzer.analyzeStorePerformance(storeData);

        logger.info('Store performance analysis completed', {
          storeId: ctx.storeId,
          performanceScore: analysis.performanceScore,
          insightCount: analysis.insights.length,
        });

        return analysis;
      } catch (error) {
        logger.error('Error analyzing store performance', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze store performance',
        });
      }
    }),

  /**
   * Detect anomalies in store data
   */
  detectAnomalies: storeProcedure
    .input(
      z.object({
        metricType: z.enum(['sales', 'traffic', 'both']).default('both'),
        timeRange: z.enum(['14d', '30d', '60d', '90d']).default('30d'),
        sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { metricType, timeRange, sensitivity } = input;

      try {
        logger.info('Detecting anomalies', { 
          storeId: ctx.storeId, 
          metricType, 
          timeRange, 
          sensitivity 
        });

        // Get relevant data for anomaly detection
        const storeData = await getStoreData(ctx, timeRange);
        
        const anomalies = [];

        // Detect sales anomalies
        if (metricType === 'sales' || metricType === 'both') {
          if (storeData.sales.length > 0) {
            const salesAnomalies = await anomalyDetector.detectSalesAnomalies(
              storeData.sales,
              { storeId: ctx.storeId, sensitivity }
            );
            anomalies.push(...salesAnomalies);
          }
        }

        // Detect traffic anomalies
        if (metricType === 'traffic' || metricType === 'both') {
          if (storeData.traffic.length > 0) {
            const trafficAnomalies = await anomalyDetector.detectTrafficAnomalies(
              storeData.traffic,
              { storeId: ctx.storeId, sensitivity }
            );
            anomalies.push(...trafficAnomalies);
          }
        }

        // Calculate confidence scores for anomalies
        const anomaliesWithConfidence = anomalies.map(anomaly => ({
          ...anomaly,
          confidenceScore: confidenceScorer.scoreAnomalyConfidence(
            anomaly,
            metricType === 'sales' ? storeData.sales : storeData.traffic,
            { storeId: ctx.storeId }
          ),
        }));

        logger.info('Anomaly detection completed', {
          storeId: ctx.storeId,
          anomaliesDetected: anomaliesWithConfidence.length,
          highConfidence: anomaliesWithConfidence.filter(a => a.confidenceScore > 0.8).length,
        });

        return {
          anomalies: anomaliesWithConfidence,
          metadata: {
            timeRange,
            metricType,
            sensitivity,
            detectedAt: new Date().toISOString(),
            averageConfidence: anomaliesWithConfidence.length > 0 ? 
              anomaliesWithConfidence.reduce((sum, a) => sum + a.confidenceScore, 0) / anomaliesWithConfidence.length : 0,
          },
        };
      } catch (error) {
        logger.error('Error detecting anomalies', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to detect anomalies',
        });
      }
    }),
});

// Helper functions

async function getStoreData(ctx: any, timeRange: string) {
  const daysBack = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get sales data
  const { data: salesData } = await ctx.supabase
    .from('analytics_daily')
    .select('date, revenue, orders')
    .eq('store_id', ctx.storeId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Get traffic data (mock for now - would come from analytics integration)
  const trafficData = generateMockTrafficData(daysBack);
  
  // Get product data
  const { data: productData } = await ctx.supabase
    .from('products')
    .select('id, title, inventory_quantity, price')
    .eq('store_id', ctx.storeId);

  // Get customer data (mock for now)
  const customerData = generateMockCustomerData();

  return {
    sales: salesData?.map((d: any) => ({ 
      date: d.date, 
      amount: d.revenue || 0, 
      orders: d.orders || 0 
    })) || [],
    traffic: trafficData,
    products: productData?.map((p: any) => ({
      id: p.id,
      title: p.title,
      sales: Math.random() * 100, // Mock sales data
      views: Math.random() * 1000, // Mock views data
      inventory: p.inventory_quantity || 0,
      price: p.price || 0,
    })) || [],
    customers: customerData,
  };
}

function generateMockTrafficData(days: number) {
  const data = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      visitors: Math.floor(Math.random() * 1000) + 100,
      pageViews: Math.floor(Math.random() * 3000) + 300,
      bounceRate: Math.random() * 0.4 + 0.3, // 30-70%
    });
  }
  return data;
}

function generateMockCustomerData() {
  return [
    { segment: 'new', count: 150, avgOrderValue: 45, retention: 0.15 },
    { segment: 'returning', count: 80, avgOrderValue: 75, retention: 0.35 },
    { segment: 'vip', count: 25, avgOrderValue: 150, retention: 0.65 },
  ];
}

function calculateDataQuality(storeData: any) {
  const salesCompleteness = storeData.sales.length > 0 ? 1 : 0;
  const trafficCompleteness = storeData.traffic.length > 0 ? 1 : 0;
  const productCompleteness = storeData.products.length > 0 ? 1 : 0;
  
  return {
    completeness: (salesCompleteness + trafficCompleteness + productCompleteness) / 3,
    recency: 1, // Assume recent data
    consistency: 0.9, // Assume good consistency
    sampleSize: Math.max(storeData.sales.length, storeData.traffic.length),
  };
}

async function storeInsights(ctx: any, insights: any[]) {
  for (const insight of insights) {
    await ctx.supabase
      .from('advisor_insights')
      .upsert({
        id: insight.id,
        store_id: ctx.storeId,
        title: insight.title,
        description: insight.description,
        type: insight.type,
        confidence: insight.confidence,
        priority: insight.priority,
        category: insight.category,
        actionable: insight.actionable,
        actions: insight.actions,
        data: insight.data,
        confidence_score: insight.confidenceScore,
        created_at: insight.createdAt,
        updated_at: insight.updatedAt,
      });
  }
}

async function generateNaturalLanguageAnswer(
  question: string, 
  storeData: any, 
  context: any = {}
) {
  // Simple Q&A logic - in production, this would use a proper NLP model
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('sales') || lowerQuestion.includes('revenue')) {
    const totalRevenue = storeData.sales.reduce((sum: number, s: any) => sum + s.amount, 0);
    const avgDaily = storeData.sales.length > 0 ? totalRevenue / storeData.sales.length : 0;
    
    return {
      text: `Based on your recent data, your total revenue is $${totalRevenue.toFixed(2)} with an average daily revenue of $${avgDaily.toFixed(2)}. ${
        totalRevenue > 0 ? 'Your store is generating revenue.' : 'Consider implementing marketing strategies to boost sales.'
      }`,
      sources: ['sales_data', 'analytics_daily'],
      relatedInsights: ['sales-performance'],
    };
  }
  
  if (lowerQuestion.includes('traffic') || lowerQuestion.includes('visitors')) {
    const totalVisitors = storeData.traffic.reduce((sum: number, t: any) => sum + t.visitors, 0);
    const avgBounceRate = storeData.traffic.reduce((sum: number, t: any) => sum + t.bounceRate, 0) / storeData.traffic.length;
    
    return {
      text: `Your store received ${totalVisitors} visitors recently with an average bounce rate of ${(avgBounceRate * 100).toFixed(1)}%. ${
        avgBounceRate > 0.6 ? 'Consider improving page load speed and content relevance to reduce bounce rate.' : 'Your bounce rate is within acceptable range.'
      }`,
      sources: ['traffic_data', 'analytics'],
      relatedInsights: ['traffic-performance'],
    };
  }
  
  if (lowerQuestion.includes('products') || lowerQuestion.includes('inventory')) {
    const totalProducts = storeData.products.length;
    const lowStockProducts = storeData.products.filter((p: any) => p.inventory < 10).length;
    
    return {
      text: `You have ${totalProducts} products in your store. ${lowStockProducts} products have low inventory (less than 10 units). ${
        lowStockProducts > 0 ? 'Consider restocking these items to avoid stockouts.' : 'Your inventory levels look healthy.'
      }`,
      sources: ['product_data', 'inventory'],
      relatedInsights: ['inventory-management'],
    };
  }
  
  // Generic response
  return {
    text: 'I understand your question about your store. Based on the available data, I can help you analyze sales performance, traffic patterns, product management, and customer behavior. Could you please be more specific about what aspect you\'d like me to focus on?',
    sources: ['general_store_data'],
    relatedInsights: [],
  };
}

function calculateAnswerConfidence(question: string, answer: any, storeData: any): number {
  // Simple confidence calculation based on data availability
  let confidence = 0.5;
  
  if (answer.sources.length > 0) confidence += 0.2;
  if (storeData.sales.length > 7) confidence += 0.1;
  if (storeData.traffic.length > 7) confidence += 0.1;
  if (answer.text.includes('$') || answer.text.includes('%')) confidence += 0.1; // Contains specific metrics
  
  return Math.min(1, confidence);
}

async function implementActionByType(ctx: any, action: any, parameters: any = {}) {
  switch (action.type) {
    case 'inventory_alert':
      return await implementInventoryAction(ctx, action, parameters);
    
    case 'shopify_update':
      return await implementShopifyUpdate(ctx, action, parameters);
    
    case 'marketing_action':
      return await implementMarketingAction(ctx, action, parameters);
    
    case 'price_change':
      return await implementPriceChange(ctx, action, parameters);
    
    default:
      return {
        success: false,
        message: `Action type '${action.type}' is not supported for auto-implementation`,
        details: { actionType: action.type },
      };
  }
}

async function implementInventoryAction(ctx: any, action: any, parameters: any) {
  // Mock implementation - would integrate with inventory management system
  return {
    success: true,
    message: 'Inventory alert has been set up successfully',
    details: { 
      actionType: 'inventory_alert',
      threshold: parameters.threshold || 10,
    },
  };
}

async function implementShopifyUpdate(ctx: any, action: any, parameters: any) {
  // Mock implementation - would use Shopify API
  return {
    success: action.canAutoImplement,
    message: action.canAutoImplement ? 
      'Shopify update has been queued for processing' : 
      'This update requires manual approval',
    details: { 
      actionType: 'shopify_update',
      canAutoImplement: action.canAutoImplement,
    },
  };
}

async function implementMarketingAction(ctx: any, action: any, parameters: any) {
  // Mock implementation - would integrate with marketing platforms
  return {
    success: false,
    message: 'Marketing actions require manual setup and approval',
    details: { 
      actionType: 'marketing_action',
      requiresManualSetup: true,
    },
  };
}

async function implementPriceChange(ctx: any, action: any, parameters: any) {
  // Mock implementation - would use Shopify API with careful validation
  return {
    success: false,
    message: 'Price changes require manual review for safety',
    details: { 
      actionType: 'price_change',
      requiresManualApproval: true,
    },
  };
}

async function getInsightsForMetrics(ctx: any, timeRange: string) {
  const daysBack = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data } = await ctx.supabase
    .from('advisor_insights')
    .select('*')
    .eq('store_id', ctx.storeId)
    .gte('created_at', startDate.toISOString());

  return data || [];
}

async function getImplementationsForMetrics(ctx: any, timeRange: string) {
  const daysBack = parseInt(timeRange.replace('d', ''));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data } = await ctx.supabase
    .from('advisor_implementations')
    .select('*')
    .eq('store_id', ctx.storeId)
    .gte('implemented_at', startDate.toISOString());

  return data || [];
}

async function getFeedbackForMetrics(ctx: any, timeRange: string) {
  // Mock feedback data - would come from user feedback system
  return [];
}