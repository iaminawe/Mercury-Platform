import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { createLogger } from '@/lib/logger';

const logger = createLogger('langchain-setup');

export interface LangChainConfig {
  openaiApiKey: string;
  model?: string;
  embeddingModel?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface ChainResponse {
  result: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface ConversationMemory {
  messages: Array<{
    role: 'human' | 'ai' | 'system';
    content: string;
    timestamp: Date;
  }>;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Initialize ChatOpenAI instance with configuration
 */
export function createChatModel(config?: Partial<LangChainConfig>): ChatOpenAI {
  const apiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required for LangChain setup');
  }

  const chatModel = new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: config?.model || process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
    temperature: config?.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: config?.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    streaming: config?.streaming || false,
  });

  logger.info('ChatOpenAI model initialized', {
    model: chatModel.modelName,
    temperature: chatModel.temperature,
    maxTokens: chatModel.maxTokens,
  });

  return chatModel;
}

/**
 * Initialize OpenAI embeddings
 */
export function createEmbeddingsModel(config?: Partial<LangChainConfig>): OpenAIEmbeddings {
  const apiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embeddings');
  }

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: config?.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  });

  logger.info('OpenAI embeddings model initialized', {
    model: embeddings.modelName,
  });

  return embeddings;
}

/**
 * Create a simple question-answering chain
 */
export function createQAChain(chatModel?: ChatOpenAI) {
  const model = chatModel || createChatModel();
  const outputParser = new StringOutputParser();

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful AI assistant for a Shopify store. Answer questions based on the context provided. If you don't know the answer, say so clearly."],
    ["human", "Context: {context}\n\nQuestion: {question}"],
  ]);

  const chain = RunnableSequence.from([
    qaPrompt,
    model,
    outputParser,
  ]);

  logger.info('Q&A chain created');

  return {
    async invoke(input: { context: string; question: string }): Promise<ChainResponse> {
      try {
        logger.info('Invoking Q&A chain', {
          contextLength: input.context.length,
          question: input.question.substring(0, 100) + '...',
        });

        const result = await chain.invoke(input);

        logger.info('Q&A chain completed');

        return {
          result,
          metadata: {
            chainType: 'qa',
            contextLength: input.context.length,
          },
        };
      } catch (error) {
        logger.error('Q&A chain failed', error);
        throw new Error(`Q&A chain failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}

/**
 * Create a product analysis chain
 */
export function createProductAnalysisChain(chatModel?: ChatOpenAI) {
  const model = chatModel || createChatModel();
  const outputParser = new StringOutputParser();

  const analysisPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert e-commerce analyst specializing in Shopify product optimization. 
    Analyze the provided product data and generate actionable insights for:
    - SEO optimization
    - Pricing strategy
    - Product description improvements
    - Marketing recommendations
    
    Provide structured, actionable advice in JSON format.`],
    ["human", "Product Data: {productData}\n\nAnalysis Type: {analysisType}"],
  ]);

  const chain = RunnableSequence.from([
    analysisPrompt,
    model,
    outputParser,
  ]);

  return {
    async analyze(productData: any, analysisType: string): Promise<ChainResponse> {
      try {
        logger.info('Starting product analysis', {
          analysisType,
          productId: productData.id,
        });

        const result = await chain.invoke({
          productData: JSON.stringify(productData, null, 2),
          analysisType,
        });

        logger.info('Product analysis completed');

        return {
          result,
          metadata: {
            chainType: 'product_analysis',
            analysisType,
            productId: productData.id,
          },
        };
      } catch (error) {
        logger.error('Product analysis failed', error);
        throw new Error(`Product analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}

/**
 * Create a conversational chain with memory
 */
export function createConversationalChain(
  chatModel?: ChatOpenAI,
  initialMemory?: ConversationMemory
) {
  const model = chatModel || createChatModel();
  const outputParser = new StringOutputParser();

  let memory: ConversationMemory = initialMemory || {
    messages: [],
    sessionId: `session_${Date.now()}`,
  };

  const conversationPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful AI assistant for a Shopify store management platform called Mercury. 
    You help store owners with:
    - Product management and optimization
    - Sales analytics and insights
    - Customer service automation
    - Marketing strategy advice
    - Technical support for the platform
    
    Be helpful, professional, and provide actionable advice. Remember the conversation context.`],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
  ]);

  return {
    memory,
    
    async chat(input: string, userId?: string): Promise<ChainResponse> {
      try {
        logger.info('Starting conversation', {
          sessionId: memory.sessionId,
          userId,
          inputLength: input.length,
        });

        // Convert memory to LangChain message format
        const chatHistory = memory.messages.map(msg => {
          switch (msg.role) {
            case 'human':
              return new HumanMessage(msg.content);
            case 'ai':
              return new AIMessage(msg.content);
            case 'system':
              return new SystemMessage(msg.content);
            default:
              return new HumanMessage(msg.content);
          }
        });

        const chain = RunnableSequence.from([
          conversationPrompt,
          model,
          outputParser,
        ]);

        const result = await chain.invoke({
          chat_history: chatHistory,
          input,
        });

        // Update memory
        memory.messages.push(
          { role: 'human', content: input, timestamp: new Date() },
          { role: 'ai', content: result, timestamp: new Date() }
        );

        // Keep memory manageable (last 20 messages)
        if (memory.messages.length > 20) {
          memory.messages = memory.messages.slice(-20);
        }

        logger.info('Conversation completed', {
          sessionId: memory.sessionId,
          responseLength: result.length,
        });

        return {
          result,
          metadata: {
            chainType: 'conversation',
            sessionId: memory.sessionId,
            messageCount: memory.messages.length,
          },
        };
      } catch (error) {
        logger.error('Conversation failed', error);
        throw new Error(`Conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    clearMemory(): void {
      memory.messages = [];
      logger.info('Conversation memory cleared', { sessionId: memory.sessionId });
    },

    getMemory(): ConversationMemory {
      return { ...memory };
    },

    setMemory(newMemory: ConversationMemory): void {
      memory = newMemory;
      logger.info('Conversation memory updated', { sessionId: memory.sessionId });
    },
  };
}

/**
 * Create a text summarization chain
 */
export function createSummarizationChain(chatModel?: ChatOpenAI) {
  const model = chatModel || createChatModel();
  const outputParser = new StringOutputParser();

  const summaryPrompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert at summarizing content. Create concise, accurate summaries that capture the key points."],
    ["human", "Summarize the following text in {length} words or less:\n\n{text}"],
  ]);

  const chain = RunnableSequence.from([
    summaryPrompt,
    model,
    outputParser,
  ]);

  return {
    async summarize(text: string, maxLength: number = 100): Promise<ChainResponse> {
      try {
        logger.info('Starting text summarization', {
          textLength: text.length,
          maxLength,
        });

        const result = await chain.invoke({
          text,
          length: maxLength.toString(),
        });

        logger.info('Summarization completed');

        return {
          result,
          metadata: {
            chainType: 'summarization',
            originalLength: text.length,
            summaryLength: result.length,
          },
        };
      } catch (error) {
        logger.error('Summarization failed', error);
        throw new Error(`Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}

/**
 * Create custom prompt template
 */
export function createCustomPrompt(templateString: string, inputVariables: string[]) {
  return PromptTemplate.fromTemplate(templateString);
}

/**
 * Health check for LangChain setup
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const model = createChatModel();
    const result = await model.invoke([new HumanMessage("Say 'OK' if you're working")]);
    
    logger.info('LangChain health check passed', {
      response: result.content,
    });
    
    return true;
  } catch (error) {
    logger.error('LangChain health check failed', error);
    return false;
  }
}

/**
 * Batch processing utility
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    logger.info('Processing batch', {
      batchNumber: Math.floor(i / batchSize) + 1,
      batchSize: batch.length,
      totalItems: items.length,
    });

    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  logger.info('Batch processing completed', {
    totalProcessed: results.length,
  });
  
  return results;
}