import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface TrackingRequest {
  sessionId: string;
  event: string;
  data?: any;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackingRequest = await request.json();
    const { sessionId, event, data, timestamp } = body;

    if (!sessionId || !event) {
      return NextResponse.json(
        { error: 'SessionId and event are required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Save tracking event
    const { error } = await supabase
      .from('chat_events')
      .insert({
        session_id: sessionId,
        event_type: event,
        event_data: data || {},
        created_at: timestamp || new Date().toISOString()
      });

    if (error) {
      throw error;
    }

    // Handle specific tracking events
    switch (event) {
      case 'product_click':
        await handleProductClick(sessionId, data?.productId);
        break;
      case 'message_feedback':
        await handleMessageFeedback(sessionId, data?.messageId, data?.feedback);
        break;
      case 'conversation_start':
        await handleConversationStart(sessionId, data);
        break;
      case 'conversation_end':
        await handleConversationEnd(sessionId, data);
        break;
      case 'escalation':
        await handleEscalation(sessionId, data?.reason);
        break;
    }

    logger.info('Event tracked:', { sessionId, event, data });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Tracking API error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

async function handleProductClick(sessionId: string, productId: string) {
  if (!productId) return;

  const supabase = createServerSupabaseClient();
  
  // Update product recommendation metrics
  await supabase
    .from('recommendation_clicks')
    .insert({
      session_id: sessionId,
      product_id: productId,
      clicked_at: new Date().toISOString()
    });

  // Update product analytics
  await supabase.rpc('increment_product_clicks', {
    product_id: productId
  });
}

async function handleMessageFeedback(sessionId: string, messageId: string, feedback: 'positive' | 'negative') {
  if (!messageId || !feedback) return;

  const supabase = createServerSupabaseClient();
  
  await supabase
    .from('message_feedback')
    .insert({
      session_id: sessionId,
      message_id: messageId,
      feedback_type: feedback,
      created_at: new Date().toISOString()
    });
}

async function handleConversationStart(sessionId: string, data: any) {
  const supabase = createServerSupabaseClient();
  
  await supabase
    .from('conversation_sessions')
    .insert({
      session_id: sessionId,
      customer_id: data?.customerId,
      customer_email: data?.customerEmail,
      user_agent: data?.userAgent,
      referrer: data?.referrer,
      started_at: new Date().toISOString(),
      status: 'active'
    });
}

async function handleConversationEnd(sessionId: string, data: any) {
  const supabase = createServerSupabaseClient();
  
  await supabase
    .from('conversation_sessions')
    .update({
      ended_at: new Date().toISOString(),
      status: 'completed',
      message_count: data?.messageCount,
      satisfaction_score: data?.satisfactionScore,
      resolution_status: data?.resolved ? 'resolved' : 'unresolved'
    })
    .eq('session_id', sessionId);
}

async function handleEscalation(sessionId: string, reason: string) {
  const supabase = createServerSupabaseClient();
  
  await supabase
    .from('conversation_sessions')
    .update({
      status: 'escalated',
      escalation_reason: reason,
      escalated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId);

  // Add to support queue
  await supabase
    .from('support_queue')
    .insert({
      session_id: sessionId,
      reason: reason,
      priority: 'medium', // Could be determined by AI
      status: 'waiting',
      created_at: new Date().toISOString()
    });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'SessionId is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    
    // Get session analytics
    const { data: session } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    const { data: events } = await supabase
      .from('chat_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      session,
      events: events || []
    });

  } catch (error) {
    logger.error('Failed to get tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracking data' },
      { status: 500 }
    );
  }
}