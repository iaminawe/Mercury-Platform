import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface OrderStatus {
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
  items: OrderItem[];
  statusHistory: StatusUpdate[];
  canCancel: boolean;
  canReturn: boolean;
  returnDeadline?: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  sku?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
}

export interface StatusUpdate {
  status: string;
  message: string;
  timestamp: Date;
  location?: string;
  estimatedDelivery?: Date;
}

export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  status: string;
  events: TrackingEvent[];
  estimatedDelivery?: Date;
  lastUpdate: Date;
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  description: string;
  location?: string;
}

export class OrderTracker {
  private supabase;
  private trackingProviders: Map<string, string>;

  constructor() {
    this.supabase = createServerSupabaseClient();
    this.trackingProviders = new Map([
      ['ups', 'https://www.ups.com/track?trackingNumber='],
      ['fedex', 'https://www.fedex.com/fedextrack/?trackingNumber='],
      ['usps', 'https://tools.usps.com/go/TrackConfirmAction?tLabels='],
      ['dhl', 'https://www.dhl.com/en/express/tracking.html?AWB='],
      ['canada_post', 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=']
    ]);
  }

  async getOrderStatus(
    orderNumber: string, 
    customerEmail?: string
  ): Promise<OrderStatus | null> {
    try {
      let query = this.supabase
        .from('orders')
        .select(`
          *,
          order_line_items (
            *,
            products (title, image_url),
            product_variants (title, sku)
          ),
          shipping_address (*),
          order_status_updates (*)
        `)
        .eq('order_number', orderNumber);

      // Add email filter if provided for additional security
      if (customerEmail) {
        query = query.eq('email', customerEmail);
      }

      const { data: order, error } = await query.single();

      if (error || !order) {
        logger.warn(`Order not found: ${orderNumber}`, { customerEmail });
        return null;
      }

      // Get tracking information if available
      let trackingInfo: TrackingInfo | null = null;
      if (order.tracking_number && order.shipping_carrier) {
        trackingInfo = await this.getTrackingInfo(
          order.tracking_number,
          order.shipping_carrier
        );
      }

      return this.formatOrderStatus(order, trackingInfo);

    } catch (error) {
      logger.error('Error fetching order status:', error);
      return null;
    }
  }

  async getCustomerOrders(
    customerId: string,
    limit: number = 10
  ): Promise<OrderStatus[]> {
    try {
      const { data: orders } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_line_items (
            *,
            products (title, image_url),
            product_variants (title, sku)
          ),
          shipping_address (*),
          order_status_updates (*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return Promise.all(
        (orders || []).map(async (order) => {
          let trackingInfo: TrackingInfo | null = null;
          if (order.tracking_number && order.shipping_carrier) {
            trackingInfo = await this.getTrackingInfo(
              order.tracking_number,
              order.shipping_carrier
            );
          }
          return this.formatOrderStatus(order, trackingInfo);
        })
      );

    } catch (error) {
      logger.error('Error fetching customer orders:', error);
      return [];
    }
  }

  private formatOrderStatus(order: any, trackingInfo?: TrackingInfo | null): OrderStatus {
    const statusHistory = (order.order_status_updates || [])
      .map((update: any) => ({
        status: update.status,
        message: update.message,
        timestamp: new Date(update.created_at),
        location: update.location,
        estimatedDelivery: update.estimated_delivery ? new Date(update.estimated_delivery) : undefined
      }))
      .sort((a: StatusUpdate, b: StatusUpdate) => a.timestamp.getTime() - b.timestamp.getTime());

    const items: OrderItem[] = (order.order_line_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.products?.title || item.title,
      variantTitle: item.product_variants?.title,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.products?.image_url,
      sku: item.product_variants?.sku,
      status: item.status || order.status
    }));

    // Calculate return deadline (typically 30 days from delivery)
    const returnDeadline = order.status === 'delivered' && order.delivered_at
      ? new Date(new Date(order.delivered_at).getTime() + 30 * 24 * 60 * 60 * 1000)
      : undefined;

    return {
      orderNumber: order.order_number,
      status: order.status,
      total: order.total_price,
      currency: order.currency || 'USD',
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      estimatedDelivery: trackingInfo?.estimatedDelivery || 
        (order.estimated_delivery ? new Date(order.estimated_delivery) : undefined),
      trackingNumber: order.tracking_number,
      trackingUrl: this.generateTrackingUrl(order.tracking_number, order.shipping_carrier),
      shippingAddress: {
        name: order.shipping_address?.name || `${order.shipping_address?.first_name} ${order.shipping_address?.last_name}`,
        address1: order.shipping_address?.address1 || '',
        address2: order.shipping_address?.address2,
        city: order.shipping_address?.city || '',
        province: order.shipping_address?.province || '',
        country: order.shipping_address?.country || '',
        zip: order.shipping_address?.zip || ''
      },
      items,
      statusHistory,
      canCancel: this.canCancelOrder(order.status, order.created_at),
      canReturn: this.canReturnOrder(order.status, order.delivered_at),
      returnDeadline
    };
  }

  private async getTrackingInfo(
    trackingNumber: string,
    carrier: string
  ): Promise<TrackingInfo | null> {
    try {
      // In a real implementation, you would integrate with carrier APIs
      // For now, we'll simulate with cached data or external service
      
      const { data: cachedTracking } = await this.supabase
        .from('tracking_cache')
        .select('*')
        .eq('tracking_number', trackingNumber)
        .eq('carrier', carrier.toLowerCase())
        .gte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // 2 hours cache
        .single();

      if (cachedTracking) {
        return {
          carrier: carrier,
          trackingNumber: trackingNumber,
          trackingUrl: this.generateTrackingUrl(trackingNumber, carrier),
          status: cachedTracking.status,
          events: cachedTracking.events || [],
          estimatedDelivery: cachedTracking.estimated_delivery ? new Date(cachedTracking.estimated_delivery) : undefined,
          lastUpdate: new Date(cachedTracking.updated_at)
        };
      }

      // Fetch fresh tracking data (implement carrier API integration)
      const trackingData = await this.fetchCarrierTracking(trackingNumber, carrier);
      
      if (trackingData) {
        // Cache the result
        await this.supabase
          .from('tracking_cache')
          .upsert({
            tracking_number: trackingNumber,
            carrier: carrier.toLowerCase(),
            status: trackingData.status,
            events: trackingData.events,
            estimated_delivery: trackingData.estimatedDelivery?.toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      return trackingData;

    } catch (error) {
      logger.error('Error fetching tracking info:', error);
      return null;
    }
  }

  private async fetchCarrierTracking(
    trackingNumber: string,
    carrier: string
  ): Promise<TrackingInfo | null> {
    // This would integrate with actual carrier APIs
    // For demo purposes, returning simulated data
    
    const simulatedEvents: TrackingEvent[] = [
      {
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'Label Created',
        description: 'Shipping label has been created',
        location: 'Origin Facility'
      },
      {
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'In Transit',
        description: 'Package is on its way to destination',
        location: 'Distribution Center'
      },
      {
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'Out for Delivery',
        description: 'Package is out for delivery',
        location: 'Local Facility'
      }
    ];

    return {
      carrier: carrier,
      trackingNumber: trackingNumber,
      trackingUrl: this.generateTrackingUrl(trackingNumber, carrier),
      status: 'Out for Delivery',
      events: simulatedEvents,
      estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      lastUpdate: new Date()
    };
  }

  private generateTrackingUrl(trackingNumber?: string, carrier?: string): string | undefined {
    if (!trackingNumber || !carrier) return undefined;
    
    const baseUrl = this.trackingProviders.get(carrier.toLowerCase());
    return baseUrl ? `${baseUrl}${trackingNumber}` : undefined;
  }

  private canCancelOrder(status: string, createdAt: string): boolean {
    const orderAge = Date.now() - new Date(createdAt).getTime();
    const hoursSinceOrder = orderAge / (1000 * 60 * 60);
    
    // Allow cancellation if order is pending/confirmed and within 24 hours
    return ['pending', 'confirmed'].includes(status) && hoursSinceOrder < 24;
  }

  private canReturnOrder(status: string, deliveredAt?: string): boolean {
    if (status !== 'delivered' || !deliveredAt) return false;
    
    const deliveryAge = Date.now() - new Date(deliveredAt).getTime();
    const daysSinceDelivery = deliveryAge / (1000 * 60 * 60 * 24);
    
    // Allow returns within 30 days of delivery
    return daysSinceDelivery <= 30;
  }

  async updateOrderStatus(
    orderNumber: string,
    newStatus: string,
    message?: string,
    location?: string
  ): Promise<boolean> {
    try {
      // Update order status
      const { error: orderError } = await this.supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() })
        })
        .eq('order_number', orderNumber);

      if (orderError) throw orderError;

      // Add status update record
      const { error: statusError } = await this.supabase
        .from('order_status_updates')
        .insert({
          order_number: orderNumber,
          status: newStatus,
          message: message || `Order status updated to ${newStatus}`,
          location: location,
          created_at: new Date().toISOString()
        });

      if (statusError) throw statusError;

      logger.info(`Order ${orderNumber} status updated to ${newStatus}`);
      return true;

    } catch (error) {
      logger.error('Error updating order status:', error);
      return false;
    }
  }

  async searchOrders(
    query: string,
    customerId?: string,
    limit: number = 20
  ): Promise<OrderStatus[]> {
    try {
      let supabaseQuery = this.supabase
        .from('orders')
        .select(`
          *,
          order_line_items (
            *,
            products (title, image_url),
            product_variants (title, sku)
          ),
          shipping_address (*),
          order_status_updates (*)
        `)
        .or(`order_number.ilike.%${query}%, email.ilike.%${query}%, tracking_number.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (customerId) {
        supabaseQuery = supabaseQuery.eq('customer_id', customerId);
      }

      const { data: orders } = await supabaseQuery;

      return Promise.all(
        (orders || []).map(async (order) => {
          let trackingInfo: TrackingInfo | null = null;
          if (order.tracking_number && order.shipping_carrier) {
            trackingInfo = await this.getTrackingInfo(
              order.tracking_number,
              order.shipping_carrier
            );
          }
          return this.formatOrderStatus(order, trackingInfo);
        })
      );

    } catch (error) {
      logger.error('Error searching orders:', error);
      return [];
    }
  }

  async getOrderAnalytics(timeframe: '24h' | '7d' | '30d' = '7d') {
    const timeframeDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30
    };

    const since = new Date(Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000);

    try {
      const { data: analytics } = await this.supabase.rpc(
        'get_order_analytics',
        {
          since_date: since.toISOString()
        }
      );

      return analytics;
    } catch (error) {
      logger.error('Error fetching order analytics:', error);
      return null;
    }
  }

  formatOrderStatusForChat(orderStatus: OrderStatus): string {
    const { orderNumber, status, total, currency, estimatedDelivery, trackingNumber, items } = orderStatus;
    
    let response = `**Order #${orderNumber}**\n`;
    response += `📋 Status: ${status.charAt(0).toUpperCase() + status.slice(1)}\n`;
    response += `💰 Total: ${currency} ${total.toFixed(2)}\n`;
    response += `📦 Items: ${items.length} item${items.length > 1 ? 's' : ''}\n`;
    
    if (trackingNumber) {
      response += `🚚 Tracking: ${trackingNumber}\n`;
    }
    
    if (estimatedDelivery) {
      const deliveryDate = estimatedDelivery.toLocaleDateString();
      response += `📅 Estimated delivery: ${deliveryDate}\n`;
    }

    // Add action suggestions
    if (orderStatus.canCancel) {
      response += `\n❌ You can still cancel this order`;
    }
    if (orderStatus.canReturn) {
      response += `\n🔄 Return window is open until ${orderStatus.returnDeadline?.toLocaleDateString()}`;
    }

    response += `\n\nNeed help with anything else about your order?`;

    return response;
  }
}