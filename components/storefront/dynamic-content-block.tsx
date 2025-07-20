'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Users, 
  Package,
  Heart,
  Star,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { contentPersonalizer } from '@/lib/personalization/content-personalizer';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/format';

interface DynamicContent {
  id: string;
  type: string;
  data: any;
  metadata?: any;
}

interface DynamicContentBlockProps {
  contentType?: string;
  context?: Record<string, any>;
  className?: string;
  maxSections?: number;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

export function DynamicContentBlock({
  contentType = 'homepage',
  context = {},
  className,
  maxSections = 6,
  deviceType
}: DynamicContentBlockProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState<DynamicContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDynamicContent() {
      try {
        const userId = session?.user?.id || `session_${Date.now()}`;
        
        const personalizedContent = await contentPersonalizer.personalizeContent({
          userId,
          contentType,
          context: {
            ...context,
            deviceType: deviceType || getDeviceType(),
            timeOfDay: getTimeOfDay(),
            seasonality: getSeason()
          },
          constraints: {
            maxSections
          }
        });

        // Transform sections into content blocks
        const dynamicBlocks = personalizedContent.layout.sections.map(section => ({
          id: section.id,
          type: section.type,
          data: section.content,
          metadata: section.metadata
        }));

        setContent(dynamicBlocks);
      } catch (error) {
        console.error('Failed to load dynamic content:', error);
        // Load fallback content
        setContent(getFallbackContent());
      } finally {
        setIsLoading(false);
      }
    }

    loadDynamicContent();
  }, [session, contentType, context, maxSections, deviceType]);

  const trackInteraction = async (contentId: string, interactionType: string) => {
    if (!session?.user?.id) return;
    
    await contentPersonalizer.trackInteraction(
      contentId,
      session.user.id,
      interactionType as any,
      { contentType, timestamp: new Date() }
    );
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-48" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)}>
      <AnimatePresence mode="wait">
        {content.map((block, index) => (
          <motion.div
            key={block.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.1 }}
          >
            {renderContentBlock(block, () => trackInteraction(block.id, 'click'))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Content block renderers
function renderContentBlock(block: DynamicContent, onInteraction: () => void): React.ReactNode {
  switch (block.type) {
    case 'trending':
      return <TrendingBlock {...block} onInteraction={onInteraction} />;
    case 'personalized_offers':
      return <PersonalizedOffersBlock {...block} onInteraction={onInteraction} />;
    case 'social_proof':
      return <SocialProofBlock {...block} onInteraction={onInteraction} />;
    case 'recently_viewed':
      return <RecentlyViewedBlock {...block} onInteraction={onInteraction} />;
    case 'categories':
      return <CategoriesBlock {...block} onInteraction={onInteraction} />;
    case 'promotions':
      return <PromotionsBlock {...block} onInteraction={onInteraction} />;
    default:
      return null;
  }
}

// Trending Products Block
function TrendingBlock({ data, metadata, onInteraction }: any) {
  const products = data.products || getMockTrendingProducts();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Trending Now</h3>
        </div>
        <Badge variant="secondary">Updated hourly</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.slice(0, 4).map((product: any) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              onClick={onInteraction}
              className="group"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-2 left-2">
                  <Badge className="bg-orange-500 text-white">
                    <Zap className="w-3 h-3 mr-1" />
                    Trending
                  </Badge>
                </div>
              </div>
              <h4 className="mt-2 text-sm font-medium line-clamp-1">{product.name}</h4>
              <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Personalized Offers Block
function PersonalizedOffersBlock({ data, metadata, onInteraction }: any) {
  const offers = data.offers || getMockOffers();

  return (
    <Card className="overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 text-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6" />
              <h3 className="text-2xl font-bold">Exclusive Offers for You</h3>
            </div>
            <p className="text-white/90">Limited time offers based on your preferences</p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {offers.slice(0, 2).map((offer: any) => (
            <div
              key={offer.id}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20"
            >
              <Badge className="mb-2 bg-white/20 text-white border-white/30">
                {offer.type}
              </Badge>
              <h4 className="text-lg font-semibold mb-1">{offer.title}</h4>
              <p className="text-white/80 text-sm mb-3">{offer.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{offer.discount}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onInteraction();
                    window.location.href = offer.link;
                  }}
                >
                  Claim Offer
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {offer.expiresIn && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <Clock className="w-3 h-3" />
                    <span>Expires in {offer.expiresIn}</span>
                  </div>
                  <Progress value={offer.progress} className="mt-1 h-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Social Proof Block
function SocialProofBlock({ data, metadata, onInteraction }: any) {
  const items = data.items || getMockSocialProof();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">What Others Are Loving</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.slice(0, 3).map((item: any) => (
            <div key={item.id} className="flex items-start gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src={item.product.image}
                  alt={item.product.name}
                  fill
                  className="object-cover rounded"
                />
              </div>
              <div className="flex-1">
                <Link
                  href={`/products/${item.product.id}`}
                  onClick={onInteraction}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {item.product.name}
                </Link>
                <div className="flex items-center gap-1 my-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < item.rating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      )}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-1">
                    by {item.reviewer}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  "{item.review}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Recently Viewed Block
function RecentlyViewedBlock({ data, metadata, onInteraction }: any) {
  const products = data.products || [];

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Recently Viewed</h3>
        </div>
        <Link href="/account/history" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {products.map((product: any) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              onClick={onInteraction}
              className="flex-shrink-0 w-32 group"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-2">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h4 className="text-sm font-medium line-clamp-2">{product.name}</h4>
              <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Categories Block
function CategoriesBlock({ data, metadata, onInteraction }: any) {
  const categories = data.categories || getMockCategories();

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-6 h-6 text-primary" />
        <h3 className="text-2xl font-semibold">Shop by Category</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((category: any) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            onClick={onInteraction}
            className="group"
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-white font-semibold text-lg">{category.name}</h4>
                  <p className="text-white/80 text-sm">{category.count} products</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Promotions Block
function PromotionsBlock({ data, metadata, onInteraction }: any) {
  const promotion = data.promotion || getMockPromotion();

  return (
    <Card className="overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white">
      <CardContent className="p-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              {promotion.badge}
            </Badge>
            <h3 className="text-3xl font-bold mb-2">{promotion.title}</h3>
            <p className="text-white/90 mb-6">{promotion.description}</p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                onInteraction();
                window.location.href = promotion.link;
              }}
            >
              {promotion.cta}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <div className="relative aspect-square">
            <Image
              src={promotion.image}
              alt={promotion.title}
              fill
              className="object-contain"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

// Mock data functions
function getMockTrendingProducts() {
  return [
    { id: '1', name: 'Wireless Earbuds Pro', price: 149.99, image: '/images/products/earbuds.jpg' },
    { id: '2', name: 'Smart Watch Series 5', price: 399.99, image: '/images/products/watch.jpg' },
    { id: '3', name: 'Portable Charger 20000mAh', price: 59.99, image: '/images/products/charger.jpg' },
    { id: '4', name: 'Bluetooth Speaker Mini', price: 79.99, image: '/images/products/speaker.jpg' }
  ];
}

function getMockOffers() {
  return [
    {
      id: '1',
      type: 'Percentage Off',
      title: '25% Off Electronics',
      description: 'Save on all tech accessories',
      discount: '25% OFF',
      link: '/collections/electronics?discount=TECH25',
      expiresIn: '2 days',
      progress: 65
    },
    {
      id: '2',
      type: 'Free Shipping',
      title: 'Free Express Shipping',
      description: 'On orders over $75',
      discount: 'FREE',
      link: '/collections/all?shipping=express',
      expiresIn: '5 hours',
      progress: 85
    }
  ];
}

function getMockSocialProof() {
  return [
    {
      id: '1',
      product: { id: 'p1', name: 'Premium Headphones', image: '/images/products/headphones.jpg' },
      reviewer: 'Sarah M.',
      rating: 5,
      review: 'Amazing sound quality! Best purchase I\'ve made this year.'
    },
    {
      id: '2',
      product: { id: 'p2', name: 'Yoga Mat Pro', image: '/images/products/yoga-mat.jpg' },
      reviewer: 'Mike R.',
      rating: 5,
      review: 'Perfect thickness and grip. Highly recommend for daily practice.'
    },
    {
      id: '3',
      product: { id: 'p3', name: 'Coffee Maker Deluxe', image: '/images/products/coffee-maker.jpg' },
      reviewer: 'Emma L.',
      rating: 4,
      review: 'Great coffee every morning. Easy to use and clean.'
    }
  ];
}

function getMockCategories() {
  return [
    { id: '1', name: 'Electronics', slug: 'electronics', count: 245, image: '/images/categories/electronics.jpg' },
    { id: '2', name: 'Fashion', slug: 'fashion', count: 389, image: '/images/categories/fashion.jpg' },
    { id: '3', name: 'Home & Living', slug: 'home-living', count: 156, image: '/images/categories/home.jpg' },
    { id: '4', name: 'Sports & Outdoors', slug: 'sports', count: 203, image: '/images/categories/sports.jpg' }
  ];
}

function getMockPromotion() {
  return {
    badge: 'Limited Time',
    title: 'Summer Sale Spectacular',
    description: 'Get up to 50% off on selected summer essentials. Don\'t miss out on these amazing deals!',
    cta: 'Shop Summer Sale',
    link: '/collections/summer-sale',
    image: '/images/promotions/summer-sale.png'
  };
}

function getFallbackContent(): DynamicContent[] {
  return [
    { id: 'trending', type: 'trending', data: { products: getMockTrendingProducts() } },
    { id: 'categories', type: 'categories', data: { categories: getMockCategories() } },
    { id: 'promotions', type: 'promotions', data: { promotion: getMockPromotion() } }
  ];
}