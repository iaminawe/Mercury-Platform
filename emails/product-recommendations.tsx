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

interface ProductRecommendationsEmailProps {
  customerName?: string;
  recommendationType?: 'similar' | 'trending' | 'personalized' | 'category';
  products?: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    url: string;
    rating?: number;
    reviewCount?: number;
    badge?: string;
  }>;
  categoryName?: string;
  aiInsight?: string;
  brandColor?: string;
  unsubscribeUrl?: string;
}

export const ProductRecommendationsEmail = ({
  customerName = 'there',
  recommendationType = 'personalized',
  products = [],
  categoryName,
  aiInsight,
  brandColor = '#007bff',
  unsubscribeUrl = '#'
}: ProductRecommendationsEmailProps) => {
  const getRecommendationTitle = () => {
    switch (recommendationType) {
      case 'similar':
        return `${customerName}, we found products you might love! ❤️`;
      case 'trending':
        return `What's trending for you, ${customerName}! 📈`;
      case 'personalized':
        return `Handpicked for you, ${customerName}! 💎`;
      case 'category':
        return `New ${categoryName} arrivals, ${customerName}! ✨`;
      default:
        return `Special picks for you, ${customerName}!`;
    }
  };

  const getRecommendationSubtitle = () => {
    switch (recommendationType) {
      case 'similar':
        return 'Based on your recent views and purchases';
      case 'trending':
        return 'Popular with customers who have similar tastes';
      case 'personalized':
        return 'Curated specifically for your interests';
      case 'category':
        return `Fresh arrivals in ${categoryName}`;
      default:
        return 'Products we think you\'ll love';
    }
  };

  const title = getRecommendationTitle();
  const subtitle = getRecommendationSubtitle();
  const previewText = `${title} - ${products.length} new recommendations`;

  const renderStarRating = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('⭐');
    }
    if (hasHalfStar) {
      stars.push('⭐');
    }
    
    return stars.join('');
  };

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
              {title}
            </Heading>
            <Text style={heroSubtitle}>
              {subtitle}
            </Text>
            {aiInsight && (
              <Section style={aiInsightSection}>
                <Text style={aiInsightText}>
                  🤖 <strong>AI Insight:</strong> {aiInsight}
                </Text>
              </Section>
            )}
          </Section>

          {/* Products Grid */}
          <Section style={section}>
            <Heading style={sectionHeading}>Your Recommendations</Heading>
            <Hr style={divider} />
            
            {products.map((product, index) => (
              <Section key={product.id} style={productSection}>
                <table style={productTable}>
                  <tr>
                    <td style={productImageCell}>
                      <div style={productImageContainer}>
                        <Img
                          src={product.imageUrl}
                          width="150"
                          height="150"
                          alt={product.title}
                          style={productImage}
                        />
                        {product.badge && (
                          <div style={productBadge}>
                            {product.badge}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={productContentCell}>
                      <Heading style={productTitle}>{product.title}</Heading>
                      <Text style={productDescription}>{product.description}</Text>
                      
                      {/* Rating */}
                      {product.rating && (
                        <Section style={ratingSection}>
                          <Text style={ratingText}>
                            {renderStarRating(product.rating)} ({product.reviewCount || 0} reviews)
                          </Text>
                        </Section>
                      )}
                      
                      {/* Price */}
                      <Section style={priceSection}>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <Text style={originalPrice}>${product.originalPrice.toFixed(2)}</Text>
                        )}
                        <Text style={currentPrice}>${product.price.toFixed(2)}</Text>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <Text style={discountText}>
                            Save ${(product.originalPrice - product.price).toFixed(2)}
                          </Text>
                        )}
                      </Section>
                      
                      <Button
                        style={{ ...button, backgroundColor: brandColor }}
                        href={product.url}
                      >
                        View Product
                      </Button>
                    </td>
                  </tr>
                </table>
                {index < products.length - 1 && <Hr style={productDivider} />}
              </Section>
            ))}
          </Section>

          {/* Why These Products */}
          <Section style={whySection}>
            <Heading style={whySectionHeading}>Why we picked these for you</Heading>
            <Hr style={divider} />
            
            <table style={whyTable}>
              <tr>
                <td style={whyItem}>
                  <Text style={whyIcon}>🎯</Text>
                  <Text style={whyLabel}>Personal Match</Text>
                  <Text style={whyDescription}>Based on your browsing and purchase history</Text>
                </td>
                <td style={whyItem}>
                  <Text style={whyIcon}>📊</Text>
                  <Text style={whyLabel}>Data-Driven</Text>
                  <Text style={whyDescription}>AI analysis of your preferences</Text>
                </td>
                <td style={whyItem}>
                  <Text style={whyIcon}>⭐</Text>
                  <Text style={whyLabel}>Quality Tested</Text>
                  <Text style={whyDescription}>Highly rated by similar customers</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* More Like This */}
          <Section style={moreSection}>
            <Heading style={moreSectionHeading}>Want more personalized recommendations?</Heading>
            <Text style={moreSectionText}>
              The more you interact with products, the better our AI gets at understanding your preferences. 
              Here's how to get even better recommendations:
            </Text>
            
            <ul style={tipsList}>
              <li style={tipsListItem}>❤️ Save items to your wishlist</li>
              <li style={tipsListItem}>👀 Browse categories you're interested in</li>
              <li style={tipsListItem}>⭐ Rate products you've purchased</li>
              <li style={tipsListItem}>📝 Leave reviews to help others</li>
            </ul>
            
            <Button
              style={{ ...button, backgroundColor: '#28a745' }}
              href="/recommendations/settings"
            >
              Customize My Recommendations
            </Button>
          </Section>

          {/* Similar Customers */}
          <Section style={socialSection}>
            <Heading style={socialHeading}>Customers like you also viewed</Heading>
            <Hr style={divider} />
            
            <table style={socialTable}>
              <tr>
                <td style={socialItem}>
                  <Text style={socialStat}>73%</Text>
                  <Text style={socialLabel}>Also bought from this category</Text>
                </td>
                <td style={socialItem}>
                  <Text style={socialStat}>4.8⭐</Text>
                  <Text style={socialLabel}>Average rating of your matches</Text>
                </td>
                <td style={socialItem}>
                  <Text style={socialStat}>2.3x</Text>
                  <Text style={socialLabel}>More likely to love these picks</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* CTA Section */}
          <Section style={ctaSection}>
            <Heading style={ctaHeading}>Ready to discover more?</Heading>
            <Text style={ctaText}>
              Browse our full collection of personalized recommendations
            </Text>
            <Button
              style={{ ...button, ...primaryButton, backgroundColor: brandColor }}
              href="/recommendations"
            >
              See All Recommendations
            </Button>
          </Section>

          {/* Feedback Section */}
          <Section style={feedbackSection}>
            <Heading style={feedbackHeading}>How did we do?</Heading>
            <Text style={feedbackText}>
              Help us improve your recommendations by letting us know what you think!
            </Text>
            
            <table style={feedbackTable}>
              <tr>
                <td style={feedbackItem}>
                  <Button
                    style={{ ...button, backgroundColor: '#28a745' }}
                    href="/feedback/thumbs-up"
                  >
                    👍 Love these picks
                  </Button>
                </td>
                <td style={feedbackItem}>
                  <Button
                    style={{ ...button, backgroundColor: '#dc3545' }}
                    href="/feedback/thumbs-down"
                  >
                    👎 Not for me
                  </Button>
                </td>
              </tr>
            </table>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Your recommendations are updated daily based on new products and your activity.
            </Text>
            <Text style={footerText}>
              <Link href="/account/preferences" style={footerLink}>Update Preferences</Link>{' '}
              |{' '}
              <Link href="/recommendations/history" style={footerLink}>View History</Link>{' '}
              |{' '}
              <Link href="/support" style={footerLink}>Need Help?</Link>
            </Text>
            <Hr style={footerDivider} />
            <Text style={unsubscribeText}>
              Don't want recommendation emails?{' '}
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

const heroSubtitle = {
  fontSize: '18px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 16px',
};

const aiInsightSection = {
  backgroundColor: '#e7f3ff',
  border: '1px solid #b3d9ff',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px auto 0',
  maxWidth: '400px',
};

const aiInsightText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#1a73e8',
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
  width: '170px',
  verticalAlign: 'top' as const,
  paddingRight: '20px',
};

const productContentCell = {
  verticalAlign: 'top' as const,
};

const productImageContainer = {
  position: 'relative' as const,
};

const productImage = {
  borderRadius: '8px',
  border: '1px solid #eaeaea',
};

const productBadge = {
  position: 'absolute' as const,
  top: '8px',
  right: '8px',
  backgroundColor: '#dc3545',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '600',
  padding: '4px 8px',
  borderRadius: '4px',
};

const productTitle = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 8px',
};

const productDescription = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 12px',
};

const ratingSection = {
  margin: '0 0 12px',
};

const ratingText = {
  fontSize: '14px',
  color: '#666',
  margin: '0',
};

const priceSection = {
  margin: '0 0 16px',
};

const originalPrice = {
  fontSize: '16px',
  color: '#999',
  textDecoration: 'line-through',
  margin: '0 8px 0 0',
  display: 'inline',
};

const currentPrice = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#484848',
  margin: '0 8px 0 0',
  display: 'inline',
};

const discountText = {
  fontSize: '14px',
  color: '#28a745',
  fontWeight: '600',
  margin: '0',
  display: 'inline',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '10px 20px',
  fontWeight: '600',
};

const productDivider = {
  borderColor: '#f0f0f0',
  margin: '24px 0',
};

const whySection = {
  padding: '32px 20px',
  backgroundColor: '#f8f9fa',
  margin: '0 20px',
  borderRadius: '8px',
};

const whySectionHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const whyTable = {
  width: '100%',
  borderSpacing: '0',
};

const whyItem = {
  width: '33.33%',
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  padding: '0 8px',
};

const whyIcon = {
  fontSize: '24px',
  margin: '0 0 8px',
};

const whyLabel = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 4px',
};

const whyDescription = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
};

const moreSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const moreSectionHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
};

const moreSectionText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 20px',
};

const tipsList = {
  textAlign: 'left' as const,
  margin: '0 auto 24px',
  maxWidth: '300px',
  padding: '0',
  listStyle: 'none',
};

const tipsListItem = {
  fontSize: '14px',
  color: '#666',
  margin: '0 0 8px',
  padding: '0',
};

const socialSection = {
  padding: '32px 20px',
};

const socialHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const socialTable = {
  width: '100%',
  borderSpacing: '0',
};

const socialItem = {
  width: '33.33%',
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  padding: '0 8px',
};

const socialStat = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#007bff',
  margin: '0 0 4px',
};

const socialLabel = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
};

const ctaSection = {
  padding: '32px 20px',
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
  fontSize: '16px',
  padding: '12px 24px',
};

const feedbackSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const feedbackHeading = {
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 12px',
};

const feedbackText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 20px',
};

const feedbackTable = {
  width: '100%',
  borderSpacing: '0',
  maxWidth: '300px',
  margin: '0 auto',
};

const feedbackItem = {
  width: '50%',
  textAlign: 'center' as const,
  padding: '0 8px',
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

export default ProductRecommendationsEmail;