import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    // Basic health checks
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: await checkDatabase(),
        redis: await checkRedis(),
        external_apis: await checkExternalAPIs(),
      },
    };

    // Determine overall health status
    const hasUnhealthyCheck = Object.values(healthChecks.checks).some(
      (check) => check.status !== 'healthy'
    );

    if (hasUnhealthyCheck) {
      return NextResponse.json(
        { ...healthChecks, status: 'unhealthy' },
        { status: 503 }
      );
    }

    return NextResponse.json(healthChecks, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function checkDatabase() {
  try {
    // Import Supabase client
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    
    // Simple database connectivity check
    const { error } = await supabase.from('profiles').select('id').limit(1);
    
    return {
      status: error ? 'unhealthy' : 'healthy',
      message: error ? error.message : 'Database connection successful',
      response_time: Date.now(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database check failed',
      response_time: Date.now(),
    };
  }
}

async function checkRedis() {
  try {
    if (!process.env.REDIS_HOST) {
      return {
        status: 'skipped',
        message: 'Redis not configured',
        response_time: Date.now(),
      };
    }

    // Import Redis client if available
    const Redis = await import('ioredis').catch(() => null);
    if (!Redis) {
      return {
        status: 'skipped',
        message: 'Redis client not available',
        response_time: Date.now(),
      };
    }

    const redis = new Redis.default({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
    });

    const start = Date.now();
    await redis.ping();
    const response_time = Date.now() - start;
    
    redis.disconnect();

    return {
      status: 'healthy',
      message: 'Redis connection successful',
      response_time,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Redis check failed',
      response_time: Date.now(),
    };
  }
}

async function checkExternalAPIs() {
  const checks = {
    openai: await checkOpenAI(),
    shopify: await checkShopify(),
  };

  const hasUnhealthy = Object.values(checks).some(
    (check) => check.status === 'unhealthy'
  );

  return {
    status: hasUnhealthy ? 'degraded' : 'healthy',
    message: hasUnhealthy ? 'Some external APIs are unhealthy' : 'All external APIs healthy',
    details: checks,
  };
}

async function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        status: 'skipped',
        message: 'OpenAI API key not configured',
      };
    }

    // Simple API key validation (without making a costly request)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey.startsWith('sk-')) {
      return {
        status: 'unhealthy',
        message: 'Invalid OpenAI API key format',
      };
    }

    return {
      status: 'healthy',
      message: 'OpenAI API key configured',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'OpenAI check failed',
    };
  }
}

async function checkShopify() {
  try {
    if (!process.env.SHOPIFY_APP_API_KEY || !process.env.SHOPIFY_APP_API_SECRET) {
      return {
        status: 'skipped',
        message: 'Shopify API credentials not configured',
      };
    }

    return {
      status: 'healthy',
      message: 'Shopify API credentials configured',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Shopify check failed',
    };
  }
}