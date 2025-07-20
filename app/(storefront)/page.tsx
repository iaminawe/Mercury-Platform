import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { client, FEATURED_PRODUCTS_QUERY } from '@/lib/shopify';
import ProductGrid from '@/components/storefront/product-grid';
import { Button } from '@/components/ui/button';

async function getFeaturedProducts() {
  try {
    const response = await client.request(FEATURED_PRODUCTS_QUERY, {
      variables: { first: 8 },
    });

    return response.data?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      image: edge.node.images.edges[0]?.node
        ? {
            src: edge.node.images.edges[0].node.transformedSrc,
            altText: edge.node.images.edges[0].node.altText || edge.node.title,
          }
        : undefined,
      priceRange: edge.node.priceRange,
      variantId: edge.node.variants.edges[0]?.node.id,
      availableForSale: edge.node.variants.edges[0]?.node.availableForSale,
    })) || [];
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }
}

export default async function StorefrontHome() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh] md:h-[80vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/40 z-10" />
        <div className="relative z-20 container mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Welcome to Mercury
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Discover our curated collection of premium products designed for modern living.
            </p>
            <Button asChild size="lg">
              <Link href="/products">
                Shop Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute inset-0 bg-muted" />
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Featured Products</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Shop our handpicked selection of best-selling items and new arrivals
            </p>
          </div>
          
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductGrid products={featuredProducts} />
          </Suspense>

          <div className="text-center mt-12">
            <Button asChild variant="outline" size="lg">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Collections Section */}
      <section className="py-16 md:py-24 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Shop by Category</h2>
            <p className="text-lg text-muted-foreground">
              Find exactly what you're looking for
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['New Arrivals', 'Best Sellers', 'On Sale'].map((collection) => (
              <Link
                key={collection}
                href={`/collections/${collection.toLowerCase().replace(' ', '-')}`}
                className="group relative h-64 overflow-hidden rounded-lg bg-background hover:shadow-lg transition-shadow"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-background/20 z-10" />
                <div className="relative z-20 h-full flex items-end p-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{collection}</h3>
                    <p className="text-muted-foreground group-hover:text-primary transition-colors">
                      Shop now →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Quality Guaranteed</h3>
              <p className="text-muted-foreground">
                Premium products backed by our satisfaction guarantee
              </p>
            </div>
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Fast Shipping</h3>
              <p className="text-muted-foreground">
                Free shipping on orders over $50
              </p>
            </div>
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Easy Returns</h3>
              <p className="text-muted-foreground">
                30-day hassle-free return policy
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="aspect-square bg-muted rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}