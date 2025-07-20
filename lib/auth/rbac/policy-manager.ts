import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/cache';

export interface Policy {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: PolicyCondition[];
  targetType: 'user' | 'role' | 'group' | 'global';
  targetId?: string;
  priority: number;
  active: boolean;
  validFrom?: Date;
  validUntil?: Date;
  metadata?: Record<string, any>;
}

export interface PolicyCondition {
  type: 'attribute' | 'time' | 'location' | 'custom';
  operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'notIn' | 'greaterThan' | 'lessThan';
  field: string;
  value: any;
}

export interface PolicyEvaluation {
  policy: Policy;
  result: 'allow' | 'deny' | 'notApplicable';
  reason?: string;
  conditionResults?: Array<{
    condition: PolicyCondition;
    passed: boolean;
    reason?: string;
  }>;
}

export class PolicyManager {
  private static instance: PolicyManager;
  private policyCache = new Map<string, Policy[]>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  private constructor() {}

  static getInstance(): PolicyManager {
    if (!PolicyManager.instance) {
      PolicyManager.instance = new PolicyManager();
    }
    return PolicyManager.instance;
  }

  /**
   * Create a new policy
   */
  async createPolicy(data: Omit<Policy, 'id'>): Promise<Policy> {
    // Validate policy data
    this.validatePolicy(data);

    const policy = await prisma.policy.create({
      data: {
        name: data.name,
        description: data.description,
        resource: data.resource,
        action: data.action,
        effect: data.effect,
        conditions: data.conditions as any,
        targetType: data.targetType,
        targetId: data.targetId,
        priority: data.priority,
        active: data.active,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        metadata: data.metadata
      }
    });

    this.clearCache();

    await this.logPolicyAction('policy.created', policy);

    return policy;
  }

  /**
   * Update policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<Omit<Policy, 'id'>>
  ): Promise<Policy> {
    if (updates.conditions !== undefined || updates.effect !== undefined) {
      this.validatePolicy({ ...updates } as Policy);
    }

    const policy = await prisma.policy.update({
      where: { id: policyId },
      data: updates
    });

    this.clearCache();

    await this.logPolicyAction('policy.updated', policy);

    return policy;
  }

  /**
   * Delete policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    await prisma.policy.delete({
      where: { id: policyId }
    });

    this.clearCache();

    await this.logPolicyAction('policy.deleted', { id: policyId });
  }

  /**
   * Evaluate policies for a given context
   */
  async evaluatePolicies(context: {
    userId: string;
    resource: string;
    action: string;
    attributes?: Record<string, any>;
    environment?: Record<string, any>;
  }): Promise<PolicyEvaluation[]> {
    // Get applicable policies
    const policies = await this.getApplicablePolicies(context);
    const evaluations: PolicyEvaluation[] = [];

    for (const policy of policies) {
      const evaluation = await this.evaluatePolicy(policy, context);
      evaluations.push(evaluation);
    }

    // Sort by priority (higher priority first)
    evaluations.sort((a, b) => b.policy.priority - a.policy.priority);

    return evaluations;
  }

  /**
   * Get final decision based on policy evaluations
   */
  getFinalDecision(evaluations: PolicyEvaluation[]): {
    decision: 'allow' | 'deny';
    reason: string;
    appliedPolicies: string[];
  } {
    const appliedPolicies: string[] = [];
    let finalDecision: 'allow' | 'deny' = 'deny'; // Default deny
    let reason = 'No applicable policies found';

    for (const evaluation of evaluations) {
      if (evaluation.result === 'notApplicable') continue;

      appliedPolicies.push(evaluation.policy.name);

      // Explicit deny takes precedence
      if (evaluation.policy.effect === 'deny' && evaluation.result === 'deny') {
        return {
          decision: 'deny',
          reason: `Denied by policy: ${evaluation.policy.name}`,
          appliedPolicies
        };
      }

      // Allow if any allow policy matches
      if (evaluation.policy.effect === 'allow' && evaluation.result === 'allow') {
        finalDecision = 'allow';
        reason = `Allowed by policy: ${evaluation.policy.name}`;
      }
    }

    return { decision: finalDecision, reason, appliedPolicies };
  }

  /**
   * Get policies by target
   */
  async getPoliciesByTarget(
    targetType: Policy['targetType'],
    targetId?: string
  ): Promise<Policy[]> {
    const where: any = { targetType };
    if (targetId) where.targetId = targetId;

    const policies = await prisma.policy.findMany({
      where,
      orderBy: { priority: 'desc' }
    });

    return policies;
  }

  /**
   * Get policies by resource
   */
  async getPoliciesByResource(
    resource: string,
    action?: string
  ): Promise<Policy[]> {
    const where: any = { resource };
    if (action) where.action = action;

    const policies = await prisma.policy.findMany({
      where,
      orderBy: { priority: 'desc' }
    });

    return policies;
  }

  /**
   * Duplicate policy
   */
  async duplicatePolicy(
    policyId: string,
    newName: string
  ): Promise<Policy> {
    const original = await prisma.policy.findUnique({
      where: { id: policyId }
    });

    if (!original) {
      throw new Error('Policy not found');
    }

    const duplicate = await this.createPolicy({
      ...original,
      id: undefined as any,
      name: newName,
      active: false // Start as inactive
    });

    return duplicate;
  }

  /**
   * Get applicable policies for context
   */
  private async getApplicablePolicies(context: {
    userId: string;
    resource: string;
    action: string;
  }): Promise<Policy[]> {
    const cacheKey = `policies:${context.resource}:${context.action}`;
    
    if (this.isCacheValid() && this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey)!;
    }

    // Get user's roles and groups
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        roles: true,
        groups: true
      }
    });

    if (!user) return [];

    const roleIds = user.roles.map(r => r.roleId);
    const groupIds = user.groups?.map(g => g.groupId) || [];

    // Get applicable policies
    const policies = await prisma.policy.findMany({
      where: {
        AND: [
          { resource: context.resource },
          { action: context.action },
          { active: true },
          {
            OR: [
              { validFrom: null },
              { validFrom: { lte: new Date() } }
            ]
          },
          {
            OR: [
              { validUntil: null },
              { validUntil: { gte: new Date() } }
            ]
          },
          {
            OR: [
              { targetType: 'global', targetId: null },
              { targetType: 'user', targetId: context.userId },
              { targetType: 'role', targetId: { in: roleIds } },
              { targetType: 'group', targetId: { in: groupIds } }
            ]
          }
        ]
      },
      orderBy: { priority: 'desc' }
    });

    // Cache the results
    this.policyCache.set(cacheKey, policies);
    this.lastCacheUpdate = Date.now();

    return policies;
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: Policy,
    context: any
  ): Promise<PolicyEvaluation> {
    // Check if policy has conditions
    if (!policy.conditions || policy.conditions.length === 0) {
      return {
        policy,
        result: policy.effect,
        reason: 'No conditions to evaluate'
      };
    }

    // Evaluate all conditions
    const conditionResults = await Promise.all(
      (policy.conditions as PolicyCondition[]).map(condition => 
        this.evaluateCondition(condition, context)
      )
    );

    // All conditions must pass
    const allPassed = conditionResults.every(r => r.passed);

    return {
      policy,
      result: allPassed ? policy.effect : 'notApplicable',
      reason: allPassed 
        ? 'All conditions passed' 
        : 'One or more conditions failed',
      conditionResults
    };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: PolicyCondition,
    context: any
  ): Promise<{ condition: PolicyCondition; passed: boolean; reason?: string }> {
    try {
      let fieldValue: any;

      // Get field value based on type
      switch (condition.type) {
        case 'attribute':
          fieldValue = this.getNestedValue(context.attributes || {}, condition.field);
          break;
        case 'time':
          fieldValue = this.getTimeValue(condition.field);
          break;
        case 'location':
          fieldValue = this.getLocationValue(context.environment || {}, condition.field);
          break;
        case 'custom':
          fieldValue = await this.evaluateCustomField(condition.field, context);
          break;
      }

      // Evaluate operator
      const passed = this.evaluateOperator(
        fieldValue,
        condition.operator,
        condition.value
      );

      return {
        condition,
        passed,
        reason: passed ? 'Condition met' : `Expected ${condition.operator} ${condition.value}, got ${fieldValue}`
      };
    } catch (error) {
      logger.error('Error evaluating condition:', error);
      return {
        condition,
        passed: false,
        reason: 'Error evaluating condition'
      };
    }
  }

  /**
   * Evaluate operator
   */
  private evaluateOperator(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'notEquals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'greaterThan':
        return Number(fieldValue) > Number(expectedValue);
      case 'lessThan':
        return Number(fieldValue) < Number(expectedValue);
      default:
        return false;
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get time-based value
   */
  private getTimeValue(field: string): any {
    const now = new Date();

    switch (field) {
      case 'hour':
        return now.getHours();
      case 'dayOfWeek':
        return now.getDay();
      case 'dayOfMonth':
        return now.getDate();
      case 'month':
        return now.getMonth() + 1;
      case 'year':
        return now.getFullYear();
      case 'timestamp':
        return now.getTime();
      default:
        return null;
    }
  }

  /**
   * Get location-based value
   */
  private getLocationValue(environment: any, field: string): any {
    switch (field) {
      case 'ipAddress':
        return environment.ipAddress;
      case 'country':
        return environment.country;
      case 'region':
        return environment.region;
      case 'city':
        return environment.city;
      default:
        return null;
    }
  }

  /**
   * Evaluate custom field
   */
  private async evaluateCustomField(field: string, context: any): Promise<any> {
    // Implement custom field evaluation logic
    // This could call external services or run custom functions
    return null;
  }

  /**
   * Validate policy
   */
  private validatePolicy(policy: Partial<Policy>): void {
    if (policy.effect && !['allow', 'deny'].includes(policy.effect)) {
      throw new Error('Invalid policy effect');
    }

    if (policy.conditions) {
      for (const condition of policy.conditions) {
        if (!['attribute', 'time', 'location', 'custom'].includes(condition.type)) {
          throw new Error('Invalid condition type');
        }

        const validOperators = [
          'equals', 'notEquals', 'contains', 'in', 'notIn', 'greaterThan', 'lessThan'
        ];
        if (!validOperators.includes(condition.operator)) {
          throw new Error('Invalid condition operator');
        }
      }
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheTimeout;
  }

  /**
   * Clear cache
   */
  private clearCache(): void {
    this.policyCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Log policy action
   */
  private async logPolicyAction(action: string, data: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          userId: 'system',
          metadata: data,
          ipAddress: 'system',
          userAgent: 'policy-manager'
        }
      });
    } catch (error) {
      logger.error('Failed to log policy action:', error);
    }
  }

  /**
   * Get policy statistics
   */
  async getPolicyStats(): Promise<{
    totalPolicies: number;
    activePolices: number;
    policiesByType: Record<string, number>;
    policiesByEffect: Record<string, number>;
    avgConditionsPerPolicy: number;
  }> {
    const policies = await prisma.policy.findMany();

    const stats = {
      totalPolicies: policies.length,
      activePolices: policies.filter(p => p.active).length,
      policiesByType: {} as Record<string, number>,
      policiesByEffect: {} as Record<string, number>,
      avgConditionsPerPolicy: 0
    };

    let totalConditions = 0;

    for (const policy of policies) {
      // Count by type
      stats.policiesByType[policy.targetType] = 
        (stats.policiesByType[policy.targetType] || 0) + 1;

      // Count by effect
      stats.policiesByEffect[policy.effect] = 
        (stats.policiesByEffect[policy.effect] || 0) + 1;

      // Count conditions
      if (policy.conditions) {
        totalConditions += (policy.conditions as any[]).length;
      }
    }

    stats.avgConditionsPerPolicy = 
      policies.length > 0 ? totalConditions / policies.length : 0;

    return stats;
  }
}