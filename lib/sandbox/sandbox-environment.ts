/**
 * Mercury Sandbox Environment
 * Secure execution environment for third-party plugins and extensions
 */

import { VM, VMScript } from 'vm2';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { z } from 'zod';

// Sandbox Configuration
export interface SandboxConfig {
  timeout: number;
  memory: number;
  allowedModules: string[];
  allowedNetworks: string[];
  maxFileSize: number;
  maxFiles: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Sandbox Resource Limits
export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxExecutionTime: number;
  maxNetworkRequests: number;
  maxFileOperations: number;
}

// Sandbox Execution Context
export interface SandboxContext {
  id: string;
  pluginId: string;
  userId: string;
  permissions: string[];
  limits: ResourceLimits;
  environment: 'development' | 'staging' | 'production';
  metadata: Record<string, any>;
}

// Sandbox Execution Result
export interface SandboxResult {
  success: boolean;
  result?: any;
  error?: string;
  logs: string[];
  stats: {
    executionTime: number;
    memoryUsed: number;
    cpuUsed: number;
    networkRequests: number;
    fileOperations: number;
  };
}

// Sandbox Security Policy
export interface SecurityPolicy {
  allowFileSystem: boolean;
  allowNetwork: boolean;
  allowChildProcess: boolean;
  allowedDomains: string[];
  allowedPorts: number[];
  maxRequestSize: number;
  maxResponseSize: number;
}

export class SandboxEnvironment extends EventEmitter {
  private activeContexts: Map<string, SandboxContext> = new Map();
  private resourceUsage: Map<string, ResourceLimits> = new Map();
  private securityPolicies: Map<string, SecurityPolicy> = new Map();

  constructor(private defaultConfig: SandboxConfig) {
    super();
    this.setupDefaultPolicies();
  }

  /**
   * Create a new sandbox context
   */
  async createContext(context: SandboxContext): Promise<string> {
    // Validate context
    this.validateContext(context);
    
    // Check if context already exists
    if (this.activeContexts.has(context.id)) {
      throw new Error(`Sandbox context already exists: ${context.id}`);
    }

    // Initialize resource tracking
    this.resourceUsage.set(context.id, {
      maxMemory: context.limits.maxMemory,
      maxCpu: context.limits.maxCpu,
      maxExecutionTime: context.limits.maxExecutionTime,
      maxNetworkRequests: context.limits.maxNetworkRequests,
      maxFileOperations: context.limits.maxFileOperations
    });

    // Set security policy
    this.setSecurityPolicy(context.id, context.environment, context.permissions);
    
    // Store context
    this.activeContexts.set(context.id, context);
    
    this.emit('context:created', { contextId: context.id, pluginId: context.pluginId });
    
    return context.id;
  }

  /**
   * Execute code in sandbox
   */
  async executeCode(
    contextId: string, 
    code: string, 
    input?: any
  ): Promise<SandboxResult> {
    const context = this.activeContexts.get(contextId);
    if (!context) {
      throw new Error(`Sandbox context not found: ${contextId}`);
    }

    const startTime = Date.now();
    const logs: string[] = [];
    let vm: VM | null = null;

    try {
      // Create VM with security restrictions
      vm = new VM({
        timeout: context.limits.maxExecutionTime,
        sandbox: this.createSandbox(contextId, logs, input),
        require: {
          external: this.defaultConfig.allowedModules,
          builtin: this.getAllowedBuiltins(contextId),
          root: this.getSandboxRoot(contextId),
          mock: this.getMockModules(contextId)
        },
        eval: false,
        wasm: false
      });

      // Execute code
      const result = await vm.run(code);
      
      const executionTime = Date.now() - startTime;
      
      // Collect resource usage stats
      const stats = this.collectStats(contextId, executionTime);
      
      this.emit('execution:success', { 
        contextId, 
        executionTime, 
        memoryUsed: stats.memoryUsed 
      });

      return {
        success: true,
        result,
        logs,
        stats
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const stats = this.collectStats(contextId, executionTime);
      
      this.emit('execution:error', { 
        contextId, 
        error: error.message, 
        executionTime 
      });

      return {
        success: false,
        error: error.message,
        logs,
        stats
      };
    } finally {
      // Cleanup VM
      if (vm) {
        try {
          vm = null;
        } catch (e) {
          // VM cleanup error - log but don't throw
          console.warn('VM cleanup error:', e.message);
        }
      }
    }
  }

  /**
   * Execute file in sandbox
   */
  async executeFile(
    contextId: string, 
    filePath: string, 
    input?: any
  ): Promise<SandboxResult> {
    try {
      // Security check: validate file path
      this.validateFilePath(contextId, filePath);
      
      // Read file content
      const code = await fs.readFile(filePath, 'utf-8');
      
      // Check file size limit
      if (code.length > this.defaultConfig.maxFileSize) {
        throw new Error(`File size exceeds limit: ${code.length} bytes`);
      }
      
      return await this.executeCode(contextId, code, input);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        logs: [],
        stats: {
          executionTime: 0,
          memoryUsed: 0,
          cpuUsed: 0,
          networkRequests: 0,
          fileOperations: 1
        }
      };
    }
  }

  /**
   * Destroy sandbox context
   */
  async destroyContext(contextId: string): Promise<void> {
    const context = this.activeContexts.get(contextId);
    if (!context) {
      throw new Error(`Sandbox context not found: ${contextId}`);
    }

    // Cleanup resources
    this.activeContexts.delete(contextId);
    this.resourceUsage.delete(contextId);
    this.securityPolicies.delete(contextId);
    
    // Cleanup sandbox directory
    await this.cleanupSandboxDirectory(contextId);
    
    this.emit('context:destroyed', { contextId });
  }

  /**
   * Get context information
   */
  getContext(contextId: string): SandboxContext | undefined {
    return this.activeContexts.get(contextId);
  }

  /**
   * List active contexts
   */
  listContexts(): SandboxContext[] {
    return Array.from(this.activeContexts.values());
  }

  /**
   * Get resource usage for context
   */
  getResourceUsage(contextId: string): ResourceLimits | undefined {
    return this.resourceUsage.get(contextId);
  }

  /**
   * Update resource limits for context
   */
  updateResourceLimits(contextId: string, limits: Partial<ResourceLimits>): void {
    const current = this.resourceUsage.get(contextId);
    if (!current) {
      throw new Error(`Sandbox context not found: ${contextId}`);
    }

    this.resourceUsage.set(contextId, { ...current, ...limits });
    
    this.emit('limits:updated', { contextId, limits });
  }

  /**
   * Private: Create sandbox environment
   */
  private createSandbox(contextId: string, logs: string[], input?: any): any {
    const context = this.activeContexts.get(contextId)!;
    const policy = this.securityPolicies.get(contextId)!;

    return {
      // Standard globals
      console: this.createSecureConsole(logs),
      setTimeout: this.createSecureTimeout(context.limits.maxExecutionTime),
      setInterval: this.createSecureInterval(context.limits.maxExecutionTime),
      clearTimeout,
      clearInterval,
      
      // Input data
      input,
      
      // Mercury API
      mercury: this.createMercuryAPI(contextId),
      
      // Secure HTTP client
      fetch: policy.allowNetwork ? this.createSecureFetch(contextId) : undefined,
      
      // Secure file system (if allowed)
      fs: policy.allowFileSystem ? this.createSecureFS(contextId) : undefined,
      
      // Buffer and basic utilities
      Buffer,
      JSON,
      Math,
      Date,
      RegExp,
      
      // Plugin metadata
      __mercury: {
        contextId,
        pluginId: context.pluginId,
        userId: context.userId,
        permissions: context.permissions,
        environment: context.environment
      }
    };
  }

  /**
   * Private: Create secure console
   */
  private createSecureConsole(logs: string[]): Console {
    return {
      log: (...args) => logs.push(`[LOG] ${args.join(' ')}`),
      info: (...args) => logs.push(`[INFO] ${args.join(' ')}`),
      warn: (...args) => logs.push(`[WARN] ${args.join(' ')}`),
      error: (...args) => logs.push(`[ERROR] ${args.join(' ')}`),
      debug: (...args) => logs.push(`[DEBUG] ${args.join(' ')}`),
      trace: (...args) => logs.push(`[TRACE] ${args.join(' ')}`),
    } as Console;
  }

  /**
   * Private: Create secure timeout
   */
  private createSecureTimeout(maxTime: number) {
    return (callback: Function, delay: number) => {
      if (delay > maxTime) {
        throw new Error(`Timeout exceeds maximum allowed: ${delay}ms > ${maxTime}ms`);
      }
      return setTimeout(callback, delay);
    };
  }

  /**
   * Private: Create secure interval
   */
  private createSecureInterval(maxTime: number) {
    return (callback: Function, delay: number) => {
      if (delay > maxTime) {
        throw new Error(`Interval exceeds maximum allowed: ${delay}ms > ${maxTime}ms`);
      }
      return setInterval(callback, delay);
    };
  }

  /**
   * Private: Create Mercury API
   */
  private createMercuryAPI(contextId: string): any {
    const context = this.activeContexts.get(contextId)!;
    
    return {
      // Plugin-specific APIs based on permissions
      store: context.permissions.includes('store:read') ? {
        get: (id: string) => this.callMercuryAPI(contextId, 'store.get', { id }),
        list: (params?: any) => this.callMercuryAPI(contextId, 'store.list', params),
        create: context.permissions.includes('store:write') 
          ? (data: any) => this.callMercuryAPI(contextId, 'store.create', data)
          : undefined,
        update: context.permissions.includes('store:write')
          ? (id: string, data: any) => this.callMercuryAPI(contextId, 'store.update', { id, data })
          : undefined
      } : undefined,
      
      products: context.permissions.includes('products:read') ? {
        get: (id: string) => this.callMercuryAPI(contextId, 'products.get', { id }),
        list: (params?: any) => this.callMercuryAPI(contextId, 'products.list', params),
        search: (query: string) => this.callMercuryAPI(contextId, 'products.search', { query }),
        create: context.permissions.includes('products:write')
          ? (data: any) => this.callMercuryAPI(contextId, 'products.create', data)
          : undefined,
        update: context.permissions.includes('products:write')
          ? (id: string, data: any) => this.callMercuryAPI(contextId, 'products.update', { id, data })
          : undefined
      } : undefined,
      
      analytics: context.permissions.includes('analytics:read') ? {
        get: (metric: string, params?: any) => this.callMercuryAPI(contextId, 'analytics.get', { metric, params }),
        query: (query: any) => this.callMercuryAPI(contextId, 'analytics.query', query)
      } : undefined,
      
      // Event system
      emit: (event: string, data: any) => this.callMercuryAPI(contextId, 'events.emit', { event, data }),
      on: (event: string, callback: Function) => this.registerEventHandler(contextId, event, callback),
      
      // Storage
      storage: {
        get: (key: string) => this.callMercuryAPI(contextId, 'storage.get', { key }),
        set: (key: string, value: any) => this.callMercuryAPI(contextId, 'storage.set', { key, value }),
        delete: (key: string) => this.callMercuryAPI(contextId, 'storage.delete', { key })
      }
    };
  }

  /**
   * Private: Create secure fetch
   */
  private createSecureFetch(contextId: string) {
    const policy = this.securityPolicies.get(contextId)!;
    
    return async (url: string, options?: RequestInit) => {
      // Validate URL
      const urlObj = new URL(url);
      
      if (!policy.allowedDomains.includes(urlObj.hostname)) {
        throw new Error(`Domain not allowed: ${urlObj.hostname}`);
      }
      
      if (policy.allowedPorts.length > 0 && !policy.allowedPorts.includes(parseInt(urlObj.port) || 80)) {
        throw new Error(`Port not allowed: ${urlObj.port}`);
      }
      
      // Track network request
      this.trackNetworkRequest(contextId);
      
      // Add security headers
      const secureOptions = {
        ...options,
        headers: {
          ...options?.headers,
          'User-Agent': `Mercury-Sandbox/${contextId}`
        }
      };
      
      return fetch(url, secureOptions);
    };
  }

  /**
   * Private: Create secure file system
   */
  private createSecureFS(contextId: string): any {
    const sandboxRoot = this.getSandboxRoot(contextId);
    
    return {
      readFile: async (filePath: string) => {
        const safePath = this.validateAndResolvePath(contextId, filePath);
        this.trackFileOperation(contextId);
        return fs.readFile(safePath, 'utf-8');
      },
      
      writeFile: async (filePath: string, content: string) => {
        const safePath = this.validateAndResolvePath(contextId, filePath);
        this.trackFileOperation(contextId);
        
        if (content.length > this.defaultConfig.maxFileSize) {
          throw new Error(`File size exceeds limit: ${content.length} bytes`);
        }
        
        return fs.writeFile(safePath, content);
      },
      
      exists: async (filePath: string) => {
        const safePath = this.validateAndResolvePath(contextId, filePath);
        try {
          await fs.access(safePath);
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  /**
   * Private: Validate sandbox context
   */
  private validateContext(context: SandboxContext): void {
    const schema = z.object({
      id: z.string().min(1),
      pluginId: z.string().min(1),
      userId: z.string().min(1),
      permissions: z.array(z.string()),
      limits: z.object({
        maxMemory: z.number().positive(),
        maxCpu: z.number().positive(),
        maxExecutionTime: z.number().positive(),
        maxNetworkRequests: z.number().nonnegative(),
        maxFileOperations: z.number().nonnegative()
      }),
      environment: z.enum(['development', 'staging', 'production']),
      metadata: z.record(z.any())
    });

    schema.parse(context);
  }

  /**
   * Private: Set security policy
   */
  private setSecurityPolicy(
    contextId: string, 
    environment: string, 
    permissions: string[]
  ): void {
    const policy: SecurityPolicy = {
      allowFileSystem: permissions.includes('filesystem'),
      allowNetwork: permissions.includes('network'),
      allowChildProcess: false, // Never allow child processes
      allowedDomains: this.getAllowedDomains(permissions),
      allowedPorts: [80, 443], // Only HTTP/HTTPS
      maxRequestSize: 1024 * 1024, // 1MB
      maxResponseSize: 10 * 1024 * 1024 // 10MB
    };

    this.securityPolicies.set(contextId, policy);
  }

  /**
   * Private: Get allowed domains for permissions
   */
  private getAllowedDomains(permissions: string[]): string[] {
    const domains = ['api.mercury.com']; // Always allow Mercury API
    
    if (permissions.includes('external_api')) {
      domains.push('api.stripe.com', 'api.mailgun.net', 'api.sendgrid.com');
    }
    
    return domains;
  }

  /**
   * Private: Get allowed builtin modules
   */
  private getAllowedBuiltins(contextId: string): string[] {
    const context = this.activeContexts.get(contextId)!;
    const builtins = ['crypto', 'url', 'querystring'];
    
    if (context.permissions.includes('buffer')) {
      builtins.push('buffer');
    }
    
    return builtins;
  }

  /**
   * Private: Get sandbox root directory
   */
  private getSandboxRoot(contextId: string): string {
    return path.join(process.cwd(), 'sandbox', contextId);
  }

  /**
   * Private: Get mock modules
   */
  private getMockModules(contextId: string): Record<string, any> {
    return {
      'process': {
        env: { NODE_ENV: 'sandbox' },
        version: process.version,
        versions: process.versions
      }
    };
  }

  /**
   * Private: Validate file path
   */
  private validateFilePath(contextId: string, filePath: string): void {
    const sandboxRoot = this.getSandboxRoot(contextId);
    const resolvedPath = path.resolve(sandboxRoot, filePath);
    
    if (!resolvedPath.startsWith(sandboxRoot)) {
      throw new Error('File path outside sandbox directory');
    }
  }

  /**
   * Private: Validate and resolve path
   */
  private validateAndResolvePath(contextId: string, filePath: string): string {
    this.validateFilePath(contextId, filePath);
    return path.resolve(this.getSandboxRoot(contextId), filePath);
  }

  /**
   * Private: Track network request
   */
  private trackNetworkRequest(contextId: string): void {
    const usage = this.resourceUsage.get(contextId)!;
    if (usage.maxNetworkRequests <= 0) {
      throw new Error('Network request limit exceeded');
    }
    usage.maxNetworkRequests--;
  }

  /**
   * Private: Track file operation
   */
  private trackFileOperation(contextId: string): void {
    const usage = this.resourceUsage.get(contextId)!;
    if (usage.maxFileOperations <= 0) {
      throw new Error('File operation limit exceeded');
    }
    usage.maxFileOperations--;
  }

  /**
   * Private: Collect execution stats
   */
  private collectStats(contextId: string, executionTime: number): SandboxResult['stats'] {
    const limits = this.resourceUsage.get(contextId)!;
    
    return {
      executionTime,
      memoryUsed: process.memoryUsage().heapUsed, // Approximate
      cpuUsed: 0, // Would need more sophisticated tracking
      networkRequests: limits.maxNetworkRequests,
      fileOperations: limits.maxFileOperations
    };
  }

  /**
   * Private: Call Mercury API
   */
  private async callMercuryAPI(contextId: string, method: string, params: any): Promise<any> {
    // In production, this would make actual API calls
    // For now, return mock data
    return { success: true, method, params, contextId };
  }

  /**
   * Private: Register event handler
   */
  private registerEventHandler(contextId: string, event: string, callback: Function): void {
    // In production, this would register with the event system
    this.emit('event:registered', { contextId, event });
  }

  /**
   * Private: Setup default security policies
   */
  private setupDefaultPolicies(): void {
    // Default policies are set per context
  }

  /**
   * Private: Cleanup sandbox directory
   */
  private async cleanupSandboxDirectory(contextId: string): Promise<void> {
    const sandboxRoot = this.getSandboxRoot(contextId);
    try {
      await fs.rm(sandboxRoot, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup sandbox directory: ${error.message}`);
    }
  }
}

// Export singleton instance
export const sandboxEnvironment = new SandboxEnvironment({
  timeout: 30000, // 30 seconds
  memory: 128 * 1024 * 1024, // 128MB
  allowedModules: ['lodash', 'moment', 'axios'],
  allowedNetworks: ['api.mercury.com'],
  maxFileSize: 1024 * 1024, // 1MB
  maxFiles: 100,
  enableLogging: true,
  logLevel: 'info'
});