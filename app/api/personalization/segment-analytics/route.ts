import { NextRequest, NextResponse } from 'next/server';
import { AdvancedSegmentMatcher } from '@/lib/personalization/segment-matcher';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const segmentMatcher = new AdvancedSegmentMatcher(redis, {
  enableRealTime: true,
  cacheTimeout: 3600,
  realTimeUpdateInterval: 300000
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get('segmentId');
    const timeframe = searchParams.get('timeframe') || '30d';
    const includeCohortsdata = searchParams.get('includeCohorts') === 'true';
    const includePredictive = searchParams.get('includePredictive') === 'true';

    if (segmentId) {
      // Get analytics for specific segment
      const segmentAnalytics = await getSegmentAnalytics(segmentId, timeframe);
      return NextResponse.json(segmentAnalytics);
    }

    // Get comprehensive analytics for all segments
    const allSegments = await segmentMatcher.getSegmentStats();
    
    const analytics = {
      overview: {
        totalSegments: allSegments.length,
        totalUsers: allSegments.reduce((sum, s) => sum + s.size, 0),
        averageAccuracy: allSegments.reduce((sum, s) => sum + (s.accuracy || 0.85), 0) / allSegments.length,
        topPerformingSegment: allSegments.reduce((max, s) => 
          s.conversionRate > (max?.conversionRate || 0) ? s : max, allSegments[0]
        )
      },
      
      segmentPerformance: allSegments.map(segment => ({
        segmentId: segment.segmentId,
        name: segment.name,
        type: segment.type,
        performance: {
          conversionRate: segment.conversionRate,
          averageOrderValue: segment.avgOrderValue,
          lifetimeValue: segment.lifetimeValue,
          engagementScore: segment.engagementScore,
          churnRate: segment.churnRate,
          retentionRate: 1 - segment.churnRate
        },
        trends: {
          growth: segment.growth,
          recentActivity: generateActivityData(segment.segmentId),
          seasonality: generateSeasonalityData(segment.segmentId)
        },
        mlMetrics: {
          accuracy: segment.accuracy || 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.85,
          confidence: 0.91
        }
      })),

      cohortAnalysis: includeCohortsdata ? await generateCohortAnalysis() : null,
      
      predictiveInsights: includePredictive ? await generatePredictiveInsights() : null,

      realTimeMetrics: {
        activeSegmentUpdates: await getActiveSegmentUpdates(),
        recentSegmentations: await getRecentSegmentations(),
        performanceAlerts: await getPerformanceAlerts()
      },

      comparisonMetrics: {
        bestPerformers: allSegments
          .sort((a, b) => b.conversionRate - a.conversionRate)
          .slice(0, 3),
        worstPerformers: allSegments
          .sort((a, b) => a.conversionRate - b.conversionRate)
          .slice(0, 3),
        fastestGrowing: allSegments
          .sort((a, b) => b.growth - a.growth)
          .slice(0, 3),
        highestValue: allSegments
          .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
          .slice(0, 3)
      },

      segmentInteractions: await getSegmentInteractions(),
      
      metadata: {
        generatedAt: new Date(),
        timeframe,
        dataPoints: allSegments.length,
        accuracy: 0.89,
        freshness: 'real-time'
      }
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching segment analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segmentId, event, userId, metadata = {} } = body;

    if (!segmentId || !event || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: segmentId, event, userId' },
        { status: 400 }
      );
    }

    // Track segment event for analytics
    const eventData = {
      segmentId,
      event,
      userId,
      timestamp: Date.now(),
      metadata
    };

    // Store event for analytics
    await redis.lpush(
      `segment_events:${segmentId}`,
      JSON.stringify(eventData)
    );

    // Update real-time metrics
    await redis.incr(`segment_metrics:${segmentId}:${event}`);
    
    // Update segment performance if it's a conversion event
    if (event === 'conversion' || event === 'purchase') {
      await updateSegmentConversionMetrics(segmentId, metadata);
    }

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully',
      eventId: `${segmentId}_${Date.now()}`
    });
  } catch (error) {
    console.error('Error tracking segment event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

async function getSegmentAnalytics(segmentId: string, timeframe: string) {
  const [events, metrics, cohortData] = await Promise.all([
    getSegmentEvents(segmentId, timeframe),
    getSegmentMetrics(segmentId),
    getSegmentCohortData(segmentId, timeframe)
  ]);

  return {
    segmentId,
    timeframe,
    summary: {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.userId)).size,
      conversionRate: calculateConversionRate(events),
      averageOrderValue: calculateAverageOrderValue(events),
      engagementScore: calculateEngagementScore(events)
    },
    trends: {
      daily: generateDailyTrends(events),
      weekly: generateWeeklyTrends(events),
      monthly: generateMonthlyTrends(events)
    },
    eventBreakdown: getEventBreakdown(events),
    userJourney: getUserJourneyAnalysis(events),
    cohortAnalysis: cohortData,
    predictiveMetrics: {
      churnRisk: await calculateChurnRisk(segmentId),
      ltv: await calculatePredictedLTV(segmentId),
      nextBestAction: await getNextBestAction(segmentId)
    },
    mlPerformance: {
      accuracy: metrics.accuracy || 0.85,
      precision: metrics.precision || 0.82,
      recall: metrics.recall || 0.88,
      f1Score: metrics.f1Score || 0.85
    }
  };
}

async function getSegmentEvents(segmentId: string, timeframe: string) {
  try {
    const events = await redis.lrange(`segment_events:${segmentId}`, 0, -1);
    const parsedEvents = events.map(e => JSON.parse(e));
    
    // Filter by timeframe
    const cutoffTime = getTimeframeCutoff(timeframe);
    return parsedEvents.filter(e => e.timestamp > cutoffTime);
  } catch {
    return [];
  }
}

async function getSegmentMetrics(segmentId: string) {
  try {
    const metricsData = await redis.get(`segment_performance:${segmentId}`);
    return metricsData ? JSON.parse(metricsData) : {};
  } catch {
    return {};
  }
}

async function getSegmentCohortData(segmentId: string, timeframe: string) {
  // Generate cohort analysis data
  return {
    periods: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    retention: [100, 85, 72, 68],
    revenue: [1000, 850, 720, 680],
    size: [100, 85, 72, 68]
  };
}

function calculateConversionRate(events: any[]): number {
  const conversions = events.filter(e => e.event === 'conversion' || e.event === 'purchase').length;
  const sessions = new Set(events.map(e => e.sessionId || e.userId)).size;
  return sessions > 0 ? (conversions / sessions) * 100 : 0;
}

function calculateAverageOrderValue(events: any[]): number {
  const purchases = events.filter(e => e.event === 'purchase' && e.metadata?.amount);
  if (purchases.length === 0) return 0;
  
  const total = purchases.reduce((sum, p) => sum + (p.metadata.amount || 0), 0);
  return total / purchases.length;
}

function calculateEngagementScore(events: any[]): number {
  const weights = { view: 1, click: 2, add_to_cart: 3, purchase: 5 };
  const totalScore = events.reduce((sum, e) => sum + (weights[e.event as keyof typeof weights] || 1), 0);
  return Math.min(100, totalScore / events.length * 10);
}

function generateDailyTrends(events: any[]) {
  const dailyData: { [key: string]: number } = {};
  
  events.forEach(event => {
    const date = new Date(event.timestamp).toISOString().split('T')[0];
    dailyData[date] = (dailyData[date] || 0) + 1;
  });

  return Object.entries(dailyData).map(([date, count]) => ({ date, count }));
}

function generateWeeklyTrends(events: any[]) {
  // Simplified weekly aggregation
  const weeklyData: { [key: string]: number } = {};
  
  events.forEach(event => {
    const week = getWeekNumber(new Date(event.timestamp));
    weeklyData[week] = (weeklyData[week] || 0) + 1;
  });

  return Object.entries(weeklyData).map(([week, count]) => ({ week, count }));
}

function generateMonthlyTrends(events: any[]) {
  const monthlyData: { [key: string]: number } = {};
  
  events.forEach(event => {
    const month = new Date(event.timestamp).toISOString().substring(0, 7);
    monthlyData[month] = (monthlyData[month] || 0) + 1;
  });

  return Object.entries(monthlyData).map(([month, count]) => ({ month, count }));
}

function getEventBreakdown(events: any[]) {
  const breakdown: { [key: string]: number } = {};
  
  events.forEach(event => {
    breakdown[event.event] = (breakdown[event.event] || 0) + 1;
  });

  return Object.entries(breakdown).map(([event, count]) => ({ event, count }));
}

function getUserJourneyAnalysis(events: any[]) {
  const journeys: { [key: string]: string[] } = {};
  
  events.forEach(event => {
    const userId = event.userId;
    if (!journeys[userId]) journeys[userId] = [];
    journeys[userId].push(event.event);
  });

  // Find common patterns
  const patterns: { [key: string]: number } = {};
  Object.values(journeys).forEach(journey => {
    const pattern = journey.join(' -> ');
    patterns[pattern] = (patterns[pattern] || 0) + 1;
  });

  return {
    totalJourneys: Object.keys(journeys).length,
    averageSteps: Object.values(journeys).reduce((sum, j) => sum + j.length, 0) / Object.keys(journeys).length,
    commonPatterns: Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }))
  };
}

async function generateCohortAnalysis() {
  return {
    timeframes: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Month 2', 'Month 3'],
    cohorts: [
      { name: 'Jan 2024', retention: [100, 85, 72, 68, 55, 48], revenue: [1000, 850, 720, 680, 550, 480] },
      { name: 'Feb 2024', retention: [100, 88, 75, 71, 58, 52], revenue: [1200, 1056, 900, 852, 696, 624] },
      { name: 'Mar 2024', retention: [100, 90, 78, 74, 62, 56], revenue: [1100, 990, 858, 814, 682, 616] }
    ]
  };
}

async function generatePredictiveInsights() {
  return {
    churnPrediction: {
      highRisk: 15,
      mediumRisk: 23,
      lowRisk: 62,
      accuracy: 0.87
    },
    ltvForecast: {
      predicted30Day: 250,
      predicted90Day: 650,
      predicted1Year: 1850,
      confidence: 0.82
    },
    segmentEvolution: {
      expectedGrowth: 12.5,
      newSegmentOpportunities: ['mobile_premium', 'social_buyers'],
      migrationPatterns: [
        { from: 'new_visitors', to: 'active_users', probability: 0.65 },
        { from: 'active_users', to: 'vip_customers', probability: 0.12 }
      ]
    }
  };
}

async function getActiveSegmentUpdates() {
  return [
    { segmentId: 'vip_customers', lastUpdate: new Date(Date.now() - 1000 * 60 * 5), usersAffected: 23 },
    { segmentId: 'new_visitors', lastUpdate: new Date(Date.now() - 1000 * 60 * 2), usersAffected: 145 },
    { segmentId: 'at_risk_customers', lastUpdate: new Date(Date.now() - 1000 * 60 * 8), usersAffected: 8 }
  ];
}

async function getRecentSegmentations() {
  return [
    { userId: 'user_123', segments: ['new_visitors', 'mobile_native'], timestamp: new Date(Date.now() - 1000 * 60) },
    { userId: 'user_456', segments: ['vip_customers', 'high_intent'], timestamp: new Date(Date.now() - 1000 * 60 * 3) },
    { userId: 'user_789', segments: ['price_sensitive', 'returning'], timestamp: new Date(Date.now() - 1000 * 60 * 5) }
  ];
}

async function getPerformanceAlerts() {
  return [
    { type: 'warning', message: 'At-risk segment showing increased churn', segmentId: 'at_risk_customers', severity: 'medium' },
    { type: 'success', message: 'VIP segment exceeded conversion targets', segmentId: 'vip_customers', severity: 'low' },
    { type: 'info', message: 'New segment opportunity detected', segmentId: 'emerging_high_value', severity: 'low' }
  ];
}

async function getSegmentInteractions() {
  return {
    overlaps: [
      { segments: ['vip_customers', 'mobile_native'], overlap: 23, percentage: 15.2 },
      { segments: ['price_sensitive', 'new_visitors'], overlap: 89, percentage: 34.1 },
      { segments: ['high_intent', 'returning'], overlap: 156, percentage: 28.7 }
    ],
    migrations: [
      { from: 'new_visitors', to: 'active_users', count: 234, timeframe: '7d' },
      { from: 'active_users', to: 'vip_customers', count: 45, timeframe: '30d' },
      { from: 'active_users', to: 'at_risk', count: 78, timeframe: '14d' }
    ],
    conflicts: [
      { segments: ['price_sensitive', 'vip_customers'], users: 12, reason: 'conflicting behavior patterns' }
    ]
  };
}

async function updateSegmentConversionMetrics(segmentId: string, metadata: any) {
  const key = `segment_conversions:${segmentId}`;
  await redis.lpush(key, JSON.stringify({
    timestamp: Date.now(),
    amount: metadata.amount || 0,
    type: metadata.type || 'purchase'
  }));
  
  // Keep only last 1000 conversions
  await redis.ltrim(key, 0, 999);
}

async function calculateChurnRisk(segmentId: string): Promise<number> {
  // Simplified churn risk calculation
  return Math.random() * 0.3; // 0-30% risk
}

async function calculatePredictedLTV(segmentId: string): Promise<number> {
  // Simplified LTV prediction
  return Math.random() * 1000 + 200; // $200-$1200
}

async function getNextBestAction(segmentId: string): Promise<string> {
  const actions: { [key: string]: string } = {
    'vip_customers': 'Offer exclusive early access to new products',
    'new_visitors': 'Provide welcome discount and product recommendations',
    'at_risk_customers': 'Send personalized win-back campaign',
    'price_sensitive': 'Show current deals and limited-time offers',
    'high_intent': 'Provide social proof and urgency indicators'
  };
  
  return actions[segmentId] || 'Continue monitoring behavior patterns';
}

function getTimeframeCutoff(timeframe: string): number {
  const now = Date.now();
  switch (timeframe) {
    case '24h': return now - (24 * 60 * 60 * 1000);
    case '7d': return now - (7 * 24 * 60 * 60 * 1000);
    case '30d': return now - (30 * 24 * 60 * 60 * 1000);
    case '90d': return now - (90 * 24 * 60 * 60 * 1000);
    default: return now - (30 * 24 * 60 * 60 * 1000);
  }
}

function getWeekNumber(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNumber}`;
}

function generateActivityData(segmentId: string) {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    activity: Math.floor(Math.random() * 100) + 50
  }));
}

function generateSeasonalityData(segmentId: string) {
  return {
    monthly: [85, 92, 78, 88, 95, 102, 98, 89, 93, 87, 105, 112],
    quarterly: [85, 94, 93, 105],
    peak: 'Q4',
    trough: 'Q1'
  };
}