'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProductCard from './product-card';

interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: {
    src: string;
    altText: string;
  };
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variantId?: string;
  availableForSale?: boolean;
}

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function ProductGrid({ 
  products, 
  loading = false, 
  hasMore = false, 
  onLoadMore 
}: ProductGridProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        rootMargin: '100px',
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load more when intersecting
  useEffect(() => {
    if (isIntersecting && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, loading, onLoadMore]);

  if (products.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No products found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        
        {/* Loading skeleton */}
        {loading && 
          Array.from({ length: 8 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))
        }
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="text-center py-8">
          {loading && (
            <div className="inline-flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading more products...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}