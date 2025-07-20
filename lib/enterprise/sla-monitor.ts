/**
 * SLA Monitoring and Reporting System
 * Tracks service level agreements and performance metrics
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// SLA Metric Types
export enum SLAMetricType {
  UPTIME = 'uptime',
  RESPONSE_TIME = 'response_time',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
  AVAILABILITY = 'availability',
  RECOVERY_TIME = 'recovery_time'
}

// SLA Severity Levels
export enum SLASeverity {
  P1_CRITICAL = 'p1_critical',
  P2_HIGH = 'p2_high',
  P3_MEDIUM = 'p3_medium',
  P4_LOW = 'p4_low'
}

// SLA Tier Definitions
export enum SLATier {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// SLA Definition Schema
const SLADefinitionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  tier: z.nativeEnum(SLATier),
  metrics: z.object({
    uptime: z.object({
      target: z.number().min(90).max(100), // Percentage
      measurement: z.enum(['monthly', 'quarterly', 'yearly'])
    }),
    responseTime: z.object({
      target: z.number().positive(), // Milliseconds
      percentile: z.number().min(50).max(99.99)
    }),
    errorRate: z.object({
      target: z.number().min(0).max(10), // Percentage
      measurement: z.enum(['hourly', 'daily', 'monthly'])
    }),
    throughput: z.object({
      target: z.number().positive(), // Requests per second
      measurement: z.enum(['average', 'peak'])
    })
  }),
  penalties: z.object({
    uptimeBreach: z.object({
      threshold: z.number(),
      penalty: z.number() // Percentage of monthly fee
    }),
    responseTimeBreach: z.object({
      threshold: z.number(),
      penalty: z.number()
    })
  }),
  support: z.object({
    responseTime: z.object({
      p1: z.number(), // Minutes
      p2: z.number(),
      p3: z.number(),
      p4: z.number()
    }),
    channels: z.array(z.enum(['phone', 'email', 'chat', 'slack'])),
    availability: z.string() // e.g., "24/7", "9-5 EST"
  }),
  reporting: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    includeRealTime: z.boolean(),
    customDashboard: z.boolean()
  })
});

export type SLADefinition = z.infer<typeof SLADefinitionSchema>;

// SLA Measurement Schema
const SLAMeasurementSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  metricType: z.nativeEnum(SLAMetricType),
  value: z.number(),
  timestamp: z.date(),
  period: z.object({
    start: z.date(),
    end: z.date()
  }),
  target: z.number(),
  status: z.enum(['met', 'breached', 'at_risk']),
  metadata: z.record(z.any())
});

export type SLAMeasurement = z.infer<typeof SLAMeasurementSchema>;

// Incident Schema
const IncidentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  severity: z.nativeEnum(SLASeverity),
  title: z.string(),
  description: z.string(),
  status: z.enum(['open', 'investigating', 'identified', 'monitoring', 'resolved']),
  affectedServices: z.array(z.string()),
  startTime: z.date(),
  endTime: z.date().optional(),
  downtime: z.number().optional(), // Minutes
  impactedUsers: z.number().optional(),
  rootCause: z.string().optional(),
  resolution: z.string().optional(),
  slaImpact: z.object({
    uptimeImpact: z.number(),
    responseTimeImpact: z.number(),
    penaltyApplicable: z.boolean()
  }).optional()
});

export type Incident = z.infer<typeof IncidentSchema>;

export class SLAMonitor {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  private measurementCache = new Map<string, SLAMeasurement[]>();

  /**
   * Define SLA for a tenant
   */
  async defineSLA(sla: Omit<SLADefinition, 'id'>): Promise<SLADefinition> {
    const slaId = crypto.randomUUID();
    const fullSLA = { ...sla, id: slaId };

    const validatedSLA = SLADefinitionSchema.parse(fullSLA);

    await this.supabase
      .from('sla_definitions')
      .insert({
        id: slaId,
        tenant_id: sla.tenantId,
        tier: sla.tier,
        metrics: sla.metrics,
        penalties: sla.penalties,
        support: sla.support,
        reporting: sla.reporting,
        created_at: new Date().toISOString()
      });

    return validatedSLA;
  }

  /**
   * Record SLA measurement
   */
  async recordMeasurement(measurement: Omit<SLAMeasurement, 'id'>): Promise<SLAMeasurement> {
    const measurementId = crypto.randomUUID();
    const fullMeasurement = { ...measurement, id: measurementId };

    const validatedMeasurement = SLAMeasurementSchema.parse(fullMeasurement);

    await this.supabase
      .from('sla_measurements')
      .insert({
        id: measurementId,
        tenant_id: measurement.tenantId,
        metric_type: measurement.metricType,
        value: measurement.value,
        timestamp: measurement.timestamp.toISOString(),
        period_start: measurement.period.start.toISOString(),
        period_end: measurement.period.end.toISOString(),
        target: measurement.target,
        status: measurement.status,
        metadata: measurement.metadata
      });

    // Clear cache for this tenant
    this.measurementCache.delete(measurement.tenantId);

    return validatedMeasurement;
  }

  /**
   * Calculate current SLA performance
   */
  async calculateSLAPerformance(tenantId: string, period: { start: Date; end: Date }): Promise<{
    overall: {
      score: number;
      status: 'met' | 'at_risk' | 'breached';
    };
    metrics: {
      uptime: { actual: number; target: number; status: string };
      responseTime: { actual: number; target: number; status: string };
      errorRate: { actual: number; target: number; status: string };
      throughput: { actual: number; target: number; status: string };
    };
    incidents: Incident[];
    penalties: Array<{ type: string; amount: number; reason: string }>;
  }> {
    const sla = await this.getSLADefinition(tenantId);
    if (!sla) {
      throw new Error('No SLA defined for tenant');
    }

    const measurements = await this.getMeasurements(tenantId, period);
    const incidents = await this.getIncidents(tenantId, period);

    // Calculate uptime
    const uptimeMeasurements = measurements.filter(m => m.metricType === SLAMetricType.UPTIME);
    const actualUptime = this.calculateAverageMetric(uptimeMeasurements);
    const uptimeStatus = actualUptime >= sla.metrics.uptime.target ? 'met' : 'breached';

    // Calculate response time
    const responseTimeMeasurements = measurements.filter(m => m.metricType === SLAMetricType.RESPONSE_TIME);
    const actualResponseTime = this.calculatePercentileMetric(responseTimeMeasurements, sla.metrics.responseTime.percentile);
    const responseTimeStatus = actualResponseTime <= sla.metrics.responseTime.target ? 'met' : 'breached';

    // Calculate error rate
    const errorRateMeasurements = measurements.filter(m => m.metricType === SLAMetricType.ERROR_RATE);
    const actualErrorRate = this.calculateAverageMetric(errorRateMeasurements);
    const errorRateStatus = actualErrorRate <= sla.metrics.errorRate.target ? 'met' : 'breached';

    // Calculate throughput
    const throughputMeasurements = measurements.filter(m => m.metricType === SLAMetricType.THROUGHPUT);
    const actualThroughput = this.calculateAverageMetric(throughputMeasurements);
    const throughputStatus = actualThroughput >= sla.metrics.throughput.target ? 'met' : 'breached';

    // Calculate overall score
    const metrics = [uptimeStatus, responseTimeStatus, errorRateStatus, throughputStatus];
    const metScore = metrics.filter(s => s === 'met').length;
    const overallScore = (metScore / metrics.length) * 100;

    let overallStatus: 'met' | 'at_risk' | 'breached';
    if (overallScore >= 95) overallStatus = 'met';
    else if (overallScore >= 85) overallStatus = 'at_risk';
    else overallStatus = 'breached';

    // Calculate penalties
    const penalties = this.calculatePenalties(sla, {
      uptime: actualUptime,
      responseTime: actualResponseTime,
      errorRate: actualErrorRate,
      throughput: actualThroughput
    });

    return {
      overall: {
        score: overallScore,
        status: overallStatus
      },
      metrics: {
        uptime: { actual: actualUptime, target: sla.metrics.uptime.target, status: uptimeStatus },
        responseTime: { actual: actualResponseTime, target: sla.metrics.responseTime.target, status: responseTimeStatus },
        errorRate: { actual: actualErrorRate, target: sla.metrics.errorRate.target, status: errorRateStatus },
        throughput: { actual: actualThroughput, target: sla.metrics.throughput.target, status: throughputStatus }
      },
      incidents,
      penalties
    };
  }

  /**
   * Generate SLA report
   */
  async generateSLAReport(tenantId: string, period: { start: Date; end: Date }): Promise<{
    executiveSummary: string;
    performance: any;
    trends: Array<{ metric: string; trend: 'improving' | 'stable' | 'degrading'; change: number }>;
    recommendations: string[];
    nextReviewDate: Date;
    attachments: Array<{ name: string; url: string; type: string }>;
  }> {
    const performance = await this.calculateSLAPerformance(tenantId, period);
    const historicalData = await this.getHistoricalPerformance(tenantId, 90); // Last 90 days
    
    const trends = this.analyzeTrends(historicalData);
    const recommendations = this.generateRecommendations(performance, trends);

    const executiveSummary = this.generateExecutiveSummary(performance, trends);

    // Generate attachments (charts, detailed metrics, etc.)
    const attachments = await this.generateReportAttachments(tenantId, performance);

    return {
      executiveSummary,
      performance,
      trends,
      recommendations,
      nextReviewDate: this.calculateNextReviewDate(period.end),
      attachments
    };
  }

  /**
   * Create incident
   */
  async createIncident(incident: Omit<Incident, 'id'>): Promise<Incident> {
    const incidentId = crypto.randomUUID();
    const fullIncident = { ...incident, id: incidentId };

    const validatedIncident = IncidentSchema.parse(fullIncident);

    await this.supabase
      .from('incidents')
      .insert({
        id: incidentId,
        tenant_id: incident.tenantId,
        severity: incident.severity,
        title: incident.title,
        description: incident.description,
        status: incident.status,
        affected_services: incident.affectedServices,
        start_time: incident.startTime.toISOString(),
        end_time: incident.endTime?.toISOString(),
        downtime: incident.downtime,
        impacted_users: incident.impactedUsers,
        root_cause: incident.rootCause,
        resolution: incident.resolution,
        sla_impact: incident.slaImpact,
        created_at: new Date().toISOString()
      });

    // Trigger SLA impact calculation
    await this.calculateIncidentSLAImpact(validatedIncident);

    return validatedIncident;
  }

  /**
   * Update incident status
   */
  async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident> {
    await this.supabase
      .from('incidents')
      .update({
        ...updates,
        end_time: updates.endTime?.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', incidentId);

    const { data } = await this.supabase
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    return IncidentSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      severity: data.severity,
      title: data.title,
      description: data.description,
      status: data.status,
      affectedServices: data.affected_services,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      downtime: data.downtime,
      impactedUsers: data.impacted_users,
      rootCause: data.root_cause,
      resolution: data.resolution,
      slaImpact: data.sla_impact
    });
  }

  /**
   * Get real-time SLA dashboard data
   */
  async getRealTimeDashboard(tenantId: string): Promise<{
    currentStatus: 'operational' | 'degraded' | 'major_outage';
    uptime: number;
    responseTime: number;
    errorRate: number;
    activeIncidents: Incident[];
    recentAlerts: Array<{ message: string; severity: string; timestamp: Date }>;
    metrics: Array<{ name: string; value: number; target: number; status: string }>;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentMeasurements = await this.getMeasurements(tenantId, {
      start: oneHourAgo,
      end: now
    });

    const activeIncidents = await this.getActiveIncidents(tenantId);
    
    // Calculate current metrics
    const currentUptime = this.calculateCurrentUptime(recentMeasurements);
    const currentResponseTime = this.calculateCurrentResponseTime(recentMeasurements);
    const currentErrorRate = this.calculateCurrentErrorRate(recentMeasurements);

    // Determine overall status
    let currentStatus: 'operational' | 'degraded' | 'major_outage';
    if (activeIncidents.some(i => i.severity === SLASeverity.P1_CRITICAL)) {
      currentStatus = 'major_outage';
    } else if (activeIncidents.length > 0 || currentErrorRate > 5) {
      currentStatus = 'degraded';
    } else {
      currentStatus = 'operational';
    }

    const sla = await this.getSLADefinition(tenantId);
    const metrics = sla ? [
      {
        name: 'Uptime',
        value: currentUptime,
        target: sla.metrics.uptime.target,
        status: currentUptime >= sla.metrics.uptime.target ? 'good' : 'poor'
      },
      {
        name: 'Response Time',
        value: currentResponseTime,
        target: sla.metrics.responseTime.target,
        status: currentResponseTime <= sla.metrics.responseTime.target ? 'good' : 'poor'
      },
      {
        name: 'Error Rate',
        value: currentErrorRate,
        target: sla.metrics.errorRate.target,
        status: currentErrorRate <= sla.metrics.errorRate.target ? 'good' : 'poor'
      }
    ] : [];

    // Get recent alerts
    const recentAlerts = await this.getRecentAlerts(tenantId, 24); // Last 24 hours

    return {
      currentStatus,
      uptime: currentUptime,
      responseTime: currentResponseTime,
      errorRate: currentErrorRate,
      activeIncidents,
      recentAlerts,
      metrics
    };
  }

  // Private helper methods
  private async getSLADefinition(tenantId: string): Promise<SLADefinition | null> {
    const { data } = await this.supabase
      .from('sla_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!data) return null;

    return SLADefinitionSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      tier: data.tier,
      metrics: data.metrics,
      penalties: data.penalties,
      support: data.support,
      reporting: data.reporting
    });
  }

  private async getMeasurements(tenantId: string, period: { start: Date; end: Date }): Promise<SLAMeasurement[]> {
    const cacheKey = `${tenantId}_${period.start.getTime()}_${period.end.getTime()}`;
    
    if (this.measurementCache.has(cacheKey)) {
      return this.measurementCache.get(cacheKey)!;
    }

    const { data } = await this.supabase
      .from('sla_measurements')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('timestamp', period.start.toISOString())
      .lte('timestamp', period.end.toISOString());

    const measurements = (data || []).map(d => SLAMeasurementSchema.parse({
      id: d.id,
      tenantId: d.tenant_id,
      metricType: d.metric_type,
      value: d.value,
      timestamp: new Date(d.timestamp),
      period: {
        start: new Date(d.period_start),
        end: new Date(d.period_end)
      },
      target: d.target,
      status: d.status,
      metadata: d.metadata
    }));

    this.measurementCache.set(cacheKey, measurements);
    return measurements;
  }

  private async getIncidents(tenantId: string, period: { start: Date; end: Date }): Promise<Incident[]> {
    const { data } = await this.supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_time', period.start.toISOString())
      .lte('start_time', period.end.toISOString());

    return (data || []).map(d => IncidentSchema.parse({
      id: d.id,
      tenantId: d.tenant_id,
      severity: d.severity,
      title: d.title,
      description: d.description,
      status: d.status,
      affectedServices: d.affected_services,
      startTime: new Date(d.start_time),
      endTime: d.end_time ? new Date(d.end_time) : undefined,
      downtime: d.downtime,
      impactedUsers: d.impacted_users,
      rootCause: d.root_cause,
      resolution: d.resolution,
      slaImpact: d.sla_impact
    }));
  }

  private calculateAverageMetric(measurements: SLAMeasurement[]): number {
    if (measurements.length === 0) return 0;
    return measurements.reduce((sum, m) => sum + m.value, 0) / measurements.length;
  }

  private calculatePercentileMetric(measurements: SLAMeasurement[], percentile: number): number {
    if (measurements.length === 0) return 0;
    
    const sorted = measurements.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private calculatePenalties(sla: SLADefinition, actual: any): Array<{ type: string; amount: number; reason: string }> {
    const penalties = [];

    if (actual.uptime < sla.metrics.uptime.target) {
      penalties.push({
        type: 'uptime_breach',
        amount: sla.penalties.uptimeBreach.penalty,
        reason: `Uptime ${actual.uptime}% below target ${sla.metrics.uptime.target}%`
      });
    }

    if (actual.responseTime > sla.metrics.responseTime.target) {
      penalties.push({
        type: 'response_time_breach',
        amount: sla.penalties.responseTimeBreach.penalty,
        reason: `Response time ${actual.responseTime}ms above target ${sla.metrics.responseTime.target}ms`
      });
    }

    return penalties;
  }

  private async getHistoricalPerformance(tenantId: string, days: number): Promise<any[]> {
    // Implementation for historical data retrieval
    return [];
  }

  private analyzeTrends(historicalData: any[]): Array<{ metric: string; trend: 'improving' | 'stable' | 'degrading'; change: number }> {
    // Implementation for trend analysis
    return [];
  }

  private generateRecommendations(performance: any, trends: any[]): string[] {
    const recommendations = [];

    if (performance.overall.status === 'breached') {
      recommendations.push('Immediate action required to address SLA breaches');
    }

    if (performance.metrics.uptime.status === 'breached') {
      recommendations.push('Implement redundancy and failover mechanisms');
    }

    if (performance.metrics.responseTime.status === 'breached') {
      recommendations.push('Optimize application performance and infrastructure');
    }

    return recommendations;
  }

  private generateExecutiveSummary(performance: any, trends: any[]): string {
    return `SLA Performance Summary: Overall score ${performance.overall.score}%. ${performance.overall.status === 'met' ? 'All targets met.' : 'Action required to meet targets.'}`;
  }

  private async generateReportAttachments(tenantId: string, performance: any): Promise<Array<{ name: string; url: string; type: string }>> {
    // Generate charts, detailed reports, etc.
    return [];
  }

  private calculateNextReviewDate(currentPeriodEnd: Date): Date {
    const nextReview = new Date(currentPeriodEnd);
    nextReview.setMonth(nextReview.getMonth() + 1);
    return nextReview;
  }

  private async calculateIncidentSLAImpact(incident: Incident): Promise<void> {
    // Calculate the impact of the incident on SLA metrics
  }

  private async getActiveIncidents(tenantId: string): Promise<Incident[]> {
    return this.getIncidents(tenantId, {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    }).then(incidents => incidents.filter(i => i.status !== 'resolved'));
  }

  private calculateCurrentUptime(measurements: SLAMeasurement[]): number {
    const uptimeMeasurements = measurements.filter(m => m.metricType === SLAMetricType.UPTIME);
    return this.calculateAverageMetric(uptimeMeasurements);
  }

  private calculateCurrentResponseTime(measurements: SLAMeasurement[]): number {
    const responseTimeMeasurements = measurements.filter(m => m.metricType === SLAMetricType.RESPONSE_TIME);
    return this.calculateAverageMetric(responseTimeMeasurements);
  }

  private calculateCurrentErrorRate(measurements: SLAMeasurement[]): number {
    const errorRateMeasurements = measurements.filter(m => m.metricType === SLAMetricType.ERROR_RATE);
    return this.calculateAverageMetric(errorRateMeasurements);
  }

  private async getRecentAlerts(tenantId: string, hours: number): Promise<Array<{ message: string; severity: string; timestamp: Date }>> {
    // Implementation for recent alerts
    return [];
  }
}

export default SLAMonitor;