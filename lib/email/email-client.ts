import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { type EmailTemplate, type EmailCampaign, type EmailMetrics } from '@/types/email';

export class EmailClient {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * Send a single email
   */
  async sendEmail({
    to,
    subject,
    html,
    text,
    templateId,
    campaignId,
    customerData
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    templateId?: string;
    campaignId?: string;
    customerData?: Record<string, any>;
  }) {
    try {
      // Send email via Resend
      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@mercury.app',
        to,
        subject,
        html,
        text
      });

      // Track email send in Supabase
      const supabase = createClient();
      await supabase.from('email_sends').insert({
        email_id: result.data?.id,
        campaign_id: campaignId,
        template_id: templateId,
        recipient_email: to,
        subject,
        customer_data: customerData,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Log failure in Supabase
      const supabase = createClient();
      await supabase.from('email_sends').insert({
        campaign_id: campaignId,
        template_id: templateId,
        recipient_email: to,
        subject,
        customer_data: customerData,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        sent_at: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Send bulk emails for a campaign
   */
  async sendCampaign(campaignId: string, recipients: Array<{
    email: string;
    customerData: Record<string, any>;
  }>) {
    const supabase = createClient();
    
    // Get campaign details
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('*, email_templates(*)')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const results = [];
    
    for (const recipient of recipients) {
      try {
        // Generate personalized content
        const personalizedContent = await this.personalizeContent(
          campaign.email_templates.html_content,
          recipient.customerData
        );

        const personalizedSubject = await this.personalizeContent(
          campaign.subject_line,
          recipient.customerData
        );

        const result = await this.sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedContent,
          templateId: campaign.template_id,
          campaignId,
          customerData: recipient.customerData
        });

        results.push({ success: true, recipient: recipient.email, result });
      } catch (error) {
        results.push({ 
          success: false, 
          recipient: recipient.email, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipients_count: recipients.length
      })
      .eq('id', campaignId);

    return results;
  }

  /**
   * Personalize email content with customer data
   */
  private async personalizeContent(content: string, customerData: Record<string, any>): Promise<string> {
    let personalizedContent = content;

    // Simple variable replacement
    Object.entries(customerData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      personalizedContent = personalizedContent.replace(
        new RegExp(placeholder, 'g'),
        String(value || '')
      );
    });

    // AI-powered personalization could be added here
    // using OpenAI or other LLM services

    return personalizedContent;
  }

  /**
   * Track email events (opens, clicks, bounces)
   */
  async trackEmailEvent({
    emailId,
    eventType,
    metadata
  }: {
    emailId: string;
    eventType: 'opened' | 'clicked' | 'bounced' | 'complained';
    metadata?: Record<string, any>;
  }) {
    const supabase = createClient();
    
    await supabase.from('email_events').insert({
      email_id: emailId,
      event_type: eventType,
      metadata,
      created_at: new Date().toISOString()
    });

    // Update email send record
    const updateData: any = { [`${eventType}_at`]: new Date().toISOString() };
    
    await supabase
      .from('email_sends')
      .update(updateData)
      .eq('email_id', emailId);
  }

  /**
   * Get email campaign metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<EmailMetrics> {
    const supabase = createClient();
    
    const { data: sends } = await supabase
      .from('email_sends')
      .select('*')
      .eq('campaign_id', campaignId);

    const { data: events } = await supabase
      .from('email_events')
      .select('*')
      .in('email_id', sends?.map(s => s.email_id) || []);

    const totalSent = sends?.length || 0;
    const opened = sends?.filter(s => s.opened_at).length || 0;
    const clicked = sends?.filter(s => s.clicked_at).length || 0;
    const bounced = sends?.filter(s => s.bounced_at).length || 0;
    const complained = sends?.filter(s => s.complained_at).length || 0;

    return {
      campaignId,
      totalSent,
      delivered: totalSent - bounced,
      opened,
      clicked,
      bounced,
      complained,
      openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (clicked / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (complained / totalSent) * 100 : 0
    };
  }
}

export const emailClient = new EmailClient();