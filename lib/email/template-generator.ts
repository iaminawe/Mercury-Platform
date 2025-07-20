import { createClient } from '@/lib/supabase/server';

export interface AIContentRequest {
  type: 'newsletter' | 'welcome' | 'abandoned_cart' | 'product_recommendation' | 'win_back';
  customerData?: Record<string, any>;
  productData?: Array<Record<string, any>>;
  brandVoice?: 'professional' | 'casual' | 'friendly' | 'urgent';
  goals?: string[];
  previousContent?: string[];
}

export interface GeneratedContent {
  subject: string;
  headline: string;
  bodyContent: string;
  cta: string;
  variants?: Array<{
    subject: string;
    headline: string;
    bodyContent: string;
    cta: string;
  }>;
}

export class TemplateGenerator {
  /**
   * Generate AI-powered email content using OpenAI or similar service
   */
  async generateContent(request: AIContentRequest): Promise<GeneratedContent> {
    try {
      // For now, we'll use template-based generation
      // This can be enhanced with actual AI/LLM integration
      const content = this.generateTemplateContent(request);
      
      // Store generated content for learning
      await this.storeGeneratedContent(request, content);
      
      return content;
    } catch (error) {
      console.error('Failed to generate content:', error);
      throw error;
    }
  }

  /**
   * Generate content based on templates and rules
   */
  private generateTemplateContent(request: AIContentRequest): GeneratedContent {
    const { type, customerData, productData, brandVoice = 'friendly' } = request;

    switch (type) {
      case 'newsletter':
        return this.generateNewsletterContent(customerData, brandVoice);
      
      case 'welcome':
        return this.generateWelcomeContent(customerData, brandVoice);
      
      case 'abandoned_cart':
        return this.generateAbandonedCartContent(customerData, productData, brandVoice);
      
      case 'product_recommendation':
        return this.generateProductRecommendationContent(customerData, productData, brandVoice);
      
      case 'win_back':
        return this.generateWinBackContent(customerData, brandVoice);
      
      default:
        throw new Error(`Unsupported content type: ${type}`);
    }
  }

  private generateNewsletterContent(customerData?: Record<string, any>, brandVoice?: string): GeneratedContent {
    const firstName = customerData?.first_name || 'there';
    
    return {
      subject: `Hey ${firstName}, check out what's new! ✨`,
      headline: `Latest updates just for you, ${firstName}`,
      bodyContent: `
        <p>Hi ${firstName},</p>
        <p>We've got some exciting updates to share with you this week! Here's what's been happening:</p>
        <ul>
          <li>🆕 New product arrivals that we think you'll love</li>
          <li>📈 Trending items in your favorite categories</li>
          <li>💡 Tips and tricks from our community</li>
        </ul>
        <p>Plus, we've got a special surprise waiting for you below...</p>
      `,
      cta: 'Explore What\'s New',
      variants: [
        {
          subject: `${firstName}, your weekly dose of awesome is here! 🚀`,
          headline: `This week's highlights for you`,
          bodyContent: `
            <p>Hello ${firstName},</p>
            <p>Another week, another set of amazing updates! We've curated the best content just for you:</p>
            <div>✨ Featured products picked by our team</div>
            <div>🎯 Personalized recommendations</div>
            <div>📚 Educational content you might enjoy</div>
          `,
          cta: 'See This Week\'s Picks'
        }
      ]
    };
  }

  private generateWelcomeContent(customerData?: Record<string, any>, brandVoice?: string): GeneratedContent {
    const firstName = customerData?.first_name || 'there';
    
    return {
      subject: `Welcome to Mercury, ${firstName}! 🎉`,
      headline: `Welcome aboard, ${firstName}!`,
      bodyContent: `
        <p>Hi ${firstName},</p>
        <p>Welcome to Mercury! We're thrilled to have you join our community of savvy shoppers.</p>
        <p>Here's what you can expect:</p>
        <ul>
          <li>🛍️ Curated product recommendations just for you</li>
          <li>💰 Exclusive deals and early access to sales</li>
          <li>📧 Helpful tips and industry insights</li>
          <li>🎁 Special birthday and anniversary surprises</li>
        </ul>
        <p>To get started, why not check out our most popular items?</p>
      `,
      cta: 'Start Shopping',
      variants: [
        {
          subject: `🎉 Welcome, ${firstName}! Your journey starts here`,
          headline: `Let's get you started, ${firstName}`,
          bodyContent: `
            <p>Hey ${firstName},</p>
            <p>Thanks for joining Mercury! We're excited to help you discover amazing products.</p>
            <p>Take a moment to personalize your experience:</p>
            <div>👤 Complete your profile</div>
            <div>❤️ Tell us your interests</div>
            <div>🎯 Set your preferences</div>
          `,
          cta: 'Personalize My Experience'
        }
      ]
    };
  }

  private generateAbandonedCartContent(
    customerData?: Record<string, any>,
    productData?: Array<Record<string, any>>,
    brandVoice?: string
  ): GeneratedContent {
    const firstName = customerData?.first_name || 'there';
    const productName = productData?.[0]?.title || 'item';
    
    return {
      subject: `${firstName}, you left something behind! 🛒`,
      headline: `Don't forget about your ${productName}!`,
      bodyContent: `
        <p>Hi ${firstName},</p>
        <p>We noticed you were interested in some great items but didn't complete your purchase. No worries - we've saved them for you!</p>
        <p>Your cart includes:</p>
        ${productData?.map(product => `
          <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 8px;">
            <h3>${product.title}</h3>
            <p>Price: $${product.price}</p>
            <p>${product.description}</p>
          </div>
        `).join('') || '<p>Your selected items are waiting for you!</p>'}
        <p>Complete your purchase now and we'll get these shipped to you right away.</p>
      `,
      cta: 'Complete My Purchase',
      variants: [
        {
          subject: `Still thinking about that ${productName}? 🤔`,
          headline: `Your items are waiting for you`,
          bodyContent: `
            <p>Hey ${firstName},</p>
            <p>Sometimes the best things are worth sleeping on. We get it!</p>
            <p>Your cart is still here whenever you're ready, and we wanted to let you know that these items are popular and might sell out soon.</p>
            <p>Need help deciding? Our team is here to help!</p>
          `,
          cta: 'Get Shopping Help'
        }
      ]
    };
  }

  private generateProductRecommendationContent(
    customerData?: Record<string, any>,
    productData?: Array<Record<string, any>>,
    brandVoice?: string
  ): GeneratedContent {
    const firstName = customerData?.first_name || 'there';
    
    return {
      subject: `${firstName}, we found something perfect for you! 💎`,
      headline: `Handpicked recommendations for you`,
      bodyContent: `
        <p>Hi ${firstName},</p>
        <p>Based on your browsing history and preferences, we've curated some items we think you'll absolutely love:</p>
        ${productData?.map(product => `
          <div style="border: 1px solid #eee; padding: 20px; margin: 15px 0; border-radius: 8px;">
            <h3>${product.title}</h3>
            <p style="font-size: 18px; color: #333;">$${product.price}</p>
            <p>${product.description}</p>
            <a href="${product.url}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Product</a>
          </div>
        `).join('') || '<p>Amazing products selected just for you!</p>'}
        <p>These recommendations are based on your interests and what similar customers have loved.</p>
      `,
      cta: 'Shop Recommendations',
      variants: [
        {
          subject: `${firstName}, trending items you might love! 📈`,
          headline: `What's trending in your interests`,
          bodyContent: `
            <p>Hey ${firstName},</p>
            <p>We've noticed some exciting trends in products similar to what you've shown interest in.</p>
            <p>Here are the top trending items that match your style:</p>
            <p>🔥 Popular with customers like you</p>
            <p>⭐ Highly rated and reviewed</p>
            <p>🚀 Flying off our shelves</p>
          `,
          cta: 'See What\'s Trending'
        }
      ]
    };
  }

  private generateWinBackContent(customerData?: Record<string, any>, brandVoice?: string): GeneratedContent {
    const firstName = customerData?.first_name || 'there';
    const lastOrderDate = customerData?.last_order_date;
    
    return {
      subject: `We miss you, ${firstName}! Come back with 20% off 💔`,
      headline: `We miss you, ${firstName}!`,
      bodyContent: `
        <p>Hi ${firstName},</p>
        <p>It's been a while since we've seen you, and we wanted to reach out because we genuinely miss having you as part of our community.</p>
        ${lastOrderDate ? `<p>We remember your last order on ${new Date(lastOrderDate).toLocaleDateString()}, and we hope you loved what you received!</p>` : ''}
        <p>A lot has changed since you've been away:</p>
        <ul>
          <li>🆕 New products in categories you've shown interest in</li>
          <li>✨ Improved shopping experience</li>
          <li>🚚 Faster shipping options</li>
          <li>💰 Better deals and exclusive offers</li>
        </ul>
        <p>To welcome you back, we're offering you an exclusive 20% discount on your next order. No strings attached - just our way of saying we'd love to have you back!</p>
      `,
      cta: 'Get My 20% Off',
      variants: [
        {
          subject: `${firstName}, special offer just for you! 🎁`,
          headline: `Something special for our returning customers`,
          bodyContent: `
            <p>Hey ${firstName},</p>
            <p>We've been working hard to improve our products and service, and we'd love for you to experience the changes.</p>
            <p>As a valued past customer, you get:</p>
            <div>🎁 Exclusive 20% discount</div>
            <div>🚚 Free shipping on your return order</div>
            <div>⚡ Priority customer support</div>
            <p>This offer is limited time and exclusively for you.</p>
          `,
          cta: 'Claim My Special Offer'
        }
      ]
    };
  }

  /**
   * Store generated content for learning and optimization
   */
  private async storeGeneratedContent(request: AIContentRequest, content: GeneratedContent) {
    const supabase = createClient();
    
    try {
      await supabase.from('ai_generated_content').insert({
        content_type: request.type,
        request_data: request,
        generated_content: content,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store generated content:', error);
    }
  }

  /**
   * Get performance data for content optimization
   */
  async getContentPerformance(contentType: string, limit = 10) {
    const supabase = createClient();
    
    const { data } = await supabase
      .from('ai_generated_content')
      .select(`
        *,
        email_campaigns(
          id,
          open_rate,
          click_rate,
          conversion_rate
        )
      `)
      .eq('content_type', contentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data;
  }

  /**
   * A/B test subject lines and content
   */
  async createABTest(campaignId: string, variants: Array<{ subject: string; content: string }>) {
    const supabase = createClient();
    
    const { data } = await supabase.from('ab_tests').insert({
      campaign_id: campaignId,
      variants,
      status: 'active',
      created_at: new Date().toISOString()
    }).select().single();

    return data;
  }
}

export const templateGenerator = new TemplateGenerator();