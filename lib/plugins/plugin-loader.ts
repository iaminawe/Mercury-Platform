/**
 * Plugin Loader
 * Dynamic loading and management of Mercury plugins
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { PluginManifest, PluginInstance, PluginContext, PluginSandbox } from './types';
import { PluginRegistry } from './registry';
import { PluginSandboxManager } from './sandbox';
import { PluginPermissionManager } from './permissions';
import { createPluginLogger } from './logger';

export class PluginLoader {
  private registry: PluginRegistry;
  private sandboxManager: PluginSandboxManager;
  private permissionManager: PluginPermissionManager;
  private loadedPlugins = new Map<string, PluginInstance>();
  private pluginPaths = new Map<string, string>();

  constructor(
    private pluginsDir: string,
    private config: {
      enableSandbox: boolean;
      maxMemory: number;
      maxCpuTime: number;
      allowedNetworkDomains: string[];
      enableHotReload: boolean;
    }
  ) {
    this.registry = new PluginRegistry();
    this.sandboxManager = new PluginSandboxManager(config);
    this.permissionManager = new PluginPermissionManager();
  }

  /**
   * Initialize the plugin loader
   */
  async initialize(): Promise<void> {
    await this.registry.initialize();
    await this.scanPlugins();
    
    if (this.config.enableHotReload) {
      this.watchPlugins();
    }
  }

  /**
   * Scan for available plugins
   */
  async scanPlugins(): Promise<void> {
    try {
      const entries = await readdir(this.pluginsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = join(this.pluginsDir, entry.name);
          await this.scanPlugin(pluginPath);
        }
      }
    } catch (error) {
      console.error('Failed to scan plugins directory:', error);
    }
  }

  /**
   * Scan a single plugin directory
   */
  private async scanPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = join(pluginPath, 'mercury-plugin.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate manifest
      this.validateManifest(manifest);

      // Store plugin path
      this.pluginPaths.set(manifest.id, pluginPath);

      // Register plugin
      await this.registry.register(manifest, pluginPath);

      console.log(`Discovered plugin: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      console.error(`Failed to scan plugin at ${pluginPath}:`, error);
    }
  }

  /**
   * Load a plugin by ID
   */
  async loadPlugin(pluginId: string, config: Record<string, any> = {}): Promise<PluginInstance> {
    try {
      const pluginPath = this.pluginPaths.get(pluginId);
      if (!pluginPath) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const manifest = await this.registry.getManifest(pluginId);
      if (!manifest) {
        throw new Error(`Manifest for plugin ${pluginId} not found`);
      }

      // Check permissions
      await this.permissionManager.validatePermissions(manifest.permissions);

      // Create plugin context
      const context = await this.createPluginContext(manifest, config, pluginPath);

      // Create sandbox if enabled
      let sandbox: PluginSandbox | undefined;
      if (this.config.enableSandbox) {
        sandbox = await this.sandboxManager.createSandbox(manifest);
      }

      // Load plugin module
      const mainPath = join(pluginPath, manifest.main);
      const module = await this.loadPluginModule(mainPath, sandbox);

      // Create plugin instance
      const instance: PluginInstance = {
        manifest,
        module,
        context,
        status: 'loading',
        startedAt: new Date(),
        metrics: {
          apiCalls: 0,
          errors: 0,
          execTime: 0
        }
      };

      // Initialize plugin
      if (module.initialize && typeof module.initialize === 'function') {
        const startTime = Date.now();
        try {
          await module.initialize(context);
          instance.status = 'active';
        } catch (error) {
          instance.status = 'error';
          instance.error = error as Error;
          throw error;
        } finally {
          instance.metrics.execTime += Date.now() - startTime;
        }
      } else {
        instance.status = 'active';
      }

      // Store instance
      this.loadedPlugins.set(pluginId, instance);

      // Register hooks
      await this.registerPluginHooks(instance);

      console.log(`Loaded plugin: ${manifest.name} v${manifest.version}`);
      return instance;

    } catch (error) {
      console.error(`Failed to load plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const instance = this.loadedPlugins.get(pluginId);
    if (!instance) {
      return;
    }

    try {
      // Call plugin cleanup
      if (instance.module.cleanup && typeof instance.module.cleanup === 'function') {
        await instance.module.cleanup(instance.context);
      }

      // Unregister hooks
      await this.unregisterPluginHooks(instance);

      // Clean up sandbox
      if (this.config.enableSandbox) {
        await this.sandboxManager.destroySandbox(pluginId);
      }

      // Remove instance
      this.loadedPlugins.delete(pluginId);

      console.log(`Unloaded plugin: ${instance.manifest.name}`);
    } catch (error) {
      console.error(`Error unloading plugin ${pluginId}:`, error);
    }
  }

  /**
   * Get loaded plugin instance
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Reload a plugin (for development)
   */
  async reloadPlugin(pluginId: string): Promise<PluginInstance> {
    await this.unloadPlugin(pluginId);
    
    // Clear module cache
    const pluginPath = this.pluginPaths.get(pluginId);
    if (pluginPath) {
      this.clearModuleCache(pluginPath);
    }
    
    return this.loadPlugin(pluginId);
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: PluginManifest): void {
    const required = ['id', 'name', 'version', 'main', 'mercuryVersion'];
    
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Invalid version format');
    }

    // Validate permissions
    if (manifest.permissions) {
      for (const permission of manifest.permissions) {
        if (!permission.type || !permission.resource || !permission.access) {
          throw new Error('Invalid permission format');
        }
      }
    }
  }

  /**
   * Create plugin context
   */
  private async createPluginContext(
    manifest: PluginManifest,
    config: Record<string, any>,
    pluginPath: string
  ): Promise<PluginContext> {
    const dataDir = join(pluginPath, 'data');
    const tempDir = join(pluginPath, 'temp');

    // Ensure directories exist
    await this.ensureDirectory(dataDir);
    await this.ensureDirectory(tempDir);

    return {
      plugin: {
        id: manifest.id,
        version: manifest.version,
        config,
        dataDir,
        tempDir
      },
      mercury: {
        version: process.env.MERCURY_VERSION || '1.0.0',
        store: {
          id: process.env.STORE_ID || 'default',
          platform: process.env.STORE_PLATFORM || 'shopify',
          domain: process.env.STORE_DOMAIN || 'localhost'
        },
        user: {
          id: 'system',
          role: 'admin',
          permissions: ['all']
        }
      },
      api: await this.createPluginAPI(manifest),
      logger: createPluginLogger(manifest.id)
    };
  }

  /**
   * Create plugin API interface
   */
  private async createPluginAPI(manifest: PluginManifest): Promise<any> {
    // This would be implemented with actual Mercury APIs
    // For now, return a mock interface
    return {
      store: {},
      ai: {},
      http: {},
      db: {},
      storage: {},
      events: {}
    };
  }

  /**
   * Load plugin module with optional sandbox
   */
  private async loadPluginModule(modulePath: string, sandbox?: PluginSandbox): Promise<any> {
    if (sandbox) {
      return await this.sandboxManager.loadModule(modulePath, sandbox);
    } else {
      // Clear cache and load module
      delete require.cache[resolve(modulePath)];
      return require(modulePath);
    }
  }

  /**
   * Register plugin hooks
   */
  private async registerPluginHooks(instance: PluginInstance): Promise<void> {
    for (const hook of instance.manifest.hooks || []) {
      // Register hook with Mercury's event system
      // This would integrate with the actual hook system
      console.log(`Registering hook: ${hook.event} -> ${hook.handler}`);
    }
  }

  /**
   * Unregister plugin hooks
   */
  private async unregisterPluginHooks(instance: PluginInstance): Promise<void> {
    for (const hook of instance.manifest.hooks || []) {
      // Unregister hook from Mercury's event system
      console.log(`Unregistering hook: ${hook.event} -> ${hook.handler}`);
    }
  }

  /**
   * Watch for plugin changes (hot reload)
   */
  private watchPlugins(): void {
    // Implementation would use fs.watch or chokidar
    // to watch for file changes and reload plugins
    console.log('Plugin hot reloading enabled');
  }

  /**
   * Clear Node.js module cache for a path
   */
  private clearModuleCache(pluginPath: string): void {
    const resolvedPath = resolve(pluginPath);
    Object.keys(require.cache).forEach(key => {
      if (key.startsWith(resolvedPath)) {
        delete require.cache[key];
      }
    });
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      const { mkdir } = await import('fs/promises');
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }
}