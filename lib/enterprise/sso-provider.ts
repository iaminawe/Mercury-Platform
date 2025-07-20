/**
 * Single Sign-On Provider
 * Enterprise SSO with SAML 2.0 and OpenID Connect support
 */

import { z } from 'zod';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'oauth2';
  organizationId: string;
  isActive: boolean;
  config: SAMLConfig | OIDCConfig | OAuth2Config;
  userMappings: UserMapping[];
  groupMappings: GroupMapping[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  signRequests?: boolean;
  encryptAssertions?: boolean;
  nameIdFormat: 'emailAddress' | 'persistent' | 'transient' | 'unspecified';
  attributeMapping: Record<string, string>;
  allowedClockDrift?: number;
  wantAssertionsSigned?: boolean;
  wantResponseSigned?: boolean;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  scopes: string[];
  responseType: string;
  responseMode?: string;
  claims: Record<string, string>;
  allowedAudiences?: string[];
}

export interface OAuth2Config {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  userInfoEndpoint: string;
  responseType: string;
  grantType: string;
}

export interface UserMapping {
  externalField: string;
  internalField: string;
  required: boolean;
  transform?: 'lowercase' | 'uppercase' | 'trim' | 'email';
  defaultValue?: string;
}

export interface GroupMapping {
  externalGroup: string;
  internalRole: string;
  permissions: string[];
}

export interface SSOSession {
  id: string;
  userId: string;
  organizationId: string;
  providerId: string;
  sessionIndex?: string;
  nameId?: string;
  attributes: Record<string, any>;
  loginTime: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface SSOAuditLog {
  id: string;
  organizationId: string;
  providerId: string;
  userId?: string;
  action: 'login' | 'logout' | 'failed_login' | 'session_timeout' | 'force_logout';
  result: 'success' | 'failure';
  error?: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

const SAMLConfigSchema = z.object({
  entityId: z.string(),
  ssoUrl: z.string().url(),
  sloUrl: z.string().url().optional(),
  certificate: z.string(),
  signRequests: z.boolean().optional(),
  encryptAssertions: z.boolean().optional(),
  nameIdFormat: z.enum(['emailAddress', 'persistent', 'transient', 'unspecified']),
  attributeMapping: z.record(z.string()),
  allowedClockDrift: z.number().optional(),
  wantAssertionsSigned: z.boolean().optional(),
  wantResponseSigned: z.boolean().optional()
});

const OIDCConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string(),
  clientSecret: z.string(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  userinfoEndpoint: z.string().url(),
  jwksUri: z.string().url(),
  scopes: z.array(z.string()),
  responseType: z.string(),
  responseMode: z.string().optional(),
  claims: z.record(z.string()),
  allowedAudiences: z.array(z.string()).optional()
});

export class SSOProviderManager extends EventEmitter {
  private providers: Map<string, SSOProvider> = new Map();
  private sessions: Map<string, SSOSession> = new Map();
  private auditLogs: SSOAuditLog[] = [];

  constructor() {
    super();
    this.setupSessionCleanup();
  }

  // Provider Management
  async createProvider(
    organizationId: string,
    providerData: Omit<SSOProvider, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SSOProvider> {
    // Validate configuration based on type
    this.validateProviderConfig(providerData.type, providerData.config);

    const provider: SSOProvider = {
      ...providerData,
      id: crypto.randomUUID(),
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.providers.set(provider.id, provider);
    
    this.emit('provider:created', provider);
    this.auditLog(organizationId, provider.id, undefined, 'provider_created', 'success');

    return provider;
  }

  async updateProvider(
    providerId: string,
    updates: Partial<SSOProvider>
  ): Promise<SSOProvider | null> {
    const provider = this.providers.get(providerId);
    if (!provider) return null;

    if (updates.config) {
      this.validateProviderConfig(provider.type, updates.config);
    }

    const updatedProvider = {
      ...provider,
      ...updates,
      updatedAt: new Date()
    };

    this.providers.set(providerId, updatedProvider);
    
    this.emit('provider:updated', updatedProvider);
    this.auditLog(provider.organizationId, providerId, undefined, 'provider_updated', 'success');

    return updatedProvider;
  }

  async deleteProvider(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    // Terminate all active sessions for this provider
    this.terminateProviderSessions(providerId);

    this.providers.delete(providerId);
    
    this.emit('provider:deleted', provider);
    this.auditLog(provider.organizationId, providerId, undefined, 'provider_deleted', 'success');

    return true;
  }

  getProvider(providerId: string): SSOProvider | undefined {
    return this.providers.get(providerId);
  }

  getOrganizationProviders(organizationId: string): SSOProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.organizationId === organizationId);
  }

  private validateProviderConfig(type: string, config: any): void {
    switch (type) {
      case 'saml':
        SAMLConfigSchema.parse(config);
        break;
      case 'oidc':
        OIDCConfigSchema.parse(config);
        break;
      case 'oauth2':
        // Add OAuth2 validation if needed
        break;
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  // SAML Implementation
  async initiateSAMLLogin(
    providerId: string,
    relayState?: string
  ): Promise<{ redirectUrl: string; requestId: string }> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      throw new Error('Invalid SAML provider');
    }

    const config = provider.config as SAMLConfig;
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Build SAML AuthnRequest
    const authnRequest = this.buildSAMLAuthnRequest(
      requestId,
      config,
      timestamp,
      relayState
    );

    const encodedRequest = Buffer.from(authnRequest).toString('base64');
    const redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}${relayState ? `&RelayState=${encodeURIComponent(relayState)}` : ''}`;

    this.auditLog(provider.organizationId, providerId, undefined, 'saml_login_initiated', 'success', {
      requestId,
      relayState
    });

    return { redirectUrl, requestId };
  }

  async processSAMLResponse(
    providerId: string,
    samlResponse: string,
    relayState?: string
  ): Promise<{ userId: string; sessionId: string; userData: any }> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      throw new Error('Invalid SAML provider');
    }

    try {
      // Decode and validate SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString();
      const assertion = this.validateSAMLResponse(decodedResponse, provider.config as SAMLConfig);
      
      // Extract user information
      const userData = this.extractSAMLUserData(assertion, provider.userMappings);
      
      // Create or update user
      const userId = await this.createOrUpdateUser(userData, provider);
      
      // Create SSO session
      const session = await this.createSSOSession(
        userId,
        provider.organizationId,
        providerId,
        assertion.sessionIndex,
        assertion.nameId,
        assertion.attributes
      );

      this.auditLog(provider.organizationId, providerId, userId, 'login', 'success', {
        relayState,
        sessionId: session.id
      });

      return {
        userId,
        sessionId: session.id,
        userData
      };
    } catch (error) {
      this.auditLog(provider.organizationId, providerId, undefined, 'failed_login', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        relayState
      });
      throw error;
    }
  }

  async initiateSAMLLogout(
    sessionId: string,
    relayState?: string
  ): Promise<{ redirectUrl: string; requestId: string } | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const provider = this.providers.get(session.providerId);
    if (!provider || provider.type !== 'saml') return null;

    const config = provider.config as SAMLConfig;
    if (!config.sloUrl) return null;

    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Build SAML LogoutRequest
    const logoutRequest = this.buildSAMLLogoutRequest(
      requestId,
      config,
      session,
      timestamp,
      relayState
    );

    const encodedRequest = Buffer.from(logoutRequest).toString('base64');
    const redirectUrl = `${config.sloUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}${relayState ? `&RelayState=${encodeURIComponent(relayState)}` : ''}`;

    // Terminate local session
    this.sessions.delete(sessionId);

    this.auditLog(provider.organizationId, provider.id, session.userId, 'logout', 'success', {
      requestId,
      relayState
    });

    return { redirectUrl, requestId };
  }

  // OIDC Implementation
  async initiateOIDCLogin(
    providerId: string,
    state?: string,
    nonce?: string
  ): Promise<{ redirectUrl: string; state: string; nonce: string }> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'oidc') {
      throw new Error('Invalid OIDC provider');
    }

    const config = provider.config as OIDCConfig;
    const generatedState = state || crypto.randomUUID();
    const generatedNonce = nonce || crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: config.responseType,
      scope: config.scopes.join(' '),
      redirect_uri: `${process.env.BASE_URL}/auth/oidc/callback/${providerId}`,
      state: generatedState,
      nonce: generatedNonce
    });

    if (config.responseMode) {
      params.set('response_mode', config.responseMode);
    }

    const redirectUrl = `${config.authorizationEndpoint}?${params.toString()}`;

    this.auditLog(provider.organizationId, providerId, undefined, 'oidc_login_initiated', 'success', {
      state: generatedState,
      nonce: generatedNonce
    });

    return {
      redirectUrl,
      state: generatedState,
      nonce: generatedNonce
    };
  }

  async processOIDCCallback(
    providerId: string,
    code: string,
    state: string,
    nonce: string
  ): Promise<{ userId: string; sessionId: string; userData: any }> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'oidc') {
      throw new Error('Invalid OIDC provider');
    }

    try {
      const config = provider.config as OIDCConfig;

      // Exchange code for tokens
      const tokenResponse = await this.exchangeOIDCCode(config, code, providerId);
      
      // Validate ID token
      const idTokenPayload = await this.validateOIDCIdToken(
        tokenResponse.id_token,
        config,
        nonce
      );

      // Get user info if needed
      let userInfo = idTokenPayload;
      if (config.userinfoEndpoint && tokenResponse.access_token) {
        userInfo = await this.getOIDCUserInfo(config, tokenResponse.access_token);
      }

      // Map user data
      const userData = this.extractOIDCUserData(userInfo, provider.userMappings);
      
      // Create or update user
      const userId = await this.createOrUpdateUser(userData, provider);
      
      // Create SSO session
      const session = await this.createSSOSession(
        userId,
        provider.organizationId,
        providerId,
        undefined,
        idTokenPayload.sub,
        userInfo
      );

      this.auditLog(provider.organizationId, providerId, userId, 'login', 'success', {
        state,
        sessionId: session.id
      });

      return {
        userId,
        sessionId: session.id,
        userData
      };
    } catch (error) {
      this.auditLog(provider.organizationId, providerId, undefined, 'failed_login', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        state
      });
      throw error;
    }
  }

  // Session Management
  private async createSSOSession(
    userId: string,
    organizationId: string,
    providerId: string,
    sessionIndex?: string,
    nameId?: string,
    attributes?: any
  ): Promise<SSOSession> {
    const session: SSOSession = {
      id: crypto.randomUUID(),
      userId,
      organizationId,
      providerId,
      sessionIndex,
      nameId,
      attributes: attributes || {},
      loginTime: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ipAddress: '', // Would be set from request
      userAgent: ''  // Would be set from request
    };

    this.sessions.set(session.id, session);
    this.emit('session:created', session);

    return session;
  }

  getSession(sessionId: string): SSOSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.auditLog(session.organizationId, session.providerId, session.userId, 'session_timeout', 'success');
      return undefined;
    }

    // Update last activity
    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);

    return session;
  }

  async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.auditLog(session.organizationId, session.providerId, session.userId, 'logout', 'success');
    this.emit('session:terminated', session);

    return true;
  }

  getUserSessions(userId: string): SSOSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId);
  }

  getOrganizationSessions(organizationId: string): SSOSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.organizationId === organizationId);
  }

  private terminateProviderSessions(providerId: string): void {
    const providerSessions = Array.from(this.sessions.values())
      .filter(s => s.providerId === providerId);

    providerSessions.forEach(session => {
      this.sessions.delete(session.id);
      this.auditLog(session.organizationId, providerId, session.userId, 'force_logout', 'success');
    });
  }

  // User Data Processing
  private async createOrUpdateUser(userData: any, provider: SSOProvider): Promise<string> {
    // This would integrate with your user management system
    // For now, return a mock user ID
    return `sso-user-${userData.email || userData.sub || crypto.randomUUID()}`;
  }

  private extractSAMLUserData(assertion: any, mappings: UserMapping[]): any {
    const userData: any = {};

    mappings.forEach(mapping => {
      let value = assertion.attributes[mapping.externalField];
      
      if (!value && mapping.required) {
        throw new Error(`Required field ${mapping.externalField} not found in SAML assertion`);
      }

      if (value && mapping.transform) {
        value = this.transformValue(value, mapping.transform);
      }

      userData[mapping.internalField] = value || mapping.defaultValue;
    });

    return userData;
  }

  private extractOIDCUserData(userInfo: any, mappings: UserMapping[]): any {
    const userData: any = {};

    mappings.forEach(mapping => {
      let value = userInfo[mapping.externalField];
      
      if (!value && mapping.required) {
        throw new Error(`Required field ${mapping.externalField} not found in OIDC user info`);
      }

      if (value && mapping.transform) {
        value = this.transformValue(value, mapping.transform);
      }

      userData[mapping.internalField] = value || mapping.defaultValue;
    });

    return userData;
  }

  private transformValue(value: any, transform: string): any {
    const strValue = String(value);
    
    switch (transform) {
      case 'lowercase':
        return strValue.toLowerCase();
      case 'uppercase':
        return strValue.toUpperCase();
      case 'trim':
        return strValue.trim();
      case 'email':
        return strValue.toLowerCase().trim();
      default:
        return value;
    }
  }

  // SAML Helper Methods
  private buildSAMLAuthnRequest(
    requestId: string,
    config: SAMLConfig,
    timestamp: string,
    relayState?: string
  ): string {
    // This is a simplified SAML AuthnRequest - in production you'd use a proper SAML library
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${timestamp}"
  Destination="${config.ssoUrl}"
  AssertionConsumerServiceURL="${process.env.BASE_URL}/auth/saml/acs/${config.entityId}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:${config.nameIdFormat}" />
</samlp:AuthnRequest>`;
  }

  private buildSAMLLogoutRequest(
    requestId: string,
    config: SAMLConfig,
    session: SSOSession,
    timestamp: string,
    relayState?: string
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${timestamp}"
  Destination="${config.sloUrl}">
  <saml:Issuer>${config.entityId}</saml:Issuer>
  <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:${config.nameIdFormat}">${session.nameId}</saml:NameID>
  ${session.sessionIndex ? `<samlp:SessionIndex>${session.sessionIndex}</samlp:SessionIndex>` : ''}
</samlp:LogoutRequest>`;
  }

  private validateSAMLResponse(response: string, config: SAMLConfig): any {
    // This would use a proper SAML library for validation
    // For now, return mock data
    return {
      nameId: 'user@example.com',
      sessionIndex: 'session-123',
      attributes: {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }
    };
  }

  // OIDC Helper Methods
  private async exchangeOIDCCode(
    config: OIDCConfig,
    code: string,
    providerId: string
  ): Promise<any> {
    const tokenRequest = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.BASE_URL}/auth/oidc/callback/${providerId}`,
      client_id: config.clientId,
      client_secret: config.clientSecret
    };

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenRequest)
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async validateOIDCIdToken(
    idToken: string,
    config: OIDCConfig,
    nonce: string
  ): Promise<any> {
    // This would use a proper JWT library for validation
    // For now, decode without verification (DO NOT DO THIS IN PRODUCTION)
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString()
    );

    if (payload.nonce !== nonce) {
      throw new Error('Invalid nonce in ID token');
    }

    return payload;
  }

  private async getOIDCUserInfo(config: OIDCConfig, accessToken: string): Promise<any> {
    const response = await fetch(config.userinfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`UserInfo request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Audit Logging
  private auditLog(
    organizationId: string,
    providerId: string,
    userId: string | undefined,
    action: SSOAuditLog['action'],
    result: SSOAuditLog['result'],
    metadata: Record<string, any> = {}
  ): void {
    const log: SSOAuditLog = {
      id: crypto.randomUUID(),
      organizationId,
      providerId,
      userId,
      action,
      result,
      metadata,
      ipAddress: '', // Would be extracted from request
      userAgent: '', // Would be extracted from request
      timestamp: new Date()
    };

    this.auditLogs.push(log);
    this.emit('audit:logged', log);

    // Keep only recent logs (last 10000)
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  getAuditLogs(
    organizationId: string,
    filters?: {
      providerId?: string;
      userId?: string;
      action?: string;
      result?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): SSOAuditLog[] {
    let logs = this.auditLogs.filter(log => log.organizationId === organizationId);

    if (filters) {
      if (filters.providerId) logs = logs.filter(log => log.providerId === filters.providerId);
      if (filters.userId) logs = logs.filter(log => log.userId === filters.userId);
      if (filters.action) logs = logs.filter(log => log.action === filters.action);
      if (filters.result) logs = logs.filter(log => log.result === filters.result);
      if (filters.startDate) logs = logs.filter(log => log.timestamp >= filters.startDate!);
      if (filters.endDate) logs = logs.filter(log => log.timestamp <= filters.endDate!);
    }

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  // Cleanup
  private setupSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.sessions) {
        if (now > session.expiresAt) {
          expiredSessions.push(sessionId);
        }
      }

      expiredSessions.forEach(sessionId => {
        const session = this.sessions.get(sessionId);
        if (session) {
          this.sessions.delete(sessionId);
          this.auditLog(session.organizationId, session.providerId, session.userId, 'session_timeout', 'success');
        }
      });

      if (expiredSessions.length > 0) {
        this.emit('sessions:cleaned', expiredSessions.length);
      }
    }, 300000); // Check every 5 minutes
  }

  // Statistics
  getStatistics(organizationId: string): {
    totalProviders: number;
    activeProviders: number;
    totalSessions: number;
    activeSessions: number;
    loginStats: Record<string, number>;
  } {
    const providers = this.getOrganizationProviders(organizationId);
    const sessions = this.getOrganizationSessions(organizationId);
    const now = new Date();

    const activeSessions = sessions.filter(s => s.expiresAt > now);
    
    // Count logins by provider in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = this.auditLogs.filter(log => 
      log.organizationId === organizationId &&
      log.action === 'login' &&
      log.result === 'success' &&
      log.timestamp >= yesterday
    );

    const loginStats: Record<string, number> = {};
    recentLogs.forEach(log => {
      const provider = this.providers.get(log.providerId);
      if (provider) {
        loginStats[provider.name] = (loginStats[provider.name] || 0) + 1;
      }
    });

    return {
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.isActive).length,
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      loginStats
    };
  }
}

export default new SSOProviderManager();