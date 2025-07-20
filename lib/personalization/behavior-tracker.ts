import { prisma } from '@/lib/prisma';
import { userProfiler } from './user-profiler';

interface TrackingEvent {
  userId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

interface BehaviorPattern {
  pattern: string;
  frequency: number;
  confidence: number;
  lastSeen: Date;
}

export class BehaviorTracker {
  private static instance: BehaviorTracker;
  private eventQueue: TrackingEvent[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private patterns: Map<string, BehaviorPattern[]> = new Map();

  static getInstance(): BehaviorTracker {
    if (!BehaviorTracker.instance) {
      BehaviorTracker.instance = new BehaviorTracker();
      BehaviorTracker.instance.startProcessing();
    }
    return BehaviorTracker.instance;
  }

  /**
   * Track user behavior event
   */
  async track(event: TrackingEvent): Promise<void> {
    // Add to queue for batch processing
    this.eventQueue.push({
      ...event,
      timestamp: event.timestamp || new Date()
    });

    // Process immediately for critical events
    if (this.isCriticalEvent(event.eventType)) {
      await this.processEvent(event);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(userId: string, path: string, metadata?: Record<string, any>): Promise<void> {
    await this.track({
      userId,
      eventType: 'page_view',
      eventData: {
        path,
        ...metadata
      },
      timestamp: new Date()
    });
  }

  /**
   * Track product view
   */
  async trackProductView(userId: string, productId: string, timeSpent?: number): Promise<void> {
    await this.track({
      userId,
      eventType: 'product_view',
      eventData: {
        productId,
        timeSpent: timeSpent || 0
      },
      timestamp: new Date()
    });

    // Store in database for profile building
    await prisma.productView.create({
      data: {
        userId,
        productId,
        timeSpent: timeSpent || 0,
        createdAt: new Date()
      }
    });
  }

  /**
   * Track search query
   */
  async trackSearch(userId: string, query: string, resultsCount: number, clickedResults?: string[]): Promise<void> {
    await this.track({
      userId,
      eventType: 'search',
      eventData: {
        query,
        resultsCount,
        clickedResults: clickedResults || []
      },
      timestamp: new Date()
    });

    // Store search for analysis
    await prisma.searchQuery.create({
      data: {
        userId,
        query,
        resultsCount,
        resultsClicked: JSON.stringify(clickedResults || []),
        createdAt: new Date()
      }
    });
  }

  /**
   * Track cart interaction
   */
  async trackCartEvent(userId: string, action: 'add' | 'remove' | 'update', productId: string, quantity: number): Promise<void> {
    await this.track({
      userId,
      eventType: 'cart_event',
      eventData: {
        action,
        productId,
        quantity
      },
      timestamp: new Date()
    });
  }

  /**
   * Track purchase conversion
   */
  async trackPurchase(userId: string, orderId: string, items: Array<{productId: string; quantity: number; price: number}>): Promise<void> {
    await this.track({
      userId,
      eventType: 'purchase',
      eventData: {
        orderId,
        items,
        totalValue: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      },
      timestamp: new Date()
    });

    // Update user profile with purchase behavior
    await userProfiler.updateProfile(userId, {
      behavior: {
        purchaseHistory: items.map(item => ({
          productId: item.productId,
          category: 'unknown', // Would be fetched from product data
          price: item.price,
          timestamp: new Date()
        })),
        browsingHistory: [],
        searchHistory: []
      }
    } as any);
  }

  /**
   * Track email interaction
   */
  async trackEmailEvent(userId: string, action: 'open' | 'click' | 'unsubscribe', campaignId: string, linkUrl?: string): Promise<void> {
    await this.track({
      userId,
      eventType: 'email_event',
      eventData: {
        action,
        campaignId,
        linkUrl
      },
      timestamp: new Date()
    });
  }

  /**
   * Detect behavior patterns for a user
   */
  async detectPatterns(userId: string): Promise<BehaviorPattern[]> {
    const cached = this.patterns.get(userId);
    if (cached) return cached;

    // Get recent events for pattern analysis
    const events = await this.getRecentEvents(userId, 30); // Last 30 days
    const patterns = this.analyzePatterns(events);
    
    this.patterns.set(userId, patterns);
    return patterns;
  }

  /**
   * Get user's browsing session data
   */
  async getSessionData(userId: string, sessionId?: string): Promise<any> {
    const filter: any = { userId };
    if (sessionId) filter.sessionId = sessionId;

    const events = await this.getRecentEvents(userId, 1);
    
    return {
      sessionId: sessionId || this.generateSessionId(),
      startTime: events[events.length - 1]?.timestamp || new Date(),
      events: events.length,
      duration: this.calculateSessionDuration(events),
      pageViews: events.filter(e => e.eventType === 'page_view').length,
      productViews: events.filter(e => e.eventType === 'product_view').length,
      searches: events.filter(e => e.eventType === 'search').length,
      cartEvents: events.filter(e => e.eventType === 'cart_event').length
    };
  }

  /**
   * Predict next likely action
   */
  async predictNextAction(userId: string): Promise<{ action: string; confidence: number; recommendations: string[] }> {
    const patterns = await this.detectPatterns(userId);
    const recentEvents = await this.getRecentEvents(userId, 1);
    
    // Simple pattern-based prediction
    if (recentEvents.length === 0) {
      return {
        action: 'browse_home',
        confidence: 0.8,
        recommendations: ['Show trending products', 'Display personalized categories']
      };
    }

    const lastEvent = recentEvents[0];
    
    switch (lastEvent.eventType) {
      case 'product_view':
        return {
          action: 'view_similar_products',
          confidence: 0.75,
          recommendations: ['Show similar products', 'Display complementary items', 'Show reviews']
        };
      
      case 'search':
        return {
          action: 'refine_search',
          confidence: 0.6,
          recommendations: ['Suggest filters', 'Show popular in category', 'Offer alternatives']
        };
      
      case 'cart_event':
        return {
          action: 'complete_purchase',
          confidence: 0.9,
          recommendations: ['Show checkout incentives', 'Display shipping options', 'Offer quick checkout']
        };
      
      default:
        return {
          action: 'continue_browsing',
          confidence: 0.5,
          recommendations: ['Show personalized products', 'Display recent views']
        };
    }
  }

  /**
   * Calculate engagement score for current session
   */
  async calculateEngagementScore(userId: string, sessionId?: string): Promise<number> {
    const sessionData = await this.getSessionData(userId, sessionId);
    
    let score = 0;
    
    // Base score from time spent
    score += Math.min(30, sessionData.duration / 60); // Max 30 points for 30+ minutes
    
    // Points for page views
    score += Math.min(20, sessionData.pageViews * 2); // Max 20 points
    
    // Points for product interactions
    score += Math.min(25, sessionData.productViews * 5); // Max 25 points
    
    // Points for search activity
    score += Math.min(15, sessionData.searches * 3); // Max 15 points
    
    // Points for cart interactions
    score += Math.min(10, sessionData.cartEvents * 5); // Max 10 points
    
    return Math.min(100, score);
  }

  // Private methods

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        const events = this.eventQueue.splice(0, 100); // Process in batches
        await this.processBatch(events);
      }
    }, 5000); // Process every 5 seconds
  }

  private async processBatch(events: TrackingEvent[]): Promise<void> {
    try {
      // Store events in database
      await prisma.behaviorEvent.createMany({
        data: events.map(event => ({
          userId: event.userId,
          eventType: event.eventType,
          eventData: JSON.stringify(event.eventData),
          sessionId: event.sessionId,
          deviceType: event.deviceType,
          userAgent: event.userAgent,
          ipAddress: event.ipAddress,
          referrer: event.referrer,
          createdAt: event.timestamp
        }))
      });

      // Update user profiles based on events
      const userEvents = this.groupEventsByUser(events);
      for (const [userId, userEventList] of userEvents.entries()) {
        await this.updateUserBehavior(userId, userEventList);
      }
    } catch (error) {
      console.error('Error processing behavior events:', error);
      // Re-queue failed events
      this.eventQueue.unshift(...events);
    }
  }

  private async processEvent(event: TrackingEvent): Promise<void> {
    // Immediate processing for critical events
    await this.updateRealTimeProfile(event.userId, event);
  }

  private isCriticalEvent(eventType: string): boolean {
    return ['purchase', 'cart_event', 'high_value_action'].includes(eventType);
  }

  private async getRecentEvents(userId: string, days: number): Promise<TrackingEvent[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const events = await prisma.behaviorEvent.findMany({
      where: {
        userId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // Limit for performance
    });

    return events.map(event => ({
      userId: event.userId,
      eventType: event.eventType,
      eventData: JSON.parse(event.eventData),
      timestamp: event.createdAt,
      sessionId: event.sessionId || undefined,
      deviceType: event.deviceType as any,
      userAgent: event.userAgent || undefined,
      ipAddress: event.ipAddress || undefined,
      referrer: event.referrer || undefined
    }));
  }

  private analyzePatterns(events: TrackingEvent[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    
    // Analyze time-based patterns
    const hourlyActivity = this.analyzeHourlyActivity(events);
    const weeklyActivity = this.analyzeWeeklyActivity(events);
    
    // Analyze sequence patterns
    const sequencePatterns = this.analyzeSequencePatterns(events);
    
    // Analyze category preferences
    const categoryPatterns = this.analyzeCategoryPatterns(events);
    
    return [
      ...hourlyActivity,
      ...weeklyActivity,
      ...sequencePatterns,
      ...categoryPatterns
    ];
  }

  private analyzeHourlyActivity(events: TrackingEvent[]): BehaviorPattern[] {
    const hours = new Array(24).fill(0);
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hours[hour]++;
    });

    const totalEvents = events.length;
    const patterns: BehaviorPattern[] = [];

    hours.forEach((count, hour) => {
      if (count / totalEvents > 0.1) { // More than 10% of activity
        patterns.push({
          pattern: `active_hour_${hour}`,
          frequency: count,
          confidence: count / totalEvents,
          lastSeen: new Date()
        });
      }
    });

    return patterns;
  }

  private analyzeWeeklyActivity(events: TrackingEvent[]): BehaviorPattern[] {
    const days = new Array(7).fill(0);
    events.forEach(event => {
      const day = event.timestamp.getDay();
      days[day]++;
    });

    const totalEvents = events.length;
    const patterns: BehaviorPattern[] = [];

    days.forEach((count, day) => {
      if (count / totalEvents > 0.2) { // More than 20% of activity
        patterns.push({
          pattern: `active_day_${day}`,
          frequency: count,
          confidence: count / totalEvents,
          lastSeen: new Date()
        });
      }
    });

    return patterns;
  }

  private analyzeSequencePatterns(events: TrackingEvent[]): BehaviorPattern[] {
    const sequences = new Map<string, number>();
    
    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i].eventType;
      const next = events[i + 1].eventType;
      const sequence = `${current}_to_${next}`;
      sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
    }

    const patterns: BehaviorPattern[] = [];
    const totalSequences = events.length - 1;

    sequences.forEach((count, sequence) => {
      if (count > 2 && count / totalSequences > 0.05) { // At least 5% frequency
        patterns.push({
          pattern: `sequence_${sequence}`,
          frequency: count,
          confidence: count / totalSequences,
          lastSeen: new Date()
        });
      }
    });

    return patterns;
  }

  private analyzeCategoryPatterns(events: TrackingEvent[]): BehaviorPattern[] {
    const categories = new Map<string, number>();
    
    events.forEach(event => {
      if (event.eventType === 'product_view' && event.eventData.category) {
        const category = event.eventData.category;
        categories.set(category, (categories.get(category) || 0) + 1);
      }
    });

    const patterns: BehaviorPattern[] = [];
    const totalViews = Array.from(categories.values()).reduce((sum, count) => sum + count, 0);

    categories.forEach((count, category) => {
      if (count / totalViews > 0.1) { // More than 10% of product views
        patterns.push({
          pattern: `prefers_category_${category}`,
          frequency: count,
          confidence: count / totalViews,
          lastSeen: new Date()
        });
      }
    });

    return patterns;
  }

  private groupEventsByUser(events: TrackingEvent[]): Map<string, TrackingEvent[]> {
    const grouped = new Map<string, TrackingEvent[]>();
    
    events.forEach(event => {
      if (!grouped.has(event.userId)) {
        grouped.set(event.userId, []);
      }
      grouped.get(event.userId)!.push(event);
    });

    return grouped;
  }

  private async updateUserBehavior(userId: string, events: TrackingEvent[]): Promise<void> {
    // Analyze events and update user profile
    const engagement = await this.calculateEngagementScore(userId);
    
    // Update user's engagement metrics
    await userProfiler.updateProfile(userId, {
      engagement: {
        totalSessions: 0, // Would be calculated from session data
        avgSessionDuration: 0,
        pagesPerSession: 0,
        bounceRate: 0,
        lastActive: new Date(),
        deviceTypes: ['desktop'],
        channels: ['direct']
      }
    } as any);
  }

  private async updateRealTimeProfile(userId: string, event: TrackingEvent): Promise<void> {
    // Update real-time aspects of user profile
    if (event.eventType === 'purchase') {
      // Immediately update purchase history and value score
      await userProfiler.updateProfile(userId, {
        scores: {
          engagementScore: 0,
          loyaltyScore: 0,
          valueScore: 0,
          churnRisk: 0
        }
      } as any);
    }
  }

  private calculateSessionDuration(events: TrackingEvent[]): number {
    if (events.length < 2) return 0;
    
    const first = events[events.length - 1].timestamp.getTime();
    const last = events[0].timestamp.getTime();
    
    return (last - first) / 1000; // Duration in seconds
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const behaviorTracker = BehaviorTracker.getInstance();