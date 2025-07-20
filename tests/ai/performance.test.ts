import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// AI Service imports
import { ShopifyRecommendationEngine } from '@/lib/ai/advisor/recommendation-engine';
import { ConversationHandler } from '@/lib/ai/chatbot/conversation-handler';
import { EmailTemplateGenerator } from '@/lib/email/template-generator';
import { createVectorStore, searchSimilarDocuments } from '@/lib/ai/vector-store';
import { createChatCompletion, createEmbedding } from '@/lib/ai/openai-client';

describe('AI Performance Benchmarking Suite', () => {
  let recommendationEngine: ShopifyRecommendationEngine;
  let conversationHandler: ConversationHandler;
  let emailGenerator: EmailTemplateGenerator;

  beforeEach(() => {
    recommendationEngine = new ShopifyRecommendationEngine();
    conversationHandler = new ConversationHandler();
    emailGenerator = new EmailTemplateGenerator();
  });

  describe('Response Time Benchmarks', () => {
    test('AI Advisor should respond within 5 seconds', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 2000 + 500,
        orders: Math.floor(Math.random() * 20) + 5
      }));

      const startTime = performance.now();
      
      const recommendations = await recommendationEngine.generateRecommendations(testData, {
        salesData: testData,
        isTestMode: true
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000); // 5 seconds
      expect(recommendations).toBeDefined();
      
      console.log(`AI Advisor Response Time: ${responseTime.toFixed(2)}ms`);
    });

    test('Chatbot should respond within 3 seconds', async () => {
      const testQueries = [
        'I need help with my order',
        'Show me wireless headphones',
        'What is your return policy?',
        'Track my order #12345',
        'I want to return an item'
      ];

      const responseTimes: number[] = [];

      for (const query of testQueries) {
        const startTime = performance.now();
        
        await conversationHandler.handleMessage(query, {
          sessionId: 'perf-test',
          customerId: 'test-customer'
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        responseTimes.push(responseTime);
        expect(responseTime).toBeLessThan(3000); // 3 seconds
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      console.log(`Chatbot Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    });

    test('Email generation should complete within 2 seconds', async () => {
      const mockCustomer = {
        id: 'customer-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        totalSpent: 1000,
        ordersCount: 5
      };

      const emailTypes = [
        () => emailGenerator.generateWelcomeEmail({ customer: mockCustomer }),
        () => emailGenerator.generateAbandonedCartEmail({
          customer: mockCustomer,
          cartItems: [{ id: '1', title: 'Test Product', price: 99.99 }],
          abandonedAt: new Date(),
          cartTotal: 99.99
        }),
        () => emailGenerator.generateProductRecommendationEmail({
          customer: mockCustomer,
          recommendations: [{ id: '1', title: 'Test Product', price: 99.99 }],
          reason: 'Based on your purchase history'
        })
      ];

      for (const emailType of emailTypes) {
        const startTime = performance.now();
        
        await emailType();
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        expect(responseTime).toBeLessThan(2000); // 2 seconds
      }
    });

    test('Vector search should return results within 1 second', async () => {
      const vectorStore = await createVectorStore();
      
      const searchQueries = [
        'wireless headphones',
        'running shoes',
        'laptop computer',
        'smartphone case',
        'winter jacket'
      ];

      for (const query of searchQueries) {
        const startTime = performance.now();
        
        await searchSimilarDocuments(query, { k: 10 }, vectorStore);
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        expect(responseTime).toBeLessThan(1000); // 1 second
      }
    });
  });

  describe('Throughput Benchmarks', () => {
    test('should handle multiple concurrent advisor requests', async () => {
      const concurrentRequests = 10;
      const testData = Array.from({ length: 50 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 1000 + 500,
        orders: Math.floor(Math.random() * 10) + 5
      }));

      const startTime = performance.now();
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        recommendationEngine.generateRecommendations(testData, {
          salesData: testData,
          storeId: `test-store-${i}`,
          isTestMode: true
        })
      );

      const results = await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = concurrentRequests / (totalTime / 1000); // requests per second

      expect(results).toHaveLength(concurrentRequests);
      expect(throughput).toBeGreaterThan(1); // At least 1 request per second
      
      console.log(`Advisor Throughput: ${throughput.toFixed(2)} requests/second`);
    });

    test('should handle multiple concurrent chatbot conversations', async () => {
      const concurrentConversations = 20;
      const queries = [
        'Hello, I need help',
        'Show me products',
        'Track my order',
        'Return policy question',
        'Payment issue'
      ];

      const startTime = performance.now();
      
      const conversations = Array.from({ length: concurrentConversations }, (_, i) =>
        conversationHandler.handleMessage(
          queries[i % queries.length],
          {
            sessionId: `session-${i}`,
            customerId: `customer-${i}`
          }
        )
      );

      const results = await Promise.all(conversations);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = concurrentConversations / (totalTime / 1000);

      expect(results).toHaveLength(concurrentConversations);
      expect(throughput).toBeGreaterThan(2); // At least 2 conversations per second
      
      console.log(`Chatbot Throughput: ${throughput.toFixed(2)} conversations/second`);
    });

    test('should process batch email generation efficiently', async () => {
      const batchSize = 50;
      const customers = Array.from({ length: batchSize }, (_, i) => ({
        id: `customer-${i}`,
        firstName: `Customer${i}`,
        lastName: 'Test',
        email: `customer${i}@example.com`,
        totalSpent: Math.random() * 2000,
        ordersCount: Math.floor(Math.random() * 10)
      }));

      const startTime = performance.now();
      
      const emails = await emailGenerator.generateBulkEmails({
        template: {
          subject: 'Monthly Newsletter',
          content: 'Dear {{firstName}}, here is your monthly update!'
        },
        recipients: customers
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = batchSize / (totalTime / 1000);

      expect(emails).toHaveLength(batchSize);
      expect(throughput).toBeGreaterThan(10); // At least 10 emails per second
      
      console.log(`Email Generation Throughput: ${throughput.toFixed(2)} emails/second`);
    });
  });

  describe('Resource Usage Benchmarks', () => {
    test('should not exceed memory limits during processing', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 2000 + 500,
        orders: Math.floor(Math.random() * 20) + 5
      }));

      await recommendationEngine.generateRecommendations(largeDataset, {
        salesData: largeDataset,
        isTestMode: true
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 200MB)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
      
      console.log(`Memory Usage Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle memory pressure gracefully', async () => {
      // Create memory pressure by processing multiple large datasets
      const datasets = Array.from({ length: 5 }, () =>
        Array.from({ length: 1000 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.random() * 2000 + 500,
          orders: Math.floor(Math.random() * 20) + 5
        }))
      );

      let successfulProcessing = 0;
      
      for (const dataset of datasets) {
        try {
          await recommendationEngine.generateRecommendations(dataset, {
            salesData: dataset,
            isTestMode: true
          });
          successfulProcessing++;
        } catch (error) {
          // Should handle memory pressure gracefully
          console.warn('Memory pressure encountered:', error);
        }
      }

      // Should process majority successfully
      expect(successfulProcessing).toBeGreaterThanOrEqual(3);
    });

    test('should maintain performance under CPU load', async () => {
      // Simulate CPU-intensive operations
      const cpuIntensiveTask = () => {
        const start = performance.now();
        while (performance.now() - start < 100) {
          Math.random() * Math.random();
        }
      };

      // Start background CPU load
      const cpuLoadPromises = Array.from({ length: 4 }, () =>
        new Promise(resolve => {
          setImmediate(() => {
            cpuIntensiveTask();
            resolve(void 0);
          });
        })
      );

      // Measure AI performance under load
      const startTime = performance.now();
      
      const aiTask = conversationHandler.handleMessage('Hello, I need help', {
        sessionId: 'cpu-test',
        customerId: 'test-customer'
      });

      const [response] = await Promise.all([aiTask, ...cpuLoadPromises]);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response).toBeDefined();
      expect(responseTime).toBeLessThan(5000); // Should still respond within 5 seconds under load
    });
  });

  describe('Scalability Benchmarks', () => {
    test('should scale linearly with data size', async () => {
      const dataSizes = [100, 500, 1000];
      const processingTimes: number[] = [];

      for (const size of dataSizes) {
        const dataset = Array.from({ length: size }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.random() * 2000 + 500,
          orders: Math.floor(Math.random() * 20) + 5
        }));

        const startTime = performance.now();
        
        await recommendationEngine.generateRecommendations(dataset, {
          salesData: dataset,
          isTestMode: true
        });
        
        const endTime = performance.now();
        processingTimes.push(endTime - startTime);
      }

      // Processing time should scale sub-linearly (better than O(n))
      const scalingFactor1 = processingTimes[1] / processingTimes[0];
      const scalingFactor2 = processingTimes[2] / processingTimes[1];
      
      expect(scalingFactor1).toBeLessThan(6); // 5x data should not take more than 6x time
      expect(scalingFactor2).toBeLessThan(3); // 2x data should not take more than 3x time
      
      console.log('Scaling factors:', scalingFactor1.toFixed(2), scalingFactor2.toFixed(2));
    });

    test('should handle increasing concurrent load', async () => {
      const concurrencyLevels = [5, 10, 20];
      const throughputResults: number[] = [];

      for (const concurrency of concurrencyLevels) {
        const startTime = performance.now();
        
        const requests = Array.from({ length: concurrency }, (_, i) =>
          conversationHandler.handleMessage(`Request ${i}`, {
            sessionId: `session-${i}`,
            customerId: `customer-${i}`
          })
        );

        await Promise.all(requests);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = concurrency / (totalTime / 1000);
        
        throughputResults.push(throughput);
      }

      // Throughput should not decrease dramatically with concurrency
      const throughputDrop = throughputResults[0] / throughputResults[2];
      expect(throughputDrop).toBeLessThan(3); // Should not drop by more than 3x
      
      console.log('Throughput at different concurrency levels:', throughputResults);
    });
  });

  describe('API Performance Benchmarks', () => {
    test('should efficiently use OpenAI API calls', async () => {
      const testCases = [
        { input: 'Short query', expectedTokens: { prompt: 50, completion: 100 } },
        { input: 'This is a longer query with more content that should use more tokens', expectedTokens: { prompt: 100, completion: 200 } }
      ];

      for (const testCase of testCases) {
        const startTime = performance.now();
        
        const response = await createChatCompletion([
          { role: 'user', content: testCase.input }
        ]);
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(3000); // API call within 3 seconds
        expect(response.usage?.prompt_tokens).toBeLessThan(testCase.expectedTokens.prompt * 2);
        expect(response.usage?.completion_tokens).toBeLessThan(testCase.expectedTokens.completion * 2);
      }
    });

    test('should optimize embedding generation', async () => {
      const testTexts = [
        'Short text',
        'Medium length text with more content and details',
        'Very long text with extensive details and comprehensive information that covers multiple topics and provides in-depth analysis'
      ];

      for (const text of testTexts) {
        const startTime = performance.now();
        
        const response = await createEmbedding(text);
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(2000); // Embedding within 2 seconds
        expect(response.data).toHaveLength(1);
        expect(response.data[0].embedding).toHaveLength(1536); // text-embedding-3-small
      }
    });

    test('should batch API calls efficiently', async () => {
      const batchTexts = Array.from({ length: 10 }, (_, i) => `Test text ${i} for batch processing`);
      
      const startTime = performance.now();
      
      // Test batch embedding
      const response = await createEmbedding(batchTexts);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      const tokensPerSecond = (response.usage?.total_tokens || 0) / (responseTime / 1000);

      expect(responseTime).toBeLessThan(5000); // Batch within 5 seconds
      expect(response.data).toHaveLength(10);
      expect(tokensPerSecond).toBeGreaterThan(1000); // At least 1000 tokens/second
      
      console.log(`Embedding Batch Performance: ${tokensPerSecond.toFixed(0)} tokens/second`);
    });
  });

  describe('End-to-End Performance', () => {
    test('should complete full advisor workflow within time limits', async () => {
      const storeData = {
        salesData: Array.from({ length: 365 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.random() * 2000 + 500,
          orders: Math.floor(Math.random() * 20) + 5
        })),
        productData: Array.from({ length: 100 }, (_, i) => ({
          id: `product-${i}`,
          title: `Product ${i}`,
          sales: Math.floor(Math.random() * 100),
          views: Math.floor(Math.random() * 1000) + 100,
          inventory: Math.floor(Math.random() * 50) + 5
        })),
        customerData: Array.from({ length: 50 }, (_, i) => ({
          segment: `segment-${i % 5}`,
          count: Math.floor(Math.random() * 100) + 10,
          avgOrderValue: Math.random() * 500 + 50,
          retention: Math.random() * 0.5 + 0.2
        }))
      };

      const startTime = performance.now();
      
      const recommendations = await recommendationEngine.generateRecommendations([], storeData);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(10000); // Complete workflow within 10 seconds
      expect(recommendations.length).toBeGreaterThan(0);
      
      console.log(`Full Advisor Workflow: ${totalTime.toFixed(2)}ms`);
    });

    test('should complete full chatbot interaction within time limits', async () => {
      const conversationFlow = [
        'Hello, I need help with my order',
        'I ordered a wireless headphone last week',
        'The order number is #12345',
        'When will it be delivered?',
        'Thank you for the information'
      ];

      const startTime = performance.now();
      let conversationHistory: any[] = [];
      
      for (const message of conversationFlow) {
        const response = await conversationHandler.handleMessage(message, {
          sessionId: 'e2e-test',
          customerId: 'test-customer'
        }, conversationHistory);
        
        conversationHistory.push(
          { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() },
          response
        );
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(15000); // Complete conversation within 15 seconds
      expect(conversationHistory.length).toBe(10); // 5 exchanges
      
      console.log(`Full Chatbot Conversation: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring and Alerts', () => {
    test('should track performance degradation', async () => {
      const baselineRuns = 5;
      const responseTimes: number[] = [];

      // Establish baseline
      for (let i = 0; i < baselineRuns; i++) {
        const startTime = performance.now();
        
        await conversationHandler.handleMessage('Performance test message', {
          sessionId: `baseline-${i}`,
          customerId: 'test-customer'
        });
        
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const standardDeviation = Math.sqrt(
        responseTimes.reduce((sq, time) => sq + Math.pow(time - averageResponseTime, 2), 0) / responseTimes.length
      );

      // Performance should be consistent (low standard deviation)
      const coefficientOfVariation = standardDeviation / averageResponseTime;
      expect(coefficientOfVariation).toBeLessThan(0.5); // CV should be less than 50%
      
      console.log(`Performance Consistency - CV: ${(coefficientOfVariation * 100).toFixed(2)}%`);
    });

    test('should identify performance bottlenecks', async () => {
      const performanceProfile = {
        aiAdvisor: 0,
        chatbot: 0,
        emailGeneration: 0,
        vectorSearch: 0
      };

      // Profile AI Advisor
      let startTime = performance.now();
      await recommendationEngine.generateRecommendations([], {
        salesData: Array.from({ length: 100 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.random() * 1000 + 500,
          orders: Math.floor(Math.random() * 10) + 5
        })),
        isTestMode: true
      });
      performanceProfile.aiAdvisor = performance.now() - startTime;

      // Profile Chatbot
      startTime = performance.now();
      await conversationHandler.handleMessage('Performance test', {
        sessionId: 'profile-test',
        customerId: 'test-customer'
      });
      performanceProfile.chatbot = performance.now() - startTime;

      // Profile Email Generation
      startTime = performance.now();
      await emailGenerator.generateWelcomeEmail({
        customer: {
          id: 'test',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });
      performanceProfile.emailGeneration = performance.now() - startTime;

      // Profile Vector Search
      startTime = performance.now();
      const vectorStore = await createVectorStore();
      await searchSimilarDocuments('test query', { k: 5 }, vectorStore);
      performanceProfile.vectorSearch = performance.now() - startTime;

      console.log('Performance Profile:', performanceProfile);

      // All components should perform within acceptable ranges
      expect(performanceProfile.aiAdvisor).toBeLessThan(5000);
      expect(performanceProfile.chatbot).toBeLessThan(3000);
      expect(performanceProfile.emailGeneration).toBeLessThan(2000);
      expect(performanceProfile.vectorSearch).toBeLessThan(1000);
    });
  });
});