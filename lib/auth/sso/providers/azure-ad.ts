import { OIDCProvider, OIDCConfig } from '../oidc-provider';
import { SAMLProvider, SAMLConfig } from '../saml-provider';
import { logger } from '@/lib/logger';
import { ConfidentialClientApplication } from '@azure/msal-node';

export interface AzureADConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  protocol: 'oidc' | 'saml' | 'msal';
  samlConfig?: {
    certificate: string;
    entityId: string;
  };
  graphApiScopes?: string[];
}

export class AzureADProvider {
  private provider: OIDCProvider | SAMLProvider | ConfidentialClientApplication;
  private protocol: 'oidc' | 'saml' | 'msal';

  constructor(private config: AzureADConfig) {
    this.protocol = config.protocol;

    switch (this.protocol) {
      case 'oidc':
        this.provider = new OIDCProvider(this.buildOIDCConfig());
        break;
      case 'saml':
        this.provider = new SAMLProvider(this.buildSAMLConfig());
        break;
      case 'msal':
        this.provider = new ConfidentialClientApplication(this.buildMSALConfig());
        break;
    }
  }

  /**
   * Build OIDC configuration for Azure AD
   */
  private buildOIDCConfig(): OIDCConfig {
    const tenantId = this.config.tenantId;
    const issuerUrl = tenantId === 'common' || tenantId === 'organizations' || tenantId === 'consumers'
      ? `https://login.microsoftonline.com/${tenantId}/v2.0`
      : `https://login.microsoftonline.com/${tenantId}/v2.0`;
    
    return {
      issuerUrl,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri,
      scope: 'openid email profile User.Read',
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
   * Build SAML configuration for Azure AD
   */
  private buildSAMLConfig(): SAMLConfig {
    if (!this.config.samlConfig) {
      throw new Error('SAML configuration required for SAML protocol');
    }

    const tenantId = this.config.tenantId;
    
    return {
      entityId: this.config.samlConfig.entityId,
      ssoUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
      certificate: this.config.samlConfig.certificate,
      issuer: this.config.redirectUri,
      callbackUrl: this.config.redirectUri,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
      }
    };
  }

  /**
   * Build MSAL configuration for Azure AD
   */
  private buildMSALConfig(): any {
    return {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        clientSecret: this.config.clientSecret
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: any, message: string) => {
            logger.debug('MSAL:', { level, message });
          },
          piiLoggingEnabled: false,
          logLevel: 3 // Info
        }
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
    logger.info('Azure AD provider initialized', { protocol: this.protocol });
  }

  /**
   * Generate authentication URL
   */
  async generateAuthUrl(state?: string): Promise<string> {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return this.provider.generateAuthUrl(state);
    } else if (this.protocol === 'saml' && this.provider instanceof SAMLProvider) {
      return this.provider.generateAuthRequest(state);
    } else if (this.protocol === 'msal' && this.provider instanceof ConfidentialClientApplication) {
      const authCodeUrlParameters = {
        scopes: this.config.graphApiScopes || ['user.read'],
        redirectUri: this.config.redirectUri,
        state: state
      };
      const response = await this.provider.getAuthCodeUrl(authCodeUrlParameters);
      return response;
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
    } else if (this.protocol === 'saml' && this.provider instanceof SAMLProvider) {
      const { SAMLResponse } = params;
      if (!SAMLResponse) {
        throw new Error('Missing SAMLResponse parameter');
      }
      return await this.provider.validateResponse(SAMLResponse);
    } else if (this.protocol === 'msal' && this.provider instanceof ConfidentialClientApplication) {
      const { code } = params;
      if (!code) {
        throw new Error('Missing code parameter');
      }
      
      const tokenRequest = {
        code,
        scopes: this.config.graphApiScopes || ['user.read'],
        redirectUri: this.config.redirectUri
      };
      
      const response = await this.provider.acquireTokenByCode(tokenRequest);
      
      // Get user info from Microsoft Graph
      const userInfo = await this.getUserInfo(response.accessToken);
      
      return {
        tokenSet: {
          access_token: response.accessToken,
          id_token: response.idToken,
          refresh_token: response.refreshToken,
          expires_in: Math.floor((response.expiresOn!.getTime() - Date.now()) / 1000)
        },
        userInfo
      };
    }
    throw new Error('Invalid provider configuration');
  }

  /**
   * Get user info from Microsoft Graph
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Microsoft Graph');
    }

    const data = await response.json();
    
    // Get user groups if requested
    let groups: string[] = [];
    if (this.config.graphApiScopes?.includes('Directory.Read.All')) {
      groups = await this.getUserGroups(accessToken);
    }

    return {
      sub: data.id,
      email: data.mail || data.userPrincipalName,
      emailVerified: true,
      name: data.displayName,
      givenName: data.givenName,
      familyName: data.surname,
      jobTitle: data.jobTitle,
      department: data.department,
      officeLocation: data.officeLocation,
      groups
    };
  }

  /**
   * Get user groups from Microsoft Graph
   */
  private async getUserGroups(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        logger.warn('Failed to fetch user groups');
        return [];
      }

      const data = await response.json();
      return data.value
        .filter((group: any) => group['@odata.type'] === '#microsoft.graph.group')
        .map((group: any) => group.displayName);
    } catch (error) {
      logger.error('Error fetching user groups:', error);
      return [];
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return await this.provider.refreshToken(refreshToken);
    } else if (this.protocol === 'msal' && this.provider instanceof ConfidentialClientApplication) {
      const refreshTokenRequest = {
        refreshToken,
        scopes: this.config.graphApiScopes || ['user.read']
      };
      
      const response = await this.provider.acquireTokenByRefreshToken(refreshTokenRequest);
      return {
        access_token: response.accessToken,
        id_token: response.idToken,
        refresh_token: response.refreshToken,
        expires_in: Math.floor((response.expiresOn!.getTime() - Date.now()) / 1000)
      };
    }
    throw new Error('Token refresh not supported for this protocol');
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(sessionData?: any): string {
    const postLogoutRedirectUri = `${this.config.redirectUri}/logout/callback`;
    
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return this.provider.getLogoutUrl(
        sessionData?.idToken,
        postLogoutRedirectUri
      );
    } else if (this.protocol === 'saml' && this.provider instanceof SAMLProvider) {
      return this.provider.generateLogoutRequest(
        sessionData?.nameId,
        sessionData?.sessionIndex
      );
    } else if (this.protocol === 'msal') {
      const logoutUri = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/logout`;
      const params = new URLSearchParams({
        post_logout_redirect_uri: postLogoutRedirectUri
      });
      return `${logoutUri}?${params.toString()}`;
    }
    return '/logout';
  }

  /**
   * Get provider metadata
   */
  async getMetadata(): Promise<any> {
    if (this.protocol === 'oidc' && this.provider instanceof OIDCProvider) {
      return {
        type: 'Azure AD OIDC',
        tenantId: this.config.tenantId,
        ...this.provider.getMetadata()
      };
    } else if (this.protocol === 'saml' && this.provider instanceof SAMLProvider) {
      return {
        type: 'Azure AD SAML',
        tenantId: this.config.tenantId,
        metadata: this.provider.getMetadata()
      };
    } else if (this.protocol === 'msal') {
      return {
        type: 'Azure AD MSAL',
        tenantId: this.config.tenantId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        graphEndpoint: 'https://graph.microsoft.com/v1.0'
      };
    }
    return { type: 'Azure AD', protocol: this.protocol };
  }

  /**
   * Validate Azure AD webhook
   */
  static validateWebhook(validationToken?: string): string | null {
    // Azure AD sends a validation token in the initial subscription request
    // We need to echo it back to confirm the webhook endpoint
    return validationToken || null;
  }

  /**
   * Handle Azure AD change notifications
   */
  static async handleChangeNotification(notification: any): Promise<void> {
    logger.info('Azure AD change notification received', { 
      changeType: notification.changeType,
      resource: notification.resource 
    });

    switch (notification.changeType) {
      case 'created':
        if (notification.resource.includes('/users/')) {
          await this.handleUserCreate(notification);
        }
        break;
      
      case 'updated':
        if (notification.resource.includes('/users/')) {
          await this.handleUserUpdate(notification);
        }
        break;
      
      case 'deleted':
        if (notification.resource.includes('/users/')) {
          await this.handleUserDelete(notification);
        }
        break;
      
      default:
        logger.debug('Unhandled change type', { changeType: notification.changeType });
    }
  }

  /**
   * Handle user creation
   */
  private static async handleUserCreate(notification: any): Promise<void> {
    const userId = notification.resource.split('/').pop();
    logger.info('Azure AD user created', { userId });
    // Implement user provisioning logic here
  }

  /**
   * Handle user update
   */
  private static async handleUserUpdate(notification: any): Promise<void> {
    const userId = notification.resource.split('/').pop();
    logger.info('Azure AD user updated', { userId });
    // Implement user update logic here
  }

  /**
   * Handle user deletion
   */
  private static async handleUserDelete(notification: any): Promise<void> {
    const userId = notification.resource.split('/').pop();
    logger.info('Azure AD user deleted', { userId });
    // Implement user deprovisioning logic here
  }
}