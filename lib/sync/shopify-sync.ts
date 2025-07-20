import { getShopifyClient, getShopifyGraphQLClient } from '@/lib/shopify/client';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { Database } from '@/lib/database.types';
import { SyncJobData } from './sync-queue';

const logger = createLogger('shopify-sync');

type Product = Database['public']['Tables']['products']['Insert'];

// GraphQL queries for efficient bulk fetching
const PRODUCTS_QUERY = `
  query getProducts($cursor: String, $limit: Int!) {
    products(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          tags
          status
          createdAt
          updatedAt
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                inventoryQuantity
                weight
                weightUnit
                position
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          seo {
            title
            description
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query getCollections($cursor: String, $limit: Int!) {
    collections(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          description
          productsCount
          image {
            url
            altText
          }
          seo {
            title
            description
          }
          createdAt
          updatedAt
        }
      }
    }
  }
`;

const CUSTOMERS_QUERY = `
  query getCustomers($cursor: String, $limit: Int!) {
    customers(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          email
          firstName
          lastName
          phone
          acceptsMarketing
          totalSpentAmount {
            amount
            currencyCode
          }
          ordersCount
          createdAt
          updatedAt
          addresses {
            address1
            address2
            city
            province
            country
            zip
          }
        }
      }
    }
  }
`;

export class ShopifySync {
  private shopDomain: string;
  private accessToken: string;
  private storeId: string;
  private supabase;

  constructor(storeId: string, shopDomain: string, accessToken: string) {
    this.storeId = storeId;
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.supabase = createClient();
  }

  // Sync single product
  async syncProduct(productId: string) {
    try {
      const client = getShopifyClient(this.shopDomain, this.accessToken);
      const response = await client.get({
        path: `products/${productId}`,
      });

      const product = response.body.product;
      await this.upsertProduct(product);

      logger.info('Product synced', { productId, storeId: this.storeId });
      return { success: true, productId };
    } catch (error) {
      logger.error('Failed to sync product', { productId, storeId: this.storeId, error });
      throw error;
    }
  }

  // Sync products with pagination
  async syncProducts(cursor?: string, limit: number = 50): Promise<{
    synced: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    try {
      const client = getShopifyGraphQLClient(this.shopDomain, this.accessToken);
      
      const response = await client.query({
        data: {
          query: PRODUCTS_QUERY,
          variables: { cursor, limit },
        },
      });

      const products = response.body.data.products;
      let synced = 0;

      // Process products in parallel batches
      const batchSize = 10;
      for (let i = 0; i < products.edges.length; i += batchSize) {
        const batch = products.edges.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async ({ node }: any) => {
            await this.upsertProduct(this.transformGraphQLProduct(node));
            synced++;
          })
        );
      }

      logger.info('Products batch synced', { 
        synced, 
        storeId: this.storeId,
        hasMore: products.pageInfo.hasNextPage 
      });

      return {
        synced,
        hasMore: products.pageInfo.hasNextPage,
        nextCursor: products.pageInfo.endCursor,
      };
    } catch (error) {
      logger.error('Failed to sync products batch', { storeId: this.storeId, error });
      throw error;
    }
  }

  // Sync collections
  async syncCollections(cursor?: string, limit: number = 50): Promise<{
    synced: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    try {
      const client = getShopifyGraphQLClient(this.shopDomain, this.accessToken);
      
      const response = await client.query({
        data: {
          query: COLLECTIONS_QUERY,
          variables: { cursor, limit },
        },
      });

      const collections = response.body.data.collections;
      let synced = 0;

      // Store collections in the database
      for (const { node } of collections.edges) {
        const { error } = await this.supabase
          .from('collections')
          .upsert({
            store_id: this.storeId,
            shopify_collection_id: node.id.split('/').pop(),
            title: node.title,
            handle: node.handle,
            description: node.description,
            products_count: node.productsCount,
            data: node,
            synced_at: new Date().toISOString(),
          })
          .eq('shopify_collection_id', node.id.split('/').pop())
          .eq('store_id', this.storeId);

        if (error) {
          logger.error('Failed to upsert collection', { error, collectionId: node.id });
        } else {
          synced++;
        }
      }

      logger.info('Collections batch synced', { 
        synced, 
        storeId: this.storeId,
        hasMore: collections.pageInfo.hasNextPage 
      });

      return {
        synced,
        hasMore: collections.pageInfo.hasNextPage,
        nextCursor: collections.pageInfo.endCursor,
      };
    } catch (error) {
      logger.error('Failed to sync collections batch', { storeId: this.storeId, error });
      throw error;
    }
  }

  // Sync customers
  async syncCustomers(cursor?: string, limit: number = 50): Promise<{
    synced: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    try {
      const client = getShopifyGraphQLClient(this.shopDomain, this.accessToken);
      
      const response = await client.query({
        data: {
          query: CUSTOMERS_QUERY,
          variables: { cursor, limit },
        },
      });

      const customers = response.body.data.customers;
      let synced = 0;

      // Store customers in the database
      for (const { node } of customers.edges) {
        const { error } = await this.supabase
          .from('customers')
          .upsert({
            store_id: this.storeId,
            shopify_customer_id: node.id.split('/').pop(),
            email: node.email,
            first_name: node.firstName,
            last_name: node.lastName,
            phone: node.phone,
            accepts_marketing: node.acceptsMarketing,
            total_spent: parseFloat(node.totalSpentAmount?.amount || '0'),
            orders_count: node.ordersCount,
            data: node,
            synced_at: new Date().toISOString(),
          })
          .eq('shopify_customer_id', node.id.split('/').pop())
          .eq('store_id', this.storeId);

        if (error) {
          logger.error('Failed to upsert customer', { error, customerId: node.id });
        } else {
          synced++;
        }
      }

      logger.info('Customers batch synced', { 
        synced, 
        storeId: this.storeId,
        hasMore: customers.pageInfo.hasNextPage 
      });

      return {
        synced,
        hasMore: customers.pageInfo.hasNextPage,
        nextCursor: customers.pageInfo.endCursor,
      };
    } catch (error) {
      logger.error('Failed to sync customers batch', { storeId: this.storeId, error });
      throw error;
    }
  }

  // Sync orders (REST API for now, as GraphQL requires different scopes)
  async syncOrders(page: number = 1, limit: number = 250): Promise<{
    synced: number;
    hasMore: boolean;
    nextPage: number;
  }> {
    try {
      const client = getShopifyClient(this.shopDomain, this.accessToken);
      
      const response = await client.get({
        path: 'orders',
        query: {
          limit: limit.toString(),
          page: page.toString(),
          status: 'any',
        },
      });

      const orders = response.body.orders || [];
      let synced = 0;

      // Store orders in the database
      for (const order of orders) {
        const { error } = await this.supabase
          .from('orders')
          .upsert({
            store_id: this.storeId,
            shopify_order_id: order.id.toString(),
            order_number: order.order_number,
            email: order.email,
            financial_status: order.financial_status,
            fulfillment_status: order.fulfillment_status || 'unfulfilled',
            total_price: parseFloat(order.total_price),
            subtotal_price: parseFloat(order.subtotal_price),
            total_tax: parseFloat(order.total_tax || '0'),
            currency: order.currency,
            customer_id: order.customer?.id?.toString(),
            line_items_count: order.line_items?.length || 0,
            data: order,
            synced_at: new Date().toISOString(),
          })
          .eq('shopify_order_id', order.id.toString())
          .eq('store_id', this.storeId);

        if (error) {
          logger.error('Failed to upsert order', { error, orderId: order.id });
        } else {
          synced++;
        }
      }

      logger.info('Orders batch synced', { 
        synced, 
        storeId: this.storeId,
        page,
        hasMore: orders.length === limit 
      });

      return {
        synced,
        hasMore: orders.length === limit,
        nextPage: page + 1,
      };
    } catch (error) {
      logger.error('Failed to sync orders batch', { storeId: this.storeId, error });
      throw error;
    }
  }

  // Delete product
  async deleteProduct(productId: string) {
    try {
      const { error } = await this.supabase
        .from('products')
        .delete()
        .eq('shopify_product_id', productId)
        .eq('store_id', this.storeId);

      if (error) throw error;

      logger.info('Product deleted', { productId, storeId: this.storeId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete product', { productId, storeId: this.storeId, error });
      throw error;
    }
  }

  // Helper to transform GraphQL product to REST format
  private transformGraphQLProduct(graphqlProduct: any): any {
    const productId = graphqlProduct.id.split('/').pop();
    return {
      id: productId,
      title: graphqlProduct.title,
      handle: graphqlProduct.handle,
      product_type: graphqlProduct.productType,
      vendor: graphqlProduct.vendor,
      tags: graphqlProduct.tags.join(', '),
      status: graphqlProduct.status.toLowerCase(),
      created_at: graphqlProduct.createdAt,
      updated_at: graphqlProduct.updatedAt,
      variants: graphqlProduct.variants.edges.map(({ node }: any) => ({
        id: node.id.split('/').pop(),
        title: node.title,
        price: node.price,
        compare_at_price: node.compareAtPrice,
        sku: node.sku,
        inventory_quantity: node.inventoryQuantity,
        weight: node.weight,
        weight_unit: node.weightUnit,
        position: node.position,
      })),
      images: graphqlProduct.images.edges.map(({ node }: any) => ({
        id: node.id.split('/').pop(),
        src: node.url,
        alt: node.altText,
        width: node.width,
        height: node.height,
      })),
      seo: graphqlProduct.seo,
    };
  }

  // Helper to upsert product
  private async upsertProduct(product: any) {
    const productData: Product = {
      store_id: this.storeId,
      shopify_product_id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      product_type: product.product_type || '',
      vendor: product.vendor || '',
      tags: product.tags ? product.tags.split(',').map((t: string) => t.trim()) : [],
      status: product.status || 'active',
      data: product,
      synced_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('products')
      .upsert(productData)
      .eq('shopify_product_id', product.id.toString())
      .eq('store_id', this.storeId);

    if (error) {
      throw error;
    }

    // Also store variants if present
    if (product.variants && product.variants.length > 0) {
      const variants = product.variants.map((variant: any) => ({
        store_id: this.storeId,
        product_id: product.id.toString(),
        shopify_variant_id: variant.id.toString(),
        title: variant.title,
        price: parseFloat(variant.price),
        compare_at_price: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
        sku: variant.sku,
        inventory_quantity: variant.inventory_quantity || 0,
        position: variant.position,
        data: variant,
        synced_at: new Date().toISOString(),
      }));

      const { error: variantError } = await this.supabase
        .from('product_variants')
        .upsert(variants)
        .eq('store_id', this.storeId);

      if (variantError) {
        logger.error('Failed to upsert variants', { error: variantError, productId: product.id });
      }
    }
  }

  // Get sync progress
  async getSyncProgress(resourceType: string): Promise<{
    total: number;
    synced: number;
    lastSyncedAt?: string;
  }> {
    try {
      let table = '';
      let shopifyField = '';

      switch (resourceType) {
        case 'products':
          table = 'products';
          shopifyField = 'shopify_product_id';
          break;
        case 'collections':
          table = 'collections';
          shopifyField = 'shopify_collection_id';
          break;
        case 'customers':
          table = 'customers';
          shopifyField = 'shopify_customer_id';
          break;
        case 'orders':
          table = 'orders';
          shopifyField = 'shopify_order_id';
          break;
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }

      // Get count from database
      const { count, error } = await this.supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('store_id', this.storeId);

      if (error) throw error;

      // Get last synced timestamp
      const { data: lastSynced } = await this.supabase
        .from(table)
        .select('synced_at')
        .eq('store_id', this.storeId)
        .order('synced_at', { ascending: false })
        .limit(1);

      // For total count, we'd need to query Shopify API
      // For now, return synced count as both
      return {
        total: count || 0,
        synced: count || 0,
        lastSyncedAt: lastSynced?.[0]?.synced_at,
      };
    } catch (error) {
      logger.error('Failed to get sync progress', { resourceType, storeId: this.storeId, error });
      throw error;
    }
  }
}