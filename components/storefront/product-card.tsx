'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { formatPrice } from '@/lib/shopify';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: {
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
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, loading } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!product.variantId || isAdding) return;

    setIsAdding(true);
    try {
      await addToCart(product.variantId);
    } finally {
      setIsAdding(false);
    }
  };

  const isUnavailable = product.availableForSale === false;

  return (
    <Link href={`/products/${product.handle}`} className="group">
      <div className="relative overflow-hidden rounded-lg bg-muted aspect-square">
        {product.image ? (
          <>
            <Image
              src={product.image.src}
              alt={product.image.altText || product.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className={`object-cover group-hover:scale-105 transition-transform duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoading(false)}
              loading="lazy"
            />
            {imageLoading && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
        
        {/* Quick add button */}
        {product.variantId && !isUnavailable && (
          <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              onClick={handleAddToCart}
              disabled={isAdding || loading}
              size="sm"
              className="w-full"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isAdding ? 'Adding...' : 'Quick Add'}
            </Button>
          </div>
        )}

        {/* Out of stock badge */}
        {isUnavailable && (
          <div className="absolute top-2 right-2 bg-background/90 text-destructive px-2 py-1 text-xs rounded">
            Out of Stock
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
          {product.title}
        </h3>
        <p className="text-sm">
          {formatPrice(
            product.priceRange.minVariantPrice.amount,
            product.priceRange.minVariantPrice.currencyCode
          )}
        </p>
      </div>
    </Link>
  );
}