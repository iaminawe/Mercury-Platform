/**
 * Plugin Registry
 * Manages plugin metadata, installations, and lifecycle
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { PluginManifest, PluginInstallation, PluginMarketplaceEntry } from './types';

export class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();
  private installations = new Map<string, PluginInstallation>();
  private registryPath: string;
  private installationsPath: string;

  constructor(dataDir: string = join(process.cwd(), '.mercury', 'plugins')) {
    this.registryPath = join(dataDir, 'registry.json');
    this.installationsPath = join(dataDir, 'installations.json');
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadRegistry();
    await this.loadInstallations();
  }

  /**
   * Register a plugin
   */
  async register(manifest: PluginManifest, pluginPath: string): Promise<void> {
    // Validate manifest
    this.validateManifest(manifest);

    // Check for conflicts
    const existing = this.plugins.get(manifest.id);
    if (existing && existing.version !== manifest.version) {
      console.warn(`Plugin ${manifest.id} version mismatch: ${existing.version} -> ${manifest.version}`);
    }

    // Store in memory
    this.plugins.set(manifest.id, manifest);

    // Persist to disk
    await this.saveRegistry();

    console.log(`Registered plugin: ${manifest.name} v${manifest.version}`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Remove from memory
    this.plugins.delete(pluginId);
    this.installations.delete(pluginId);

    // Persist changes
    await this.saveRegistry();
    await this.saveInstallations();

    console.log(`Unregistered plugin: ${plugin.name}`);
  }

  /**
   * Get plugin manifest
   */
  getManifest(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: string): PluginManifest[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.category === category
    );
  }

  /**
   * Search plugins
   */
  searchPlugins(query: string): PluginManifest[] {
    const lowercaseQuery = query.toLowerCase();
    
    return Array.from(this.plugins.values()).filter(plugin => {
      return (
        plugin.name.toLowerCase().includes(lowercaseQuery) ||
        plugin.description.toLowerCase().includes(lowercaseQuery) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      );
    });
  }

  /**
   * Install a plugin
   */
  async installPlugin(
    pluginId: string,
    version: string,
    config: Record<string, any> = {},
    installedBy: string = 'system'
  ): Promise<PluginInstallation> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    // Check if already installed
    const existing = this.installations.get(pluginId);
    if (existing) {
      throw new Error(`Plugin ${pluginId} is already installed`);
    }

    const installation: PluginInstallation = {
      pluginId,
      version,
      installedAt: new Date(),
      installedBy,
      config,
      status: 'inactive',
      autoUpdate: false
    };

    this.installations.set(pluginId, installation);
    await this.saveInstallations();

    console.log(`Installed plugin: ${manifest.name} v${version}`);
    return installation;
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const installation = this.installations.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    this.installations.delete(pluginId);
    await this.saveInstallations();

    console.log(`Uninstalled plugin: ${pluginId}`);
  }

  /**
   * Update plugin installation
   */
  async updateInstallation(
    pluginId: string,
    updates: Partial<PluginInstallation>
  ): Promise<PluginInstallation> {
    const installation = this.installations.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    const updated = { ...installation, ...updates };
    this.installations.set(pluginId, updated);
    await this.saveInstallations();

    return updated;
  }

  /**
   * Get plugin installation
   */
  getInstallation(pluginId: string): PluginInstallation | undefined {
    return this.installations.get(pluginId);
  }

  /**
   * Get all installations
   */
  getAllInstallations(): PluginInstallation[] {
    return Array.from(this.installations.values());
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins(): PluginManifest[] {
    const installedIds = Array.from(this.installations.keys());
    return installedIds
      .map(id => this.plugins.get(id))
      .filter(plugin => plugin !== undefined) as PluginManifest[];
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): PluginManifest[] {
    const activeInstallations = Array.from(this.installations.values())
      .filter(installation => installation.status === 'active');
    
    return activeInstallations
      .map(installation => this.plugins.get(installation.pluginId))
      .filter(plugin => plugin !== undefined) as PluginManifest[];
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
    const updates: Array<{
      pluginId: string;
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
    }> = [];

    for (const installation of this.installations.values()) {
      const manifest = this.plugins.get(installation.pluginId);
      if (manifest) {
        const updateAvailable = this.compareVersions(manifest.version, installation.version) > 0;
        
        updates.push({
          pluginId: installation.pluginId,
          currentVersion: installation.version,
          latestVersion: manifest.version,
          updateAvailable
        });
      }
    }

    return updates;
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    total: number;
    installed: number;
    active: number;
    byCategory: Record<string, number>;
  } {
    const all = this.getAllPlugins();
    const installed = this.getInstalledPlugins();
    const active = this.getActivePlugins();

    const byCategory: Record<string, number> = {};
    for (const plugin of all) {
      byCategory[plugin.category] = (byCategory[plugin.category] || 0) + 1;
    }

    return {
      total: all.length,
      installed: installed.length,
      active: active.length,
      byCategory
    };
  }

  /**
   * Validate plugin dependencies
   */
  async validateDependencies(pluginId: string): Promise<{
    satisfied: boolean;
    missing: string[];
    conflicts: string[];
  }> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const missing: string[] = [];
    const conflicts: string[] = [];

    // Check dependencies
    if (manifest.dependencies) {
      for (const [depId, requiredVersion] of Object.entries(manifest.dependencies)) {
        const depInstallation = this.installations.get(depId);
        
        if (!depInstallation) {
          missing.push(`${depId}@${requiredVersion}`);
        } else if (!this.isVersionSatisfied(depInstallation.version, requiredVersion)) {
          conflicts.push(`${depId}: required ${requiredVersion}, found ${depInstallation.version}`);
        }
      }
    }

    // Check peer dependencies
    if (manifest.peerDependencies) {
      for (const [peerId, requiredVersion] of Object.entries(manifest.peerDependencies)) {
        const peerInstallation = this.installations.get(peerId);
        
        if (peerInstallation && !this.isVersionSatisfied(peerInstallation.version, requiredVersion)) {
          conflicts.push(`${peerId}: required ${requiredVersion}, found ${peerInstallation.version}`);
        }
      }
    }

    return {
      satisfied: missing.length === 0 && conflicts.length === 0,
      missing,
      conflicts
    };
  }

  /**
   * Create plugin backup
   */
  async createBackup(): Promise<string> {
    const backup = {
      timestamp: new Date().toISOString(),
      plugins: Array.from(this.plugins.entries()),
      installations: Array.from(this.installations.entries())
    };

    const backupPath = join(
      process.cwd(),
      '.mercury',
      'backups',
      `plugins-${Date.now()}.json`
    );

    await this.ensureDirectory(join(process.cwd(), '.mercury', 'backups'));
    await writeFile(backupPath, JSON.stringify(backup, null, 2));

    return backupPath;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    const content = await readFile(backupPath, 'utf-8');
    const backup = JSON.parse(content);

    // Restore plugins
    this.plugins.clear();
    for (const [id, manifest] of backup.plugins) {
      this.plugins.set(id, manifest);
    }

    // Restore installations
    this.installations.clear();
    for (const [id, installation] of backup.installations) {
      this.installations.set(id, installation);
    }

    // Save to disk
    await this.saveRegistry();
    await this.saveInstallations();

    console.log('Registry restored from backup');
  }

  /**
   * Validate manifest structure
   */
  private validateManifest(manifest: PluginManifest): void {
    const required = ['id', 'name', 'version', 'main', 'category', 'mercuryVersion'];
    
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate plugin ID format
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
      throw new Error('Plugin ID must be lowercase alphanumeric with hyphens');
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Version must follow semantic versioning (x.y.z)');
    }
  }

  /**
   * Compare two version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * Check if version satisfies requirement
   */
  private isVersionSatisfied(version: string, requirement: string): boolean {
    // Simple version matching - in production, use semver library
    if (requirement.startsWith('^')) {
      const reqVersion = requirement.slice(1);
      return this.compareVersions(version, reqVersion) >= 0;
    }
    
    if (requirement.startsWith('~')) {
      const reqVersion = requirement.slice(1);
      return this.compareVersions(version, reqVersion) >= 0;
    }

    return version === requirement;
  }

  /**
   * Load registry from disk
   */
  private async loadRegistry(): Promise<void> {
    try {
      const content = await readFile(this.registryPath, 'utf-8');
      const data = JSON.parse(content);
      
      this.plugins.clear();
      for (const [id, manifest] of data.plugins || []) {
        this.plugins.set(id, manifest);
      }
    } catch (error) {
      // Registry file doesn't exist yet - that's okay
      console.log('No existing registry found, starting fresh');
    }
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    const data = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      plugins: Array.from(this.plugins.entries())
    };

    await writeFile(this.registryPath, JSON.stringify(data, null, 2));
  }

  /**
   * Load installations from disk
   */
  private async loadInstallations(): Promise<void> {
    try {
      const content = await readFile(this.installationsPath, 'utf-8');
      const data = JSON.parse(content);
      
      this.installations.clear();
      for (const [id, installation] of data.installations || []) {
        // Convert date strings back to Date objects
        installation.installedAt = new Date(installation.installedAt);
        this.installations.set(id, installation);
      }
    } catch (error) {
      // Installations file doesn't exist yet - that's okay
      console.log('No existing installations found, starting fresh');
    }
  }

  /**
   * Save installations to disk
   */
  private async saveInstallations(): Promise<void> {
    const data = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      installations: Array.from(this.installations.entries())
    };

    await writeFile(this.installationsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    const dataDir = join(process.cwd(), '.mercury', 'plugins');
    await this.ensureDirectory(dataDir);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }
}