/**
 * Mercury Plugin Manager
 * Handles plugin lifecycle, loading, and management
 */

import { 
  Plugin,
  PluginManifest,
  PluginConfig,
  PluginHooks,
  PluginError,
  MercuryError
} from './types';

export class PluginManager {
  private sdk: any; // Reference to main SDK
  private plugins: Map<string, PluginManifest> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private hooks: Map<string, Set<Function>> = new Map();
  private pluginConfigs: Map<string, PluginConfig> = new Map();

  constructor(sdk: any) {
    this.sdk = sdk;
    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    // Register default plugin lifecycle hooks
    this.registerHook('plugin:beforeInstall', this.validatePluginDependencies.bind(this));
    this.registerHook('plugin:afterInstall', this.notifyPluginInstalled.bind(this));
    this.registerHook('plugin:beforeUninstall', this.cleanupPluginData.bind(this));
    this.registerHook('plugin:afterUninstall', this.notifyPluginUninstalled.bind(this));
  }

  // Plugin Installation and Management
  public async installPlugin(plugin: Plugin, config?: PluginConfig): Promise<void> {
    try {
      await this.executeHook('plugin:beforeInstall', { plugin, config });

      // Validate plugin structure
      this.validatePlugin(plugin);

      // Check for conflicts
      await this.checkPluginConflicts(plugin);

      // Install dependencies
      await this.installDependencies(plugin);

      // Store plugin configuration
      if (config) {
        this.pluginConfigs.set(plugin.id, config);
      }

      // Execute plugin installation hook
      if (plugin.hooks.onInstall) {
        await plugin.hooks.onInstall();
      }

      // Create plugin manifest
      const manifest: PluginManifest = {
        plugin,
        metadata: {
          installDate: new Date(),
          isActive: false,
          configSchema: this.extractConfigSchema(plugin)
        }
      };

      this.plugins.set(plugin.id, manifest);

      await this.executeHook('plugin:afterInstall', { plugin, manifest });

      console.log(`Plugin ${plugin.name} (${plugin.id}) installed successfully`);
    } catch (error) {
      throw new PluginError(
        `Failed to install plugin ${plugin.name}`,
        'PLUGIN_INSTALL_FAILED',
        plugin.id,
        error
      );
    }
  }

  public async uninstallPlugin(pluginId: string): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new PluginError('Plugin not found', 'PLUGIN_NOT_FOUND', pluginId);
    }

    try {
      await this.executeHook('plugin:beforeUninstall', { plugin: manifest.plugin });

      // Deactivate if active
      if (manifest.metadata.isActive) {
        await this.deactivatePlugin(pluginId);
      }

      // Execute plugin uninstallation hook
      if (manifest.plugin.hooks.onUninstall) {
        await manifest.plugin.hooks.onUninstall();
      }

      // Remove plugin data
      this.plugins.delete(pluginId);
      this.pluginConfigs.delete(pluginId);

      // Remove plugin-specific event listeners and hooks
      this.removePluginListeners(pluginId);

      await this.executeHook('plugin:afterUninstall', { pluginId });

      console.log(`Plugin ${manifest.plugin.name} uninstalled successfully`);
    } catch (error) {
      throw new PluginError(
        `Failed to uninstall plugin ${manifest.plugin.name}`,
        'PLUGIN_UNINSTALL_FAILED',
        pluginId,
        error
      );
    }
  }

  public async activatePlugin(pluginId: string): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new PluginError('Plugin not found', 'PLUGIN_NOT_FOUND', pluginId);
    }

    if (manifest.metadata.isActive) {
      return; // Already active
    }

    try {
      // Check dependencies
      await this.checkActivationDependencies(manifest.plugin);

      // Execute plugin activation hook
      if (manifest.plugin.hooks.onActivate) {
        await manifest.plugin.hooks.onActivate();
      }

      // Register plugin's event listeners and hooks
      this.registerPluginListeners(manifest.plugin);

      // Mark as active
      manifest.metadata.isActive = true;

      console.log(`Plugin ${manifest.plugin.name} activated`);
    } catch (error) {
      throw new PluginError(
        `Failed to activate plugin ${manifest.plugin.name}`,
        'PLUGIN_ACTIVATION_FAILED',
        pluginId,
        error
      );
    }
  }

  public async deactivatePlugin(pluginId: string): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new PluginError('Plugin not found', 'PLUGIN_NOT_FOUND', pluginId);
    }

    if (!manifest.metadata.isActive) {
      return; // Already inactive
    }

    try {
      // Execute plugin deactivation hook
      if (manifest.plugin.hooks.onDeactivate) {
        await manifest.plugin.hooks.onDeactivate();
      }

      // Remove plugin's event listeners and hooks
      this.removePluginListeners(pluginId);

      // Mark as inactive
      manifest.metadata.isActive = false;

      console.log(`Plugin ${manifest.plugin.name} deactivated`);
    } catch (error) {
      throw new PluginError(
        `Failed to deactivate plugin ${manifest.plugin.name}`,
        'PLUGIN_DEACTIVATION_FAILED',
        pluginId,
        error
      );
    }
  }

  // Plugin Information and Status
  public getInstalledPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  public getActivePlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).filter(
      manifest => manifest.metadata.isActive
    );
  }

  public getPlugin(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  public isPluginInstalled(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  public isPluginActive(pluginId: string): boolean {
    const manifest = this.plugins.get(pluginId);
    return manifest?.metadata.isActive || false;
  }

  // Configuration Management
  public async updatePluginConfig(pluginId: string, config: PluginConfig): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new PluginError('Plugin not found', 'PLUGIN_NOT_FOUND', pluginId);
    }

    try {
      // Validate configuration
      this.validatePluginConfig(manifest.plugin, config);

      // Store new configuration
      this.pluginConfigs.set(pluginId, config);

      // Execute plugin config update hook
      if (manifest.plugin.hooks.onConfigUpdate) {
        await manifest.plugin.hooks.onConfigUpdate(config);
      }

      console.log(`Configuration updated for plugin ${manifest.plugin.name}`);
    } catch (error) {
      throw new PluginError(
        `Failed to update configuration for plugin ${manifest.plugin.name}`,
        'PLUGIN_CONFIG_UPDATE_FAILED',
        pluginId,
        error
      );
    }
  }

  public getPluginConfig(pluginId: string): PluginConfig | undefined {
    return this.pluginConfigs.get(pluginId);
  }

  // Hook System
  public registerHook(hookName: string, callback: Function): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName)!.add(callback);
  }

  public unregisterHook(hookName: string, callback: Function): void {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      hooks.delete(callback);
    }
  }

  private async executeHook(hookName: string, data: any): Promise<void> {
    const hooks = this.hooks.get(hookName);
    if (!hooks) return;

    for (const hook of hooks) {
      try {
        await hook(data);
      } catch (error) {
        console.error(`Error executing hook ${hookName}:`, error);
      }
    }
  }

  // Plugin Loading from External Sources
  public async loadPluginFromUrl(url: string): Promise<Plugin> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch plugin: ${response.statusText}`);
      }

      const pluginCode = await response.text();
      return this.executePluginCode(pluginCode, url);
    } catch (error) {
      throw new PluginError(
        'Failed to load plugin from URL',
        'PLUGIN_LOAD_FAILED',
        'unknown',
        error
      );
    }
  }

  public async loadPluginFromFile(file: File): Promise<Plugin> {
    try {
      const pluginCode = await file.text();
      return this.executePluginCode(pluginCode, file.name);
    } catch (error) {
      throw new PluginError(
        'Failed to load plugin from file',
        'PLUGIN_LOAD_FAILED',
        'unknown',
        error
      );
    }
  }

  // Plugin Validation and Security
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new PluginError(
        'Plugin missing required fields (id, name, version)',
        'INVALID_PLUGIN',
        plugin.id || 'unknown'
      );
    }

    if (!plugin.hooks || typeof plugin.hooks !== 'object') {
      throw new PluginError(
        'Plugin must define hooks object',
        'INVALID_PLUGIN',
        plugin.id
      );
    }

    // Validate plugin ID format
    if (!/^[a-z0-9\-_]+$/.test(plugin.id)) {
      throw new PluginError(
        'Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores',
        'INVALID_PLUGIN_ID',
        plugin.id
      );
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(plugin.version)) {
      throw new PluginError(
        'Plugin version must follow semantic versioning (x.y.z)',
        'INVALID_VERSION',
        plugin.id
      );
    }
  }

  private async checkPluginConflicts(plugin: Plugin): Promise<void> {
    // Check for ID conflicts
    if (this.plugins.has(plugin.id)) {
      throw new PluginError(
        'Plugin with this ID already exists',
        'PLUGIN_CONFLICT',
        plugin.id
      );
    }

    // Check for name conflicts
    for (const manifest of this.plugins.values()) {
      if (manifest.plugin.name === plugin.name && manifest.plugin.id !== plugin.id) {
        throw new PluginError(
          'Plugin with this name already exists',
          'PLUGIN_NAME_CONFLICT',
          plugin.id
        );
      }
    }
  }

  private async installDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return;
    }

    for (const dependency of plugin.dependencies) {
      const depManifest = this.plugins.get(dependency.name);
      
      if (!depManifest) {
        if (dependency.required) {
          throw new PluginError(
            `Required dependency ${dependency.name} is not installed`,
            'MISSING_DEPENDENCY',
            plugin.id
          );
        }
        continue;
      }

      // Check version compatibility
      if (!this.isVersionCompatible(depManifest.plugin.version, dependency.version)) {
        throw new PluginError(
          `Dependency ${dependency.name} version ${depManifest.plugin.version} is not compatible with required ${dependency.version}`,
          'INCOMPATIBLE_DEPENDENCY',
          plugin.id
        );
      }
    }
  }

  private async checkActivationDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies) return;

    for (const dependency of plugin.dependencies.filter(d => d.required)) {
      const depManifest = this.plugins.get(dependency.name);
      
      if (!depManifest || !depManifest.metadata.isActive) {
        throw new PluginError(
          `Required dependency ${dependency.name} is not active`,
          'INACTIVE_DEPENDENCY',
          plugin.id
        );
      }
    }
  }

  private validatePluginConfig(plugin: Plugin, config: PluginConfig): void {
    // Basic validation - in a real implementation, you'd use the plugin's config schema
    if (plugin.config && typeof config !== 'object') {
      throw new PluginError(
        'Plugin configuration must be an object',
        'INVALID_CONFIG',
        plugin.id
      );
    }
  }

  private extractConfigSchema(plugin: Plugin): any {
    // Extract configuration schema from plugin definition
    // This would typically be defined in the plugin manifest
    return plugin.config || {};
  }

  private executePluginCode(code: string, source: string): Plugin {
    try {
      // In a real implementation, you'd use a secure sandboxed environment
      // This is a simplified version for demonstration
      const module = { exports: {} };
      const require = (name: string) => {
        // Whitelist allowed modules
        const allowedModules: any = {};
        return allowedModules[name];
      };

      // Execute plugin code in controlled environment
      const func = new Function('module', 'exports', 'require', 'sdk', code);
      func(module, module.exports, require, this.sdk);

      const plugin = module.exports as Plugin;
      
      if (!plugin || typeof plugin !== 'object') {
        throw new Error('Plugin must export a valid plugin object');
      }

      return plugin;
    } catch (error) {
      throw new PluginError(
        `Failed to execute plugin code from ${source}`,
        'PLUGIN_EXECUTION_FAILED',
        'unknown',
        error
      );
    }
  }

  private registerPluginListeners(plugin: Plugin): void {
    // Register plugin's custom hooks and event listeners
    Object.keys(plugin.hooks).forEach(hookName => {
      if (hookName.startsWith('on') && typeof plugin.hooks[hookName] === 'function') {
        this.registerHook(`plugin:${plugin.id}:${hookName}`, plugin.hooks[hookName]!);
      }
    });
  }

  private removePluginListeners(pluginId: string): void {
    // Remove all hooks and listeners for the plugin
    const hookKeys = Array.from(this.hooks.keys());
    hookKeys.forEach(hookName => {
      if (hookName.includes(`plugin:${pluginId}:`)) {
        this.hooks.delete(hookName);
      }
    });
  }

  private isVersionCompatible(installed: string, required: string): boolean {
    // Simple semantic version comparison
    // In a real implementation, you'd use a proper semver library
    const [installedMajor, installedMinor, installedPatch] = installed.split('.').map(Number);
    const [requiredMajor, requiredMinor, requiredPatch] = required.split('.').map(Number);

    if (installedMajor !== requiredMajor) return false;
    if (installedMinor < requiredMinor) return false;
    if (installedMinor === requiredMinor && installedPatch < requiredPatch) return false;

    return true;
  }

  // Lifecycle hook implementations
  private async validatePluginDependencies(data: { plugin: Plugin }): Promise<void> {
    // Additional dependency validation logic
  }

  private async notifyPluginInstalled(data: { plugin: Plugin; manifest: PluginManifest }): Promise<void> {
    // Emit SDK event for plugin installation
    if (this.sdk && this.sdk.emit) {
      this.sdk.emit('plugin:installed', data);
    }
  }

  private async cleanupPluginData(data: { plugin: Plugin }): Promise<void> {
    // Clean up any plugin-specific data
  }

  private async notifyPluginUninstalled(data: { pluginId: string }): Promise<void> {
    // Emit SDK event for plugin uninstallation
    if (this.sdk && this.sdk.emit) {
      this.sdk.emit('plugin:uninstalled', data);
    }
  }

  // Cleanup
  public destroy(): void {
    this.plugins.clear();
    this.pluginConfigs.clear();
    this.hooks.clear();
    this.eventListeners.clear();
  }
}

export default PluginManager;