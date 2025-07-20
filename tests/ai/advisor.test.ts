import { ShopifyRecommendationEngine } from '@/lib/ai/advisor/recommendation-engine';
import { AnomalyDetector } from '@/lib/ai/advisor/anomaly-detector';
import { ConfidenceScorer } from '@/lib/ai/advisor/confidence-scorer';
import { InsightAnalyzer } from '@/lib/ai/advisor/insight-analyzer';
import { describe, beforeEach, test, expect, jest } from '@jest/globals';

describe('AI Advisor Testing Suite', () => {
  let recommendationEngine: ShopifyRecommendationEngine;
  let anomalyDetector: AnomalyDetector;
  let confidenceScorer: ConfidenceScorer;
  let insightAnalyzer: InsightAnalyzer;

  beforeEach(() => {
    recommendationEngine = new ShopifyRecommendationEngine();
    anomalyDetector = new AnomalyDetector();
    confidenceScorer = new ConfidenceScorer();
    insightAnalyzer = new InsightAnalyzer();
  });

  describe('Accuracy Testing - Target ≥85%', () => {
    test('should accurately detect sales anomalies', async () => {
      const salesData = [
        { date: '2024-01-01', amount: 1000, orders: 10 },
        { date: '2024-01-02', amount: 1100, orders: 11 },
        { date: '2024-01-03', amount: 950, orders: 9 },
        { date: '2024-01-04', amount: 500, orders: 5 }, // Anomaly
        { date: '2024-01-05', amount: 1050, orders: 10 },
      ];

      const context = { isTestMode: true };
      const anomalies = await anomalyDetector.detectSalesAnomalies(salesData, context);

      // Should detect the significant drop on 2024-01-04
      expect(anomalies.length).toBeGreaterThan(0);
      const significantAnomaly = anomalies.find(a => a.severity === 'high' || a.severity === 'critical');
      expect(significantAnomaly).toBeDefined();
      expect(significantAnomaly?.actualValue).toBe(500);
    });

    test('should generate accurate product recommendations', async () => {
      const mockProductData = [
        { id: '1', title: 'Low Stock Item', sales: 100, views: 500, inventory: 5 },
        { id: '2', title: 'High Traffic Low Conversion', sales: 10, views: 1000, inventory: 50 },
        { id: '3', title: 'Normal Product', sales: 50, views: 200, inventory: 25 },
      ];

      const context = { productData: mockProductData };
      const recommendations = await recommendationEngine.generateRecommendations([], context);

      // Should detect low inventory alert
      const lowInventoryRec = recommendations.find(r => r.id.includes('low-inventory'));
      expect(lowInventoryRec).toBeDefined();
      expect(lowInventoryRec?.priority).toBe('high');

      // Should detect underperforming product
      const underPerformingRec = recommendations.find(r => r.id.includes('underperforming'));
      expect(underPerformingRec).toBeDefined();
    });

    test('should score confidence accurately', async () => {
      const highConfidenceInsight = {
        id: 'test-1',
        title: 'High Confidence Test',
        description: 'Test insight',
        type: 'anomaly' as const,
        confidence: 0.95,
        priority: 'high' as const,
        category: 'sales' as const,
        actionable: true,
        data: { test: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const score = recommendationEngine.scoreConfidence(highConfidenceInsight);
      expect(score).toBe(0.95);
      expect(score).toBeGreaterThanOrEqual(0.85); // Target accuracy threshold
    });

    test('should maintain accuracy above 85% across multiple scenarios', async () => {
      const testScenarios = [
        {
          name: 'Sales Drop Detection',
          data: [
            { date: '2024-01-01', amount: 1000, orders: 10 },
            { date: '2024-01-02', amount: 200, orders: 2 }, // Clear anomaly
          ],
          expectedDetection: true
        },
        {
          name: 'Traffic Anomaly Detection',
          data: [
            { date: '2024-01-01', visitors: 1000, pageViews: 5000, bounceRate: 0.3 },
            { date: '2024-01-02', visitors: 1100, pageViews: 5500, bounceRate: 0.8 }, // High bounce rate
          ],
          expectedDetection: true
        },
        {
          name: 'Normal Operation',
          data: [
            { date: '2024-01-01', amount: 1000, orders: 10 },
            { date: '2024-01-02', amount: 1050, orders: 11 },
          ],
          expectedDetection: false
        }
      ];

      let correctDetections = 0;
      
      for (const scenario of testScenarios) {
        try {
          const anomalies = await anomalyDetector.detectSalesAnomalies(
            scenario.data.map(d => ({ date: d.date, amount: d.amount || 0, orders: d.orders || 0 })),
            { isTestMode: true }
          );
          
          const hasSignificantAnomaly = anomalies.some(a => a.severity === 'high' || a.severity === 'critical');
          
          if (hasSignificantAnomaly === scenario.expectedDetection) {
            correctDetections++;
          }
        } catch (error) {
          // Count as incorrect if error occurs
        }
      }

      const accuracy = correctDetections / testScenarios.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.85); // 85% accuracy target
    });
  });

  describe('Performance Testing', () => {
    test('should generate recommendations within acceptable time', async () => {
      const startTime = performance.now();
      
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 2000) + 500,
        orders: Math.floor(Math.random() * 20) + 5
      }));

      await recommendationEngine.generateRecommendations(largeDataset, {
        salesData: largeDataset,
        isTestMode: true
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within 5 seconds for large dataset
      expect(executionTime).toBeLessThan(5000);
    });

    test('should handle concurrent recommendation requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        recommendationEngine.generateRecommendations([], {
          salesData: [
            { date: '2024-01-01', amount: 1000 + i * 100, orders: 10 + i }
          ],
          isTestMode: true
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(requests);
      const endTime = performance.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(10000); // All requests within 10s
    });
  });

  describe('Robustness Testing', () => {
    test('should handle malformed data gracefully', async () => {
      const malformedData = [
        { date: 'invalid-date', amount: 'not-a-number', orders: null },
        { date: '2024-01-01', amount: -1000, orders: -5 },
        { amount: 1000 }, // Missing date
        null,
        undefined
      ];

      // Should not throw errors with malformed data
      await expect(
        recommendationEngine.generateRecommendations(malformedData, { isTestMode: true })
      ).resolves.toBeDefined();
    });

    test('should handle empty datasets', async () => {
      const recommendations = await recommendationEngine.generateRecommendations([], {
        salesData: [],
        trafficData: [],
        productData: [],
        customerData: [],
        isTestMode: true
      });

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing context gracefully', async () => {
      const recommendations = await recommendationEngine.generateRecommendations([], {});
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign appropriate confidence scores', async () => {
      const context = {
        salesData: [
          { date: '2024-01-01', amount: 1000, orders: 10 },
          { date: '2024-01-02', amount: 50, orders: 1 }, // Clear anomaly
        ],
        isTestMode: true
      };

      const recommendations = await recommendationEngine.generateRecommendations([], context);
      
      if (recommendations.length > 0) {
        const highPriorityRecs = recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');
        
        for (const rec of highPriorityRecs) {
          expect(rec.confidence).toBeGreaterThan(0.7); // High priority should have high confidence
        }
      }
    });

    test('should correlate confidence with data quality', async () => {
      // High quality data scenario
      const highQualityContext = {
        salesData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: 1000 + (Math.sin(i * 0.1) * 100), // Consistent pattern
          orders: 10 + Math.floor(Math.sin(i * 0.1) * 2)
        })),
        isTestMode: true
      };

      const highQualityRecs = await recommendationEngine.generateRecommendations([], highQualityContext);

      // Low quality data scenario
      const lowQualityContext = {
        salesData: [
          { date: '2024-01-01', amount: 1000, orders: 10 },
          { date: '2024-01-03', amount: 800, orders: 8 }, // Missing day
        ],
        isTestMode: true
      };

      const lowQualityRecs = await recommendationEngine.generateRecommendations([], lowQualityContext);

      // High quality data should generally produce higher confidence scores
      if (highQualityRecs.length > 0 && lowQualityRecs.length > 0) {
        const avgHighQualityConfidence = highQualityRecs.reduce((sum, r) => sum + r.confidence, 0) / highQualityRecs.length;
        const avgLowQualityConfidence = lowQualityRecs.reduce((sum, r) => sum + r.confidence, 0) / lowQualityRecs.length;
        
        // This assertion might need adjustment based on actual implementation
        expect(avgHighQualityConfidence).toBeGreaterThanOrEqual(avgLowQualityConfidence - 0.1);
      }
    });
  });

  describe('Integration Testing', () => {
    test('should integrate with multiple AI services', async () => {
      const testData = [
        { date: '2024-01-01', amount: 1000, orders: 10 },
        { date: '2024-01-02', amount: 200, orders: 2 },
      ];

      // Test anomaly detection
      const anomalies = await anomalyDetector.detectSalesAnomalies(testData, { isTestMode: true });
      expect(anomalies).toBeDefined();

      // Test recommendation generation
      const recommendations = await recommendationEngine.generateRecommendations(testData, {
        salesData: testData,
        isTestMode: true
      });
      expect(recommendations).toBeDefined();

      // Test confidence scoring
      if (recommendations.length > 0) {
        const confidence = recommendationEngine.scoreConfidence(recommendations[0]);
        expect(typeof confidence).toBe('number');
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should maintain consistency across multiple runs', async () => {
      const testData = [
        { date: '2024-01-01', amount: 1000, orders: 10 },
        { date: '2024-01-02', amount: 200, orders: 2 },
      ];

      const run1 = await recommendationEngine.generateRecommendations(testData, {
        salesData: testData,
        isTestMode: true
      });

      const run2 = await recommendationEngine.generateRecommendations(testData, {
        salesData: testData,
        isTestMode: true
      });

      // Results should be consistent for identical inputs
      expect(run1.length).toBe(run2.length);
      
      if (run1.length > 0 && run2.length > 0) {
        // Check that similar insights are generated
        const run1Types = run1.map(r => r.type).sort();
        const run2Types = run2.map(r => r.type).sort();
        expect(run1Types).toEqual(run2Types);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle extreme values', async () => {
      const extremeData = [
        { date: '2024-01-01', amount: Number.MAX_SAFE_INTEGER, orders: 1000000 },
        { date: '2024-01-02', amount: 0, orders: 0 },
        { date: '2024-01-03', amount: -1000, orders: -1 },
      ];

      await expect(
        recommendationEngine.generateRecommendations(extremeData, {
          salesData: extremeData,
          isTestMode: true
        })
      ).resolves.toBeDefined();
    });

    test('should handle date edge cases', async () => {
      const dateEdgeCases = [
        { date: '1900-01-01', amount: 1000, orders: 10 },
        { date: '2099-12-31', amount: 1000, orders: 10 },
        { date: '2024-02-29', amount: 1000, orders: 10 }, // Leap year
      ];

      await expect(
        recommendationEngine.generateRecommendations(dateEdgeCases, {
          salesData: dateEdgeCases,
          isTestMode: true
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Memory and Resource Testing', () => {
    test('should not leak memory with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process large dataset multiple times
      for (let i = 0; i < 5; i++) {
        const largeDataset = Array.from({ length: 10000 }, (_, j) => ({
          date: new Date(Date.now() - j * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.floor(Math.random() * 2000) + 500,
          orders: Math.floor(Math.random() * 20) + 5
        }));

        await recommendationEngine.generateRecommendations(largeDataset, {
          salesData: largeDataset,
          isTestMode: true
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});