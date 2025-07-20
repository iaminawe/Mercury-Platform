import { z } from 'zod';
import { router, storeProcedure } from '@/lib/trpc/init';
import { TRPCError } from '@trpc/server';
import { createLogger } from '@/lib/logger';
import { 
  createProductAnalysisChain,
  createQAChain,
  createConversationalChain,
  getPromptTemplate,
  generateEmbedding,
  searchSimilarDocuments,
  createVectorStore,
  countTokens,
  calculateCost,
  retryWithBackoff,
  withTimeout,
  recordMetrics,
} from '@/lib/ai';

const logger = createLogger('ai-router');

const analysisTypeSchema = z.enum([
  'product_description',
  'seo_optimization',
  'pricing_strategy',
  'competitor_analysis',
  'trend_prediction',
  'customer_sentiment',
]);

export const aiRouter = router({
  // New AI-powered analysis using OpenAI/LangChain
  analyzeWithAI: storeProcedure
    .input(
      z.object({
        type: analysisTypeSchema,
        productId: z.string().optional(),
        productData: z.record(z.any()).optional(),
        context: z.record(z.any()).optional(),
        useCache: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, productId, productData, context, useCache } = input;
      const startTime = Date.now();
      let success = false;
      let tokens = 0;
      let cost = 0;

      try {
        // Validate OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'OpenAI API key not configured',
          });
        }

        // Create analysis request in database
        const { data: analysis, error: insertError } = await ctx.supabase
          .from('ai_analyses')
          .insert({
            store_id: ctx.storeId!,
            product_id: productId,
            analysis_type: type,
            status: 'processing',
            result: {},
            error: null,
          })
          .select()
          .single();

        if (insertError) {
          logger.error('Create analysis error', insertError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create analysis request',
          });
        }

        // Get product data if not provided
        let product = productData;
        if (!product && productId) {
          const { data: productData, error: productError } = await ctx.supabase
            .from('shopify_products')
            .select('*')
            .eq('id', productId)
            .eq('store_id', ctx.storeId!)
            .single();

          if (productError) {
            logger.warn('Product not found, proceeding without data', { productId });
            product = { id: productId, title: 'Unknown Product' };
          } else {
            product = productData;
          }
        }

        // Perform AI analysis with timeout and retries
        const analysisResult = await withTimeout(
          () => retryWithBackoff(async () => {
            const chain = createProductAnalysisChain();
            const response = await chain.analyze(product, type);
            
            // Count tokens and calculate cost
            const promptText = JSON.stringify({ product, type, context });
            tokens = countTokens(promptText) + countTokens(response.result);
            cost = calculateCost({
              promptTokens: countTokens(promptText),
              completionTokens: countTokens(response.result),
              totalTokens: tokens,
            }).totalCost;

            return response;
          }, 3),
          30000 // 30 second timeout
        );

        // Parse the AI response
        let parsedResult;
        try {
          parsedResult = JSON.parse(analysisResult.result);
        } catch (parseError) {
          // If JSON parsing fails, wrap in a basic structure
          parsedResult = {
            summary: analysisResult.result,
            recommendations: ['Review the analysis results'],
            score: 75,
            rawResponse: analysisResult.result,
          };
        }

        // Update analysis with results
        const { error: updateError } = await ctx.supabase
          .from('ai_analyses')
          .update({
            status: 'completed',
            result: parsedResult,
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysis.id);

        if (updateError) {
          logger.error('Update analysis error', updateError);
          // Continue anyway, we have the result
        }

        success = true;
        
        logger.info('AI analysis completed', {
          storeId: ctx.storeId,
          analysisId: analysis.id,
          type,
          tokens,
          cost,
          responseTime: Date.now() - startTime,
        });

        return {
          analysisId: analysis.id,
          status: 'completed',
          result: parsedResult,
          metadata: {
            tokens,
            cost,
            responseTime: Date.now() - startTime,
            model: process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
          },
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('AI analysis failed', {
          storeId: ctx.storeId,
          type,
          error: errorMessage,
          responseTime: Date.now() - startTime,
        });

        // Try to update the analysis record with error
        try {
          await ctx.supabase
            .from('ai_analyses')
            .update({
              status: 'failed',
              error: errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq('store_id', ctx.storeId!)
            .eq('analysis_type', type)
            .order('created_at', { ascending: false })
            .limit(1);
        } catch (updateError) {
          logger.error('Failed to update analysis error', updateError);
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI analysis failed: ${errorMessage}`,
        });
      } finally {
        // Record metrics for monitoring
        recordMetrics(success, Date.now() - startTime, tokens, cost, success ? undefined : 'Analysis failed');
      }
    }),

  // AI-powered Q&A
  askQuestion: storeProcedure
    .input(
      z.object({
        question: z.string().min(1),
        context: z.string().optional(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { question, context, sessionId } = input;

      try {
        if (!process.env.OPENAI_API_KEY) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'OpenAI API key not configured',
          });
        }

        // Search for relevant context in vector store if no context provided
        let searchContext = context || '';
        if (!context) {
          try {
            const vectorStore = await createVectorStore();
            const similarDocs = await searchSimilarDocuments(
              question,
              { k: 3, filter: { store_id: ctx.storeId } },
              vectorStore
            );
            
            searchContext = similarDocs
              .map(doc => doc.content)
              .join('\n\n');
          } catch (vectorError) {
            logger.warn('Vector search failed, proceeding without context', vectorError);
          }
        }

        // Create Q&A chain and get response
        const qaChain = createQAChain();
        const response = await withTimeout(
          () => qaChain.invoke({
            context: searchContext || 'No specific context available.',
            question,
          }),
          20000
        );

        logger.info('AI Q&A completed', {
          storeId: ctx.storeId,
          questionLength: question.length,
          contextLength: searchContext.length,
          sessionId,
        });

        return {
          answer: response.result,
          hasContext: !!searchContext,
          sessionId: sessionId || `session_${Date.now()}`,
        };

      } catch (error) {
        logger.error('AI Q&A failed', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Q&A failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Vector search for documents
  searchDocuments: storeProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(5),
        threshold: z.number().min(0).max(1).default(0.7),
        filters: z.record(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, limit, threshold, filters } = input;

      try {
        const vectorStore = await createVectorStore();
        const results = await searchSimilarDocuments(
          query,
          {
            k: limit,
            scoreThreshold: threshold,
            filter: {
              store_id: ctx.storeId,
              ...filters,
            },
          },
          vectorStore
        );

        return {
          results: results.map(result => ({
            content: result.content,
            metadata: result.metadata,
            score: result.score,
          })),
          query,
          total: results.length,
        };

      } catch (error) {
        logger.error('Vector search failed', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Get AI service status and configuration
  getServiceStatus: storeProcedure
    .query(async ({ ctx }) => {
      try {
        const status = {
          openai: {
            configured: !!process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
            embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          },
          vectorStore: {
            enabled: process.env.ENABLE_VECTOR_SEARCH === 'true',
            dimensions: parseInt(process.env.VECTOR_DIMENSION || '1536'),
          },
          features: {
            analysis: !!process.env.OPENAI_API_KEY,
            qa: !!process.env.OPENAI_API_KEY,
            vectorSearch: !!process.env.OPENAI_API_KEY && process.env.ENABLE_VECTOR_SEARCH === 'true',
          },
        };

        return status;
      } catch (error) {
        logger.error('Failed to get service status', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get service status',
        });
      }
    }),

  // Legacy mock analysis (keeping for backward compatibility)
  requestAnalysis: storeProcedure
    .input(
      z.object({
        type: analysisTypeSchema,
        productId: z.string().optional(),
        context: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, productId, context } = input;

      try {
        // Create analysis request
        const { data: analysis, error } = await ctx.supabase
          .from('ai_analyses')
          .insert({
            store_id: ctx.storeId!,
            product_id: productId,
            analysis_type: type,
            status: 'pending',
            result: {},
            error: null,
          })
          .select()
          .single();

        if (error) {
          logger.error('Create analysis error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create analysis request',
          });
        }

        // Queue the analysis job (in a real implementation, this would use a job queue)
        // For MVP, we'll simulate processing
        setTimeout(async () => {
          await processAnalysis(ctx.storeId!, analysis.id, type, productId, context);
        }, 1000);

        logger.info('Analysis requested', {
          storeId: ctx.storeId,
          analysisId: analysis.id,
          type,
        });

        return {
          analysisId: analysis.id,
          status: analysis.status,
        };
      } catch (error) {
        logger.error('Unexpected request analysis error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to request analysis',
        });
      }
    }),

  getAnalysis: storeProcedure
    .input(
      z.object({
        analysisId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { analysisId } = input;

      try {
        const { data: analysis, error } = await ctx.supabase
          .from('ai_analyses')
          .select('*')
          .eq('id', analysisId)
          .eq('store_id', ctx.storeId!)
          .single();

        if (error || !analysis) {
          logger.error('Get analysis error', error);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Analysis not found',
          });
        }

        return analysis;
      } catch (error) {
        logger.error('Unexpected get analysis error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analysis',
        });
      }
    }),

  listAnalyses: storeProcedure
    .input(
      z.object({
        type: analysisTypeSchema.optional(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, status, limit, offset } = input;

      try {
        let query = ctx.supabase
          .from('ai_analyses')
          .select('*', { count: 'exact' })
          .eq('store_id', ctx.storeId!)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (type) {
          query = query.eq('analysis_type', type);
        }

        if (status) {
          query = query.eq('status', status);
        }

        const { data: analyses, count, error } = await query;

        if (error) {
          logger.error('List analyses error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch analyses',
          });
        }

        return {
          analyses: analyses || [],
          total: count || 0,
          limit,
          offset,
        };
      } catch (error) {
        logger.error('Unexpected list analyses error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analyses',
        });
      }
    }),

  getInsights: storeProcedure
    .input(
      z.object({
        productId: z.string().optional(),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { productId, limit } = input;

      try {
        let query = ctx.supabase
          .from('ai_analyses')
          .select('*')
          .eq('store_id', ctx.storeId!)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (productId) {
          query = query.eq('product_id', productId);
        }

        const { data: analyses, error } = await query;

        if (error) {
          logger.error('Get insights error', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch insights',
          });
        }

        // Extract key insights from analyses
        const insights = analyses?.map((analysis) => {
          const result = analysis.result as any;
          return {
            id: analysis.id,
            type: analysis.analysis_type,
            productId: analysis.product_id,
            summary: result.summary || 'No summary available',
            recommendations: result.recommendations || [],
            score: result.score || null,
            createdAt: analysis.created_at,
          };
        }) || [];

        return { insights };
      } catch (error) {
        logger.error('Unexpected get insights error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch insights',
        });
      }
    }),
});

// Simulated AI processing function (would be replaced with actual AI integration)
async function processAnalysis(
  storeId: string,
  analysisId: string,
  type: string,
  productId?: string,
  context?: any
) {
  try {
    // Update status to processing
    await updateAnalysisStatus(analysisId, 'processing');

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Generate mock results based on analysis type
    const result = generateMockResult(type, productId, context);

    // Update with results
    await updateAnalysisResult(analysisId, result);

    logger.info('Analysis completed', { analysisId, type });
  } catch (error) {
    logger.error('Analysis processing error', { analysisId, error });
    await updateAnalysisError(analysisId, 'Processing failed');
  }
}

function generateMockResult(type: string, productId?: string, context?: any) {
  const mockResults: Record<string, any> = {
    product_description: {
      summary: 'Product description optimized for conversion',
      recommendations: [
        'Add more emotional triggers',
        'Include social proof elements',
        'Highlight unique value propositions',
      ],
      score: 85,
      improvedDescription: 'Enhanced product description here...',
    },
    seo_optimization: {
      summary: 'SEO opportunities identified',
      recommendations: [
        'Add long-tail keywords',
        'Improve meta descriptions',
        'Optimize image alt tags',
      ],
      score: 72,
      keywords: ['keyword1', 'keyword2', 'keyword3'],
    },
    pricing_strategy: {
      summary: 'Pricing optimization potential found',
      recommendations: [
        'Consider psychological pricing',
        'Test bundle offerings',
        'Implement tiered pricing',
      ],
      score: 78,
      suggestedPrice: 49.99,
      priceRange: { min: 39.99, max: 59.99 },
    },
    competitor_analysis: {
      summary: 'Competitive positioning analyzed',
      recommendations: [
        'Differentiate with unique features',
        'Improve pricing competitiveness',
        'Enhance product imagery',
      ],
      score: 68,
      competitors: ['Competitor A', 'Competitor B'],
    },
    trend_prediction: {
      summary: 'Emerging trends identified',
      recommendations: [
        'Prepare for seasonal demand',
        'Stock trending variations',
        'Update marketing messaging',
      ],
      score: 81,
      trends: ['Trend 1', 'Trend 2'],
    },
    customer_sentiment: {
      summary: 'Customer sentiment analyzed',
      recommendations: [
        'Address common pain points',
        'Highlight positive features',
        'Improve customer support',
      ],
      score: 76,
      sentiment: 'positive',
      topics: ['quality', 'shipping', 'value'],
    },
  };

  return mockResults[type] || { summary: 'Analysis completed', score: 75 };
}

async function updateAnalysisStatus(analysisId: string, status: string) {
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = await createServiceRoleClient();
  
  await supabase
    .from('ai_analyses')
    .update({ status })
    .eq('id', analysisId);
}

async function updateAnalysisResult(analysisId: string, result: any) {
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = await createServiceRoleClient();
  
  await supabase
    .from('ai_analyses')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', analysisId);
}

async function updateAnalysisError(analysisId: string, error: string) {
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = await createServiceRoleClient();
  
  await supabase
    .from('ai_analyses')
    .update({
      status: 'failed',
      error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', analysisId);
}