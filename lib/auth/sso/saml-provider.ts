import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  issuer: string;
  callbackUrl: string;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;
  attributeMapping?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
  };
}

export interface SAMLAssertion {
  nameId: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
  issuer: string;
  audience: string;
  notBefore?: Date;
  notOnOrAfter?: Date;
}

export class SAMLProvider {
  constructor(private config: SAMLConfig) {}

  /**
   * Generate SAML authentication request
   */
  generateAuthRequest(relayState?: string): string {
    const id = `_${createHash('sha256').update(Date.now().toString()).digest('hex')}`;
    const issueInstant = new Date().toISOString();
    
    const authRequest = `
      <samlp:AuthnRequest 
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${this.config.ssoUrl}"
        AssertionConsumerServiceURL="${this.config.callbackUrl}">
        <saml:Issuer>${this.config.issuer}</saml:Issuer>
      </samlp:AuthnRequest>
    `.trim();

    // Base64 encode and create redirect URL
    const encodedRequest = Buffer.from(authRequest).toString('base64');
    const params = new URLSearchParams({
      SAMLRequest: encodedRequest,
      ...(relayState && { RelayState: relayState })
    });

    return `${this.config.ssoUrl}?${params.toString()}`;
  }

  /**
   * Validate and parse SAML response
   */
  async validateResponse(samlResponse: string): Promise<SAMLAssertion> {
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
    const doc = new DOMParser().parseFromString(decoded);

    // Validate signature
    if (!this.validateSignature(doc)) {
      throw new Error('Invalid SAML signature');
    }

    // Extract assertion
    const assertion = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Assertion')[0];
    if (!assertion) {
      throw new Error('No SAML assertion found');
    }

    // Validate conditions
    this.validateConditions(assertion);

    // Extract attributes
    const nameId = this.extractNameId(assertion);
    const sessionIndex = this.extractSessionIndex(assertion);
    const attributes = this.extractAttributes(assertion);

    // Log successful authentication
    await this.logAuthentication(nameId, attributes);

    return {
      nameId,
      sessionIndex,
      attributes,
      issuer: this.config.issuer,
      audience: this.config.entityId
    };
  }

  /**
   * Validate XML signature
   */
  private validateSignature(doc: Document): boolean {
    try {
      const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
      if (!signature) return false;

      const sig = new SignedXml();
      sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${this.config.certificate}</X509Certificate></X509Data>`,
        getKey: () => Buffer.from(this.config.certificate, 'base64')
      };

      sig.loadSignature(signature.toString());
      return sig.checkSignature(doc.toString());
    } catch (error) {
      logger.error('SAML signature validation failed:', error);
      return false;
    }
  }

  /**
   * Validate assertion conditions
   */
  private validateConditions(assertion: Element): void {
    const conditions = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Conditions')[0];
    if (!conditions) return;

    const notBefore = conditions.getAttribute('NotBefore');
    const notOnOrAfter = conditions.getAttribute('NotOnOrAfter');
    const now = new Date();

    if (notBefore && new Date(notBefore) > now) {
      throw new Error('SAML assertion not yet valid');
    }

    if (notOnOrAfter && new Date(notOnOrAfter) < now) {
      throw new Error('SAML assertion expired');
    }

    // Validate audience restriction
    const audienceRestriction = conditions.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AudienceRestriction')[0];
    if (audienceRestriction) {
      const audience = audienceRestriction.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Audience')[0];
      if (audience && audience.textContent !== this.config.entityId) {
        throw new Error('Invalid SAML audience');
      }
    }
  }

  /**
   * Extract NameID from assertion
   */
  private extractNameId(assertion: Element): string {
    const subject = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Subject')[0];
    const nameId = subject?.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'NameID')[0];
    
    if (!nameId?.textContent) {
      throw new Error('No NameID found in SAML assertion');
    }

    return nameId.textContent;
  }

  /**
   * Extract session index
   */
  private extractSessionIndex(assertion: Element): string {
    const authnStatement = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AuthnStatement')[0];
    return authnStatement?.getAttribute('SessionIndex') || '';
  }

  /**
   * Extract attributes from assertion
   */
  private extractAttributes(assertion: Element): Record<string, string | string[]> {
    const attributeStatement = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeStatement')[0];
    if (!attributeStatement) return {};

    const attributes: Record<string, string | string[]> = {};
    const attributeNodes = attributeStatement.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute');

    for (let i = 0; i < attributeNodes.length; i++) {
      const attr = attributeNodes[i];
      const name = attr.getAttribute('Name');
      if (!name) continue;

      const values = attr.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeValue');
      const valueArray: string[] = [];

      for (let j = 0; j < values.length; j++) {
        const value = values[j].textContent;
        if (value) valueArray.push(value);
      }

      attributes[name] = valueArray.length === 1 ? valueArray[0] : valueArray;
    }

    return this.mapAttributes(attributes);
  }

  /**
   * Map SAML attributes to application attributes
   */
  private mapAttributes(samlAttributes: Record<string, string | string[]>): Record<string, string | string[]> {
    if (!this.config.attributeMapping) return samlAttributes;

    const mapped: Record<string, string | string[]> = {};
    
    for (const [appKey, samlKey] of Object.entries(this.config.attributeMapping)) {
      if (samlKey && samlAttributes[samlKey]) {
        mapped[appKey] = samlAttributes[samlKey];
      }
    }

    // Include unmapped attributes
    return { ...samlAttributes, ...mapped };
  }

  /**
   * Generate logout request
   */
  generateLogoutRequest(nameId: string, sessionIndex?: string): string {
    const id = `_${createHash('sha256').update(Date.now().toString()).digest('hex')}`;
    const issueInstant = new Date().toISOString();

    const logoutRequest = `
      <samlp:LogoutRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${this.config.ssoUrl}">
        <saml:Issuer>${this.config.issuer}</saml:Issuer>
        <saml:NameID>${nameId}</saml:NameID>
        ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ''}
      </samlp:LogoutRequest>
    `.trim();

    const encodedRequest = Buffer.from(logoutRequest).toString('base64');
    return `${this.config.ssoUrl}?SAMLRequest=${encodedRequest}`;
  }

  /**
   * Log authentication event
   */
  private async logAuthentication(nameId: string, attributes: Record<string, string | string[]>) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'sso.saml.login',
          userId: nameId,
          metadata: {
            provider: 'saml',
            issuer: this.config.issuer,
            attributes
          },
          ipAddress: 'system',
          userAgent: 'saml-provider'
        }
      });
    } catch (error) {
      logger.error('Failed to log SAML authentication:', error);
    }
  }

  /**
   * Get metadata XML for service provider
   */
  getMetadata(): string {
    const entityId = this.config.entityId;
    const acsUrl = this.config.callbackUrl;

    return `
      <?xml version="1.0"?>
      <EntityDescriptor 
        xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
        entityID="${entityId}">
        <SPSSODescriptor 
          AuthnRequestsSigned="false"
          WantAssertionsSigned="true"
          protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
          <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
          <AssertionConsumerService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="${acsUrl}"
            index="0" />
        </SPSSODescriptor>
      </EntityDescriptor>
    `.trim();
  }
}