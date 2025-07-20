import OpenAI from 'openai';
import { createLogger } from '@/lib/logger';

const logger = createLogger('openai-client');

// Singleton OpenAI client instance
let openaiClient: OpenAI | null = null;

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  maxTokens?: number;
  temperature?: number;
  organization?: string;
}

export interface StreamingResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  presencePenalty?: number;
  frequencyPenalty?: number;
  logitBias?: Record<string, number>;
  stop?: string | string[];
  suffix?: string;
  user?: string;
}

/**
 * Initialize OpenAI client with configuration
 */
export function initializeOpenAI(config?: Partial<OpenAIConfig>): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
  }

  openaiClient = new OpenAI({
    apiKey,
    organization: config?.organization || process.env.OPENAI_ORGANIZATION,
  });

  logger.info('OpenAI client initialized', {
    model: config?.model || process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
    embeddingModel: config?.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  });

  return openaiClient;
}

/**
 * Get or create OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    return initializeOpenAI();
  }
  return openaiClient;
}

/**
 * Create a chat completion with error handling and retries
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const client = getOpenAIClient();
  
  const defaultOptions = {
    model: options.model || process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
    max_tokens: options.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    temperature: options.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    presence_penalty: options.presencePenalty || 0,
    frequency_penalty: options.frequencyPenalty || 0,
  };

  try {
    logger.info('Creating chat completion', {
      messageCount: messages.length,
      model: defaultOptions.model,
      maxTokens: defaultOptions.max_tokens,
    });

    const response = await client.chat.completions.create({
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...defaultOptions,
      stream: false,
      logit_bias: options.logitBias,
      stop: options.stop,
      user: options.user,
    });

    logger.info('Chat completion created', {
      id: response.id,
      model: response.model,
      usage: response.usage,
    });

    return response;
  } catch (error) {
    logger.error('Chat completion failed', error);
    throw new Error(`OpenAI chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a streaming chat completion
 */
export async function createStreamingChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const client = getOpenAIClient();
  
  const defaultOptions = {
    model: options.model || process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
    max_tokens: options.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    temperature: options.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    presence_penalty: options.presencePenalty || 0,
    frequency_penalty: options.frequencyPenalty || 0,
  };

  try {
    logger.info('Creating streaming chat completion', {
      messageCount: messages.length,
      model: defaultOptions.model,
    });

    const stream = await client.chat.completions.create({
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...defaultOptions,
      stream: true,
      logit_bias: options.logitBias,
      stop: options.stop,
      user: options.user,
    });

    return stream;
  } catch (error) {
    logger.error('Streaming chat completion failed', error);
    throw new Error(`OpenAI streaming completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create embeddings for text
 */
export async function createEmbedding(
  input: string | string[],
  model?: string
): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
  const client = getOpenAIClient();
  
  const embeddingModel = model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  try {
    logger.info('Creating embeddings', {
      inputType: typeof input,
      inputLength: Array.isArray(input) ? input.length : 1,
      model: embeddingModel,
    });

    const response = await client.embeddings.create({
      input,
      model: embeddingModel,
    });

    logger.info('Embeddings created', {
      model: response.model,
      usage: response.usage,
      dataLength: response.data.length,
    });

    return response;
  } catch (error) {
    logger.error('Embedding creation failed', error);
    throw new Error(`OpenAI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create text completion (legacy models)
 */
export async function createTextCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<OpenAI.Completions.Completion> {
  const client = getOpenAIClient();
  
  const defaultOptions = {
    model: options.model || 'gpt-3.5-turbo-instruct',
    max_tokens: options.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    temperature: options.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    presence_penalty: options.presencePenalty || 0,
    frequency_penalty: options.frequencyPenalty || 0,
  };

  try {
    logger.info('Creating text completion', {
      promptLength: prompt.length,
      model: defaultOptions.model,
    });

    const response = await client.completions.create({
      prompt,
      ...defaultOptions,
      logit_bias: options.logitBias,
      stop: options.stop,
      suffix: options.suffix,
      user: options.user,
    });

    logger.info('Text completion created', {
      id: response.id,
      model: response.model,
      usage: response.usage,
    });

    return response;
  } catch (error) {
    logger.error('Text completion failed', error);
    throw new Error(`OpenAI text completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transcribe audio using Whisper
 */
export async function transcribeAudio(
  file: File,
  options: {
    model?: string;
    language?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  } = {}
): Promise<OpenAI.Audio.Transcriptions.Transcription> {
  const client = getOpenAIClient();

  try {
    logger.info('Transcribing audio', {
      fileName: file.name,
      fileSize: file.size,
      model: options.model || 'whisper-1',
    });

    const response = await client.audio.transcriptions.create({
      file,
      model: options.model || 'whisper-1',
      language: options.language,
      prompt: options.prompt,
      response_format: options.responseFormat || 'json',
      temperature: options.temperature || 0,
    });

    logger.info('Audio transcribed successfully');

    return response;
  } catch (error) {
    logger.error('Audio transcription failed', error);
    throw new Error(`OpenAI transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Health check for OpenAI API
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    
    // Simple test request
    await client.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-3.5-turbo',
      max_tokens: 5,
    });

    logger.info('OpenAI health check passed');
    return true;
  } catch (error) {
    logger.error('OpenAI health check failed', error);
    return false;
  }
}

/**
 * Reset the OpenAI client (useful for testing)
 */
export function resetClient(): void {
  openaiClient = null;
  logger.info('OpenAI client reset');
}