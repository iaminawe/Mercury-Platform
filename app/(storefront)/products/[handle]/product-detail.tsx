'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { formatPrice } from '@/lib/shopify';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ProductDetailProps {
  product: any;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const { addToCart, loading } = useCart();
  const [selectedVariant, setSelectedVariant] = useState(product.variants.edges[0]?.node);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const images = product.images.edges.map((edge: any) => edge.node);
  const hasMultipleImages = images.length > 1;

  const handleVariantChange = (variantId: string) => {
    const variant = product.variants.edges.find((edge: any) => edge.node.id === variantId)?.node;
    if (variant) {
      setSelectedVariant(variant);
      // If variant has its own image, show it
      const variantImageIndex = images.findIndex((img: any) => 
        img.transformedSrc === variant.image?.transformedSrc
      );
      if (variantImageIndex !== -1) {
        setCurrentImageIndex(variantImageIndex);
      }
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || isAdding) return;

    setIsAdding(true);
    try {
      await addToCart(selectedVariant.id, quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {images[currentImageIndex] && (
                <Image
                  src={images[currentImageIndex].transformedSrc}
                  alt={images[currentImageIndex].altText || product.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              )}
              
              {/* Image Navigation */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Images */}
            {hasMultipleImages && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {images.map((image: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`relative aspect-square bg-muted rounded overflow-hidden ring-2 transition-all ${
                      index === currentImageIndex 
                        ? 'ring-primary' 
                        : 'ring-transparent hover:ring-muted-foreground'
                    }`}
                  >
                    <Image
                      src={image.transformedSrc}
                      alt={image.altText || `${product.title} ${index + 1}`}
                      fill
                      sizes="100px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
              <p className="text-2xl font-medium">
                {formatPrice(
                  selectedVariant?.price.amount || product.priceRange.minVariantPrice.amount,
                  selectedVariant?.price.currencyCode || product.priceRange.minVariantPrice.currencyCode
                )}
              </p>
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p>{product.description}</p>
              </div>
            )}

            {/* Variant Selection */}
            {product.options.map((option: any) => (
              <div key={option.name} className="space-y-2">
                <Label className="text-base font-medium">{option.name}</Label>
                <RadioGroup
                  value={selectedVariant?.selectedOptions.find((opt: any) => opt.name === option.name)?.value}
                  onValueChange={(value) => {
                    const newVariant = product.variants.edges.find((edge: any) => 
                      edge.node.selectedOptions.some((opt: any) => 
                        opt.name === option.name && opt.value === value
                      )
                    )?.node;
                    if (newVariant) {
                      handleVariantChange(newVariant.id);
                    }
                  }}
                  className="flex flex-wrap gap-2"
                >
                  {option.values.map((value: string) => {
                    const variant = product.variants.edges.find((edge: any) =>
                      edge.node.selectedOptions.some((opt: any) => 
                        opt.name === option.name && opt.value === value
                      )
                    )?.node;
                    
                    const isAvailable = variant?.availableForSale;
                    
                    return (
                      <div key={value}>
                        <RadioGroupItem
                          value={value}
                          id={`${option.name}-${value}`}
                          disabled={!isAvailable}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`${option.name}-${value}`}
                          className={`flex items-center justify-center rounded-md border-2 px-4 py-2 text-sm font-medium cursor-pointer transition-all
                            ${isAvailable 
                              ? 'hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground' 
                              : 'opacity-50 cursor-not-allowed line-through'
                            }`}
                        >
                          {value}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
            ))}

            {/* Quantity Selector */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Quantity</Label>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleAddToCart}
              disabled={!selectedVariant?.availableForSale || isAdding || loading}
            >
              {!selectedVariant?.availableForSale 
                ? 'Out of Stock' 
                : isAdding 
                ? 'Adding to Cart...' 
                : 'Add to Cart'
              }
            </Button>

            {/* Product Details */}
            <div className="border-t pt-6 space-y-4">
              <div className="text-sm">
                <h3 className="font-medium mb-2">Product Details</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>SKU: {selectedVariant?.id.split('/').pop()}</li>
                  {selectedVariant?.title !== 'Default Title' && (
                    <li>Variant: {selectedVariant?.title}</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}