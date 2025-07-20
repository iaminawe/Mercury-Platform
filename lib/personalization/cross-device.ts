/**
 * Cross-Device Tracking and Personalization
 * Unified user experience across multiple devices
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  localStorageEnabled: boolean;
  canvas?: string;
  webgl?: string;
  fonts?: string[];
}

interface DeviceSession {
  deviceId: string;
  sessionId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  fingerprint: DeviceFingerprint;
  firstSeen: Date;
  lastSeen: Date;
  isActive: boolean;
  location?: {
    ip: string;
    country: string;
    city?: string;
  };
}

interface CrossDeviceProfile {
  userId: string;
  unifiedId: string;
  devices: DeviceSession[];
  crossDeviceJourney: Array<{
    deviceId: string;
    timestamp: Date;
    event: string;
    data: any;
  }>;
  preferences: {
    primaryDevice?: string;
    contentContinuity: boolean;
    syncSettings: boolean;
    privacyLevel: 'strict' | 'balanced' | 'open';
  };
  metrics: {
    deviceSwitchFrequency: number;
    averageSessionGap: number;
    crossDeviceConversions: number;
    devicePreferenceScore: Record<string, number>;
  };
}

interface DeviceTransition {
  fromDevice: string;
  toDevice: string;
  timestamp: Date;
  context: {
    pageLeft: string;
    pageEntered: string;
    timeBetween: number;
    likely: boolean;
  };
}

export class CrossDeviceTracking {
  private static instance: CrossDeviceTracking;
  private redis: Redis | null = null;
  private profiles: Map<string, CrossDeviceProfile> = new Map();
  private deviceMappings: Map<string, string> = new Map(); // deviceId -> userId
  private fingerprintMatchers: Array<(fp1: DeviceFingerprint, fp2: DeviceFingerprint) => number> = [];
  private transitionThreshold: number = 300000; // 5 minutes
  private confidenceThreshold: number = 0.7;

  static getInstance(redis?: Redis): CrossDeviceTracking {
    if (!CrossDeviceTracking.instance) {
      CrossDeviceTracking.instance = new CrossDeviceTracking();
      if (redis) {
        CrossDeviceTracking.instance.redis = redis;
      }
    }
    return CrossDeviceTracking.instance;
  }

  constructor() {
    this.initializeFingerprintMatchers();
    this.initialize();
  }

  /**
   * Track device session and link to user
   */
  async trackDevice(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    sessionInfo: {
      userId?: string;
      sessionId: string;
      deviceType: 'mobile' | 'tablet' | 'desktop';
      location?: { ip: string; country: string; city?: string };
    }
  ): Promise<{
    unifiedId: string;
    isNewDevice: boolean;
    confidence: number;
    linkedDevices: string[];
  }> {
    const deviceSession: DeviceSession = {
      deviceId,
      sessionId: sessionInfo.sessionId,
      deviceType: sessionInfo.deviceType,
      fingerprint,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isActive: true,
      location: sessionInfo.location
    };

    // Check if device is already known
    let unifiedId = this.deviceMappings.get(deviceId);
    let confidence = 1.0;
    let isNewDevice = true;

    if (!unifiedId) {
      // Try to match with existing devices
      const matchResult = await this.findMatchingUser(fingerprint, sessionInfo);
      unifiedId = matchResult.unifiedId;
      confidence = matchResult.confidence;
      isNewDevice = matchResult.isNewDevice;
    } else {
      isNewDevice = false;
    }

    // Create new unified ID if no match found
    if (!unifiedId) {
      unifiedId = uuidv4();
    }

    // Update or create profile
    await this.updateCrossDeviceProfile(unifiedId, deviceSession, sessionInfo.userId);

    // Store device mapping
    this.deviceMappings.set(deviceId, unifiedId);

    const profile = this.profiles.get(unifiedId);
    const linkedDevices = profile ? profile.devices.map(d => d.deviceId) : [deviceId];

    // Persist to Redis
    if (this.redis) {
      await this.saveProfile(unifiedId, profile!);
      await this.redis.set(`device_mapping:${deviceId}`, unifiedId);
    }

    return {
      unifiedId,
      isNewDevice,
      confidence,
      linkedDevices
    };
  }

  /**
   * Get unified cross-device profile
   */
  async getCrossDeviceProfile(userId: string): Promise<CrossDeviceProfile | null> {
    // First try to find by userId
    for (const profile of this.profiles.values()) {
      if (profile.userId === userId) {
        return profile;
      }
    }

    // Try loading from Redis
    if (this.redis) {
      const profileData = await this.redis.get(`cross_device_profile:${userId}`);
      if (profileData) {
        const profile = JSON.parse(profileData);
        this.profiles.set(profile.unifiedId, profile);
        return profile;
      }
    }

    return null;
  }

  /**
   * Track cross-device event
   */
  async trackCrossDeviceEvent(
    deviceId: string,
    event: string,
    data: any
  ): Promise<void> {
    const unifiedId = this.deviceMappings.get(deviceId);
    if (!unifiedId) return;

    const profile = this.profiles.get(unifiedId);
    if (!profile) return;

    // Add to cross-device journey
    profile.crossDeviceJourney.push({
      deviceId,
      timestamp: new Date(),
      event,
      data
    });

    // Limit journey history
    if (profile.crossDeviceJourney.length > 1000) {
      profile.crossDeviceJourney = profile.crossDeviceJourney.slice(-1000);
    }

    // Update device activity
    const device = profile.devices.find(d => d.deviceId === deviceId);
    if (device) {
      device.lastSeen = new Date();
      device.isActive = true;
    }

    // Detect device transitions
    await this.detectDeviceTransition(profile, deviceId, event, data);

    // Update metrics
    this.updateProfileMetrics(profile);

    // Save updated profile
    this.profiles.set(unifiedId, profile);
    if (this.redis) {
      await this.saveProfile(unifiedId, profile);
    }
  }

  /**
   * Get cross-device recommendations
   */
  async getCrossDeviceRecommendations(
    currentDeviceId: string,
    context: {
      currentPage: string;
      sessionDuration: number;
      recentEvents: any[];
    }
  ): Promise<{
    continuity: Array<{
      type: 'resume_session' | 'continue_browsing' | 'complete_action';
      device: string;
      content: any;
      priority: number;
    }>;
    optimization: Array<{
      type: 'device_switch' | 'timing' | 'content_adaptation';
      suggestion: string;
      reasoning: string;
      confidence: number;
    }>;
  }> {
    const unifiedId = this.deviceMappings.get(currentDeviceId);
    if (!unifiedId) {
      return { continuity: [], optimization: [] };
    }

    const profile = this.profiles.get(unifiedId);
    if (!profile) {
      return { continuity: [], optimization: [] };
    }

    const continuity = await this.generateContinuityRecommendations(profile, currentDeviceId, context);
    const optimization = await this.generateOptimizationRecommendations(profile, currentDeviceId, context);

    return { continuity, optimization };
  }

  /**
   * Synchronize preferences across devices
   */
  async syncPreferences(
    unifiedId: string,
    preferences: Record<string, any>,
    sourceDevice: string
  ): Promise<{
    syncedDevices: string[];
    conflicts: Array<{ key: string; devices: string[]; values: any[] }>;
  }> {
    const profile = this.profiles.get(unifiedId);
    if (!profile || !profile.preferences.syncSettings) {
      return { syncedDevices: [], conflicts: [] };
    }

    const syncedDevices: string[] = [];
    const conflicts: Array<{ key: string; devices: string[]; values: any[] }> = [];

    // Get current preferences for all devices
    const devicePreferences = new Map<string, Record<string, any>>();
    for (const device of profile.devices) {
      if (this.redis) {
        const prefs = await this.redis.get(`device_preferences:${device.deviceId}`);
        if (prefs) {
          devicePreferences.set(device.deviceId, JSON.parse(prefs));
        }
      }
    }

    // Detect conflicts
    for (const [key, value] of Object.entries(preferences)) {
      const conflictingDevices: string[] = [];
      const conflictingValues: any[] = [];

      for (const [deviceId, devicePrefs] of devicePreferences) {
        if (deviceId !== sourceDevice && devicePrefs[key] !== undefined && devicePrefs[key] !== value) {
          conflictingDevices.push(deviceId);
          conflictingValues.push(devicePrefs[key]);
        }
      }

      if (conflictingDevices.length > 0) {
        conflicts.push({
          key,
          devices: [sourceDevice, ...conflictingDevices],
          values: [value, ...conflictingValues]
        });
      }
    }

    // Sync non-conflicting preferences
    for (const device of profile.devices) {
      if (device.deviceId === sourceDevice) continue;

      const currentPrefs = devicePreferences.get(device.deviceId) || {};
      let updated = false;

      for (const [key, value] of Object.entries(preferences)) {
        const hasConflict = conflicts.some(c => c.key === key);
        if (!hasConflict) {
          currentPrefs[key] = value;
          updated = true;
        }
      }

      if (updated && this.redis) {
        await this.redis.set(`device_preferences:${device.deviceId}`, JSON.stringify(currentPrefs));
        syncedDevices.push(device.deviceId);
      }
    }

    return { syncedDevices, conflicts };
  }

  /**
   * Get cross-device analytics
   */
  async getCrossDeviceAnalytics(userId: string): Promise<{
    deviceUsage: Array<{
      deviceId: string;
      deviceType: string;
      usage: {
        sessions: number;
        totalTime: number;
        averageSession: number;
        lastUsed: Date;
      };
    }>;
    transitions: Array<{
      from: string;
      to: string;
      frequency: number;
      averageGap: number;
      commonTriggers: string[];
    }>;
    journeyPatterns: Array<{
      pattern: string;
      frequency: number;
      conversionRate: number;
      devices: string[];
    }>;
    recommendations: {
      primaryDevice: string;
      optimizationOpportunities: string[];
      syncSuggestions: string[];
    };
  }> {
    const profile = await this.getCrossDeviceProfile(userId);
    if (!profile) {
      return {
        deviceUsage: [],
        transitions: [],
        journeyPatterns: [],
        recommendations: {
          primaryDevice: '',
          optimizationOpportunities: [],
          syncSuggestions: []
        }
      };
    }

    const deviceUsage = this.calculateDeviceUsage(profile);
    const transitions = this.analyzeDeviceTransitions(profile);
    const journeyPatterns = this.identifyJourneyPatterns(profile);
    const recommendations = this.generateDeviceRecommendations(profile);

    return {
      deviceUsage,
      transitions,
      journeyPatterns,
      recommendations
    };
  }

  // Private methods

  private async initialize(): Promise<void> {
    await this.loadProfiles();
    this.startMaintenanceTasks();
  }

  private initializeFingerprintMatchers(): void {
    // User Agent similarity
    this.fingerprintMatchers.push((fp1, fp2) => {
      const similarity = this.stringSimilarity(fp1.userAgent, fp2.userAgent);
      return similarity * 0.3;
    });

    // Screen resolution similarity
    this.fingerprintMatchers.push((fp1, fp2) => {
      return fp1.screenResolution === fp2.screenResolution ? 0.2 : 0;
    });

    // Timezone and language match
    this.fingerprintMatchers.push((fp1, fp2) => {
      let score = 0;
      if (fp1.timezone === fp2.timezone) score += 0.15;
      if (fp1.language === fp2.language) score += 0.15;
      return score;
    });

    // Platform consistency
    this.fingerprintMatchers.push((fp1, fp2) => {
      // Different platforms but same ecosystem (iOS/macOS, Windows/Windows)
      const ecosystems = [
        ['iOS', 'macOS'],
        ['Windows', 'Windows'],
        ['Android', 'Linux']
      ];

      for (const ecosystem of ecosystems) {
        if (ecosystem.includes(fp1.platform) && ecosystem.includes(fp2.platform)) {
          return 0.1;
        }
      }
      return fp1.platform === fp2.platform ? 0.2 : 0;
    });

    // Canvas fingerprint similarity
    this.fingerprintMatchers.push((fp1, fp2) => {
      if (fp1.canvas && fp2.canvas) {
        return this.stringSimilarity(fp1.canvas, fp2.canvas) * 0.1;
      }
      return 0;
    });
  }

  private async findMatchingUser(
    fingerprint: DeviceFingerprint,
    sessionInfo: any
  ): Promise<{
    unifiedId: string | null;
    confidence: number;
    isNewDevice: boolean;
  }> {
    let bestMatch: { unifiedId: string; confidence: number } | null = null;

    // Check all existing profiles
    for (const [unifiedId, profile] of this.profiles) {
      for (const device of profile.devices) {
        const confidence = this.calculateFingerprintSimilarity(fingerprint, device.fingerprint);
        
        // Also consider location and timing
        const locationBonus = this.calculateLocationSimilarity(sessionInfo.location, device.location);
        const timingBonus = this.calculateTimingBonus(device);
        
        const totalConfidence = confidence + locationBonus + timingBonus;
        
        if (totalConfidence > this.confidenceThreshold && 
            (!bestMatch || totalConfidence > bestMatch.confidence)) {
          bestMatch = { unifiedId, confidence: totalConfidence };
        }
      }
    }

    if (bestMatch) {
      return {
        unifiedId: bestMatch.unifiedId,
        confidence: bestMatch.confidence,
        isNewDevice: false
      };
    }

    return {
      unifiedId: null,
      confidence: 0,
      isNewDevice: true
    };
  }

  private calculateFingerprintSimilarity(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    let totalScore = 0;
    for (const matcher of this.fingerprintMatchers) {
      totalScore += matcher(fp1, fp2);
    }
    return Math.min(1, totalScore);
  }

  private calculateLocationSimilarity(loc1: any, loc2: any): number {
    if (!loc1 || !loc2) return 0;
    
    let score = 0;
    if (loc1.country === loc2.country) score += 0.1;
    if (loc1.city === loc2.city) score += 0.05;
    
    return score;
  }

  private calculateTimingBonus(device: DeviceSession): number {
    const timeSinceLastSeen = Date.now() - device.lastSeen.getTime();
    
    // Bonus for recent activity (within 24 hours)
    if (timeSinceLastSeen < 24 * 60 * 60 * 1000) {
      return 0.1 * (1 - timeSinceLastSeen / (24 * 60 * 60 * 1000));
    }
    
    return 0;
  }

  private async updateCrossDeviceProfile(
    unifiedId: string,
    deviceSession: DeviceSession,
    userId?: string
  ): Promise<void> {
    let profile = this.profiles.get(unifiedId);
    
    if (!profile) {
      profile = {
        userId: userId || '',
        unifiedId,
        devices: [],
        crossDeviceJourney: [],
        preferences: {
          contentContinuity: true,
          syncSettings: true,
          privacyLevel: 'balanced'
        },
        metrics: {
          deviceSwitchFrequency: 0,
          averageSessionGap: 0,
          crossDeviceConversions: 0,
          devicePreferenceScore: {}
        }
      };
    }

    // Update or add device
    const existingDeviceIndex = profile.devices.findIndex(d => d.deviceId === deviceSession.deviceId);
    if (existingDeviceIndex >= 0) {
      profile.devices[existingDeviceIndex] = {
        ...profile.devices[existingDeviceIndex],
        ...deviceSession,
        firstSeen: profile.devices[existingDeviceIndex].firstSeen // Preserve first seen
      };
    } else {
      profile.devices.push(deviceSession);
    }

    // Update user ID if provided
    if (userId && !profile.userId) {
      profile.userId = userId;
    }

    this.profiles.set(unifiedId, profile);
  }

  private async detectDeviceTransition(
    profile: CrossDeviceProfile,
    currentDevice: string,
    event: string,
    data: any
  ): Promise<void> {
    // Look for recent activity on other devices
    const recentThreshold = Date.now() - this.transitionThreshold;
    const recentJourney = profile.crossDeviceJourney.filter(
      j => j.timestamp.getTime() > recentThreshold && j.deviceId !== currentDevice
    );

    if (recentJourney.length > 0) {
      const lastEvent = recentJourney[recentJourney.length - 1];
      const timeBetween = Date.now() - lastEvent.timestamp.getTime();

      // Detect likely transitions
      const isLikelyTransition = this.isLikelyDeviceTransition(lastEvent, {
        deviceId: currentDevice,
        event,
        data,
        timestamp: new Date()
      }, timeBetween);

      if (isLikelyTransition) {
        const transition: DeviceTransition = {
          fromDevice: lastEvent.deviceId,
          toDevice: currentDevice,
          timestamp: new Date(),
          context: {
            pageLeft: lastEvent.data.page || '',
            pageEntered: data.page || '',
            timeBetween,
            likely: true
          }
        };

        await this.recordDeviceTransition(profile, transition);
      }
    }
  }

  private isLikelyDeviceTransition(
    lastEvent: any,
    currentEvent: any,
    timeBetween: number
  ): boolean {
    // Transition signals
    const signals = [];

    // Time signal (transitions typically happen within 5 minutes)
    if (timeBetween < this.transitionThreshold) {
      signals.push(0.3);
    }

    // Page continuity signal
    if (lastEvent.data.page && currentEvent.data.page) {
      if (this.isRelatedPage(lastEvent.data.page, currentEvent.data.page)) {
        signals.push(0.4);
      }
    }

    // Action continuity signal
    if (this.isRelatedAction(lastEvent.event, currentEvent.event)) {
      signals.push(0.3);
    }

    const totalScore = signals.reduce((sum, score) => sum + score, 0);
    return totalScore >= 0.6;
  }

  private isRelatedPage(page1: string, page2: string): boolean {
    const related = [
      ['/product/', '/cart'],
      ['/cart', '/checkout'],
      ['/search', '/product/'],
      ['/category/', '/product/']
    ];

    return related.some(([p1, p2]) => 
      (page1.includes(p1) && page2.includes(p2)) ||
      (page1.includes(p2) && page2.includes(p1))
    );
  }

  private isRelatedAction(action1: string, action2: string): boolean {
    const related = [
      ['product_view', 'add_to_cart'],
      ['add_to_cart', 'checkout_start'],
      ['search', 'product_view'],
      ['category_browse', 'product_view']
    ];

    return related.some(([a1, a2]) => 
      (action1 === a1 && action2 === a2) ||
      (action1 === a2 && action2 === a1)
    );
  }

  private async recordDeviceTransition(profile: CrossDeviceProfile, transition: DeviceTransition): Promise<void> {
    // Update metrics
    profile.metrics.deviceSwitchFrequency++;

    // Store transition for analytics
    if (this.redis) {
      await this.redis.lpush(
        `transitions:${profile.unifiedId}`,
        JSON.stringify(transition)
      );
      await this.redis.ltrim(`transitions:${profile.unifiedId}`, 0, 999);
    }
  }

  private updateProfileMetrics(profile: CrossDeviceProfile): void {
    // Calculate device preference scores
    const deviceEvents = new Map<string, number>();
    for (const event of profile.crossDeviceJourney) {
      deviceEvents.set(event.deviceId, (deviceEvents.get(event.deviceId) || 0) + 1);
    }

    const totalEvents = profile.crossDeviceJourney.length;
    for (const [deviceId, count] of deviceEvents) {
      profile.metrics.devicePreferenceScore[deviceId] = count / totalEvents;
    }

    // Update primary device preference
    if (Object.keys(profile.metrics.devicePreferenceScore).length > 0) {
      const primaryDevice = Object.entries(profile.metrics.devicePreferenceScore)
        .reduce((max, current) => current[1] > max[1] ? current : max)[0];
      profile.preferences.primaryDevice = primaryDevice;
    }
  }

  private async generateContinuityRecommendations(
    profile: CrossDeviceProfile,
    currentDeviceId: string,
    context: any
  ): Promise<Array<{
    type: 'resume_session' | 'continue_browsing' | 'complete_action';
    device: string;
    content: any;
    priority: number;
  }>> {
    const recommendations = [];

    // Look for incomplete actions on other devices
    for (const device of profile.devices) {
      if (device.deviceId === currentDeviceId || !device.isActive) continue;

      const recentEvents = profile.crossDeviceJourney
        .filter(e => e.deviceId === device.deviceId)
        .slice(-10);

      // Detect incomplete shopping journey
      const hasCartItems = recentEvents.some(e => e.event === 'add_to_cart');
      const hasCheckoutStart = recentEvents.some(e => e.event === 'checkout_start');
      const hasPurchase = recentEvents.some(e => e.event === 'purchase');

      if (hasCartItems && !hasPurchase) {
        recommendations.push({
          type: 'complete_action',
          device: device.deviceId,
          content: {
            action: 'complete_checkout',
            message: 'Complete your purchase started on your other device',
            items: recentEvents.filter(e => e.event === 'add_to_cart').map(e => e.data)
          },
          priority: hasCheckoutStart ? 0.9 : 0.7
        });
      }

      // Detect browsing continuation opportunities
      const lastBrowsingEvent = recentEvents
        .filter(e => ['product_view', 'category_browse', 'search'].includes(e.event))
        .pop();

      if (lastBrowsingEvent && Date.now() - lastBrowsingEvent.timestamp.getTime() < 3600000) { // 1 hour
        recommendations.push({
          type: 'continue_browsing',
          device: device.deviceId,
          content: {
            action: 'continue_browsing',
            lastPage: lastBrowsingEvent.data.page,
            category: lastBrowsingEvent.data.category
          },
          priority: 0.5
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private async generateOptimizationRecommendations(
    profile: CrossDeviceProfile,
    currentDeviceId: string,
    context: any
  ): Promise<Array<{
    type: 'device_switch' | 'timing' | 'content_adaptation';
    suggestion: string;
    reasoning: string;
    confidence: number;
  }>> {
    const recommendations = [];

    // Analyze device usage patterns
    const currentDevice = profile.devices.find(d => d.deviceId === currentDeviceId);
    if (!currentDevice) return recommendations;

    // Suggest optimal device for current activity
    if (context.currentPage.includes('/checkout') && currentDevice.deviceType === 'mobile') {
      const desktopDevice = profile.devices.find(d => d.deviceType === 'desktop');
      if (desktopDevice) {
        recommendations.push({
          type: 'device_switch',
          suggestion: 'Switch to desktop for easier checkout',
          reasoning: 'Desktop devices typically have higher checkout completion rates',
          confidence: 0.8
        });
      }
    }

    // Timing optimization
    const devicePreference = profile.metrics.devicePreferenceScore[currentDeviceId] || 0;
    const avgGap = profile.metrics.averageSessionGap;
    
    if (devicePreference < 0.3 && avgGap > 3600000) { // Low usage device, long gaps
      recommendations.push({
        type: 'timing',
        suggestion: 'Consider shopping during your typical active hours',
        reasoning: 'Based on your usage patterns, you\'re more active at different times',
        confidence: 0.6
      });
    }

    return recommendations;
  }

  private calculateDeviceUsage(profile: CrossDeviceProfile): Array<{
    deviceId: string;
    deviceType: string;
    usage: {
      sessions: number;
      totalTime: number;
      averageSession: number;
      lastUsed: Date;
    };
  }> {
    return profile.devices.map(device => {
      const deviceEvents = profile.crossDeviceJourney.filter(e => e.deviceId === device.deviceId);
      const sessions = new Set(deviceEvents.map(e => e.data.sessionId || 'unknown')).size;
      
      return {
        deviceId: device.deviceId,
        deviceType: device.deviceType,
        usage: {
          sessions,
          totalTime: deviceEvents.length * 60000, // Rough estimate
          averageSession: sessions > 0 ? (deviceEvents.length * 60000) / sessions : 0,
          lastUsed: device.lastSeen
        }
      };
    });
  }

  private analyzeDeviceTransitions(profile: CrossDeviceProfile): Array<{
    from: string;
    to: string;
    frequency: number;
    averageGap: number;
    commonTriggers: string[];
  }> {
    // This would analyze transition patterns from stored data
    return []; // Simplified for now
  }

  private identifyJourneyPatterns(profile: CrossDeviceProfile): Array<{
    pattern: string;
    frequency: number;
    conversionRate: number;
    devices: string[];
  }> {
    // This would identify common cross-device journey patterns
    return []; // Simplified for now
  }

  private generateDeviceRecommendations(profile: CrossDeviceProfile): {
    primaryDevice: string;
    optimizationOpportunities: string[];
    syncSuggestions: string[];
  } {
    const primaryDevice = profile.preferences.primaryDevice || 
      (profile.devices.length > 0 ? profile.devices[0].deviceId : '');

    return {
      primaryDevice,
      optimizationOpportunities: [
        'Enable cross-device cart synchronization',
        'Set up device-specific notifications'
      ],
      syncSuggestions: [
        'Sync browsing history across devices',
        'Enable preference synchronization'
      ]
    };
  }

  private stringSimilarity(str1: string, str2: string): number {
    // Simple string similarity using longest common subsequence
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private editDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async saveProfile(unifiedId: string, profile: CrossDeviceProfile): Promise<void> {
    if (!this.redis) return;
    
    await this.redis.set(`cross_device_profile:${unifiedId}`, JSON.stringify(profile));
    await this.redis.set(`cross_device_profile:${profile.userId}`, JSON.stringify(profile));
  }

  private async loadProfiles(): Promise<void> {
    // Load profiles from Redis on startup
    if (!this.redis) return;
    
    try {
      const keys = await this.redis.keys('cross_device_profile:*');
      for (const key of keys) {
        const profileData = await this.redis.get(key);
        if (profileData) {
          const profile = JSON.parse(profileData);
          this.profiles.set(profile.unifiedId, profile);
          
          // Rebuild device mappings
          for (const device of profile.devices) {
            this.deviceMappings.set(device.deviceId, profile.unifiedId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cross-device profiles:', error);
    }
  }

  private startMaintenanceTasks(): void {
    // Clean up inactive devices and old data
    setInterval(() => {
      this.cleanupInactiveDevices();
      this.archiveOldJourneyData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private cleanupInactiveDevices(): void {
    const inactiveThreshold = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    for (const profile of this.profiles.values()) {
      profile.devices = profile.devices.filter(device => 
        device.lastSeen.getTime() > inactiveThreshold
      );
    }
  }

  private archiveOldJourneyData(): void {
    const archiveThreshold = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
    
    for (const profile of this.profiles.values()) {
      profile.crossDeviceJourney = profile.crossDeviceJourney.filter(event =>
        event.timestamp.getTime() > archiveThreshold
      );
    }
  }
}

export const crossDeviceTracking = CrossDeviceTracking.getInstance();