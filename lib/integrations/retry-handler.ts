/**
 * Intelligent Retry Handler
 * Implements various retry strategies with circuit breaker pattern
 */

import { EventEmitter } from 'events';

export interface RetryConfig {
  id: string;
  name: string;
  strategy: 'exponential' | 'linear' | 'fixed' | 'fibonacci' | 'custom';
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier?: number; // for exponential/linear
  jitter?: {
    enabled: boolean;
    type: 'full' | 'equal' | 'decorrelated';
    maxJitterMs?: number;
  };
  conditions: {
    httpCodes?: number[];
    errorTypes?: string[];
    errorMessages?: string[];
    timeoutMs?: number;
  };
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeoutMs: number;
    monitoringWindowMs: number;
  };
  deadLetterQueue?: {
    enabled: boolean;
    maxSize: number;
    retryAfterMs: number;
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryContext {
  operationId: string;
  attempt: number;
  lastError?: Error;
  startTime: Date;
  metadata?: Record<string, any>;
}

export interface RetryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  nextRetryIn?: number;
  circuitBreakerOpen?: boolean;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  resetTime?: Date;
  requestCount: number;
  successCount: number;
  windowStart: Date;
}

export interface DeadLetterItem {
  id: string;
  operationId: string;
  payload: any;
  error: Error;
  attempts: number;
  firstAttempt: Date;
  lastAttempt: Date;
  nextRetry: Date;
  retryConfigId: string;
}

export type RetryableOperation<T> = () => Promise<T>;

export class RetryHandler extends EventEmitter {
  private configs: Map<string, RetryConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private deadLetterQueue: Map<string, DeadLetterItem> = new Map();
  private activeOperations: Map<string, RetryContext> = new Map();

  constructor() {
    super();
    this.setupCleanupTasks();
    this.setupDeadLetterProcessor();
  }

  // Configuration management
  addConfig(config: Omit<RetryConfig, 'id' | 'createdAt' | 'updatedAt'>): RetryConfig {
    const retryConfig: RetryConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.configs.set(retryConfig.id, retryConfig);
    
    // Initialize circuit breaker if enabled
    if (retryConfig.circuitBreaker?.enabled) {
      this.initializeCircuitBreaker(retryConfig.id);
    }

    this.emit('config:added', retryConfig);
    return retryConfig;
  }

  updateConfig(id: string, updates: Partial<RetryConfig>): RetryConfig | null {
    const config = this.configs.get(id);
    if (!config) return null;

    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date()
    };

    this.configs.set(id, updatedConfig);

    // Update circuit breaker if needed
    if (updatedConfig.circuitBreaker?.enabled && !this.circuitBreakers.has(id)) {
      this.initializeCircuitBreaker(id);
    } else if (!updatedConfig.circuitBreaker?.enabled && this.circuitBreakers.has(id)) {
      this.circuitBreakers.delete(id);
    }

    this.emit('config:updated', updatedConfig);
    return updatedConfig;
  }

  removeConfig(id: string): boolean {
    const config = this.configs.get(id);
    if (!config) return false;

    this.configs.delete(id);
    this.circuitBreakers.delete(id);

    // Remove related dead letter items
    for (const [itemId, item] of this.deadLetterQueue) {
      if (item.retryConfigId === id) {
        this.deadLetterQueue.delete(itemId);
      }
    }

    this.emit('config:removed', config);
    return true;
  }

  getConfig(id: string): RetryConfig | undefined {
    return this.configs.get(id);
  }

  // Main retry execution
  async execute<T>(
    operation: RetryableOperation<T>,
    configId: string,
    operationId?: string
  ): Promise<RetryResult<T>> {
    const config = this.configs.get(configId);
    if (!config || !config.enabled) {
      throw new Error(`Retry config ${configId} not found or disabled`);
    }

    const opId = operationId || crypto.randomUUID();
    const startTime = new Date();

    // Check circuit breaker
    if (config.circuitBreaker?.enabled) {
      const circuitState = this.checkCircuitBreaker(configId);
      if (circuitState.state === 'open') {
        return {
          success: false,
          error: new Error('Circuit breaker is open'),
          attempts: 0,
          totalDuration: 0,
          circuitBreakerOpen: true
        };
      }
    }

    const context: RetryContext = {
      operationId: opId,
      attempt: 0,
      startTime,
      metadata: {}
    };

    this.activeOperations.set(opId, context);

    try {
      const result = await this.executeWithRetry(operation, config, context);
      
      // Update circuit breaker on success
      if (config.circuitBreaker?.enabled && result.success) {
        this.recordCircuitBreakerSuccess(configId);
      }

      return result;
    } finally {
      this.activeOperations.delete(opId);
    }
  }

  private async executeWithRetry<T>(
    operation: RetryableOperation<T>,
    config: RetryConfig,
    context: RetryContext
  ): Promise<RetryResult<T>> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      context.attempt = attempt;

      try {
        // Add timeout wrapper if configured
        const result = config.conditions.timeoutMs 
          ? await this.withTimeout(operation(), config.conditions.timeoutMs)
          : await operation();

        // Success!
        const totalDuration = Date.now() - context.startTime.getTime();
        
        this.emit('operation:success', {
          operationId: context.operationId,
          attempt,
          totalDuration,
          config
        });

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalDuration
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        context.lastError = lastError;

        // Check if this error should trigger a retry
        if (!this.shouldRetry(lastError, config) || attempt > config.maxRetries) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt - 1, config);
        
        this.emit('operation:retry', {
          operationId: context.operationId,
          attempt,
          error: lastError,
          nextRetryIn: delay,
          config
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    const totalDuration = Date.now() - context.startTime.getTime();
    
    // Update circuit breaker on failure
    if (config.circuitBreaker?.enabled) {
      this.recordCircuitBreakerFailure(config.id);
    }

    // Add to dead letter queue if configured
    if (config.deadLetterQueue?.enabled && lastError) {
      this.addToDeadLetterQueue(context, config, lastError);
    }

    this.emit('operation:failed', {
      operationId: context.operationId,
      attempts: context.attempt,
      error: lastError,
      totalDuration,
      config
    });

    return {
      success: false,
      error: lastError,
      attempts: context.attempt,
      totalDuration
    };
  }

  private shouldRetry(error: Error, config: RetryConfig): boolean {
    const conditions = config.conditions;

    // Check HTTP status codes
    if (conditions.httpCodes && conditions.httpCodes.length > 0) {
      const httpCode = this.extractHttpCode(error);
      if (httpCode && !conditions.httpCodes.includes(httpCode)) {
        return false;
      }
    }

    // Check error types
    if (conditions.errorTypes && conditions.errorTypes.length > 0) {
      if (!conditions.errorTypes.includes(error.constructor.name)) {
        return false;
      }
    }

    // Check error messages
    if (conditions.errorMessages && conditions.errorMessages.length > 0) {
      const hasMatchingMessage = conditions.errorMessages.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
      if (!hasMatchingMessage) {
        return false;
      }
    }

    return true;
  }

  private extractHttpCode(error: Error): number | null {
    // Try to extract HTTP status code from error
    if ('status' in error) return error.status as number;
    if ('statusCode' in error) return error.statusCode as number;
    if ('code' in error && typeof error.code === 'number') return error.code;
    
    // Try to parse from message
    const match = error.message.match(/(\d{3})/);
    return match ? parseInt(match[1]) : null;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case 'exponential':
        delay = config.initialDelayMs * Math.pow(config.multiplier || 2, attempt);
        break;
      case 'linear':
        delay = config.initialDelayMs + (config.multiplier || 1000) * attempt;
        break;
      case 'fixed':
        delay = config.initialDelayMs;
        break;
      case 'fibonacci':
        delay = config.initialDelayMs * this.fibonacci(attempt + 1);
        break;
      case 'custom':
        // Custom logic would be implemented here
        delay = config.initialDelayMs * (attempt + 1);
        break;
      default:
        delay = config.initialDelayMs;
    }

    // Cap at max delay
    delay = Math.min(delay, config.maxDelayMs);

    // Add jitter if configured
    if (config.jitter?.enabled) {
      delay = this.addJitter(delay, config.jitter);
    }

    return delay;
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  private addJitter(delay: number, jitterConfig: RetryConfig['jitter']): number {
    if (!jitterConfig) return delay;

    switch (jitterConfig.type) {
      case 'full':
        return Math.random() * delay;
      case 'equal':
        return delay * 0.5 + Math.random() * delay * 0.5;
      case 'decorrelated':
        return Math.random() * delay * 3;
      default:
        return delay;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Circuit Breaker implementation
  private initializeCircuitBreaker(configId: string): void {
    this.circuitBreakers.set(configId, {
      state: 'closed',
      failureCount: 0,
      requestCount: 0,
      successCount: 0,
      windowStart: new Date()
    });
  }

  private checkCircuitBreaker(configId: string): CircuitBreakerState {
    const state = this.circuitBreakers.get(configId);
    const config = this.configs.get(configId);
    
    if (!state || !config?.circuitBreaker) {
      throw new Error('Circuit breaker not initialized');
    }

    const now = new Date();
    const cbConfig = config.circuitBreaker;

    // Check if monitoring window has expired
    if (now.getTime() - state.windowStart.getTime() > cbConfig.monitoringWindowMs) {
      // Reset window
      state.requestCount = 0;
      state.successCount = 0;
      state.failureCount = 0;
      state.windowStart = now;
    }

    // Check if circuit should transition from open to half-open
    if (state.state === 'open' && state.resetTime && now >= state.resetTime) {
      state.state = 'half-open';
      state.failureCount = 0;
      this.emit('circuit-breaker:half-open', { configId, state });
    }

    return state;
  }

  private recordCircuitBreakerSuccess(configId: string): void {
    const state = this.circuitBreakers.get(configId);
    if (!state) return;

    state.requestCount++;
    state.successCount++;
    state.lastSuccessTime = new Date();

    if (state.state === 'half-open') {
      // Transition back to closed
      state.state = 'closed';
      state.failureCount = 0;
      this.emit('circuit-breaker:closed', { configId, state });
    }
  }

  private recordCircuitBreakerFailure(configId: string): void {
    const state = this.circuitBreakers.get(configId);
    const config = this.configs.get(configId);
    
    if (!state || !config?.circuitBreaker) return;

    state.requestCount++;
    state.failureCount++;
    state.lastFailureTime = new Date();

    const cbConfig = config.circuitBreaker;

    if (state.failureCount >= cbConfig.failureThreshold) {
      // Trip the circuit breaker
      state.state = 'open';
      state.resetTime = new Date(Date.now() + cbConfig.resetTimeoutMs);
      this.emit('circuit-breaker:open', { configId, state });
    }
  }

  getCircuitBreakerState(configId: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(configId);
  }

  resetCircuitBreaker(configId: string): boolean {
    const state = this.circuitBreakers.get(configId);
    if (!state) return false;

    state.state = 'closed';
    state.failureCount = 0;
    state.requestCount = 0;
    state.successCount = 0;
    state.windowStart = new Date();
    delete state.resetTime;
    delete state.lastFailureTime;

    this.emit('circuit-breaker:reset', { configId, state });
    return true;
  }

  // Dead Letter Queue implementation
  private addToDeadLetterQueue(
    context: RetryContext,
    config: RetryConfig,
    error: Error
  ): void {
    if (!config.deadLetterQueue?.enabled) return;

    const item: DeadLetterItem = {
      id: crypto.randomUUID(),
      operationId: context.operationId,
      payload: context.metadata,
      error,
      attempts: context.attempt,
      firstAttempt: context.startTime,
      lastAttempt: new Date(),
      nextRetry: new Date(Date.now() + config.deadLetterQueue.retryAfterMs),
      retryConfigId: config.id
    };

    // Check queue size limit
    const queueItems = Array.from(this.deadLetterQueue.values())
      .filter(i => i.retryConfigId === config.id);
      
    if (queueItems.length >= config.deadLetterQueue.maxSize) {
      // Remove oldest item
      const oldest = queueItems.sort((a, b) => a.firstAttempt.getTime() - b.firstAttempt.getTime())[0];
      this.deadLetterQueue.delete(oldest.id);
    }

    this.deadLetterQueue.set(item.id, item);
    this.emit('dead-letter:added', item);
  }

  private setupDeadLetterProcessor(): void {
    setInterval(() => {
      this.processDeadLetterQueue();
    }, 60000); // Process every minute
  }

  private async processDeadLetterQueue(): Promise<void> {
    const now = new Date();
    
    for (const [itemId, item] of this.deadLetterQueue) {
      if (item.nextRetry <= now) {
        const config = this.configs.get(item.retryConfigId);
        if (!config) {
          this.deadLetterQueue.delete(itemId);
          continue;
        }

        this.emit('dead-letter:processing', item);
        
        // Remove from queue - it will be re-added if it fails again
        this.deadLetterQueue.delete(itemId);
        
        // This would trigger the operation retry
        // The actual implementation would depend on how operations are stored/reconstructed
        this.emit('dead-letter:retry-needed', item);
      }
    }
  }

  getDeadLetterQueue(configId?: string): DeadLetterItem[] {
    const items = Array.from(this.deadLetterQueue.values());
    return configId 
      ? items.filter(item => item.retryConfigId === configId)
      : items;
  }

  removeFromDeadLetterQueue(itemId: string): boolean {
    return this.deadLetterQueue.delete(itemId);
  }

  clearDeadLetterQueue(configId?: string): number {
    if (configId) {
      let count = 0;
      for (const [itemId, item] of this.deadLetterQueue) {
        if (item.retryConfigId === configId) {
          this.deadLetterQueue.delete(itemId);
          count++;
        }
      }
      return count;
    } else {
      const count = this.deadLetterQueue.size;
      this.deadLetterQueue.clear();
      return count;
    }
  }

  // Statistics and monitoring
  getStats(configId?: string): {
    totalConfigs: number;
    activeOperations: number;
    circuitBreakersOpen: number;
    deadLetterQueueSize: number;
    operationsInProgress: string[];
  } {
    const configs = configId 
      ? [this.configs.get(configId)].filter(Boolean)
      : Array.from(this.configs.values());

    const circuitBreakersOpen = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.state === 'open').length;

    const deadLetterItems = configId
      ? Array.from(this.deadLetterQueue.values()).filter(item => item.retryConfigId === configId)
      : Array.from(this.deadLetterQueue.values());

    return {
      totalConfigs: configs.length,
      activeOperations: this.activeOperations.size,
      circuitBreakersOpen,
      deadLetterQueueSize: deadLetterItems.length,
      operationsInProgress: Array.from(this.activeOperations.keys())
    };
  }

  // Cleanup tasks
  private setupCleanupTasks(): void {
    // Clean up stale operations every 5 minutes
    setInterval(() => {
      const now = new Date();
      const staleOperations: string[] = [];
      
      for (const [opId, context] of this.activeOperations) {
        // Consider operation stale if it's been running for more than 1 hour
        if (now.getTime() - context.startTime.getTime() > 3600000) {
          staleOperations.push(opId);
        }
      }

      staleOperations.forEach(opId => {
        this.activeOperations.delete(opId);
        this.emit('operation:stale-cleanup', opId);
      });
    }, 300000);
  }
}

export default new RetryHandler();