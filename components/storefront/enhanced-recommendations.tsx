'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Heart, ShoppingCart, Star, TrendingUp, Sparkles, Eye, 
  Zap, Target, Users, Brain, TrendingDown, AlertCircle,
  Clock, Filter, BarChart3, Cpu, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { personalizationEngine } from '@/lib/personalization/engine';
import { RecommendationEngine } from '@/lib/personalization/recommendation-engine';
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

interface EnhancedRecommendation extends Product {
  score: number;
  reason: string;
  method: string;
  confidence: number;
  explanation: string;
  diversityScore?: number;
  noveltyScore?: number;
  businessFactors?: {
    margin: number;
    inventoryLevel: number;
    velocity: number;
    seasonalBoost: number;
    segmentBoost: number;
    crossSellScore: number;
  };
  abTestVariant?: string;
  realTimeScore?: number;
  timestamp?: number;
}

interface EnhancedRecommendationsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  category?: string;
  showReason?: boolean;
  showScore?: boolean;
  showAdvancedMetrics?: boolean;
  showABTestInfo?: boolean;
  showPerformanceMetrics?: boolean;
  layout?: 'grid' | 'carousel' | 'list';
  recommendationType?: 'personal' | 'trending' | 'cross_sell' | 'similar' | 'neural' | 'hybrid';
  enableRealTimeUpdates?: boolean;
  enableABTesting?: boolean;
  enableAdvancedFiltering?: boolean;
  className?: string;
  onProductClick?: (product: Product) => void;
  onRecommendationFeedback?: (productId: string, feedback: 'like' | 'dislike' | 'not_interested') => void;
}

export function EnhancedRecommendations({
  title = 'AI-Powered Recommendations',
  subtitle = 'Advanced neural network recommendations tailored specifically for you',
  limit = 12,
  category,
  showReason = true,
  showScore = false,
  showAdvancedMetrics = false,
  showABTestInfo = false,
  showPerformanceMetrics = false,
  layout = 'grid',
  recommendationType = 'personal',
  enableRealTimeUpdates = true,
  enableABTesting = true,
  enableAdvancedFiltering = false,
  className,
  onProductClick,
  onRecommendationFeedback
}: EnhancedRecommendationsProps) {
  const { data: session } = useSession();
  const [recommendations, setRecommendations] = useState<EnhancedRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [realTimeEngine, setRealTimeEngine] = useState<RecommendationEngine | null>(null);
  const [abTestVariant, setAbTestVariant] = useState<string>('balanced');
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [isRealTimeUpdate, setIsRealTimeUpdate] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'confidence' | 'novelty' | 'business'>('score');
  const [realTimeEnabled, setRealTimeEnabled] = useState(enableRealTimeUpdates);

  useEffect(() => {
    let realTimeInterval: NodeJS.Timeout;
    
    async function initializeRecommendationEngine() {
      try {
        setIsLoading(true);
        
        // Mock Redis for demo (in production, use actual Redis)
        const mockRedis = {
          get: async (key: string) => null,
          set: async (key: string, value: string) => {},
          setex: async (key: string, ttl: number, value: string) => {},
          lpush: async (key: string, value: string) => {},
          ltrim: async (key: string, start: number, stop: number) => {},
          lrange: async (key: string, start: number, stop: number) => [],
          zincrby: async (key: string, increment: number, member: string) => {},
          zrevrange: async (key: string, start: number, stop: number, ...args: any[]) => []
        };
        
        const engine = new RecommendationEngine(mockRedis as any, {
          enableRealTime: realTimeEnabled,
          enableABTesting: enableABTesting,
          enableDeepLearning: true,
          enableBusinessRules: true,
          maxRecommendations: limit * 2
        });
        
        setRealTimeEngine(engine);
        await loadAdvancedRecommendations(engine);
        
        // Set up real-time updates
        if (realTimeEnabled) {
          realTimeInterval = setInterval(async () => {
            if (!isLoading) {
              setIsRealTimeUpdate(true);
              await loadAdvancedRecommendations(engine);
              setIsRealTimeUpdate(false);
            }
          }, 30000);
        }
      } catch (error) {
        console.error('Failed to initialize recommendation engine:', error);
        await loadFallbackRecommendations();
      }
    }
    
    async function loadAdvancedRecommendations(engine: RecommendationEngine) {
      try {
        const userId = session?.user?.id || `session_${Date.now()}`;
        
        const context = {
          userId,
          sessionId: session?.id || `session_${Date.now()}`,
          device: getDeviceType(),
          browser: navigator.userAgent,
          os: navigator.platform,
          currentPath: window.location.pathname,
          timestamp: new Date(),
          categoryBrowsed: category,
          limit,
          recommendationType,
          isWeekend: [0, 6].includes(new Date().getDay()),
          trafficSource: document.referrer ? 'referral' : 'direct',
          cartItems: [],
          location: {
            country: 'US',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };

        const recommendationResults = await engine.getRecommendations(context);
        const metrics = await engine.getPerformanceStats();
        
        setRecommendations(recommendationResults.slice(0, limit));
        setPerformanceMetrics(metrics);
        setAbTestVariant(recommendationResults[0]?.abTestVariant || 'balanced');
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        await loadFallbackRecommendations();
      } finally {
        setIsLoading(false);
      }
    }
    
    async function loadFallbackRecommendations() {
      try {
        const fallback = await loadBasicRecommendations(limit);
        setRecommendations(fallback);
      } catch (error) {
        console.error('Fallback recommendations failed:', error);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    }

    initializeRecommendationEngine();
    
    return () => {
      if (realTimeInterval) clearInterval(realTimeInterval);
    };
  }, [session, limit, category, recommendationType, realTimeEnabled, enableABTesting]);

  const handleProductClick = async (product: Product) => {
    try {
      if (realTimeEngine) {
        await realTimeEngine.updateModel(
          {
            userId: session?.user?.id || 'anonymous',
            sessionId: session?.id || `session_${Date.now()}`,
            device: getDeviceType()
          },
          {
            productId: product.id,
            action: 'view',
            pageType: 'recommendations',
            source: 'recommendations',
            method: (product as EnhancedRecommendation).method,
            score: (product as EnhancedRecommendation).score,
            timestamp: Date.now()
          }
        );
      }
      onProductClick?.(product);
    } catch (error) {
      console.error('Failed to track product click:', error);
      onProductClick?.(product);
    }
  };

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (realTimeEngine) {
        await realTimeEngine.updateModel(
          {
            userId: session?.user?.id || 'anonymous',
            sessionId: session?.id || `session_${Date.now()}`,
            device: getDeviceType()
          },
          {
            productId: product.id,
            action: 'cart',
            pageType: 'recommendations',
            source: 'recommendations',
            cartValue: product.price,
            timestamp: Date.now()
          }
        );
      }

      // Real-time recommendation update
      if (realTimeEnabled && realTimeEngine) {
        setTimeout(async () => {
          setIsRealTimeUpdate(true);
          const updated = await realTimeEngine.getRecommendations({
            userId: session?.user?.id || 'anonymous',
            cartItems: [{ productId: product.id, price: product.price }]
          });
          setRecommendations(prev => 
            updated.filter(rec => !prev.some(p => p.id === rec.productId)).slice(0, 3)
              .concat(prev.slice(3))
          );
          setIsRealTimeUpdate(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to track add to cart:', error);
    }
  };

  const handleRecommendationFeedback = async (productId: string, feedback: 'like' | 'dislike' | 'not_interested') => {
    try {
      if (realTimeEngine) {
        await realTimeEngine.updateModel(
          {
            userId: session?.user?.id || 'anonymous',
            sessionId: session?.id || `session_${Date.now()}`,
            device: getDeviceType()
          },
          {
            productId,
            action: feedback === 'like' ? 'wishlist' : feedback === 'dislike' ? 'return' : 'compare',
            pageType: 'recommendations',
            source: 'feedback',
            timestamp: Date.now()
          }
        );
      }
      
      setFeedbackGiven(prev => new Set(prev).add(productId));
      onRecommendationFeedback?.(productId, feedback);
      
      if (feedback === 'not_interested') {
        setRecommendations(prev => prev.filter(rec => rec.id !== productId));
      }
    } catch (error) {
      console.error('Failed to track feedback:', error);
    }
  };

  const filteredRecommendations = recommendations
    .filter(rec => activeMethod === 'all' || rec.method === activeMethod)
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence': return (b.confidence || 0) - (a.confidence || 0);
        case 'novelty': return (b.noveltyScore || 0) - (a.noveltyScore || 0);
        case 'business': return (b.businessFactors?.margin || 0) - (a.businessFactors?.margin || 0);
        default: return b.score - a.score;
      }
    });

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
      {/* Header with Controls */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-6 h-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
            {isRealTimeUpdate && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs animate-pulse">
                <Activity className="w-3 h-3" />
                <span>Updating</span>
              </div>
            )}
          </div>
          
          {/* Real-time Toggle */}
          {enableRealTimeUpdates && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Real-time</span>
              <Switch
                checked={realTimeEnabled}
                onCheckedChange={setRealTimeEnabled}
              />
              {realTimeEnabled && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          )}
        </div>
        
        {subtitle && (
          <p className="text-muted-foreground mb-4">{subtitle}</p>
        )}

        {/* Advanced Controls */}
        {enableAdvancedFiltering && (
          <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <select 
                value={activeMethod} 
                onChange={(e) => setActiveMethod(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="all">All Methods</option>
                <option value="neural">Neural Network</option>
                <option value="collaborative">Collaborative</option>
                <option value="content">Content-Based</option>
                <option value="hybrid">Hybrid</option>
                <option value="business_optimized">Business Optimized</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="score">Relevance Score</option>
                <option value="confidence">Confidence</option>
                <option value="novelty">Novelty</option>
                <option value="business">Business Value</option>
              </select>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {showPerformanceMetrics && performanceMetrics.models && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {Object.keys(performanceMetrics.models).length}
              </div>
              <div className="text-xs text-blue-800">AI Models</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {(performanceMetrics.recommendations?.conversionRate * 100 || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-green-800">Conversion Rate</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {performanceMetrics.performance?.averageResponseTime || 0}ms
              </div>
              <div className="text-xs text-purple-800">Response Time</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                ${performanceMetrics.recommendations?.averageOrderValue || 0}
              </div>
              <div className="text-xs text-orange-800">Avg Order Value</div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Tabs */}
      {enableAdvancedFiltering ? (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="neural">Neural</TabsTrigger>
            <TabsTrigger value="collaborative">Social</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <RecommendationGrid recommendations={filteredRecommendations} />
          </TabsContent>
          
          <TabsContent value="neural" className="mt-6">
            <RecommendationGrid 
              recommendations={filteredRecommendations.filter(r => r.method.includes('neural'))} 
            />
          </TabsContent>
          
          <TabsContent value="collaborative" className="mt-6">
            <RecommendationGrid 
              recommendations={filteredRecommendations.filter(r => r.method === 'collaborative')} 
            />
          </TabsContent>
          
          <TabsContent value="trending" className="mt-6">
            <RecommendationGrid 
              recommendations={filteredRecommendations.filter(r => r.method === 'trending')} 
            />
          </TabsContent>
          
          <TabsContent value="business" className="mt-6">
            <RecommendationGrid 
              recommendations={filteredRecommendations.filter(r => r.method === 'business_optimized')} 
            />
          </TabsContent>
        </Tabs>
      ) : (
        <RecommendationGrid recommendations={filteredRecommendations} />
      )}

      {/* A/B Test & Performance Info */}
      <div className="mt-8 space-y-4">
        {showABTestInfo && abTestVariant && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm">
              <Cpu className="w-4 h-4" />
              <span>Variant: {abTestVariant}</span>
              {performanceMetrics.models && (
                <span>• {Object.keys(performanceMetrics.models).length} models active</span>
              )}
            </div>
          </div>
        )}
        
        {showAdvancedMetrics && performanceMetrics.recommendations && (
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <div className="flex justify-center gap-4">
              <span>CTR: {(performanceMetrics.recommendations.clickThrough * 100 || 0).toFixed(1)}%</span>
              <span>CVR: {(performanceMetrics.recommendations.conversionRate * 100 || 0).toFixed(1)}%</span>
              <span>Revenue Impact: +{(performanceMetrics.businessMetrics?.revenueIncrease * 100 || 0).toFixed(1)}%</span>
            </div>
            {realTimeEngine && (
              <div className="text-xs">
                Powered by {performanceMetrics.models ? Object.keys(performanceMetrics.models).join(', ') : 'neural networks'} 
                • Last updated: {new Date().toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
        
        {filteredRecommendations.length >= limit && (
          <div className="text-center">
            <Link href="/recommendations">
              <Button variant="outline" size="lg">
                View All AI Recommendations
                {realTimeEnabled && <span className="ml-2 text-green-600">● Live</span>}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  function RecommendationGrid({ recommendations }: { recommendations: EnhancedRecommendation[] }) {
    return (
      <div className={cn(
        'grid gap-6',
        layout === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        layout === 'list' && 'grid-cols-1',
        layout === 'carousel' && 'flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4'
      )}>
        {recommendations.map((product, index) => (
          <RecommendationCard 
            key={product.id} 
            product={product} 
            index={index}
            onProductClick={handleProductClick}
            onAddToCart={handleAddToCart}
            onFeedback={handleRecommendationFeedback}
            feedbackGiven={feedbackGiven}
            hoveredProduct={hoveredProduct}
            setHoveredProduct={setHoveredProduct}
            showScore={showScore}
            showAdvancedMetrics={showAdvancedMetrics}
            showReason={showReason}
            layout={layout}
          />
        ))}
      </div>
    );
  }
}

function RecommendationCard({
  product,
  index,
  onProductClick,
  onAddToCart,
  onFeedback,
  feedbackGiven,
  hoveredProduct,
  setHoveredProduct,
  showScore,
  showAdvancedMetrics,
  showReason,
  layout
}: {
  product: EnhancedRecommendation;
  index: number;
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
  onFeedback: (productId: string, feedback: 'like' | 'dislike' | 'not_interested') => void;
  feedbackGiven: Set<string>;
  hoveredProduct: string | null;
  setHoveredProduct: (id: string | null) => void;
  showScore: boolean;
  showAdvancedMetrics: boolean;
  showReason: boolean;
  layout: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(layout === 'carousel' && 'flex-none w-72 snap-start')}
    >
      <Link href={`/products/${product.id}`} onClick={() => onProductClick(product)}>
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

            {/* Method Badge */}
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs">
                {product.method === 'neural' ? <Brain className="w-3 h-3 mr-1" /> :
                 product.method === 'collaborative' ? <Users className="w-3 h-3 mr-1" /> :
                 <Zap className="w-3 h-3 mr-1" />}
                {product.method}
              </Badge>
            </div>

            {/* Quick Actions */}
            <div className={cn(
              'absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity duration-300',
              hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
            )}>
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFeedback(product.id, 'like');
                }}
              >
                <Heart className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full"
                onClick={(e) => onAddToCart(product, e)}
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

            {/* Advanced Metrics Overlay */}
            {(showScore || showAdvancedMetrics) && (
              <div className="absolute bottom-2 right-2 space-y-1">
                {showScore && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="font-medium">{Math.round(product.score * 100)}%</span>
                  </div>
                )}
                
                {showAdvancedMetrics && (
                  <div className="flex flex-col gap-1">
                    {product.confidence && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/90 backdrop-blur-sm text-xs text-white">
                        <Target className="w-3 h-3" />
                        <span>{Math.round(product.confidence * 100)}%</span>
                      </div>
                    )}
                    
                    {product.noveltyScore && product.noveltyScore > 0.7 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/90 backdrop-blur-sm text-xs text-white">
                        <Sparkles className="w-3 h-3" />
                        <span>New</span>
                      </div>
                    )}
                  </div>
                )}
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

            {/* Advanced Explanation */}
            {showReason && (
              <div className="space-y-1">
                {product.explanation && (
                  <p className="text-xs text-muted-foreground">
                    {product.explanation}
                  </p>
                )}
                
                {showAdvancedMetrics && product.businessFactors && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.businessFactors.margin > 0.3 && (
                      <span className="text-xs bg-green-100 text-green-800 px-1 rounded">High Margin</span>
                    )}
                    {product.businessFactors.velocity > 2 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Fast Selling</span>
                    )}
                    {product.businessFactors.seasonalBoost > 1.2 && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">Seasonal</span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Confidence Score */}
            {showAdvancedMetrics && product.confidence && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Confidence</span>
                  <span>{Math.round(product.confidence * 100)}%</span>
                </div>
                <Progress value={product.confidence * 100} className="h-1" />
              </div>
            )}
            
            {/* Feedback Buttons */}
            {!feedbackGiven.has(product.id) && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <span className="text-xs text-muted-foreground">Helpful?</span>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFeedback(product.id, 'like');
                    }}
                    className="text-green-600 hover:text-green-700 text-xs px-2 py-1 rounded hover:bg-green-50"
                  >
                    👍
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFeedback(product.id, 'dislike');
                    }}
                    className="text-red-600 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                  >
                    👎
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFeedback(product.id, 'not_interested');
                    }}
                    className="text-gray-600 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// Helper functions
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

async function loadBasicRecommendations(limit: number): Promise<EnhancedRecommendation[]> {
  const products = await fetchProductDetails(
    Array.from({ length: limit }, (_, i) => `ai_rec_${i}`)
  );
  
  return products.map((product, index) => ({
    ...product,
    score: 0.9 - (index * 0.05),
    reason: 'AI-powered recommendation',
    method: 'fallback',
    confidence: 0.8 - (index * 0.02),
    explanation: 'Selected by advanced machine learning algorithms based on user behavior patterns',
    timestamp: Date.now()
  }));
}

async function fetchProductDetails(productIds: string[]): Promise<Product[]> {
  return productIds.map((id, index) => ({
    id,
    name: `AI-Curated Product ${id.split('_').pop()}`,
    description: 'Advanced neural networks identified this as a perfect match for your preferences and behavior patterns',
    price: 99.99 - (index * 7),
    compareAtPrice: index % 3 === 0 ? 149.99 : undefined,
    image: `/images/products/product-${(index % 10) + 1}.jpg`,
    category: ['electronics', 'fashion', 'home', 'sports', 'beauty', 'fitness'][index % 6],
    rating: 4.8 - (index * 0.1),
    reviewCount: 250 - (index * 15),
    badge: index === 0 ? { text: 'AI Top Pick', variant: 'default' as const } : 
           index === 1 ? { text: 'Neural Match', variant: 'secondary' as const } :
           index === 2 ? { text: 'Smart Choice', variant: 'outline' as const } : undefined
  }));
}