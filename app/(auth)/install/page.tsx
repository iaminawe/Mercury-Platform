'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function InstallPage() {
  const router = useRouter();
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Clean up the shop domain
      let cleanedDomain = shopDomain.trim().toLowerCase();
      
      // Remove protocol if present
      cleanedDomain = cleanedDomain.replace(/^https?:\/\//, '');
      
      // Remove trailing slash
      cleanedDomain = cleanedDomain.replace(/\/$/, '');
      
      // Add .myshopify.com if not present
      if (!cleanedDomain.includes('.myshopify.com')) {
        cleanedDomain = `${cleanedDomain}.myshopify.com`;
      }

      // Validate the domain format
      const domainRegex = /^[a-z0-9-]+\.myshopify\.com$/;
      if (!domainRegex.test(cleanedDomain)) {
        setError('Please enter a valid Shopify store domain');
        setIsLoading(false);
        return;
      }

      // Redirect to the OAuth endpoint
      window.location.href = `/api/auth/shopify?shop=${encodeURIComponent(cleanedDomain)}`;
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Install Mercury</CardTitle>
          <CardDescription>
            Connect your Shopify store to unlock powerful AI-driven insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop">Store Domain</Label>
              <Input
                id="shop"
                type="text"
                placeholder="your-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                disabled={isLoading}
                required
              />
              <p className="text-sm text-gray-500">
                Enter your Shopify store domain without https://
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                'Install App'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By installing, you agree to our</p>
            <p>
              <a href="/terms" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                Terms of Service
              </a>
              {' and '}
              <a href="/privacy" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                Privacy Policy
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}