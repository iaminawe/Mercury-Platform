/**
 * GDPR Compliance Tools
 * Data export, deletion, and privacy management
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { createHash } from 'crypto';
import JSZip from 'jszip';

// Data subject request schema
const DataSubjectRequestSchema = z.object({
  id: z.string(),
  type: z.enum(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']),
  subjectId: z.string(),
  subjectEmail: z.string().email(),
  requesterId: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  legalBasis: z.string().optional(),
  metadata: z.object({
    reason: z.string().optional(),
    scope: z.array(z.string()).optional(), // Specific data types requested
    verificationMethod: z.string().optional(),
    verifiedAt: z.date().optional(),
    processingDeadline: z.date(),
    completedAt: z.date().optional(),
    rejectionReason: z.string().optional(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DataSubjectRequest = z.infer<typeof DataSubjectRequestSchema>;

export interface GDPRConfig {
  dataRetentionPeriods: Record<string, number>; // entity -> days
  anonymizationRules: Record<string, string[]>; // entity -> fields to anonymize
  exportFormats: ('json' | 'csv' | 'xml')[];
  autoApprovalThreshold: number; // days
  verificationRequired: boolean;
  contactDPO: {
    name: string;
    email: string;
    phone?: string;
  };
}

export class GDPRComplianceManager {
  private static instance: GDPRComplianceManager;
  private config: GDPRConfig;

  private constructor(config: GDPRConfig) {
    this.config = {
      dataRetentionPeriods: {
        user: 365 * 3, // 3 years
        session: 30,
        audit: 365 * 7, // 7 years
        billing: 365 * 7,
        support: 365 * 2,
        ...config.dataRetentionPeriods,
      },
      anonymizationRules: {
        user: ['email', 'phone', 'address', 'ip_address'],
        session: ['ip_address', 'user_agent'],
        audit: ['ip_address'],
        ...config.anonymizationRules,
      },
      exportFormats: ['json', 'csv'],
      autoApprovalThreshold: 30,
      verificationRequired: true,
      ...config,
    };
  }

  static getInstance(config?: GDPRConfig): GDPRComplianceManager {
    if (!GDPRComplianceManager.instance) {
      GDPRComplianceManager.instance = new GDPRComplianceManager(config || {
        dataRetentionPeriods: {},
        anonymizationRules: {},
        exportFormats: ['json'],
        autoApprovalThreshold: 30,
        verificationRequired: true,
        contactDPO: {
          name: 'Data Protection Officer',
          email: 'dpo@example.com',
        },
      });
    }
    return GDPRComplianceManager.instance;
  }

  /**
   * Create a data subject request
   */
  async createDataSubjectRequest(params: {
    type: DataSubjectRequest['type'];
    subjectId: string;
    subjectEmail: string;
    requesterId?: string;
    reason?: string;
    scope?: string[];
    legalBasis?: string;
  }): Promise<DataSubjectRequest> {
    try {
      // Calculate processing deadline (30 days for GDPR)
      const processingDeadline = new Date();
      processingDeadline.setDate(processingDeadline.getDate() + 30);

      const request: DataSubjectRequest = {
        id: this.generateRequestId(),
        type: params.type,
        subjectId: params.subjectId,
        subjectEmail: params.subjectEmail,
        requesterId: params.requesterId,
        status: this.config.verificationRequired ? 'pending' : 'in_progress',
        priority: this.calculatePriority(params.type),
        legalBasis: params.legalBasis,
        metadata: {
          reason: params.reason,
          scope: params.scope,
          processingDeadline,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await prisma.dataSubjectRequest.create({
        data: {
          ...request,
          metadata: JSON.stringify(request.metadata),
        },
      });

      // Send notifications
      await this.notifyDPO(request);
      await this.notifyDataSubject(request);

      // Log creation
      await this.logGDPREvent('request_created', request);

      return request;
    } catch (error) {
      logger.error('Failed to create data subject request:', error);
      throw error;
    }
  }

  /**
   * Process data access request (Article 15)
   */
  async processDataAccessRequest(requestId: string): Promise<{ data: any; downloadUrl: string }> {
    const request = await this.getRequest(requestId);
    if (!request || request.type !== 'access') {
      throw new Error('Invalid access request');
    }

    // Collect all personal data
    const userData = await this.collectUserData(request.subjectId, request.metadata.scope);

    // Generate export package
    const exportPackage = await this.generateExportPackage(userData, 'json');

    // Update request status
    await this.updateRequestStatus(requestId, 'completed');

    // Log completion
    await this.logGDPREvent('access_request_completed', request);

    return {
      data: userData,
      downloadUrl: exportPackage.url,
    };
  }

  /**
   * Process data erasure request (Article 17 - Right to be forgotten)
   */
  async processDataErasureRequest(requestId: string): Promise<{ deletedRecords: number }> {
    const request = await this.getRequest(requestId);
    if (!request || request.type !== 'erasure') {
      throw new Error('Invalid erasure request');
    }

    // Check if erasure is legally permitted
    const canErase = await this.checkErasurePermissions(request);
    if (!canErase.allowed) {
      await this.updateRequestStatus(requestId, 'rejected', canErase.reason);
      throw new Error(`Erasure not permitted: ${canErase.reason}`);
    }

    // Perform erasure
    const deletedRecords = await this.performErasure(request.subjectId, request.metadata.scope);

    // Update request status
    await this.updateRequestStatus(requestId, 'completed');

    // Log erasure
    await this.logGDPREvent('erasure_completed', {
      ...request,
      deletedRecords,
    });

    return { deletedRecords };
  }

  /**
   * Process data portability request (Article 20)
   */
  async processDataPortabilityRequest(requestId: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    const request = await this.getRequest(requestId);
    if (!request || request.type !== 'portability') {
      throw new Error('Invalid portability request');
    }

    // Collect portable data (structured, commonly used, machine-readable)
    const portableData = await this.collectPortableData(request.subjectId);

    // Generate export in requested format
    const exportPackage = await this.generateExportPackage(portableData, format);

    // Update request status
    await this.updateRequestStatus(requestId, 'completed');

    // Log completion
    await this.logGDPREvent('portability_request_completed', request);

    return exportPackage.url;
  }

  /**
   * Anonymize user data for retention
   */
  async anonymizeUserData(userId: string, reason: string = 'retention_policy'): Promise<void> {
    try {
      // Get anonymization rules
      const rules = this.config.anonymizationRules;

      // Anonymize user record
      if (rules.user) {
        const anonymizedData: any = {};
        for (const field of rules.user) {
          anonymizedData[field] = this.anonymizeField(field);
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            ...anonymizedData,
            anonymized: true,
            anonymizedAt: new Date(),
          },
        });
      }

      // Anonymize related records
      await this.anonymizeRelatedRecords(userId, rules);

      // Log anonymization
      await this.logGDPREvent('data_anonymized', {
        userId,
        reason,
        timestamp: new Date(),
      });

      logger.info('User data anonymized', { userId, reason });
    } catch (error) {
      logger.error('Failed to anonymize user data:', error);
      throw error;
    }
  }

  /**
   * Check data retention compliance
   */
  async checkRetentionCompliance(): Promise<{
    expiredData: Array<{ entity: string; count: number; oldestRecord: Date }>;
    recommendations: string[];
  }> {
    const expiredData: Array<{ entity: string; count: number; oldestRecord: Date }> = [];
    const recommendations: string[] = [];

    // Check each entity type
    for (const [entity, retentionDays] of Object.entries(this.config.dataRetentionPeriods)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = this.buildRetentionQuery(entity, cutoffDate);
      if (query) {
        const count = await query.count;
        const oldest = await query.oldest;

        if (count > 0) {
          expiredData.push({
            entity,
            count,
            oldestRecord: oldest?.createdAt || new Date(),
          });

          recommendations.push(`Consider anonymizing or deleting ${count} ${entity} records older than ${retentionDays} days`);
        }
      }
    }

    return { expiredData, recommendations };
  }

  /**
   * Generate GDPR compliance report
   */
  async generateComplianceReport(period: { start: Date; end: Date }): Promise<any> {
    const requests = await prisma.dataSubjectRequest.findMany({
      where: {
        createdAt: {
          gte: period.start,
          lte: period.end,
        },
      },
    });

    const report = {
      period,
      summary: {
        totalRequests: requests.length,
        byType: this.groupBy(requests, 'type'),
        byStatus: this.groupBy(requests, 'status'),
        averageProcessingTime: this.calculateAverageProcessingTime(requests),
        complianceRate: this.calculateComplianceRate(requests),
      },
      details: {
        requests: requests.map(r => ({
          ...r,
          metadata: JSON.parse(r.metadata as string),
        })),
      },
      retentionCompliance: await this.checkRetentionCompliance(),
      generated: new Date(),
    };

    return report;
  }

  /**
   * Verify identity for data subject request
   */
  async verifyDataSubjectIdentity(requestId: string, verificationData: {
    method: 'email' | 'phone' | 'document';
    value: string;
    code?: string;
  }): Promise<boolean> {
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Implement verification logic based on method
    let verified = false;
    switch (verificationData.method) {
      case 'email':
        verified = await this.verifyEmail(request.subjectEmail, verificationData.code);
        break;
      case 'phone':
        verified = await this.verifyPhone(verificationData.value, verificationData.code);
        break;
      case 'document':
        verified = await this.verifyDocument(verificationData.value);
        break;
    }

    if (verified) {
      await this.updateRequestStatus(requestId, 'in_progress');
      await prisma.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          metadata: JSON.stringify({
            ...request.metadata,
            verificationMethod: verificationData.method,
            verifiedAt: new Date(),
          }),
        },
      });
    }

    await this.logGDPREvent('identity_verification', {
      requestId,
      method: verificationData.method,
      success: verified,
    });

    return verified;
  }

  /**
   * Collect all user data
   */
  private async collectUserData(userId: string, scope?: string[]): Promise<any> {
    const data: any = {
      user: {},
      profile: {},
      activities: [],
      settings: {},
      files: [],
      communications: [],
    };

    // User basic data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    });

    if (user) {
      data.user = this.sanitizeForExport(user);
    }

    // Activity logs
    if (!scope || scope.includes('activities')) {
      const activities = await prisma.auditLog.findMany({
        where: { userId },
        take: 1000, // Limit for performance
        orderBy: { timestamp: 'desc' },
      });
      data.activities = activities.map(a => this.sanitizeForExport(a));
    }

    // Sessions
    if (!scope || scope.includes('sessions')) {
      const sessions = await prisma.ssoSession.findMany({
        where: { userId },
      });
      data.sessions = sessions.map(s => this.sanitizeForExport(s));
    }

    // API keys
    if (!scope || scope.includes('api_keys')) {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId },
      });
      data.apiKeys = apiKeys.map(k => ({
        ...this.sanitizeForExport(k),
        key: '[REDACTED]', // Don't export actual keys
      }));
    }

    return data;
  }

  /**
   * Collect portable data (structured, machine-readable)
   */
  private async collectPortableData(userId: string): Promise<any> {
    // Only include data that's portable under GDPR
    const portableData = await this.collectUserData(userId, ['user', 'profile', 'settings']);
    
    // Remove non-portable fields
    delete portableData.activities;
    delete portableData.sessions;
    
    return portableData;
  }

  /**
   * Perform data erasure
   */
  private async performErasure(userId: string, scope?: string[]): Promise<number> {
    let deletedRecords = 0;

    // Delete or anonymize user record
    if (!scope || scope.includes('user')) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: this.anonymizeField('email'),
          name: this.anonymizeField('name'),
          phone: null,
          deletedAt: new Date(),
        },
      });
      deletedRecords++;
    }

    // Delete sessions
    if (!scope || scope.includes('sessions')) {
      const deletedSessions = await prisma.ssoSession.deleteMany({
        where: { userId },
      });
      deletedRecords += deletedSessions.count;
    }

    // Anonymize audit logs (required for compliance)
    if (!scope || scope.includes('activities')) {
      const updatedLogs = await prisma.auditLog.updateMany({
        where: { userId },
        data: {
          userId: 'ANONYMIZED',
          ipAddress: this.anonymizeField('ipAddress'),
        },
      });
      deletedRecords += updatedLogs.count;
    }

    return deletedRecords;
  }

  /**
   * Check if erasure is legally permitted
   */
  private async checkErasurePermissions(request: DataSubjectRequest): Promise<{ allowed: boolean; reason?: string }> {
    // Check for legal obligations to retain data
    const user = await prisma.user.findUnique({
      where: { id: request.subjectId },
    });

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Check if user has active legal obligations
    const hasActiveContract = await this.hasActiveContract(request.subjectId);
    if (hasActiveContract) {
      return { allowed: false, reason: 'Active contract requires data retention' };
    }

    // Check regulatory requirements
    const hasRegulatoryRequirement = await this.hasRegulatoryRequirement(request.subjectId);
    if (hasRegulatoryRequirement) {
      return { allowed: false, reason: 'Regulatory requirements prevent erasure' };
    }

    return { allowed: true };
  }

  /**
   * Generate export package
   */
  private async generateExportPackage(data: any, format: 'json' | 'csv' | 'xml'): Promise<{ url: string; filename: string }> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `gdpr-export-${timestamp}.${format === 'json' ? 'zip' : format}`;

    let content: string;
    switch (format) {
      case 'json':
        // Create ZIP with JSON files
        const zip = new JSZip();
        for (const [key, value] of Object.entries(data)) {
          zip.file(`${key}.json`, JSON.stringify(value, null, 2));
        }
        content = await zip.generateAsync({ type: 'base64' });
        break;
      case 'csv':
        content = this.convertToCSV(data);
        break;
      case 'xml':
        content = this.convertToXML(data);
        break;
      default:
        throw new Error('Unsupported export format');
    }

    // Store file temporarily and return download URL
    const fileUrl = await this.storeExportFile(filename, content, format === 'json' ? 'base64' : 'text');

    return { url: fileUrl, filename };
  }

  /**
   * Helper methods
   */
  private generateRequestId(): string {
    return `dsr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePriority(type: DataSubjectRequest['type']): DataSubjectRequest['priority'] {
    switch (type) {
      case 'erasure':
        return 'high';
      case 'access':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private async getRequest(requestId: string): Promise<DataSubjectRequest | null> {
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return null;

    return {
      ...request,
      metadata: JSON.parse(request.metadata as string),
    } as DataSubjectRequest;
  }

  private async updateRequestStatus(requestId: string, status: DataSubjectRequest['status'], reason?: string): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'completed') {
      updateData.metadata = JSON.stringify({
        completedAt: new Date(),
      });
    } else if (status === 'rejected' && reason) {
      updateData.metadata = JSON.stringify({
        rejectionReason: reason,
      });
    }

    await prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: updateData,
    });
  }

  private anonymizeField(fieldType: string): string {
    switch (fieldType) {
      case 'email':
        return `anonymized${Math.random().toString(36).substr(2, 8)}@example.com`;
      case 'name':
        return `Anonymized User ${Math.random().toString(36).substr(2, 6)}`;
      case 'phone':
        return '+1234567890';
      case 'ipAddress':
      case 'ip_address':
        return '127.0.0.1';
      default:
        return 'ANONYMIZED';
    }
  }

  private async anonymizeRelatedRecords(userId: string, rules: Record<string, string[]>): Promise<void> {
    // Anonymize session data
    if (rules.session) {
      const anonymizedSessionData: any = {};
      for (const field of rules.session) {
        anonymizedSessionData[field] = this.anonymizeField(field);
      }

      await prisma.ssoSession.updateMany({
        where: { userId },
        data: anonymizedSessionData,
      });
    }
  }

  private buildRetentionQuery(entity: string, cutoffDate: Date): any {
    switch (entity) {
      case 'user':
        return {
          count: prisma.user.count({
            where: {
              createdAt: { lt: cutoffDate },
              deletedAt: null,
            },
          }),
          oldest: prisma.user.findFirst({
            where: {
              createdAt: { lt: cutoffDate },
              deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
          }),
        };
      case 'session':
        return {
          count: prisma.ssoSession.count({
            where: { createdAt: { lt: cutoffDate } },
          }),
          oldest: prisma.ssoSession.findFirst({
            where: { createdAt: { lt: cutoffDate } },
            orderBy: { createdAt: 'asc' },
          }),
        };
      default:
        return null;
    }
  }

  private sanitizeForExport(data: any): any {
    // Remove sensitive fields from export
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateAverageProcessingTime(requests: any[]): number {
    const completed = requests.filter(r => r.status === 'completed');
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, r) => {
      const metadata = JSON.parse(r.metadata as string);
      if (metadata.completedAt) {
        return sum + (new Date(metadata.completedAt).getTime() - new Date(r.createdAt).getTime());
      }
      return sum;
    }, 0);

    return totalTime / completed.length / (1000 * 60 * 60 * 24); // Convert to days
  }

  private calculateComplianceRate(requests: any[]): number {
    if (requests.length === 0) return 100;

    const onTime = requests.filter(r => {
      const metadata = JSON.parse(r.metadata as string);
      if (r.status === 'completed' && metadata.completedAt) {
        return new Date(metadata.completedAt) <= new Date(metadata.processingDeadline);
      }
      return false;
    });

    return (onTime.length / requests.length) * 100;
  }

  private async hasActiveContract(userId: string): Promise<boolean> {
    // Implementation would check for active contracts
    return false;
  }

  private async hasRegulatoryRequirement(userId: string): Promise<boolean> {
    // Implementation would check regulatory requirements
    return false;
  }

  private convertToCSV(data: any): string {
    // Implementation would convert data to CSV format
    return 'CSV export not implemented';
  }

  private convertToXML(data: any): string {
    // Implementation would convert data to XML format
    return '<xml>XML export not implemented</xml>';
  }

  private async storeExportFile(filename: string, content: string, encoding: 'text' | 'base64'): Promise<string> {
    // Implementation would store file in cloud storage and return URL
    return `https://exports.example.com/${filename}`;
  }

  private async verifyEmail(email: string, code?: string): Promise<boolean> {
    // Implementation would verify email with code
    return true;
  }

  private async verifyPhone(phone: string, code?: string): Promise<boolean> {
    // Implementation would verify phone with SMS code
    return true;
  }

  private async verifyDocument(documentId: string): Promise<boolean> {
    // Implementation would verify identity document
    return true;
  }

  private async notifyDPO(request: DataSubjectRequest): Promise<void> {
    logger.info('DPO notified of data subject request', {
      requestId: request.id,
      type: request.type,
      dpo: this.config.contactDPO.email,
    });
  }

  private async notifyDataSubject(request: DataSubjectRequest): Promise<void> {
    logger.info('Data subject notified of request creation', {
      requestId: request.id,
      email: request.subjectEmail,
    });
  }

  private async logGDPREvent(action: string, data: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: `gdpr.${action}`,
          userId: data.subjectId || data.userId || 'system',
          metadata: data,
          ipAddress: 'system',
          userAgent: 'gdpr-compliance-manager',
        },
      });
    } catch (error) {
      logger.error('Failed to log GDPR event:', error);
    }
  }
}

// Export singleton instance
export const gdprManager = GDPRComplianceManager.getInstance();