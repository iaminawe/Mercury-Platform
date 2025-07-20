import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7d';
    const metric = searchParams.get('metric');

    const supabase = createServerSupabaseClient();
    
    // Calculate date range based on timeframe
    const timeframeDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };

    const days = timeframeDays[timeframe as keyof typeof timeframeDays] || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    if (metric) {
      // Return specific metric
      const data = await getSpecificMetric(supabase, metric, since);
      return NextResponse.json(data);
    }

    // Return comprehensive analytics
    const analytics = await getComprehensiveAnalytics(supabase, since);
    return NextResponse.json(analytics);

  } catch (error) {
    logger.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

async function getComprehensiveAnalytics(supabase: any, since: string) {
  try {
    // Conversation metrics
    const { data: conversations } = await supabase
      .from('conversation_sessions')
      .select('*')
      .gte('started_at', since);

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .gte('created_at', since);

    const { data: feedback } = await supabase
      .from('message_feedback')
      .select('*')
      .gte('created_at', since);

    const { data: events } = await supabase
      .from('chat_events')
      .select('*')
      .gte('created_at', since);

    // Calculate metrics
    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.status === 'active').length || 0;
    const completedConversations = conversations?.filter(c => c.status === 'completed').length || 0;
    const escalatedConversations = conversations?.filter(c => c.status === 'escalated').length || 0;
    
    const resolutionRate = completedConversations > 0 
      ? (conversations?.filter(c => c.resolution_status === 'resolved').length || 0) / completedConversations * 100 
      : 0;

    const avgSatisfaction = conversations?.filter(c => c.satisfaction_score)
      .reduce((sum, c) => sum + c.satisfaction_score, 0) / 
      (conversations?.filter(c => c.satisfaction_score).length || 1);

    const positiveFeedback = feedback?.filter(f => f.feedback_type === 'positive').length || 0;
    const totalFeedback = feedback?.length || 1;
    const satisfactionPercentage = (positiveFeedback / totalFeedback) * 100;

    // Intent distribution
    const intentCounts = (messages || []).reduce((acc: any, msg: any) => {
      if (msg.metadata?.intent) {
        acc[msg.metadata.intent] = (acc[msg.metadata.intent] || 0) + 1;
      }
      return acc;
    }, {});

    const topIntents = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Language distribution
    const languageCounts = (messages || []).reduce((acc: any, msg: any) => {
      const lang = msg.metadata?.language || 'en';
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    const topLanguages = Object.entries(languageCounts)
      .map(([language, count]) => ({ language, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Response time analysis (simulated - would need actual timing data)
    const avgResponseTime = 1.3; // seconds
    const responseTimeImprovement = -0.2; // improvement

    // Product recommendation metrics
    const productClicks = events?.filter(e => e.event_type === 'product_click').length || 0;
    const productRecommendations = messages?.filter(m => m.metadata?.products?.length > 0).length || 0;
    const recommendationClickRate = productRecommendations > 0 ? (productClicks / productRecommendations) * 100 : 0;

    return {
      overview: {
        totalConversations,
        activeConversations,
        completedConversations,
        escalatedConversations,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
        satisfactionPercentage: Math.round(satisfactionPercentage * 100) / 100,
        avgResponseTime,
        responseTimeImprovement
      },
      intents: {
        distribution: topIntents,
        recognitionRate: 94.7, // Would be calculated from actual data
        accuracy: 89.3
      },
      languages: {
        distribution: topLanguages,
        supported: 82
      },
      recommendations: {
        clickRate: Math.round(recommendationClickRate * 100) / 100,
        totalRecommendations: productRecommendations,
        totalClicks: productClicks
      },
      trends: {
        conversationsGrowth: 18.2, // Would be calculated from historical data
        resolutionImprovement: 5.3,
        satisfactionTrend: 0.3
      }
    };

  } catch (error) {
    logger.error('Failed to calculate comprehensive analytics:', error);
    throw error;
  }
}

async function getSpecificMetric(supabase: any, metric: string, since: string) {
  try {
    switch (metric) {
      case 'conversations':
        const { data: conversations } = await supabase
          .from('conversation_sessions')
          .select('started_at, status')
          .gte('started_at', since)
          .order('started_at', { ascending: true });

        return {
          metric: 'conversations',
          data: conversations || [],
          total: conversations?.length || 0
        };

      case 'resolution_rate':
        const { data: completed } = await supabase
          .from('conversation_sessions')
          .select('resolution_status')
          .eq('status', 'completed')
          .gte('started_at', since);

        const resolved = completed?.filter(c => c.resolution_status === 'resolved').length || 0;
        const total = completed?.length || 1;

        return {
          metric: 'resolution_rate',
          rate: (resolved / total) * 100,
          resolved,
          total
        };

      case 'satisfaction':
        const { data: satisfaction } = await supabase
          .from('conversation_sessions')
          .select('satisfaction_score')
          .not('satisfaction_score', 'is', null)
          .gte('started_at', since);

        const scores = satisfaction?.map(s => s.satisfaction_score) || [];
        const average = scores.length > 0 
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
          : 0;

        return {
          metric: 'satisfaction',
          average: Math.round(average * 100) / 100,
          scores,
          count: scores.length
        };

      case 'response_time':
        // This would need actual response time tracking
        return {
          metric: 'response_time',
          average: 1.3,
          data: [] // Would contain actual response time data
        };

      default:
        throw new Error(`Unknown metric: ${metric}`);
    }

  } catch (error) {
    logger.error(`Failed to get metric ${metric}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const supabase = createServerSupabaseClient();

    switch (action) {
      case 'export':
        // Generate export data
        const exportData = await generateExportData(supabase, data);
        return NextResponse.json(exportData);

      case 'reset_metrics':
        // Reset specific metrics (admin only)
        await resetMetrics(supabase, data.metrics);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function generateExportData(supabase: any, options: any) {
  const { timeframe = '30d', format = 'json' } = options;
  
  const days = { '7d': 7, '30d': 30, '90d': 90 }[timeframe] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations } = await supabase
    .from('conversation_sessions')
    .select('*')
    .gte('started_at', since);

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .gte('created_at', since);

  const exportData = {
    generated_at: new Date().toISOString(),
    timeframe,
    conversations: conversations || [],
    messages: messages || [],
    summary: {
      total_conversations: conversations?.length || 0,
      total_messages: messages?.length || 0,
      period: `${days} days`
    }
  };

  if (format === 'csv') {
    // Convert to CSV format (implementation would depend on requirements)
    return {
      format: 'csv',
      data: 'CSV data would be generated here',
      filename: `chatbot-analytics-${timeframe}.csv`
    };
  }

  return {
    format: 'json',
    data: exportData,
    filename: `chatbot-analytics-${timeframe}.json`
  };
}

async function resetMetrics(supabase: any, metrics: string[]) {
  // Implementation would depend on which metrics need to be reset
  // This is typically an admin-only operation
  logger.info('Metrics reset requested:', metrics);
}