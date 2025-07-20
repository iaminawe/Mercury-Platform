'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart, Star, TrendingUp, Sparkles, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { personalizationEngine } from '@/lib/personalization/engine';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
}

interface Recommendation extends Product {
  score: number;
  reason: string;
}

interface PersonalRecommendationsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  category?: string;
  showReason?: boolean;
  showScore?: boolean;
  layout?: 'grid' | 'carousel' | 'list';
  className?: string;
  onProductClick?: (product: Product) => void;
}

export function PersonalRecommendations({
  title = 'Recommended for You',
  subtitle = 'Based on your preferences and browsing history',
  limit = 12,
  category,
  showReason = true,
  showScore = false,
  layout = 'grid',
  className,
  onProductClick
}: PersonalRecommendationsProps) {
  const { data: session } = useSession();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const userId = session?.user?.id || `session_${Date.now()}`;
        
        const context = {
          userId,
          sessionId: session?.id || 'anonymous',
          device: {
            type: getDeviceType(),
            browser: navigator.userAgent,
            os: navigator.platform
          },
          currentPath: window.location.pathname,
          timestamp: new Date()
        };

        const result = await personalizationEngine.personalize(context);
        
        // Get personalized product recommendations
        const productIds = result.recommendations.products.slice(0, limit);
        
        // Fetch product details (mock implementation)
        const products = await fetchProductDetails(productIds);
        
        // Combine with personalization data
        const enrichedRecommendations = products.map((product, index) => ({
          ...product,
          score: result.scoring.purchaseIntent + (index * -0.05), // Decrease score by position
          reason: generateReason(product, result.segments, index)
        }));

        setRecommendations(enrichedRecommendations);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        // Load fallback recommendations
        const fallback = await loadFallbackRecommendations(limit);
        setRecommendations(fallback);
      } finally {
        setIsLoading(false);
      }
    }

    loadRecommendations();
  }, [session, limit, category]);

  const handleProductClick = (product: Product) => {
    // Track interaction
    personalizationEngine.trackConversion(
      session?.user?.id || 'anonymous',
      'product_click',
      product.price,
      { productId: product.id, source: 'recommendations' }
    );

    onProductClick?.(product);
  };

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Track conversion
    await personalizationEngine.trackConversion(
      session?.user?.id || 'anonymous',
      'add_to_cart',
      product.price,
      { productId: product.id, source: 'recommendations' }
    );

    // Add to cart logic here
    console.log('Add to cart:', product);
  };

  const handleToggleWishlist = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Track interaction
    await personalizationEngine.trackConversion(
      session?.user?.id || 'anonymous',
      'add_to_wishlist',
      0,
      { productId: product.id, source: 'recommendations' }
    );

    // Wishlist logic here
    console.log('Toggle wishlist:', product);
  };

  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className={cn(
          'grid gap-6',
          layout === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}>
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-64 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        </div>
        {subtitle && (
          <p className="text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Products */}
      <div className={cn(
        'grid gap-6',
        layout === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        layout === 'list' && 'grid-cols-1',
        layout === 'carousel' && 'flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4'
      )}>
        {recommendations.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              layout === 'carousel' && 'flex-none w-72 snap-start'
            )}
          >
            <Link href={`/products/${product.id}`} onClick={() => handleProductClick(product)}>
              <Card
                className="group overflow-hidden h-full hover:shadow-lg transition-all duration-300"
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Badge */}
                  {product.badge && (
                    <Badge
                      variant={product.badge.variant}
                      className="absolute top-2 left-2"
                    >
                      {product.badge.text}
                    </Badge>
                  )}

                  {/* Quick Actions */}
                  <div className={cn(
                    'absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity duration-300',
                    hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
                  )}>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full"
                      onClick={(e) => handleToggleWishlist(product, e)}
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full"
                      onClick={(e) => handleAddToCart(product, e)}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Score Indicator */}
                  {showScore && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="font-medium">{Math.round(product.score * 100)}% match</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Rating */}
                  {product.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'w-4 h-4',
                              i < Math.floor(product.rating!)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300'
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({product.reviewCount})
                      </span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl font-bold">{formatPrice(product.price)}</span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(product.compareAtPrice)}
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  {showReason && product.reason && (
                    <p className="text-xs text-muted-foreground italic">
                      {product.reason}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* View All Link */}
      {recommendations.length >= limit && (
        <div className="mt-8 text-center">
          <Link href="/recommendations">
            <Button variant="outline" size="lg">
              View All Recommendations
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function generateReason(product: Product, segments: string[], index: number): string {
  const reasons = [
    'Based on your browsing history',
    'Popular in your favorite categories',
    'Customers like you also bought',
    'Trending in your area',
    'Matches your style preferences',
    'Great value for your budget',
    'Highly rated by similar shoppers',
    'New arrival in your size'
  ];

  // Segment-specific reasons
  if (segments.includes('high-value')) {
    reasons.push('Exclusive item for VIP customers');
  }
  if (segments.includes('fashion-forward')) {
    reasons.push('Latest fashion trend');
  }
  if (segments.includes('price-sensitive')) {
    reasons.push('Best price we\'ve seen');
  }

  return reasons[index % reasons.length];
}

// Mock function to fetch product details
async function fetchProductDetails(productIds: string[]): Promise<Product[]> {
  // In production, this would fetch from your API
  return productIds.map((id, index) => ({
    id,
    name: `Product ${id}`,
    description: 'High-quality product tailored to your preferences',
    price: 99.99 - (index * 5),
    compareAtPrice: index % 3 === 0 ? 129.99 : undefined,
    image: `/images/products/product-${(index % 10) + 1}.jpg`,
    category: ['electronics', 'fashion', 'home', 'sports'][index % 4],
    rating: 4.5 - (index * 0.1),
    reviewCount: 120 - (index * 10),
    badge: index === 0 ? { text: 'Bestseller', variant: 'default' as const } : undefined
  }));
}

async function loadFallbackRecommendations(limit: number): Promise<Recommendation[]> {
  const products = await fetchProductDetails(
    Array.from({ length: limit }, (_, i) => `fallback_${i}`)
  );
  
  return products.map((product, index) => ({
    ...product,
    score: 0.7 - (index * 0.05),
    reason: 'Popular choice'
  }));
}