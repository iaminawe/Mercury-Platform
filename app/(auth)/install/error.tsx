'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const errorMessages: Record<string, string> = {
  missing_parameters: 'Required parameters are missing. Please try again.',
  invalid_state: 'Security validation failed. Please try again.',
  invalid_hmac: 'Request validation failed. Please try again.',
  token_exchange_failed: 'Failed to complete authentication. Please try again.',
  store_update_failed: 'Failed to update store information. Please try again.',
  store_creation_failed: 'Failed to create store record. Please try again.',
  user_creation_failed: 'Failed to create user account. Please try again.',
  unexpected_error: 'An unexpected error occurred. Please try again.',
};

export default function InstallError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');

  const errorMessage = error && errorMessages[error] 
    ? errorMessages[error] 
    : 'An error occurred during installation. Please try again.';

  useEffect(() => {
    // Log the error for debugging
    console.error('Installation error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Installation Failed</CardTitle>
          <CardDescription>
            We couldn't complete the installation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button
              onClick={() => router.push('/install')}
              className="w-full"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full"
            >
              Back to Home
            </Button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>If this problem persists, please contact support.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}