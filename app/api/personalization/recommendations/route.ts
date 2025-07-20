import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/personalization/recommendation-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const algorithm = searchParams.get('algorithm') || 'hybrid';
    const segment = searchParams.get('segment');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let recommendations;

    if (algorithm === 'hybrid') {
      recommendations = await recommendationEngine.generateHybridRecommendations(userId, {
        limit,
        includeReasons: true
      });
    } else {
      // Handle specific algorithm requests
      switch (algorithm) {
        case 'collaborative':
          recommendations = await recommendationEngine.collaborativeFiltering(userId, limit);
          break;
        case 'content-based':
          recommendations = await recommendationEngine.contentBasedFiltering(userId, limit);
          break;
        case 'deep-learning':
          recommendations = await recommendationEngine.deepLearningRecommendations(userId, limit);
          break;
        case 'trending':
          const trending = await recommendationEngine.getTrendingProducts(limit);
          recommendations = trending.map(t => ({
            productId: t.productId,
            score: t.score,
            confidence: 0.8,
            reasons: ['Trending now'],
            algorithm: 'trending'
          }));
          break;
        default:
          recommendations = await recommendationEngine.generateHybridRecommendations(userId, { limit });
      }
    }

    // Mock product data enrichment (in production, fetch from product service)
    const enrichedRecommendations = recommendations.map((rec, index) => ({
      id: rec.productId,
      title: `Product ${rec.productId}`,
      price: Math.floor(Math.random() * 200) + 20,
      originalPrice: Math.floor(Math.random() * 250) + 30,
      image: `/api/placeholder/300/300?text=Product${index + 1}`,
      category: ['Electronics', 'Clothing', 'Home', 'Sports'][Math.floor(Math.random() * 4)],
      brand: ['Brand A', 'Brand B', 'Brand C'][Math.floor(Math.random() * 3)],
      rating: 3.5 + Math.random() * 1.5,
      score: rec.score,
      confidence: rec.confidence,
      algorithm: rec.algorithm,
      reasons: rec.reasons,
      isPersonalized: true,
      personalizationReason: rec.reasons[0],
      badge: Math.random() > 0.7 ? 'Recommended for you' : undefined,
      discount: Math.random() > 0.8 ? Math.floor(Math.random() * 30) + 5 : undefined
    }));

    return NextResponse.json(enrichedRecommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}