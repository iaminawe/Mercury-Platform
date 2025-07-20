import { EmailTemplateGenerator } from '@/lib/email/template-generator';
import { EmailPersonalization } from '@/lib/email/personalization';
import { ABTestingService } from '@/lib/email/a-b-testing';
import { CampaignScheduler } from '@/lib/email/campaign-scheduler';
import { describe, beforeEach, test, expect, jest } from '@jest/globals';

describe('AI Email Generation Testing Suite', () => {
  let templateGenerator: EmailTemplateGenerator;
  let personalization: EmailPersonalization;
  let abTesting: ABTestingService;
  let campaignScheduler: CampaignScheduler;

  const mockCustomerData = {
    id: 'customer-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    totalSpent: 1250.00,
    ordersCount: 5,
    lastOrderDate: '2024-01-15',
    preferredCategories: ['electronics', 'books'],
    location: 'New York, NY',
    language: 'en',
    timezone: 'America/New_York'
  };

  const mockProductData = {
    id: 'product-456',
    title: 'Premium Wireless Headphones',
    price: 199.99,
    description: 'High-quality wireless headphones with noise cancellation',
    images: ['https://example.com/headphones.jpg'],
    category: 'electronics',
    tags: ['audio', 'wireless', 'premium']
  };

  beforeEach(() => {
    templateGenerator = new EmailTemplateGenerator();
    personalization = new EmailPersonalization();
    abTesting = new ABTestingService();
    campaignScheduler = new CampaignScheduler();
  });

  describe('Email Template Generation Quality', () => {
    test('should generate relevant abandoned cart emails', async () => {
      const cartItems = [mockProductData];
      const template = await templateGenerator.generateAbandonedCartEmail({
        customer: mockCustomerData,
        cartItems,
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        cartTotal: 199.99
      });

      // Should include customer name
      expect(template.subject).toContain('John');
      expect(template.content).toContain('John');

      // Should mention the product
      expect(template.content).toContain('Premium Wireless Headphones');
      expect(template.content).toContain('$199.99');

      // Should have compelling subject line
      expect(template.subject.length).toBeGreaterThan(10);
      expect(template.subject.length).toBeLessThan(80); // Good email subject length

      // Should include call-to-action
      expect(template.content).toMatch(/complete.*purchase|finish.*order|checkout|buy now/i);

      // Should have professional tone
      expect(template.content).not.toMatch(/urgent|limited time|act now|hurry/i);
    });

    test('should generate personalized product recommendation emails', async () => {
      const recommendations = [mockProductData];
      const template = await templateGenerator.generateProductRecommendationEmail({
        customer: mockCustomerData,
        recommendations,
        reason: 'Based on your previous electronics purchases'
      });

      // Should be personalized
      expect(template.content).toContain('John');
      expect(template.content).toContain('electronics');

      // Should explain recommendation reason
      expect(template.content).toContain('previous');
      expect(template.content).toContain('electronics');

      // Should include product details
      expect(template.content).toContain('Premium Wireless Headphones');

      // Should have engaging subject
      expect(template.subject).toMatch(/recommend|perfect|you.*like|handpicked/i);
    });

    test('should generate welcome series emails', async () => {
      const emailSeries = await templateGenerator.generateWelcomeSeriesEmails({
        customer: mockCustomerData,
        storeInfo: {
          name: 'Mercury Store',
          description: 'Premium electronics and gadgets'
        }
      });

      expect(emailSeries.length).toBeGreaterThanOrEqual(3); // Should have multiple emails

      // First email should be welcoming
      const welcomeEmail = emailSeries[0];
      expect(welcomeEmail.subject).toMatch(/welcome|hello|thank you/i);
      expect(welcomeEmail.content).toContain('John');
      expect(welcomeEmail.content).toContain('Mercury Store');

      // Series should have progressive content
      const subjects = emailSeries.map(email => email.subject.toLowerCase());
      expect(subjects.some(s => s.includes('welcome'))).toBe(true);
      expect(subjects.some(s => s.includes('guide') || s.includes('start'))).toBe(true);
    });

    test('should generate win-back emails for inactive customers', async () => {
      const inactiveCustomer = {
        ...mockCustomerData,
        lastOrderDate: '2023-06-01', // 7+ months ago
        daysSinceLastOrder: 230
      };

      const template = await templateGenerator.generateWinBackEmail({
        customer: inactiveCustomer,
        incentive: {
          type: 'discount',
          value: 20,
          code: 'COMEBACK20'
        }
      });

      // Should acknowledge absence
      expect(template.content).toMatch(/miss|haven.*seen|while|back/i);

      // Should include incentive
      expect(template.content).toContain('20');
      expect(template.content).toContain('COMEBACK20');

      // Should be compelling but not desperate
      expect(template.subject).toMatch(/miss|back|return|welcome.*back/i);
      expect(template.subject).not.toMatch(/last chance|final|urgent/i);
    });
  });

  describe('Personalization Quality', () => {
    test('should personalize based on purchase history', async () => {
      const baseTemplate = {
        subject: 'Check out our new products',
        content: 'Dear {{firstName}}, we have new {{category}} products you might like!'
      };

      const personalized = await personalization.personalizeEmail(baseTemplate, {
        customer: mockCustomerData,
        context: {
          recentPurchases: [{ category: 'electronics' }],
          browsingHistory: [{ category: 'books' }]
        }
      });

      expect(personalized.subject).not.toContain('{{');
      expect(personalized.content).toContain('John');
      expect(personalized.content).toContain('electronics');
    });

    test('should personalize based on geographic location', async () => {
      const template = {
        subject: 'New arrivals in your area',
        content: 'Dear {{firstName}}, check out products shipping to {{location}}!'
      };

      const personalized = await personalization.personalizeEmail(template, {
        customer: mockCustomerData
      });

      expect(personalized.content).toContain('New York');
    });

    test('should personalize based on spending behavior', async () => {
      const highValueCustomer = {
        ...mockCustomerData,
        totalSpent: 5000,
        averageOrderValue: 500
      };

      const template = {
        subject: 'Exclusive offer for our valued customers',
        content: 'As one of our {{customerTier}} customers, enjoy this special offer!'
      };

      const personalized = await personalization.personalizeEmail(template, {
        customer: highValueCustomer
      });

      expect(personalized.content).toMatch(/premium|valued|VIP|exclusive/i);
    });

    test('should handle missing customer data gracefully', async () => {
      const incompleteCustomer = {
        id: 'customer-789',
        email: 'test@example.com'
        // Missing other fields
      };

      const template = {
        subject: 'Hello {{firstName|Guest}}',
        content: 'Dear {{firstName|Valued Customer}}, thanks for shopping with us!'
      };

      const personalized = await personalization.personalizeEmail(template, {
        customer: incompleteCustomer
      });

      expect(personalized.subject).toContain('Guest');
      expect(personalized.content).toContain('Valued Customer');
      expect(personalized.content).not.toContain('{{');
    });
  });

  describe('A/B Testing Effectiveness', () => {
    test('should create meaningful A/B test variants', async () => {
      const baseEmail = {
        subject: 'New products available',
        content: 'Check out our new arrivals!'
      };

      const variants = await abTesting.createVariants(baseEmail, {
        testType: 'subject_line',
        variations: ['urgency', 'curiosity', 'personal']
      });

      expect(variants.length).toBeGreaterThanOrEqual(2);

      // Variants should be different
      const subjects = variants.map(v => v.subject);
      const uniqueSubjects = [...new Set(subjects)];
      expect(uniqueSubjects.length).toBe(subjects.length);

      // Should test different psychological triggers
      const hasUrgency = subjects.some(s => s.match(/today|now|limited|hurry/i));
      const hasCuriosity = subjects.some(s => s.match(/\?|discover|reveal|secret/i));
      const hasPersonal = subjects.some(s => s.match(/you|your|for you/i));

      expect(hasUrgency || hasCuriosity || hasPersonal).toBe(true);
    });

    test('should test different content structures', async () => {
      const baseEmail = {
        subject: 'Product recommendation',
        content: 'We think you\'ll love these products based on your previous purchases.'
      };

      const variants = await abTesting.createVariants(baseEmail, {
        testType: 'content_structure',
        variations: ['bullet_points', 'story_format', 'minimal']
      });

      expect(variants.length).toBeGreaterThanOrEqual(2);

      const contents = variants.map(v => v.content);
      
      // Should have different structures
      const hasBulletPoints = contents.some(c => c.includes('•') || c.includes('-'));
      const hasStoryElements = contents.some(c => c.match(/story|journey|experience/i));
      const hasMinimalContent = contents.some(c => c.length < baseEmail.content.length);

      expect(hasBulletPoints || hasStoryElements || hasMinimalContent).toBe(true);
    });

    test('should track test performance metrics', async () => {
      const testId = 'test-123';
      const variants = [
        { id: 'A', subject: 'Version A', content: 'Content A' },
        { id: 'B', subject: 'Version B', content: 'Content B' }
      ];

      // Simulate test results
      await abTesting.recordResults(testId, {
        variantA: { sent: 1000, opened: 250, clicked: 50, converted: 10 },
        variantB: { sent: 1000, opened: 300, clicked: 75, converted: 18 }
      });

      const analysis = await abTesting.analyzeResults(testId);

      expect(analysis.winner).toBe('B');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.metrics.openRate.variantB).toBeGreaterThan(analysis.metrics.openRate.variantA);
      expect(analysis.metrics.conversionRate.variantB).toBeGreaterThan(analysis.metrics.conversionRate.variantA);
    });
  });

  describe('Campaign Scheduling Optimization', () => {
    test('should optimize send times based on customer timezone', async () => {
      const campaign = {
        id: 'campaign-123',
        template: {
          subject: 'Flash sale ending soon',
          content: 'Don\'t miss out on our flash sale!'
        },
        recipients: [mockCustomerData]
      };

      const optimizedSchedule = await campaignScheduler.optimizeSendTimes(campaign);

      expect(optimizedSchedule.sendTimes).toBeDefined();
      expect(optimizedSchedule.sendTimes.length).toBeGreaterThan(0);

      // Should consider timezone
      const customerSendTime = optimizedSchedule.sendTimes.find(
        st => st.customerId === mockCustomerData.id
      );
      expect(customerSendTime).toBeDefined();
      expect(customerSendTime?.timezone).toBe('America/New_York');
    });

    test('should optimize for customer engagement patterns', async () => {
      const highEngagementCustomer = {
        ...mockCustomerData,
        emailEngagement: {
          preferredTime: '09:00',
          preferredDays: ['tuesday', 'wednesday'],
          openRate: 0.45,
          clickRate: 0.12
        }
      };

      const campaign = {
        id: 'campaign-456',
        template: {
          subject: 'Weekly newsletter',
          content: 'Here\'s what\'s new this week!'
        },
        recipients: [highEngagementCustomer]
      };

      const schedule = await campaignScheduler.optimizeSendTimes(campaign);
      const customerSchedule = schedule.sendTimes.find(
        st => st.customerId === highEngagementCustomer.id
      );

      expect(customerSchedule?.recommendedTime).toContain('09:');
      expect(['tuesday', 'wednesday']).toContain(
        customerSchedule?.recommendedDay?.toLowerCase()
      );
    });

    test('should avoid over-communication', async () => {
      const recentlyEmailedCustomer = {
        ...mockCustomerData,
        lastEmailSent: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        emailFrequency: 'weekly'
      };

      const campaign = {
        id: 'campaign-789',
        template: {
          subject: 'Another promotion',
          content: 'Check out this new offer!'
        },
        recipients: [recentlyEmailedCustomer]
      };

      const schedule = await campaignScheduler.optimizeSendTimes(campaign);
      const customerSchedule = schedule.sendTimes.find(
        st => st.customerId === recentlyEmailedCustomer.id
      );

      // Should delay sending or skip this customer
      expect(
        customerSchedule?.delay === true || 
        customerSchedule?.skip === true ||
        !customerSchedule
      ).toBe(true);
    });
  });

  describe('Content Quality and Compliance', () => {
    test('should avoid spam trigger words', async () => {
      const spamWords = [
        'free money', 'guaranteed', 'act now', 'limited time offer',
        'cash bonus', 'risk free', 'no obligation', 'call now'
      ];

      const template = await templateGenerator.generatePromotionalEmail({
        customer: mockCustomerData,
        promotion: {
          type: 'discount',
          value: 25,
          code: 'SAVE25',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      const content = (template.subject + ' ' + template.content).toLowerCase();
      
      // Should avoid obvious spam triggers
      const spamTriggers = spamWords.filter(word => content.includes(word.toLowerCase()));
      expect(spamTriggers.length).toBeLessThanOrEqual(1); // Allow minimal usage
    });

    test('should include required compliance elements', async () => {
      const template = await templateGenerator.generateNewsletterEmail({
        customer: mockCustomerData,
        content: {
          headline: 'This Week in Tech',
          articles: [
            { title: 'New Product Launch', summary: 'Exciting new gadgets available' }
          ]
        }
      });

      // Should include unsubscribe link
      expect(template.content).toMatch(/unsubscribe|opt.*out|remove.*subscription/i);

      // Should include company information
      expect(template.content).toMatch(/mercury|company|business/i);

      // Should have proper email structure
      expect(template.content).toMatch(/<html|<!DOCTYPE/i);
      expect(template.content).toContain('</html>');
    });

    test('should maintain consistent brand voice', async () => {
      const templates = await Promise.all([
        templateGenerator.generateWelcomeEmail({ customer: mockCustomerData }),
        templateGenerator.generateOrderConfirmationEmail({ 
          customer: mockCustomerData,
          order: { id: 'order-123', total: 199.99, items: [mockProductData] }
        }),
        templateGenerator.generateShippingNotificationEmail({
          customer: mockCustomerData,
          order: { id: 'order-123', trackingNumber: 'TRK123456' }
        })
      ]);

      // All templates should have consistent tone
      const allContent = templates.map(t => t.content).join(' ').toLowerCase();
      
      // Should be professional and friendly
      expect(allContent).toMatch(/thank you|thanks|appreciate/i);
      expect(allContent).not.toMatch(/hey|yo|sup|awesome/i); // Too casual
      expect(allContent).not.toMatch(/sir|madam|dear sir/i); // Too formal
    });
  });

  describe('Performance and Scalability', () => {
    test('should generate emails efficiently for large recipient lists', async () => {
      const largeRecipientList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockCustomerData,
        id: `customer-${i}`,
        email: `customer${i}@example.com`,
        firstName: `Customer${i}`
      }));

      const startTime = performance.now();

      const emails = await templateGenerator.generateBulkEmails({
        template: {
          subject: 'Monthly newsletter',
          content: 'Dear {{firstName}}, here\'s our monthly update!'
        },
        recipients: largeRecipientList.slice(0, 100) // Test with 100 for reasonable test time
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(emails.length).toBe(100);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Each email should be personalized
      emails.forEach((email, index) => {
        expect(email.content).toContain(`Customer${index}`);
        expect(email.to).toBe(`customer${index}@example.com`);
      });
    });

    test('should handle email generation failures gracefully', async () => {
      const invalidCustomerData = {
        id: null,
        email: 'invalid-email',
        firstName: '', // Empty name
        lastName: undefined
      };

      // Should not throw errors with invalid data
      await expect(
        templateGenerator.generateWelcomeEmail({ 
          customer: invalidCustomerData as any 
        })
      ).resolves.toBeDefined();
    });

    test('should optimize email content size', async () => {
      const template = await templateGenerator.generateProductCatalogEmail({
        customer: mockCustomerData,
        products: Array.from({ length: 50 }, (_, i) => ({
          ...mockProductData,
          id: `product-${i}`,
          title: `Product ${i}`
        }))
      });

      // Email should not be excessively large
      const emailSize = Buffer.byteLength(template.content, 'utf8');
      expect(emailSize).toBeLessThan(1024 * 1024); // Less than 1MB

      // Should still include essential information
      expect(template.content).toContain('Product 0');
      expect(template.content).toContain('Product 49');
    });
  });

  describe('Analytics and Tracking', () => {
    test('should include proper tracking pixels', async () => {
      const template = await templateGenerator.generatePromotionalEmail({
        customer: mockCustomerData,
        promotion: {
          type: 'discount',
          value: 20,
          code: 'SAVE20'
        },
        trackingId: 'campaign-123'
      });

      // Should include tracking pixel
      expect(template.content).toMatch(/tracking.*pixel|open.*tracking/i);
      expect(template.content).toContain('campaign-123');
    });

    test('should include UTM parameters in links', async () => {
      const template = await templateGenerator.generateProductRecommendationEmail({
        customer: mockCustomerData,
        recommendations: [mockProductData],
        campaignId: 'recommendation-456'
      });

      // Should include UTM tracking in product links
      expect(template.content).toMatch(/utm_source|utm_medium|utm_campaign/i);
      expect(template.content).toContain('recommendation-456');
    });
  });
});