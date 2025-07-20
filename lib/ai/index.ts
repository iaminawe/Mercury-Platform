/**
 * Mercury AI Infrastructure - Main exports
 * 
 * This module provides a comprehensive AI foundation built on OpenAI and LangChain
 * for the Mercury Shopify app platform.
 */

// Core clients and setup
export * from './openai-client';
export * from './langchain-setup';
export * from './vector-store';
export * from './embedding-service';
export * from './prompt-templates';
export * from './utils';
export * from './types';

// Re-export key functions with simplified names
export {
  initializeOpenAI,
  getOpenAIClient,
  createChatCompletion,
  createStreamingChatCompletion,
  createEmbedding,
} from './openai-client';

export {
  createChatModel,
  createEmbeddingsModel,
  createQAChain,
  createProductAnalysisChain,
  createConversationalChain,
  createSummarizationChain,
} from './langchain-setup';

export {
  createVectorStore,
  addDocuments,
  searchSimilarDocuments,
  indexProductData,
  indexCustomerData,
  indexKnowledgeBase,
} from './vector-store';

export {
  generateEmbedding,
  generateBatchEmbeddings,
  findSimilarTexts,
  clusterTexts,
  cosineSimilarity,
} from './embedding-service';

export {
  getPromptTemplate,
  createCustomPrompt,
  formatPromptContext,
  generateDynamicPrompt,
  SYSTEM_PROMPTS,
  PRODUCT_ANALYSIS_PROMPTS,
  CUSTOMER_ANALYSIS_PROMPTS,
  MARKETING_PROMPTS,
  ANALYTICS_PROMPTS,
} from './prompt-templates';

export {
  countTokens,
  calculateCost,
  estimateCost,
  checkRateLimit,
  recordRateLimitUsage,
  retryWithBackoff,
  withTimeout,
  recordMetrics,
  getMetrics,
  chunkText,
  sanitizeInput,
  validateResponse,
  createRateLimitedFunction,
} from './utils';

// Convenience factory functions
import { 
  initializeOpenAI, 
  createChatModel, 
  createEmbeddingsModel, 
  createVectorStore 
} from './index';

/**
 * Initialize complete AI stack with default configuration
 */
export async function initializeAIStack(config?: {
  openaiApiKey?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  model?: string;
  embeddingModel?: string;
}) {
  const openaiClient = initializeOpenAI({
    apiKey: config?.openaiApiKey,
    model: config?.model,
    embeddingModel: config?.embeddingModel,
  });

  const chatModel = createChatModel({
    openaiApiKey: config?.openaiApiKey,
    model: config?.model,
  });

  const embeddingsModel = createEmbeddingsModel({
    openaiApiKey: config?.openaiApiKey,
    embeddingModel: config?.embeddingModel,
  });

  const vectorStore = await createVectorStore({
    supabaseUrl: config?.supabaseUrl,
    supabaseKey: config?.supabaseKey,
    embeddingModel: embeddingsModel,
  });

  return {
    openaiClient,
    chatModel,
    embeddingsModel,
    vectorStore,
  };
}

/**
 * Health check for entire AI infrastructure
 */
export async function aiHealthCheck(): Promise<{
  overall: boolean;
  services: {
    openai: boolean;
    langchain: boolean;
    vectorStore: boolean;
    embeddings: boolean;
    prompts: boolean;
    utils: boolean;
  };
  details: string[];
}> {
  const results = {
    overall: true,
    services: {
      openai: false,
      langchain: false,
      vectorStore: false,
      embeddings: false,
      prompts: false,
      utils: false,
    },
    details: [] as string[],
  };

  try {
    // Import health check functions
    const { healthCheck: openaiHealthCheck } = await import('./openai-client');
    const { healthCheck: langchainHealthCheck } = await import('./langchain-setup');
    const { healthCheck: vectorStoreHealthCheck } = await import('./vector-store');
    const { healthCheck: embeddingHealthCheck } = await import('./embedding-service');
    const { healthCheck: promptsHealthCheck } = await import('./prompt-templates');
    const { healthCheck: utilsHealthCheck } = await import('./utils');

    // Test each service
    results.services.openai = await openaiHealthCheck();
    if (!results.services.openai) {
      results.details.push('OpenAI client not responding');
    }

    results.services.langchain = await langchainHealthCheck();
    if (!results.services.langchain) {
      results.details.push('LangChain setup issues');
    }

    results.services.vectorStore = await vectorStoreHealthCheck();
    if (!results.services.vectorStore) {
      results.details.push('Vector store connectivity issues');
    }

    results.services.embeddings = await embeddingHealthCheck();
    if (!results.services.embeddings) {
      results.details.push('Embedding service not working');
    }

    results.services.prompts = promptsHealthCheck();
    if (!results.services.prompts) {
      results.details.push('Prompt templates not loaded');
    }

    results.services.utils = utilsHealthCheck();
    if (!results.services.utils) {
      results.details.push('AI utilities not functioning');
    }

    // Overall health
    results.overall = Object.values(results.services).every(status => status);

    if (results.overall) {
      results.details.push('All AI services operational');
    }

  } catch (error) {
    results.overall = false;
    results.details.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return results;
}

/**
 * Get AI infrastructure status and configuration
 */
export function getAIStatus() {
  return {
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    },
    langchain: {
      tracingEnabled: process.env.LANGCHAIN_TRACING_V2 === 'true',
      apiKeyConfigured: !!process.env.LANGCHAIN_API_KEY,
    },
    vectorStore: {
      enabled: process.env.ENABLE_VECTOR_SEARCH === 'true',
      dimensions: parseInt(process.env.VECTOR_DIMENSION || '1536'),
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    environment: process.env.NODE_ENV || 'development',
  };
}