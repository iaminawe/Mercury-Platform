import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { client, PRODUCT_QUERY } from '@/lib/shopify';
import ProductDetail from './product-detail';

interface ProductPageProps {
  params: {
    handle: string;
  };
}

async function getProduct(handle: string) {
  try {
    const response = await client.request(PRODUCT_QUERY, {
      variables: { handle },
    });
    return response.data?.product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.handle);
  
  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  return {
    title: product.seo?.title || product.title,
    description: product.seo?.description || product.description,
    openGraph: {
      title: product.title,
      description: product.description,
      images: product.images.edges[0]?.node ? [
        {
          url: product.images.edges[0].node.transformedSrc,
          alt: product.images.edges[0].node.altText || product.title,
        }
      ] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProduct(params.handle);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} />;
}