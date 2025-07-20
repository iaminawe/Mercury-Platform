import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

export interface SSOSession {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
}

export interface SessionConfig {
  sessionDuration?: number; // in seconds, default 8 hours
  absoluteTimeout?: number; // in seconds, default 24 hours
  slidingExpiration?: boolean; // default true
  jwtSecret: string;
  cookieName?: string; // default 'sso_session'
  cookieDomain?: string;
  cookieSecure?: boolean; // default true in production
  cookieSameSite?: 'strict' | 'lax' | 'none'; // default 'lax'
}

export class SSOSessionManager {
  private config: Required<SessionConfig>;
  private jwtSecret: Uint8Array;

  constructor(config: SessionConfig) {
    this.config = {
      sessionDuration: config.sessionDuration || 8 * 60 * 60, // 8 hours
      absoluteTimeout: config.absoluteTimeout || 24 * 60 * 60, // 24 hours
      slidingExpiration: config.slidingExpiration !== false,
      jwtSecret: config.jwtSecret,
      cookieName: config.cookieName || 'sso_session',
      cookieDomain: config.cookieDomain || undefined,
      cookieSecure: config.cookieSecure !== false || process.env.NODE_ENV === 'production',
      cookieSameSite: config.cookieSameSite || 'lax'
    };

    this.jwtSecret = new TextEncoder().encode(this.config.jwtSecret);
  }

  /**
   * Create a new SSO session
   */
  async createSession({
    userId,
    provider,
    providerUserId,
    tokens,
    metadata = {}
  }: {
    userId: string;
    provider: string;
    providerUserId: string;
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
    };
    metadata?: Record<string, any>;
  }): Promise<SSOSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionDuration * 1000);

    // Store session in database
    const session = await prisma.ssoSession.create({
      data: {
        id: sessionId,
        userId,
        provider,
        providerUserId,
        accessToken: tokens?.accessToken,
        refreshToken: tokens?.refreshToken,
        idToken: tokens?.idToken,
        expiresAt,
        metadata,
        lastActivity: now
      }
    });

    // Log session creation
    await this.logSessionEvent('session.created', session);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SSOSession | null> {
    const session = await prisma.ssoSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      await this.destroySession(sessionId);
      return null;
    }

    // Update last activity if sliding expiration is enabled
    if (this.config.slidingExpiration) {
      await this.touchSession(sessionId);
    }

    return session;
  }

  /**
   * Get session by JWT token
   */
  async getSessionByToken(token: string): Promise<SSOSession | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      const sessionId = payload.sid as string;
      
      if (!sessionId) {
        return null;
      }

      return await this.getSession(sessionId);
    } catch (error) {
      logger.error('Failed to verify session token:', error);
      return null;
    }
  }

  /**
   * Generate session JWT token
   */
  async generateSessionToken(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const token = await new SignJWT({
      sid: sessionId,
      uid: session.userId,
      provider: session.provider
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(session.expiresAt)
      .sign(this.jwtSecret);

    return token;
  }

  /**
   * Update session tokens
   */
  async updateTokens(
    sessionId: string,
    tokens: {
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
    }
  ): Promise<void> {
    await prisma.ssoSession.update({
      where: { id: sessionId },
      data: {
        ...tokens,
        lastActivity: new Date()
      }
    });

    await this.logSessionEvent('session.tokens_updated', { sessionId });
  }

  /**
   * Touch session to update last activity
   */
  async touchSession(sessionId: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionDuration * 1000);

    await prisma.ssoSession.update({
      where: { id: sessionId },
      data: {
        lastActivity: now,
        expiresAt // Extend expiration with sliding window
      }
    });
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await prisma.ssoSession.findUnique({
      where: { id: sessionId }
    });

    if (session) {
      await prisma.ssoSession.delete({
        where: { id: sessionId }
      });

      await this.logSessionEvent('session.destroyed', session);
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string, except?: string): Promise<number> {
    const where: any = { userId };
    if (except) {
      where.id = { not: except };
    }

    const result = await prisma.ssoSession.deleteMany({ where });

    await this.logSessionEvent('session.user_sessions_destroyed', { userId, count: result.count });

    return result.count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SSOSession[]> {
    const sessions = await prisma.ssoSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastActivity: 'desc' }
    });

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.ssoSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    if (result.count > 0) {
      logger.info('Cleaned up expired sessions', { count: result.count });
    }

    return result.count;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: SSOSession): boolean {
    const now = new Date();
    
    // Check absolute expiration
    if (session.expiresAt < now) {
      return true;
    }

    // Check absolute timeout from creation
    const absoluteExpiry = new Date(session.createdAt.getTime() + this.config.absoluteTimeout * 1000);
    if (absoluteExpiry < now) {
      return true;
    }

    return false;
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Log session event
   */
  private async logSessionEvent(event: string, data: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: event,
          userId: data.userId || data.sessionId,
          metadata: data,
          ipAddress: 'system',
          userAgent: 'sso-session-manager'
        }
      });
    } catch (error) {
      logger.error('Failed to log session event:', error);
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActive: number;
    byProvider: Record<string, number>;
    averageSessionDuration: number;
  }> {
    const activeSessions = await prisma.ssoSession.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      select: {
        provider: true,
        createdAt: true,
        lastActivity: true
      }
    });

    const byProvider = activeSessions.reduce((acc, session) => {
      acc[session.provider] = (acc[session.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const durations = activeSessions.map(session => 
      session.lastActivity.getTime() - session.createdAt.getTime()
    );

    const averageSessionDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 1000 // in seconds
      : 0;

    return {
      totalActive: activeSessions.length,
      byProvider,
      averageSessionDuration
    };
  }

  /**
   * Get cookie options
   */
  getCookieOptions(): any {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      domain: this.config.cookieDomain,
      path: '/'
    };
  }

  /**
   * Get cookie name
   */
  getCookieName(): string {
    return this.config.cookieName;
  }
}