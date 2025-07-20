'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Loader2 } from 'lucide-react';
import { client } from '@/lib/shopify';
import { formatPrice } from '@/lib/shopify';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                transformedSrc(maxWidth: 100, maxHeight: 100)
                altText
              }
            }
          }
        }
      }
    }
  }
`;

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await client.request(SEARCH_PRODUCTS_QUERY, {
        variables: {
          query: searchQuery,
          first: 5,
        },
      });

      const products = response.data?.products?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        price: edge.node.priceRange.minVariantPrice,
        image: edge.node.images.edges[0]?.node,
      })) || [];

      setResults(products);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        searchProducts(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchProducts]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full md:w-64 pr-8"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-2"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <div className="absolute right-0 top-0 h-full px-2 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </form>

      {/* Search Results Dropdown */}
      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
          {loading && (
            <div className="p-4 text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Searching...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.handle}`}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
                >
                  {product.image && (
                    <div className="relative w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={product.image.transformedSrc}
                        alt={product.image.altText || product.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(product.price.amount, product.price.currencyCode)}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={() => {
                  setIsOpen(false);
                  setQuery('');
                }}
                className="block p-3 text-center text-sm text-primary hover:bg-muted transition-colors border-t"
              >
                View all results for "{query}"
              </Link>
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">No products found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}