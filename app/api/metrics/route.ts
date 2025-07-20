import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if metrics are enabled
    if (process.env.METRICS_ENDPOINT_ENABLED !== 'true') {
      return NextResponse.json(
        { error: 'Metrics endpoint disabled' },
        { status: 404 }
      );
    }

    // Basic authentication check (in production, use proper auth)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !isValidAuthToken(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const metrics = await collectMetrics();
    
    // Return in Prometheus format if requested
    const accept = request.headers.get('accept');
    if (accept?.includes('text/plain')) {
      return new NextResponse(formatPrometheusMetrics(metrics), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to collect metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function isValidAuthToken(authHeader: string): boolean {
  // Simple token validation - in production, use proper JWT or API key validation
  const token = authHeader.replace('Bearer ', '');
  return token === process.env.METRICS_API_TOKEN || token === 'development-token';
}

async function collectMetrics() {
  const now = Date.now();
  
  return {
    timestamp: new Date().toISOString(),
    application: {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'mercury',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: process.uptime(),
    },
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
    },
    performance: await getPerformanceMetrics(),
    database: await getDatabaseMetrics(),
    api: await getAPIMetrics(),
    features: getFeatureMetrics(),
  };
}

async function getPerformanceMetrics() {
  return {
    gc: process.memoryUsage(),
    event_loop_lag: getEventLoopLag(),
    active_handles: process._getActiveHandles?.()?.length || 0,
    active_requests: process._getActiveRequests?.()?.length || 0,
  };
}

function getEventLoopLag(): number {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
      resolve(lag);
    });
  }) as any; // Type assertion for simplicity
}

async function getDatabaseMetrics() {
  try {
    // These would be actual database connection pool metrics in production
    return {
      connections_active: 5,
      connections_idle: 10,
      connections_total: 15,
      queries_total: 1250,
      queries_per_second: 2.5,
      average_query_time_ms: 45,
    };
  } catch {
    return {
      error: 'Database metrics unavailable',
    };
  }
}

async function getAPIMetrics() {
  // In production, these would come from actual request tracking
  return {
    requests_total: 5430,
    requests_per_minute: 12,
    response_time_avg_ms: 120,
    response_time_p95_ms: 250,
    response_time_p99_ms: 500,
    error_rate_percent: 0.5,
    endpoints: {
      '/api/ai/recommendations': { requests: 1200, avg_time: 180 },
      '/api/shopify/products': { requests: 890, avg_time: 95 },
      '/api/analytics/dashboard': { requests: 670, avg_time: 140 },
    },
  };
}

function getFeatureMetrics() {
  return {
    ai_recommendations_enabled: process.env.ENABLE_AI_RECOMMENDATIONS === 'true',
    ai_chatbot_enabled: process.env.ENABLE_AI_CHATBOT === 'true',
    multi_store_enabled: process.env.ENABLE_MULTI_STORE === 'true',
    rbac_enabled: process.env.ENABLE_RBAC === 'true',
    experimental_features_enabled: process.env.ENABLE_EXPERIMENTAL_FEATURES === 'true',
  };
}

function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = [];
  
  // Application metrics
  lines.push('# HELP mercury_uptime_seconds Application uptime in seconds');
  lines.push('# TYPE mercury_uptime_seconds counter');
  lines.push(`mercury_uptime_seconds ${metrics.application.uptime_seconds}`);
  
  // Memory metrics
  lines.push('# HELP mercury_memory_usage_bytes Memory usage in bytes');
  lines.push('# TYPE mercury_memory_usage_bytes gauge');
  lines.push(`mercury_memory_usage_bytes{type="rss"} ${metrics.system.memory.rss}`);
  lines.push(`mercury_memory_usage_bytes{type="heapTotal"} ${metrics.system.memory.heapTotal}`);
  lines.push(`mercury_memory_usage_bytes{type="heapUsed"} ${metrics.system.memory.heapUsed}`);
  lines.push(`mercury_memory_usage_bytes{type="external"} ${metrics.system.memory.external}`);
  
  // API metrics
  lines.push('# HELP mercury_http_requests_total Total number of HTTP requests');
  lines.push('# TYPE mercury_http_requests_total counter');
  lines.push(`mercury_http_requests_total ${metrics.api.requests_total}`);
  
  lines.push('# HELP mercury_http_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE mercury_http_request_duration_ms histogram');
  lines.push(`mercury_http_request_duration_ms_average ${metrics.api.response_time_avg_ms}`);
  lines.push(`mercury_http_request_duration_ms_p95 ${metrics.api.response_time_p95_ms}`);
  lines.push(`mercury_http_request_duration_ms_p99 ${metrics.api.response_time_p99_ms}`);
  
  // Feature flags
  lines.push('# HELP mercury_feature_enabled Feature flag status');
  lines.push('# TYPE mercury_feature_enabled gauge');
  Object.entries(metrics.features).forEach(([feature, enabled]) => {
    lines.push(`mercury_feature_enabled{feature="${feature}"} ${enabled ? 1 : 0}`);
  });
  
  return lines.join('\n') + '\n';
}