import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface NewsletterEmailProps {
  customerName?: string;
  featuredProducts?: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    imageUrl: string;
    url: string;
  }>;
  articles?: Array<{
    title: string;
    excerpt: string;
    url: string;
    imageUrl: string;
  }>;
  brandColor?: string;
  unsubscribeUrl?: string;
}

export const NewsletterEmail = ({
  customerName = 'there',
  featuredProducts = [],
  articles = [],
  brandColor = '#007bff',
  unsubscribeUrl = '#'
}: NewsletterEmailProps) => {
  const previewText = `Hi ${customerName}, check out what's new this week!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src="/mercury-logo.png"
              width="120"
              height="40"
              alt="Mercury"
              style={logo}
            />
          </Section>

          {/* Hero Section */}
          <Section style={hero}>
            <Heading style={heroHeading}>
              Hey {customerName}! ✨
            </Heading>
            <Text style={heroText}>
              We've curated the best products and content just for you this week. 
              Check out what's trending and discover your next favorite find!
            </Text>
          </Section>

          {/* Featured Products */}
          {featuredProducts.length > 0 && (
            <Section style={section}>
              <Heading style={sectionHeading}>Featured Products</Heading>
              <Hr style={divider} />
              {featuredProducts.map((product, index) => (
                <Section key={product.id} style={productSection}>
                  <table style={productTable}>
                    <tr>
                      <td style={productImageCell}>
                        <Img
                          src={product.imageUrl}
                          width="120"
                          height="120"
                          alt={product.title}
                          style={productImage}
                        />
                      </td>
                      <td style={productContentCell}>
                        <Heading style={productTitle}>{product.title}</Heading>
                        <Text style={productDescription}>{product.description}</Text>
                        <Text style={productPrice}>${product.price.toFixed(2)}</Text>
                        <Button
                          style={{ ...button, backgroundColor: brandColor }}
                          href={product.url}
                        >
                          Shop Now
                        </Button>
                      </td>
                    </tr>
                  </table>
                  {index < featuredProducts.length - 1 && <Hr style={productDivider} />}
                </Section>
              ))}
            </Section>
          )}

          {/* Articles & Content */}
          {articles.length > 0 && (
            <Section style={section}>
              <Heading style={sectionHeading}>This Week's Reads</Heading>
              <Hr style={divider} />
              {articles.map((article, index) => (
                <Section key={index} style={articleSection}>
                  <table style={articleTable}>
                    <tr>
                      <td style={articleImageCell}>
                        <Img
                          src={article.imageUrl}
                          width="80"
                          height="80"
                          alt={article.title}
                          style={articleImage}
                        />
                      </td>
                      <td style={articleContentCell}>
                        <Heading style={articleTitle}>
                          <Link href={article.url} style={articleLink}>
                            {article.title}
                          </Link>
                        </Heading>
                        <Text style={articleExcerpt}>{article.excerpt}</Text>
                      </td>
                    </tr>
                  </table>
                  {index < articles.length - 1 && <Hr style={articleDivider} />}
                </Section>
              ))}
            </Section>
          )}

          {/* CTA Section */}
          <Section style={ctaSection}>
            <Heading style={ctaHeading}>Ready to Explore?</Heading>
            <Text style={ctaText}>
              Browse our full collection and discover products tailored to your interests.
            </Text>
            <Button
              style={{ ...button, ...primaryButton, backgroundColor: brandColor }}
              href="/products"
            >
              Explore All Products
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Thanks for being part of the Mercury community!
            </Text>
            <Text style={footerText}>
              Follow us on{' '}
              <Link href="#" style={footerLink}>Twitter</Link>{' '}
              |{' '}
              <Link href="#" style={footerLink}>Instagram</Link>{' '}
              |{' '}
              <Link href="#" style={footerLink}>Facebook</Link>
            </Text>
            <Hr style={footerDivider} />
            <Text style={unsubscribeText}>
              Don't want to receive these emails?{' '}
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '20px 0',
  textAlign: 'center' as const,
  borderBottom: '1px solid #eaeaea',
};

const logo = {
  margin: '0 auto',
};

const hero = {
  padding: '40px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#f8f9fa',
};

const heroHeading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
};

const heroText = {
  fontSize: '18px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0',
};

const section = {
  padding: '32px 20px',
};

const sectionHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
};

const divider = {
  borderColor: '#eaeaea',
  margin: '0 0 24px',
};

const productSection = {
  margin: '0 0 24px',
};

const productTable = {
  width: '100%',
  borderSpacing: '0',
};

const productImageCell = {
  width: '140px',
  verticalAlign: 'top' as const,
  paddingRight: '20px',
};

const productContentCell = {
  verticalAlign: 'top' as const,
};

const productImage = {
  borderRadius: '8px',
  border: '1px solid #eaeaea',
};

const productTitle = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 8px',
};

const productDescription = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 12px',
};

const productPrice = {
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
};

const productDivider = {
  borderColor: '#f0f0f0',
  margin: '24px 0',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  fontWeight: '600',
};

const articleSection = {
  margin: '0 0 20px',
};

const articleTable = {
  width: '100%',
  borderSpacing: '0',
};

const articleImageCell = {
  width: '100px',
  verticalAlign: 'top' as const,
  paddingRight: '16px',
};

const articleContentCell = {
  verticalAlign: 'top' as const,
};

const articleImage = {
  borderRadius: '6px',
  border: '1px solid #eaeaea',
};

const articleTitle = {
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 8px',
};

const articleLink = {
  color: '#007bff',
  textDecoration: 'none',
};

const articleExcerpt = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0',
};

const articleDivider = {
  borderColor: '#f0f0f0',
  margin: '20px 0',
};

const ctaSection = {
  padding: '40px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  margin: '0 20px',
};

const ctaHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
};

const ctaText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 24px',
};

const primaryButton = {
  fontSize: '18px',
  padding: '16px 32px',
};

const footer = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 8px',
};

const footerLink = {
  color: '#007bff',
  textDecoration: 'none',
};

const footerDivider = {
  borderColor: '#eaeaea',
  margin: '24px 0 16px',
};

const unsubscribeText = {
  fontSize: '12px',
  lineHeight: '1.3',
  color: '#999',
  margin: '0',
};

export default NewsletterEmail;