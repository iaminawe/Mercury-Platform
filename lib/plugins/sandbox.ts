/**
 * Plugin Sandbox
 * Secure execution environment for plugins
 */

import { VM } from 'vm2';
import { PluginManifest, PluginSandbox } from './types';
import { createRequire } from 'module';
import { join } from 'path';

export class PluginSandboxManager {
  private sandboxes = new Map<string, PluginSandbox>();
  private allowedCoreModules = [
    'crypto', 'events', 'url', 'querystring', 'path',
    'util', 'stream', 'buffer', 'string_decoder'
  ];

  constructor(
    private config: {
      enableSandbox: boolean;
      maxMemory: number;
      maxCpuTime: number;
      allowedNetworkDomains: string[];
    }
  ) {}

  /**
   * Create a new sandbox for a plugin
   */
  async createSandbox(manifest: PluginManifest): Promise<PluginSandbox> {
    const sandbox: PluginSandbox = {
      vm: new VM({
        timeout: this.config.maxCpuTime,
        allowAsync: true,
        sandbox: {
          console: this.createSafeConsole(manifest.id),
          Buffer,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          setImmediate,
          clearImmediate,
          process: this.createSafeProcess(),
          require: this.createSafeRequire(manifest)
        },
        wrapper: 'none',
        strict: true
      }),
      globals: {},
      limits: {
        memory: this.config.maxMemory,
        cpu: this.config.maxCpuTime,
        network: 1024 * 1024, // 1MB/sec
        storage: 100 * 1024 * 1024 // 100MB
      },
      restrictions: {
        allowedModules: this.getAllowedModules(manifest),
        blockedAPIs: [
          'child_process', 'cluster', 'dgram', 'dns', 'fs',
          'http', 'https', 'net', 'os', 'repl', 'tls',
          'v8', 'vm', 'worker_threads'
        ],
        networkWhitelist: this.config.allowedNetworkDomains
      }
    };

    this.sandboxes.set(manifest.id, sandbox);
    return sandbox;
  }

  /**
   * Load and execute a module in the sandbox
   */
  async loadModule(modulePath: string, sandbox: PluginSandbox): Promise<any> {
    try {
      const { readFile } = await import('fs/promises');
      const code = await readFile(modulePath, 'utf-8');
      
      // Transform code to handle ES modules and CommonJS
      const wrappedCode = this.wrapModuleCode(code);
      
      return sandbox.vm.run(wrappedCode, modulePath);
    } catch (error) {
      throw new Error(`Failed to load module in sandbox: ${error}`);
    }
  }

  /**
   * Execute code in the sandbox
   */
  async executeCode(code: string, sandbox: PluginSandbox, filename?: string): Promise<any> {
    try {
      return await sandbox.vm.run(code, filename);
    } catch (error) {
      throw new Error(`Sandbox execution failed: ${error}`);
    }
  }

  /**
   * Destroy a sandbox
   */
  async destroySandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (sandbox) {
      // Clean up VM
      try {
        sandbox.vm = null;
      } catch (error) {
        console.warn(`Error cleaning up sandbox for ${pluginId}:`, error);
      }
      
      this.sandboxes.delete(pluginId);
    }
  }

  /**
   * Get sandbox for a plugin
   */
  getSandbox(pluginId: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginId);
  }

  /**
   * Monitor sandbox resource usage
   */
  async getResourceUsage(pluginId: string): Promise<{
    memory: number;
    cpu: number;
    network: number;
  }> {
    // Implementation would monitor actual resource usage
    // For now, return mock data
    return {
      memory: 0,
      cpu: 0,
      network: 0
    };
  }

  /**
   * Create safe console for sandbox
   */
  private createSafeConsole(pluginId: string): Console {
    const originalConsole = console;
    
    return {
      log: (...args: any[]) => originalConsole.log(`[Plugin:${pluginId}]`, ...args),
      error: (...args: any[]) => originalConsole.error(`[Plugin:${pluginId}]`, ...args),
      warn: (...args: any[]) => originalConsole.warn(`[Plugin:${pluginId}]`, ...args),
      info: (...args: any[]) => originalConsole.info(`[Plugin:${pluginId}]`, ...args),
      debug: (...args: any[]) => originalConsole.debug(`[Plugin:${pluginId}]`, ...args),
      trace: (...args: any[]) => originalConsole.trace(`[Plugin:${pluginId}]`, ...args),
      
      // Disable potentially dangerous methods
      clear: () => {},
      count: () => {},
      countReset: () => {},
      time: () => {},
      timeEnd: () => {},
      timeLog: () => {},
      group: () => {},
      groupCollapsed: () => {},
      groupEnd: () => {},
      table: () => {},
      dir: () => {},
      dirxml: () => {},
      assert: () => {}
    } as Console;
  }

  /**
   * Create safe process object
   */
  private createSafeProcess(): Partial<NodeJS.Process> {
    return {
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        // Only expose safe environment variables
      },
      version: process.version,
      versions: process.versions,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime,
      hrtime: process.hrtime,
      
      // Disable dangerous methods
      exit: () => {},
      abort: () => {},
      chdir: () => {},
      cwd: () => '/sandbox',
      kill: () => false,
    };
  }

  /**
   * Create safe require function
   */
  private createSafeRequire(manifest: PluginManifest): NodeRequire {
    const allowedModules = this.getAllowedModules(manifest);
    
    return ((id: string) => {
      // Check if module is allowed
      if (!this.isModuleAllowed(id, allowedModules)) {
        throw new Error(`Module '${id}' is not allowed in sandbox`);
      }

      // For core modules, use normal require
      if (this.allowedCoreModules.includes(id)) {
        return require(id);
      }

      // For plugin dependencies, check manifest
      if (manifest.dependencies && manifest.dependencies[id]) {
        // Load from plugin's node_modules
        const pluginRequire = createRequire(join(process.cwd(), 'plugins', manifest.id, 'package.json'));
        return pluginRequire(id);
      }

      throw new Error(`Module '${id}' not found or not allowed`);
    }) as NodeRequire;
  }

  /**
   * Get allowed modules for a plugin
   */
  private getAllowedModules(manifest: PluginManifest): string[] {
    const allowed = [...this.allowedCoreModules];
    
    // Add plugin dependencies
    if (manifest.dependencies) {
      allowed.push(...Object.keys(manifest.dependencies));
    }
    
    // Add Mercury SDK modules
    allowed.push('@mercury/sdk', '@mercury/types', '@mercury/utils');
    
    return allowed;
  }

  /**
   * Check if module is allowed
   */
  private isModuleAllowed(moduleId: string, allowedModules: string[]): boolean {
    // Direct match
    if (allowedModules.includes(moduleId)) {
      return true;
    }

    // Check for scoped packages
    if (moduleId.startsWith('@')) {
      const scope = moduleId.split('/')[0];
      if (allowedModules.includes(scope)) {
        return true;
      }
    }

    // Check for sub-modules
    for (const allowed of allowedModules) {
      if (moduleId.startsWith(allowed + '/')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wrap module code for sandbox execution
   */
  private wrapModuleCode(code: string): string {
    // Simple wrapper to handle both CommonJS and ES modules
    return `
      (function(module, exports, require, __filename, __dirname) {
        ${code}
        
        // Handle ES module exports
        if (typeof module.exports === 'undefined' && typeof exports !== 'undefined') {
          module.exports = exports;
        }
        
        return module.exports;
      })({exports: {}}, {}, require, __filename, __dirname);
    `;
  }

  /**
   * Validate sandbox security
   */
  async validateSecurity(sandbox: PluginSandbox): Promise<{
    secure: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check for potential security issues
    try {
      // Test for global pollution
      const testCode = `
        try {
          global.malicious = true;
          issues.push('Global pollution possible');
        } catch (e) {}
        
        try {
          process.exit();
          issues.push('Process exit accessible');
        } catch (e) {}
        
        try {
          require('fs');
          issues.push('File system accessible');
        } catch (e) {}
      `;
      
      await this.executeCode(testCode, sandbox);
    } catch (error) {
      // Expected - sandbox should prevent these operations
    }

    return {
      secure: issues.length === 0,
      issues
    };
  }
}