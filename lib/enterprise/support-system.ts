/**
 * Enterprise Support System
 * 24/7 enterprise support with SLA management and escalation
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { z } from 'zod';

// Support Ticket Priority
export enum TicketPriority {
  P1_CRITICAL = 'p1_critical',
  P2_HIGH = 'p2_high',
  P3_MEDIUM = 'p3_medium',
  P4_LOW = 'p4_low'
}

// Support Ticket Status
export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

// Support Channel
export enum SupportChannel {
  PHONE = 'phone',
  EMAIL = 'email',
  CHAT = 'chat',
  SLACK = 'slack',
  TEAMS = 'teams',
  PORTAL = 'portal'
}

// Ticket Category
export enum TicketCategory {
  TECHNICAL_ISSUE = 'technical_issue',
  FEATURE_REQUEST = 'feature_request',
  BILLING = 'billing',
  SECURITY = 'security',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  COMPLIANCE = 'compliance',
  TRAINING = 'training'
}

// Support Ticket Schema
const SupportTicketSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority),
  status: z.nativeEnum(TicketStatus),
  channel: z.nativeEnum(SupportChannel),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    phone: z.string().optional()
  }),
  assignee: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    team: z.string()
  }).optional(),
  sla: z.object({
    responseDeadline: z.date(),
    resolutionDeadline: z.date(),
    escalationLevel: z.number().min(0).max(3),
    breached: z.boolean()
  }),
  timeline: z.array(z.object({
    timestamp: z.date(),
    action: z.string(),
    user: z.string(),
    details: z.string(),
    internal: z.boolean()
  })),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    contentType: z.string()
  })),
  tags: z.array(z.string()),
  satisfaction: z.object({
    rating: z.number().min(1).max(5),
    feedback: z.string(),
    submittedAt: z.date()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
  closedAt: z.date().optional()
});

export type SupportTicket = z.infer<typeof SupportTicketSchema>;

// Knowledge Base Article Schema
const KnowledgeBaseArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  visibility: z.enum(['public', 'customer', 'internal']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedReadTime: z.number(),
  views: z.number(),
  helpful: z.number(),
  notHelpful: z.number(),
  author: z.object({
    id: z.string(),
    name: z.string()
  }),
  lastReviewed: z.date(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type KnowledgeBaseArticle = z.infer<typeof KnowledgeBaseArticleSchema>;

export class EnterpriseSupportSystem {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  private slaMatrix = {
    [TicketPriority.P1_CRITICAL]: {
      responseMinutes: 15,
      resolutionHours: 4,
      escalationLevels: [30, 60, 120] // minutes
    },
    [TicketPriority.P2_HIGH]: {
      responseMinutes: 60,
      resolutionHours: 24,
      escalationLevels: [120, 240, 480] // minutes
    },
    [TicketPriority.P3_MEDIUM]: {
      responseMinutes: 240, // 4 hours
      resolutionHours: 72,
      escalationLevels: [480, 960, 1440] // minutes
    },
    [TicketPriority.P4_LOW]: {
      responseMinutes: 480, // 8 hours
      resolutionHours: 168, // 7 days
      escalationLevels: [960, 1440, 2880] // minutes
    }
  };

  /**
   * Create a new support ticket
   */
  async createTicket(ticketData: Omit<SupportTicket, 'id' | 'sla' | 'timeline' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket> {
    const ticketId = crypto.randomUUID();
    const now = new Date();

    // Calculate SLA deadlines
    const sla = this.calculateSLA(ticketData.priority, now);

    const ticket: SupportTicket = {
      ...ticketData,
      id: ticketId,
      sla,
      timeline: [{
        timestamp: now,
        action: 'ticket_created',
        user: ticketData.customer.name,
        details: `Ticket created via ${ticketData.channel}`,
        internal: false
      }],
      createdAt: now,
      updatedAt: now
    };

    const validatedTicket = SupportTicketSchema.parse(ticket);

    // Store ticket in database
    await this.supabase
      .from('support_tickets')
      .insert({
        id: ticketId,
        tenant_id: ticket.tenantId,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        channel: ticket.channel,
        customer: ticket.customer,
        assignee: ticket.assignee,
        sla: ticket.sla,
        timeline: ticket.timeline,
        attachments: ticket.attachments,
        tags: ticket.tags,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

    // Auto-assign ticket if rules exist
    await this.autoAssignTicket(validatedTicket);

    // Send notifications
    await this.sendTicketNotifications(validatedTicket, 'created');

    return validatedTicket;
  }

  /**
   * Update ticket status and add timeline entry
   */
  async updateTicket(
    ticketId: string, 
    updates: Partial<SupportTicket>, 
    user: string, 
    comment?: string
  ): Promise<SupportTicket> {
    const existingTicket = await this.getTicket(ticketId);
    if (!existingTicket) {
      throw new Error('Ticket not found');
    }

    const now = new Date();
    const timelineEntry = {
      timestamp: now,
      action: 'ticket_updated',
      user,
      details: comment || 'Ticket updated',
      internal: false
    };

    // Handle status changes
    if (updates.status && updates.status !== existingTicket.status) {
      timelineEntry.action = `status_changed_to_${updates.status}`;
      
      if (updates.status === TicketStatus.RESOLVED) {
        updates.resolvedAt = now;
      }
      
      if (updates.status === TicketStatus.CLOSED) {
        updates.closedAt = now;
      }
    }

    const updatedTicket: SupportTicket = {
      ...existingTicket,
      ...updates,
      timeline: [...existingTicket.timeline, timelineEntry],
      updatedAt: now
    };

    const validatedTicket = SupportTicketSchema.parse(updatedTicket);

    // Update in database
    await this.supabase
      .from('support_tickets')
      .update({
        title: validatedTicket.title,
        description: validatedTicket.description,
        category: validatedTicket.category,
        priority: validatedTicket.priority,
        status: validatedTicket.status,
        assignee: validatedTicket.assignee,
        timeline: validatedTicket.timeline,
        tags: validatedTicket.tags,
        satisfaction: validatedTicket.satisfaction,
        updated_at: now.toISOString(),
        resolved_at: validatedTicket.resolvedAt?.toISOString(),
        closed_at: validatedTicket.closedAt?.toISOString()
      })
      .eq('id', ticketId);

    // Send notifications for status changes
    if (updates.status) {
      await this.sendTicketNotifications(validatedTicket, 'status_changed');
    }

    return validatedTicket;
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !data) {
      return null;
    }

    return SupportTicketSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.status,
      channel: data.channel,
      customer: data.customer,
      assignee: data.assignee,
      sla: {
        ...data.sla,
        responseDeadline: new Date(data.sla.responseDeadline),
        resolutionDeadline: new Date(data.sla.resolutionDeadline)
      },
      timeline: data.timeline.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp)
      })),
      attachments: data.attachments,
      tags: data.tags,
      satisfaction: data.satisfaction ? {
        ...data.satisfaction,
        submittedAt: new Date(data.satisfaction.submittedAt)
      } : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined
    });
  }

  /**
   * List tickets with filters
   */
  async listTickets(filters: {
    tenantId?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId?: string;
    category?: TicketCategory;
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]> {
    let query = this.supabase.from('support_tickets').select('*');

    if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assigneeId) query = query.eq('assignee.id', filters.assigneeId);
    if (filters.category) query = query.eq('category', filters.category);

    query = query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50)
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(d => SupportTicketSchema.parse({
      id: d.id,
      tenantId: d.tenant_id,
      title: d.title,
      description: d.description,
      category: d.category,
      priority: d.priority,
      status: d.status,
      channel: d.channel,
      customer: d.customer,
      assignee: d.assignee,
      sla: {
        ...d.sla,
        responseDeadline: new Date(d.sla.responseDeadline),
        resolutionDeadline: new Date(d.sla.resolutionDeadline)
      },
      timeline: d.timeline.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp)
      })),
      attachments: d.attachments,
      tags: d.tags,
      satisfaction: d.satisfaction ? {
        ...d.satisfaction,
        submittedAt: new Date(d.satisfaction.submittedAt)
      } : undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
      resolvedAt: d.resolved_at ? new Date(d.resolved_at) : undefined,
      closedAt: d.closed_at ? new Date(d.closed_at) : undefined
    }));
  }

  /**
   * Check for SLA breaches and escalate if necessary
   */
  async checkSLABreaches(): Promise<{
    breached: SupportTicket[];
    escalated: SupportTicket[];
  }> {
    const openTickets = await this.listTickets({
      status: TicketStatus.OPEN
    });

    const now = new Date();
    const breached: SupportTicket[] = [];
    const escalated: SupportTicket[] = [];

    for (const ticket of openTickets) {
      // Check response deadline
      if (now > ticket.sla.responseDeadline && !ticket.assignee) {
        if (!ticket.sla.breached) {
          breached.push(ticket);
          await this.updateTicket(ticket.id, {
            sla: { ...ticket.sla, breached: true }
          }, 'system', 'SLA response deadline breached');
        }
      }

      // Check escalation levels
      const slaConfig = this.slaMatrix[ticket.priority];
      const minutesSinceCreated = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60);

      for (let level = 0; level < slaConfig.escalationLevels.length; level++) {
        if (minutesSinceCreated >= slaConfig.escalationLevels[level] &&
            ticket.sla.escalationLevel === level) {
          
          escalated.push(ticket);
          await this.escalateTicket(ticket, level + 1);
          break;
        }
      }
    }

    return { breached, escalated };
  }

  /**
   * Generate support analytics
   */
  async getSupportAnalytics(tenantId: string, period: { start: Date; end: Date }): Promise<{
    summary: {
      totalTickets: number;
      resolvedTickets: number;
      averageResolutionTime: number;
      customerSatisfaction: number;
      slaCompliance: number;
    };
    trends: {
      ticketsByDay: Array<{ date: string; count: number }>;
      ticketsByCategory: Array<{ category: string; count: number }>;
      ticketsByPriority: Array<{ priority: string; count: number }>;
    };
    performance: {
      responseTime: { average: number; p95: number };
      resolutionTime: { average: number; p95: number };
      firstContactResolution: number;
    };
  }> {
    const tickets = await this.listTickets({ 
      tenantId,
      limit: 1000 // Adjust based on needs
    });

    const periodTickets = tickets.filter(t => 
      t.createdAt >= period.start && t.createdAt <= period.end
    );

    // Calculate summary metrics
    const totalTickets = periodTickets.length;
    const resolvedTickets = periodTickets.filter(t => t.status === TicketStatus.RESOLVED).length;
    
    const resolutionTimes = periodTickets
      .filter(t => t.resolvedAt)
      .map(t => t.resolvedAt!.getTime() - t.createdAt.getTime());
    
    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / (1000 * 60 * 60) // hours
      : 0;

    const satisfactionRatings = periodTickets
      .filter(t => t.satisfaction)
      .map(t => t.satisfaction!.rating);
    
    const customerSatisfaction = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((a, b) => a + b, 0) / satisfactionRatings.length
      : 0;

    const slaCompliant = periodTickets.filter(t => !t.sla.breached).length;
    const slaCompliance = totalTickets > 0 ? (slaCompliant / totalTickets) * 100 : 100;

    // Calculate trends (simplified)
    const ticketsByCategory = Object.entries(
      periodTickets.reduce((acc, ticket) => {
        acc[ticket.category] = (acc[ticket.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([category, count]) => ({ category, count }));

    return {
      summary: {
        totalTickets,
        resolvedTickets,
        averageResolutionTime,
        customerSatisfaction,
        slaCompliance
      },
      trends: {
        ticketsByDay: [], // Would calculate daily breakdown
        ticketsByCategory,
        ticketsByPriority: [] // Would calculate priority breakdown
      },
      performance: {
        responseTime: { average: 0, p95: 0 }, // Would calculate from timeline data
        resolutionTime: { average: averageResolutionTime, p95: 0 },
        firstContactResolution: 0 // Would calculate FCR rate
      }
    };
  }

  /**
   * Create knowledge base article
   */
  async createKnowledgeBaseArticle(articleData: Omit<KnowledgeBaseArticle, 'id' | 'views' | 'helpful' | 'notHelpful' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeBaseArticle> {
    const articleId = crypto.randomUUID();
    const now = new Date();

    const article: KnowledgeBaseArticle = {
      ...articleData,
      id: articleId,
      views: 0,
      helpful: 0,
      notHelpful: 0,
      createdAt: now,
      updatedAt: now
    };

    const validatedArticle = KnowledgeBaseArticleSchema.parse(article);

    await this.supabase
      .from('knowledge_base_articles')
      .insert({
        id: articleId,
        title: article.title,
        content: article.content,
        summary: article.summary,
        category: article.category,
        tags: article.tags,
        visibility: article.visibility,
        difficulty: article.difficulty,
        estimated_read_time: article.estimatedReadTime,
        views: 0,
        helpful: 0,
        not_helpful: 0,
        author: article.author,
        last_reviewed: article.lastReviewed.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

    return validatedArticle;
  }

  // Private helper methods
  private calculateSLA(priority: TicketPriority, createdAt: Date) {
    const config = this.slaMatrix[priority];
    
    const responseDeadline = new Date(createdAt.getTime() + config.responseMinutes * 60 * 1000);
    const resolutionDeadline = new Date(createdAt.getTime() + config.resolutionHours * 60 * 60 * 1000);

    return {
      responseDeadline,
      resolutionDeadline,
      escalationLevel: 0,
      breached: false
    };
  }

  private async autoAssignTicket(ticket: SupportTicket): Promise<void> {
    // Implementation would use assignment rules based on:
    // - Category expertise
    // - Current workload
    // - Availability
    // - Skill matching
  }

  private async escalateTicket(ticket: SupportTicket, newLevel: number): Promise<void> {
    await this.updateTicket(
      ticket.id,
      {
        sla: { ...ticket.sla, escalationLevel: newLevel }
      },
      'system',
      `Ticket escalated to level ${newLevel}`
    );

    // Send escalation notifications
    await this.sendEscalationNotifications(ticket, newLevel);
  }

  private async sendTicketNotifications(ticket: SupportTicket, event: string): Promise<void> {
    // Implementation would send notifications via:
    // - Email
    // - Slack/Teams
    // - SMS for critical issues
    // - Customer portal
  }

  private async sendEscalationNotifications(ticket: SupportTicket, level: number): Promise<void> {
    // Implementation would notify:
    // - Management team
    // - On-call engineers
    // - Customer success team
  }
}

export default EnterpriseSupportSystem;