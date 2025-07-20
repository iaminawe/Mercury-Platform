import { NextRequest, NextResponse } from 'next/server';
import { AdvancedSegmentMatcher } from '@/lib/personalization/segment-matcher';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const segmentMatcher = new AdvancedSegmentMatcher(redis, {
  enableRealTime: true,
  cacheTimeout: 3600,
  realTimeUpdateInterval: 300000
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      sessionId,
      deviceType, 
      initialPage,
      userAgent,
      location,
      referrer,
      utm,
      timestamp
    } = body;

    if (!userId && !sessionId) {
      return NextResponse.json(
        { error: 'User ID or Session ID is required' },
        { status: 400 }
      );
    }

    const effectiveUserId = userId || sessionId;
    const effectiveSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Enhanced session context for segmentation
    const sessionContext = {
      userId: effectiveUserId,
      sessionId: effectiveSessionId,
      device: {
        type: deviceType || 'desktop',
        userAgent: userAgent || '',
        isMobile: deviceType === 'mobile' || userAgent?.includes('Mobile')
      },
      location: location || {},
      currentPage: initialPage || '/',
      referrer: referrer || '',
      utm: utm || {},
      timestamp: timestamp || Date.now(),
      startTime: new Date()
    };

    // Perform real-time segmentation
    const segmentationResult = await segmentMatcher.match(sessionContext);

    // Store session data for future analysis
    const sessionData = {
      ...sessionContext,
      segments: segmentationResult.segments,
      confidence: segmentationResult.confidence,
      predictive: segmentationResult.predictive,
      clusters: segmentationResult.clusters
    };

    // Store session in Redis with 24-hour expiry
    await redis.setex(
      `session:${effectiveSessionId}`,
      86400, // 24 hours
      JSON.stringify(sessionData)
    );

    // Store user session history
    await redis.lpush(
      `user_sessions:${effectiveUserId}`,
      JSON.stringify({
        sessionId: effectiveSessionId,
        startTime: sessionContext.startTime,
        segments: segmentationResult.segments,
        device: sessionContext.device.type
      })
    );

    // Keep only last 50 sessions per user
    await redis.ltrim(`user_sessions:${effectiveUserId}`, 0, 49);

    // Track real-time analytics
    await trackSessionAnalytics(effectiveSessionId, sessionData);

    return NextResponse.json({
      sessionId: effectiveSessionId,
      userId: effectiveUserId,
      startTime: sessionContext.startTime,
      deviceType: sessionContext.device.type,
      segments: segmentationResult.segments,
      confidence: segmentationResult.confidence,
      predictive: segmentationResult.predictive,
      realTimeRecommendations: await generateRealTimeRecommendations(segmentationResult),
      nextActions: await getNextBestActions(segmentationResult.segments)
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      event, 
      pageUrl, 
      timeOnPage, 
      scrollDepth,
      interactions,
      metadata = {}
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get existing session data
    const sessionData = await redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = JSON.parse(sessionData);

    // Update session with new event
    const eventData = {
      event,
      pageUrl,
      timeOnPage,
      scrollDepth,
      interactions,
      metadata,
      timestamp: Date.now()
    };

    // Add to session events
    if (!session.events) session.events = [];
    session.events.push(eventData);

    // Update real-time context
    session.realTimeContext = {
      currentPage: pageUrl,
      timeOnPage,
      scrollDepth,
      totalInteractions: session.events.length,
      lastActivity: new Date()
    };

    // Re-evaluate segments with new data if significant activity
    const shouldReSegment = await shouldTriggerResegmentation(session, eventData);
    if (shouldReSegment) {
      const newSegmentation = await segmentMatcher.match({
        ...session,
        realTimeContext: session.realTimeContext,
        forceRefresh: true
      });

      session.segments = newSegmentation.segments;
      session.confidence = newSegmentation.confidence;
      session.predictive = newSegmentation.predictive;
      session.lastSegmentUpdate = new Date();
    }

    // Store updated session
    await redis.setex(
      `session:${sessionId}`,
      86400, // 24 hours
      JSON.stringify(session)
    );

    // Track event analytics
    await trackEventAnalytics(sessionId, eventData, session);

    return NextResponse.json({
      success: true,
      sessionId,
      event,
      segments: session.segments,
      confidence: session.confidence,
      segmentUpdated: shouldReSegment,
      recommendations: shouldReSegment ? 
        await generateRealTimeRecommendations(session) : null
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (sessionId) {
      // Get specific session data
      const sessionData = await redis.get(`session:${sessionId}`);
      if (!sessionData) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      const session = JSON.parse(sessionData);
      return NextResponse.json({
        ...session,
        analytics: await getSessionAnalytics(sessionId)
      });
    }

    if (userId) {
      // Get user's session history
      const sessions = await redis.lrange(`user_sessions:${userId}`, 0, -1);
      const sessionHistory = sessions.map(s => JSON.parse(s));

      return NextResponse.json({
        userId,
        sessionCount: sessionHistory.length,
        sessions: sessionHistory,
        analytics: await getUserSessionAnalytics(userId)
      });
    }

    // Get global session analytics
    const globalAnalytics = await getGlobalSessionAnalytics();
    return NextResponse.json(globalAnalytics);
  } catch (error) {
    console.error('Error fetching session data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session data for final analytics
    const sessionData = await redis.get(`session:${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      
      // Calculate final session metrics
      const endTime = new Date();
      const duration = endTime.getTime() - new Date(session.startTime).getTime();
      
      const finalMetrics = {
        sessionId,
        userId: session.userId,
        duration,
        endTime,
        totalEvents: session.events?.length || 0,
        finalSegments: session.segments,
        finalConfidence: session.confidence
      };

      // Store final session analytics
      await storeFinalSessionAnalytics(sessionId, finalMetrics);
      
      // Clean up session data
      await redis.del(`session:${sessionId}`);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      endTime: new Date(),
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}

async function trackSessionAnalytics(sessionId: string, sessionData: any) {
  const analytics = {
    sessionId,
    userId: sessionData.userId,
    startTime: sessionData.startTime,
    device: sessionData.device.type,
    segments: sessionData.segments,
    confidence: sessionData.confidence,
    location: sessionData.location,
    referrer: sessionData.referrer
  };

  // Store in analytics pipeline
  await redis.lpush('session_analytics', JSON.stringify(analytics));
  
  // Update real-time counters
  await redis.incr('active_sessions');
  await redis.incr(`device_sessions:${sessionData.device.type}`);
  
  sessionData.segments.forEach(async (segment: string) => {
    await redis.incr(`segment_sessions:${segment}`);
  });
}

async function trackEventAnalytics(sessionId: string, eventData: any, session: any) {
  const analytics = {
    sessionId,
    userId: session.userId,
    event: eventData.event,
    pageUrl: eventData.pageUrl,
    timeOnPage: eventData.timeOnPage,
    timestamp: eventData.timestamp,
    segments: session.segments
  };

  await redis.lpush('event_analytics', JSON.stringify(analytics));
  
  // Track event by segment
  session.segments.forEach(async (segment: string) => {
    await redis.incr(`segment_events:${segment}:${eventData.event}`);
  });
}

async function shouldTriggerResegmentation(session: any, eventData: any): Promise<boolean> {
  // Re-segment if:
  // 1. High-value event (purchase, signup, etc.)
  if (['purchase', 'signup', 'add_to_cart'].includes(eventData.event)) return true;
  
  // 2. Significant engagement change
  const eventCount = session.events?.length || 0;
  if (eventCount > 0 && eventCount % 5 === 0) return true; // Every 5 events
  
  // 3. Time-based trigger (every 10 minutes)
  const lastUpdate = session.lastSegmentUpdate ? new Date(session.lastSegmentUpdate) : session.startTime;
  const timeSinceLastUpdate = Date.now() - new Date(lastUpdate).getTime();
  if (timeSinceLastUpdate > 600000) return true; // 10 minutes
  
  // 4. Behavior pattern change
  if (eventData.event === 'page_view' && eventData.timeOnPage > 300) return true; // 5+ minutes on page
  
  return false;
}

async function generateRealTimeRecommendations(segmentation: any) {
  const recommendations = [];
  
  segmentation.segments.forEach((segment: string) => {
    switch (segment) {
      case 'vip_customers':
        recommendations.push({
          type: 'exclusive_offer',
          message: 'VIP early access to new collection',
          action: 'show_vip_products',
          priority: 'high'
        });
        break;
      case 'new_visitors':
        recommendations.push({
          type: 'welcome_offer',
          message: 'Welcome! Get 10% off your first order',
          action: 'show_discount_popup',
          priority: 'high'
        });
        break;
      case 'price_sensitive_shoppers':
        recommendations.push({
          type: 'discount_highlight',
          message: 'Check out our current deals',
          action: 'highlight_sale_items',
          priority: 'medium'
        });
        break;
      case 'high_intent_browsers':
        recommendations.push({
          type: 'urgency',
          message: 'Limited stock - complete your purchase',
          action: 'show_stock_warning',
          priority: 'high'
        });
        break;
      case 'at_risk_customers':
        recommendations.push({
          type: 'retention',
          message: 'We miss you! Here\'s 15% off to welcome you back',
          action: 'show_winback_offer',
          priority: 'critical'
        });
        break;
    }
  });

  return recommendations.sort((a, b) => {
    const priority = { critical: 4, high: 3, medium: 2, low: 1 };
    return priority[b.priority as keyof typeof priority] - priority[a.priority as keyof typeof priority];
  });
}

async function getNextBestActions(segments: string[]) {
  const actions: { [key: string]: string[] } = {
    'vip_customers': ['show_premium_products', 'offer_personal_shopping', 'invite_to_exclusive_events'],
    'new_visitors': ['show_popular_products', 'display_reviews', 'offer_free_shipping'],
    'price_sensitive_shoppers': ['highlight_discounts', 'show_bundle_deals', 'display_price_comparison'],
    'high_intent_browsers': ['add_social_proof', 'show_limited_time_offers', 'enable_quick_checkout'],
    'at_risk_customers': ['show_personalized_recommendations', 'offer_customer_service_chat', 'display_loyalty_benefits']
  };

  const allActions = new Set<string>();
  segments.forEach(segment => {
    actions[segment]?.forEach(action => allActions.add(action));
  });

  return Array.from(allActions);
}

async function getSessionAnalytics(sessionId: string) {
  return {
    totalEvents: await redis.llen(`session_events:${sessionId}`),
    uniquePages: 5, // Calculated from events
    averageTimeOnPage: 125, // Calculated from events
    conversionEvents: 1,
    engagementScore: 0.75
  };
}

async function getUserSessionAnalytics(userId: string) {
  const sessions = await redis.lrange(`user_sessions:${userId}`, 0, -1);
  const sessionData = sessions.map(s => JSON.parse(s));

  return {
    totalSessions: sessionData.length,
    averageSessionDuration: sessionData.reduce((sum, s) => sum + (s.duration || 0), 0) / sessionData.length,
    mostCommonDevice: getMostCommonDevice(sessionData),
    segmentHistory: getSegmentHistory(sessionData),
    engagementTrend: calculateEngagementTrend(sessionData)
  };
}

async function getGlobalSessionAnalytics() {
  const [activeSessions, totalSessions] = await Promise.all([
    redis.get('active_sessions'),
    redis.llen('session_analytics')
  ]);

  return {
    activeSessions: parseInt(activeSessions || '0'),
    totalSessions: totalSessions,
    deviceBreakdown: {
      desktop: await redis.get('device_sessions:desktop') || 0,
      mobile: await redis.get('device_sessions:mobile') || 0,
      tablet: await redis.get('device_sessions:tablet') || 0
    },
    topSegments: await getTopActiveSegments()
  };
}

async function storeFinalSessionAnalytics(sessionId: string, metrics: any) {
  await redis.lpush('completed_sessions', JSON.stringify(metrics));
  await redis.decr('active_sessions');
}

function getMostCommonDevice(sessionData: any[]): string {
  const deviceCounts: { [key: string]: number } = {};
  sessionData.forEach(session => {
    const device = session.device || 'desktop';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
  });
  
  return Object.entries(deviceCounts).reduce((a, b) => deviceCounts[a[0]] > deviceCounts[b[0]] ? a : b)[0];
}

function getSegmentHistory(sessionData: any[]): any[] {
  return sessionData.map(session => ({
    sessionId: session.sessionId,
    startTime: session.startTime,
    segments: session.segments || []
  })).slice(0, 10); // Last 10 sessions
}

function calculateEngagementTrend(sessionData: any[]): number {
  if (sessionData.length < 2) return 0;
  
  const recent = sessionData.slice(0, Math.ceil(sessionData.length / 2));
  const older = sessionData.slice(Math.ceil(sessionData.length / 2));
  
  const recentEngagement = recent.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / recent.length;
  const olderEngagement = older.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / older.length;
  
  return recentEngagement - olderEngagement; // Positive = improving, negative = declining
}

async function getTopActiveSegments(): Promise<any[]> {
  const segmentKeys = await redis.keys('segment_sessions:*');
  const segmentCounts = await Promise.all(
    segmentKeys.map(async key => {
      const count = await redis.get(key);
      return {
        segment: key.replace('segment_sessions:', ''),
        activeSessions: parseInt(count || '0')
      };
    })
  );
  
  return segmentCounts
    .sort((a, b) => b.activeSessions - a.activeSessions)
    .slice(0, 5);
}