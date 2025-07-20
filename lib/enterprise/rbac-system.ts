/**
 * Role-Based Access Control (RBAC) System
 * Advanced enterprise permission management
 */

import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  permissions: string[]; // Permission IDs
  parentRoles?: string[]; // Role IDs for inheritance
  isSystem: boolean; // System roles cannot be deleted
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  organizationId: string;
  scope?: ResourceScope; // Optional scope restriction
  expiresAt?: Date;
  assignedBy: string;
  assignedAt: Date;
}

export interface ResourceScope {
  type: 'organization' | 'department' | 'team' | 'project' | 'resource';
  id: string;
  name: string;
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'greater_than' | 'less_than';
  value: any;
  contextField?: string; // Field from user context
}

export interface AccessContext {
  userId: string;
  organizationId: string;
  userAttributes?: Record<string, any>;
  resourceAttributes?: Record<string, any>;
  requestContext?: {
    ip: string;
    userAgent: string;
    timestamp: Date;
    sessionId?: string;
  };
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedPermissions: Permission[];
  evaluatedConditions: ConditionEvaluation[];
  cacheHint?: {
    cacheable: boolean;
    ttl?: number;
  };
}

export interface ConditionEvaluation {
  condition: PermissionCondition;
  result: boolean;
  actualValue?: any;
  expectedValue?: any;
}

export interface RBACPolicy {
  id: string;
  name: string;
  organizationId: string;
  rules: PolicyRule[];
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyRule {
  id: string;
  effect: 'allow' | 'deny';
  resources: string[];
  actions: string[];
  conditions?: PermissionCondition[];
  principals?: {
    users?: string[];
    roles?: string[];
    groups?: string[];
  };
}

export interface AuditEntry {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  decision: 'allowed' | 'denied';
  reason: string;
  context: AccessContext;
  timestamp: Date;
}

const PermissionSchema = z.object({
  name: z.string(),
  description: z.string(),
  resource: z.string(),
  action: z.string(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'starts_with', 'greater_than', 'less_than']),
    value: z.any(),
    contextField: z.string().optional()
  })).optional()
});

const RoleSchema = z.object({
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  parentRoles: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export class RBACSystem extends EventEmitter {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map(); // userId -> UserRole[]
  private policies: Map<string, RBACPolicy> = new Map();
  private auditLog: AuditEntry[] = [];
  private accessCache: Map<string, { decision: AccessDecision; expiry: number }> = new Map();

  constructor() {
    super();
    this.initializeSystemPermissions();
    this.initializeSystemRoles();
    this.setupCacheCleanup();
  }

  // Permission Management
  async createPermission(
    permissionData: z.infer<typeof PermissionSchema>
  ): Promise<Permission> {
    const validated = PermissionSchema.parse(permissionData);
    
    const permission: Permission = {
      id: crypto.randomUUID(),
      ...validated,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.permissions.set(permission.id, permission);
    this.emit('permission:created', permission);
    
    return permission;
  }

  async updatePermission(
    permissionId: string,
    updates: Partial<Permission>
  ): Promise<Permission | null> {
    const permission = this.permissions.get(permissionId);
    if (!permission) return null;

    const updatedPermission = {
      ...permission,
      ...updates,
      updatedAt: new Date()
    };

    this.permissions.set(permissionId, updatedPermission);
    this.clearCache(); // Invalidate cache when permissions change
    this.emit('permission:updated', updatedPermission);
    
    return updatedPermission;
  }

  async deletePermission(permissionId: string): Promise<boolean> {
    const permission = this.permissions.get(permissionId);
    if (!permission) return false;

    // Remove from all roles
    for (const role of this.roles.values()) {
      if (role.permissions.includes(permissionId)) {
        role.permissions = role.permissions.filter(p => p !== permissionId);
        role.updatedAt = new Date();
      }
    }

    this.permissions.delete(permissionId);
    this.clearCache();
    this.emit('permission:deleted', permission);
    
    return true;
  }

  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  listPermissions(filters?: {
    resource?: string;
    action?: string;
  }): Permission[] {
    let permissions = Array.from(this.permissions.values());

    if (filters) {
      if (filters.resource) {
        permissions = permissions.filter(p => p.resource === filters.resource);
      }
      if (filters.action) {
        permissions = permissions.filter(p => p.action === filters.action);
      }
    }

    return permissions;
  }

  // Role Management
  async createRole(
    organizationId: string,
    roleData: z.infer<typeof RoleSchema>
  ): Promise<Role> {
    const validated = RoleSchema.parse(roleData);
    
    // Validate permissions exist
    for (const permissionId of validated.permissions) {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} does not exist`);
      }
    }

    // Validate parent roles exist and don't create cycles
    if (validated.parentRoles) {
      for (const parentRoleId of validated.parentRoles) {
        if (!this.roles.has(parentRoleId)) {
          throw new Error(`Parent role ${parentRoleId} does not exist`);
        }
      }
    }

    const role: Role = {
      id: crypto.randomUUID(),
      organizationId,
      isSystem: false,
      ...validated,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.roles.set(role.id, role);
    this.clearCache();
    this.emit('role:created', role);
    
    return role;
  }

  async updateRole(
    roleId: string,
    updates: Partial<Role>
  ): Promise<Role | null> {
    const role = this.roles.get(roleId);
    if (!role) return null;

    if (role.isSystem && updates.permissions) {
      throw new Error('Cannot modify permissions of system roles');
    }

    const updatedRole = {
      ...role,
      ...updates,
      updatedAt: new Date()
    };

    this.roles.set(roleId, updatedRole);
    this.clearCache();
    this.emit('role:updated', updatedRole);
    
    return updatedRole;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role) return false;

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    // Remove all user assignments
    for (const [userId, userRoles] of this.userRoles) {
      const filteredRoles = userRoles.filter(ur => ur.roleId !== roleId);
      if (filteredRoles.length !== userRoles.length) {
        this.userRoles.set(userId, filteredRoles);
      }
    }

    // Remove from parent roles
    for (const r of this.roles.values()) {
      if (r.parentRoles?.includes(roleId)) {
        r.parentRoles = r.parentRoles.filter(p => p !== roleId);
        r.updatedAt = new Date();
      }
    }

    this.roles.delete(roleId);
    this.clearCache();
    this.emit('role:deleted', role);
    
    return true;
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getOrganizationRoles(organizationId: string): Role[] {
    return Array.from(this.roles.values())
      .filter(r => r.organizationId === organizationId || r.isSystem);
  }

  // User Role Assignment
  async assignRole(
    userId: string,
    roleId: string,
    organizationId: string,
    assignedBy: string,
    options?: {
      scope?: ResourceScope;
      expiresAt?: Date;
    }
  ): Promise<UserRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (!role.isSystem && role.organizationId !== organizationId) {
      throw new Error('Role does not belong to organization');
    }

    const userRole: UserRole = {
      id: crypto.randomUUID(),
      userId,
      roleId,
      organizationId,
      scope: options?.scope,
      expiresAt: options?.expiresAt,
      assignedBy,
      assignedAt: new Date()
    };

    const currentRoles = this.userRoles.get(userId) || [];
    
    // Check for duplicate assignment
    const existingAssignment = currentRoles.find(ur => 
      ur.roleId === roleId && 
      ur.organizationId === organizationId &&
      JSON.stringify(ur.scope) === JSON.stringify(options?.scope)
    );

    if (existingAssignment) {
      throw new Error('User already has this role assignment');
    }

    currentRoles.push(userRole);
    this.userRoles.set(userId, currentRoles);
    
    this.clearUserCache(userId);
    this.emit('role:assigned', userRole);
    
    return userRole;
  }

  async revokeRole(
    userId: string,
    roleId: string,
    organizationId: string,
    revokedBy: string
  ): Promise<boolean> {
    const currentRoles = this.userRoles.get(userId) || [];
    const roleIndex = currentRoles.findIndex(ur => 
      ur.roleId === roleId && ur.organizationId === organizationId
    );

    if (roleIndex === -1) return false;

    const revokedRole = currentRoles[roleIndex];
    currentRoles.splice(roleIndex, 1);
    this.userRoles.set(userId, currentRoles);
    
    this.clearUserCache(userId);
    this.emit('role:revoked', { userRole: revokedRole, revokedBy });
    
    return true;
  }

  getUserRoles(userId: string, organizationId?: string): UserRole[] {
    const userRoles = this.userRoles.get(userId) || [];
    const now = new Date();

    // Filter out expired roles
    const activeRoles = userRoles.filter(ur => 
      (!ur.expiresAt || ur.expiresAt > now) &&
      (!organizationId || ur.organizationId === organizationId)
    );

    // Update if we filtered out expired roles
    if (activeRoles.length !== userRoles.length) {
      this.userRoles.set(userId, activeRoles);
    }

    return activeRoles;
  }

  // Access Control
  async checkAccess(
    context: AccessContext,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<AccessDecision> {
    const cacheKey = this.getCacheKey(context, resource, action, resourceId);
    const cached = this.accessCache.get(cacheKey);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.decision;
    }

    const decision = await this.evaluateAccess(context, resource, action, resourceId);
    
    // Cache the decision
    if (decision.cacheHint?.cacheable !== false) {
      const ttl = decision.cacheHint?.ttl || 300000; // 5 minutes default
      this.accessCache.set(cacheKey, {
        decision,
        expiry: Date.now() + ttl
      });
    }

    // Audit log
    this.auditAccess(context, resource, action, resourceId, decision);
    
    return decision;
  }

  private async evaluateAccess(
    context: AccessContext,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<AccessDecision> {
    const userRoles = this.getUserRoles(context.userId, context.organizationId);
    const userPermissions = this.resolveUserPermissions(userRoles);
    
    const matchedPermissions: Permission[] = [];
    const evaluatedConditions: ConditionEvaluation[] = [];

    // Check permissions
    for (const permission of userPermissions) {
      if (this.permissionMatches(permission, resource, action)) {
        matchedPermissions.push(permission);

        // Evaluate conditions
        if (permission.conditions && permission.conditions.length > 0) {
          const conditionResults = this.evaluateConditions(
            permission.conditions,
            context,
            resourceId
          );
          evaluatedConditions.push(...conditionResults);

          // All conditions must pass
          if (conditionResults.every(cr => cr.result)) {
            return {
              allowed: true,
              reason: `Access granted by permission: ${permission.name}`,
              matchedPermissions: [permission],
              evaluatedConditions: conditionResults
            };
          }
        } else {
          // No conditions, permission grants access
          return {
            allowed: true,
            reason: `Access granted by permission: ${permission.name}`,
            matchedPermissions: [permission],
            evaluatedConditions: []
          };
        }
      }
    }

    // Check policies
    const policyDecision = await this.evaluatePolicies(
      context,
      resource,
      action,
      resourceId
    );

    if (policyDecision.allowed) {
      return policyDecision;
    }

    return {
      allowed: false,
      reason: matchedPermissions.length > 0 
        ? 'Permission found but conditions not met'
        : 'No matching permissions found',
      matchedPermissions,
      evaluatedConditions
    };
  }

  private resolveUserPermissions(userRoles: UserRole[]): Permission[] {
    const allPermissions = new Set<Permission>();

    for (const userRole of userRoles) {
      const role = this.roles.get(userRole.roleId);
      if (!role) continue;

      // Add direct permissions
      for (const permissionId of role.permissions) {
        const permission = this.permissions.get(permissionId);
        if (permission) {
          allPermissions.add(permission);
        }
      }

      // Add inherited permissions from parent roles
      this.addInheritedPermissions(role, allPermissions);
    }

    return Array.from(allPermissions);
  }

  private addInheritedPermissions(
    role: Role,
    permissions: Set<Permission>,
    visited: Set<string> = new Set()
  ): void {
    if (visited.has(role.id)) return; // Prevent infinite recursion
    visited.add(role.id);

    if (role.parentRoles) {
      for (const parentRoleId of role.parentRoles) {
        const parentRole = this.roles.get(parentRoleId);
        if (!parentRole) continue;

        // Add parent role permissions
        for (const permissionId of parentRole.permissions) {
          const permission = this.permissions.get(permissionId);
          if (permission) {
            permissions.add(permission);
          }
        }

        // Recursively add inherited permissions
        this.addInheritedPermissions(parentRole, permissions, visited);
      }
    }
  }

  private permissionMatches(
    permission: Permission,
    resource: string,
    action: string
  ): boolean {
    return (permission.resource === resource || permission.resource === '*') &&
           (permission.action === action || permission.action === '*');
  }

  private evaluateConditions(
    conditions: PermissionCondition[],
    context: AccessContext,
    resourceId?: string
  ): ConditionEvaluation[] {
    return conditions.map(condition => {
      const actualValue = condition.contextField
        ? this.getContextValue(context, condition.contextField)
        : this.getResourceValue(context, condition.field, resourceId);

      const result = this.evaluateCondition(condition, actualValue);

      return {
        condition,
        result,
        actualValue,
        expectedValue: condition.value
      };
    });
  }

  private getContextValue(context: AccessContext, field: string): any {
    if (field.startsWith('user.')) {
      const userField = field.substring(5);
      return context.userAttributes?.[userField];
    }
    
    if (field.startsWith('request.')) {
      const requestField = field.substring(8);
      return context.requestContext?.[requestField as keyof typeof context.requestContext];
    }

    return context.userAttributes?.[field];
  }

  private getResourceValue(context: AccessContext, field: string, resourceId?: string): any {
    if (field.startsWith('resource.')) {
      const resourceField = field.substring(9);
      return context.resourceAttributes?.[resourceField];
    }

    if (field === 'resourceId') {
      return resourceId;
    }

    return context.resourceAttributes?.[field];
  }

  private evaluateCondition(condition: PermissionCondition, actualValue: any): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'equals':
        return actualValue === value;
      case 'not_equals':
        return actualValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(actualValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(actualValue);
      case 'contains':
        return String(actualValue).includes(String(value));
      case 'starts_with':
        return String(actualValue).startsWith(String(value));
      case 'greater_than':
        return Number(actualValue) > Number(value);
      case 'less_than':
        return Number(actualValue) < Number(value);
      default:
        return false;
    }
  }

  // Policy Management
  async createPolicy(
    organizationId: string,
    policyData: Omit<RBACPolicy, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Promise<RBACPolicy> {
    const policy: RBACPolicy = {
      id: crypto.randomUUID(),
      organizationId,
      ...policyData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.policies.set(policy.id, policy);
    this.clearCache();
    this.emit('policy:created', policy);
    
    return policy;
  }

  private async evaluatePolicies(
    context: AccessContext,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<AccessDecision> {
    const orgPolicies = Array.from(this.policies.values())
      .filter(p => p.organizationId === context.organizationId && p.isActive)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const policy of orgPolicies) {
      for (const rule of policy.rules) {
        if (this.ruleMatches(rule, context, resource, action)) {
          const conditionResults = rule.conditions
            ? this.evaluateConditions(rule.conditions, context, resourceId)
            : [];

          const conditionsPass = !rule.conditions || conditionResults.every(cr => cr.result);

          if (conditionsPass) {
            return {
              allowed: rule.effect === 'allow',
              reason: `Access ${rule.effect === 'allow' ? 'granted' : 'denied'} by policy: ${policy.name}`,
              matchedPermissions: [],
              evaluatedConditions: conditionResults
            };
          }
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching policies found',
      matchedPermissions: [],
      evaluatedConditions: []
    };
  }

  private ruleMatches(
    rule: PolicyRule,
    context: AccessContext,
    resource: string,
    action: string
  ): boolean {
    // Check resources
    if (!rule.resources.includes('*') && !rule.resources.includes(resource)) {
      return false;
    }

    // Check actions
    if (!rule.actions.includes('*') && !rule.actions.includes(action)) {
      return false;
    }

    // Check principals
    if (rule.principals) {
      if (rule.principals.users && !rule.principals.users.includes(context.userId)) {
        return false;
      }

      if (rule.principals.roles) {
        const userRoles = this.getUserRoles(context.userId, context.organizationId);
        const userRoleIds = userRoles.map(ur => ur.roleId);
        if (!rule.principals.roles.some(roleId => userRoleIds.includes(roleId))) {
          return false;
        }
      }

      // Groups would be checked here if implemented
    }

    return true;
  }

  // Cache Management
  private getCacheKey(
    context: AccessContext,
    resource: string,
    action: string,
    resourceId?: string
  ): string {
    return `${context.userId}:${context.organizationId}:${resource}:${action}:${resourceId || ''}`;
  }

  private clearCache(): void {
    this.accessCache.clear();
  }

  private clearUserCache(userId: string): void {
    for (const key of this.accessCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.accessCache.delete(key);
      }
    }
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.accessCache) {
        if (cached.expiry <= now) {
          this.accessCache.delete(key);
        }
      }
    }, 300000); // Clean every 5 minutes
  }

  // Audit Logging
  private auditAccess(
    context: AccessContext,
    resource: string,
    action: string,
    resourceId: string | undefined,
    decision: AccessDecision
  ): void {
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      organizationId: context.organizationId,
      userId: context.userId,
      action,
      resource,
      resourceId,
      decision: decision.allowed ? 'allowed' : 'denied',
      reason: decision.reason,
      context,
      timestamp: new Date()
    };

    this.auditLog.push(auditEntry);
    this.emit('access:audited', auditEntry);

    // Keep only recent entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }

  getAuditLog(
    organizationId: string,
    filters?: {
      userId?: string;
      resource?: string;
      action?: string;
      decision?: 'allowed' | 'denied';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): AuditEntry[] {
    let entries = this.auditLog.filter(entry => entry.organizationId === organizationId);

    if (filters) {
      if (filters.userId) entries = entries.filter(e => e.userId === filters.userId);
      if (filters.resource) entries = entries.filter(e => e.resource === filters.resource);
      if (filters.action) entries = entries.filter(e => e.action === filters.action);
      if (filters.decision) entries = entries.filter(e => e.decision === filters.decision);
      if (filters.startDate) entries = entries.filter(e => e.timestamp >= filters.startDate!);
      if (filters.endDate) entries = entries.filter(e => e.timestamp <= filters.endDate!);
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  // System Initialization
  private initializeSystemPermissions(): void {
    const systemPermissions = [
      { name: 'admin.full', description: 'Full administrative access', resource: '*', action: '*' },
      { name: 'admin.users', description: 'User management', resource: 'users', action: '*' },
      { name: 'admin.roles', description: 'Role management', resource: 'roles', action: '*' },
      { name: 'admin.permissions', description: 'Permission management', resource: 'permissions', action: '*' },
      { name: 'admin.organization', description: 'Organization management', resource: 'organization', action: '*' },
      { name: 'user.read', description: 'Read user information', resource: 'users', action: 'read' },
      { name: 'user.update', description: 'Update user information', resource: 'users', action: 'update' },
      { name: 'content.read', description: 'Read content', resource: 'content', action: 'read' },
      { name: 'content.write', description: 'Write content', resource: 'content', action: 'write' },
      { name: 'content.delete', description: 'Delete content', resource: 'content', action: 'delete' },
    ];

    systemPermissions.forEach(permData => {
      const permission: Permission = {
        id: crypto.randomUUID(),
        ...permData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.permissions.set(permission.id, permission);
    });
  }

  private initializeSystemRoles(): void {
    const adminPermissions = Array.from(this.permissions.values())
      .filter(p => p.name.startsWith('admin.'))
      .map(p => p.id);

    const userPermissions = Array.from(this.permissions.values())
      .filter(p => p.name.startsWith('user.') || p.name === 'content.read')
      .map(p => p.id);

    const systemRoles = [
      {
        name: 'System Administrator',
        description: 'Full system access',
        permissions: adminPermissions,
        isSystem: true
      },
      {
        name: 'Organization Admin',
        description: 'Organization management access',
        permissions: Array.from(this.permissions.values())
          .filter(p => !p.name.includes('admin.permissions'))
          .map(p => p.id),
        isSystem: true
      },
      {
        name: 'User',
        description: 'Basic user access',
        permissions: userPermissions,
        isSystem: true
      }
    ];

    systemRoles.forEach(roleData => {
      const role: Role = {
        id: crypto.randomUUID(),
        organizationId: 'system',
        ...roleData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.roles.set(role.id, role);
    });
  }

  // Statistics
  getStatistics(organizationId: string): {
    totalUsers: number;
    totalRoles: number;
    totalPermissions: number;
    recentAccessAttempts: number;
    accessDeniedRate: number;
  } {
    const orgRoles = this.getOrganizationRoles(organizationId);
    const recentLogs = this.auditLog.filter(log => 
      log.organizationId === organizationId &&
      log.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const deniedAttempts = recentLogs.filter(log => log.decision === 'denied').length;
    const accessDeniedRate = recentLogs.length > 0 ? deniedAttempts / recentLogs.length : 0;

    // Count unique users with roles in this organization
    const usersWithRoles = new Set();
    for (const [userId, userRoles] of this.userRoles) {
      if (userRoles.some(ur => ur.organizationId === organizationId)) {
        usersWithRoles.add(userId);
      }
    }

    return {
      totalUsers: usersWithRoles.size,
      totalRoles: orgRoles.length,
      totalPermissions: this.permissions.size,
      recentAccessAttempts: recentLogs.length,
      accessDeniedRate
    };
  }
}

export default new RBACSystem();