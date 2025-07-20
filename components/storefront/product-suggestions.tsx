'use client';

import React from 'react';
import { ExternalLink, ShoppingCart, Heart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  handle: string;
  confidence?: number;
  reason?: string;
  category?: string;
  tags?: string[];
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    available: boolean;
  }>;
  rating?: number;
  reviewCount?: number;
  salePrice?: number;
}

interface ProductSuggestionsProps {
  products: Product[];
  onProductClick: (productId: string) => void;
  theme?: 'light' | 'dark';
  maxItems?: number;
  showReason?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export function ProductSuggestions({
  products,
  onProductClick,
  theme = 'light',
  maxItems = 3,
  showReason = true,
  layout = 'horizontal'
}: ProductSuggestionsProps) {
  const displayProducts = products.slice(0, maxItems);

  if (displayProducts.length === 0) {
    return null;
  }

  const formatPrice = (price: number, salePrice?: number) => {
    if (salePrice && salePrice < price) {
      return (
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-red-600">${salePrice.toFixed(2)}</span>
          <span className="text-sm line-through text-gray-500">${price.toFixed(2)}</span>
          <Badge variant="destructive" className="text-xs px-1">
            {Math.round((1 - salePrice / price) * 100)}% off
          </Badge>
        </div>
      );
    }
    return <span className="font-semibold">${price.toFixed(2)}</span>;
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" size={12} className="fill-yellow-400/50 text-yellow-400" />);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} size={12} className="text-gray-300" />);
    }

    return stars;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-medium ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
        }`}>
          Recommended Products
        </h4>
        <Badge variant="secondary" className="text-xs">
          {displayProducts.length} items
        </Badge>
      </div>

      <div className={`grid gap-3 ${
        layout === 'horizontal' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {displayProducts.map((product) => (
          <Card
            key={product.id}
            className={`overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                : 'bg-white border-gray-200 hover:shadow-lg'
            }`}
            onClick={() => onProductClick(product.handle || product.id)}
          >
            <div className="relative">
              {/* Product Image */}
              <div className="aspect-square relative overflow-hidden bg-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <ShoppingCart size={24} className="text-gray-400" />
                  </div>
                )}
                
                {/* Sale badge */}
                {product.salePrice && product.salePrice < product.price && (
                  <Badge 
                    variant="destructive" 
                    className="absolute top-2 left-2 text-xs"
                  >
                    Sale
                  </Badge>
                )}

                {/* Confidence score (for debugging) */}
                {product.confidence && process.env.NODE_ENV === 'development' && (
                  <Badge 
                    variant="outline" 
                    className="absolute top-2 right-2 text-xs bg-black/50 text-white border-white/20"
                  >
                    {Math.round(product.confidence * 100)}%
                  </Badge>
                )}

                {/* Quick action buttons */}
                <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Add to wishlist functionality
                    }}
                  >
                    <Heart size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick(product.handle || product.id);
                    }}
                  >
                    <ExternalLink size={14} />
                  </Button>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <div className="mb-2">
                  <h5 className={`font-medium text-sm line-clamp-2 leading-tight ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {product.title}
                  </h5>
                  
                  {product.category && (
                    <p className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {product.category}
                    </p>
                  )}
                </div>

                {/* Rating */}
                {product.rating && (
                  <div className="flex items-center space-x-1 mb-2">
                    <div className="flex items-center">
                      {renderStars(product.rating)}
                    </div>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      ({product.reviewCount || 0})
                    </span>
                  </div>
                )}

                {/* Price */}
                <div className="mb-2">
                  {formatPrice(product.price, product.salePrice)}
                </div>

                {/* Variants */}
                {product.variants && product.variants.length > 0 && (
                  <div className="mb-2">
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {product.variants.length} variant{product.variants.length > 1 ? 's' : ''} available
                    </p>
                  </div>
                )}

                {/* Recommendation reason */}
                {showReason && product.reason && (
                  <div className={`text-xs p-2 rounded ${
                    theme === 'dark' 
                      ? 'bg-blue-900/30 text-blue-200 border border-blue-800' 
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    💡 {product.reason}
                  </div>
                )}

                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {product.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs px-1 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {product.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        +{product.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex space-x-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick(product.handle || product.id);
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Add to cart functionality
                    }}
                  >
                    Add to Cart
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* View all products link */}
      {products.length > maxItems && (
        <div className="mt-3 text-center">
          <Button
            variant="link"
            size="sm"
            className={`text-xs ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}
            onClick={() => {
              // Navigate to full product search results
              window.open('/products', '_blank');
            }}
          >
            View all {products.length} recommendations →
          </Button>
        </div>
      )}
    </div>
  );
}