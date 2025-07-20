/**
 * Centralized API Gateway
 * Manages routing, authentication, rate limiting, and monitoring for all API requests
 */

import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface APIRoute {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  target: {
    type: 'connector' | 'service' | 'webhook';
    id: string;
    endpoint?: string;
  };
  auth: {
    required: boolean;
    methods: ('api_key' | 'bearer' | 'oauth2' | 'basic')[];
    scopes?: string[];
  };
  rateLimit?: {
    requests: number;
    window: number;
    burst?: number;
    byUser?: boolean;
    byOrganization?: boolean;
  };
  validation?: {
    headers?: z.ZodSchema;
    query?: z.ZodSchema;
    body?: z.ZodSchema;
  };
  transformation?: {
    request?: any;
    response?: any;
  };
  caching?: {
    enabled: boolean;
    ttl: number;
    keyPattern?: string;
  };
  monitoring: {
    metrics: boolean;
    logging: boolean;
    tracing: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIRequest {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, any>;
  body?: any;
  user?: {
    id: string;
    organizationId: string;
    scopes: string[];
  };
  metadata: {
    clientIP: string;
    userAgent: string;
    timestamp: Date;
    traceId: string;
  };
}

export interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  metadata: {
    processingTime: number;
    cacheHit?: boolean;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export interface APIMetrics {
  routeId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  error?: string;
}

export class APIGateway extends EventEmitter {
  private routes: Map<string, APIRoute> = new Map();
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private metrics: APIMetrics[] = [];

  constructor() {
    super();
    this.setupCleanupTasks();
  }

  // Route management
  registerRoute(route: Omit<APIRoute, 'id' | 'createdAt' | 'updatedAt'>): APIRoute {
    const apiRoute: APIRoute = {
      ...route,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Generate route key for lookup
    const routeKey = this.generateRouteKey(route.method, route.path);
    this.routes.set(routeKey, apiRoute);

    this.emit('route:registered', apiRoute);
    return apiRoute;
  }

  updateRoute(id: string, updates: Partial<APIRoute>): APIRoute | null {
    // Find route by ID
    const existingRoute = Array.from(this.routes.values()).find(r => r.id === id);
    if (!existingRoute) return null;

    // Remove old route
    const oldKey = this.generateRouteKey(existingRoute.method, existingRoute.path);
    this.routes.delete(oldKey);

    // Create updated route
    const updatedRoute = {
      ...existingRoute,
      ...updates,
      updatedAt: new Date()
    };

    // Add updated route
    const newKey = this.generateRouteKey(updatedRoute.method, updatedRoute.path);
    this.routes.set(newKey, updatedRoute);

    this.emit('route:updated', updatedRoute);
    return updatedRoute;
  }

  deleteRoute(id: string): boolean {
    const route = Array.from(this.routes.values()).find(r => r.id === id);
    if (!route) return false;

    const routeKey = this.generateRouteKey(route.method, route.path);
    this.routes.delete(routeKey);

    this.emit('route:deleted', route);
    return true;
  }

  private generateRouteKey(method: string, path: string): string {
    return `${method}:${path}`;
  }

  // Request processing
  async processRequest(request: APIRequest): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      // Find matching route
      const route = this.findMatchingRoute(request.method, request.path);
      if (!route) {
        return this.createErrorResponse(404, 'Route not found');
      }

      if (!route.isActive) {
        return this.createErrorResponse(503, 'Route is disabled');
      }

      // Validate authentication
      if (route.auth.required) {
        const authResult = await this.validateAuthentication(request, route);
        if (!authResult.success) {
          return this.createErrorResponse(401, authResult.error || 'Authentication failed');
        }
        request.user = authResult.user;
      }

      // Check rate limits
      const rateLimitResult = await this.checkRateLimit(request, route);
      if (!rateLimitResult.allowed) {
        return this.createErrorResponse(429, 'Rate limit exceeded', {
          'X-Rate-Limit-Remaining': '0',
          'X-Rate-Limit-Reset': rateLimitResult.resetTime?.toISOString() || ''
        });
      }

      // Validate request
      const validationResult = this.validateRequest(request, route);
      if (!validationResult.success) {
        return this.createErrorResponse(400, 'Validation failed', {}, validationResult.errors);
      }

      // Check cache
      if (route.caching?.enabled && request.method === 'GET') {
        const cachedResponse = this.getCachedResponse(request, route);
        if (cachedResponse) {
          return this.addMetadata(cachedResponse, startTime, { cacheHit: true });
        }
      }

      // Transform request if needed
      const transformedRequest = this.transformRequest(request, route);

      // Route to target
      const response = await this.routeToTarget(transformedRequest, route);

      // Transform response if needed
      const transformedResponse = this.transformResponse(response, route);

      // Cache response if applicable
      if (route.caching?.enabled && request.method === 'GET' && response.statusCode < 400) {
        this.cacheResponse(request, route, transformedResponse);
      }

      // Add metadata
      const finalResponse = this.addMetadata(transformedResponse, startTime, {
        rateLimitRemaining: rateLimitResult.remaining
      });

      // Record metrics
      this.recordMetrics(request, route, finalResponse, startTime);

      return finalResponse;

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        500, 
        'Internal server error',
        {},
        error instanceof Error ? error.message : 'Unknown error'
      );

      this.recordMetrics(request, null, errorResponse, startTime, error);
      return errorResponse;
    }
  }

  private findMatchingRoute(method: string, path: string): APIRoute | null {
    // First try exact match
    const exactKey = this.generateRouteKey(method, path);
    const exactMatch = this.routes.get(exactKey);
    if (exactMatch) return exactMatch;

    // Try pattern matching for parameterized routes
    for (const [routeKey, route] of this.routes) {
      if (route.method !== method) continue;
      
      if (this.matchesPattern(path, route.path)) {
        return route;
      }
    }

    return null;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Convert pattern like /users/:id to regex
    const regexPattern = pattern
      .replace(/:[^/]+/g, '([^/]+)')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  // Authentication
  private async validateAuthentication(
    request: APIRequest, 
    route: APIRoute
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return { success: false, error: 'Missing authorization header' };
    }

    // Extract auth method and token
    const [method, token] = authHeader.split(' ');
    const authMethod = method.toLowerCase();

    if (!route.auth.methods.includes(authMethod as any)) {
      return { success: false, error: 'Unsupported authentication method' };
    }

    // Validate token based on method
    switch (authMethod) {
      case 'bearer':
        return this.validateBearerToken(token, route);
      case 'api_key':
        return this.validateApiKey(token, route);
      case 'basic':
        return this.validateBasicAuth(token, route);
      default:
        return { success: false, error: 'Invalid authentication method' };
    }
  }

  private async validateBearerToken(
    token: string, 
    route: APIRoute
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    // This would integrate with your JWT validation or OAuth2 provider
    // For now, return a mock validation
    try {
      // Decode and validate JWT token
      // const payload = jwt.verify(token, process.env.JWT_SECRET);
      // return { success: true, user: payload };
      
      return { 
        success: true, 
        user: { 
          id: 'user-123', 
          organizationId: 'org-456', 
          scopes: ['read', 'write'] 
        } 
      };
    } catch (error) {
      return { success: false, error: 'Invalid token' };
    }
  }

  private async validateApiKey(
    apiKey: string, 
    route: APIRoute
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    // Validate API key against database
    // This would query your API key store
    return { 
      success: true, 
      user: { 
        id: 'api-user-123', 
        organizationId: 'org-456', 
        scopes: ['read'] 
      } 
    };
  }

  private async validateBasicAuth(
    credentials: string, 
    route: APIRoute
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const decoded = Buffer.from(credentials, 'base64').toString();
      const [username, password] = decoded.split(':');
      
      // Validate username/password
      // This would check against your user store
      return { 
        success: true, 
        user: { 
          id: username, 
          organizationId: 'org-456', 
          scopes: ['read'] 
        } 
      };
    } catch (error) {
      return { success: false, error: 'Invalid credentials' };
    }
  }

  // Rate limiting
  private async checkRateLimit(
    request: APIRequest, 
    route: APIRoute
  ): Promise<{ allowed: boolean; remaining?: number; resetTime?: Date }> {
    if (!route.rateLimit) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowMs = route.rateLimit.window * 1000;
    
    // Generate rate limit key
    let rateLimitKey = `${route.id}:${request.metadata.clientIP}`;
    
    if (route.rateLimit.byUser && request.user) {
      rateLimitKey = `${route.id}:user:${request.user.id}`;
    } else if (route.rateLimit.byOrganization && request.user) {
      rateLimitKey = `${route.id}:org:${request.user.organizationId}`;
    }

    // Get current rate limit data
    const current = this.rateLimitStore.get(rateLimitKey);
    
    if (!current || current.resetTime <= now) {
      // Start new window
      this.rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: now + windowMs
      });
      
      return {
        allowed: true,
        remaining: route.rateLimit.requests - 1,
        resetTime: new Date(now + windowMs)
      };
    }

    if (current.count >= route.rateLimit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(current.resetTime)
      };
    }

    // Increment counter
    current.count++;
    this.rateLimitStore.set(rateLimitKey, current);

    return {
      allowed: true,
      remaining: route.rateLimit.requests - current.count,
      resetTime: new Date(current.resetTime)
    };
  }

  // Request validation
  private validateRequest(
    request: APIRequest, 
    route: APIRoute
  ): { success: boolean; errors?: any } {
    const errors: any = {};

    try {
      if (route.validation?.headers) {
        route.validation.headers.parse(request.headers);
      }

      if (route.validation?.query) {
        route.validation.query.parse(request.query);
      }

      if (route.validation?.body && request.body) {
        route.validation.body.parse(request.body);
      }

      return { success: true };
    } catch (error) {
      return { success: false, errors: error };
    }
  }

  // Caching
  private getCachedResponse(request: APIRequest, route: APIRoute): APIResponse | null {
    const cacheKey = this.generateCacheKey(request, route);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private cacheResponse(request: APIRequest, route: APIRoute, response: APIResponse): void {
    const cacheKey = this.generateCacheKey(request, route);
    const ttlMs = (route.caching?.ttl || 300) * 1000;
    
    this.cache.set(cacheKey, {
      data: response,
      expiry: Date.now() + ttlMs
    });
  }

  private generateCacheKey(request: APIRequest, route: APIRoute): string {
    if (route.caching?.keyPattern) {
      // Use custom pattern
      return route.caching.keyPattern
        .replace('{path}', request.path)
        .replace('{query}', JSON.stringify(request.query))
        .replace('{user}', request.user?.id || 'anonymous');
    }

    return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  // Request/Response transformation
  private transformRequest(request: APIRequest, route: APIRoute): APIRequest {
    if (!route.transformation?.request) return request;
    
    // Apply request transformations
    // This would be configurable transformation logic
    return request;
  }

  private transformResponse(response: APIResponse, route: APIRoute): APIResponse {
    if (!route.transformation?.response) return response;
    
    // Apply response transformations
    // This would be configurable transformation logic
    return response;
  }

  // Target routing
  private async routeToTarget(request: APIRequest, route: APIRoute): Promise<APIResponse> {
    switch (route.target.type) {
      case 'connector':
        return this.routeToConnector(request, route);
      case 'service':
        return this.routeToService(request, route);
      case 'webhook':
        return this.routeToWebhook(request, route);
      default:
        throw new Error(`Unknown target type: ${route.target.type}`);
    }
  }

  private async routeToConnector(request: APIRequest, route: APIRoute): Promise<APIResponse> {
    // This would integrate with the connector framework
    // For now, return a mock response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Routed to connector', connectorId: route.target.id },
      metadata: { processingTime: 0 }
    };
  }

  private async routeToService(request: APIRequest, route: APIRoute): Promise<APIResponse> {
    // This would route to internal services
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Routed to service', serviceId: route.target.id },
      metadata: { processingTime: 0 }
    };
  }

  private async routeToWebhook(request: APIRequest, route: APIRoute): Promise<APIResponse> {
    // This would trigger webhook processing
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Webhook triggered', webhookId: route.target.id },
      metadata: { processingTime: 0 }
    };
  }

  // Utility methods
  private createErrorResponse(
    statusCode: number, 
    message: string, 
    headers: Record<string, string> = {},
    details?: any
  ): APIResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: {
        error: {
          code: statusCode,
          message,
          details
        }
      },
      metadata: { processingTime: 0 }
    };
  }

  private addMetadata(
    response: APIResponse, 
    startTime: number, 
    additionalMetadata: any = {}
  ): APIResponse {
    response.metadata = {
      ...response.metadata,
      processingTime: Date.now() - startTime,
      ...additionalMetadata
    };

    // Add timing headers
    response.headers['X-Response-Time'] = `${response.metadata.processingTime}ms`;
    
    if (additionalMetadata.rateLimitRemaining !== undefined) {
      response.headers['X-Rate-Limit-Remaining'] = String(additionalMetadata.rateLimitRemaining);
    }

    return response;
  }

  // Metrics and monitoring
  private recordMetrics(
    request: APIRequest, 
    route: APIRoute | null, 
    response: APIResponse, 
    startTime: number,
    error?: any
  ): void {
    if (!route?.monitoring.metrics) return;

    const metric: APIMetrics = {
      routeId: route?.id || 'unknown',
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      responseTime: Date.now() - startTime,
      requestSize: JSON.stringify(request).length,
      responseSize: JSON.stringify(response.body).length,
      timestamp: new Date(),
      userId: request.user?.id,
      organizationId: request.user?.organizationId,
      error: error ? (error instanceof Error ? error.message : String(error)) : undefined
    };

    this.metrics.push(metric);
    this.emit('metrics:recorded', metric);

    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(filter?: {
    routeId?: string;
    userId?: string;
    organizationId?: string;
    startTime?: Date;
    endTime?: Date;
  }): APIMetrics[] {
    let filteredMetrics = this.metrics;

    if (filter) {
      filteredMetrics = this.metrics.filter(metric => {
        if (filter.routeId && metric.routeId !== filter.routeId) return false;
        if (filter.userId && metric.userId !== filter.userId) return false;
        if (filter.organizationId && metric.organizationId !== filter.organizationId) return false;
        if (filter.startTime && metric.timestamp < filter.startTime) return false;
        if (filter.endTime && metric.timestamp > filter.endTime) return false;
        return true;
      });
    }

    return filteredMetrics;
  }

  // Cleanup tasks
  private setupCleanupTasks(): void {
    // Clean rate limit store every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitStore) {
        if (data.resetTime <= now) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 3600000);

    // Clean cache every 10 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.cache) {
        if (data.expiry <= now) {
          this.cache.delete(key);
        }
      }
    }, 600000);
  }
}

export default new APIGateway();