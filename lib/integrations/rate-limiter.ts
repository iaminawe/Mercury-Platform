/**
 * Advanced Rate Limiting System
 * Implements multiple rate limiting algorithms with flexible configuration
 */

import { EventEmitter } from 'events';

export interface RateLimitConfig {
  id: string;
  name: string;
  algorithm: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';
  limits: {
    requests: number;
    window: number; // seconds
    burst?: number; // for token bucket
  };
  keyGenerator: (context: RateLimitContext) => string;
  scope: 'global' | 'user' | 'organization' | 'ip' | 'api_key' | 'custom';
  customScope?: string;
  action: 'block' | 'delay' | 'throttle';
  delayMs?: number; // for delay action
  throttleRatio?: number; // for throttle action (0-1)
  exemptions?: string[]; // List of exempt keys
  notifications?: {
    threshold: number; // percentage of limit
    webhook?: string;
    email?: string[];
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitContext {
  userId?: string;
  organizationId?: string;
  ipAddress: string;
  apiKey?: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
  action: 'allow' | 'block' | 'delay' | 'throttle';
  delayMs?: number;
  throttleRatio?: number;
  limitConfig: RateLimitConfig;
}

export interface RateLimitState {
  key: string;
  configId: string;
  algorithm: string;
  count: number;
  tokens?: number; // for token bucket
  lastRefill?: Date; // for token bucket
  window: { start: Date; end: Date };
  requests: Date[]; // for sliding window
  createdAt: Date;
  updatedAt: Date;
}

export class RateLimiter extends EventEmitter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private states: Map<string, RateLimitState> = new Map();

  constructor() {
    super();
    this.setupCleanupTask();
  }

  // Configuration management
  addConfig(config: Omit<RateLimitConfig, 'id' | 'createdAt' | 'updatedAt'>): RateLimitConfig {
    const rateLimitConfig: RateLimitConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.configs.set(rateLimitConfig.id, rateLimitConfig);
    this.emit('config:added', rateLimitConfig);
    
    return rateLimitConfig;
  }

  updateConfig(id: string, updates: Partial<RateLimitConfig>): RateLimitConfig | null {
    const config = this.configs.get(id);
    if (!config) return null;

    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date()
    };

    this.configs.set(id, updatedConfig);
    this.emit('config:updated', updatedConfig);
    
    return updatedConfig;
  }

  removeConfig(id: string): boolean {
    const config = this.configs.get(id);
    if (!config) return false;

    this.configs.delete(id);
    
    // Clean up related states
    for (const [stateKey, state] of this.states) {
      if (state.configId === id) {
        this.states.delete(stateKey);
      }
    }

    this.emit('config:removed', config);
    return true;
  }

  getConfig(id: string): RateLimitConfig | undefined {
    return this.configs.get(id);
  }

  listConfigs(): RateLimitConfig[] {
    return Array.from(this.configs.values());
  }

  // Rate limiting logic
  async checkLimit(context: RateLimitContext, configId?: string): Promise<RateLimitResult[]> {
    const applicableConfigs = configId 
      ? [this.configs.get(configId)].filter(Boolean) as RateLimitConfig[]
      : this.findApplicableConfigs(context);

    const results: RateLimitResult[] = [];

    for (const config of applicableConfigs) {
      if (!config.enabled) continue;

      const result = await this.checkSingleLimit(context, config);
      results.push(result);

      // If any limit blocks the request, we can short-circuit
      if (!result.allowed && config.action === 'block') {
        break;
      }
    }

    return results;
  }

  private findApplicableConfigs(context: RateLimitContext): RateLimitConfig[] {
    return Array.from(this.configs.values()).filter(config => {
      if (!config.enabled) return false;

      // Check if this config applies to the current context
      switch (config.scope) {
        case 'global':
          return true;
        case 'user':
          return !!context.userId;
        case 'organization':
          return !!context.organizationId;
        case 'ip':
          return !!context.ipAddress;
        case 'api_key':
          return !!context.apiKey;
        case 'custom':
          return !!config.customScope;
        default:
          return false;
      }
    });
  }

  private async checkSingleLimit(
    context: RateLimitContext, 
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = config.keyGenerator(context);
    
    // Check exemptions
    if (config.exemptions?.includes(key)) {
      return {
        allowed: true,
        remaining: config.limits.requests,
        resetTime: new Date(Date.now() + config.limits.window * 1000),
        action: 'allow',
        limitConfig: config
      };
    }

    const state = this.getOrCreateState(key, config);
    const now = new Date();

    let result: RateLimitResult;

    switch (config.algorithm) {
      case 'token_bucket':
        result = this.checkTokenBucket(state, config, now);
        break;
      case 'sliding_window':
        result = this.checkSlidingWindow(state, config, now);
        break;
      case 'fixed_window':
        result = this.checkFixedWindow(state, config, now);
        break;
      case 'leaky_bucket':
        result = this.checkLeakyBucket(state, config, now);
        break;
      default:
        throw new Error(`Unknown algorithm: ${config.algorithm}`);
    }

    // Update state
    state.updatedAt = now;
    this.states.set(key, state);

    // Check notifications
    if (config.notifications && result.remaining <= (config.limits.requests * config.notifications.threshold / 100)) {
      this.emit('threshold:exceeded', {
        config,
        context,
        remaining: result.remaining,
        total: config.limits.requests
      });
    }

    // Emit events
    if (!result.allowed) {
      this.emit('limit:exceeded', {
        config,
        context,
        result
      });
    }

    return result;
  }

  // Token Bucket Algorithm
  private checkTokenBucket(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: Date
  ): RateLimitResult {
    const bucketSize = config.limits.burst || config.limits.requests;
    const refillRate = config.limits.requests / config.limits.window; // tokens per second

    // Initialize tokens if not set
    if (state.tokens === undefined) {
      state.tokens = bucketSize;
      state.lastRefill = now;
    }

    // Refill tokens based on time elapsed
    if (state.lastRefill) {
      const elapsed = (now.getTime() - state.lastRefill.getTime()) / 1000;
      const tokensToAdd = elapsed * refillRate;
      state.tokens = Math.min(bucketSize, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }

    const allowed = state.tokens >= 1;
    
    if (allowed) {
      state.tokens -= 1;
    }

    const resetTime = new Date(now.getTime() + (bucketSize - state.tokens) / refillRate * 1000);

    return {
      allowed,
      remaining: Math.floor(state.tokens),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((1 - state.tokens) / refillRate),
      action: this.determineAction(config, allowed),
      delayMs: config.action === 'delay' ? config.delayMs : undefined,
      throttleRatio: config.action === 'throttle' ? config.throttleRatio : undefined,
      limitConfig: config
    };
  }

  // Sliding Window Algorithm
  private checkSlidingWindow(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: Date
  ): RateLimitResult {
    const windowMs = config.limits.window * 1000;
    const windowStart = new Date(now.getTime() - windowMs);

    // Initialize requests array if not set
    if (!state.requests) {
      state.requests = [];
    }

    // Remove requests outside the window
    state.requests = state.requests.filter(requestTime => requestTime > windowStart);

    const allowed = state.requests.length < config.limits.requests;
    
    if (allowed) {
      state.requests.push(now);
    }

    const remaining = Math.max(0, config.limits.requests - state.requests.length);
    const resetTime = state.requests.length > 0 
      ? new Date(state.requests[0].getTime() + windowMs)
      : new Date(now.getTime() + windowMs);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime.getTime() - now.getTime()) / 1000),
      action: this.determineAction(config, allowed),
      delayMs: config.action === 'delay' ? config.delayMs : undefined,
      throttleRatio: config.action === 'throttle' ? config.throttleRatio : undefined,
      limitConfig: config
    };
  }

  // Fixed Window Algorithm
  private checkFixedWindow(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: Date
  ): RateLimitResult {
    const windowMs = config.limits.window * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const windowEnd = new Date(windowStart.getTime() + windowMs);

    // Reset count if we're in a new window
    if (!state.window || state.window.start < windowStart) {
      state.count = 0;
      state.window = { start: windowStart, end: windowEnd };
    }

    const allowed = state.count < config.limits.requests;
    
    if (allowed) {
      state.count += 1;
    }

    const remaining = Math.max(0, config.limits.requests - state.count);

    return {
      allowed,
      remaining,
      resetTime: windowEnd,
      retryAfter: allowed ? undefined : Math.ceil((windowEnd.getTime() - now.getTime()) / 1000),
      action: this.determineAction(config, allowed),
      delayMs: config.action === 'delay' ? config.delayMs : undefined,
      throttleRatio: config.action === 'throttle' ? config.throttleRatio : undefined,
      limitConfig: config
    };
  }

  // Leaky Bucket Algorithm
  private checkLeakyBucket(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: Date
  ): RateLimitResult {
    const bucketSize = config.limits.burst || config.limits.requests;
    const leakRate = config.limits.requests / config.limits.window; // requests per second

    // Initialize if not set
    if (state.count === undefined) {
      state.count = 0;
      state.lastRefill = now;
    }

    // Leak requests based on time elapsed
    if (state.lastRefill) {
      const elapsed = (now.getTime() - state.lastRefill.getTime()) / 1000;
      const requestsToLeak = elapsed * leakRate;
      state.count = Math.max(0, state.count - requestsToLeak);
      state.lastRefill = now;
    }

    const allowed = state.count < bucketSize;
    
    if (allowed) {
      state.count += 1;
    }

    const remaining = Math.max(0, bucketSize - state.count);
    const resetTime = new Date(now.getTime() + (state.count / leakRate * 1000));

    return {
      allowed,
      remaining: Math.floor(remaining),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((state.count - bucketSize + 1) / leakRate),
      action: this.determineAction(config, allowed),
      delayMs: config.action === 'delay' ? config.delayMs : undefined,
      throttleRatio: config.action === 'throttle' ? config.throttleRatio : undefined,
      limitConfig: config
    };
  }

  private determineAction(config: RateLimitConfig, allowed: boolean): 'allow' | 'block' | 'delay' | 'throttle' {
    if (allowed) return 'allow';
    return config.action;
  }

  private getOrCreateState(key: string, config: RateLimitConfig): RateLimitState {
    const stateKey = `${config.id}:${key}`;
    let state = this.states.get(stateKey);

    if (!state) {
      state = {
        key,
        configId: config.id,
        algorithm: config.algorithm,
        count: 0,
        window: { start: new Date(), end: new Date() },
        requests: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.states.set(stateKey, state);
    }

    return state;
  }

  // Utility methods
  async reset(key: string, configId?: string): Promise<boolean> {
    if (configId) {
      const stateKey = `${configId}:${key}`;
      return this.states.delete(stateKey);
    } else {
      // Reset all states for this key
      let deleted = false;
      for (const [stateKey, state] of this.states) {
        if (state.key === key) {
          this.states.delete(stateKey);
          deleted = true;
        }
      }
      return deleted;
    }
  }

  async resetAll(configId?: string): Promise<number> {
    let count = 0;
    
    if (configId) {
      for (const [stateKey, state] of this.states) {
        if (state.configId === configId) {
          this.states.delete(stateKey);
          count++;
        }
      }
    } else {
      count = this.states.size;
      this.states.clear();
    }

    return count;
  }

  getState(key: string, configId: string): RateLimitState | undefined {
    const stateKey = `${configId}:${key}`;
    return this.states.get(stateKey);
  }

  getStats(configId?: string): {
    totalConfigs: number;
    activeStates: number;
    requestsBlocked: number;
    requestsAllowed: number;
  } {
    const configs = configId 
      ? [this.configs.get(configId)].filter(Boolean)
      : Array.from(this.configs.values());

    const states = configId
      ? Array.from(this.states.values()).filter(s => s.configId === configId)
      : Array.from(this.states.values());

    // This would typically be tracked separately for accurate metrics
    return {
      totalConfigs: configs.length,
      activeStates: states.length,
      requestsBlocked: 0, // Would be tracked by events
      requestsAllowed: 0  // Would be tracked by events
    };
  }

  // Cleanup expired states
  private setupCleanupTask(): void {
    setInterval(() => {
      const now = new Date();
      const expiredStates: string[] = [];

      for (const [stateKey, state] of this.states) {
        const config = this.configs.get(state.configId);
        if (!config) {
          expiredStates.push(stateKey);
          continue;
        }

        // Consider state expired if it hasn't been updated for 2x the window time
        const expiredTime = new Date(state.updatedAt.getTime() + config.limits.window * 2000);
        if (now > expiredTime) {
          expiredStates.push(stateKey);
        }
      }

      expiredStates.forEach(key => this.states.delete(key));
      
      if (expiredStates.length > 0) {
        this.emit('cleanup:completed', { removed: expiredStates.length });
      }
    }, 300000); // Run every 5 minutes
  }
}

// Key generator functions
export const keyGenerators = {
  ip: (context: RateLimitContext) => context.ipAddress,
  user: (context: RateLimitContext) => context.userId || 'anonymous',
  organization: (context: RateLimitContext) => context.organizationId || 'default',
  apiKey: (context: RateLimitContext) => context.apiKey || 'no-key',
  endpoint: (context: RateLimitContext) => `${context.method}:${context.endpoint}`,
  userEndpoint: (context: RateLimitContext) => `${context.userId || 'anonymous'}:${context.method}:${context.endpoint}`,
  global: () => 'global'
};

export default new RateLimiter();