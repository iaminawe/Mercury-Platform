/**
 * Plugin Permission Manager
 * Handles permission validation and enforcement
 */

import { PluginPermission, PluginContext } from './types';

export class PluginPermissionManager {
  private permissionCheckers = new Map<string, PermissionChecker>();

  constructor() {
    this.initializePermissionCheckers();
  }

  /**
   * Validate plugin permissions
   */
  async validatePermissions(permissions: PluginPermission[]): Promise<void> {
    for (const permission of permissions) {
      const checker = this.permissionCheckers.get(permission.type);
      if (!checker) {
        throw new Error(`Unknown permission type: ${permission.type}`);
      }

      const isValid = await checker.validate(permission);
      if (!isValid) {
        throw new Error(`Invalid permission: ${permission.type}:${permission.resource}:${permission.access}`);
      }
    }
  }

  /**
   * Check if plugin has permission for an operation
   */
  async checkPermission(
    context: PluginContext,
    permissionType: string,
    resource: string,
    access: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    const plugin = context.plugin;
    
    // Get plugin manifest to check declared permissions
    // This would be passed in via context in a real implementation
    const declaredPermissions = this.getDeclaredPermissions(plugin.id);
    
    // Check if permission is declared
    const hasPermission = declaredPermissions.some(perm => 
      perm.type === permissionType &&
      this.matchesResource(perm.resource, resource) &&
      this.hasAccess(perm.access, access)
    );

    if (!hasPermission) {
      return false;
    }

    // Additional runtime checks
    const checker = this.permissionCheckers.get(permissionType);
    if (checker) {
      return await checker.checkRuntime(context, resource, access);
    }

    return true;
  }

  /**
   * Get permission summary for a plugin
   */
  getPermissionSummary(pluginId: string): {
    permissions: PluginPermission[];
    riskyPermissions: PluginPermission[];
    recommendations: string[];
  } {
    const permissions = this.getDeclaredPermissions(pluginId);
    const riskyPermissions = permissions.filter(perm => this.isRiskyPermission(perm));
    const recommendations = this.generateRecommendations(permissions);

    return {
      permissions,
      riskyPermissions,
      recommendations
    };
  }

  /**
   * Create permission grant for user approval
   */
  async createPermissionGrant(
    pluginId: string,
    permissions: PluginPermission[],
    userId: string
  ): Promise<PermissionGrant> {
    const grant: PermissionGrant = {
      id: `grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pluginId,
      permissions,
      grantedBy: userId,
      grantedAt: new Date(),
      status: 'pending',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };

    // Store grant (in real implementation, save to database)
    await this.storePermissionGrant(grant);

    return grant;
  }

  /**
   * Revoke permission grant
   */
  async revokePermissionGrant(grantId: string, revokedBy: string): Promise<void> {
    const grant = await this.getPermissionGrant(grantId);
    if (!grant) {
      throw new Error(`Permission grant ${grantId} not found`);
    }

    grant.status = 'revoked';
    grant.revokedBy = revokedBy;
    grant.revokedAt = new Date();

    await this.storePermissionGrant(grant);
  }

  /**
   * Audit permission usage
   */
  async auditPermissionUsage(pluginId: string, timeframe: {
    start: Date;
    end: Date;
  }): Promise<PermissionAudit[]> {
    // In real implementation, query audit logs
    return [];
  }

  /**
   * Initialize permission checkers
   */
  private initializePermissionCheckers(): void {
    this.permissionCheckers.set('api', new ApiPermissionChecker());
    this.permissionCheckers.set('database', new DatabasePermissionChecker());
    this.permissionCheckers.set('file', new FilePermissionChecker());
    this.permissionCheckers.set('network', new NetworkPermissionChecker());
    this.permissionCheckers.set('storage', new StoragePermissionChecker());
    this.permissionCheckers.set('analytics', new AnalyticsPermissionChecker());
    this.permissionCheckers.set('customer-data', new CustomerDataPermissionChecker());
  }

  /**
   * Get declared permissions for a plugin
   */
  private getDeclaredPermissions(pluginId: string): PluginPermission[] {
    // In real implementation, get from plugin manifest
    return [];
  }

  /**
   * Check if resource pattern matches
   */
  private matchesResource(pattern: string, resource: string): boolean {
    // Simple glob-like matching
    if (pattern === '*') return true;
    if (pattern === resource) return true;
    
    // Handle wildcards
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(resource);
  }

  /**
   * Check if access level is sufficient
   */
  private hasAccess(declared: string, required: string): boolean {
    const levels = { read: 1, write: 2, admin: 3 };
    return (levels[declared as keyof typeof levels] || 0) >= (levels[required as keyof typeof levels] || 0);
  }

  /**
   * Check if permission is risky
   */
  private isRiskyPermission(permission: PluginPermission): boolean {
    const riskyTypes = ['file', 'database', 'customer-data'];
    const riskyAccess = ['write', 'admin'];
    
    return riskyTypes.includes(permission.type) && riskyAccess.includes(permission.access);
  }

  /**
   * Generate permission recommendations
   */
  private generateRecommendations(permissions: PluginPermission[]): string[] {
    const recommendations: string[] = [];

    // Check for overly broad permissions
    const broadPermissions = permissions.filter(perm => perm.resource === '*');
    if (broadPermissions.length > 0) {
      recommendations.push('Consider requesting more specific resource permissions instead of wildcards');
    }

    // Check for admin access
    const adminPermissions = permissions.filter(perm => perm.access === 'admin');
    if (adminPermissions.length > 0) {
      recommendations.push('Admin access should only be granted if absolutely necessary');
    }

    // Check for customer data access
    const customerDataPermissions = permissions.filter(perm => perm.type === 'customer-data');
    if (customerDataPermissions.length > 0) {
      recommendations.push('Ensure plugin handles customer data according to privacy regulations');
    }

    return recommendations;
  }

  /**
   * Store permission grant (mock implementation)
   */
  private async storePermissionGrant(grant: PermissionGrant): Promise<void> {
    // In real implementation, save to database
    console.log(`Storing permission grant: ${grant.id}`);
  }

  /**
   * Get permission grant (mock implementation)
   */
  private async getPermissionGrant(grantId: string): Promise<PermissionGrant | null> {
    // In real implementation, query from database
    return null;
  }
}

/**
 * Base permission checker interface
 */
abstract class PermissionChecker {
  abstract validate(permission: PluginPermission): Promise<boolean>;
  abstract checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean>;
}

/**
 * API permission checker
 */
class ApiPermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    // Validate API permission format
    const validResources = ['products', 'orders', 'customers', 'analytics', 'store', '*'];
    return validResources.includes(permission.resource);
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Check API rate limits, quotas, etc.
    return true;
  }
}

/**
 * Database permission checker
 */
class DatabasePermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    // Validate database permission format
    const validResources = ['plugin_data', 'temp_data', 'cache'];
    return validResources.includes(permission.resource) || permission.resource.startsWith('plugin_');
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Check if plugin can access the specific table/resource
    return resource.startsWith(`plugin_${context.plugin.id}_`);
  }
}

/**
 * File permission checker
 */
class FilePermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    // Validate file permission format
    const allowedPaths = ['data', 'temp', 'cache', 'uploads'];
    return allowedPaths.some(path => permission.resource.startsWith(path));
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Ensure file access is within plugin's directory
    const pluginDataDir = context.plugin.dataDir;
    const pluginTempDir = context.plugin.tempDir;
    
    return resource.startsWith(pluginDataDir) || resource.startsWith(pluginTempDir);
  }
}

/**
 * Network permission checker
 */
class NetworkPermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    // Validate network permission format
    try {
      new URL(permission.resource);
      return true;
    } catch {
      return permission.resource === '*' || permission.resource.includes('*');
    }
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Check against network whitelist
    const allowedDomains = [
      'api.shopify.com',
      'api.stripe.com',
      'api.mailchimp.com',
      // Add more allowed domains
    ];

    try {
      const url = new URL(resource);
      return allowedDomains.some(domain => url.hostname.endsWith(domain));
    } catch {
      return false;
    }
  }
}

/**
 * Storage permission checker
 */
class StoragePermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    // Validate storage permission format
    const validNamespaces = ['config', 'cache', 'user_data', 'temp'];
    return validNamespaces.includes(permission.resource) || permission.resource.startsWith('plugin_');
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Ensure storage access is namespaced to plugin
    return resource.startsWith(`plugin_${context.plugin.id}_`);
  }
}

/**
 * Analytics permission checker
 */
class AnalyticsPermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    const validResources = ['page_views', 'conversions', 'revenue', 'products', 'customers'];
    return validResources.includes(permission.resource) || permission.resource === '*';
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Check analytics access based on user role
    return context.mercury.user.permissions.includes('analytics') || 
           context.mercury.user.role === 'admin';
  }
}

/**
 * Customer data permission checker
 */
class CustomerDataPermissionChecker extends PermissionChecker {
  async validate(permission: PluginPermission): Promise<boolean> {
    const validResources = ['email', 'name', 'orders', 'preferences', 'segments'];
    return validResources.includes(permission.resource);
  }

  async checkRuntime(context: PluginContext, resource: string, access: string): Promise<boolean> {
    // Strict checks for customer data access
    const hasCustomerDataPermission = context.mercury.user.permissions.includes('customer_data');
    const isAdmin = context.mercury.user.role === 'admin';
    
    return hasCustomerDataPermission || isAdmin;
  }
}

/**
 * Permission grant interface
 */
interface PermissionGrant {
  id: string;
  pluginId: string;
  permissions: PluginPermission[];
  grantedBy: string;
  grantedAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  expiresAt: Date;
  revokedBy?: string;
  revokedAt?: Date;
}

/**
 * Permission audit interface
 */
interface PermissionAudit {
  id: string;
  pluginId: string;
  permission: PluginPermission;
  resource: string;
  access: string;
  timestamp: Date;
  userId: string;
  success: boolean;
  error?: string;
}