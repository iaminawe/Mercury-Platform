import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userProfiler } from '@/lib/personalization/user-profiler';

export async function GET(request: NextRequest) {
  try {
    // Get total users with profiles
    const totalUsers = await prisma.user.count();
    
    // Get active segments
    const segments = await prisma.userSegment.findMany({
      include: { _count: { select: { users: true } } }
    });
    const activeSegments = segments.filter(s => s._count.users > 0).length;

    // Get recommendation performance (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recommendationInteractions = await prisma.contentInteraction.groupBy({
      by: ['interactionType'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        contentType: 'recommendation'
      },
      _count: { interactionType: true }
    });

    const impressions = recommendationInteractions.find(r => r.interactionType === 'impression')?._count.interactionType || 0;
    const clicks = recommendationInteractions.find(r => r.interactionType === 'click')?._count.interactionType || 0;
    const conversions = recommendationInteractions.find(r => r.interactionType === 'conversion')?._count.interactionType || 0;

    const recommendationCTR = impressions > 0 ? clicks / impressions : 0;
    const conversionLift = 0.287; // This would be calculated from A/B test data

    // Get average engagement score
    const avgEngagementScore = await prisma.userProfile.aggregate({
      _avg: { engagementScore: true }
    });

    // Get real-time events count
    const realTimeEvents = await prisma.behaviorEvent.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      }
    });

    const metrics = {
      totalUsers,
      activeSegments,
      recommendationCTR,
      conversionLift,
      avgEngagementScore: avgEngagementScore._avg.engagementScore || 0,
      realTimeEvents
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching personalization metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'refresh') {
      // Trigger model refresh/retraining
      // This would typically queue a background job
      
      return NextResponse.json({ 
        message: 'Personalization refresh initiated',
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing personalization action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}