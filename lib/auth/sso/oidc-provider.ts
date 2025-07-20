import { Issuer, Client, generators, TokenSet } from 'openid-client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

export interface OIDCConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  responseType?: string;
  grantType?: string;
  attributeMapping?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    groups?: string;
  };
}

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  groups?: string[];
  [key: string]: any;
}

export class OIDCProvider {
  private client?: Client;
  private issuer?: Issuer;

  constructor(private config: OIDCConfig) {}

  /**
   * Initialize OIDC client
   */
  async initialize(): Promise<void> {
    try {
      // Discover issuer configuration
      this.issuer = await Issuer.discover(this.config.issuerUrl);
      
      // Create client
      this.client = new this.issuer.Client({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uris: [this.config.redirectUri],
        response_types: [this.config.responseType || 'code'],
        grant_types: [this.config.grantType || 'authorization_code']
      });

      logger.info('OIDC provider initialized', { issuer: this.config.issuerUrl });
    } catch (error) {
      logger.error('Failed to initialize OIDC provider:', error);
      throw new Error('OIDC initialization failed');
    }
  }

  /**
   * Generate authorization URL
   */
  generateAuthUrl(state?: string, nonce?: string): string {
    if (!this.client) {
      throw new Error('OIDC client not initialized');
    }

    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    // Store PKCE verifier
    const stateKey = state || generators.state();
    this.storePKCE(stateKey, code_verifier);

    const params = {
      scope: this.config.scope || 'openid email profile',
      code_challenge,
      code_challenge_method: 'S256',
      state: stateKey,
      nonce: nonce || generators.nonce()
    };

    return this.client.authorizationUrl(params);
  }

  /**
   * Handle callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<{ tokenSet: TokenSet; userInfo: OIDCUserInfo }> {
    if (!this.client) {
      throw new Error('OIDC client not initialized');
    }

    try {
      // Retrieve PKCE verifier
      const code_verifier = await this.retrievePKCE(state);

      // Exchange code for tokens
      const tokenSet = await this.client.callback(
        this.config.redirectUri,
        { code, state },
        { code_verifier, state }
      );

      // Validate tokens
      if (!tokenSet.access_token || !tokenSet.id_token) {
        throw new Error('Invalid token response');
      }

      // Get user info
      const userInfo = await this.client.userinfo(tokenSet);

      // Log authentication
      await this.logAuthentication(userInfo);

      return { tokenSet, userInfo: this.mapUserInfo(userInfo) };
    } catch (error) {
      logger.error('OIDC callback failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenSet> {
    if (!this.client) {
      throw new Error('OIDC client not initialized');
    }

    try {
      const tokenSet = await this.client.refresh(refreshToken);
      return tokenSet;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Validate ID token
   */
  async validateIdToken(idToken: string): Promise<any> {
    if (!this.client || !this.issuer) {
      throw new Error('OIDC client not initialized');
    }

    try {
      const claims = await this.client.validateIdToken(idToken);
      return claims;
    } catch (error) {
      logger.error('ID token validation failed:', error);
      throw new Error('Invalid ID token');
    }
  }

  /**
   * Revoke tokens
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    if (!this.client) {
      throw new Error('OIDC client not initialized');
    }

    try {
      await this.client.revoke(token, tokenType);
      logger.info('Token revoked', { tokenType });
    } catch (error) {
      logger.error('Token revocation failed:', error);
      // Don't throw - revocation is best effort
    }
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(idToken?: string, postLogoutRedirectUri?: string): string {
    if (!this.client || !this.issuer) {
      throw new Error('OIDC client not initialized');
    }

    if (!this.issuer.metadata.end_session_endpoint) {
      // Provider doesn't support RP-initiated logout
      return postLogoutRedirectUri || '/';
    }

    const params: any = {};
    if (idToken) params.id_token_hint = idToken;
    if (postLogoutRedirectUri) params.post_logout_redirect_uri = postLogoutRedirectUri;

    return this.client.endSessionUrl(params);
  }

  /**
   * Map OIDC user info to application format
   */
  private mapUserInfo(oidcUserInfo: any): OIDCUserInfo {
    const mapping = this.config.attributeMapping || {};
    const mapped: OIDCUserInfo = {
      sub: oidcUserInfo.sub
    };

    // Standard claims
    if (oidcUserInfo.email || oidcUserInfo[mapping.email || 'email']) {
      mapped.email = oidcUserInfo[mapping.email || 'email'] || oidcUserInfo.email;
    }
    if (oidcUserInfo.email_verified !== undefined) {
      mapped.emailVerified = oidcUserInfo.email_verified;
    }
    if (oidcUserInfo.name) {
      mapped.name = oidcUserInfo.name;
    }
    if (oidcUserInfo.given_name || oidcUserInfo[mapping.firstName || 'given_name']) {
      mapped.givenName = oidcUserInfo[mapping.firstName || 'given_name'] || oidcUserInfo.given_name;
    }
    if (oidcUserInfo.family_name || oidcUserInfo[mapping.lastName || 'family_name']) {
      mapped.familyName = oidcUserInfo[mapping.lastName || 'family_name'] || oidcUserInfo.family_name;
    }
    if (oidcUserInfo.picture || oidcUserInfo[mapping.picture || 'picture']) {
      mapped.picture = oidcUserInfo[mapping.picture || 'picture'] || oidcUserInfo.picture;
    }

    // Custom claims
    if (mapping.groups && oidcUserInfo[mapping.groups]) {
      mapped.groups = Array.isArray(oidcUserInfo[mapping.groups]) 
        ? oidcUserInfo[mapping.groups] 
        : [oidcUserInfo[mapping.groups]];
    }

    // Include all other claims
    Object.keys(oidcUserInfo).forEach(key => {
      if (!(key in mapped)) {
        mapped[key] = oidcUserInfo[key];
      }
    });

    return mapped;
  }

  /**
   * Store PKCE code verifier
   */
  private async storePKCE(state: string, codeVerifier: string): Promise<void> {
    const key = `oidc:pkce:${state}`;
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.temporaryStore.create({
      data: {
        key,
        value: codeVerifier,
        expiresAt: expiry
      }
    });
  }

  /**
   * Retrieve and delete PKCE code verifier
   */
  private async retrievePKCE(state: string): Promise<string> {
    const key = `oidc:pkce:${state}`;
    
    const record = await prisma.temporaryStore.findFirst({
      where: {
        key,
        expiresAt: { gt: new Date() }
      }
    });

    if (!record) {
      throw new Error('PKCE verifier not found or expired');
    }

    // Delete after retrieval
    await prisma.temporaryStore.delete({
      where: { id: record.id }
    });

    return record.value;
  }

  /**
   * Log authentication event
   */
  private async logAuthentication(userInfo: OIDCUserInfo) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'sso.oidc.login',
          userId: userInfo.sub,
          metadata: {
            provider: 'oidc',
            issuer: this.config.issuerUrl,
            email: userInfo.email,
            name: userInfo.name
          },
          ipAddress: 'system',
          userAgent: 'oidc-provider'
        }
      });
    } catch (error) {
      logger.error('Failed to log OIDC authentication:', error);
    }
  }

  /**
   * Get provider metadata
   */
  getMetadata(): any {
    if (!this.issuer) {
      throw new Error('OIDC provider not initialized');
    }

    return {
      issuer: this.issuer.metadata.issuer,
      authorizationEndpoint: this.issuer.metadata.authorization_endpoint,
      tokenEndpoint: this.issuer.metadata.token_endpoint,
      userInfoEndpoint: this.issuer.metadata.userinfo_endpoint,
      jwksUri: this.issuer.metadata.jwks_uri,
      endSessionEndpoint: this.issuer.metadata.end_session_endpoint,
      scopesSupported: this.issuer.metadata.scopes_supported,
      responseTypesSupported: this.issuer.metadata.response_types_supported,
      grantTypesSupported: this.issuer.metadata.grant_types_supported
    };
  }
}