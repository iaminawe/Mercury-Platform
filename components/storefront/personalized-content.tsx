'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Heart, 
  ShoppingCart, 
  Star, 
  Clock,
  TrendingUp,
  Eye,
  Sparkles
} from 'lucide-react';

interface PersonalizedSection {
  id: string;
  type: string;
  title: string;
  items: any[];
  layout: 'grid' | 'carousel' | 'list';
  priority: number;
  personalizationScore: number;
  reason: string;
}

interface PersonalizedContentProps {
  userId?: string;
  pageType: 'homepage' | 'category' | 'product' | 'search';
  context?: {
    category?: string;
    productId?: string;
    searchQuery?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
  };
  maxSections?: number;
}

export function PersonalizedContent({ 
  userId, 
  pageType, 
  context, 
  maxSections = 6 
}: PersonalizedContentProps) {
  const [sections, setSections] = useState<PersonalizedSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    if (userId) {
      initializePersonalization();
    } else {
      loadDefaultContent();
    }
  }, [userId, pageType, context]);

  const initializePersonalization = async () => {
    try {
      setIsLoading(true);
      
      // Start personalization session
      const sessionResponse = await fetch('/api/personalization/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceType: context?.deviceType || 'desktop',
          initialPage: pageType
        })
      });
      
      const sessionData = await sessionResponse.json();
      setSessionId(sessionData.sessionId);

      // Get personalized content
      const contentResponse = await fetch('/api/personalization/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId: sessionData.sessionId,
          contentType: pageType,
          context,
          maxSections
        })
      });

      const contentData = await contentResponse.json();
      setSections(contentData.layout?.sections || []);

      // Track page view
      await trackEvent('page_view', {
        page: pageType,
        context
      });

    } catch (error) {
      console.error('Error initializing personalization:', error);
      loadDefaultContent();
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefaultContent = async () => {
    try {
      setIsLoading(true);
      
      // Load non-personalized default content
      const response = await fetch(`/api/content/default?pageType=${pageType}`);
      const data = await response.json();
      setSections(data.sections || []);
      
    } catch (error) {
      console.error('Error loading default content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const trackEvent = async (eventType: string, data: any) => {
    if (!userId || !sessionId) return;

    try {
      await fetch('/api/personalization/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          eventType,
          data,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  const handleProductClick = async (productId: string, sectionId: string) => {
    await trackEvent('product_click', {
      productId,
      sectionId,
      sectionType: sections.find(s => s.id === sectionId)?.type
    });
  };

  const handleAddToCart = async (productId: string, price: number) => {
    await trackEvent('add_to_cart', {
      productId,
      price,
      source: 'personalized_recommendation'
    });
  };

  const handleSectionView = async (sectionId: string) => {
    await trackEvent('section_view', {
      sectionId,
      sectionType: sections.find(s => s.id === sectionId)?.type
    });
  };

  const renderProductCard = (product: any, sectionId: string) => (
    <Card 
      key={product.id} 
      className="group cursor-pointer hover:shadow-lg transition-all duration-200"
      onClick={() => handleProductClick(product.id, sectionId)}
    >
      <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gray-100">
        {product.image && (
          <img 
            src={product.image} 
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        )}
        
        {product.isPersonalized && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              <Sparkles className="h-3 w-3 mr-1" />
              For You
            </Badge>
          </div>
        )}
        
        {product.discount && (
          <div className="absolute top-2 right-2">
            <Badge variant="destructive">
              -{product.discount}%
            </Badge>
          </div>
        )}
        
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAddToCart(product.id, product.price);
            }}
            className="bg-white/90 text-black hover:bg-white"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {product.title}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">${product.price}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>
            
            {product.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs">{product.rating}</span>
              </div>
            )}
          </div>
          
          {product.badge && (
            <Badge variant="secondary" className="text-xs">
              {product.badge}
            </Badge>
          )}
          
          {product.personalizationReason && (
            <div className="text-xs text-muted-foreground">
              {product.personalizationReason}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderSection = (section: PersonalizedSection) => {
    const sectionIcon = {
      'recommendations': <Heart className="h-4 w-4" />,
      'trending': <TrendingUp className="h-4 w-4" />,
      'recently_viewed': <Clock className="h-4 w-4" />,
      'categories': <Eye className="h-4 w-4" />
    };

    return (
      <div 
        key={section.id} 
        className="space-y-4"
        onViewportEnter={() => handleSectionView(section.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {sectionIcon[section.type as keyof typeof sectionIcon] || <Sparkles className="h-4 w-4" />}
              <h2 className="text-xl font-bold">{section.title}</h2>
            </div>
            
            {userId && section.personalizationScore > 0.7 && (
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                Personalized
              </Badge>
            )}
          </div>
          
          {section.reason && userId && (
            <div className="text-sm text-muted-foreground">
              {section.reason}
            </div>
          )}
        </div>

        {section.layout === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {section.items.map(item => renderProductCard(item, section.id))}
          </div>
        )}

        {section.layout === 'carousel' && (
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-2" style={{ width: 'max-content' }}>
              {section.items.map(item => (
                <div key={item.id} className="w-64 flex-shrink-0">
                  {renderProductCard(item, section.id)}
                </div>
              ))}
            </div>
          </div>
        )}

        {section.layout === 'list' && (
          <div className="space-y-4">
            {section.items.map(item => (
              <Card key={item.id} className="p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover rounded"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold">${item.price}</span>
                      <Button size="sm" onClick={() => handleAddToCart(item.id, item.price)}>
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(j => (
                <Card key={j} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Content Available</h3>
        <p className="text-muted-foreground">
          We're working on personalizing your experience. Please check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections
        .sort((a, b) => b.priority - a.priority)
        .map(section => renderSection(section))}
      
      {userId && (
        <div className="text-center py-8 border-t">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>This page was personalized just for you</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on your preferences and browsing history
          </p>
        </div>
      )}
    </div>
  );
}