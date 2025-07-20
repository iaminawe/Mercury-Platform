import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <WifiOff className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">You're Offline</h1>
        <p className="text-lg text-muted-foreground mb-8">
          It looks like you've lost your internet connection. Please check your connection and try again.
        </p>
        <Button 
          onClick={() => window.location.reload()}
          size="lg"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}