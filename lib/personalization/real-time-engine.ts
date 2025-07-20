import { z } from 'zod';
import { EventEmitter } from 'events';
import { userProfiler } from './user-profiler';
import { behaviorTracker } from './behavior-tracker';
import { preferenceEngine } from './preference-engine';
import { contentPersonalizer } from './content-personalizer';

// Real-time schemas
export const RealTimeEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  eventType: z.enum([
    'page_view', 'product_view', 'add_to_cart', 'remove_from_cart',
    'search', 'filter_applied', 'recommendation_click', 'purchase_intent',
    'session_start', 'session_end', 'scroll_depth', 'time_on_page'
  ]),
  data: z.record(z.any()),
  context: z.object({
    page: z.string(),
    referrer: z.string().optional(),
    deviceType: z.enum(['desktop', 'mobile', 'tablet']),
    timestamp: z.date(),
    coordinates: z.object({
      x: z.number(),
      y: z.number()
    }).optional()
  }),
  metadata: z.record(z.any()).optional()
});

export type RealTimeEvent = z.infer<typeof RealTimeEventSchema>;

interface PersonalizationUpdate {
  userId: string;
  updateType: 'preferences' | 'recommendations' | 'content' | 'pricing';
  data: any;
  confidence: number;
  reason: string;
  timestamp: Date;
}

interface RealTimeRecommendation {
  id: string;
  productId: string;
  score: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  expiresAt: Date;
}

interface SessionContext {
  userId: string;
  sessionId: string;
  startTime: Date;
  currentPage: string;
  deviceType: string;
  events: RealTimeEvent[];
  intent: {
    type: 'browse' | 'search' | 'purchase' | 'compare';
    confidence: number;
    category?: string;
    products?: string[];
  };
  recommendations: RealTimeRecommendation[];
  personalization: {
    contentLayout?: any;
    pricingOffers?: any;
    notifications?: any[];
  };
}

export class RealTimeEngine extends EventEmitter {
  private static instance: RealTimeEngine;
  private sessions: Map<string, SessionContext> = new Map();
  private eventQueue: RealTimeEvent[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private recommendationCache: Map<string, RealTimeRecommendation[]> = new Map();
  private intentDetectors: Map<string, (events: RealTimeEvent[]) => any> = new Map();
  private performanceMetrics: Map<string, any> = new Map();

  static getInstance(): RealTimeEngine {
    if (!RealTimeEngine.instance) {
      RealTimeEngine.instance = new RealTimeEngine();
      RealTimeEngine.instance.initialize();
    }
    return RealTimeEngine.instance;
  }

  /**
   * Process real-time event and trigger personalization updates
   */
  async processEvent(event: RealTimeEvent): Promise<PersonalizationUpdate[]> {
    const startTime = Date.now();
    
    // Validate event
    const validatedEvent = RealTimeEventSchema.parse(event);
    
    // Update session context
    await this.updateSessionContext(validatedEvent);
    
    // Queue for batch processing
    this.eventQueue.push(validatedEvent);
    
    // Immediate processing for critical events
    const updates: PersonalizationUpdate[] = [];
    
    if (this.isCriticalEvent(validatedEvent)) {
      const criticalUpdates = await this.processCriticalEvent(validatedEvent);
      updates.push(...criticalUpdates);
    }

    // Update intent detection
    const intentUpdate = await this.updateUserIntent(validatedEvent);
    if (intentUpdate) updates.push(intentUpdate);

    // Generate real-time recommendations
    const recommendationUpdate = await this.updateRecommendations(validatedEvent);
    if (recommendationUpdate) updates.push(recommendationUpdate);

    // Emit updates for real-time UI updates
    updates.forEach(update => this.emit('personalization_update', update));

    // Track performance
    const processingTime = Date.now() - startTime;
    this.trackPerformance('event_processing', processingTime);

    return updates;
  }

  /**
   * Get real-time recommendations for current session
   */
  async getRealTimeRecommendations(
    userId: string,
    sessionId: string,
    context?: { page?: string; category?: string; limit?: number }
  ): Promise<RealTimeRecommendation[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const cacheKey = `${userId}:${sessionId}:${context?.page || 'default'}`;
    const cached = this.recommendationCache.get(cacheKey);
    
    // Return cached if still valid (30 seconds)
    if (cached && cached.length > 0 && cached[0].expiresAt > new Date()) {
      return cached.slice(0, context?.limit || 5);
    }

    // Generate fresh recommendations
    const recommendations = await this.generateSessionRecommendations(session, context);
    
    // Cache recommendations
    this.recommendationCache.set(cacheKey, recommendations);
    
    return recommendations.slice(0, context?.limit || 5);
  }

  /**
   * Get real-time personalized content
   */
  async getRealTimeContent(
    userId: string,
    sessionId: string,
    contentType: string,
    pageContext?: Record<string, any>
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Fallback to regular personalization
      return contentPersonalizer.personalizeContent({
        userId,
        contentType,
        context: pageContext
      });
    }

    // Use session context for enhanced personalization
    const enhancedContext = {
      ...pageContext,
      sessionIntent: session.intent,
      recentEvents: session.events.slice(-10),
      sessionDuration: Date.now() - session.startTime.getTime(),
      deviceType: session.deviceType
    };

    return contentPersonalizer.personalizeContent({
      userId,
      contentType,
      context: enhancedContext
    });
  }

  /**
   * Detect purchase intent in real-time
   */
  async detectPurchaseIntent(userId: string, sessionId: string): Promise<{
    intent: number; // 0-1 score
    signals: string[];
    urgency: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { intent: 0, signals: [], urgency: 'low', recommendations: [] };

    const signals: string[] = [];
    let intentScore = 0;

    // Analyze recent events
    const recentEvents = session.events.slice(-20);
    
    // Product view patterns
    const productViews = recentEvents.filter(e => e.eventType === 'product_view');
    if (productViews.length > 3) {
      intentScore += 0.3;
      signals.push('Multiple product views');
    }

    // Cart interactions
    const cartEvents = recentEvents.filter(e => e.eventType === 'add_to_cart');
    if (cartEvents.length > 0) {
      intentScore += 0.4;
      signals.push('Items added to cart');
    }

    // Search behavior
    const searchEvents = recentEvents.filter(e => e.eventType === 'search');
    if (searchEvents.length > 2) {
      intentScore += 0.2;
      signals.push('Active searching');
    }

    // Time spent on product pages
    const productPageTime = this.calculateProductPageTime(recentEvents);
    if (productPageTime > 120) { // 2 minutes
      intentScore += 0.2;
      signals.push('Extended product page engagement');
    }

    // Filter usage (indicates serious consideration)
    const filterEvents = recentEvents.filter(e => e.eventType === 'filter_applied');
    if (filterEvents.length > 1) {
      intentScore += 0.15;
      signals.push('Using filters to narrow choices');
    }

    // Recommendation clicks
    const recClicks = recentEvents.filter(e => e.eventType === 'recommendation_click');
    if (recClicks.length > 0) {
      intentScore += 0.1;
      signals.push('Engaging with recommendations');
    }

    // Normalize score
    intentScore = Math.min(1, intentScore);

    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (intentScore > 0.7) urgency = 'high';
    else if (intentScore > 0.4) urgency = 'medium';

    // Generate recommendations based on intent
    const recommendations = await this.generateIntentBasedRecommendations(session, intentScore);

    return {
      intent: intentScore,
      signals,
      urgency,
      recommendations
    };
  }

  /**
   * Trigger real-time price optimization
   */
  async optimizePriceRealTime(
    userId: string,
    productId: string,
    sessionId: string,
    currentPrice: number
  ): Promise<{
    optimizedPrice: number;
    discount?: number;
    reason: string;
    urgency: number;
    expiresAt: Date;
  }> {
    const session = this.sessions.get(sessionId);
    const intentData = await this.detectPurchaseIntent(userId, sessionId);
    
    let optimizedPrice = currentPrice;
    let discount = 0;
    let reason = 'Standard pricing';
    let urgency = 0;

    // High intent users - minimal discount to encourage purchase
    if (intentData.intent > 0.8) {
      discount = currentPrice * 0.05; // 5% discount
      reason = 'Limited time offer - complete your purchase now';
      urgency = 0.9;
    }
    
    // Medium intent - moderate incentive
    else if (intentData.intent > 0.5) {
      discount = currentPrice * 0.1; // 10% discount
      reason = 'Special discount just for you';
      urgency = 0.6;
    }
    
    // Low intent but extended session - retention offer
    else if (session && Date.now() - session.startTime.getTime() > 600000) { // 10 minutes
      discount = currentPrice * 0.15; // 15% discount
      reason = 'Extended browsing reward';
      urgency = 0.4;
    }

    // Cart abandonment risk (multiple cart events but no purchase)
    const cartEvents = session?.events.filter(e => e.eventType === 'add_to_cart') || [];
    if (cartEvents.length > 1 && intentData.intent < 0.3) {
      discount = currentPrice * 0.2; // 20% discount
      reason = 'Don\'t miss out - special cart recovery offer';
      urgency = 0.8;
    }

    optimizedPrice = currentPrice - discount;

    return {
      optimizedPrice,
      discount: discount > 0 ? discount : undefined,
      reason,
      urgency,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };
  }

  /**
   * Get real-time session analytics
   */
  getSessionAnalytics(sessionId: string): SessionContext | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Start monitoring a user session
   */
  async startSession(userId: string, deviceType: string, initialPage: string): Promise<string> {
    const sessionId = this.generateSessionId();
    
    const session: SessionContext = {
      userId,
      sessionId,
      startTime: new Date(),
      currentPage: initialPage,
      deviceType,
      events: [],
      intent: {
        type: 'browse',
        confidence: 0.5
      },
      recommendations: [],
      personalization: {}
    };

    this.sessions.set(sessionId, session);
    
    // Initialize with user's historical preferences
    await this.initializeSessionPersonalization(session);
    
    this.emit('session_started', { userId, sessionId, deviceType });
    
    return sessionId;
  }

  /**
   * End user session and save learnings
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Process final learnings
    await this.processSessionLearnings(session);
    
    // Clean up
    this.sessions.delete(sessionId);
    this.recommendationCache.forEach((_, key) => {
      if (key.includes(sessionId)) {
        this.recommendationCache.delete(key);
      }
    });

    this.emit('session_ended', { 
      userId: session.userId, 
      sessionId, 
      duration: Date.now() - session.startTime.getTime() 
    });
  }

  // Private methods

  private initialize(): void {
    // Initialize intent detectors
    this.initializeIntentDetectors();
    
    // Start background processing
    this.startBackgroundProcessing();
    
    // Setup performance monitoring
    this.setupPerformanceMonitoring();
  }

  private initializeIntentDetectors(): void {
    // Browse intent detector
    this.intentDetectors.set('browse', (events) => {
      const pageViews = events.filter(e => e.eventType === 'page_view').length;
      return {
        type: 'browse',
        confidence: Math.min(1, pageViews / 5)
      };
    });

    // Search intent detector
    this.intentDetectors.set('search', (events) => {
      const searches = events.filter(e => e.eventType === 'search').length;
      return {
        type: 'search',
        confidence: Math.min(1, searches / 3)
      };
    });

    // Purchase intent detector
    this.intentDetectors.set('purchase', (events) => {
      const cartEvents = events.filter(e => e.eventType === 'add_to_cart').length;
      const productViews = events.filter(e => e.eventType === 'product_view').length;
      
      const confidence = Math.min(1, (cartEvents * 0.6) + (productViews * 0.1));
      return {
        type: 'purchase',
        confidence
      };
    });

    // Compare intent detector
    this.intentDetectors.set('compare', (events) => {
      const productViews = events.filter(e => e.eventType === 'product_view');
      const uniqueProducts = new Set(productViews.map(e => e.data.productId)).size;
      
      return {
        type: 'compare',
        confidence: Math.min(1, uniqueProducts / 4)
      };
    });
  }

  private startBackgroundProcessing(): void {
    this.processingInterval = setInterval(async () => {
      // Process queued events
      if (this.eventQueue.length > 0) {
        const events = this.eventQueue.splice(0, 100);
        await this.processBatchEvents(events);
      }

      // Clean up expired sessions (1 hour timeout)
      this.cleanupExpiredSessions();
      
      // Update recommendations for active sessions
      await this.updateActiveSessionRecommendations();
      
    }, 5000); // Every 5 seconds
  }

  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = {
        activeSessions: this.sessions.size,
        queueLength: this.eventQueue.length,
        cacheSize: this.recommendationCache.size,
        avgProcessingTime: this.getAverageProcessingTime()
      };

      this.emit('performance_metrics', metrics);
    }, 30000); // Every 30 seconds
  }

  private async updateSessionContext(event: RealTimeEvent): Promise<void> {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    // Add event to session
    session.events.push(event);
    
    // Update current page
    if (event.eventType === 'page_view') {
      session.currentPage = event.context.page;
    }

    // Limit event history to last 100 events for performance
    if (session.events.length > 100) {
      session.events = session.events.slice(-100);
    }

    // Update session in map
    this.sessions.set(event.sessionId, session);
  }

  private isCriticalEvent(event: RealTimeEvent): boolean {
    return [
      'add_to_cart',
      'remove_from_cart',
      'purchase_intent',
      'recommendation_click'
    ].includes(event.eventType);
  }

  private async processCriticalEvent(event: RealTimeEvent): Promise<PersonalizationUpdate[]> {
    const updates: PersonalizationUpdate[] = [];

    switch (event.eventType) {
      case 'add_to_cart':
        // Update preferences based on cart addition
        await preferenceEngine.learnFromSignal({
          userId: event.userId,
          signal: 'positive',
          strength: 0.8,
          context: {},
          productId: event.data.productId,
          timestamp: new Date()
        });

        updates.push({
          userId: event.userId,
          updateType: 'preferences',
          data: { productId: event.data.productId, action: 'positive_signal' },
          confidence: 0.8,
          reason: 'Added to cart',
          timestamp: new Date()
        });
        break;

      case 'recommendation_click':
        // Learn from recommendation interaction
        await contentPersonalizer.trackInteraction(
          event.data.contentId,
          event.userId,
          'click',
          event.data
        );

        updates.push({
          userId: event.userId,
          updateType: 'recommendations',
          data: { contentId: event.data.contentId, interaction: 'click' },
          confidence: 0.7,
          reason: 'Clicked recommendation',
          timestamp: new Date()
        });
        break;
    }

    return updates;
  }

  private async updateUserIntent(event: RealTimeEvent): Promise<PersonalizationUpdate | null> {
    const session = this.sessions.get(event.sessionId);
    if (!session) return null;

    // Run all intent detectors
    const intents = Array.from(this.intentDetectors.entries()).map(([type, detector]) => ({
      type,
      ...detector(session.events)
    }));

    // Find highest confidence intent
    const topIntent = intents.reduce((max, current) => 
      current.confidence > max.confidence ? current : max
    );

    // Update session intent if significantly different
    if (Math.abs(topIntent.confidence - session.intent.confidence) > 0.2) {
      session.intent = {
        type: topIntent.type as any,
        confidence: topIntent.confidence,
        category: this.inferIntentCategory(session.events),
        products: this.inferIntentProducts(session.events)
      };

      this.sessions.set(event.sessionId, session);

      return {
        userId: event.userId,
        updateType: 'content',
        data: { intent: session.intent },
        confidence: topIntent.confidence,
        reason: `Intent changed to ${topIntent.type}`,
        timestamp: new Date()
      };
    }

    return null;
  }

  private async updateRecommendations(event: RealTimeEvent): Promise<PersonalizationUpdate | null> {
    // Only update recommendations for certain events
    if (!['product_view', 'add_to_cart', 'search'].includes(event.eventType)) {
      return null;
    }

    const session = this.sessions.get(event.sessionId);
    if (!session) return null;

    // Generate new recommendations based on latest activity
    const recommendations = await this.generateSessionRecommendations(session);
    
    // Update session recommendations
    session.recommendations = recommendations;
    this.sessions.set(event.sessionId, session);

    return {
      userId: event.userId,
      updateType: 'recommendations',
      data: { recommendations: recommendations.slice(0, 5) },
      confidence: 0.8,
      reason: `Updated based on ${event.eventType}`,
      timestamp: new Date()
    };
  }

  private async generateSessionRecommendations(
    session: SessionContext,
    context?: { page?: string; category?: string; limit?: number }
  ): Promise<RealTimeRecommendation[]> {
    // Get base recommendations
    const baseRecs = await preferenceEngine.getPersonalizedRecommendations(
      session.userId,
      {
        limit: 20,
        categories: context?.category ? [context.category] : undefined,
        context: {
          deviceType: session.deviceType as any,
          timeOfDay: this.getTimeOfDay()
        }
      }
    );

    // Enhance with session context
    const enhancedRecs = baseRecs.map(rec => {
      let urgency: 'low' | 'medium' | 'high' = 'low';
      
      // Increase urgency based on session intent
      if (session.intent.type === 'purchase' && session.intent.confidence > 0.7) {
        urgency = 'high';
      } else if (session.intent.type === 'compare' && session.intent.confidence > 0.6) {
        urgency = 'medium';
      }

      return {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: rec.productId,
        score: rec.score,
        reason: rec.reasons[0] || 'Recommended for you',
        urgency,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };
    });

    return enhancedRecs;
  }

  private calculateProductPageTime(events: RealTimeEvent[]): number {
    let totalTime = 0;
    let lastProductView: RealTimeEvent | null = null;

    events.forEach(event => {
      if (event.eventType === 'product_view') {
        lastProductView = event;
      } else if (lastProductView && event.eventType === 'page_view') {
        // Calculate time between product view and next page view
        const timeDiff = event.context.timestamp.getTime() - lastProductView.context.timestamp.getTime();
        totalTime += timeDiff / 1000; // Convert to seconds
        lastProductView = null;
      }
    });

    return totalTime;
  }

  private async generateIntentBasedRecommendations(
    session: SessionContext,
    intentScore: number
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (intentScore > 0.7) {
      recommendations.push('Complete your purchase now - limited time offer');
      recommendations.push('Free shipping on orders over $50');
      recommendations.push('Save your cart for later');
    } else if (intentScore > 0.4) {
      recommendations.push('Similar products you might like');
      recommendations.push('Customers also bought these items');
      recommendations.push('Compare similar products');
    } else {
      recommendations.push('Explore new arrivals');
      recommendations.push('Trending in your favorite categories');
      recommendations.push('Personalized picks for you');
    }

    return recommendations;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeSessionPersonalization(session: SessionContext): Promise<void> {
    // Get user's preferences to pre-populate session
    const preferences = await preferenceEngine.getUserPreferences(session.userId);
    
    // Set initial intent based on entry page
    if (session.currentPage.includes('/search')) {
      session.intent = { type: 'search', confidence: 0.7 };
    } else if (session.currentPage.includes('/product/')) {
      session.intent = { type: 'browse', confidence: 0.6 };
    }

    // Pre-generate initial recommendations
    session.recommendations = await this.generateSessionRecommendations(session);
  }

  private async processSessionLearnings(session: SessionContext): Promise<void> {
    // Analyze session patterns and update user profile
    const sessionDuration = Date.now() - session.startTime.getTime();
    const engagementScore = this.calculateSessionEngagement(session);

    // Update behavior tracker with session data
    await behaviorTracker.track({
      userId: session.userId,
      eventType: 'session_end',
      eventData: {
        duration: sessionDuration,
        engagementScore,
        intent: session.intent,
        events: session.events.length
      },
      timestamp: new Date()
    });
  }

  private calculateSessionEngagement(session: SessionContext): number {
    const duration = Date.now() - session.startTime.getTime();
    const events = session.events.length;
    
    // Simple engagement calculation
    const durationScore = Math.min(1, duration / (30 * 60 * 1000)); // 30 minutes max
    const eventScore = Math.min(1, events / 50); // 50 events max
    
    return (durationScore + eventScore) / 2;
  }

  private inferIntentCategory(events: RealTimeEvent[]): string | undefined {
    const categoryViews = new Map<string, number>();
    
    events.forEach(event => {
      if (event.data.category) {
        categoryViews.set(event.data.category, (categoryViews.get(event.data.category) || 0) + 1);
      }
    });

    if (categoryViews.size === 0) return undefined;

    // Return most viewed category
    return Array.from(categoryViews.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  private inferIntentProducts(events: RealTimeEvent[]): string[] {
    const productViews = new Set<string>();
    
    events.forEach(event => {
      if (event.data.productId) {
        productViews.add(event.data.productId);
      }
    });

    return Array.from(productViews);
  }

  private async processBatchEvents(events: RealTimeEvent[]): Promise<void> {
    // Group events by user for efficient processing
    const userEvents = new Map<string, RealTimeEvent[]>();
    
    events.forEach(event => {
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId)!.push(event);
    });

    // Process each user's events
    for (const [userId, userEventList] of userEvents.entries()) {
      await this.processUserEvents(userId, userEventList);
    }
  }

  private async processUserEvents(userId: string, events: RealTimeEvent[]): Promise<void> {
    // Batch learning signals
    const signals = events.map(event => ({
      userId,
      signal: 'positive' as const,
      strength: 0.5,
      context: {},
      productId: event.data.productId,
      category: event.data.category,
      timestamp: event.context.timestamp
    })).filter(signal => signal.productId || signal.category);

    // Send to preference engine
    for (const signal of signals) {
      await preferenceEngine.learnFromSignal(signal);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const sessionTimeout = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startTime.getTime() > sessionTimeout) {
        this.endSession(sessionId);
      }
    }
  }

  private async updateActiveSessionRecommendations(): Promise<void> {
    // Update recommendations for active sessions periodically
    for (const [sessionId, session] of this.sessions.entries()) {
      // Only update if session has recent activity
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && Date.now() - lastEvent.context.timestamp.getTime() < 5 * 60 * 1000) {
        const recommendations = await this.generateSessionRecommendations(session);
        session.recommendations = recommendations;
        this.sessions.set(sessionId, session);
      }
    }
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private trackPerformance(metric: string, value: number): void {
    const metrics = this.performanceMetrics.get(metric) || [];
    metrics.push(value);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
    
    this.performanceMetrics.set(metric, metrics);
  }

  private getAverageProcessingTime(): number {
    const metrics = this.performanceMetrics.get('event_processing') || [];
    if (metrics.length === 0) return 0;
    
    return metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
  }
}

export const realTimeEngine = RealTimeEngine.getInstance();