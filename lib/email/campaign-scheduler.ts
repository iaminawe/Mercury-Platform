import { createClient } from '@/lib/supabase/server';
import { emailClient } from './email-client';
import { personalizationEngine } from './personalization';
import { abTestingEngine } from './a-b-testing';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

export interface ScheduledCampaign {
  id: string;
  name: string;
  template_id: string;
  segment_id?: string;
  schedule_type: 'immediate' | 'scheduled' | 'recurring' | 'triggered';
  scheduled_at?: string;
  recurring_pattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    days_of_week?: number[];
    time: string;
  };
  trigger_condition?: {
    event: string;
    delay_hours?: number;
    conditions: Record<string, any>;
  };
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  ab_test_id?: string;
}

export interface EmailFlow {
  id: string;
  name: string;
  trigger_event: 'signup' | 'purchase' | 'cart_abandonment' | 'win_back';
  steps: EmailFlowStep[];
  status: 'active' | 'paused' | 'draft';
}

export interface EmailFlowStep {
  id: string;
  name: string;
  template_id: string;
  delay_hours: number;
  conditions?: Record<string, any>;
  ab_test_enabled: boolean;
}

export class CampaignScheduler {
  private redis: IORedis;
  private emailQueue: Queue;

  constructor() {
    this.redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.emailQueue = new Queue('email-campaigns', { connection: this.redis });
    this.setupWorkers();
  }

  /**
   * Schedule a one-time campaign
   */
  async scheduleCampaign(campaign: Omit<ScheduledCampaign, 'id' | 'status'>): Promise<ScheduledCampaign> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({
        ...campaign,
        status: campaign.scheduled_at ? 'scheduled' : 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Add to queue if scheduled
    if (campaign.scheduled_at) {
      await this.addCampaignToQueue(data.id, new Date(campaign.scheduled_at));
    }

    return data;
  }

  /**
   * Create an automated email flow (welcome series, abandoned cart, etc.)
   */
  async createEmailFlow(flow: Omit<EmailFlow, 'id'>): Promise<EmailFlow> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('email_flows')
      .insert({
        ...flow,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create flow steps
    await this.createFlowSteps(data.id, flow.steps);

    return data;
  }

  /**
   * Trigger an email flow for a specific customer
   */
  async triggerFlow(flowId: string, customerId: string, triggerData: Record<string, any> = {}): Promise<void> {
    const supabase = createClient();
    
    // Get flow configuration
    const { data: flow } = await supabase
      .from('email_flows')
      .select('*, email_flow_steps(*)')
      .eq('id', flowId)
      .eq('status', 'active')
      .single();

    if (!flow) throw new Error('Flow not found or not active');

    // Check if customer already in this flow
    const { data: existingExecution } = await supabase
      .from('email_flow_executions')
      .select('id')
      .eq('flow_id', flowId)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .single();

    if (existingExecution) {
      console.log(`Customer ${customerId} already in flow ${flowId}`);
      return;
    }

    // Create flow execution record
    const { data: execution } = await supabase
      .from('email_flow_executions')
      .insert({
        flow_id: flowId,
        customer_id: customerId,
        trigger_data: triggerData,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Schedule first step
    const firstStep = flow.email_flow_steps.sort((a: any, b: any) => a.delay_hours - b.delay_hours)[0];
    if (firstStep) {
      await this.scheduleFlowStep(execution.id, firstStep, customerId);
    }
  }

  /**
   * Set up automated triggers for common flows
   */
  async setupAutomatedTriggers(): Promise<void> {
    const supabase = createClient();

    // Welcome series trigger
    await this.createTrigger({
      name: 'Welcome Series',
      event: 'customer.created',
      flow_id: 'welcome-series',
      conditions: {}
    });

    // Abandoned cart trigger
    await this.createTrigger({
      name: 'Abandoned Cart Recovery',
      event: 'cart.abandoned',
      flow_id: 'abandoned-cart',
      delay_hours: 1,
      conditions: {
        cart_value: { gte: 25 }
      }
    });

    // Win-back campaign trigger
    await this.createTrigger({
      name: 'Win-Back Campaign',
      event: 'customer.inactive',
      flow_id: 'win-back',
      delay_hours: 24,
      conditions: {
        days_since_last_order: { gte: 60 },
        total_orders: { gte: 1 }
      }
    });
  }

  /**
   * Process immediate campaign send
   */
  async sendCampaignNow(campaignId: string): Promise<void> {
    const supabase = createClient();
    
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select(`
        *,
        email_templates(*),
        customer_segments(*)
      `)
      .eq('id', campaignId)
      .single();

    if (!campaign) throw new Error('Campaign not found');

    // Get recipients
    const recipients = await this.getCampaignRecipients(campaign);

    // Handle A/B testing if enabled
    if (campaign.ab_test_id) {
      await this.sendABTestCampaign(campaign, recipients);
    } else {
      await this.sendRegularCampaign(campaign, recipients);
    }

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'completed',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);
  }

  /**
   * Get recipients for a campaign based on segments
   */
  private async getCampaignRecipients(campaign: any): Promise<Array<{ email: string; customerData: Record<string, any> }>> {
    const supabase = createClient();
    
    let query = supabase.from('customers').select('*');

    // Apply segment filters
    if (campaign.segment_id && campaign.customer_segments) {
      const segment = campaign.customer_segments;
      query = this.applySeg
mentFilters(query, segment.criteria);
    }

    const { data: customers } = await query;
    
    return customers?.map(customer => ({
      email: customer.email,
      customerData: customer
    })) || [];
  }

  /**
   * Apply segment criteria to customer query
   */
  private applySegmentFilters(query: any, criteria: Record<string, any>): any {
    // This would apply various filters based on segment criteria
    // Implementation depends on your specific segment criteria structure
    Object.entries(criteria).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        if (value.gte !== undefined) {
          query = query.gte(key, value.gte);
        }
        if (value.lte !== undefined) {
          query = query.lte(key, value.lte);
        }
        if (value.eq !== undefined) {
          query = query.eq(key, value.eq);
        }
      } else {
        query = query.eq(key, value);
      }
    });
    
    return query;
  }

  /**
   * Send A/B test campaign
   */
  private async sendABTestCampaign(campaign: any, recipients: any[]): Promise<void> {
    for (const recipient of recipients) {
      // Get variant for this recipient
      const variant = await abTestingEngine.getVariantForRecipient(
        campaign.ab_test_id,
        recipient.email
      );

      if (variant) {
        // Use variant's subject line and content
        const subject = variant.subject_line || campaign.subject_line;
        const content = variant.content || campaign.email_templates.html_content;

        await emailClient.sendEmail({
          to: recipient.email,
          subject,
          html: await personalizationEngine.personalizeContent(content, recipient.customerData.id),
          campaignId: campaign.id,
          templateId: campaign.template_id,
          customerData: recipient.customerData
        });

        // Record A/B test result
        await abTestingEngine.recordTestResult(
          campaign.ab_test_id,
          variant.id,
          recipient.email,
          'send'
        );
      }
    }
  }

  /**
   * Send regular campaign (no A/B testing)
   */
  private async sendRegularCampaign(campaign: any, recipients: any[]): Promise<void> {
    const results = await emailClient.sendCampaign(campaign.id, recipients);
    
    console.log(`Campaign ${campaign.id} sent to ${recipients.length} recipients`);
    console.log(`Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
  }

  /**
   * Schedule a flow step
   */
  private async scheduleFlowStep(executionId: string, step: any, customerId: string): Promise<void> {
    const scheduleTime = new Date(Date.now() + step.delay_hours * 60 * 60 * 1000);
    
    await this.emailQueue.add(
      'send-flow-step',
      {
        executionId,
        stepId: step.id,
        customerId
      },
      {
        delay: step.delay_hours * 60 * 60 * 1000
      }
    );
  }

  /**
   * Add campaign to processing queue
   */
  private async addCampaignToQueue(campaignId: string, scheduleTime: Date): Promise<void> {
    const delay = scheduleTime.getTime() - Date.now();
    
    if (delay > 0) {
      await this.emailQueue.add(
        'send-campaign',
        { campaignId },
        { delay }
      );
    } else {
      // Send immediately if scheduled time has passed
      await this.sendCampaignNow(campaignId);
    }
  }

  /**
   * Create trigger configuration
   */
  private async createTrigger(trigger: {
    name: string;
    event: string;
    flow_id: string;
    delay_hours?: number;
    conditions: Record<string, any>;
  }): Promise<void> {
    const supabase = createClient();
    
    await supabase.from('email_triggers').upsert({
      name: trigger.name,
      event: trigger.event,
      flow_id: trigger.flow_id,
      delay_hours: trigger.delay_hours || 0,
      conditions: trigger.conditions,
      status: 'active',
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Create flow steps in database
   */
  private async createFlowSteps(flowId: string, steps: EmailFlowStep[]): Promise<void> {
    const supabase = createClient();
    
    const stepRecords = steps.map((step, index) => ({
      flow_id: flowId,
      step_id: step.id,
      name: step.name,
      template_id: step.template_id,
      delay_hours: step.delay_hours,
      conditions: step.conditions,
      ab_test_enabled: step.ab_test_enabled,
      order_index: index
    }));

    await supabase.from('email_flow_steps').insert(stepRecords);
  }

  /**
   * Setup queue workers
   */
  private setupWorkers(): void {
    // Campaign sender worker
    new Worker('email-campaigns', async (job) => {
      const { name, data } = job;
      
      try {
        if (name === 'send-campaign') {
          await this.sendCampaignNow(data.campaignId);
        } else if (name === 'send-flow-step') {
          await this.processFlowStep(data.executionId, data.stepId, data.customerId);
        }
      } catch (error) {
        console.error(`Failed to process job ${name}:`, error);
        throw error;
      }
    }, { connection: this.redis });

    console.log('Email campaign workers started');
  }

  /**
   * Process a single flow step
   */
  private async processFlowStep(executionId: string, stepId: string, customerId: string): Promise<void> {
    const supabase = createClient();
    
    // Get step and execution details
    const { data: step } = await supabase
      .from('email_flow_steps')
      .select(`
        *,
        email_templates(*)
      `)
      .eq('step_id', stepId)
      .single();

    const { data: execution } = await supabase
      .from('email_flow_executions')
      .select('*')
      .eq('id', executionId)
      .eq('status', 'active')
      .single();

    if (!step || !execution) {
      console.log('Step or execution not found or not active');
      return;
    }

    // Check step conditions
    if (step.conditions && !await this.checkStepConditions(step.conditions, customerId)) {
      console.log('Step conditions not met, skipping');
      return;
    }

    // Send email
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customer) {
      const personalizedContent = await personalizationEngine.personalizeContent(
        step.email_templates.html_content,
        customerId
      );

      await emailClient.sendEmail({
        to: customer.email,
        subject: step.email_templates.subject,
        html: personalizedContent,
        templateId: step.template_id,
        customerData: customer
      });
    }

    // Schedule next step if exists
    const { data: nextStep } = await supabase
      .from('email_flow_steps')
      .select('*')
      .eq('flow_id', step.flow_id)
      .gt('order_index', step.order_index)
      .order('order_index')
      .limit(1)
      .single();

    if (nextStep) {
      await this.scheduleFlowStep(executionId, nextStep, customerId);
    } else {
      // Mark execution as completed
      await supabase
        .from('email_flow_executions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }
  }

  /**
   * Check if step conditions are met
   */
  private async checkStepConditions(conditions: Record<string, any>, customerId: string): Promise<boolean> {
    // Implement condition checking logic based on your requirements
    // This could check customer behavior, purchase history, etc.
    return true; // Placeholder
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const supabase = createClient();
    
    await supabase
      .from('email_campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId);

    // Remove from queue if scheduled
    // Note: BullMQ doesn't easily support removing scheduled jobs
    // You might need to implement additional tracking
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    const supabase = createClient();
    
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('status', 'paused')
      .single();

    if (campaign) {
      await supabase
        .from('email_campaigns')
        .update({ status: 'scheduled' })
        .eq('id', campaignId);

      if (campaign.scheduled_at) {
        await this.addCampaignToQueue(campaignId, new Date(campaign.scheduled_at));
      }
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string) {
    const metrics = await emailClient.getCampaignMetrics(campaignId);
    
    const supabase = createClient();
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('*, customer_segments(*)')
      .eq('id', campaignId)
      .single();

    return {
      campaign,
      metrics,
      recommendations: await this.generateRecommendations(metrics)
    };
  }

  /**
   * Generate recommendations based on campaign performance
   */
  private async generateRecommendations(metrics: any): Promise<string[]> {
    const recommendations = [];

    if (metrics.openRate < 20) {
      recommendations.push('Consider A/B testing different subject lines to improve open rates');
    }

    if (metrics.clickRate < 3) {
      recommendations.push('Try more compelling call-to-action buttons or personalized content');
    }

    if (metrics.bounceRate > 2) {
      recommendations.push('Clean your email list to remove invalid addresses');
    }

    return recommendations;
  }
}

export const campaignScheduler = new CampaignScheduler();