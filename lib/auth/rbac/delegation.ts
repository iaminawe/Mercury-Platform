/**
 * Permission Delegation System
 * Allows temporary delegation of permissions with advanced controls
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { PermissionEngine } from './permission-engine';

// Delegation schema
const DelegationSchema = z.object({
  id: z.string(),
  delegatorId: z.string(),
  delegateeId: z.string(),
  permissions: z.array(z.object({
    resource: z.string(),
    action: z.string(),
    conditions: z.record(z.any()).optional(),
  })),
  constraints: z.object({
    maxUsage: z.number().optional(),
    expiresAt: z.date(),
    allowSubDelegation: z.boolean().default(false),
    requireApproval: z.boolean().default(false),
    ipWhitelist: z.array(z.string()).optional(),
    timeWindows: z.array(z.object({
      start: z.string(), // HH:MM format
      end: z.string(),
      timezone: z.string().default('UTC'),
      daysOfWeek: z.array(z.number()).optional(), // 0-6, Sunday-Saturday
    })).optional(),
  }),
  metadata: z.object({
    reason: z.string(),
    approvedBy: z.string().optional(),
    approvedAt: z.date().optional(),
    businessJustification: z.string().optional(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  }),
  status: z.enum(['pending', 'active', 'expired', 'revoked', 'exhausted']),
  usageCount: z.number().default(0),
  lastUsedAt: z.date().optional(),
});

export type Delegation = z.infer<typeof DelegationSchema>;

export interface DelegationRequest {
  delegatorId: string;
  delegateeId: string;
  permissions: Array<{
    resource: string;
    action: string;
    conditions?: Record<string, any>;
  }>;
  duration: number; // in seconds
  reason: string;
  constraints?: {
    maxUsage?: number;
    allowSubDelegation?: boolean;
    requireApproval?: boolean;
    ipWhitelist?: string[];
    timeWindows?: Array<{
      start: string;
      end: string;
      timezone?: string;
      daysOfWeek?: number[];
    }>;
  };
  businessJustification?: string;
}

export class DelegationManager {
  private static instance: DelegationManager;
  private permissionEngine: PermissionEngine;

  private constructor() {
    this.permissionEngine = PermissionEngine.getInstance();
  }

  static getInstance(): DelegationManager {
    if (!DelegationManager.instance) {
      DelegationManager.instance = new DelegationManager();
    }
    return DelegationManager.instance;
  }

  /**
   * Create a delegation request
   */
  async createDelegation(request: DelegationRequest): Promise<Delegation> {
    try {
      // Validate delegator has the permissions they're trying to delegate
      const hasPermissions = await this.validateDelegatorPermissions(
        request.delegatorId,
        request.permissions
      );

      if (!hasPermissions) {
        throw new Error('Delegator does not have all requested permissions');
      }

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(request);

      // Create delegation
      const delegation: Delegation = {
        id: this.generateDelegationId(),
        delegatorId: request.delegatorId,
        delegateeId: request.delegateeId,
        permissions: request.permissions,
        constraints: {
          expiresAt: new Date(Date.now() + request.duration * 1000),
          maxUsage: request.constraints?.maxUsage,
          allowSubDelegation: request.constraints?.allowSubDelegation || false,
          requireApproval: request.constraints?.requireApproval || false,
          ipWhitelist: request.constraints?.ipWhitelist,
          timeWindows: request.constraints?.timeWindows,
        },
        metadata: {
          reason: request.reason,
          businessJustification: request.businessJustification,
          riskLevel,
        },
        status: request.constraints?.requireApproval ? 'pending' : 'active',
        usageCount: 0,
      };

      // Validate against organization policies
      await this.validateAgainstPolicies(delegation);

      // Store in database
      const created = await prisma.delegation.create({
        data: {
          ...delegation,
          permissions: JSON.stringify(delegation.permissions),
          constraints: JSON.stringify(delegation.constraints),
          metadata: JSON.stringify(delegation.metadata),
        },
      });

      // Send notifications
      await this.notifyDelegation(delegation);

      // Log delegation
      await this.logDelegation('created', delegation);

      return delegation;
    } catch (error) {
      logger.error('Failed to create delegation:', error);
      throw error;
    }
  }

  /**
   * Approve a pending delegation
   */
  async approveDelegation(delegationId: string, approverId: string): Promise<Delegation> {
    const delegation = await this.getDelegation(delegationId);
    
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.status !== 'pending') {
      throw new Error('Delegation is not pending approval');
    }

    // Check if approver has authority
    const hasAuthority = await this.checkApprovalAuthority(approverId, delegation);
    if (!hasAuthority) {
      throw new Error('Approver does not have authority to approve this delegation');
    }

    // Update delegation
    delegation.status = 'active';
    delegation.metadata.approvedBy = approverId;
    delegation.metadata.approvedAt = new Date();

    await prisma.delegation.update({
      where: { id: delegationId },
      data: {
        status: 'active',
        metadata: JSON.stringify(delegation.metadata),
      },
    });

    // Notify parties
    await this.notifyApproval(delegation);

    // Log approval
    await this.logDelegation('approved', delegation);

    return delegation;
  }

  /**
   * Check if user has delegated permission
   */
  async checkDelegatedPermission(
    userId: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<{ allowed: boolean; delegation?: Delegation; reason?: string }> {
    try {
      // Get active delegations for user
      const delegations = await this.getActiveDelegations(userId);

      for (const delegation of delegations) {
        // Check if delegation includes required permission
        const hasPermission = delegation.permissions.some(p => 
          this.matchesPermission(p, resource, action)
        );

        if (!hasPermission) continue;

        // Validate constraints
        const constraintResult = await this.validateConstraints(delegation, context);
        if (!constraintResult.valid) {
          continue;
        }

        // Check usage limit
        if (delegation.constraints.maxUsage && 
            delegation.usageCount >= delegation.constraints.maxUsage) {
          await this.updateDelegationStatus(delegation.id, 'exhausted');
          continue;
        }

        // Record usage
        await this.recordDelegationUsage(delegation.id);

        return {
          allowed: true,
          delegation,
        };
      }

      return {
        allowed: false,
        reason: 'No valid delegation found',
      };
    } catch (error) {
      logger.error('Error checking delegated permission:', error);
      return {
        allowed: false,
        reason: 'Error checking delegation',
      };
    }
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(delegationId: string, revokedBy: string, reason: string): Promise<void> {
    const delegation = await this.getDelegation(delegationId);
    
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Check if user can revoke
    if (delegation.delegatorId !== revokedBy && 
        !await this.isAdmin(revokedBy)) {
      throw new Error('Unauthorized to revoke this delegation');
    }

    // Update status
    await prisma.delegation.update({
      where: { id: delegationId },
      data: {
        status: 'revoked',
        metadata: JSON.stringify({
          ...delegation.metadata,
          revokedBy,
          revokedAt: new Date(),
          revocationReason: reason,
        }),
      },
    });

    // Notify parties
    await this.notifyRevocation(delegation, reason);

    // Log revocation
    await this.logDelegation('revoked', delegation);
  }

  /**
   * Get delegation by ID
   */
  private async getDelegation(delegationId: string): Promise<Delegation | null> {
    const delegation = await prisma.delegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) return null;

    return {
      ...delegation,
      permissions: JSON.parse(delegation.permissions as string),
      constraints: JSON.parse(delegation.constraints as string),
      metadata: JSON.parse(delegation.metadata as string),
    } as Delegation;
  }

  /**
   * Get active delegations for a user
   */
  private async getActiveDelegations(userId: string): Promise<Delegation[]> {
    const delegations = await prisma.delegation.findMany({
      where: {
        delegateeId: userId,
        status: 'active',
        constraints: {
          path: '$.expiresAt',
          gte: new Date().toISOString(),
        },
      },
    });

    return delegations.map(d => ({
      ...d,
      permissions: JSON.parse(d.permissions as string),
      constraints: JSON.parse(d.constraints as string),
      metadata: JSON.parse(d.metadata as string),
    })) as Delegation[];
  }

  /**
   * Validate delegator has permissions
   */
  private async validateDelegatorPermissions(
    delegatorId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    for (const perm of permissions) {
      const result = await this.permissionEngine.checkPermission({
        userId: delegatorId,
        resource: perm.resource,
        action: perm.action,
      });

      if (!result.granted) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate risk level for delegation
   */
  private calculateRiskLevel(request: DelegationRequest): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    // Long duration increases risk
    if (request.duration > 7 * 24 * 60 * 60) score += 3; // > 7 days
    else if (request.duration > 24 * 60 * 60) score += 2; // > 1 day
    else if (request.duration > 60 * 60) score += 1; // > 1 hour

    // Sensitive resources increase risk
    const sensitiveResources = ['admin', 'billing', 'security', 'audit'];
    if (request.permissions.some(p => sensitiveResources.some(r => p.resource.includes(r)))) {
      score += 3;
    }

    // Write/delete actions increase risk
    const riskyActions = ['delete', 'create', 'update', 'admin'];
    if (request.permissions.some(p => riskyActions.some(a => p.action.includes(a)))) {
      score += 2;
    }

    // Sub-delegation increases risk
    if (request.constraints?.allowSubDelegation) {
      score += 2;
    }

    // No approval required increases risk
    if (!request.constraints?.requireApproval) {
      score += 1;
    }

    // Map score to risk level
    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Validate delegation against organization policies
   */
  private async validateAgainstPolicies(delegation: Delegation): Promise<void> {
    // Check max delegation duration policy
    const maxDurationPolicy = await prisma.organizationPolicy.findFirst({
      where: { type: 'max_delegation_duration', active: true },
    });

    if (maxDurationPolicy) {
      const maxDuration = maxDurationPolicy.value as number;
      const duration = (delegation.constraints.expiresAt.getTime() - Date.now()) / 1000;
      
      if (duration > maxDuration) {
        throw new Error(`Delegation duration exceeds maximum allowed: ${maxDuration} seconds`);
      }
    }

    // Check high-risk delegation policy
    if (delegation.metadata.riskLevel === 'critical' || delegation.metadata.riskLevel === 'high') {
      const highRiskPolicy = await prisma.organizationPolicy.findFirst({
        where: { type: 'high_risk_delegation_approval', active: true },
      });

      if (highRiskPolicy && highRiskPolicy.value === true) {
        delegation.constraints.requireApproval = true;
      }
    }

    // Check sensitive resource policies
    const sensitiveResourcePolicies = await prisma.organizationPolicy.findMany({
      where: { 
        type: 'sensitive_resource_delegation',
        active: true,
      },
    });

    for (const policy of sensitiveResourcePolicies) {
      const resources = policy.value as string[];
      const hasSensitive = delegation.permissions.some(p => 
        resources.some(r => p.resource.includes(r))
      );

      if (hasSensitive) {
        // Apply policy restrictions
        delegation.constraints.requireApproval = true;
        delegation.constraints.allowSubDelegation = false;
      }
    }
  }

  /**
   * Validate delegation constraints
   */
  private async validateConstraints(
    delegation: Delegation,
    context?: Record<string, any>
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check expiration
    if (new Date() > delegation.constraints.expiresAt) {
      await this.updateDelegationStatus(delegation.id, 'expired');
      return { valid: false, reason: 'Delegation expired' };
    }

    // Check IP whitelist
    if (delegation.constraints.ipWhitelist?.length && context?.ipAddress) {
      if (!delegation.constraints.ipWhitelist.includes(context.ipAddress)) {
        return { valid: false, reason: 'IP address not whitelisted' };
      }
    }

    // Check time windows
    if (delegation.constraints.timeWindows?.length) {
      const now = new Date();
      const isInWindow = delegation.constraints.timeWindows.some(window => {
        return this.isInTimeWindow(now, window);
      });

      if (!isInWindow) {
        return { valid: false, reason: 'Outside allowed time window' };
      }
    }

    return { valid: true };
  }

  /**
   * Check if current time is within time window
   */
  private isInTimeWindow(now: Date, window: any): boolean {
    // Convert to specified timezone
    const timezone = window.timezone || 'UTC';
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    
    const currentTime = localTime.getHours() * 60 + localTime.getMinutes();
    const windowStart = this.parseTime(window.start);
    const windowEnd = this.parseTime(window.end);

    // Check day of week if specified
    if (window.daysOfWeek?.length) {
      const currentDay = localTime.getDay();
      if (!window.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    // Check time range
    if (windowEnd > windowStart) {
      return currentTime >= windowStart && currentTime <= windowEnd;
    } else {
      // Handles overnight windows (e.g., 22:00 - 02:00)
      return currentTime >= windowStart || currentTime <= windowEnd;
    }
  }

  /**
   * Parse time string (HH:MM) to minutes
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if permission matches
   */
  private matchesPermission(
    permission: { resource: string; action: string },
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
   * Check approval authority
   */
  private async checkApprovalAuthority(approverId: string, delegation: Delegation): Promise<boolean> {
    // Check if approver is admin
    if (await this.isAdmin(approverId)) {
      return true;
    }

    // Check if approver is delegator's manager
    const delegator = await prisma.user.findUnique({
      where: { id: delegation.delegatorId },
      include: { manager: true },
    });

    if (delegator?.managerId === approverId) {
      return true;
    }

    // Check if approver has delegation approval permission
    const result = await this.permissionEngine.checkPermission({
      userId: approverId,
      resource: 'delegation',
      action: 'approve',
      context: { delegationRiskLevel: delegation.metadata.riskLevel },
    });

    return result.granted;
  }

  /**
   * Check if user is admin
   */
  private async isAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    return user?.roles.some(r => r.role.name === 'admin' || r.role.name === 'superadmin') || false;
  }

  /**
   * Update delegation status
   */
  private async updateDelegationStatus(delegationId: string, status: Delegation['status']): Promise<void> {
    await prisma.delegation.update({
      where: { id: delegationId },
      data: { status },
    });
  }

  /**
   * Record delegation usage
   */
  private async recordDelegationUsage(delegationId: string): Promise<void> {
    await prisma.delegation.update({
      where: { id: delegationId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Send delegation notifications
   */
  private async notifyDelegation(delegation: Delegation): Promise<void> {
    // Implementation would send notifications via email, Slack, etc.
    logger.info('Delegation created notification', {
      delegationId: delegation.id,
      delegator: delegation.delegatorId,
      delegatee: delegation.delegateeId,
    });
  }

  /**
   * Send approval notifications
   */
  private async notifyApproval(delegation: Delegation): Promise<void> {
    logger.info('Delegation approved notification', {
      delegationId: delegation.id,
      approvedBy: delegation.metadata.approvedBy,
    });
  }

  /**
   * Send revocation notifications
   */
  private async notifyRevocation(delegation: Delegation, reason: string): Promise<void> {
    logger.info('Delegation revoked notification', {
      delegationId: delegation.id,
      reason,
    });
  }

  /**
   * Log delegation events
   */
  private async logDelegation(action: string, delegation: Delegation): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: `delegation.${action}`,
          userId: delegation.delegatorId,
          metadata: {
            delegationId: delegation.id,
            delegatee: delegation.delegateeId,
            permissions: delegation.permissions,
            riskLevel: delegation.metadata.riskLevel,
          },
          ipAddress: 'system',
          userAgent: 'delegation-manager',
        },
      });
    } catch (error) {
      logger.error('Failed to log delegation event:', error);
    }
  }

  /**
   * Generate unique delegation ID
   */
  private generateDelegationId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get delegation analytics
   */
  async getDelegationAnalytics(timeRange: { start: Date; end: Date }): Promise<any> {
    const delegations = await prisma.delegation.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
    });

    return {
      total: delegations.length,
      byStatus: this.groupBy(delegations, 'status'),
      byRiskLevel: this.groupBy(delegations.map(d => ({
        ...d,
        riskLevel: JSON.parse(d.metadata as string).riskLevel,
      })), 'riskLevel'),
      averageDuration: this.calculateAverageDuration(delegations),
      mostDelegatedPermissions: this.getMostDelegatedPermissions(delegations),
    };
  }

  /**
   * Group by helper
   */
  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Calculate average delegation duration
   */
  private calculateAverageDuration(delegations: any[]): number {
    if (delegations.length === 0) return 0;

    const durations = delegations.map(d => {
      const constraints = JSON.parse(d.constraints as string);
      return (new Date(constraints.expiresAt).getTime() - new Date(d.createdAt).getTime()) / 1000;
    });

    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  /**
   * Get most delegated permissions
   */
  private getMostDelegatedPermissions(delegations: any[]): Array<{ permission: string; count: number }> {
    const permissionCounts: Record<string, number> = {};

    delegations.forEach(d => {
      const permissions = JSON.parse(d.permissions as string);
      permissions.forEach((p: any) => {
        const key = `${p.resource}:${p.action}`;
        permissionCounts[key] = (permissionCounts[key] || 0) + 1;
      });
    });

    return Object.entries(permissionCounts)
      .map(([permission, count]) => ({ permission, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

// Export singleton instance
export const delegationManager = DelegationManager.getInstance();