import { OIDCProvider, OIDCConfig } from '../oidc-provider';
import { SAMLProvider, SAMLConfig } from '../saml-provider';
import { logger } from '@/lib/logger';

export interface OktaConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  protocol: 'oidc' | 'saml';
  samlConfig?: {
    certificate: string;
    entityId: string;
  };
}

export class OktaProvider {
  private provider: OIDCProvider | SAMLProvider;
  private protocol: 'oidc' | 'saml';

  constructor(private config: OktaConfig) {
    this.protocol = config.protocol;

    if (this.protocol === 'oidc') {
      this.provider = new OIDCProvider(this.buildOIDCConfig());
    } else {
      this.provider = new SAMLProvider(this.buildSAMLConfig());
    }
  }

  /**
   * Build OIDC configuration for Okta
   */
  private buildOIDCConfig(): OIDCConfig {
    const oktaDomain = this.config.domain.replace(/\/$/, '');
    
    return {
      issuerUrl: `${oktaDomain}`,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri,
      scope: 'openid email profile groups',
      responseType: 'code',
      grantType: 'authorization_code',
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        picture: 'picture',
        groups: 'groups'
      }
    };
  }

  /**
   * Build SAML configuration for Okta
   */
  private buildSAMLConfig(): SAMLConfig {
    if (!this.config.samlConfig) {
      throw new Error('SAML configuration required for SAML protocol');
    }

    const oktaDomain = this.config.domain.replace(/\/$/, '');
    
    return {
      entityId: this.config.samlConfig.entityId,
      ssoUrl: `${oktaDomain}/app/${this.config.clientId}/sso/saml`,
      certificate: this.config.samlConfig.certificate,
      issuer: this.config.redirectUri,
      callbackUrl: this.config.redirectUri,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        groups: 'http://schemas.xmlsoap.org/claims/Group'
      }
    };
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      await this.provider.initialize();
    }
    logger.info('Okta provider initialized', { protocol: this.protocol });
  }

  /**
   * Generate authentication URL
   */
  generateAuthUrl(state?: string): string {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return this.provider.generateAuthUrl(state);
    } else if (this.provider instanceof SAMLProvider) {
      return this.provider.generateAuthRequest(state);
    }
    throw new Error('Invalid provider configuration');
  }

  /**
   * Handle authentication callback
   */
  async handleCallback(params: any): Promise<any> {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      const { code, state } = params;
      if (!code || !state) {
        throw new Error('Missing code or state parameter');
      }
      return await this.provider.handleCallback(code, state);
    } else if (this.provider instanceof SAMLProvider) {
      const { SAMLResponse } = params;
      if (!SAMLResponse) {
        throw new Error('Missing SAMLResponse parameter');
      }
      return await this.provider.validateResponse(SAMLResponse);
    }
    throw new Error('Invalid provider configuration');
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(sessionData?: any): string {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return this.provider.getLogoutUrl(
        sessionData?.idToken,
        `${this.config.redirectUri}/logout/callback`
      );
    } else if (this.provider instanceof SAMLProvider) {
      return this.provider.generateLogoutRequest(
        sessionData?.nameId,
        sessionData?.sessionIndex
      );
    }
    return '/logout';
  }

  /**
   * Get provider metadata
   */
  getMetadata(): any {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return {
        type: 'Okta OIDC',
        ...this.provider.getMetadata()
      };
    } else if (this.provider instanceof SAMLProvider) {
      return {
        type: 'Okta SAML',
        metadata: this.provider.getMetadata()
      };
    }
    return { type: 'Okta', protocol: this.protocol };
  }

  /**
   * Validate Okta webhook
   */
  static validateWebhook(payload: any, signature: string, secret: string): boolean {
    // Implement Okta webhook validation
    // This would verify the webhook signature using the shared secret
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('base64');
    
    return signature === expectedSignature;
  }

  /**
   * Handle Okta events (user provisioning, deprovisioning, etc.)
   */
  static async handleEvent(event: any): Promise<void> {
    logger.info('Okta event received', { eventType: event.eventType });

    switch (event.eventType) {
      case 'com.okta.user.lifecycle.create':
        // Handle user creation
        await this.handleUserCreate(event);
        break;
      
      case 'com.okta.user.lifecycle.deactivate':
        // Handle user deactivation
        await this.handleUserDeactivate(event);
        break;
      
      case 'com.okta.group.user.add':
        // Handle group membership addition
        await this.handleGroupAdd(event);
        break;
      
      case 'com.okta.group.user.remove':
        // Handle group membership removal
        await this.handleGroupRemove(event);
        break;
      
      default:
        logger.debug('Unhandled Okta event type', { eventType: event.eventType });
    }
  }

  /**
   * Handle user creation event
   */
  private static async handleUserCreate(event: any): Promise<void> {
    const { target } = event;
    if (!target || target.length === 0) return;

    const user = target[0];
    logger.info('Okta user created', { 
      userId: user.id,
      email: user.alternateId 
    });

    // Implement user provisioning logic here
  }

  /**
   * Handle user deactivation event
   */
  private static async handleUserDeactivate(event: any): Promise<void> {
    const { target } = event;
    if (!target || target.length === 0) return;

    const user = target[0];
    logger.info('Okta user deactivated', { 
      userId: user.id,
      email: user.alternateId 
    });

    // Implement user deprovisioning logic here
  }

  /**
   * Handle group addition event
   */
  private static async handleGroupAdd(event: any): Promise<void> {
    const { target } = event;
    if (!target || target.length < 2) return;

    const [user, group] = target;
    logger.info('Okta user added to group', { 
      userId: user.id,
      groupId: group.id,
      groupName: group.displayName 
    });

    // Implement group membership update logic here
  }

  /**
   * Handle group removal event
   */
  private static async handleGroupRemove(event: any): Promise<void> {
    const { target } = event;
    if (!target || target.length < 2) return;

    const [user, group] = target;
    logger.info('Okta user removed from group', { 
      userId: user.id,
      groupId: group.id,
      groupName: group.displayName 
    });

    // Implement group membership update logic here
  }
}