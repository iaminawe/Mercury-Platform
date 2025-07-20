'use client';

import { useState, useEffect, useCallback } from 'react';
import { client, ALL_PRODUCTS_QUERY } from '@/lib/shopify';
import ProductGrid from '@/components/storefront/product-grid';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const loadProducts = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const response = await client.request(ALL_PRODUCTS_QUERY, {
        variables: {
          first: 20,
          after: cursor,
        },
      });

      const newProducts = response.data?.products?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        description: edge.node.description,
        image: edge.node.images.edges[0]?.node
          ? {
              src: edge.node.images.edges[0].node.transformedSrc,
              altText: edge.node.images.edges[0].node.altText || edge.node.title,
            }
          : undefined,
        priceRange: edge.node.priceRange,
        variantId: edge.node.variants.edges[0]?.node.id,
        availableForSale: edge.node.variants.edges[0]?.node.availableForSale,
      })) || [];

      if (append) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      const pageInfo = response.data?.products?.pageInfo;
      setHasMore(pageInfo?.hasNextPage || false);
      setCursor(pageInfo?.endCursor || null);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    loadProducts();
  }, []);

  const handleLoadMore = useCallback(() => {
    if (cursor && hasMore && !loading) {
      loadProducts(true);
    }
  }, [cursor, hasMore, loading, loadProducts]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">All Products</h1>
          <p className="text-lg text-muted-foreground">
            Browse our complete collection
          </p>
        </div>

        {/* Filters (placeholder for future implementation) */}
        <div className="flex flex-wrap gap-4 mb-8">
          <select className="px-4 py-2 rounded-md border bg-background">
            <option>Sort by: Featured</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Newest First</option>
          </select>
        </div>

        {/* Products Grid */}
        <ProductGrid
          products={products}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}