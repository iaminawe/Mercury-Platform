/**
 * Plugin Hook System
 * Event-driven plugin architecture for Mercury
 */

import { EventEmitter } from 'events';
import { PluginEvent, PluginEventData, PluginHook, PluginContext } from './types';

export class PluginHookManager extends EventEmitter {
  private hooks = new Map<string, RegisteredHook[]>();
  private globalMiddleware: HookMiddleware[] = [];
  private eventHistory: EventHistory[] = [];
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(100); // Increase for multiple plugins
  }

  /**
   * Register a plugin hook
   */
  registerHook(
    pluginId: string,
    hook: PluginHook,
    handler: HookHandler,
    context: PluginContext
  ): void {
    const registeredHook: RegisteredHook = {
      pluginId,
      event: hook.event,
      handler,
      priority: hook.priority || 50,
      async: hook.async !== false, // Default to async
      context,
      registeredAt: new Date(),
      callCount: 0,
      lastCalled: undefined,
      errors: 0
    };

    if (!this.hooks.has(hook.event)) {
      this.hooks.set(hook.event, []);
    }

    const eventHooks = this.hooks.get(hook.event)!;
    eventHooks.push(registeredHook);
    
    // Sort by priority (higher priority = earlier execution)
    eventHooks.sort((a, b) => b.priority - a.priority);

    console.log(`Registered hook: ${pluginId} -> ${hook.event} (priority: ${registeredHook.priority})`);
  }

  /**
   * Unregister plugin hooks
   */
  unregisterHooks(pluginId: string): void {
    for (const [event, hooks] of this.hooks.entries()) {
      const filtered = hooks.filter(hook => hook.pluginId !== pluginId);
      
      if (filtered.length === 0) {
        this.hooks.delete(event);
      } else {
        this.hooks.set(event, filtered);
      }
    }

    console.log(`Unregistered all hooks for plugin: ${pluginId}`);
  }

  /**
   * Emit an event to trigger hooks
   */
  async emit(event: PluginEvent, data: PluginEventData): Promise<HookResult> {
    const startTime = Date.now();
    const hooks = this.hooks.get(event) || [];
    
    if (hooks.length === 0) {
      return {
        event,
        success: true,
        executedHooks: 0,
        executionTime: Date.now() - startTime,
        results: [],
        errors: []
      };
    }

    // Add to event history
    this.addToHistory(event, data);

    // Apply global middleware
    let processedData = data;
    for (const middleware of this.globalMiddleware) {
      if (middleware.before) {
        processedData = await middleware.before(event, processedData);
      }
    }

    const results: HookExecutionResult[] = [];
    const errors: HookError[] = [];
    let executedHooks = 0;

    // Execute hooks
    for (const hook of hooks) {
      try {
        hook.callCount++;
        hook.lastCalled = new Date();

        const hookStartTime = Date.now();
        
        if (hook.async) {
          // Execute async hook
          const result = await this.executeAsyncHook(hook, event, processedData);
          results.push({
            pluginId: hook.pluginId,
            success: true,
            result,
            executionTime: Date.now() - hookStartTime
          });
        } else {
          // Execute sync hook
          const result = this.executeSyncHook(hook, event, processedData);
          results.push({
            pluginId: hook.pluginId,
            success: true,
            result,
            executionTime: Date.now() - hookStartTime
          });
        }

        executedHooks++;

      } catch (error) {
        hook.errors++;
        const hookError: HookError = {
          pluginId: hook.pluginId,
          event,
          error: error as Error,
          timestamp: new Date()
        };
        
        errors.push(hookError);
        console.error(`Hook execution failed: ${hook.pluginId} -> ${event}`, error);
      }
    }

    // Apply global middleware (after)
    for (const middleware of this.globalMiddleware) {
      if (middleware.after) {
        await middleware.after(event, processedData, results);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      event,
      success: errors.length === 0,
      executedHooks,
      executionTime: totalTime,
      results,
      errors
    };
  }

  /**
   * Register global middleware
   */
  registerMiddleware(middleware: HookMiddleware): void {
    this.globalMiddleware.push(middleware);
    console.log('Registered global hook middleware');
  }

  /**
   * Get hook statistics
   */
  getHookStatistics(): HookStatistics {
    const stats: HookStatistics = {
      totalHooks: 0,
      hooksByEvent: {},
      hooksByPlugin: {},
      totalCalls: 0,
      totalErrors: 0,
      averageExecutionTime: 0
    };

    for (const [event, hooks] of this.hooks.entries()) {
      stats.totalHooks += hooks.length;
      stats.hooksByEvent[event] = hooks.length;

      for (const hook of hooks) {
        if (!stats.hooksByPlugin[hook.pluginId]) {
          stats.hooksByPlugin[hook.pluginId] = 0;
        }
        stats.hooksByPlugin[hook.pluginId]++;
        stats.totalCalls += hook.callCount;
        stats.totalErrors += hook.errors;
      }
    }

    return stats;
  }

  /**
   * Get hooks for an event
   */
  getHooksForEvent(event: string): RegisteredHook[] {
    return this.hooks.get(event) || [];
  }

  /**
   * Get hooks for a plugin
   */
  getHooksForPlugin(pluginId: string): RegisteredHook[] {
    const pluginHooks: RegisteredHook[] = [];
    
    for (const hooks of this.hooks.values()) {
      for (const hook of hooks) {
        if (hook.pluginId === pluginId) {
          pluginHooks.push(hook);
        }
      }
    }

    return pluginHooks;
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 100): EventHistory[] {
    return this.eventHistory.slice(0, limit);
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Create event filter
   */
  createEventFilter(options: {
    events?: string[];
    plugins?: string[];
    timeframe?: { start: Date; end: Date };
  }): (history: EventHistory) => boolean {
    return (history: EventHistory) => {
      if (options.events && !options.events.includes(history.event)) {
        return false;
      }

      if (options.timeframe) {
        if (history.timestamp < options.timeframe.start || history.timestamp > options.timeframe.end) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Execute async hook
   */
  private async executeAsyncHook(
    hook: RegisteredHook,
    event: string,
    data: PluginEventData
  ): Promise<any> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Hook execution timeout')), 30000); // 30s timeout
    });

    const execution = hook.handler(event, data, hook.context);
    
    return Promise.race([execution, timeout]);
  }

  /**
   * Execute sync hook
   */
  private executeSyncHook(
    hook: RegisteredHook,
    event: string,
    data: PluginEventData
  ): any {
    return hook.handler(event, data, hook.context);
  }

  /**
   * Add event to history
   */
  private addToHistory(event: PluginEvent, data: PluginEventData): void {
    this.eventHistory.unshift({
      event,
      data,
      timestamp: new Date(),
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });

    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }
  }
}

/**
 * Hook lifecycle manager
 */
export class HookLifecycleManager {
  private hookManager: PluginHookManager;

  constructor(hookManager: PluginHookManager) {
    this.hookManager = hookManager;
  }

  /**
   * Register built-in Mercury hooks
   */
  registerBuiltInHooks(): void {
    // Store events
    this.registerStoreHooks();
    
    // Plugin lifecycle events
    this.registerPluginLifecycleHooks();
    
    // Analytics events
    this.registerAnalyticsHooks();
    
    // User interaction events
    this.registerUserHooks();
  }

  /**
   * Register store-related hooks
   */
  private registerStoreHooks(): void {
    const storeEvents = [
      'store.product.created',
      'store.product.updated',
      'store.product.deleted',
      'store.order.created',
      'store.order.updated',
      'store.order.fulfilled',
      'store.order.cancelled',
      'store.customer.created',
      'store.customer.updated',
      'store.inventory.updated'
    ];

    console.log('Registered store hooks:', storeEvents);
  }

  /**
   * Register plugin lifecycle hooks
   */
  private registerPluginLifecycleHooks(): void {
    const lifecycleEvents = [
      'plugin.installed',
      'plugin.activated',
      'plugin.deactivated',
      'plugin.uninstalled',
      'plugin.updated',
      'plugin.error'
    ];

    console.log('Registered plugin lifecycle hooks:', lifecycleEvents);
  }

  /**
   * Register analytics hooks
   */
  private registerAnalyticsHooks(): void {
    const analyticsEvents = [
      'analytics.data.updated',
      'analytics.report.generated',
      'analytics.metric.calculated'
    ];

    console.log('Registered analytics hooks:', analyticsEvents);
  }

  /**
   * Register user interaction hooks
   */
  private registerUserHooks(): void {
    const userEvents = [
      'user.action',
      'user.login',
      'user.logout',
      'user.preference.updated'
    ];

    console.log('Registered user hooks:', userEvents);
  }
}

/**
 * Hook validation utilities
 */
export class HookValidator {
  /**
   * Validate hook definition
   */
  static validateHook(hook: PluginHook): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!hook.event || typeof hook.event !== 'string') {
      errors.push('Hook event must be a non-empty string');
    }

    if (!hook.handler || typeof hook.handler !== 'string') {
      errors.push('Hook handler must be a non-empty string');
    }

    if (hook.priority !== undefined && (typeof hook.priority !== 'number' || hook.priority < 0 || hook.priority > 100)) {
      errors.push('Hook priority must be a number between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate event data
   */
  static validateEventData(event: PluginEvent, data: PluginEventData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.timestamp || !(data.timestamp instanceof Date)) {
      errors.push('Event data must include a valid timestamp');
    }

    if (!data.data) {
      errors.push('Event data must include a data payload');
    }

    // Event-specific validation
    if (event.startsWith('store.') && !data.store) {
      errors.push('Store events must include store information');
    }

    if (event.startsWith('user.') && !data.user) {
      errors.push('User events must include user information');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Type definitions for the hook system

export type HookHandler = (
  event: string,
  data: PluginEventData,
  context: PluginContext
) => any | Promise<any>;

export interface RegisteredHook {
  pluginId: string;
  event: string;
  handler: HookHandler;
  priority: number;
  async: boolean;
  context: PluginContext;
  registeredAt: Date;
  callCount: number;
  lastCalled?: Date;
  errors: number;
}

export interface HookResult {
  event: PluginEvent;
  success: boolean;
  executedHooks: number;
  executionTime: number;
  results: HookExecutionResult[];
  errors: HookError[];
}

export interface HookExecutionResult {
  pluginId: string;
  success: boolean;
  result: any;
  executionTime: number;
}

export interface HookError {
  pluginId: string;
  event: PluginEvent;
  error: Error;
  timestamp: Date;
}

export interface HookMiddleware {
  before?: (event: PluginEvent, data: PluginEventData) => Promise<PluginEventData>;
  after?: (event: PluginEvent, data: PluginEventData, results: HookExecutionResult[]) => Promise<void>;
}

export interface HookStatistics {
  totalHooks: number;
  hooksByEvent: Record<string, number>;
  hooksByPlugin: Record<string, number>;
  totalCalls: number;
  totalErrors: number;
  averageExecutionTime: number;
}

export interface EventHistory {
  id: string;
  event: PluginEvent;
  data: PluginEventData;
  timestamp: Date;
}