/**
 * Mercury Email Marketing Plugin
 * Advanced email marketing automation with templates, campaigns, and analytics
 */

import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';

// Plugin definition
const emailMarketingPlugin = {
  id: 'email-marketing',
  name: 'Email Marketing Suite',
  version: '1.0.0',
  description: 'Comprehensive email marketing automation with templates, campaigns, and analytics',
  author: 'Mercury Team',
  
  dependencies: [],
  
  // Plugin configuration
  config: {
    emailProvider: 'smtp',
    smtpConfig: {},
    defaultFromEmail: '',
    defaultFromName: 'Your Store',
    enableAnalytics: true,
    unsubscribeUrl: ''
  },

  // Plugin hooks and lifecycle methods
  hooks: {
    async onInstall() {
      console.log('📧 Email Marketing Plugin installed');
      await this.setupDefaultTemplates();
    },

    async onUninstall() {
      console.log('📧 Email Marketing Plugin uninstalled');
      await this.cleanupData();
    },

    async onActivate() {
      console.log('📧 Email Marketing Plugin activated');
      await this.initializeEmailService();
      await this.registerEventHandlers();
    },

    async onDeactivate() {
      console.log('📧 Email Marketing Plugin deactivated');
      await this.cleanupEventHandlers();
    },

    async onConfigUpdate(newConfig) {
      console.log('📧 Email Marketing Plugin config updated');
      this.config = { ...this.config, ...newConfig };
      await this.initializeEmailService();
    }
  },

  // Plugin state
  emailService: null,
  templates: new Map(),
  campaigns: new Map(),
  analytics: {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0
  },

  // Core functionality
  async initializeEmailService() {
    try {
      if (this.config.emailProvider === 'smtp') {
        this.emailService = nodemailer.createTransporter(this.config.smtpConfig);
      }
      
      // Test connection
      await this.emailService.verify();
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      throw new Error('Email service initialization failed');
    }
  },

  async setupDefaultTemplates() {
    // Welcome email template
    this.templates.set('welcome', {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to {{storeName}}!',
      htmlTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to {{storeName}}!</h1>
          <p>Hi {{customerName}},</p>
          <p>Thank you for joining our community! We're excited to have you.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Here's what you can expect:</h3>
            <ul>
              <li>🎉 Exclusive offers and discounts</li>
              <li>📦 Early access to new products</li>
              <li>💡 Tips and recommendations</li>
            </ul>
          </div>
          <a href="{{shopUrl}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Start Shopping</a>
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            If you didn't create this account, please <a href="{{unsubscribeUrl}}">unsubscribe here</a>.
          </p>
        </div>
      `,
      textTemplate: `
        Welcome to {{storeName}}!
        
        Hi {{customerName}},
        
        Thank you for joining our community! We're excited to have you.
        
        Here's what you can expect:
        - Exclusive offers and discounts
        - Early access to new products  
        - Tips and recommendations
        
        Start shopping: {{shopUrl}}
        
        If you didn't create this account, please unsubscribe: {{unsubscribeUrl}}
      `,
      variables: ['storeName', 'customerName', 'shopUrl', 'unsubscribeUrl']
    });

    // Abandoned cart template
    this.templates.set('abandoned-cart', {
      id: 'abandoned-cart',
      name: 'Abandoned Cart Recovery',
      subject: 'You left something in your cart at {{storeName}}',
      htmlTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Don't forget your items!</h1>
          <p>Hi {{customerName}},</p>
          <p>You left some amazing items in your cart. Complete your purchase before they're gone!</p>
          
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3>Your Cart Items:</h3>
            {{#each cartItems}}
            <div style="display: flex; align-items: center; margin: 15px 0; padding: 15px; border-bottom: 1px solid #eee;">
              <img src="{{image}}" alt="{{title}}" style="width: 80px; height: 80px; object-fit: cover; margin-right: 15px;">
              <div>
                <h4 style="margin: 0;">{{title}}</h4>
                <p style="margin: 5px 0; color: #666;">Quantity: {{quantity}}</p>
                <p style="margin: 5px 0; font-weight: bold;">${{price}}</p>
              </div>
            </div>
            {{/each}}
            <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
              Total: ${{cartTotal}}
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-size: 16px;">Complete Your Purchase</a>
          </div>
          
          <p style="text-align: center; margin-top: 20px;">
            <small>This cart will expire in 24 hours. Don't miss out!</small>
          </p>
        </div>
      `,
      textTemplate: `
        Don't forget your items!
        
        Hi {{customerName}},
        
        You left some amazing items in your cart. Complete your purchase before they're gone!
        
        Your Cart Items:
        {{#each cartItems}}
        - {{title}} (Qty: {{quantity}}) - ${{price}}
        {{/each}}
        
        Total: ${{cartTotal}}
        
        Complete your purchase: {{checkoutUrl}}
        
        This cart will expire in 24 hours. Don't miss out!
      `,
      variables: ['customerName', 'cartItems', 'cartTotal', 'checkoutUrl', 'storeName']
    });

    // Order confirmation template
    this.templates.set('order-confirmation', {
      id: 'order-confirmation',
      name: 'Order Confirmation',
      subject: 'Order Confirmation #{{orderNumber}} - {{storeName}}',
      htmlTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Order Confirmed! 🎉</h1>
          <p>Hi {{customerName}},</p>
          <p>Thank you for your order! We've received your payment and are preparing your items for shipment.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> #{{orderNumber}}</p>
            <p><strong>Order Date:</strong> {{orderDate}}</p>
            <p><strong>Total:</strong> ${{orderTotal}}</p>
          </div>
          
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3>Items Ordered:</h3>
            {{#each orderItems}}
            <div style="display: flex; align-items: center; margin: 15px 0; padding: 15px; border-bottom: 1px solid #eee;">
              <img src="{{image}}" alt="{{title}}" style="width: 60px; height: 60px; object-fit: cover; margin-right: 15px;">
              <div style="flex: 1;">
                <h4 style="margin: 0;">{{title}}</h4>
                <p style="margin: 5px 0; color: #666;">Quantity: {{quantity}}</p>
                <p style="margin: 5px 0;">${{price}} each</p>
              </div>
            </div>
            {{/each}}
          </div>
          
          <div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Shipping Information</h3>
            <p>{{shippingAddress.name}}<br>
            {{shippingAddress.address1}}<br>
            {{#if shippingAddress.address2}}{{shippingAddress.address2}}<br>{{/if}}
            {{shippingAddress.city}}, {{shippingAddress.province}} {{shippingAddress.zip}}<br>
            {{shippingAddress.country}}</p>
          </div>
          
          <p>We'll send you a tracking number once your order ships. Expected delivery: {{expectedDelivery}}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{orderTrackingUrl}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Track Your Order</a>
          </div>
        </div>
      `,
      textTemplate: `
        Order Confirmed!
        
        Hi {{customerName}},
        
        Thank you for your order! We've received your payment and are preparing your items for shipment.
        
        Order Details:
        Order Number: #{{orderNumber}}
        Order Date: {{orderDate}}
        Total: ${{orderTotal}}
        
        Items Ordered:
        {{#each orderItems}}
        - {{title}} (Qty: {{quantity}}) - ${{price}} each
        {{/each}}
        
        Shipping to:
        {{shippingAddress.name}}
        {{shippingAddress.address1}}
        {{#if shippingAddress.address2}}{{shippingAddress.address2}}{{/if}}
        {{shippingAddress.city}}, {{shippingAddress.province}} {{shippingAddress.zip}}
        {{shippingAddress.country}}
        
        Expected delivery: {{expectedDelivery}}
        
        Track your order: {{orderTrackingUrl}}
      `,
      variables: ['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'orderItems', 'shippingAddress', 'expectedDelivery', 'orderTrackingUrl', 'storeName']
    });

    console.log('📧 Default email templates created');
  },

  async registerEventHandlers() {
    // Register event handlers with Mercury SDK
    if (typeof sdk !== 'undefined') {
      // Welcome email on customer creation
      sdk.on('customer:created', async (event) => {
        await this.sendWelcomeEmail(event.payload);
      });

      // Abandoned cart recovery
      sdk.on('cart:abandoned', async (event) => {
        // Wait 1 hour before sending abandoned cart email
        setTimeout(async () => {
          await this.sendAbandonedCartEmail(event.payload);
        }, 60 * 60 * 1000);
      });

      // Order confirmation
      sdk.on('order:created', async (event) => {
        await this.sendOrderConfirmationEmail(event.payload);
      });

      console.log('📧 Event handlers registered');
    }
  },

  async cleanupEventHandlers() {
    if (typeof sdk !== 'undefined') {
      sdk.off('customer:created');
      sdk.off('cart:abandoned');
      sdk.off('order:created');
    }
  },

  // Email sending methods
  async sendEmail(to, template, data) {
    try {
      if (!this.emailService) {
        throw new Error('Email service not initialized');
      }

      const compiledTemplate = this.compileTemplate(template, data);
      
      const mailOptions = {
        from: `${this.config.defaultFromName} <${this.config.defaultFromEmail}>`,
        to: to,
        subject: compiledTemplate.subject,
        html: compiledTemplate.html,
        text: compiledTemplate.text
      };

      const result = await this.emailService.sendMail(mailOptions);
      
      // Track analytics
      if (this.config.enableAnalytics) {
        this.analytics.sent++;
        await this.trackEmailEvent('sent', {
          to,
          template: template.id,
          messageId: result.messageId
        });
      }

      console.log(`📧 Email sent: ${template.name} to ${to}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  },

  async sendWelcomeEmail(customer) {
    const template = this.templates.get('welcome');
    const data = {
      storeName: customer.storeName || 'Our Store',
      customerName: customer.firstName || 'Customer',
      shopUrl: customer.shopUrl || '#',
      unsubscribeUrl: this.config.unsubscribeUrl || '#'
    };

    await this.sendEmail(customer.email, template, data);
  },

  async sendAbandonedCartEmail(cart) {
    const template = this.templates.get('abandoned-cart');
    const data = {
      customerName: cart.customer.firstName || 'Customer',
      cartItems: cart.items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price.toFixed(2),
        image: item.image || '/placeholder.jpg'
      })),
      cartTotal: cart.total.toFixed(2),
      checkoutUrl: cart.checkoutUrl || '#',
      storeName: cart.storeName || 'Our Store'
    };

    await this.sendEmail(cart.customer.email, template, data);
  },

  async sendOrderConfirmationEmail(order) {
    const template = this.templates.get('order-confirmation');
    const data = {
      customerName: order.customer.firstName || 'Customer',
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      orderTotal: order.total.toFixed(2),
      orderItems: order.items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price.toFixed(2),
        image: item.image || '/placeholder.jpg'
      })),
      shippingAddress: order.shippingAddress,
      expectedDelivery: order.expectedDelivery || 'Within 5-7 business days',
      orderTrackingUrl: order.trackingUrl || '#',
      storeName: order.storeName || 'Our Store'
    };

    await this.sendEmail(order.customer.email, template, data);
  },

  // Template compilation
  compileTemplate(template, data) {
    const subjectTemplate = Handlebars.compile(template.subject);
    const htmlTemplate = Handlebars.compile(template.htmlTemplate);
    const textTemplate = Handlebars.compile(template.textTemplate);

    return {
      subject: subjectTemplate(data),
      html: htmlTemplate(data),
      text: textTemplate(data)
    };
  },

  // Campaign management
  async createCampaign(campaignData) {
    const campaign = {
      id: `campaign_${Date.now()}`,
      name: campaignData.name,
      template: campaignData.template,
      recipients: campaignData.recipients || [],
      scheduledAt: campaignData.scheduledAt,
      status: 'draft',
      createdAt: new Date(),
      analytics: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0
      }
    };

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  },

  async sendCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft') {
      throw new Error('Campaign already sent or in progress');
    }

    campaign.status = 'sending';
    
    try {
      for (const recipient of campaign.recipients) {
        await this.sendEmail(recipient.email, campaign.template, recipient.data);
        campaign.analytics.sent++;
      }
      
      campaign.status = 'sent';
      campaign.sentAt = new Date();
      
      console.log(`📧 Campaign "${campaign.name}" sent to ${campaign.recipients.length} recipients`);
    } catch (error) {
      campaign.status = 'failed';
      campaign.error = error.message;
      throw error;
    }
  },

  // Analytics and tracking
  async trackEmailEvent(event, data) {
    if (!this.config.enableAnalytics) return;

    const analyticsData = {
      event,
      timestamp: new Date(),
      ...data
    };

    // Store analytics data (in a real implementation, this would go to a database)
    console.log('📊 Email analytics:', analyticsData);
    
    // Update counters
    if (this.analytics[event] !== undefined) {
      this.analytics[event]++;
    }
  },

  // API endpoints for plugin
  getAPIEndpoints() {
    return {
      // Template management
      'GET /templates': this.getTemplates.bind(this),
      'POST /templates': this.createTemplate.bind(this),
      'PUT /templates/:id': this.updateTemplate.bind(this),
      'DELETE /templates/:id': this.deleteTemplate.bind(this),
      
      // Campaign management
      'GET /campaigns': this.getCampaigns.bind(this),
      'POST /campaigns': this.createCampaign.bind(this),
      'POST /campaigns/:id/send': this.sendCampaign.bind(this),
      
      // Analytics
      'GET /analytics': this.getAnalytics.bind(this),
      
      // Manual email sending
      'POST /send': this.sendManualEmail.bind(this)
    };
  },

  async getTemplates() {
    return Array.from(this.templates.values());
  },

  async createTemplate(templateData) {
    const template = {
      id: templateData.id || `template_${Date.now()}`,
      name: templateData.name,
      subject: templateData.subject,
      htmlTemplate: templateData.htmlTemplate,
      textTemplate: templateData.textTemplate,
      variables: templateData.variables || [],
      createdAt: new Date()
    };

    this.templates.set(template.id, template);
    return template;
  },

  async updateTemplate(id, updates) {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    Object.assign(template, updates, { updatedAt: new Date() });
    return template;
  },

  async deleteTemplate(id) {
    return this.templates.delete(id);
  },

  async getCampaigns() {
    return Array.from(this.campaigns.values());
  },

  async getAnalytics() {
    return this.analytics;
  },

  async sendManualEmail(emailData) {
    const template = this.templates.get(emailData.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    return await this.sendEmail(emailData.to, template, emailData.data);
  },

  // Cleanup
  async cleanupData() {
    this.templates.clear();
    this.campaigns.clear();
    this.analytics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0
    };
  }
};

// Export the plugin
export default emailMarketingPlugin;