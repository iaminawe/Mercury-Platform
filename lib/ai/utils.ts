import { encoding_for_model, get_encoding } from 'js-tiktoken';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ai-utils');

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
}

export interface AIMetrics {
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastError?: string;
  lastRequestTime: Date;
}

// Model pricing per 1K tokens (USD) - update these based on current OpenAI pricing
const MODEL_PRICING = {
  'gpt-4-1106-preview': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-32k': { prompt: 0.06, completion: 0.12 },
  'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
  'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 },
  'text-embedding-ada-002': { prompt: 0.0001, completion: 0 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0 },
} as const;

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, {
  requests: number[];
  tokens: number[];
  lastReset: Date;
}>();

// Metrics storage
let globalMetrics: AIMetrics = {
  requestCount: 0,
  totalTokens: 0,
  totalCost: 0,
  averageResponseTime: 0,
  errorRate: 0,
  lastRequestTime: new Date(),
};

/**
 * Count tokens in text for a specific model
 */
export function countTokens(text: string, model: string = 'gpt-4-1106-preview'): number {
  try {
    // Handle special models
    const modelForEncoding = model.startsWith('gpt-4') ? 'gpt-4' : 
                           model.startsWith('gpt-3.5') ? 'gpt-3.5-turbo' :
                           'gpt-4';

    const encoding = encoding_for_model(modelForEncoding as any);
    const tokens = encoding.encode(text);
    encoding.free();
    
    return tokens.length;
  } catch (error) {
    logger.warn('Failed to count tokens with model-specific encoding, using fallback', { model, error });
    
    // Fallback to cl100k_base encoding
    try {
      const encoding = get_encoding('cl100k_base');
      const tokens = encoding.encode(text);
      encoding.free();
      return tokens.length;
    } catch (fallbackError) {
      logger.warn('Fallback token counting failed, using estimation', { fallbackError });
      // Very rough estimation: ~4 characters per token
      return Math.ceil(text.length / 4);
    }
  }
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  usage: TokenUsage,
  model: string = 'gpt-4-1106-preview'
): CostCalculation {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  
  if (!pricing) {
    logger.warn('Unknown model for cost calculation', { model });
    return {
      promptCost: 0,
      completionCost: 0,
      totalCost: 0,
      currency: 'USD',
    };
  }

  const promptCost = (usage.promptTokens / 1000) * pricing.prompt;
  const completionCost = (usage.completionTokens / 1000) * pricing.completion;
  const totalCost = promptCost + completionCost;

  return {
    promptCost: Number(promptCost.toFixed(6)),
    completionCost: Number(completionCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    currency: 'USD',
  };
}

/**
 * Estimate cost for a text before processing
 */
export function estimateCost(
  text: string,
  model: string = 'gpt-4-1106-preview',
  estimatedCompletionTokens: number = 0
): CostCalculation {
  const promptTokens = countTokens(text, model);
  const completionTokens = estimatedCompletionTokens || Math.min(promptTokens * 0.5, 1000);

  return calculateCost({
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }, model);
}

/**
 * Check rate limits for a user/key
 */
export function checkRateLimit(
  identifier: string,
  model: string = 'gpt-4-1106-preview',
  tokensRequested: number = 0
): { allowed: boolean; info: RateLimitInfo } {
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60000);

  // Get or create rate limit data
  let rateLimitData = rateLimitStore.get(identifier);
  if (!rateLimitData) {
    rateLimitData = {
      requests: [],
      tokens: [],
      lastReset: now,
    };
    rateLimitStore.set(identifier, rateLimitData);
  }

  // Clean old entries
  rateLimitData.requests = rateLimitData.requests.filter(time => time > minuteAgo.getTime());
  rateLimitData.tokens = rateLimitData.tokens.filter(time => time > minuteAgo.getTime());

  // Model-specific rate limits (these are examples, adjust based on your tier)
  const limits = {
    'gpt-4': { rpm: 500, tpm: 80000 },
    'gpt-4-1106-preview': { rpm: 500, tpm: 80000 },
    'gpt-3.5-turbo': { rpm: 3000, tpm: 160000 },
    'text-embedding-3-small': { rpm: 3000, tpm: 1000000 },
  };

  const modelLimits = limits[model as keyof typeof limits] || limits['gpt-4'];

  const requestsInLastMinute = rateLimitData.requests.length;
  const tokensInLastMinute = rateLimitData.tokens.reduce((sum, time) => sum + 1, 0) * 1000; // Simplified

  const requestsRemaining = Math.max(0, modelLimits.rpm - requestsInLastMinute);
  const tokensRemaining = Math.max(0, modelLimits.tpm - tokensInLastMinute);

  const allowed = requestsRemaining > 0 && 
                 (tokensRequested === 0 || tokensRemaining >= tokensRequested);

  const resetTime = new Date(Math.max(...rateLimitData.requests) + 60000);

  return {
    allowed,
    info: {
      requestsPerMinute: modelLimits.rpm,
      tokensPerMinute: modelLimits.tpm,
      requestsRemaining,
      tokensRemaining,
      resetTime,
    },
  };
}

/**
 * Record a rate limit usage
 */
export function recordRateLimitUsage(
  identifier: string,
  tokensUsed: number
): void {
  const now = Date.now();
  let rateLimitData = rateLimitStore.get(identifier);
  
  if (!rateLimitData) {
    rateLimitData = {
      requests: [],
      tokens: [],
      lastReset: new Date(),
    };
    rateLimitStore.set(identifier, rateLimitData);
  }

  rateLimitData.requests.push(now);
  // Simplified token tracking - in production, track actual tokens
  for (let i = 0; i < Math.ceil(tokensUsed / 1000); i++) {
    rateLimitData.tokens.push(now);
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  backoffFactor: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 0) {
        logger.info('Operation succeeded after retry', { attempt });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      logger.warn('Operation failed, will retry', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        error: lastError.message,
      });

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * delay * 0.1;

      logger.info('Waiting before retry', { delay: jitteredDelay });
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  logger.error('Operation failed after all retries', {
    maxRetries,
    finalError: lastError!.message,
  });

  throw lastError!;
}

/**
 * Create a timeout wrapper for AI operations
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Record metrics for an AI operation
 */
export function recordMetrics(
  success: boolean,
  responseTime: number,
  tokens: number,
  cost: number,
  error?: string
): void {
  globalMetrics.requestCount++;
  globalMetrics.lastRequestTime = new Date();
  
  if (success) {
    globalMetrics.totalTokens += tokens;
    globalMetrics.totalCost += cost;
    
    // Update average response time
    const oldAvg = globalMetrics.averageResponseTime;
    const count = globalMetrics.requestCount;
    globalMetrics.averageResponseTime = ((oldAvg * (count - 1)) + responseTime) / count;
  } else {
    globalMetrics.lastError = error;
  }

  // Calculate error rate
  const totalErrors = globalMetrics.lastError ? 1 : 0; // Simplified
  globalMetrics.errorRate = totalErrors / globalMetrics.requestCount;

  logger.info('Metrics recorded', {
    success,
    responseTime,
    tokens,
    cost,
    totalRequests: globalMetrics.requestCount,
    errorRate: globalMetrics.errorRate,
  });
}

/**
 * Get current AI metrics
 */
export function getMetrics(): AIMetrics {
  return { ...globalMetrics };
}

/**
 * Reset metrics
 */
export function resetMetrics(): void {
  globalMetrics = {
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastRequestTime: new Date(),
  };
  
  logger.info('Metrics reset');
}

/**
 * Text chunking for large content
 */
export function chunkText(
  text: string,
  maxTokens: number = 2000,
  model: string = 'gpt-4-1106-preview',
  overlap: number = 200
): string[] {
  const totalTokens = countTokens(text, model);
  
  if (totalTokens <= maxTokens) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence + '.', model);
    
    if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Add overlap from the end of current chunk
      if (overlap > 0) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + sentence + '.';
        currentTokens = countTokens(currentChunk, model);
      } else {
        currentChunk = sentence + '.';
        currentTokens = sentenceTokens;
      }
    } else {
      currentChunk += sentence + '.';
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  logger.info('Text chunked', {
    originalTokens: totalTokens,
    chunksCreated: chunks.length,
    maxTokensPerChunk: maxTokens,
    overlap,
  });

  return chunks;
}

/**
 * Sanitize input text for AI processing
 */
export function sanitizeInput(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove potentially problematic characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim
    .trim();
}

/**
 * Validate AI response format
 */
export function validateResponse(
  response: any,
  expectedFormat: 'text' | 'json' | 'array' = 'text'
): { isValid: boolean; error?: string; parsed?: any } {
  try {
    switch (expectedFormat) {
      case 'text':
        if (typeof response === 'string' && response.length > 0) {
          return { isValid: true, parsed: response };
        }
        return { isValid: false, error: 'Response is not a valid non-empty string' };

      case 'json':
        let parsed;
        if (typeof response === 'string') {
          parsed = JSON.parse(response);
        } else {
          parsed = response;
        }
        return { isValid: true, parsed };

      case 'array':
        let arrayParsed;
        if (typeof response === 'string') {
          arrayParsed = JSON.parse(response);
        } else {
          arrayParsed = response;
        }
        
        if (Array.isArray(arrayParsed)) {
          return { isValid: true, parsed: arrayParsed };
        }
        return { isValid: false, error: 'Response is not a valid array' };

      default:
        return { isValid: false, error: 'Unknown expected format' };
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Create a rate-limited AI function wrapper
 */
export function createRateLimitedFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  identifier: string,
  model: string = 'gpt-4-1106-preview'
) {
  return async (...args: T): Promise<R> => {
    const { allowed, info } = checkRateLimit(identifier, model);
    
    if (!allowed) {
      const waitTime = info.resetTime.getTime() - Date.now();
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    const startTime = Date.now();
    let success = false;
    let tokens = 0;
    let cost = 0;
    let error: string | undefined;

    try {
      const result = await fn(...args);
      success = true;
      
      // Record usage (this would need to be customized based on your function's return type)
      recordRateLimitUsage(identifier, tokens);
      
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const responseTime = Date.now() - startTime;
      recordMetrics(success, responseTime, tokens, cost, error);
    }
  };
}

/**
 * Health check for AI utilities
 */
export function healthCheck(): boolean {
  try {
    // Test token counting
    const testText = 'This is a test sentence for token counting.';
    const tokens = countTokens(testText);
    
    // Test cost calculation
    const cost = calculateCost({
      promptTokens: tokens,
      completionTokens: 10,
      totalTokens: tokens + 10,
    });

    // Test rate limiting
    const rateLimit = checkRateLimit('test-user');

    logger.info('AI utilities health check passed', {
      tokenCountWorking: tokens > 0,
      costCalculationWorking: cost.totalCost > 0,
      rateLimitingWorking: rateLimit.info.requestsPerMinute > 0,
    });

    return tokens > 0 && cost.totalCost > 0 && rateLimit.info.requestsPerMinute > 0;
  } catch (error) {
    logger.error('AI utilities health check failed', error);
    return false;
  }
}