/**
 * Enterprise Audit Logger
 * Comprehensive audit logging for compliance (SOC 2, GDPR, HIPAA)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

// Audit event schema
const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  actor: z.object({
    id: z.string(),
    type: z.enum(['user', 'service', 'system', 'api']),
    name: z.string(),
    email: z.string().optional(),
    roles: z.array(z.string()).optional(),
  }),
  action: z.object({
    type: z.string(),
    category: z.enum(['auth', 'data', 'config', 'security', 'compliance', 'admin']),
    resource: z.string(),
    operation: z.enum(['create', 'read', 'update', 'delete', 'execute', 'grant', 'revoke']),
    result: z.enum(['success', 'failure', 'error']),
  }),
  target: z.object({
    type: z.string(),
    id: z.string(),
    name: z.string().optional(),
    attributes: z.record(z.any()).optional(),
  }).optional(),
  context: z.object({
    ipAddress: z.string(),
    userAgent: z.string(),
    sessionId: z.string().optional(),
    requestId: z.string(),
    geoLocation: z.object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional(),
    }).optional(),
    deviceInfo: z.object({
      type: z.string(),
      os: z.string(),
      browser: z.string().optional(),
    }).optional(),
  }),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.any(),
    newValue: z.any(),
    encrypted: z.boolean().default(false),
  })).optional(),
  compliance: z.object({
    regulations: z.array(z.enum(['GDPR', 'SOC2', 'HIPAA', 'PCI-DSS', 'ISO27001'])),
    dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
    retentionPeriod: z.number(), // days
    immutable: z.boolean().default(true),
  }),
  risk: z.object({
    score: z.number().min(0).max(100),
    factors: z.array(z.string()),
    alerts: z.array(z.string()).optional(),
  }),
  metadata: z.record(z.any()).optional(),
  hash: z.string(), // For integrity verification
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export interface AuditConfig {
  retentionPolicies: Record<string, number>; // category -> days
  alertThresholds: {
    failureRate: number; // percentage
    riskScore: number;
    timeWindow: number; // seconds
  };
  encryptionKey?: string;
  immutableStorage?: boolean;
  realTimeAlerts?: boolean;
}

export class EnterpriseAuditLogger {
  private static instance: EnterpriseAuditLogger;
  private config: AuditConfig;
  private redis?: Redis;
  private alertCache = new Map<string, { count: number; timestamp: number }>();

  private constructor(config: AuditConfig) {
    this.config = {
      retentionPolicies: {
        auth: 365,
        data: 2555, // 7 years for GDPR
        config: 365,
        security: 2555,
        compliance: 2555,
        admin: 2555,
        ...config.retentionPolicies,
      },
      alertThresholds: {
        failureRate: 10,
        riskScore: 70,
        timeWindow: 300, // 5 minutes
        ...config.alertThresholds,
      },
      ...config,
    };

    // Initialize Redis if available
    if (process.env.UPSTASH_REDIS_REST_URL) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
  }

  static getInstance(config?: AuditConfig): EnterpriseAuditLogger {
    if (!EnterpriseAuditLogger.instance) {
      EnterpriseAuditLogger.instance = new EnterpriseAuditLogger(config || {
        retentionPolicies: {},
        alertThresholds: {
          failureRate: 10,
          riskScore: 70,
          timeWindow: 300,
        },
      });
    }
    return EnterpriseAuditLogger.instance;
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash'>): Promise<AuditEvent> {
    try {
      // Generate event ID and timestamp
      const fullEvent: AuditEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date(),
        hash: '', // Will be set after
      };

      // Calculate hash for integrity
      fullEvent.hash = this.calculateEventHash(fullEvent);

      // Validate event
      AuditEventSchema.parse(fullEvent);

      // Encrypt sensitive data if configured
      if (this.config.encryptionKey && fullEvent.changes) {
        fullEvent.changes = await this.encryptChanges(fullEvent.changes);
      }

      // Store in database
      await this.storeEvent(fullEvent);

      // Real-time processing
      await this.processRealTimeChecks(fullEvent);

      // Cache for analytics
      if (this.redis) {
        await this.cacheEvent(fullEvent);
      }

      return fullEvent;
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(params: {
    userId: string;
    action: 'login' | 'logout' | 'mfa' | 'password_change' | 'session_expired';
    success: boolean;
    method?: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: { roles: { include: { role: true } } },
    });

    await this.logEvent({
      actor: {
        id: params.userId,
        type: 'user',
        name: user?.name || 'Unknown',
        email: user?.email,
        roles: user?.roles.map(r => r.role.name),
      },
      action: {
        type: `auth.${params.action}`,
        category: 'auth',
        resource: 'authentication',
        operation: 'execute',
        result: params.success ? 'success' : 'failure',
      },
      context: {
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: this.generateRequestId(),
        geoLocation: await this.getGeoLocation(params.ipAddress),
        deviceInfo: this.parseDeviceInfo(params.userAgent),
      },
      compliance: {
        regulations: ['SOC2', 'GDPR'],
        dataClassification: 'confidential',
        retentionPeriod: this.config.retentionPolicies.auth,
        immutable: true,
      },
      risk: {
        score: this.calculateAuthRiskScore(params),
        factors: this.getAuthRiskFactors(params),
      },
      metadata: {
        ...params.metadata,
        method: params.method,
      },
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(params: {
    userId: string;
    resourceType: string;
    resourceId: string;
    operation: 'read' | 'export' | 'download';
    fields?: string[];
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });

    await this.logEvent({
      actor: {
        id: params.userId,
        type: 'user',
        name: user?.name || 'Unknown',
        email: user?.email,
      },
      action: {
        type: `data.${params.operation}`,
        category: 'data',
        resource: params.resourceType,
        operation: 'read',
        result: 'success',
      },
      target: {
        type: params.resourceType,
        id: params.resourceId,
        attributes: {
          fields: params.fields,
        },
      },
      context: {
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: this.generateRequestId(),
      },
      compliance: {
        regulations: ['GDPR', 'SOC2'],
        dataClassification: 'confidential',
        retentionPeriod: this.config.retentionPolicies.data,
        immutable: true,
      },
      risk: {
        score: this.calculateDataAccessRiskScore(params),
        factors: [],
      },
    });
  }

  /**
   * Log configuration change
   */
  async logConfigChange(params: {
    userId: string;
    configType: string;
    configId: string;
    changes: Array<{ field: string; oldValue: any; newValue: any }>;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });

    await this.logEvent({
      actor: {
        id: params.userId,
        type: 'user',
        name: user?.name || 'Unknown',
        email: user?.email,
      },
      action: {
        type: `config.update`,
        category: 'config',
        resource: params.configType,
        operation: 'update',
        result: 'success',
      },
      target: {
        type: params.configType,
        id: params.configId,
      },
      changes: params.changes,
      context: {
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: this.generateRequestId(),
      },
      compliance: {
        regulations: ['SOC2'],
        dataClassification: 'internal',
        retentionPeriod: this.config.retentionPolicies.config,
        immutable: true,
      },
      risk: {
        score: this.calculateConfigChangeRiskScore(params),
        factors: [],
      },
    });
  }

  /**
   * Search audit logs
   */
  async searchLogs(criteria: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    action?: string;
    category?: string;
    resource?: string;
    result?: 'success' | 'failure' | 'error';
    minRiskScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const where: any = {};

    if (criteria.startDate || criteria.endDate) {
      where.timestamp = {};
      if (criteria.startDate) where.timestamp.gte = criteria.startDate;
      if (criteria.endDate) where.timestamp.lte = criteria.endDate;
    }

    if (criteria.actorId) where.actorId = criteria.actorId;
    if (criteria.action) where.action = { contains: criteria.action };
    if (criteria.category) where.category = criteria.category;
    if (criteria.resource) where.resource = criteria.resource;
    if (criteria.result) where.result = criteria.result;

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        take: criteria.limit || 100,
        skip: criteria.offset || 0,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      events: events.map(e => ({
        ...e,
        actor: JSON.parse(e.actor as string),
        action: JSON.parse(e.action as string),
        target: e.target ? JSON.parse(e.target as string) : undefined,
        context: JSON.parse(e.context as string),
        changes: e.changes ? JSON.parse(e.changes as string) : undefined,
        compliance: JSON.parse(e.compliance as string),
        risk: JSON.parse(e.risk as string),
        metadata: e.metadata ? JSON.parse(e.metadata as string) : undefined,
      })) as AuditEvent[],
      total,
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(params: {
    regulation: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI-DSS' | 'ISO27001';
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv' | 'pdf';
  }): Promise<any> {
    const events = await prisma.auditEvent.findMany({
      where: {
        timestamp: {
          gte: params.startDate,
          lte: params.endDate,
        },
        compliance: {
          path: '$.regulations',
          array_contains: params.regulation,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    const report = {
      regulation: params.regulation,
      period: {
        start: params.startDate,
        end: params.endDate,
      },
      summary: {
        totalEvents: events.length,
        byCategory: this.groupByCategory(events),
        byResult: this.groupByResult(events),
        highRiskEvents: events.filter(e => {
          const risk = JSON.parse(e.risk as string);
          return risk.score >= 70;
        }).length,
      },
      events: events.map(e => this.formatEventForReport(e)),
      generated: new Date(),
      hash: '', // Will be calculated
    };

    // Calculate report hash for integrity
    report.hash = this.calculateReportHash(report);

    // Store report for audit trail
    await prisma.complianceReport.create({
      data: {
        regulation: params.regulation,
        period: JSON.stringify(report.period),
        content: JSON.stringify(report),
        hash: report.hash,
      },
    });

    return report;
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(eventId: string): Promise<boolean> {
    const event = await prisma.auditEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) return false;

    const reconstructed = {
      ...event,
      actor: JSON.parse(event.actor as string),
      action: JSON.parse(event.action as string),
      target: event.target ? JSON.parse(event.target as string) : undefined,
      context: JSON.parse(event.context as string),
      changes: event.changes ? JSON.parse(event.changes as string) : undefined,
      compliance: JSON.parse(event.compliance as string),
      risk: JSON.parse(event.risk as string),
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined,
    };

    const calculatedHash = this.calculateEventHash(reconstructed);
    return calculatedHash === event.hash;
  }

  /**
   * Store event in database
   */
  private async storeEvent(event: AuditEvent): Promise<void> {
    await prisma.auditEvent.create({
      data: {
        id: event.id,
        timestamp: event.timestamp,
        actor: JSON.stringify(event.actor),
        action: JSON.stringify(event.action),
        target: event.target ? JSON.stringify(event.target) : null,
        context: JSON.stringify(event.context),
        changes: event.changes ? JSON.stringify(event.changes) : null,
        compliance: JSON.stringify(event.compliance),
        risk: JSON.stringify(event.risk),
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        hash: event.hash,
        // Denormalized fields for querying
        actorId: event.actor.id,
        category: event.action.category,
        resource: event.action.resource,
        result: event.action.result,
      },
    });
  }

  /**
   * Process real-time checks and alerts
   */
  private async processRealTimeChecks(event: AuditEvent): Promise<void> {
    // Check failure rate
    if (event.action.result === 'failure') {
      await this.checkFailureRate(event);
    }

    // Check risk score
    if (event.risk.score >= this.config.alertThresholds.riskScore) {
      await this.sendRiskAlert(event);
    }

    // Check for suspicious patterns
    await this.checkSuspiciousPatterns(event);
  }

  /**
   * Check failure rate and alert if threshold exceeded
   */
  private async checkFailureRate(event: AuditEvent): Promise<void> {
    const key = `${event.actor.id}:${event.action.type}`;
    const now = Date.now();
    
    let cache = this.alertCache.get(key);
    if (!cache || now - cache.timestamp > this.config.alertThresholds.timeWindow * 1000) {
      cache = { count: 0, timestamp: now };
    }

    cache.count++;
    this.alertCache.set(key, cache);

    // Calculate failure rate
    const totalEvents = await this.redis?.get(`audit:total:${key}`) || 10;
    const failureRate = (cache.count / Number(totalEvents)) * 100;

    if (failureRate > this.config.alertThresholds.failureRate) {
      await this.sendFailureRateAlert(event, failureRate);
    }
  }

  /**
   * Check for suspicious patterns
   */
  private async checkSuspiciousPatterns(event: AuditEvent): Promise<void> {
    const patterns = [
      { name: 'rapid_access', check: () => this.checkRapidAccess(event) },
      { name: 'unusual_location', check: () => this.checkUnusualLocation(event) },
      { name: 'privilege_escalation', check: () => this.checkPrivilegeEscalation(event) },
      { name: 'data_exfiltration', check: () => this.checkDataExfiltration(event) },
    ];

    for (const pattern of patterns) {
      if (await pattern.check()) {
        event.risk.alerts = event.risk.alerts || [];
        event.risk.alerts.push(pattern.name);
      }
    }
  }

  /**
   * Calculate event hash for integrity
   */
  private calculateEventHash(event: Partial<AuditEvent>): string {
    const content = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      action: event.action,
      target: event.target,
      changes: event.changes,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate report hash
   */
  private calculateReportHash(report: any): string {
    const content = JSON.stringify({
      regulation: report.regulation,
      period: report.period,
      summary: report.summary,
      events: report.events,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Risk score calculations
   */
  private calculateAuthRiskScore(params: any): number {
    let score = 0;
    
    if (!params.success) score += 30;
    if (params.action === 'password_change') score += 20;
    if (this.isUnusualTime()) score += 15;
    if (this.isSuspiciousUserAgent(params.userAgent)) score += 20;
    
    return Math.min(100, score);
  }

  private calculateDataAccessRiskScore(params: any): number {
    let score = 0;
    
    if (params.operation === 'export' || params.operation === 'download') score += 20;
    if (params.fields && params.fields.length > 10) score += 15;
    if (this.isSensitiveResource(params.resourceType)) score += 30;
    
    return Math.min(100, score);
  }

  private calculateConfigChangeRiskScore(params: any): number {
    let score = 0;
    
    if (this.isCriticalConfig(params.configType)) score += 40;
    if (params.changes.length > 5) score += 20;
    if (this.hasSecurityImplication(params.changes)) score += 30;
    
    return Math.min(100, score);
  }

  /**
   * Helper methods
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getGeoLocation(ipAddress: string): Promise<any> {
    // Implementation would use IP geolocation service
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
    };
  }

  private parseDeviceInfo(userAgent: string): any {
    // Implementation would parse user agent
    return {
      type: 'desktop',
      os: 'macOS',
      browser: 'Chrome',
    };
  }

  private groupByCategory(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const action = JSON.parse(event.action as string);
      acc[action.category] = (acc[action.category] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByResult(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const action = JSON.parse(event.action as string);
      acc[action.result] = (acc[action.result] || 0) + 1;
      return acc;
    }, {});
  }

  private formatEventForReport(event: any): any {
    return {
      id: event.id,
      timestamp: event.timestamp,
      actor: JSON.parse(event.actor as string).name,
      action: JSON.parse(event.action as string).type,
      result: JSON.parse(event.action as string).result,
      riskScore: JSON.parse(event.risk as string).score,
    };
  }

  private async encryptChanges(changes: any[]): Promise<any[]> {
    // Implementation would encrypt sensitive fields
    return changes.map(change => ({
      ...change,
      encrypted: true,
    }));
  }

  private async cacheEvent(event: AuditEvent): Promise<void> {
    if (!this.redis) return;

    const key = `audit:event:${event.id}`;
    const ttl = this.config.retentionPolicies[event.action.category] * 24 * 60 * 60; // Convert days to seconds
    
    await this.redis.setex(key, ttl, JSON.stringify(event));
    
    // Update counters
    await this.redis.incr(`audit:total:${event.actor.id}:${event.action.type}`);
  }

  // Alert methods
  private async sendRiskAlert(event: AuditEvent): Promise<void> {
    logger.warn('High risk audit event detected', {
      eventId: event.id,
      riskScore: event.risk.score,
      factors: event.risk.factors,
    });
  }

  private async sendFailureRateAlert(event: AuditEvent, rate: number): Promise<void> {
    logger.warn('High failure rate detected', {
      actor: event.actor.id,
      action: event.action.type,
      failureRate: rate,
    });
  }

  // Pattern detection helpers
  private async checkRapidAccess(event: AuditEvent): Promise<boolean> {
    // Implementation would check for rapid sequential access
    return false;
  }

  private async checkUnusualLocation(event: AuditEvent): Promise<boolean> {
    // Implementation would check against user's typical locations
    return false;
  }

  private async checkPrivilegeEscalation(event: AuditEvent): Promise<boolean> {
    // Implementation would check for privilege escalation attempts
    return event.action.type.includes('grant') || event.action.type.includes('admin');
  }

  private async checkDataExfiltration(event: AuditEvent): Promise<boolean> {
    // Implementation would check for mass data export patterns
    return event.action.type.includes('export') && event.risk.score > 50;
  }

  // Utility helpers
  private isUnusualTime(): boolean {
    const hour = new Date().getHours();
    return hour < 6 || hour > 22;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspicious = ['bot', 'crawler', 'scraper', 'curl', 'wget'];
    return suspicious.some(s => userAgent.toLowerCase().includes(s));
  }

  private isSensitiveResource(resourceType: string): boolean {
    const sensitive = ['user', 'payment', 'billing', 'api-key', 'secret'];
    return sensitive.some(s => resourceType.toLowerCase().includes(s));
  }

  private isCriticalConfig(configType: string): boolean {
    const critical = ['security', 'auth', 'permission', 'integration'];
    return critical.some(c => configType.toLowerCase().includes(c));
  }

  private hasSecurityImplication(changes: any[]): boolean {
    const securityFields = ['password', 'secret', 'key', 'token', 'permission'];
    return changes.some(c => securityFields.some(f => c.field.toLowerCase().includes(f)));
  }

  private getAuthRiskFactors(params: any): string[] {
    const factors: string[] = [];
    
    if (!params.success) factors.push('failed_attempt');
    if (this.isUnusualTime()) factors.push('unusual_time');
    if (this.isSuspiciousUserAgent(params.userAgent)) factors.push('suspicious_user_agent');
    if (params.action === 'password_change') factors.push('credential_change');
    
    return factors;
  }
}

// Export singleton instance
export const auditLogger = EnterpriseAuditLogger.getInstance();