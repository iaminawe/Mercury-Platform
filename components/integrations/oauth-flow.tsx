'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, ExternalLink, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface OAuthFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokens: OAuthTokens) => void;
  config: {
    name: string;
    clientId: string;
    authorizationUrl: string;
    redirectUri: string;
    scopes: string[];
    state?: string;
  };
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
}

type FlowStep = 'initial' | 'authorizing' | 'processing' | 'success' | 'error';

export function OAuthFlow({ isOpen, onClose, onSuccess, config }: OAuthFlowProps) {
  const [step, setStep] = useState<FlowStep>('initial');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);

  useEffect(() => {
    // Listen for OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'oauth-callback') {
        handleCallback(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Check if auth window was closed
    if (authWindow && step === 'authorizing') {
      const checkInterval = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkInterval);
          if (step === 'authorizing') {
            setStep('error');
            setError('Authorization window was closed');
          }
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
  }, [authWindow, step]);

  const startOAuthFlow = () => {
    setStep('authorizing');
    setProgress(25);
    
    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: config.state || generateState(),
    });
    
    const authUrl = `${config.authorizationUrl}?${params.toString()}`;
    
    // Open authorization window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const newWindow = window.open(
      authUrl,
      'oauth-authorization',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (newWindow) {
      setAuthWindow(newWindow);
      newWindow.focus();
    } else {
      setStep('error');
      setError('Failed to open authorization window. Please check your popup blocker.');
    }
  };

  const handleCallback = async (data: any) => {
    if (data.error) {
      setStep('error');
      setError(data.error_description || 'Authorization failed');
      return;
    }
    
    if (data.code) {
      setStep('processing');
      setProgress(75);
      
      try {
        // Exchange authorization code for tokens
        const response = await fetch('/api/integrations/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: config.name.toLowerCase().replace(/\s+/g, '-'),
            code: data.code,
            state: data.state,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to exchange authorization code');
        }
        
        const tokens = await response.json();
        
        setStep('success');
        setProgress(100);
        
        // Wait a moment before closing
        setTimeout(() => {
          onSuccess(tokens);
          toast.success(`Successfully connected to ${config.name}`);
          onClose();
        }, 1500);
        
      } catch (err) {
        setStep('error');
        setError(err instanceof Error ? err.message : 'Failed to complete authorization');
      }
    }
    
    // Close the auth window if it's still open
    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }
  };

  const generateState = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const reset = () => {
    setStep('initial');
    setProgress(0);
    setError(null);
    setAuthWindow(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to {config.name}</DialogTitle>
          <DialogDescription>
            Authorize Mercury to access your {config.name} account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          {step !== 'initial' && step !== 'error' && (
            <Progress value={progress} className="h-2" />
          )}
          
          {/* Initial Step */}
          {step === 'initial' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Secure OAuth 2.0 authorization</span>
                </div>
                
                <Alert>
                  <AlertDescription>
                    You'll be redirected to {config.name} to authorize access. Mercury will be able to:
                  </AlertDescription>
                </Alert>
                
                <ul className="space-y-2 text-sm">
                  {config.scopes.map((scope, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>{formatScope(scope)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={startOAuthFlow} className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Authorize
                </Button>
              </div>
            </>
          )}
          
          {/* Authorizing Step */}
          {step === 'authorizing' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div>
                <p className="font-medium">Waiting for authorization...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please complete the authorization in the popup window
                </p>
              </div>
            </div>
          )}
          
          {/* Processing Step */}
          {step === 'processing' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div>
                <p className="font-medium">Processing authorization...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Exchanging authorization code for access tokens
                </p>
              </div>
            </div>
          )}
          
          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <div>
                <p className="font-medium text-lg">Successfully connected!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {config.name} account has been linked
                </p>
              </div>
            </div>
          )}
          
          {/* Error Step */}
          {step === 'error' && (
            <>
              <div className="text-center space-y-4 py-8">
                <XCircle className="h-12 w-12 text-red-600 mx-auto" />
                <div>
                  <p className="font-medium text-lg">Authorization failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={reset} className="flex-1">
                  Try Again
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to format OAuth scopes into readable text
function formatScope(scope: string): string {
  const scopeDescriptions: Record<string, string> = {
    'read': 'View your data',
    'write': 'Modify your data',
    'email': 'Access your email address',
    'profile': 'Access your profile information',
    'business_management': 'Manage your business account',
    'catalog_management': 'Manage product catalogs',
    'campaign_management': 'Create and manage ad campaigns',
    'report': 'View analytics and reports',
    'orders': 'Access order information',
    'products': 'Access product information',
    'customers': 'Access customer data',
  };
  
  return scopeDescriptions[scope] || scope.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}