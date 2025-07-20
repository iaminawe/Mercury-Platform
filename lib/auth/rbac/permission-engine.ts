import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/cache';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  description?: string;
}

export interface PermissionCheck {
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, any>;
}

export interface PermissionGrant {
  permission: Permission;
  granted: boolean;
  reason?: string;
  appliedPolicies?: string[];
}

export class PermissionEngine {
  private static instance: PermissionEngine;
  private permissionCache = new Map<string, { permissions: Permission[]; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): PermissionEngine {
    if (!PermissionEngine.instance) {
      PermissionEngine.instance = new PermissionEngine();
    }
    return PermissionEngine.instance;
  }

  /**
   * Check if user has permission
   */
  async checkPermission(check: PermissionCheck): Promise<PermissionGrant> {
    const { userId, resource, action, context = {} } = check;

    // Get user with roles and permissions
    const user = await this.getUserWithPermissions(userId);
    if (!user) {
      return {
        permission: { id: '', name: '', resource, action },
        granted: false,
        reason: 'User not found'
      };
    }

    // Check if user is superadmin
    if (user.roles.some((role: any) => role.name === 'superadmin')) {
      return {
        permission: { id: 'superadmin', name: 'Superadmin Override', resource, action },
        granted: true,
        reason: 'Superadmin has all permissions'
      };
    }

    // Get all applicable permissions
    const permissions = await this.getUserPermissions(user);
    
    // Find matching permission
    const matchingPermission = permissions.find(p => 
      this.matchesResourceAction(p, resource, action)
    );

    if (!matchingPermission) {
      return {
        permission: { id: '', name: '', resource, action },
        granted: false,
        reason: 'No matching permission found'
      };
    }

    // Evaluate conditions if any
    if (matchingPermission.conditions) {
      const conditionsResult = await this.evaluateConditions(
        matchingPermission.conditions,
        { user, resource, action, context }
      );

      if (!conditionsResult.passed) {
        return {
          permission: matchingPermission,
          granted: false,
          reason: conditionsResult.reason
        };
      }
    }

    // Check custom policies
    const policiesResult = await this.evaluatePolicies(user, matchingPermission, context);
    if (!policiesResult.granted) {
      return {
        permission: matchingPermission,
        granted: false,
        reason: policiesResult.reason,
        appliedPolicies: policiesResult.appliedPolicies
      };
    }

    // Permission granted
    await this.logPermissionCheck(check, true);
    
    return {
      permission: matchingPermission,
      granted: true,
      appliedPolicies: policiesResult.appliedPolicies
    };
  }

  /**
   * Check multiple permissions
   */
  async checkPermissions(
    userId: string,
    checks: Array<{ resource: string; action: string; context?: Record<string, any> }>
  ): Promise<PermissionGrant[]> {
    const results = await Promise.all(
      checks.map(check => 
        this.checkPermission({ userId, ...check })
      )
    );
    return results;
  }

  /**
   * Grant permission to role
   */
  async grantPermissionToRole(
    roleId: string,
    permission: Omit<Permission, 'id'>
  ): Promise<Permission> {
    // Create or find permission
    let perm = await prisma.permission.findFirst({
      where: {
        resource: permission.resource,
        action: permission.action
      }
    });

    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: permission.name,
          resource: permission.resource,
          action: permission.action,
          conditions: permission.conditions,
          description: permission.description
        }
      });
    }

    // Create role permission association
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: perm.id
      }
    });

    // Clear cache
    this.clearCache();

    await this.logPermissionGrant(roleId, perm, 'role');

    return perm;
  }

  /**
   * Grant permission directly to user
   */
  async grantPermissionToUser(
    userId: string,
    permission: Omit<Permission, 'id'>
  ): Promise<Permission> {
    // Create or find permission
    let perm = await prisma.permission.findFirst({
      where: {
        resource: permission.resource,
        action: permission.action
      }
    });

    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: permission.name,
          resource: permission.resource,
          action: permission.action,
          conditions: permission.conditions,
          description: permission.description
        }
      });
    }

    // Create user permission association
    await prisma.userPermission.create({
      data: {
        userId,
        permissionId: perm.id
      }
    });

    // Clear cache
    this.clearCache();

    await this.logPermissionGrant(userId, perm, 'user');

    return perm;
  }

  /**
   * Revoke permission from role
   */
  async revokePermissionFromRole(
    roleId: string,
    permissionId: string
  ): Promise<void> {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId
      }
    });

    this.clearCache();

    await this.logPermissionRevoke(roleId, permissionId, 'role');
  }

  /**
   * Revoke permission from user
   */
  async revokePermissionFromUser(
    userId: string,
    permissionId: string
  ): Promise<void> {
    await prisma.userPermission.deleteMany({
      where: {
        userId,
        permissionId
      }
    });

    this.clearCache();

    await this.logPermissionRevoke(userId, permissionId, 'user');
  }

  /**
   * Get all permissions for a resource
   */
  async getResourcePermissions(resource: string): Promise<Permission[]> {
    const permissions = await prisma.permission.findMany({
      where: { resource }
    });
    return permissions;
  }

  /**
   * Create bulk permissions
   */
  async createBulkPermissions(
    permissions: Array<Omit<Permission, 'id'>>
  ): Promise<Permission[]> {
    const created = await prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true
    });

    const result = await prisma.permission.findMany({
      where: {
        OR: permissions.map(p => ({
          AND: [
            { resource: p.resource },
            { action: p.action }
          ]
        }))
      }
    });

    return result;
  }

  /**
   * Get user with permissions
   */
  private async getUserWithPermissions(userId: string): Promise<any> {
    const cacheKey = `user_permissions:${userId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (user) {
      await cache.set(cacheKey, user, 300); // Cache for 5 minutes
    }

    return user;
  }

  /**
   * Get all user permissions (from roles and direct grants)
   */
  private async getUserPermissions(user: any): Promise<Permission[]> {
    const permissions = new Map<string, Permission>();

    // Add role permissions
    for (const userRole of user.roles) {
      for (const rolePerm of userRole.role.permissions) {
        const key = `${rolePerm.permission.resource}:${rolePerm.permission.action}`;
        permissions.set(key, rolePerm.permission);
      }
    }

    // Add direct user permissions
    for (const userPerm of user.permissions) {
      const key = `${userPerm.permission.resource}:${userPerm.permission.action}`;
      permissions.set(key, userPerm.permission);
    }

    return Array.from(permissions.values());
  }

  /**
   * Check if permission matches resource and action
   */
  private matchesResourceAction(
    permission: Permission,
    resource: string,
    action: string
  ): boolean {
    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }

    // Wildcard matching
    const resourcePattern = permission.resource.replace(/\*/g, '.*');
    const actionPattern = permission.action.replace(/\*/g, '.*');

    const resourceRegex = new RegExp(`^${resourcePattern}$`);
    const actionRegex = new RegExp(`^${actionPattern}$`);

    return resourceRegex.test(resource) && actionRegex.test(action);
  }

  /**
   * Evaluate permission conditions
   */
  private async evaluateConditions(
    conditions: Record<string, any>,
    context: any
  ): Promise<{ passed: boolean; reason?: string }> {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'ownResource':
          if (value && context.resource.ownerId !== context.user.id) {
            return { passed: false, reason: 'Not resource owner' };
          }
          break;

        case 'timeRange':
          const now = new Date();
          if (value.start && new Date(value.start) > now) {
            return { passed: false, reason: 'Permission not yet active' };
          }
          if (value.end && new Date(value.end) < now) {
            return { passed: false, reason: 'Permission expired' };
          }
          break;

        case 'ipRange':
          if (value && context.ipAddress) {
            // Implement IP range checking
            const allowed = await this.checkIpRange(context.ipAddress, value);
            if (!allowed) {
              return { passed: false, reason: 'IP address not allowed' };
            }
          }
          break;

        case 'custom':
          // Evaluate custom condition function
          if (typeof value === 'function') {
            const result = await value(context);
            if (!result) {
              return { passed: false, reason: 'Custom condition failed' };
            }
          }
          break;
      }
    }

    return { passed: true };
  }

  /**
   * Evaluate custom policies
   */
  private async evaluatePolicies(
    user: any,
    permission: Permission,
    context: Record<string, any>
  ): Promise<{ granted: boolean; reason?: string; appliedPolicies?: string[] }> {
    // Get applicable policies
    const policies = await prisma.policy.findMany({
      where: {
        OR: [
          { targetType: 'user', targetId: user.id },
          { targetType: 'role', targetId: { in: user.roles.map((r: any) => r.roleId) } },
          { targetType: 'global', targetId: null }
        ],
        resource: permission.resource,
        action: permission.action,
        active: true
      },
      orderBy: { priority: 'desc' }
    });

    const appliedPolicies: string[] = [];

    for (const policy of policies) {
      appliedPolicies.push(policy.name);

      // Evaluate policy rules
      const result = await this.evaluatePolicyRules(policy.rules as any, context);
      
      if (policy.effect === 'deny' && result) {
        return {
          granted: false,
          reason: `Denied by policy: ${policy.name}`,
          appliedPolicies
        };
      }

      if (policy.effect === 'allow' && !result) {
        return {
          granted: false,
          reason: `Not allowed by policy: ${policy.name}`,
          appliedPolicies
        };
      }
    }

    return { granted: true, appliedPolicies };
  }

  /**
   * Evaluate policy rules
   */
  private async evaluatePolicyRules(
    rules: any,
    context: Record<string, any>
  ): Promise<boolean> {
    // Implement policy rule evaluation logic
    // This is a simplified version - expand based on your needs
    return true;
  }

  /**
   * Check IP range
   */
  private async checkIpRange(ip: string, ranges: string[]): Promise<boolean> {
    // Implement IP range checking logic
    // This is a placeholder - implement actual IP range validation
    return true;
  }

  /**
   * Clear permission cache
   */
  private clearCache(): void {
    this.permissionCache.clear();
    cache.delete('user_permissions:*');
  }

  /**
   * Log permission check
   */
  private async logPermissionCheck(
    check: PermissionCheck,
    granted: boolean
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'permission.check',
          userId: check.userId,
          metadata: {
            resource: check.resource,
            action: check.action,
            granted,
            context: check.context
          },
          ipAddress: check.context?.ipAddress || 'system',
          userAgent: 'permission-engine'
        }
      });
    } catch (error) {
      logger.error('Failed to log permission check:', error);
    }
  }

  /**
   * Log permission grant
   */
  private async logPermissionGrant(
    targetId: string,
    permission: Permission,
    targetType: 'user' | 'role'
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'permission.grant',
          userId: targetId,
          metadata: {
            targetType,
            permission,
            timestamp: new Date()
          },
          ipAddress: 'system',
          userAgent: 'permission-engine'
        }
      });
    } catch (error) {
      logger.error('Failed to log permission grant:', error);
    }
  }

  /**
   * Log permission revoke
   */
  private async logPermissionRevoke(
    targetId: string,
    permissionId: string,
    targetType: 'user' | 'role'
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'permission.revoke',
          userId: targetId,
          metadata: {
            targetType,
            permissionId,
            timestamp: new Date()
          },
          ipAddress: 'system',
          userAgent: 'permission-engine'
        }
      });
    } catch (error) {
      logger.error('Failed to log permission revoke:', error);
    }
  }
}