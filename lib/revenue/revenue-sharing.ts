/**
 * Mercury Revenue Sharing System
 * Handles revenue distribution between Mercury platform and extension developers
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// Revenue Sharing Models
export type RevenueSharingModel = 'percentage' | 'fixed' | 'tiered' | 'subscription';

// Revenue Transaction Types
export type TransactionType = 
  | 'extension_purchase' 
  | 'subscription_payment' 
  | 'commission_split' 
  | 'refund' 
  | 'chargeback'
  | 'bonus_payment';

// Payment Status
export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'disputed';

// Revenue Transaction
export interface RevenueTransaction {
  id: string;
  type: TransactionType;
  extensionId: string;
  developerId: string;
  customerId: string;
  orderId?: string;
  grossAmount: number;
  currency: string;
  platformFee: number;
  developerShare: number;
  taxes: number;
  processingFee: number;
  netAmount: number;
  status: PaymentStatus;
  createdAt: Date;
  processedAt?: Date;
  metadata: Record<string, any>;
}

// Revenue Sharing Configuration
export interface RevenueSharingConfig {
  model: RevenueSharingModel;
  platformFeePercentage: number;
  minimumPayout: number;
  payoutSchedule: 'weekly' | 'biweekly' | 'monthly';
  payoutDay: number; // Day of week/month
  currency: string;
  taxHandling: 'inclusive' | 'exclusive';
  processingFeeHandling: 'platform' | 'developer' | 'split';
}

// Tiered Revenue Sharing
export interface TieredRevenue {
  minAmount: number;
  maxAmount: number;
  platformFeePercentage: number;
}

// Developer Payout Information
export interface DeveloperPayout {
  id: string;
  developerId: string;
  period: string; // YYYY-MM format
  totalRevenue: number;
  platformFees: number;
  developerShare: number;
  taxes: number;
  processingFees: number;
  netPayout: number;
  transactionCount: number;
  status: PaymentStatus;
  scheduledDate: Date;
  paidDate?: Date;
  paymentMethod: string;
  paymentReference?: string;
  currency: string;
}

// Revenue Analytics
export interface RevenueAnalytics {
  period: string;
  totalRevenue: number;
  platformRevenue: number;
  developerRevenue: number;
  transactionCount: number;
  averageTransactionValue: number;
  topExtensions: Array<{
    extensionId: string;
    name: string;
    revenue: number;
    transactions: number;
  }>;
  topDevelopers: Array<{
    developerId: string;
    name: string;
    revenue: number;
    extensions: number;
  }>;
}

// Validation Schemas
const RevenueTransactionSchema = z.object({
  type: z.enum(['extension_purchase', 'subscription_payment', 'commission_split', 'refund', 'chargeback', 'bonus_payment']),
  extensionId: z.string().min(1),
  developerId: z.string().min(1),
  customerId: z.string().min(1),
  orderId: z.string().optional(),
  grossAmount: z.number().positive(),
  currency: z.string().length(3),
  metadata: z.record(z.any()).default({})
});

const RevenueSharingConfigSchema = z.object({
  model: z.enum(['percentage', 'fixed', 'tiered', 'subscription']),
  platformFeePercentage: z.number().min(0).max(100),
  minimumPayout: z.number().min(0),
  payoutSchedule: z.enum(['weekly', 'biweekly', 'monthly']),
  payoutDay: z.number().min(1).max(31),
  currency: z.string().length(3),
  taxHandling: z.enum(['inclusive', 'exclusive']),
  processingFeeHandling: z.enum(['platform', 'developer', 'split'])
});

export class RevenueSharingSystem extends EventEmitter {
  private transactions: Map<string, RevenueTransaction> = new Map();
  private payouts: Map<string, DeveloperPayout> = new Map();
  private configs: Map<string, RevenueSharingConfig> = new Map();
  private tieredStructures: Map<string, TieredRevenue[]> = new Map();

  constructor() {
    super();
    this.setupDefaultConfigurations();
    this.startPayoutScheduler();
  }

  /**
   * Process a revenue transaction
   */
  async processTransaction(
    transactionData: Omit<RevenueTransaction, 'id' | 'platformFee' | 'developerShare' | 'taxes' | 'processingFee' | 'netAmount' | 'status' | 'createdAt'>
  ): Promise<string> {
    // Validate transaction data
    RevenueTransactionSchema.parse(transactionData);

    const config = await this.getRevenueSharingConfig(transactionData.extensionId);
    
    // Calculate fees and shares
    const fees = await this.calculateFees(transactionData.grossAmount, config);
    
    const transaction: RevenueTransaction = {
      id: this.generateTransactionId(),
      ...transactionData,
      ...fees,
      status: 'pending',
      createdAt: new Date()
    };

    // Store transaction
    this.transactions.set(transaction.id, transaction);

    // Process payment
    await this.processPayment(transaction);

    this.emit('transaction:created', { 
      transactionId: transaction.id, 
      developerId: transaction.developerId,
      amount: transaction.grossAmount 
    });

    return transaction.id;
  }

  /**
   * Calculate fees and revenue splits
   */
  async calculateFees(
    grossAmount: number, 
    config: RevenueSharingConfig
  ): Promise<{
    platformFee: number;
    developerShare: number;
    taxes: number;
    processingFee: number;
    netAmount: number;
  }> {
    let platformFeePercentage = config.platformFeePercentage;

    // Apply tiered structure if applicable
    if (config.model === 'tiered') {
      const tieredStructure = this.tieredStructures.get('default') || [];
      const tier = tieredStructure.find(t => 
        grossAmount >= t.minAmount && grossAmount <= t.maxAmount
      );
      if (tier) {
        platformFeePercentage = tier.platformFeePercentage;
      }
    }

    // Calculate platform fee
    const platformFee = grossAmount * (platformFeePercentage / 100);
    
    // Calculate processing fee (typically 2.9% + $0.30)
    const processingFee = (grossAmount * 0.029) + 0.30;
    
    // Calculate taxes (simplified - in production, use tax service)
    const taxes = config.taxHandling === 'inclusive' ? 0 : grossAmount * 0.08; // 8% tax rate
    
    // Calculate developer share
    let developerShare = grossAmount - platformFee;
    
    // Adjust for processing fees
    switch (config.processingFeeHandling) {
      case 'platform':
        // Platform absorbs processing fees
        break;
      case 'developer':
        developerShare -= processingFee;
        break;
      case 'split':
        developerShare -= processingFee / 2;
        break;
    }

    // Adjust for taxes
    if (config.taxHandling === 'exclusive') {
      developerShare -= taxes;
    }

    const netAmount = developerShare;

    return {
      platformFee,
      developerShare,
      taxes,
      processingFee,
      netAmount: Math.max(0, netAmount) // Ensure non-negative
    };
  }

  /**
   * Process refund
   */
  async processRefund(
    originalTransactionId: string,
    refundAmount: number,
    reason: string
  ): Promise<string> {
    const originalTransaction = this.transactions.get(originalTransactionId);
    if (!originalTransaction) {
      throw new Error(`Original transaction not found: ${originalTransactionId}`);
    }

    if (refundAmount > originalTransaction.grossAmount) {
      throw new Error('Refund amount cannot exceed original transaction amount');
    }

    const config = await this.getRevenueSharingConfig(originalTransaction.extensionId);
    const fees = await this.calculateFees(refundAmount, config);

    const refundTransaction: RevenueTransaction = {
      id: this.generateTransactionId(),
      type: 'refund',
      extensionId: originalTransaction.extensionId,
      developerId: originalTransaction.developerId,
      customerId: originalTransaction.customerId,
      orderId: originalTransaction.orderId,
      grossAmount: -refundAmount, // Negative amount for refund
      currency: originalTransaction.currency,
      platformFee: -fees.platformFee,
      developerShare: -fees.developerShare,
      taxes: -fees.taxes,
      processingFee: -fees.processingFee,
      netAmount: -fees.netAmount,
      status: 'pending',
      createdAt: new Date(),
      metadata: {
        originalTransactionId,
        reason,
        refundType: 'partial'
      }
    };

    this.transactions.set(refundTransaction.id, refundTransaction);

    await this.processPayment(refundTransaction);

    this.emit('refund:processed', {
      refundId: refundTransaction.id,
      originalTransactionId,
      amount: refundAmount,
      reason
    });

    return refundTransaction.id;
  }

  /**
   * Generate developer payout
   */
  async generatePayout(developerId: string, period: string): Promise<string> {
    const transactions = this.getTransactionsForPeriod(developerId, period);
    
    if (transactions.length === 0) {
      throw new Error('No transactions found for the specified period');
    }

    const totalRevenue = transactions.reduce((sum, t) => sum + t.grossAmount, 0);
    const platformFees = transactions.reduce((sum, t) => sum + t.platformFee, 0);
    const developerShare = transactions.reduce((sum, t) => sum + t.developerShare, 0);
    const taxes = transactions.reduce((sum, t) => sum + t.taxes, 0);
    const processingFees = transactions.reduce((sum, t) => sum + t.processingFee, 0);
    const netPayout = transactions.reduce((sum, t) => sum + t.netAmount, 0);

    // Check minimum payout threshold
    const config = await this.getRevenueSharingConfig(transactions[0].extensionId);
    if (netPayout < config.minimumPayout) {
      throw new Error(`Payout amount ${netPayout} below minimum threshold ${config.minimumPayout}`);
    }

    const payout: DeveloperPayout = {
      id: this.generatePayoutId(),
      developerId,
      period,
      totalRevenue,
      platformFees,
      developerShare,
      taxes,
      processingFees,
      netPayout,
      transactionCount: transactions.length,
      status: 'pending',
      scheduledDate: this.calculateNextPayoutDate(config),
      paymentMethod: 'bank_transfer', // Default method
      currency: config.currency
    };

    this.payouts.set(payout.id, payout);

    this.emit('payout:scheduled', {
      payoutId: payout.id,
      developerId,
      amount: netPayout,
      scheduledDate: payout.scheduledDate
    });

    return payout.id;
  }

  /**
   * Execute developer payout
   */
  async executePayout(payoutId: string): Promise<void> {
    const payout = this.payouts.get(payoutId);
    if (!payout) {
      throw new Error(`Payout not found: ${payoutId}`);
    }

    if (payout.status !== 'pending') {
      throw new Error(`Payout already processed: ${payout.status}`);
    }

    try {
      payout.status = 'processing';
      
      // In production, integrate with payment processor (Stripe Connect, PayPal, etc.)
      const paymentReference = await this.processPayoutPayment(payout);
      
      payout.status = 'completed';
      payout.paidDate = new Date();
      payout.paymentReference = paymentReference;

      this.emit('payout:completed', {
        payoutId,
        developerId: payout.developerId,
        amount: payout.netPayout,
        paymentReference
      });

    } catch (error) {
      payout.status = 'failed';
      
      this.emit('payout:failed', {
        payoutId,
        developerId: payout.developerId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(period: string): Promise<RevenueAnalytics> {
    const transactions = this.getTransactionsForPeriod(null, period);
    
    const totalRevenue = transactions.reduce((sum, t) => sum + t.grossAmount, 0);
    const platformRevenue = transactions.reduce((sum, t) => sum + t.platformFee, 0);
    const developerRevenue = transactions.reduce((sum, t) => sum + t.developerShare, 0);
    
    // Group by extension
    const extensionRevenue = new Map<string, { revenue: number; transactions: number; name: string }>();
    const developerRevenue2 = new Map<string, { revenue: number; extensions: Set<string>; name: string }>();
    
    for (const transaction of transactions) {
      // Extension revenue
      const extData = extensionRevenue.get(transaction.extensionId) || 
        { revenue: 0, transactions: 0, name: `Extension ${transaction.extensionId}` };
      extData.revenue += transaction.grossAmount;
      extData.transactions += 1;
      extensionRevenue.set(transaction.extensionId, extData);
      
      // Developer revenue
      const devData = developerRevenue2.get(transaction.developerId) || 
        { revenue: 0, extensions: new Set(), name: `Developer ${transaction.developerId}` };
      devData.revenue += transaction.developerShare;
      devData.extensions.add(transaction.extensionId);
      developerRevenue2.set(transaction.developerId, devData);
    }

    return {
      period,
      totalRevenue,
      platformRevenue,
      developerRevenue,
      transactionCount: transactions.length,
      averageTransactionValue: totalRevenue / transactions.length || 0,
      topExtensions: Array.from(extensionRevenue.entries())
        .map(([id, data]) => ({ extensionId: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      topDevelopers: Array.from(developerRevenue2.entries())
        .map(([id, data]) => ({ 
          developerId: id, 
          name: data.name,
          revenue: data.revenue, 
          extensions: data.extensions.size 
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    };
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): RevenueTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Get payout by ID
   */
  getPayout(payoutId: string): DeveloperPayout | undefined {
    return this.payouts.get(payoutId);
  }

  /**
   * List transactions for developer
   */
  listTransactions(
    developerId?: string, 
    extensionId?: string, 
    limit = 100
  ): RevenueTransaction[] {
    return Array.from(this.transactions.values())
      .filter(t => !developerId || t.developerId === developerId)
      .filter(t => !extensionId || t.extensionId === extensionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * List payouts for developer
   */
  listPayouts(developerId?: string, limit = 50): DeveloperPayout[] {
    return Array.from(this.payouts.values())
      .filter(p => !developerId || p.developerId === developerId)
      .sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime())
      .slice(0, limit);
  }

  /**
   * Set revenue sharing configuration
   */
  setRevenueSharingConfig(extensionId: string, config: RevenueSharingConfig): void {
    RevenueSharingConfigSchema.parse(config);
    this.configs.set(extensionId, config);
    
    this.emit('config:updated', { extensionId, config });
  }

  /**
   * Set tiered revenue structure
   */
  setTieredStructure(name: string, tiers: TieredRevenue[]): void {
    // Validate tiers
    tiers.sort((a, b) => a.minAmount - b.minAmount);
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].minAmount >= tiers[i].maxAmount) {
        throw new Error(`Invalid tier range: ${tiers[i].minAmount} >= ${tiers[i].maxAmount}`);
      }
      if (i > 0 && tiers[i].minAmount <= tiers[i - 1].maxAmount) {
        throw new Error('Tier ranges must not overlap');
      }
    }
    
    this.tieredStructures.set(name, tiers);
  }

  /**
   * Private: Get revenue sharing configuration
   */
  private async getRevenueSharingConfig(extensionId: string): Promise<RevenueSharingConfig> {
    return this.configs.get(extensionId) || this.configs.get('default')!;
  }

  /**
   * Private: Process payment
   */
  private async processPayment(transaction: RevenueTransaction): Promise<void> {
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      
    } catch (error) {
      transaction.status = 'failed';
      throw error;
    }
  }

  /**
   * Private: Process payout payment
   */
  private async processPayoutPayment(payout: DeveloperPayout): Promise<string> {
    // In production, integrate with payment processor
    await new Promise(resolve => setTimeout(resolve, 2000));
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Get transactions for period
   */
  private getTransactionsForPeriod(
    developerId: string | null, 
    period: string
  ): RevenueTransaction[] {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return Array.from(this.transactions.values())
      .filter(t => !developerId || t.developerId === developerId)
      .filter(t => t.createdAt >= startDate && t.createdAt <= endDate)
      .filter(t => t.status === 'completed');
  }

  /**
   * Private: Calculate next payout date
   */
  private calculateNextPayoutDate(config: RevenueSharingConfig): Date {
    const now = new Date();
    
    switch (config.payoutSchedule) {
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + (7 - now.getDay()) + config.payoutDay);
        return nextWeek;
        
      case 'biweekly':
        const nextBiweek = new Date(now);
        nextBiweek.setDate(now.getDate() + 14);
        return nextBiweek;
        
      case 'monthly':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, config.payoutDay);
        return nextMonth;
        
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 1 week
    }
  }

  /**
   * Private: Generate transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Generate payout ID
   */
  private generatePayoutId(): string {
    return `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Setup default configurations
   */
  private setupDefaultConfigurations(): void {
    // Default revenue sharing configuration
    const defaultConfig: RevenueSharingConfig = {
      model: 'tiered',
      platformFeePercentage: 20, // 20% base rate
      minimumPayout: 50, // $50 minimum
      payoutSchedule: 'monthly',
      payoutDay: 15, // 15th of each month
      currency: 'USD',
      taxHandling: 'exclusive',
      processingFeeHandling: 'split'
    };
    
    this.configs.set('default', defaultConfig);

    // Default tiered structure
    const defaultTiers: TieredRevenue[] = [
      { minAmount: 0, maxAmount: 1000, platformFeePercentage: 30 },
      { minAmount: 1000, maxAmount: 5000, platformFeePercentage: 25 },
      { minAmount: 5000, maxAmount: 20000, platformFeePercentage: 20 },
      { minAmount: 20000, maxAmount: Infinity, platformFeePercentage: 15 }
    ];
    
    this.setTieredStructure('default', defaultTiers);
  }

  /**
   * Private: Start payout scheduler
   */
  private startPayoutScheduler(): void {
    // Check for due payouts every hour
    setInterval(() => {
      this.processDuePayouts();
    }, 60 * 60 * 1000);
  }

  /**
   * Private: Process due payouts
   */
  private async processDuePayouts(): Promise<void> {
    const now = new Date();
    
    for (const payout of this.payouts.values()) {
      if (payout.status === 'pending' && payout.scheduledDate <= now) {
        try {
          await this.executePayout(payout.id);
        } catch (error) {
          console.error(`Failed to execute payout ${payout.id}:`, error.message);
        }
      }
    }
  }
}

// Export singleton instance
export const revenueSharingSystem = new RevenueSharingSystem();

// Export constants
export const REVENUE_SHARING_EVENTS = {
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_COMPLETED: 'transaction:completed',
  TRANSACTION_FAILED: 'transaction:failed',
  REFUND_PROCESSED: 'refund:processed',
  PAYOUT_SCHEDULED: 'payout:scheduled',
  PAYOUT_COMPLETED: 'payout:completed',
  PAYOUT_FAILED: 'payout:failed',
  CONFIG_UPDATED: 'config:updated'
} as const;