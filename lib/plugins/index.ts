/**
 * Mercury Plugin System
 * Main entry point for the plugin architecture
 */

import { PluginLoader } from './plugin-loader';
import { PluginRegistry } from './registry';
import { PluginSandboxManager } from './sandbox';
import { PluginPermissionManager } from './permissions';
import { PluginHookManager, HookLifecycleManager } from './hooks';
import { PluginLogAggregator } from './logger';
import { 
  PluginManifest, 
  PluginInstance, 
  PluginContext,
  PluginEvent,
  PluginEventData,
  PluginInstallation
} from './types';

export class MercuryPluginSystem {
  private loader: PluginLoader;
  private registry: PluginRegistry;
  private sandboxManager: PluginSandboxManager;
  private permissionManager: PluginPermissionManager;
  private hookManager: PluginHookManager;
  private lifecycleManager: HookLifecycleManager;
  private logAggregator: PluginLogAggregator;
  
  private initialized = false;
  private config: PluginSystemConfig;

  constructor(config: Partial<PluginSystemConfig> = {}) {
    this.config = {
      pluginsDir: config.pluginsDir || './plugins',
      enableSandbox: config.enableSandbox !== false,
      maxMemory: config.maxMemory || 128 * 1024 * 1024, // 128MB
      maxCpuTime: config.maxCpuTime || 30000, // 30s
      allowedNetworkDomains: config.allowedNetworkDomains || [
        'api.shopify.com',
        'api.stripe.com',
        'hooks.zapier.com'
      ],
      enableHotReload: config.enableHotReload !== false,
      enableMetrics: config.enableMetrics !== false,
      enableLogging: config.enableLogging !== false
    };

    this.initializeComponents();
  }

  /**
   * Initialize the plugin system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Mercury Plugin System...');

    try {
      // Initialize components in order
      await this.registry.initialize();
      await this.loader.initialize();
      
      // Register built-in hooks
      this.lifecycleManager.registerBuiltInHooks();
      
      // Auto-load installed plugins
      await this.autoLoadPlugins();
      
      this.initialized = true;
      console.log('Mercury Plugin System initialized successfully');
      
      // Emit system ready event
      await this.emitEvent('system.ready', {
        timestamp: new Date(),
        data: { config: this.config }
      });

    } catch (error) {
      console.error('Failed to initialize Mercury Plugin System:', error);
      throw error;
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(
    pluginPath: string, 
    config: Record<string, any> = {},
    options: { autoActivate?: boolean } = {}
  ): Promise<PluginInstallation> {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      // Load plugin manifest
      const manifestPath = require('path').join(pluginPath, 'mercury-plugin.json');
      const manifestContent = await require('fs/promises').readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Register plugin
      await this.registry.register(manifest, pluginPath);

      // Install plugin
      const installation = await this.registry.installPlugin(
        manifest.id,
        manifest.version,
        config
      );

      // Auto-activate if requested
      if (options.autoActivate) {
        await this.activatePlugin(manifest.id);
      }

      // Emit installation event
      await this.emitEvent('plugin.installed', {
        timestamp: new Date(),
        plugin: manifest.id,
        data: { manifest, installation }
      });

      return installation;

    } catch (error) {
      console.error(`Failed to install plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string, config?: Record<string, any>): Promise<PluginInstance> {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      // Update installation status
      await this.registry.updateInstallation(pluginId, { status: 'active' });

      // Load plugin
      const instance = await this.loader.loadPlugin(pluginId, config);

      // Emit activation event
      await this.emitEvent('plugin.activated', {
        timestamp: new Date(),
        plugin: pluginId,
        data: { instance }
      });

      return instance;

    } catch (error) {
      // Update installation status to error
      await this.registry.updateInstallation(pluginId, { status: 'error' });
      
      // Emit error event
      await this.emitEvent('plugin.error', {
        timestamp: new Date(),
        plugin: pluginId,
        data: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      // Unload plugin
      await this.loader.unloadPlugin(pluginId);

      // Update installation status
      await this.registry.updateInstallation(pluginId, { status: 'inactive' });

      // Emit deactivation event
      await this.emitEvent('plugin.deactivated', {
        timestamp: new Date(),
        plugin: pluginId,
        data: {}
      });

    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      // Deactivate if active
      const instance = this.loader.getPlugin(pluginId);
      if (instance && instance.status === 'active') {
        await this.deactivatePlugin(pluginId);
      }

      // Uninstall from registry
      await this.registry.uninstallPlugin(pluginId);
      await this.registry.unregister(pluginId);

      // Emit uninstallation event
      await this.emitEvent('plugin.uninstalled', {
        timestamp: new Date(),
        plugin: pluginId,
        data: {}
      });

    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Update a plugin
   */
  async updatePlugin(pluginId: string, newVersion: string): Promise<PluginInstance> {
    if (!this.initialized) {
      throw new Error('Plugin system not initialized');
    }

    try {
      const wasActive = this.loader.getPlugin(pluginId)?.status === 'active';

      // Deactivate current version
      if (wasActive) {
        await this.deactivatePlugin(pluginId);
      }

      // Update registry
      await this.registry.updateInstallation(pluginId, { 
        version: newVersion,
        status: 'inactive'
      });

      // Reactivate if it was active
      let instance: PluginInstance | undefined;
      if (wasActive) {
        instance = await this.activatePlugin(pluginId);
      }

      // Emit update event
      await this.emitEvent('plugin.updated', {
        timestamp: new Date(),
        plugin: pluginId,
        data: { newVersion, instance }
      });

      return instance!;

    } catch (error) {
      console.error(`Failed to update plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.loader.getPlugin(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginInstance[] {
    return this.loader.getLoadedPlugins();
  }

  /**
   * Get plugin manifest
   */
  getPluginManifest(pluginId: string): PluginManifest | undefined {
    return this.registry.getManifest(pluginId);
  }

  /**
   * Search plugins
   */
  searchPlugins(query: string): PluginManifest[] {
    return this.registry.searchPlugins(query);
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: string): PluginManifest[] {
    return this.registry.getPluginsByCategory(category);
  }

  /**
   * Emit an event to the hook system
   */
  async emitEvent(event: PluginEvent, data: PluginEventData): Promise<void> {
    if (this.config.enableLogging) {
      console.log(`Plugin event: ${event}`, data);
    }

    try {
      await this.hookManager.emit(event, data);
    } catch (error) {
      console.error(`Failed to emit event ${event}:`, error);
    }
  }

  /**
   * Get system statistics
   */
  getSystemStatistics(): PluginSystemStatistics {
    const pluginStats = this.registry.getStatistics();
    const hookStats = this.hookManager.getHookStatistics();
    const loadedPlugins = this.loader.getLoadedPlugins();

    return {
      plugins: pluginStats,
      hooks: hookStats,
      memory: {
        totalPlugins: loadedPlugins.length,
        activePlugins: loadedPlugins.filter(p => p.status === 'active').length,
        errorPlugins: loadedPlugins.filter(p => p.status === 'error').length
      },
      performance: {
        totalApiCalls: loadedPlugins.reduce((sum, p) => sum + p.metrics.apiCalls, 0),
        totalErrors: loadedPlugins.reduce((sum, p) => sum + p.metrics.errors, 0),
        averageExecTime: loadedPlugins.reduce((sum, p) => sum + p.metrics.execTime, 0) / loadedPlugins.length || 0
      }
    };
  }

  /**
   * Check for plugin updates
   */
  async checkForUpdates(): Promise<Array<{
    pluginId: string;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
  }>> {
    return this.registry.checkForUpdates();
  }

  /**
   * Create system backup
   */
  async createBackup(): Promise<string> {
    return this.registry.createBackup();
  }

  /**
   * Shutdown the plugin system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('Shutting down Mercury Plugin System...');

    try {
      // Deactivate all plugins
      const loadedPlugins = this.loader.getLoadedPlugins();
      for (const plugin of loadedPlugins) {
        if (plugin.status === 'active') {
          await this.deactivatePlugin(plugin.manifest.id);
        }
      }

      // Emit shutdown event
      await this.emitEvent('system.shutdown', {
        timestamp: new Date(),
        data: {}
      });

      this.initialized = false;
      console.log('Mercury Plugin System shut down successfully');

    } catch (error) {
      console.error('Error during plugin system shutdown:', error);
    }
  }

  /**
   * Initialize system components
   */
  private initializeComponents(): void {
    this.registry = new PluginRegistry();
    this.sandboxManager = new PluginSandboxManager(this.config);
    this.permissionManager = new PluginPermissionManager();
    this.hookManager = new PluginHookManager();
    this.lifecycleManager = new HookLifecycleManager(this.hookManager);
    this.loader = new PluginLoader(this.config.pluginsDir, this.config);
    this.logAggregator = new PluginLogAggregator();
  }

  /**
   * Auto-load installed and active plugins
   */
  private async autoLoadPlugins(): Promise<void> {
    const installations = this.registry.getAllInstallations();
    const activeInstallations = installations.filter(i => i.status === 'active');

    for (const installation of activeInstallations) {
      try {
        await this.loader.loadPlugin(installation.pluginId, installation.config);
        console.log(`Auto-loaded plugin: ${installation.pluginId}`);
      } catch (error) {
        console.error(`Failed to auto-load plugin ${installation.pluginId}:`, error);
        
        // Update status to error
        await this.registry.updateInstallation(installation.pluginId, { status: 'error' });
      }
    }
  }
}

// Re-export types and utilities
export * from './types';
export * from './hooks';
export * from './logger';
export { PluginRegistry } from './registry';
export { PluginLoader } from './plugin-loader';
export { PluginPermissionManager } from './permissions';

// Configuration interface
export interface PluginSystemConfig {
  pluginsDir: string;
  enableSandbox: boolean;
  maxMemory: number;
  maxCpuTime: number;
  allowedNetworkDomains: string[];
  enableHotReload: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
}

// Statistics interface
export interface PluginSystemStatistics {
  plugins: {
    total: number;
    installed: number;
    active: number;
    byCategory: Record<string, number>;
  };
  hooks: {
    totalHooks: number;
    hooksByEvent: Record<string, number>;
    hooksByPlugin: Record<string, number>;
    totalCalls: number;
    totalErrors: number;
    averageExecutionTime: number;
  };
  memory: {
    totalPlugins: number;
    activePlugins: number;
    errorPlugins: number;
  };
  performance: {
    totalApiCalls: number;
    totalErrors: number;
    averageExecTime: number;
  };
}

// Default plugin system instance
let defaultInstance: MercuryPluginSystem | null = null;

/**
 * Get or create the default plugin system instance
 */
export function getPluginSystem(config?: Partial<PluginSystemConfig>): MercuryPluginSystem {
  if (!defaultInstance || config) {
    defaultInstance = new MercuryPluginSystem(config);
  }
  return defaultInstance;
}

/**
 * Initialize the default plugin system
 */
export async function initializePluginSystem(config?: Partial<PluginSystemConfig>): Promise<MercuryPluginSystem> {
  const system = getPluginSystem(config);
  await system.initialize();
  return system;
}