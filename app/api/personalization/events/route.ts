import { NextRequest, NextResponse } from 'next/server';
import { realTimeEngine } from '@/lib/personalization/real-time-engine';
import { behaviorTracker } from '@/lib/personalization/behavior-tracker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionId, eventType, data, timestamp } = body;

    if (!userId || !eventType) {
      return NextResponse.json(
        { error: 'User ID and event type are required' },
        { status: 400 }
      );
    }

    // Create real-time event
    const realTimeEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId: sessionId || `session_${Date.now()}`,
      eventType,
      data: data || {},
      context: {
        page: data?.page || 'unknown',
        referrer: data?.referrer,
        deviceType: data?.deviceType || 'desktop',
        timestamp: new Date(timestamp || Date.now()),
        coordinates: data?.coordinates
      },
      metadata: data?.metadata
    };

    // Process event through real-time engine
    const updates = await realTimeEngine.processEvent(realTimeEvent);

    // Also track through behavior tracker for long-term learning
    await behaviorTracker.track({
      userId,
      eventType,
      eventData: data,
      timestamp: new Date(timestamp || Date.now()),
      sessionId,
      deviceType: data?.deviceType,
      userAgent: data?.userAgent,
      ipAddress: data?.ipAddress,
      referrer: data?.referrer
    });

    return NextResponse.json({
      success: true,
      eventId: realTimeEvent.id,
      updates: updates.length,
      personalizationUpdates: updates
    });
  } catch (error) {
    console.error('Error processing event:', error);
    return NextResponse.json(
      { error: 'Failed to process event' },
      { status: 500 }
    );
  }
}