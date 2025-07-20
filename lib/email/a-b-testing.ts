import { createClient } from '@/lib/supabase/server';

export interface ABTestVariant {
  id: string;
  name: string;
  subject_line?: string;
  content?: string;
  send_time?: string;
  from_name?: string;
  weight: number; // Percentage of traffic to send to this variant
}

export interface ABTest {
  id: string;
  name: string;
  campaign_id: string;
  test_type: 'subject_line' | 'content' | 'send_time' | 'from_name' | 'full_email';
  variants: ABTestVariant[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  start_date: string;
  end_date?: string;
  confidence_level: number; // Statistical confidence required to declare winner
  minimum_sample_size: number;
  winner_variant_id?: string;
}

export interface ABTestResults {
  variant_id: string;
  sends: number;
  opens: number;
  clicks: number;
  conversions: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

export class ABTestingEngine {
  /**
   * Create a new A/B test
   */
  async createABTest(test: Omit<ABTest, 'id' | 'status'>): Promise<ABTest> {
    const supabase = createClient();
    
    // Validate test configuration
    this.validateTestConfig(test);
    
    const { data, error } = await supabase
      .from('ab_tests')
      .insert({
        ...test,
        status: 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    // Create variant records
    await this.createTestVariants(data.id, test.variants);
    
    return data;
  }

  /**
   * Create subject line A/B test (most common)
   */
  async createSubjectLineTest(
    campaignId: string,
    subjectLines: string[],
    testName?: string
  ): Promise<ABTest> {
    const variants: ABTestVariant[] = subjectLines.map((subject, index) => ({
      id: `variant-${index + 1}`,
      name: `Variant ${String.fromCharCode(65 + index)}`, // A, B, C, etc.
      subject_line: subject,
      weight: Math.floor(100 / subjectLines.length) // Equal distribution
    }));

    // Adjust weights to sum to 100
    const remainder = 100 - variants.reduce((sum, v) => sum + v.weight, 0);
    if (remainder > 0) {
      variants[0].weight += remainder;
    }

    return this.createABTest({
      name: testName || `Subject Line Test - ${new Date().toISOString()}`,
      campaign_id: campaignId,
      test_type: 'subject_line',
      variants,
      start_date: new Date().toISOString(),
      confidence_level: 95,
      minimum_sample_size: 100
    });
  }

  /**
   * Create send time optimization test
   */
  async createSendTimeTest(
    campaignId: string,
    sendTimes: string[], // Array of hour strings like ['09:00', '14:00', '19:00']
    testName?: string
  ): Promise<ABTest> {
    const variants: ABTestVariant[] = sendTimes.map((time, index) => ({
      id: `time-variant-${index + 1}`,
      name: `${time} Send Time`,
      send_time: time,
      weight: Math.floor(100 / sendTimes.length)
    }));

    return this.createABTest({
      name: testName || `Send Time Test - ${new Date().toISOString()}`,
      campaign_id: campaignId,
      test_type: 'send_time',
      variants,
      start_date: new Date().toISOString(),
      confidence_level: 95,
      minimum_sample_size: 200
    });
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<void> {
    const supabase = createClient();
    
    // Validate test is ready to start
    const { data: test } = await supabase
      .from('ab_tests')
      .select('*, ab_test_variants(*)')
      .eq('id', testId)
      .single();

    if (!test) throw new Error('Test not found');
    if (test.status !== 'draft') throw new Error('Test must be in draft status to start');
    
    // Ensure weights sum to 100
    const totalWeight = test.ab_test_variants.reduce((sum: number, v: any) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error('Variant weights must sum to 100%');
    }

    await supabase
      .from('ab_tests')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', testId);
  }

  /**
   * Determine which variant to send to a recipient
   */
  async getVariantForRecipient(testId: string, recipientEmail: string): Promise<ABTestVariant | null> {
    const supabase = createClient();
    
    // Check if recipient already assigned to a variant
    const { data: assignment } = await supabase
      .from('ab_test_assignments')
      .select('*, ab_test_variants(*)')
      .eq('test_id', testId)
      .eq('recipient_email', recipientEmail)
      .single();

    if (assignment) {
      return assignment.ab_test_variants;
    }

    // Get test variants
    const { data: test } = await supabase
      .from('ab_tests')
      .select('*, ab_test_variants(*)')
      .eq('id', testId)
      .eq('status', 'running')
      .single();

    if (!test || !test.ab_test_variants) return null;

    // Assign recipient to variant based on weights
    const variant = this.assignToVariant(test.ab_test_variants, recipientEmail);
    
    // Store assignment
    await supabase.from('ab_test_assignments').insert({
      test_id: testId,
      variant_id: variant.id,
      recipient_email: recipientEmail,
      assigned_at: new Date().toISOString()
    });

    return variant;
  }

  /**
   * Assign recipient to variant using deterministic hash-based distribution
   */
  private assignToVariant(variants: ABTestVariant[], recipientEmail: string): ABTestVariant {
    // Create deterministic hash from email
    const hash = this.hashString(recipientEmail);
    const bucket = hash % 100; // 0-99

    // Find variant based on weights
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant
    return variants[0];
  }

  /**
   * Simple hash function for deterministic variant assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record test result (email send, open, click, conversion)
   */
  async recordTestResult(
    testId: string,
    variantId: string,
    recipientEmail: string,
    eventType: 'send' | 'open' | 'click' | 'conversion',
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = createClient();
    
    await supabase.from('ab_test_results').insert({
      test_id: testId,
      variant_id: variantId,
      recipient_email: recipientEmail,
      event_type: eventType,
      metadata,
      recorded_at: new Date().toISOString()
    });

    // Check if test should be completed
    await this.checkTestCompletion(testId);
  }

  /**
   * Get current test results
   */
  async getTestResults(testId: string): Promise<ABTestResults[]> {
    const supabase = createClient();
    
    const { data: results } = await supabase
      .from('ab_test_results')
      .select('*')
      .eq('test_id', testId);

    if (!results) return [];

    // Group by variant and calculate metrics
    const variantResults = new Map<string, any>();
    
    results.forEach(result => {
      if (!variantResults.has(result.variant_id)) {
        variantResults.set(result.variant_id, {
          variant_id: result.variant_id,
          sends: 0,
          opens: 0,
          clicks: 0,
          conversions: 0
        });
      }
      
      const variant = variantResults.get(result.variant_id);
      variant[`${result.event_type}s`]++;
    });

    // Calculate rates and confidence intervals
    return Array.from(variantResults.values()).map(variant => {
      const open_rate = variant.sends > 0 ? (variant.opens / variant.sends) * 100 : 0;
      const click_rate = variant.sends > 0 ? (variant.clicks / variant.sends) * 100 : 0;
      const conversion_rate = variant.sends > 0 ? (variant.conversions / variant.sends) * 100 : 0;

      return {
        ...variant,
        open_rate,
        click_rate,
        conversion_rate,
        confidence_interval: this.calculateConfidenceInterval(variant.opens, variant.sends)
      };
    });
  }

  /**
   * Check if test has reached statistical significance
   */
  async checkTestCompletion(testId: string): Promise<void> {
    const supabase = createClient();
    
    const { data: test } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .eq('status', 'running')
      .single();

    if (!test) return;

    const results = await this.getTestResults(testId);
    
    // Check minimum sample size
    const totalSends = results.reduce((sum, r) => sum + r.sends, 0);
    if (totalSends < test.minimum_sample_size) return;

    // Check for statistical significance
    const winner = this.determineWinner(results, test.confidence_level);
    
    if (winner) {
      await supabase
        .from('ab_tests')
        .update({
          status: 'completed',
          winner_variant_id: winner.variant_id,
          completed_at: new Date().toISOString()
        })
        .eq('id', testId);
    }
  }

  /**
   * Determine winner based on statistical significance
   */
  private determineWinner(results: ABTestResults[], confidenceLevel: number): ABTestResults | null {
    if (results.length < 2) return null;

    // Sort by click rate (primary metric)
    const sortedResults = results.sort((a, b) => b.click_rate - a.click_rate);
    const best = sortedResults[0];
    const second = sortedResults[1];

    // Simple statistical significance check
    // In production, you'd use more sophisticated statistical tests
    const isSignificant = this.isStatisticallySignificant(
      best.clicks, best.sends,
      second.clicks, second.sends,
      confidenceLevel
    );

    return isSignificant ? best : null;
  }

  /**
   * Simple statistical significance test
   * In production, use proper Z-test or Chi-square test
   */
  private isStatisticallySignificant(
    successesA: number, samplesA: number,
    successesB: number, samplesB: number,
    confidenceLevel: number
  ): boolean {
    // This is a simplified implementation
    // For production, use a proper statistical library
    const pA = successesA / samplesA;
    const pB = successesB / samplesB;
    
    const pooledP = (successesA + successesB) / (samplesA + samplesB);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/samplesA + 1/samplesB));
    
    const zScore = Math.abs(pA - pB) / se;
    const criticalValue = confidenceLevel === 95 ? 1.96 : 2.58; // 95% or 99%
    
    return zScore > criticalValue;
  }

  /**
   * Calculate confidence interval for conversion rate
   */
  private calculateConfidenceInterval(successes: number, trials: number): { lower: number; upper: number } {
    if (trials === 0) return { lower: 0, upper: 0 };
    
    const p = successes / trials;
    const z = 1.96; // 95% confidence
    const se = Math.sqrt((p * (1 - p)) / trials);
    
    return {
      lower: Math.max(0, (p - z * se) * 100),
      upper: Math.min(100, (p + z * se) * 100)
    };
  }

  /**
   * Validate test configuration
   */
  private validateTestConfig(test: Omit<ABTest, 'id' | 'status'>): void {
    if (test.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error('Variant weights must sum to 100%');
    }

    if (test.confidence_level < 80 || test.confidence_level > 99) {
      throw new Error('Confidence level must be between 80% and 99%');
    }

    if (test.minimum_sample_size < 50) {
      throw new Error('Minimum sample size must be at least 50');
    }
  }

  /**
   * Create variant records in database
   */
  private async createTestVariants(testId: string, variants: ABTestVariant[]): Promise<void> {
    const supabase = createClient();
    
    const variantRecords = variants.map(variant => ({
      test_id: testId,
      variant_id: variant.id,
      name: variant.name,
      subject_line: variant.subject_line,
      content: variant.content,
      send_time: variant.send_time,
      from_name: variant.from_name,
      weight: variant.weight
    }));

    await supabase.from('ab_test_variants').insert(variantRecords);
  }

  /**
   * Get test recommendations based on historical performance
   */
  async getTestRecommendations(campaignType: string): Promise<string[]> {
    const supabase = createClient();
    
    // Get successful tests for similar campaigns
    const { data: successfulTests } = await supabase
      .from('ab_tests')
      .select(`
        test_type,
        ab_test_variants(subject_line, content),
        winner_variant_id
      `)
      .eq('status', 'completed')
      .not('winner_variant_id', 'is', null);

    // Analyze patterns and return recommendations
    const recommendations = [];
    
    if (successfulTests) {
      // Extract successful subject line patterns
      const winningSubjects = successfulTests
        .filter(test => test.test_type === 'subject_line')
        .map(test => test.ab_test_variants.find((v: any) => v.id === test.winner_variant_id)?.subject_line)
        .filter(Boolean);

      if (winningSubjects.length > 0) {
        recommendations.push(
          'Consider subject lines with personalization (first name)',
          'Urgency words like "limited time" tend to perform well',
          'Questions in subject lines often increase open rates'
        );
      }
    }

    return recommendations;
  }
}

export const abTestingEngine = new ABTestingEngine();