/**
 * Mercury API Client
 * Handles HTTP communication with Mercury platform APIs
 */

import { 
  MercurySDKConfig,
  APIResponse,
  APIError,
  AuthConfig,
  MercuryError
} from './types';

export class APIClient {
  private config: MercurySDKConfig;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: MercurySDKConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl(config.environment || 'production');
    this.defaultHeaders = this.buildDefaultHeaders();
  }

  private getDefaultBaseUrl(environment: string): string {
    const urls = {
      development: 'http://localhost:3000/api/v1',
      staging: 'https://staging-api.mercury.dev/v1',
      production: 'https://api.mercury.dev/v1'
    };
    return urls[environment as keyof typeof urls] || urls.production;
  }

  private buildDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mercury-SDK/1.0.0',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  public updateConfig(config: MercurySDKConfig): void {
    this.config = config;
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl(config.environment || 'production');
    this.defaultHeaders = this.buildDefaultHeaders();
  }

  // Core HTTP Methods
  public async get<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  public async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  public async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  public async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  public async delete<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  // Main request method with retry logic
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    const url = this.buildUrl(endpoint);
    const headers = { ...this.defaultHeaders, ...(options?.headers || {}) };
    const timeout = options?.timeout || this.config.timeout || 30000;

    let lastError: Error | null = null;
    const maxAttempts = (options?.retryAttempts ?? this.config.retryAttempts) || 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (this.config.enableLogging) {
          console.log(`[Mercury SDK] ${method} ${url} (attempt ${attempt}/${maxAttempts})`);
        }

        const response = await this.makeRequest(method, url, data, headers, timeout);
        return await this.handleResponse<T>(response);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break;
        }

        // Only retry on network errors or 5xx status codes
        if (this.shouldRetry(error)) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    throw this.createAPIError(lastError!, endpoint);
  }

  private async makeRequest(
    method: string,
    url: string,
    data: any,
    headers: Record<string, string>,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleResponse<T>(response: Response): Promise<APIResponse<T>> {
    const contentType = response.headers.get('content-type');
    let responseData: any;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      throw this.createHTTPError(response, responseData);
    }

    return {
      success: true,
      data: responseData as T,
      meta: this.extractMetadata(response)
    };
  }

  private extractMetadata(response: Response): any {
    const meta: any = {};

    // Extract pagination info
    const totalHeader = response.headers.get('x-total-count');
    const pageHeader = response.headers.get('x-page');
    const limitHeader = response.headers.get('x-page-size');

    if (totalHeader && pageHeader && limitHeader) {
      const total = parseInt(totalHeader);
      const page = parseInt(pageHeader);
      const limit = parseInt(limitHeader);

      meta.pagination = {
        page,
        limit,
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      };
    }

    // Extract rate limit info
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitLimit = response.headers.get('x-ratelimit-limit');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    if (rateLimitRemaining && rateLimitLimit && rateLimitReset) {
      meta.rateLimit = {
        remaining: parseInt(rateLimitRemaining),
        limit: parseInt(rateLimitLimit),
        resetAt: new Date(parseInt(rateLimitReset) * 1000)
      };
    }

    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private createHTTPError(response: Response, data: any): MercuryError {
    const errorData: APIError = {
      code: data?.error?.code || `HTTP_${response.status}`,
      message: data?.error?.message || data?.message || response.statusText,
      details: data?.error?.details || data
    };

    return new MercuryError(
      errorData.message,
      errorData.code,
      {
        statusCode: response.status,
        endpoint: response.url,
        details: errorData.details
      }
    );
  }

  private createAPIError(error: Error, endpoint: string): MercuryError {
    if (error.name === 'AbortError') {
      return new MercuryError('Request timeout', 'REQUEST_TIMEOUT', { endpoint });
    }

    if (error.message.includes('Failed to fetch')) {
      return new MercuryError('Network error', 'NETWORK_ERROR', { endpoint, originalError: error });
    }

    return new MercuryError(
      error.message || 'Unknown API error',
      'API_ERROR',
      { endpoint, originalError: error }
    );
  }

  private shouldRetry(error: any): boolean {
    // Network errors
    if (error.name === 'AbortError' || error.message?.includes('Failed to fetch')) {
      return true;
    }

    // HTTP 5xx errors
    if (error.details?.statusCode >= 500) {
      return true;
    }

    // Rate limiting (429)
    if (error.details?.statusCode === 429) {
      return true;
    }

    return false;
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000; // 0-1 second jitter
    
    return exponentialDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Ensure baseUrl doesn't end with slash
    const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    
    return `${cleanBaseUrl}/${cleanEndpoint}`;
  }

  // Authentication helpers
  public async authenticate(authConfig: AuthConfig): Promise<string> {
    try {
      const response = await this.post<{ token: string; expiresAt: Date }>(
        '/auth/authenticate',
        authConfig
      );

      if (!response.data?.token) {
        throw new MercuryError('Authentication failed', 'AUTH_FAILED');
      }

      // Update the API key with the new token
      this.config.apiKey = response.data.token;
      this.defaultHeaders['Authorization'] = `Bearer ${response.data.token}`;

      return response.data.token;
    } catch (error) {
      throw this.createAPIError(error as Error, '/auth/authenticate');
    }
  }

  public async refreshToken(refreshToken: string): Promise<string> {
    try {
      const response = await this.post<{ token: string; expiresAt: Date }>(
        '/auth/refresh',
        { refreshToken }
      );

      if (!response.data?.token) {
        throw new MercuryError('Token refresh failed', 'TOKEN_REFRESH_FAILED');
      }

      // Update the API key with the new token
      this.config.apiKey = response.data.token;
      this.defaultHeaders['Authorization'] = `Bearer ${response.data.token}`;

      return response.data.token;
    } catch (error) {
      throw this.createAPIError(error as Error, '/auth/refresh');
    }
  }

  // Batch requests
  public async batch(requests: BatchRequest[]): Promise<BatchResponse[]> {
    try {
      const response = await this.post<BatchResponse[]>('/batch', { requests });
      return response.data || [];
    } catch (error) {
      throw this.createAPIError(error as Error, '/batch');
    }
  }

  // Upload helper for file uploads
  public async upload(
    endpoint: string,
    file: File | Buffer,
    options?: {
      filename?: string;
      contentType?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<APIResponse<any>> {
    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      const blob = new Blob([file], { type: options?.contentType || 'application/octet-stream' });
      formData.append('file', blob, options?.filename || 'upload');
    }

    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const url = this.buildUrl(endpoint);
    const headers = { ...this.defaultHeaders };
    delete headers['Content-Type']; // Let browser set multipart boundary

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      return await this.handleResponse(response);
    } catch (error) {
      throw this.createAPIError(error as Error, endpoint);
    }
  }

  // Health check
  public async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const response = await this.get<{ status: string; timestamp: string }>('/health');
      return {
        status: response.data?.status || 'unknown',
        timestamp: new Date(response.data?.timestamp || Date.now())
      };
    } catch (error) {
      throw this.createAPIError(error as Error, '/health');
    }
  }
}

// Helper interfaces
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
}

interface BatchRequest {
  id: string;
  method: string;
  endpoint: string;
  data?: any;
}

interface BatchResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: APIError;
}

export default APIClient;