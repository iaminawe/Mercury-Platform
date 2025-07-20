import { Database } from '@/lib/database.types';
import { createLogger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

const logger = createLogger('geographic-analyzer');

export interface GeographicRegion {
  id: string;
  name: string;
  code: string;
  type: 'country' | 'state' | 'city' | 'custom';
  parent?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface RegionalPerformance {
  region: GeographicRegion;
  stores: Array<{
    storeId: string;
    storeName: string;
    location: {
      address?: string;
      coordinates?: { lat: number; lng: number };
    };
  }>;
  metrics: {
    revenue: number;
    orders: number;
    visitors: number;
    avgOrderValue: number;
    conversionRate: number;
    customerCount: number;
    marketShare: number;
  };
  growth: {
    revenue: number;
    orders: number;
    visitors: number;
    customers: number;
  };
  demographics: {
    ageGroups: Record<string, number>;
    genderSplit: Record<string, number>;
    incomeRanges: Record<string, number>;
  };
  seasonality: {
    peak: string;
    low: string;
    patterns: Record<string, number>;
  };
  opportunities: {
    untappedSegments: string[];
    expansionPotential: number;
    competitiveAdvantage: string[];
  };
}

export interface GeographicAnalysis {
  regions: RegionalPerformance[];
  globalMetrics: {
    totalMarkets: number;
    bestPerformingRegion: RegionalPerformance;
    fastestGrowingRegion: RegionalPerformance;
    mostPotentialRegion: RegionalPerformance;
  };
  marketPenetration: {
    saturatedMarkets: string[];
    emergingMarkets: string[];
    untappedMarkets: string[];
    expansionScore: Record<string, number>;
  };
  competitiveAnalysis: {
    marketLeader: Record<string, string>;
    competitivePosition: Record<string, 'leader' | 'challenger' | 'follower' | 'niche'>;
    threatLevel: Record<string, 'low' | 'medium' | 'high'>;
  };
  recommendations: {
    priorityMarkets: string[];
    investmentAllocation: Record<string, number>;
    marketingStrategies: Record<string, string[]>;
    operationalOptimizations: string[];
  };
}

export interface LocationIntelligence {
  storeOptimization: Array<{
    storeId: string;
    storeName: string;
    location: { lat: number; lng: number };
    performance: 'excellent' | 'good' | 'average' | 'poor';
    factors: {
      footTraffic: number;
      competition: number;
      demographics: number;
      accessibility: number;
      marketSaturation: number;
    };
    recommendations: string[];
    expansionOpportunities: Array<{
      location: { lat: number; lng: number };
      score: number;
      reasons: string[];
    }>;
  }>;
  territoryAnalysis: {
    coverage: number; // percentage of target market covered
    gaps: Array<{
      location: { lat: number; lng: number };
      potentialRevenue: number;
      population: number;
      competition: number;
    }>;
    overlap: Array<{
      stores: string[];
      overlapRadius: number;
      cannibalizationRisk: number;
    }>;
  };
  customerDistribution: {
    heatmap: Array<{
      location: { lat: number; lng: number };
      intensity: number;
      customerCount: number;
      averageValue: number;
    }>;
    drivingPatterns: {
      averageDistance: number;
      maxDistance: number;
      preferredLocations: string[];
    };
  };
}

export class GeographicAnalyzer {
  constructor(private supabase: SupabaseClient<Database>) {}

  async analyzeRegionalPerformance(
    ownerId: string,
    dateRange: { from: Date; to: Date },
    granularity: 'country' | 'state' | 'city' = 'country'
  ): Promise<GeographicAnalysis> {
    const stores = await this.getStoresWithLocation(ownerId);
    const storeIds = stores.map(s => s.id);

    // Get analytics data
    const { data: snapshots, error } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    if (error) {
      logger.error('Failed to fetch analytics snapshots for geographic analysis', error);
      throw new Error('Failed to fetch analytics data');
    }

    // Get previous period for growth calculation
    const daysDiff = Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24);
    const prevDateRange = {
      from: subDays(dateRange.from, daysDiff),
      to: subDays(dateRange.to, daysDiff)
    };

    const { data: prevSnapshots } = await this.supabase
      .from('analytics_snapshots')
      .select('*')
      .in('store_id', storeIds)
      .gte('date', format(prevDateRange.from, 'yyyy-MM-dd'))
      .lte('date', format(prevDateRange.to, 'yyyy-MM-dd'));

    // Group stores by region
    const regionGroups = this.groupStoresByRegion(stores, granularity);
    
    // Calculate regional performance
    const regions = await this.calculateRegionalPerformance(
      regionGroups,
      snapshots || [],
      prevSnapshots || []
    );

    // Generate global insights
    const globalMetrics = this.calculateGlobalMetrics(regions);
    const marketPenetration = this.analyzeMarketPenetration(regions);
    const competitiveAnalysis = this.analyzeCompetitivePosition(regions);
    const recommendations = this.generateRecommendations(regions, marketPenetration, competitiveAnalysis);

    return {
      regions,
      globalMetrics,
      marketPenetration,
      competitiveAnalysis,
      recommendations
    };
  }

  async getLocationIntelligence(
    ownerId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<LocationIntelligence> {
    const stores = await this.getStoresWithLocation(ownerId);
    
    // Get customer data (would need to be implemented with actual customer tracking)
    const customerData = await this.getCustomerLocationData(stores.map(s => s.id), dateRange);
    
    const storeOptimization = await this.analyzeStoreOptimization(stores, customerData);
    const territoryAnalysis = this.analyzeTerritoryMapping(stores, customerData);
    const customerDistribution = this.analyzeCustomerDistribution(customerData);

    return {
      storeOptimization,
      territoryAnalysis,
      customerDistribution
    };
  }

  async identifyExpansionOpportunities(
    ownerId: string,
    targetRegions: string[],
    criteria: {
      minPopulation?: number;
      maxCompetition?: number;
      minIncomeLevel?: number;
      preferredDemographics?: string[];
    } = {}
  ) {
    const stores = await this.getStoresWithLocation(ownerId);
    const existingRegions = new Set(stores.map(s => this.extractRegion(s.location, 'country')));

    const opportunities = [];

    for (const region of targetRegions) {
      if (existingRegions.has(region)) continue;

      const analysis = await this.analyzeExpansionPotential(region, criteria);
      
      if (analysis.score > 0.6) { // Threshold for viable opportunities
        opportunities.push({
          region,
          score: analysis.score,
          market: analysis.market,
          competition: analysis.competition,
          demographics: analysis.demographics,
          investment: analysis.estimatedInvestment,
          timeline: analysis.suggestedTimeline,
          risks: analysis.risks,
          recommendations: analysis.recommendations
        });
      }
    }

    return opportunities.sort((a, b) => b.score - a.score);
  }

  private async getStoresWithLocation(ownerId: string) {
    const { data: stores, error } = await this.supabase
      .from('stores')
      .select('id, shop_name, shop_domain, settings')
      .eq('owner_id', ownerId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to fetch stores', error);
      throw new Error('Failed to fetch stores');
    }

    return (stores || []).map(store => {
      // Extract location from settings or infer from domain
      const settings = store.settings as any;
      const location = settings?.location || this.inferLocationFromDomain(store.shop_domain);

      return {
        ...store,
        location
      };
    });
  }

  private groupStoresByRegion(
    stores: any[],
    granularity: 'country' | 'state' | 'city'
  ): Record<string, any[]> {
    const regionGroups: Record<string, any[]> = {};

    stores.forEach(store => {
      const region = this.extractRegion(store.location, granularity);
      
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      
      regionGroups[region].push(store);
    });

    return regionGroups;
  }

  private async calculateRegionalPerformance(
    regionGroups: Record<string, any[]>,
    snapshots: any[],
    prevSnapshots: any[]
  ): Promise<RegionalPerformance[]> {
    const regions: RegionalPerformance[] = [];

    for (const [regionName, stores] of Object.entries(regionGroups)) {
      const storeIds = stores.map(s => s.id);
      
      // Current period metrics
      const currentSnapshots = snapshots.filter(s => storeIds.includes(s.store_id));
      const currentTotals = this.aggregateMetrics(currentSnapshots);

      // Previous period metrics
      const prevCurrentSnapshots = prevSnapshots.filter(s => storeIds.includes(s.store_id));
      const prevTotals = this.aggregateMetrics(prevCurrentSnapshots);

      // Calculate growth rates
      const growth = {
        revenue: this.calculateGrowthRate(currentTotals.revenue, prevTotals.revenue),
        orders: this.calculateGrowthRate(currentTotals.orders, prevTotals.orders),
        visitors: this.calculateGrowthRate(currentTotals.visitors, prevTotals.visitors),
        customers: this.calculateGrowthRate(currentTotals.visitors, prevTotals.visitors) // Simplified
      };

      // Mock demographics and seasonality (would need real data sources)
      const demographics = this.generateDemographicsData(regionName);
      const seasonality = this.analyzeSeasonality(currentSnapshots);
      const opportunities = this.identifyOpportunities(currentTotals, growth, regionName);

      const region: GeographicRegion = {
        id: regionName.toLowerCase().replace(/\s+/g, '-'),
        name: regionName,
        code: this.getRegionCode(regionName),
        type: 'country',
        coordinates: this.getRegionCoordinates(regionName)
      };

      regions.push({
        region,
        stores: stores.map(store => ({
          storeId: store.id,
          storeName: store.shop_name,
          location: {
            address: store.location?.address,
            coordinates: store.location?.coordinates
          }
        })),
        metrics: {
          revenue: currentTotals.revenue,
          orders: currentTotals.orders,
          visitors: currentTotals.visitors,
          avgOrderValue: currentTotals.orders > 0 ? currentTotals.revenue / currentTotals.orders : 0,
          conversionRate: currentTotals.visitors > 0 ? (currentTotals.orders / currentTotals.visitors) * 100 : 0,
          customerCount: currentTotals.visitors, // Simplified
          marketShare: this.calculateMarketShare(currentTotals.revenue, regionName)
        },
        growth,
        demographics,
        seasonality,
        opportunities
      });
    }

    return regions;
  }

  private calculateGlobalMetrics(regions: RegionalPerformance[]) {
    const totalRevenue = regions.reduce((sum, r) => sum + r.metrics.revenue, 0);
    
    const bestPerformingRegion = regions.reduce((best, region) => 
      region.metrics.revenue > best.metrics.revenue ? region : best
    );

    const fastestGrowingRegion = regions.reduce((fastest, region) => 
      region.growth.revenue > fastest.growth.revenue ? region : fastest
    );

    const mostPotentialRegion = regions.reduce((potential, region) => {
      const potentialScore = region.opportunities.expansionPotential + 
                            (region.growth.revenue / 100) + 
                            (region.metrics.marketShare < 10 ? 20 : 0); // Boost for low market share
      
      const currentBestScore = potential.opportunities.expansionPotential + 
                              (potential.growth.revenue / 100) + 
                              (potential.metrics.marketShare < 10 ? 20 : 0);
      
      return potentialScore > currentBestScore ? region : potential;
    });

    return {
      totalMarkets: regions.length,
      bestPerformingRegion,
      fastestGrowingRegion,
      mostPotentialRegion
    };
  }

  private analyzeMarketPenetration(regions: RegionalPerformance[]) {
    const saturatedMarkets: string[] = [];
    const emergingMarkets: string[] = [];
    const untappedMarkets: string[] = [];
    const expansionScore: Record<string, number> = {};

    regions.forEach(region => {
      const marketShare = region.metrics.marketShare;
      const growthRate = region.growth.revenue;
      
      if (marketShare > 25) {
        saturatedMarkets.push(region.region.name);
      } else if (marketShare > 5 && growthRate > 15) {
        emergingMarkets.push(region.region.name);
      } else if (marketShare < 5) {
        untappedMarkets.push(region.region.name);
      }

      // Calculate expansion score
      expansionScore[region.region.name] = 
        (100 - marketShare) * 0.4 + // Market opportunity
        Math.min(growthRate, 50) * 0.3 + // Growth potential
        region.opportunities.expansionPotential * 0.3; // Expansion potential
    });

    return {
      saturatedMarkets,
      emergingMarkets,
      untappedMarkets,
      expansionScore
    };
  }

  private analyzeCompetitivePosition(regions: RegionalPerformance[]) {
    const marketLeader: Record<string, string> = {};
    const competitivePosition: Record<string, 'leader' | 'challenger' | 'follower' | 'niche'> = {};
    const threatLevel: Record<string, 'low' | 'medium' | 'high'> = {};

    regions.forEach(region => {
      const marketShare = region.metrics.marketShare;
      const growthRate = region.growth.revenue;

      // Determine market leader (simplified - in reality would need competitor data)
      marketLeader[region.region.name] = marketShare > 30 ? 'Your Company' : 'Competitors';

      // Determine competitive position
      if (marketShare > 30) {
        competitivePosition[region.region.name] = 'leader';
      } else if (marketShare > 15) {
        competitivePosition[region.region.name] = 'challenger';
      } else if (marketShare > 5) {
        competitivePosition[region.region.name] = 'follower';
      } else {
        competitivePosition[region.region.name] = 'niche';
      }

      // Assess threat level
      if (marketShare < 10 && growthRate < 0) {
        threatLevel[region.region.name] = 'high';
      } else if (marketShare < 20 && growthRate < 5) {
        threatLevel[region.region.name] = 'medium';
      } else {
        threatLevel[region.region.name] = 'low';
      }
    });

    return {
      marketLeader,
      competitivePosition,
      threatLevel
    };
  }

  private generateRecommendations(
    regions: RegionalPerformance[],
    marketPenetration: any,
    competitiveAnalysis: any
  ) {
    const priorityMarkets: string[] = [];
    const investmentAllocation: Record<string, number> = {};
    const marketingStrategies: Record<string, string[]> = {};
    const operationalOptimizations: string[] = [];

    // Identify priority markets
    Object.entries(marketPenetration.expansionScore)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .forEach(([market]) => priorityMarkets.push(market));

    // Calculate investment allocation
    const totalExpansionScore = Object.values(marketPenetration.expansionScore)
      .reduce((sum: number, score) => sum + (score as number), 0);

    regions.forEach(region => {
      const score = marketPenetration.expansionScore[region.region.name];
      investmentAllocation[region.region.name] = (score / totalExpansionScore) * 100;
    });

    // Generate marketing strategies
    regions.forEach(region => {
      const strategies: string[] = [];
      
      if (competitiveAnalysis.competitivePosition[region.region.name] === 'leader') {
        strategies.push('Defend market position', 'Premium positioning', 'Customer retention focus');
      } else if (competitiveAnalysis.competitivePosition[region.region.name] === 'challenger') {
        strategies.push('Aggressive expansion', 'Competitive pricing', 'Innovation focus');
      } else {
        strategies.push('Niche targeting', 'Value positioning', 'Market education');
      }

      if (region.growth.revenue > 20) {
        strategies.push('Scale successful campaigns', 'Increase market share');
      } else if (region.growth.revenue < 0) {
        strategies.push('Market research', 'Strategy pivot', 'Cost optimization');
      }

      marketingStrategies[region.region.name] = strategies;
    });

    // Operational optimizations
    operationalOptimizations.push(
      'Optimize supply chain for high-growth regions',
      'Standardize successful practices across regions',
      'Implement regional customization strategies',
      'Establish regional customer support centers'
    );

    return {
      priorityMarkets,
      investmentAllocation,
      marketingStrategies,
      operationalOptimizations
    };
  }

  // Helper methods
  private inferLocationFromDomain(domain: string) {
    // Simple domain-based location inference
    const tld = domain.split('.').pop()?.toLowerCase();
    const locationMap: Record<string, any> = {
      'com': { country: 'United States', region: 'North America' },
      'ca': { country: 'Canada', region: 'North America' },
      'uk': { country: 'United Kingdom', region: 'Europe' },
      'au': { country: 'Australia', region: 'Oceania' },
      'de': { country: 'Germany', region: 'Europe' },
      'fr': { country: 'France', region: 'Europe' },
      'jp': { country: 'Japan', region: 'Asia' },
    };

    return locationMap[tld || 'com'] || { country: 'United States', region: 'North America' };
  }

  private extractRegion(location: any, granularity: 'country' | 'state' | 'city'): string {
    if (!location) return 'Unknown';
    
    switch (granularity) {
      case 'country':
        return location.country || 'Unknown';
      case 'state':
        return location.state || location.region || location.country || 'Unknown';
      case 'city':
        return location.city || location.state || location.country || 'Unknown';
      default:
        return location.country || 'Unknown';
    }
  }

  private aggregateMetrics(snapshots: any[]) {
    return snapshots.reduce(
      (acc, snapshot) => ({
        revenue: acc.revenue + snapshot.revenue,
        orders: acc.orders + snapshot.orders_count,
        visitors: acc.visitors + snapshot.unique_visitors,
        pageViews: acc.pageViews + snapshot.page_views
      }),
      { revenue: 0, orders: 0, visitors: 0, pageViews: 0 }
    );
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private generateDemographicsData(regionName: string) {
    // Mock demographics - would integrate with real demographic APIs
    return {
      ageGroups: {
        '18-24': 15,
        '25-34': 28,
        '35-44': 24,
        '45-54': 18,
        '55+': 15
      },
      genderSplit: {
        'Male': 48,
        'Female': 50,
        'Other': 2
      },
      incomeRanges: {
        'Under $30k': 20,
        '$30k-$60k': 35,
        '$60k-$100k': 30,
        'Over $100k': 15
      }
    };
  }

  private analyzeSeasonality(snapshots: any[]) {
    if (snapshots.length === 0) {
      return {
        peak: 'Unknown',
        low: 'Unknown',
        patterns: {}
      };
    }

    // Simple seasonality analysis
    const monthlyRevenue: Record<string, number> = {};
    
    snapshots.forEach(snapshot => {
      const month = new Date(snapshot.date).toLocaleDateString('en-US', { month: 'long' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + snapshot.revenue;
    });

    const sortedMonths = Object.entries(monthlyRevenue)
      .sort(([,a], [,b]) => (b as number) - (a as number));

    return {
      peak: sortedMonths[0]?.[0] || 'Unknown',
      low: sortedMonths[sortedMonths.length - 1]?.[0] || 'Unknown',
      patterns: monthlyRevenue
    };
  }

  private identifyOpportunities(metrics: any, growth: any, regionName: string) {
    const opportunities = {
      untappedSegments: [] as string[],
      expansionPotential: 0,
      competitiveAdvantage: [] as string[]
    };

    // Identify untapped segments
    if (metrics.conversionRate < 2) {
      opportunities.untappedSegments.push('Conversion optimization');
    }
    if (metrics.avgOrderValue < 50) {
      opportunities.untappedSegments.push('Premium products');
    }
    if (growth.visitors > 20 && growth.revenue < 10) {
      opportunities.untappedSegments.push('Monetization improvement');
    }

    // Calculate expansion potential
    opportunities.expansionPotential = Math.max(0, Math.min(100,
      (growth.revenue / 10) + 
      (growth.visitors / 10) + 
      (metrics.conversionRate < 3 ? 30 : 0) +
      (metrics.marketShare < 15 ? 20 : 0)
    ));

    // Identify competitive advantages
    if (growth.revenue > 15) {
      opportunities.competitiveAdvantage.push('Strong growth momentum');
    }
    if (metrics.conversionRate > 3) {
      opportunities.competitiveAdvantage.push('High conversion rates');
    }
    if (metrics.avgOrderValue > 75) {
      opportunities.competitiveAdvantage.push('Premium positioning');
    }

    return opportunities;
  }

  private calculateMarketShare(revenue: number, regionName: string): number {
    // Mock market share calculation - would need industry data
    const mockMarketSizes: Record<string, number> = {
      'United States': 1000000,
      'Canada': 300000,
      'United Kingdom': 400000,
      'Germany': 500000,
      'France': 450000,
      'Australia': 200000,
      'Japan': 600000
    };

    const marketSize = mockMarketSizes[regionName] || 100000;
    return Math.min(100, (revenue / marketSize) * 100);
  }

  private getRegionCode(regionName: string): string {
    const codes: Record<string, string> = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'UK',
      'Germany': 'DE',
      'France': 'FR',
      'Australia': 'AU',
      'Japan': 'JP'
    };

    return codes[regionName] || 'XX';
  }

  private getRegionCoordinates(regionName: string) {
    const coordinates: Record<string, { lat: number; lng: number }> = {
      'United States': { lat: 39.8283, lng: -98.5795 },
      'Canada': { lat: 56.1304, lng: -106.3468 },
      'United Kingdom': { lat: 55.3781, lng: -3.4360 },
      'Germany': { lat: 51.1657, lng: 10.4515 },
      'France': { lat: 46.2276, lng: 2.2137 },
      'Australia': { lat: -25.2744, lng: 133.7751 },
      'Japan': { lat: 36.2048, lng: 138.2529 }
    };

    return coordinates[regionName];
  }

  // Placeholder methods for location intelligence (would need additional data sources)
  private async getCustomerLocationData(storeIds: string[], dateRange: { from: Date; to: Date }) {
    // Mock customer location data
    return [];
  }

  private async analyzeStoreOptimization(stores: any[], customerData: any[]) {
    return stores.map(store => ({
      storeId: store.id,
      storeName: store.shop_name,
      location: store.location?.coordinates || { lat: 0, lng: 0 },
      performance: 'good' as const,
      factors: {
        footTraffic: 75,
        competition: 60,
        demographics: 80,
        accessibility: 85,
        marketSaturation: 40
      },
      recommendations: [
        'Optimize local SEO',
        'Enhance customer experience',
        'Expand product range'
      ],
      expansionOpportunities: []
    }));
  }

  private analyzeTerritoryMapping(stores: any[], customerData: any[]) {
    return {
      coverage: 65,
      gaps: [],
      overlap: []
    };
  }

  private analyzeCustomerDistribution(customerData: any[]) {
    return {
      heatmap: [],
      drivingPatterns: {
        averageDistance: 15,
        maxDistance: 50,
        preferredLocations: []
      }
    };
  }

  private async analyzeExpansionPotential(region: string, criteria: any) {
    // Mock expansion analysis
    return {
      score: Math.random() * 0.4 + 0.6, // Random score between 0.6-1.0
      market: {
        size: 1000000,
        growth: 15,
        saturation: 30
      },
      competition: {
        level: 'medium',
        majorPlayers: ['Competitor A', 'Competitor B'],
        barriers: ['Brand recognition', 'Distribution']
      },
      demographics: {
        targetMatch: 85,
        purchasing: 'high',
        digital: 90
      },
      estimatedInvestment: 500000,
      suggestedTimeline: '12-18 months',
      risks: ['Market volatility', 'Regulatory changes'],
      recommendations: ['Partner with local distributor', 'Gradual market entry']
    };
  }
}