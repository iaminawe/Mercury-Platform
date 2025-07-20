import { 
  createVectorStore, 
  addDocuments, 
  searchSimilarDocuments, 
  indexProductData, 
  indexCustomerData, 
  indexKnowledgeBase 
} from '@/lib/ai/vector-store';
import { CustomVectorStore } from '@/lib/ai/vector-store';
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';

describe('AI Vector Search Testing Suite', () => {
  let vectorStore: CustomVectorStore;
  let testStoreId: string;

  beforeEach(async () => {
    testStoreId = `test-store-${Date.now()}`;
    vectorStore = await createVectorStore({
      tableName: 'test_documents'
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await vectorStore.delete({ filter: { store_id: testStoreId } });
    } catch (error) {
      // Cleanup might fail in test environment
    }
  });

  describe('Vector Store Initialization', () => {
    test('should initialize vector store successfully', async () => {
      const store = await createVectorStore();
      expect(store).toBeDefined();
      expect(store).toBeInstanceOf(CustomVectorStore);
    });

    test('should handle initialization with custom config', async () => {
      const customConfig = {
        tableName: 'custom_test_documents'
      };

      const store = await createVectorStore(customConfig);
      expect(store).toBeDefined();
    });

    test('should fail gracefully with invalid config', async () => {
      const invalidConfig = {
        supabaseUrl: 'invalid-url',
        supabaseKey: 'invalid-key'
      };

      await expect(createVectorStore(invalidConfig)).rejects.toThrow();
    });
  });

  describe('Document Indexing', () => {
    test('should add documents to vector store', async () => {
      const testDocuments = [
        {
          content: 'This is a test product about wireless headphones with great sound quality.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'test-product-1',
            store_id: testStoreId,
            category: 'electronics',
            tags: ['audio', 'wireless']
          }
        },
        {
          content: 'Premium running shoes designed for marathon runners and daily training.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'test-product-2',
            store_id: testStoreId,
            category: 'sports',
            tags: ['shoes', 'running']
          }
        }
      ];

      const ids = await addDocuments(testDocuments, vectorStore);
      
      expect(ids).toHaveLength(2);
      expect(ids.every(id => typeof id === 'string')).toBe(true);
    });

    test('should index product data correctly', async () => {
      const mockProducts = [
        {
          id: '12345',
          title: 'Wireless Bluetooth Headphones',
          body_html: '<p>Premium quality headphones with noise cancellation</p>',
          product_type: 'Electronics',
          vendor: 'AudioTech',
          tags: ['audio', 'wireless', 'bluetooth'],
          variants: [
            { price: '199.99', sku: 'WH-001-BLK' },
            { price: '199.99', sku: 'WH-001-WHT' }
          ],
          handle: 'wireless-bluetooth-headphones',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '67890',
          title: 'Running Shoes Pro',
          description: 'Professional running shoes for athletes',
          product_type: 'Footwear',
          vendor: 'SportsPro',
          tags: 'running,shoes,sports',
          variants: [
            { price: '129.99', sku: 'RS-PRO-42' }
          ],
          handle: 'running-shoes-pro'
        }
      ];

      const ids = await indexProductData(mockProducts, testStoreId, vectorStore);
      
      expect(ids).toHaveLength(2);
      
      // Search for the indexed products
      const searchResults = await searchSimilarDocuments(
        'wireless headphones',
        { k: 5, filter: { store_id: testStoreId } },
        vectorStore
      );
      
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].metadata.type).toBe('product');
      expect(searchResults[0].metadata.id).toBe('12345');
    });

    test('should index customer data correctly', async () => {
      const mockCustomers = [
        {
          id: '11111',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
          default_address: {
            city: 'New York',
            province: 'NY',
            country: 'United States'
          },
          orders_count: 5,
          total_spent: '1250.00',
          tags: ['VIP', 'frequent-buyer'],
          state: 'enabled',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '22222',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
          default_address: {
            city: 'Los Angeles',
            province: 'CA',
            country: 'United States'
          },
          orders_count: 2,
          total_spent: '350.00',
          tags: 'new-customer',
          state: 'enabled'
        }
      ];

      const ids = await indexCustomerData(mockCustomers, testStoreId, vectorStore);
      
      expect(ids).toHaveLength(2);
      
      // Search for VIP customers
      const vipResults = await searchSimilarDocuments(
        'VIP frequent buyer high value customer',
        { k: 5, filter: { store_id: testStoreId, type: 'customer' } },
        vectorStore
      );
      
      expect(vipResults.length).toBeGreaterThan(0);
      expect(vipResults[0].metadata.type).toBe('customer');
    });

    test('should index knowledge base articles', async () => {
      const mockArticles = [
        {
          id: 'kb-001',
          title: 'How to pair Bluetooth headphones',
          content: 'To pair your Bluetooth headphones, first turn on Bluetooth on your device. Then put your headphones in pairing mode...',
          category: 'Product Support',
          tags: ['bluetooth', 'headphones', 'pairing', 'troubleshooting']
        },
        {
          id: 'kb-002',
          title: 'Return and Exchange Policy',
          content: 'Our return policy allows returns within 30 days of purchase. Items must be in original condition...',
          category: 'Policies',
          tags: ['returns', 'exchanges', 'policy']
        }
      ];

      const ids = await indexKnowledgeBase(mockArticles, testStoreId, vectorStore);
      
      expect(ids).toHaveLength(2);
      
      // Search knowledge base
      const supportResults = await searchSimilarDocuments(
        'bluetooth headphones not connecting',
        { k: 5, filter: { store_id: testStoreId, type: 'knowledge_base' } },
        vectorStore
      );
      
      expect(supportResults.length).toBeGreaterThan(0);
      expect(supportResults[0].metadata.type).toBe('knowledge_base');
      expect(supportResults[0].content).toContain('Bluetooth');
    });
  });

  describe('Search Accuracy Testing', () => {
    beforeEach(async () => {
      // Set up test data
      const testProducts = [
        {
          content: 'Premium wireless noise-cancelling headphones with 30-hour battery life. Perfect for music lovers and professionals.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'headphones-premium',
            store_id: testStoreId,
            category: 'electronics',
            tags: ['audio', 'wireless', 'premium']
          }
        },
        {
          content: 'Budget-friendly wired earphones with decent sound quality for everyday use.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'earphones-budget',
            store_id: testStoreId,
            category: 'electronics',
            tags: ['audio', 'wired', 'budget']
          }
        },
        {
          content: 'High-performance running shoes with advanced cushioning technology for marathon runners.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'shoes-running',
            store_id: testStoreId,
            category: 'sports',
            tags: ['shoes', 'running', 'performance']
          }
        },
        {
          content: 'Casual sneakers for everyday wear with comfortable design and stylish appearance.',
          metadata: {
            source: 'test_product',
            type: 'product' as const,
            id: 'shoes-casual',
            store_id: testStoreId,
            category: 'footwear',
            tags: ['shoes', 'casual', 'comfort']
          }
        }
      ];

      await addDocuments(testProducts, vectorStore);
    });

    test('should find exact matches with high similarity', async () => {
      const results = await searchSimilarDocuments(
        'wireless noise-cancelling headphones',
        { k: 3, filter: { store_id: testStoreId } },
        vectorStore
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.id).toBe('headphones-premium');
      expect(results[0].score).toBeGreaterThan(0.8); // High similarity score
    });

    test('should find semantically similar items', async () => {
      const results = await searchSimilarDocuments(
        'audio equipment for music',
        { k: 3, filter: { store_id: testStoreId } },
        vectorStore
      );

      expect(results.length).toBeGreaterThan(0);
      
      // Should return audio products
      const audioProducts = results.filter(r => 
        r.metadata.tags?.includes('audio') || 
        r.content.includes('headphones') || 
        r.content.includes('earphones')
      );
      
      expect(audioProducts.length).toBeGreaterThan(0);
    });

    test('should handle category-specific searches', async () => {
      const results = await searchSimilarDocuments(
        'running athletic footwear',
        { k: 3, filter: { store_id: testStoreId } },
        vectorStore
      );

      expect(results.length).toBeGreaterThan(0);
      
      // Should prioritize running shoes
      expect(results[0].metadata.id).toBe('shoes-running');
      expect(results[0].content).toContain('running');
    });

    test('should respect similarity thresholds', async () => {
      const results = await searchSimilarDocuments(
        'completely unrelated quantum physics',
        { 
          k: 10, 
          scoreThreshold: 0.7, 
          filter: { store_id: testStoreId } 
        },
        vectorStore
      );

      // Should return few or no results due to high threshold
      expect(results.length).toBeLessThanOrEqual(2);
      
      if (results.length > 0) {
        results.forEach(result => {
          expect(result.score).toBeGreaterThanOrEqual(0.7);
        });
      }
    });

    test('should handle multi-word semantic searches', async () => {
      const testCases = [
        {
          query: 'comfortable shoes for walking',
          expectedIds: ['shoes-casual', 'shoes-running']
        },
        {
          query: 'high quality audio devices',
          expectedIds: ['headphones-premium', 'earphones-budget']
        },
        {
          query: 'athletic gear for sports',
          expectedIds: ['shoes-running']
        }
      ];

      for (const testCase of testCases) {
        const results = await searchSimilarDocuments(
          testCase.query,
          { k: 5, filter: { store_id: testStoreId } },
          vectorStore
        );

        expect(results.length).toBeGreaterThan(0);
        
        const returnedIds = results.map(r => r.metadata.id);
        const hasExpectedMatch = testCase.expectedIds.some(expectedId =>
          returnedIds.includes(expectedId)
        );
        
        expect(hasExpectedMatch).toBe(true);
      }
    });
  });

  describe('Performance Testing', () => {
    test('should perform searches within acceptable time limits', async () => {
      // Index a larger dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        content: `Product ${i}: This is a test product with various features and specifications. Category includes electronics, sports, books, clothing, and home goods.`,
        metadata: {
          source: 'performance_test',
          type: 'product' as const,
          id: `product-${i}`,
          store_id: testStoreId,
          category: ['electronics', 'sports', 'books', 'clothing', 'home'][i % 5],
          tags: [`tag-${i}`, `category-${i % 5}`]
        }
      }));

      await addDocuments(largeDataset, vectorStore);

      // Measure search performance
      const startTime = performance.now();
      
      const results = await searchSimilarDocuments(
        'electronics with great features',
        { k: 10, filter: { store_id: testStoreId } },
        vectorStore
      );
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test('should handle concurrent searches efficiently', async () => {
      const concurrentQueries = [
        'wireless headphones',
        'running shoes',
        'electronics gadgets',
        'comfortable footwear',
        'audio equipment'
      ];

      const startTime = performance.now();

      const results = await Promise.all(
        concurrentQueries.map(query =>
          searchSimilarDocuments(
            query,
            { k: 5, filter: { store_id: testStoreId } },
            vectorStore
          )
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(5000); // All searches within 5 seconds
      
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    test('should scale with dataset size', async () => {
      const dataSizes = [10, 50, 100];
      const searchTimes: number[] = [];

      for (const size of dataSizes) {
        const dataset = Array.from({ length: size }, (_, i) => ({
          content: `Test product ${i} with unique features and specifications for testing scalability.`,
          metadata: {
            source: 'scalability_test',
            type: 'product' as const,
            id: `scale-product-${i}`,
            store_id: `${testStoreId}-${size}`,
            category: 'test'
          }
        }));

        await addDocuments(dataset, vectorStore);

        const startTime = performance.now();
        await searchSimilarDocuments(
          'test product with features',
          { k: 5, filter: { store_id: `${testStoreId}-${size}` } },
          vectorStore
        );
        const endTime = performance.now();

        searchTimes.push(endTime - startTime);
      }

      // Search time should not increase dramatically with dataset size
      const timeIncrease = searchTimes[2] / searchTimes[0];
      expect(timeIncrease).toBeLessThan(3); // Should not be more than 3x slower
    });
  });

  describe('Filter and Precision Testing', () => {
    beforeEach(async () => {
      const testData = [
        {
          content: 'Electronics: Smartphone with advanced camera',
          metadata: {
            source: 'test',
            type: 'product' as const,
            id: 'phone-1',
            store_id: testStoreId,
            category: 'electronics',
            tags: ['phone', 'camera'],
            price: 599
          }
        },
        {
          content: 'Electronics: Laptop computer for professionals',
          metadata: {
            source: 'test',
            type: 'product' as const,
            id: 'laptop-1',
            store_id: testStoreId,
            category: 'electronics',
            tags: ['computer', 'professional'],
            price: 1299
          }
        },
        {
          content: 'Clothing: Designer dress for special occasions',
          metadata: {
            source: 'test',
            type: 'product' as const,
            id: 'dress-1',
            store_id: testStoreId,
            category: 'clothing',
            tags: ['dress', 'designer'],
            price: 299
          }
        }
      ];

      await addDocuments(testData, vectorStore);
    });

    test('should filter by category correctly', async () => {
      const electronicsResults = await searchSimilarDocuments(
        'professional device',
        { 
          k: 10, 
          filter: { 
            store_id: testStoreId, 
            category: 'electronics' 
          } 
        },
        vectorStore
      );

      expect(electronicsResults.length).toBeGreaterThan(0);
      electronicsResults.forEach(result => {
        expect(result.metadata.category).toBe('electronics');
      });
    });

    test('should filter by product type', async () => {
      const productResults = await searchSimilarDocuments(
        'high quality item',
        { 
          k: 10, 
          filter: { 
            store_id: testStoreId, 
            type: 'product' 
          } 
        },
        vectorStore
      );

      expect(productResults.length).toBeGreaterThan(0);
      productResults.forEach(result => {
        expect(result.metadata.type).toBe('product');
      });
    });

    test('should combine multiple filters', async () => {
      const filteredResults = await searchSimilarDocuments(
        'technology item',
        { 
          k: 10, 
          filter: { 
            store_id: testStoreId, 
            type: 'product',
            category: 'electronics'
          } 
        },
        vectorStore
      );

      expect(filteredResults.length).toBeGreaterThan(0);
      filteredResults.forEach(result => {
        expect(result.metadata.type).toBe('product');
        expect(result.metadata.category).toBe('electronics');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty search queries', async () => {
      const results = await searchSimilarDocuments(
        '',
        { k: 5, filter: { store_id: testStoreId } },
        vectorStore
      );

      // Should return empty results or handle gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle malformed filters', async () => {
      await expect(
        searchSimilarDocuments(
          'test query',
          { 
            k: 5, 
            filter: { 
              store_id: testStoreId,
              invalid_field: null 
            } 
          },
          vectorStore
        )
      ).resolves.toBeDefined();
    });

    test('should handle non-existent store filters', async () => {
      const results = await searchSimilarDocuments(
        'test query',
        { k: 5, filter: { store_id: 'non-existent-store' } },
        vectorStore
      );

      expect(results).toHaveLength(0);
    });

    test('should handle special characters in queries', async () => {
      const specialQueries = [
        'query with @#$%^&*() special chars',
        'query with "quotes" and \'apostrophes\'',
        'query with émojis 🎧 and ñôñ-ÅSCÎÎ characters',
        'query\nwith\nline\nbreaks',
        'query\twith\ttabs'
      ];

      for (const query of specialQueries) {
        await expect(
          searchSimilarDocuments(
            query,
            { k: 5, filter: { store_id: testStoreId } },
            vectorStore
          )
        ).resolves.toBeDefined();
      }
    });

    test('should handle very long search queries', async () => {
      const longQuery = 'long query '.repeat(1000);
      
      await expect(
        searchSimilarDocuments(
          longQuery,
          { k: 5, filter: { store_id: testStoreId } },
          vectorStore
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Data Consistency and Integrity', () => {
    test('should maintain search consistency across multiple requests', async () => {
      const query = 'wireless headphones premium';
      const searchOptions = { k: 5, filter: { store_id: testStoreId } };

      const results1 = await searchSimilarDocuments(query, searchOptions, vectorStore);
      const results2 = await searchSimilarDocuments(query, searchOptions, vectorStore);

      // Results should be identical for same query
      expect(results1.length).toBe(results2.length);
      
      if (results1.length > 0) {
        expect(results1[0].metadata.id).toBe(results2[0].metadata.id);
        expect(results1[0].score).toBeCloseTo(results2[0].score, 5);
      }
    });

    test('should handle document updates correctly', async () => {
      const originalDoc = {
        content: 'Original product description',
        metadata: {
          source: 'test',
          type: 'product' as const,
          id: 'update-test',
          store_id: testStoreId,
          category: 'test'
        }
      };

      // Add original document
      await addDocuments([originalDoc], vectorStore);

      // Search for original content
      const originalResults = await searchSimilarDocuments(
        'original product',
        { k: 5, filter: { store_id: testStoreId } },
        vectorStore
      );

      expect(originalResults.length).toBeGreaterThan(0);
      expect(originalResults[0].content).toContain('Original');

      // Delete and re-add with updated content
      await vectorStore.delete({ filter: { id: 'update-test' } });

      const updatedDoc = {
        ...originalDoc,
        content: 'Updated product description with new features'
      };

      await addDocuments([updatedDoc], vectorStore);

      // Search should now return updated content
      const updatedResults = await searchSimilarDocuments(
        'updated product features',
        { k: 5, filter: { store_id: testStoreId } },
        vectorStore
      );

      expect(updatedResults.length).toBeGreaterThan(0);
      expect(updatedResults[0].content).toContain('Updated');
    });
  });
});