import { NextRequest, NextResponse } from 'next/server';
import { recommendationEngine } from '@/lib/personalization/recommendation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, segment, algorithms } = body;

    if (!userId || !algorithms || !Array.isArray(algorithms)) {
      return NextResponse.json(
        { error: 'User ID and algorithms array are required' },
        { status: 400 }
      );
    }

    const results = [];

    for (const algorithm of algorithms) {
      let recommendations;
      let algorithmName = algorithm;

      try {
        switch (algorithm) {
          case 'collaborative':
            recommendations = await recommendationEngine.collaborativeFiltering(userId, 10);
            algorithmName = 'Collaborative Filtering';
            break;
          case 'content-based':
            recommendations = await recommendationEngine.contentBasedFiltering(userId, 10);
            algorithmName = 'Content-Based Filtering';
            break;
          case 'deep-learning':
            recommendations = await recommendationEngine.deepLearningRecommendations(userId, 10);
            algorithmName = 'Deep Learning';
            break;
          case 'hybrid':
            recommendations = await recommendationEngine.generateHybridRecommendations(userId, { limit: 10 });
            algorithmName = 'Hybrid Model';
            break;
          default:
            recommendations = [];
        }

        // Calculate metrics for this algorithm
        const metrics = calculateAlgorithmMetrics(recommendations);

        results.push({
          algorithm: algorithmName,
          recommendations: recommendations.slice(0, 5), // Return top 5 for preview
          ...metrics
        });
      } catch (error) {
        console.error(`Error testing ${algorithm}:`, error);
        results.push({
          algorithm: algorithmName,
          recommendations: [],
          overallScore: 0,
          relevanceScore: 0,
          diversityScore: 0,
          noveltyScore: 0,
          confidenceScore: 0,
          error: 'Failed to generate recommendations'
        });
      }
    }

    // Sort by overall score
    results.sort((a, b) => b.overallScore - a.overallScore);

    return NextResponse.json({
      userId,
      segment,
      testId: `ab_test_${Date.now()}`,
      results,
      winner: results[0]?.algorithm,
      completedAt: new Date()
    });
  } catch (error) {
    console.error('Error running A/B test:', error);
    return NextResponse.json(
      { error: 'Failed to run A/B test' },
      { status: 500 }
    );
  }
}

function calculateAlgorithmMetrics(recommendations: any[]) {
  if (!recommendations || recommendations.length === 0) {
    return {
      overallScore: 0,
      relevanceScore: 0,
      diversityScore: 0,
      noveltyScore: 0,
      confidenceScore: 0
    };
  }

  // Calculate relevance score (average of recommendation scores)
  const relevanceScore = recommendations.reduce((sum, rec) => sum + (rec.score || 0), 0) / recommendations.length;

  // Calculate diversity score (unique categories/types)
  const categories = new Set(recommendations.map(rec => rec.category || 'unknown'));
  const diversityScore = Math.min(1, categories.size / 5); // Normalize to 0-1

  // Calculate novelty score (mock - would be based on user's seen items)
  const noveltyScore = 0.5 + Math.random() * 0.3; // Mock novelty

  // Calculate confidence score (average confidence if available)
  const confidenceScore = recommendations.reduce((sum, rec) => sum + (rec.confidence || 0.8), 0) / recommendations.length;

  // Calculate overall score (weighted average)
  const overallScore = (
    relevanceScore * 0.4 +
    diversityScore * 0.25 +
    noveltyScore * 0.2 +
    confidenceScore * 0.15
  );

  return {
    overallScore,
    relevanceScore,
    diversityScore,
    noveltyScore,
    confidenceScore
  };
}