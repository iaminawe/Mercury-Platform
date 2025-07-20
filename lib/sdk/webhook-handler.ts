/**
 * Mercury Webhook Handler
 * Processes and validates incoming webhooks from Mercury platform
 */

import { 
  WebhookEvent,
  WebhookHandler as IWebhookHandler,
  WebhookConfig,
  MercuryError
} from './types';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export class WebhookHandler {
  private handlers: Map<string, Set<(event: WebhookEvent) => Promise<void>>> = new Map();
  private config: WebhookConfig;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(secret: string, config?: Partial<WebhookConfig>) {
    this.config = {
      secret,
      tolerance: 300, // 5 minutes
      algorithms: ['sha256'],
      ...config
    };
  }

  // Event Handler Registration
  public on(event: string, handler: (event: WebhookEvent) => Promise<void>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  public off(event: string, handler?: (event: WebhookEvent) => Promise<void>): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }
  }

  public once(event: string, handler: (event: WebhookEvent) => Promise<void>): void {
    const wrappedHandler = async (event: WebhookEvent) => {
      await handler(event);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }

  // Webhook Processing
  public async processWebhook(
    payload: string | Buffer,
    signature: string,
    options?: {
      timestamp?: number;
      skipSignatureValidation?: boolean;
    }
  ): Promise<WebhookEvent> {
    try {
      // Validate signature
      if (!options?.skipSignatureValidation) {
        this.validateSignature(payload, signature, options?.timestamp);
      }

      // Parse webhook data
      const webhookData = this.parseWebhookPayload(payload);
      
      // Create webhook event
      const event: WebhookEvent = {
        id: webhookData.id || this.generateEventId(),
        type: webhookData.type || webhookData.event_type,
        timestamp: new Date(webhookData.timestamp || Date.now()),
        data: webhookData.data || webhookData,
        signature,
        version: webhookData.version || '1.0'
      };

      // Validate event structure
      this.validateEvent(event);

      // Process the event
      await this.handleEvent(event);

      // Emit general webhook received event
      this.emit('webhook:received', event);

      return event;
    } catch (error) {
      const errorEvent = this.createErrorEvent(error as Error, signature);
      this.emit('webhook:error', { error, signature, payload: payload.toString() });
      throw error;
    }
  }

  // Express.js middleware for webhook endpoints
  public middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const signature = this.extractSignature(req);
        const payload = this.extractPayload(req);
        const timestamp = this.extractTimestamp(req);

        const event = await this.processWebhook(payload, signature, { timestamp });

        // Attach event to request for further processing
        req.webhookEvent = event;

        res.status(200).json({ success: true, eventId: event.id });
      } catch (error) {
        console.error('Webhook processing error:', error);
        
        if (error instanceof MercuryError) {
          res.status(400).json({ 
            success: false, 
            error: error.message,
            code: error.code 
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
          });
        }
      }
    };
  }

  // Next.js API route handler
  public async handleNextJS(req: any, res: any): Promise<void> {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const signature = this.extractSignature(req);
      const payload = this.extractPayload(req);
      const timestamp = this.extractTimestamp(req);

      const event = await this.processWebhook(payload, signature, { timestamp });

      res.status(200).json({ success: true, eventId: event.id });
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      if (error instanceof MercuryError) {
        res.status(400).json({ 
          success: false, 
          error: error.message,
          code: error.code 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error' 
        });
      }
    }
  }

  // Signature Validation
  private validateSignature(
    payload: string | Buffer,
    signature: string,
    timestamp?: number
  ): void {
    if (!signature) {
      throw new MercuryError('Missing webhook signature', 'MISSING_SIGNATURE');
    }

    // Extract algorithm and signature from header
    const [algorithm, providedSignature] = this.parseSignature(signature);

    if (!this.config.algorithms.includes(algorithm)) {
      throw new MercuryError(`Unsupported signature algorithm: ${algorithm}`, 'INVALID_ALGORITHM');
    }

    // Check timestamp tolerance
    if (timestamp && this.config.tolerance) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > this.config.tolerance) {
        throw new MercuryError('Webhook timestamp is outside tolerance window', 'TIMESTAMP_TOO_OLD');
      }
    }

    // Compute expected signature
    const expectedSignature = this.computeSignature(payload, algorithm, timestamp);

    // Compare signatures using timing-safe comparison
    if (!this.compareSignatures(providedSignature, expectedSignature)) {
      throw new MercuryError('Invalid webhook signature', 'INVALID_SIGNATURE');
    }
  }

  private parseSignature(signature: string): [string, string] {
    // Support multiple signature formats:
    // - "sha256=abcd1234" (GitHub style)
    // - "t=timestamp,v1=signature" (Stripe style)
    // - "abcd1234" (simple signature)

    if (signature.includes('=')) {
      if (signature.includes(',')) {
        // Stripe style: t=timestamp,v1=signature
        const parts = signature.split(',');
        const signaturePart = parts.find(part => part.startsWith('v1='));
        if (signaturePart) {
          return ['sha256', signaturePart.substring(3)];
        }
      } else {
        // GitHub style: sha256=signature
        const [algorithm, sig] = signature.split('=', 2);
        return [algorithm, sig];
      }
    }

    // Simple signature - assume sha256
    return ['sha256', signature];
  }

  private computeSignature(payload: string | Buffer, algorithm: string, timestamp?: number): string {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
    
    // Include timestamp in signature if provided
    const signaturePayload = timestamp 
      ? Buffer.concat([Buffer.from(timestamp.toString()), data])
      : data;

    return createHmac(algorithm, this.config.secret)
      .update(signaturePayload)
      .digest('hex');
  }

  private compareSignatures(signature1: string, signature2: string): boolean {
    const buf1 = Buffer.from(signature1, 'hex');
    const buf2 = Buffer.from(signature2, 'hex');

    if (buf1.length !== buf2.length) {
      return false;
    }

    return timingSafeEqual(buf1, buf2);
  }

  // Payload Processing
  private parseWebhookPayload(payload: string | Buffer): any {
    try {
      const payloadString = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
      return JSON.parse(payloadString);
    } catch (error) {
      throw new MercuryError('Invalid webhook payload format', 'INVALID_PAYLOAD');
    }
  }

  private validateEvent(event: WebhookEvent): void {
    if (!event.id) {
      throw new MercuryError('Webhook event missing ID', 'INVALID_EVENT');
    }

    if (!event.type) {
      throw new MercuryError('Webhook event missing type', 'INVALID_EVENT');
    }

    if (!event.timestamp) {
      throw new MercuryError('Webhook event missing timestamp', 'INVALID_EVENT');
    }
  }

  // Event Handling
  private async handleEvent(event: WebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      // No specific handlers, emit to general listeners
      this.emit('webhook:unhandled', event);
      return;
    }

    const promises: Promise<void>[] = [];
    
    for (const handler of handlers) {
      promises.push(this.safeExecuteHandler(handler, event));
    }

    await Promise.allSettled(promises);
  }

  private async safeExecuteHandler(
    handler: (event: WebhookEvent) => Promise<void>,
    event: WebhookEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Error in webhook handler for ${event.type}:`, error);
      this.emit('webhook:handler_error', { event, error });
    }
  }

  // Utility Methods
  private extractSignature(req: any): string {
    // Try different header names
    return req.headers['x-mercury-signature'] ||
           req.headers['x-webhook-signature'] ||
           req.headers['x-signature'] ||
           req.headers['signature'] ||
           '';
  }

  private extractPayload(req: any): string | Buffer {
    // Handle different payload formats
    if (req.rawBody) {
      return req.rawBody;
    }
    
    if (req.body) {
      if (Buffer.isBuffer(req.body)) {
        return req.body;
      }
      
      if (typeof req.body === 'string') {
        return req.body;
      }
      
      return JSON.stringify(req.body);
    }

    throw new MercuryError('Unable to extract webhook payload', 'MISSING_PAYLOAD');
  }

  private extractTimestamp(req: any): number | undefined {
    const timestampHeader = req.headers['x-timestamp'] || 
                           req.headers['x-webhook-timestamp'];
    
    return timestampHeader ? parseInt(timestampHeader, 10) : undefined;
  }

  private generateEventId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createErrorEvent(error: Error, signature?: string): WebhookEvent {
    return {
      id: this.generateEventId(),
      type: 'webhook.error',
      timestamp: new Date(),
      data: {
        error: error.message,
        code: (error as any).code || 'UNKNOWN_ERROR'
      },
      signature,
      version: '1.0'
    };
  }

  // Event Emitter functionality
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  public addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  public removeEventListener(event: string, listener?: Function): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    if (listener) {
      listeners.delete(listener);
    } else {
      listeners.clear();
    }
  }

  // Webhook Testing and Debugging
  public async testWebhook(webhookData: any): Promise<WebhookEvent> {
    const payload = JSON.stringify(webhookData);
    const signature = this.computeSignature(payload, 'sha256');
    
    return this.processWebhook(payload, `sha256=${signature}`, { 
      skipSignatureValidation: false 
    });
  }

  public generateTestSignature(payload: string | Buffer): string {
    return `sha256=${this.computeSignature(payload, 'sha256')}`;
  }

  // Configuration Management
  public updateConfig(config: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): Readonly<WebhookConfig> {
    return { ...this.config };
  }

  // Statistics and Monitoring
  public getHandlerStats(): { [eventType: string]: number } {
    const stats: { [eventType: string]: number } = {};
    
    for (const [eventType, handlers] of this.handlers.entries()) {
      stats[eventType] = handlers.size;
    }
    
    return stats;
  }

  // Cleanup
  public destroy(): void {
    this.handlers.clear();
    this.eventListeners.clear();
  }
}

export default WebhookHandler;