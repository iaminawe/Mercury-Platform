import { NextRequest, NextResponse } from 'next/server';
import { contentPersonalizer } from '@/lib/personalization/content-personalizer';
import { realTimeEngine } from '@/lib/personalization/real-time-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionId, contentType, context, maxSections } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let personalizedContent;

    if (sessionId) {
      // Use real-time personalization with session context
      personalizedContent = await realTimeEngine.getRealTimeContent(
        userId,
        sessionId,
        contentType,
        context
      );
    } else {
      // Fallback to standard personalization
      personalizedContent = await contentPersonalizer.personalizeContent({
        userId,
        contentType,
        context,
        constraints: { maxSections }
      });
    }

    // Enrich sections with mock data
    const enrichedSections = personalizedContent.layout.sections.map((section: any) => {
      const mockItems = generateMockItems(section.type, 12);
      
      return {
        ...section,
        items: mockItems,
        layout: section.type === 'hero_banner' ? 'carousel' : 
               section.type === 'recently_viewed' ? 'list' : 'grid',
        priority: section.metadata?.score || Math.random(),
        personalizationScore: 0.75 + Math.random() * 0.25,
        reason: section.metadata?.reason || 'Based on your preferences'
      };
    });

    return NextResponse.json({
      layout: {
        sections: enrichedSections
      },
      metadata: {
        personalizedFor: userId,
        contentType,
        generatedAt: new Date(),
        sessionId
      }
    });
  } catch (error) {
    console.error('Error generating personalized content:', error);
    return NextResponse.json(
      { error: 'Failed to generate personalized content' },
      { status: 500 }
    );
  }
}

function generateMockItems(sectionType: string, count: number) {
  const items = [];
  
  for (let i = 0; i < count; i++) {
    const basePrice = Math.floor(Math.random() * 200) + 20;
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 5 : 0;
    
    items.push({
      id: `item_${sectionType}_${i}`,
      title: `${getSectionProductType(sectionType)} Item ${i + 1}`,
      description: `High-quality ${getSectionProductType(sectionType).toLowerCase()} with premium features`,
      price: discount > 0 ? basePrice * (1 - discount / 100) : basePrice,
      originalPrice: discount > 0 ? basePrice : undefined,
      discount: discount > 0 ? discount : undefined,
      image: `/api/placeholder/300/300?text=${sectionType}${i + 1}`,
      category: getRandomCategory(),
      brand: getRandomBrand(),
      rating: 3.5 + Math.random() * 1.5,
      isPersonalized: Math.random() > 0.5,
      personalizationReason: getPersonalizationReason(sectionType),
      badge: Math.random() > 0.8 ? getBadge(sectionType) : undefined
    });
  }
  
  return items;
}

function getSectionProductType(sectionType: string): string {
  const types = {
    'hero_banner': 'Featured',
    'recommendations': 'Recommended',
    'trending': 'Trending',
    'recently_viewed': 'Recently Viewed',
    'categories': 'Category',
    'personalized_offers': 'Special Offer'
  };
  return types[sectionType as keyof typeof types] || 'Product';
}

function getRandomCategory(): string {
  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Beauty'];
  return categories[Math.floor(Math.random() * categories.length)];
}

function getRandomBrand(): string {
  const brands = ['Brand A', 'Brand B', 'Brand C', 'Brand D', 'Brand E'];
  return brands[Math.floor(Math.random() * brands.length)];
}

function getPersonalizationReason(sectionType: string): string {
  const reasons = {
    'recommendations': 'Based on your purchase history',
    'trending': 'Popular in your area',
    'recently_viewed': 'You viewed this recently',
    'personalized_offers': 'Special price for you',
    'categories': 'In your favorite category'
  };
  return reasons[sectionType as keyof typeof reasons] || 'Recommended for you';
}

function getBadge(sectionType: string): string {
  const badges = {
    'recommendations': 'For You',
    'trending': 'Hot',
    'personalized_offers': 'Limited Time',
    'hero_banner': 'Featured'
  };
  return badges[sectionType as keyof typeof badges] || 'Special';
}