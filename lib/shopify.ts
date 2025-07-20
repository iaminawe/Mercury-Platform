import { createStorefrontApiClient } from '@shopify/storefront-api-client';

// Initialize Shopify Storefront API client
export const client = createStorefrontApiClient({
  storeDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!,
  publicAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
  apiVersion: '2024-01',
});

// GraphQL query for featured products
export const FEATURED_PRODUCTS_QUERY = `
  query FeaturedProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                transformedSrc(maxWidth: 500, maxHeight: 500)
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                availableForSale
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL query for all products
export const ALL_PRODUCTS_QUERY = `
  query AllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          handle
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                transformedSrc(maxWidth: 500, maxHeight: 500)
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                availableForSale
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// GraphQL query for single product
export const PRODUCT_QUERY = `
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      seo {
        title
        description
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 10) {
        edges {
          node {
            transformedSrc(maxWidth: 1000, maxHeight: 1000)
            altText
          }
        }
      }
      options {
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
            image {
              transformedSrc(maxWidth: 500, maxHeight: 500)
              altText
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation for creating cart
export const CREATE_CART_MUTATION = `
  mutation CreateCart($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
        totalQuantity
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product {
                    title
                    handle
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    transformedSrc(maxWidth: 200, maxHeight: 200)
                    altText
                  }
                }
              }
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

// GraphQL mutation for updating cart
export const UPDATE_CART_MUTATION = `
  mutation UpdateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product {
                    title
                    handle
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    transformedSrc(maxWidth: 200, maxHeight: 200)
                    altText
                  }
                }
              }
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

// GraphQL query for retrieving cart
export const GET_CART_QUERY = `
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      totalQuantity
      lines(first: 100) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                product {
                  title
                  handle
                }
                price {
                  amount
                  currencyCode
                }
                image {
                  transformedSrc(maxWidth: 200, maxHeight: 200)
                  altText
                }
              }
            }
          }
        }
      }
      cost {
        totalAmount {
          amount
          currencyCode
        }
      }
    }
  }
`;

// Format price helper
export const formatPrice = (amount: string, currencyCode: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(parseFloat(amount));
};