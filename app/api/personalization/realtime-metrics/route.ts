import { NextRequest, NextResponse } from 'next/server';
import { realTimeEngine } from '@/lib/personalization/real-time-engine';

export async function GET(request: NextRequest) {
  try {
    // Get real-time metrics from the engine
    const metrics = {
      activeSessions: Math.floor(Math.random() * 150) + 50, // Mock data - would come from realTimeEngine
      eventsPerSecond: Math.floor(Math.random() * 25) + 5,
      avgProcessingTime: Math.floor(Math.random() * 30) + 15, // milliseconds
      cacheHitRate: 0.85 + Math.random() * 0.1 // 85-95%
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch real-time metrics' },
      { status: 500 }
    );
  }
}