'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Search } from 'lucide-react';
import { CartProvider } from '@/contexts/cart-context';
import CartDrawer from '@/components/storefront/cart-drawer';
import SearchBar from '@/components/storefront/search-bar';

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    }
  }, []);

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-xl font-bold">Mercury</span>
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
                  Home
                </Link>
                <Link href="/products" className="text-sm font-medium hover:text-primary transition-colors">
                  Products
                </Link>
                <Link href="/collections" className="text-sm font-medium hover:text-primary transition-colors">
                  Collections
                </Link>
                <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">
                  About
                </Link>
              </nav>

              {/* Actions */}
              <div className="flex items-center space-x-4">
                <Suspense fallback={<div className="w-64 h-10" />}>
                  <SearchBar />
                </Suspense>
                <CartDrawer />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-muted mt-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="font-semibold mb-4">About</h3>
                <ul className="space-y-2">
                  <li><Link href="/about" className="text-sm text-muted-foreground hover:text-primary">Our Story</Link></li>
                  <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Customer Care</h3>
                <ul className="space-y-2">
                  <li><Link href="/shipping" className="text-sm text-muted-foreground hover:text-primary">Shipping</Link></li>
                  <li><Link href="/returns" className="text-sm text-muted-foreground hover:text-primary">Returns</Link></li>
                  <li><Link href="/faq" className="text-sm text-muted-foreground hover:text-primary">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Connect</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Instagram</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Twitter</a></li>
                  <li><a href="#" className="text-sm text-muted-foreground hover:text-primary">Facebook</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Newsletter</h3>
                <p className="text-sm text-muted-foreground mb-4">Subscribe to get special offers and updates</p>
                <form className="space-y-2">
                  <input 
                    type="email" 
                    placeholder="Your email" 
                    className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-primary text-primary-foreground text-sm py-2 px-4 rounded-md hover:bg-primary/90"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t text-center">
              <p className="text-sm text-muted-foreground">© 2024 Mercury. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}