import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import { Resend } from 'resend';

const logger = createLogger('ai-alerts');

export interface Alert {
  id?: string;
  type: 'performance' | 'accuracy' | 'cost' | 'error' | 'security' | 'health';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  service: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  threshold?: number;
  current_value?: number;
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved?: boolean;
  resolved_by?: string;
  resolved_at?: Date;
  notification_sent?: boolean;
  created_at?: Date;
}

export interface AlertRule {
  id?: string;
  name: string;
  type: Alert['type'];
  service: string;
  condition: string; // JSON query condition
  threshold: number;
  severity: Alert['severity'];
  enabled: boolean;
  notification_channels: string[]; // email, slack, webhook
  cooldown_minutes: number; // Prevent spam
  created_at?: Date;
}

export interface NotificationChannel {
  id?: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>; // Channel-specific configuration
  enabled: boolean;
  created_at?: Date;
}

export interface AlertEscalation {
  id?: string;
  rule_id: string;
  escalation_level: number;
  delay_minutes: number;
  notification_channels: string[];
  condition: string; // When to escalate
  created_at?: Date;
}

export class AIAlertManager {
  private supabase: any;
  private resend: Resend;
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.resend = new Resend(process.env.RESEND_API_KEY);
    
    this.initializeDefaultRules();
    this.loadNotificationChannels();
    this.startAlertProcessing();
  }

  /**
   * Create a new alert
   */
  async createAlert(alert: Omit<Alert, 'id' | 'created_at'>): Promise<string> {
    try {
      // Check cooldown
      const cooldownKey = `${alert.service}-${alert.type}`;
      const lastAlert = this.alertCooldowns.get(cooldownKey);
      
      if (lastAlert && Date.now() - lastAlert.getTime() < 300000) { // 5 minutes cooldown
        logger.info('Alert skipped due to cooldown', { service: alert.service, type: alert.type });
        return '';
      }

      const alertWithTimestamp: Alert = {
        ...alert,
        created_at: new Date()
      };

      // Store alert in database
      const { data, error } = await this.supabase
        .from('ai_alerts')
        .insert(alertWithTimestamp)
        .select('id')
        .single();

      if (error) throw error;

      // Update cooldown
      this.alertCooldowns.set(cooldownKey, new Date());

      // Send notifications
      await this.processAlert(alertWithTimestamp);

      logger.info('Alert created', {
        id: data.id,
        type: alert.type,
        severity: alert.severity,
        service: alert.service
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to create alert', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    } catch (error) {
      logger.error('Failed to acknowledge alert', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, resolution?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_alerts')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          data: { resolution }
        })
        .eq('id', alertId);

      if (error) throw error;

      logger.info('Alert resolved', { alertId, resolvedBy, resolution });
    } catch (error) {
      logger.error('Failed to resolve alert', error);
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(filters?: {
    service?: string;
    type?: string;
    severity?: string;
    limit?: number;
  }): Promise<Alert[]> {
    try {
      let query = this.supabase
        .from('ai_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (filters?.service) {
        query = query.eq('service', filters.service);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data: alerts, error } = await query;
      if (error) throw error;

      return alerts;
    } catch (error) {
      logger.error('Failed to get active alerts', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<{
    total_alerts: number;
    by_severity: Record<string, number>;
    by_service: Record<string, number>;
    by_type: Record<string, number>;
    resolution_time_avg: number;
    acknowledgment_time_avg: number;
  }> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startDate = new Date(Date.now() - timeframeDuration);

      const { data: alerts, error } = await this.supabase
        .from('ai_alerts')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const stats = {
        total_alerts: alerts.length,
        by_severity: {} as Record<string, number>,
        by_service: {} as Record<string, number>,
        by_type: {} as Record<string, number>,
        resolution_time_avg: 0,
        acknowledgment_time_avg: 0
      };

      let totalResolutionTime = 0;
      let totalAcknowledgmentTime = 0;
      let resolvedCount = 0;
      let acknowledgedCount = 0;

      alerts.forEach((alert: Alert) => {
        // Count by severity
        stats.by_severity[alert.severity] = (stats.by_severity[alert.severity] || 0) + 1;
        
        // Count by service
        stats.by_service[alert.service] = (stats.by_service[alert.service] || 0) + 1;
        
        // Count by type
        stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;

        // Calculate resolution time
        if (alert.resolved && alert.resolved_at && alert.created_at) {
          const resolutionTime = new Date(alert.resolved_at).getTime() - new Date(alert.created_at).getTime();
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }

        // Calculate acknowledgment time
        if (alert.acknowledged && alert.acknowledged_at && alert.created_at) {
          const acknowledgmentTime = new Date(alert.acknowledged_at).getTime() - new Date(alert.created_at).getTime();
          totalAcknowledgmentTime += acknowledgmentTime;
          acknowledgedCount++;
        }
      });

      stats.resolution_time_avg = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
      stats.acknowledgment_time_avg = acknowledgedCount > 0 ? totalAcknowledgmentTime / acknowledgedCount : 0;

      return stats;
    } catch (error) {
      logger.error('Failed to get alert statistics', error);
      throw error;
    }
  }

  /**
   * Create or update alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'created_at'>): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('alert_rules')
        .insert({
          ...rule,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update local cache
      this.alertRules.set(data.id, { ...rule, id: data.id });

      logger.info('Alert rule created', { id: data.id, name: rule.name });
      return data.id;
    } catch (error) {
      logger.error('Failed to create alert rule', error);
      throw error;
    }
  }

  /**
   * Create notification channel
   */
  async createNotificationChannel(channel: Omit<NotificationChannel, 'id' | 'created_at'>): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('notification_channels')
        .insert({
          ...channel,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update local cache
      this.notificationChannels.set(data.id, { ...channel, id: data.id });

      logger.info('Notification channel created', { id: data.id, name: channel.name, type: channel.type });
      return data.id;
    } catch (error) {
      logger.error('Failed to create notification channel', error);
      throw error;
    }
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(channelId: string): Promise<boolean> {
    try {
      const channel = this.notificationChannels.get(channelId);
      if (!channel) {
        throw new Error('Notification channel not found');
      }

      const testAlert: Alert = {
        type: 'health',
        severity: 'info',
        service: 'test',
        title: 'Test Alert',
        message: 'This is a test alert to verify notification channel configuration.',
        created_at: new Date()
      };

      await this.sendNotification(channel, testAlert);
      
      logger.info('Notification channel test successful', { channelId, type: channel.type });
      return true;
    } catch (error) {
      logger.error('Notification channel test failed', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async initializeDefaultRules(): Promise<void> {
    const defaultRules: Omit<AlertRule, 'id' | 'created_at'>[] = [
      {
        name: 'High Error Rate',
        type: 'error',
        service: 'all',
        condition: 'error_rate > threshold',
        threshold: 0.1, // 10%
        severity: 'critical',
        enabled: true,
        notification_channels: ['email', 'slack'],
        cooldown_minutes: 15
      },
      {
        name: 'Slow Response Time',
        type: 'performance',
        service: 'all',
        condition: 'response_time > threshold',
        threshold: 5000, // 5 seconds
        severity: 'warning',
        enabled: true,
        notification_channels: ['email'],
        cooldown_minutes: 30
      },
      {
        name: 'Low Accuracy',
        type: 'accuracy',
        service: 'advisor',
        condition: 'accuracy < threshold',
        threshold: 0.8, // 80%
        severity: 'warning',
        enabled: true,
        notification_channels: ['email'],
        cooldown_minutes: 60
      },
      {
        name: 'High Cost',
        type: 'cost',
        service: 'all',
        condition: 'daily_cost > threshold',
        threshold: 100, // $100
        severity: 'warning',
        enabled: true,
        notification_channels: ['email'],
        cooldown_minutes: 240 // 4 hours
      }
    ];

    // Load existing rules from database
    try {
      const { data: existingRules } = await this.supabase
        .from('alert_rules')
        .select('*');

      if (existingRules) {
        existingRules.forEach((rule: AlertRule) => {
          this.alertRules.set(rule.id!, rule);
        });
      }

      // Create default rules if they don't exist
      for (const rule of defaultRules) {
        const existing = Array.from(this.alertRules.values()).find(r => r.name === rule.name);
        if (!existing) {
          await this.createAlertRule(rule);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize default alert rules', error);
    }
  }

  private async loadNotificationChannels(): Promise<void> {
    try {
      const { data: channels } = await this.supabase
        .from('notification_channels')
        .select('*')
        .eq('enabled', true);

      if (channels) {
        channels.forEach((channel: NotificationChannel) => {
          this.notificationChannels.set(channel.id!, channel);
        });
      }

      logger.info('Notification channels loaded', { count: channels?.length || 0 });
    } catch (error) {
      logger.error('Failed to load notification channels', error);
    }
  }

  private startAlertProcessing(): void {
    // Process unacknowledged alerts every minute
    setInterval(async () => {
      try {
        const unacknowledgedAlerts = await this.getActiveAlerts({ limit: 50 });
        
        for (const alert of unacknowledgedAlerts) {
          if (!alert.notification_sent) {
            await this.processAlert(alert);
          }
        }
      } catch (error) {
        logger.error('Failed to process alerts', error);
      }
    }, 60000); // Every minute

    // Check for escalations every 5 minutes
    setInterval(async () => {
      await this.checkEscalations();
    }, 300000); // Every 5 minutes
  }

  private async processAlert(alert: Alert): Promise<void> {
    try {
      // Find applicable notification channels
      const channels = Array.from(this.notificationChannels.values()).filter(channel => 
        this.shouldNotifyChannel(channel, alert)
      );

      // Send notifications
      for (const channel of channels) {
        try {
          await this.sendNotification(channel, alert);
        } catch (error) {
          logger.error('Failed to send notification', { channelId: channel.id, error });
        }
      }

      // Mark as notification sent
      if (alert.id) {
        await this.supabase
          .from('ai_alerts')
          .update({ notification_sent: true })
          .eq('id', alert.id);
      }
    } catch (error) {
      logger.error('Failed to process alert', error);
    }
  }

  private shouldNotifyChannel(channel: NotificationChannel, alert: Alert): boolean {
    // Check if channel should receive this alert based on severity, service, etc.
    if (!channel.enabled) return false;
    
    // Add custom logic here based on channel configuration
    const config = channel.config;
    
    if (config.min_severity) {
      const severityLevels = { info: 1, warning: 2, critical: 3, emergency: 4 };
      if (severityLevels[alert.severity] < severityLevels[config.min_severity]) {
        return false;
      }
    }

    if (config.services && !config.services.includes(alert.service)) {
      return false;
    }

    return true;
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'sms':
        await this.sendSmsNotification(channel, alert);
        break;
      default:
        logger.warn('Unknown notification channel type', { type: channel.type });
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      const subject = `${alert.severity.toUpperCase()}: ${alert.title}`;
      const html = this.generateAlertEmailHtml(alert);

      await this.resend.emails.send({
        from: channel.config.from || 'alerts@mercury.app',
        to: channel.config.to,
        subject,
        html
      });

      logger.info('Email notification sent', { channelId: channel.id, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send email notification', error);
      throw error;
    }
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      const payload = {
        text: `${alert.severity.toUpperCase()}: ${alert.title}`,
        attachments: [
          {
            color: this.getSeverityColor(alert.severity),
            fields: [
              { title: 'Service', value: alert.service, short: true },
              { title: 'Type', value: alert.type, short: true },
              { title: 'Message', value: alert.message, short: false }
            ],
            ts: Math.floor(new Date(alert.created_at!).getTime() / 1000)
          }
        ]
      };

      const response = await fetch(channel.config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      logger.info('Slack notification sent', { channelId: channel.id, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send Slack notification', error);
      throw error;
    }
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      const response = await fetch(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(channel.config.headers || {})
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          source: 'mercury-ai-alerts'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.statusText}`);
      }

      logger.info('Webhook notification sent', { channelId: channel.id, alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send webhook notification', error);
      throw error;
    }
  }

  private async sendSmsNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // SMS implementation would go here (Twilio, etc.)
    logger.info('SMS notification would be sent', { channelId: channel.id, alertId: alert.id });
  }

  private generateAlertEmailHtml(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
          <div style="border-left: 4px solid ${this.getSeverityColor(alert.severity)}; padding-left: 20px;">
            <h2 style="color: ${this.getSeverityColor(alert.severity)}; margin-top: 0;">
              ${alert.severity.toUpperCase()}: ${alert.title}
            </h2>
            <p><strong>Service:</strong> ${alert.service}</p>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Time:</strong> ${alert.created_at?.toLocaleString()}</p>
            <p><strong>Message:</strong></p>
            <p>${alert.message}</p>
            ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
            ${alert.current_value ? `<p><strong>Current Value:</strong> ${alert.current_value}</p>` : ''}
            ${alert.data ? `<p><strong>Additional Data:</strong> <pre>${JSON.stringify(alert.data, null, 2)}</pre></p>` : ''}
          </div>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            This alert was generated by Mercury AI Monitoring System.
            Please acknowledge or resolve this alert in the dashboard.
          </p>
        </body>
      </html>
    `;
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      info: '#2196F3',
      warning: '#FF9800',
      critical: '#F44336',
      emergency: '#9C27B0'
    };
    return colors[severity as keyof typeof colors] || '#2196F3';
  }

  private async checkEscalations(): Promise<void> {
    try {
      // Get unacknowledged critical alerts older than 15 minutes
      const { data: criticalAlerts } = await this.supabase
        .from('ai_alerts')
        .select('*')
        .eq('severity', 'critical')
        .eq('acknowledged', false)
        .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

      for (const alert of criticalAlerts || []) {
        // Escalate to emergency level
        await this.createAlert({
          ...alert,
          severity: 'emergency',
          title: `ESCALATED: ${alert.title}`,
          message: `This critical alert has been escalated due to lack of acknowledgment. Original alert: ${alert.message}`
        });
      }
    } catch (error) {
      logger.error('Failed to check escalations', error);
    }
  }

  private getTimeframeDuration(timeframe: string): number {
    const durations = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return durations[timeframe as keyof typeof durations] || durations['24h'];
  }
}

// Singleton instance
export const aiAlertManager = new AIAlertManager();