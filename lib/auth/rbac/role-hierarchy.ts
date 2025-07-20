import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface Role {
  id: string;
  name: string;
  description?: string;
  level: number;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface RoleHierarchyNode {
  role: Role;
  children: RoleHierarchyNode[];
  permissions?: string[];
}

export class RoleHierarchy {
  private static instance: RoleHierarchy;
  private hierarchyCache: Map<string, RoleHierarchyNode> = new Map();
  private lastCacheUpdate: number = 0;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): RoleHierarchy {
    if (!RoleHierarchy.instance) {
      RoleHierarchy.instance = new RoleHierarchy();
    }
    return RoleHierarchy.instance;
  }

  /**
   * Create a new role
   */
  async createRole(
    data: Omit<Role, 'id'> & { permissions?: string[] }
  ): Promise<Role> {
    // Validate parent role if specified
    if (data.parentId) {
      const parent = await prisma.role.findUnique({
        where: { id: data.parentId }
      });
      
      if (!parent) {
        throw new Error('Parent role not found');
      }

      // Ensure level is lower than parent
      if (data.level >= parent.level) {
        throw new Error('Child role level must be lower than parent');
      }
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        level: data.level,
        parentId: data.parentId,
        metadata: data.metadata
      }
    });

    // Assign permissions if provided
    if (data.permissions && data.permissions.length > 0) {
      await this.assignPermissionsToRole(role.id, data.permissions);
    }

    // Clear cache
    this.clearCache();

    await this.logRoleAction('role.created', role);

    return role;
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Omit<Role, 'id'>>
  ): Promise<Role> {
    // If updating parent, validate hierarchy
    if (updates.parentId !== undefined) {
      await this.validateHierarchyChange(roleId, updates.parentId);
    }

    const role = await prisma.role.update({
      where: { id: roleId },
      data: updates
    });

    this.clearCache();

    await this.logRoleAction('role.updated', role);

    return role;
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    // Check if role has children
    const children = await prisma.role.findMany({
      where: { parentId: roleId }
    });

    if (children.length > 0) {
      throw new Error('Cannot delete role with children');
    }

    // Check if role is assigned to users
    const userCount = await prisma.userRole.count({
      where: { roleId }
    });

    if (userCount > 0) {
      throw new Error(`Cannot delete role assigned to ${userCount} users`);
    }

    // Delete role
    await prisma.role.delete({
      where: { id: roleId }
    });

    this.clearCache();

    await this.logRoleAction('role.deleted', { id: roleId });
  }

  /**
   * Get role hierarchy
   */
  async getHierarchy(): Promise<RoleHierarchyNode[]> {
    if (this.isCacheValid()) {
      return Array.from(this.hierarchyCache.values()).filter(node => !node.role.parentId);
    }

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Build hierarchy
    const nodeMap = new Map<string, RoleHierarchyNode>();
    
    // Create nodes
    for (const role of roles) {
      const permissions = role.permissions.map(rp => 
        `${rp.permission.resource}:${rp.permission.action}`
      );
      
      nodeMap.set(role.id, {
        role,
        children: [],
        permissions
      });
    }

    // Build tree
    const roots: RoleHierarchyNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.role.parentId) {
        const parent = nodeMap.get(node.role.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    // Cache the hierarchy
    this.hierarchyCache = nodeMap;
    this.lastCacheUpdate = Date.now();

    return roots;
  }

  /**
   * Get all parent roles (ancestors)
   */
  async getAncestors(roleId: string): Promise<Role[]> {
    const ancestors: Role[] = [];
    let currentRoleId: string | null = roleId;

    while (currentRoleId) {
      const role = await prisma.role.findUnique({
        where: { id: currentRoleId }
      });

      if (!role || !role.parentId) break;

      const parent = await prisma.role.findUnique({
        where: { id: role.parentId }
      });

      if (parent) {
        ancestors.push(parent);
        currentRoleId = parent.id;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendant roles
   */
  async getDescendants(roleId: string): Promise<Role[]> {
    const descendants: Role[] = [];
    const queue: string[] = [roleId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      const children = await prisma.role.findMany({
        where: { parentId: currentId }
      });

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Get inherited permissions
   */
  async getInheritedPermissions(roleId: string): Promise<string[]> {
    const hierarchy = await this.getHierarchy();
    const node = this.findNodeInHierarchy(roleId, hierarchy);
    
    if (!node) return [];

    const permissions = new Set<string>();
    
    // Add own permissions
    if (node.permissions) {
      node.permissions.forEach(p => permissions.add(p));
    }

    // Add ancestor permissions
    const ancestors = await this.getAncestors(roleId);
    for (const ancestor of ancestors) {
      const ancestorNode = this.hierarchyCache.get(ancestor.id);
      if (ancestorNode?.permissions) {
        ancestorNode.permissions.forEach(p => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  /**
   * Assign user to role
   */
  async assignUserToRole(
    userId: string,
    roleId: string,
    expiresAt?: Date
  ): Promise<void> {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if assignment already exists
    const existing = await prisma.userRole.findUnique({
      where: {
        userId_roleId: { userId, roleId }
      }
    });

    if (existing) {
      // Update expiration if different
      if (expiresAt !== existing.expiresAt) {
        await prisma.userRole.update({
          where: { id: existing.id },
          data: { expiresAt }
        });
      }
      return;
    }

    // Create assignment
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedBy: 'system', // Should be actual admin ID
        expiresAt
      }
    });

    await this.logRoleAction('role.assigned', { userId, roleId, expiresAt });
  }

  /**
   * Remove user from role
   */
  async removeUserFromRole(userId: string, roleId: string): Promise<void> {
    const deleted = await prisma.userRole.deleteMany({
      where: { userId, roleId }
    });

    if (deleted.count > 0) {
      await this.logRoleAction('role.removed', { userId, roleId });
    }
  }

  /**
   * Get user roles with hierarchy
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: true
      }
    });

    return userRoles.map(ur => ur.role);
  }

  /**
   * Check if user has role (including inherited)
   */
  async userHasRole(
    userId: string,
    roleId: string,
    checkInherited: boolean = true
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    
    // Direct role check
    if (userRoles.some(r => r.id === roleId)) {
      return true;
    }

    if (!checkInherited) {
      return false;
    }

    // Check if user has any parent role
    const targetAncestors = await this.getAncestors(roleId);
    return userRoles.some(userRole => 
      targetAncestors.some(ancestor => ancestor.id === userRole.id)
    );
  }

  /**
   * Assign permissions to role
   */
  private async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    const data = permissionIds.map(permissionId => ({
      roleId,
      permissionId
    }));

    await prisma.rolePermission.createMany({
      data,
      skipDuplicates: true
    });
  }

  /**
   * Validate hierarchy change
   */
  private async validateHierarchyChange(
    roleId: string,
    newParentId: string | null
  ): Promise<void> {
    if (!newParentId) return;

    // Check if new parent exists
    const parent = await prisma.role.findUnique({
      where: { id: newParentId }
    });

    if (!parent) {
      throw new Error('Parent role not found');
    }

    // Check for circular reference
    const descendants = await this.getDescendants(roleId);
    if (descendants.some(d => d.id === newParentId)) {
      throw new Error('Circular reference detected');
    }
  }

  /**
   * Find node in hierarchy
   */
  private findNodeInHierarchy(
    roleId: string,
    nodes: RoleHierarchyNode[]
  ): RoleHierarchyNode | null {
    for (const node of nodes) {
      if (node.role.id === roleId) {
        return node;
      }
      
      const found = this.findNodeInHierarchy(roleId, node.children);
      if (found) return found;
    }
    return null;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return (
      this.hierarchyCache.size > 0 &&
      Date.now() - this.lastCacheUpdate < this.cacheTimeout
    );
  }

  /**
   * Clear cache
   */
  private clearCache(): void {
    this.hierarchyCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Log role action
   */
  private async logRoleAction(action: string, data: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          userId: data.userId || 'system',
          metadata: data,
          ipAddress: 'system',
          userAgent: 'role-hierarchy'
        }
      });
    } catch (error) {
      logger.error('Failed to log role action:', error);
    }
  }

  /**
   * Get role statistics
   */
  async getRoleStats(): Promise<{
    totalRoles: number;
    totalAssignments: number;
    rolesByLevel: Record<number, number>;
    averagePermissionsPerRole: number;
    mostUsedRoles: Array<{ role: string; count: number }>;
  }> {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      }
    });

    const totalAssignments = await prisma.userRole.count();

    const rolesByLevel = roles.reduce((acc, role) => {
      acc[role.level] = (acc[role.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const totalPermissions = roles.reduce((sum, role) => sum + role._count.permissions, 0);
    const averagePermissionsPerRole = roles.length > 0 ? totalPermissions / roles.length : 0;

    const mostUsedRoles = roles
      .sort((a, b) => b._count.users - a._count.users)
      .slice(0, 5)
      .map(role => ({ role: role.name, count: role._count.users }));

    return {
      totalRoles: roles.length,
      totalAssignments,
      rolesByLevel,
      averagePermissionsPerRole,
      mostUsedRoles
    };
  }
}