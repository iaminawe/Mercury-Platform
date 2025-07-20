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

interface WinBackEmailProps {
  customerName?: string;
  lastOrderDate?: string;
  favoriteCategory?: string;
  totalSpent?: number;
  orderCount?: number;
  winBackOffer?: {
    type: 'percentage' | 'fixed' | 'free_shipping';
    value: number;
    code: string;
    expiresAt: string;
  };
  newProducts?: Array<{
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    url: string;
    isNew?: boolean;
  }>;
  improvements?: string[];
  brandColor?: string;
  unsubscribeUrl?: string;
}

export const WinBackEmail = ({
  customerName = 'there',
  lastOrderDate,
  favoriteCategory,
  totalSpent = 0,
  orderCount = 0,
  winBackOffer,
  newProducts = [],
  improvements = [],
  brandColor = '#007bff',
  unsubscribeUrl = '#'
}: WinBackEmailProps) => {
  const daysSinceLastOrder = lastOrderDate 
    ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const getWinBackMessage = () => {
    if (daysSinceLastOrder > 180) {
      return {
        emoji: '💔',
        title: `We miss you, ${customerName}!`,
        subtitle: 'It\'s been too long since your last visit',
        message: `We noticed it's been ${Math.floor(daysSinceLastOrder / 30)} months since your last order. A lot has changed, and we'd love to welcome you back with something special.`
      };
    } else if (daysSinceLastOrder > 90) {
      return {
        emoji: '🤗',
        title: `Come back, ${customerName}! We miss you`,
        subtitle: 'Your favorite products are waiting',
        message: `It's been ${Math.floor(daysSinceLastOrder / 30)} months since we've seen you. We've added some amazing new products we think you'll love!`
      };
    } else {
      return {
        emoji: '👋',
        title: `Hey ${customerName}, welcome back!`,
        subtitle: 'We have something special for you',
        message: 'We noticed you haven\'t shopped with us recently. Here\'s an exclusive offer to welcome you back!'
      };
    }
  };

  const winBackMsg = getWinBackMessage();
  const previewText = `${winBackMsg.title} - Exclusive offer inside!`;

  const formatOfferText = () => {
    if (!winBackOffer) return '';
    
    switch (winBackOffer.type) {
      case 'percentage':
        return `${winBackOffer.value}% off your next order`;
      case 'fixed':
        return `$${winBackOffer.value} off your next order`;
      case 'free_shipping':
        return 'Free shipping on your next order';
      default:
        return 'Special discount on your next order';
    }
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
            <Text style={heroEmoji}>{winBackMsg.emoji}</Text>
            <Heading style={heroHeading}>
              {winBackMsg.title}
            </Heading>
            <Text style={heroSubtitle}>
              {winBackMsg.subtitle}
            </Text>
            <Text style={heroText}>
              {winBackMsg.message}
            </Text>
          </Section>

          {/* Personal Touch */}
          {(lastOrderDate || totalSpent > 0) && (
            <Section style={personalSection}>
              <Heading style={personalHeading}>We remember you! ❤️</Heading>
              <Hr style={divider} />
              
              <table style={personalTable}>
                <tr>
                  <td style={personalItem}>
                    <Text style={personalLabel}>Your last order</Text>
                    <Text style={personalValue}>
                      {lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : 'A while ago'}
                    </Text>
                  </td>
                  <td style={personalItem}>
                    <Text style={personalLabel}>Total orders</Text>
                    <Text style={personalValue}>{orderCount}</Text>
                  </td>
                  <td style={personalItem}>
                    <Text style={personalLabel}>You've spent</Text>
                    <Text style={personalValue}>${totalSpent.toFixed(2)}</Text>
                  </td>
                </tr>
              </table>
              
              {favoriteCategory && (
                <Text style={personalNote}>
                  We noticed you love {favoriteCategory} products. We have some exciting new arrivals in that category!
                </Text>
              )}
            </Section>
          )}

          {/* Win-Back Offer */}
          {winBackOffer && (
            <Section style={offerSection}>
              <Heading style={offerHeading}>
                🎁 Welcome Back Gift!
              </Heading>
              <Text style={offerMainText}>
                {formatOfferText()}
              </Text>
              <Text style={offerCodeText}>
                Use code: <span style={offerCode}>{winBackOffer.code}</span>
              </Text>
              <Text style={offerExpiryText}>
                Valid until {new Date(winBackOffer.expiresAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              <Button
                style={{ ...button, ...primaryButton, backgroundColor: brandColor }}
                href="/products"
              >
                Claim Your Offer
              </Button>
            </Section>
          )}

          {/* What's New */}
          <Section style={section}>
            <Heading style={sectionHeading}>Look what's new! ✨</Heading>
            <Hr style={divider} />
            <Text style={sectionSubtext}>
              We've been busy adding amazing products while you've been away:
            </Text>
            
            {newProducts.length > 0 && (
              <table style={productsGrid}>
                <tr>
                  {newProducts.slice(0, 3).map((product) => (
                    <td key={product.id} style={productCell}>
                      <Link href={product.url} style={productLink}>
                        <div style={productImageContainer}>
                          <Img
                            src={product.imageUrl}
                            width="150"
                            height="150"
                            alt={product.title}
                            style={productImage}
                          />
                          {product.isNew && (
                            <div style={newBadge}>NEW</div>
                          )}
                        </div>
                        <Text style={productTitle}>{product.title}</Text>
                        <Text style={productPrice}>${product.price.toFixed(2)}</Text>
                      </Link>
                    </td>
                  ))}
                </tr>
              </table>
            )}
          </Section>

          {/* Improvements */}
          {improvements.length > 0 && (
            <Section style={improvementsSection}>
              <Heading style={improvementsHeading}>We've made things even better! 🚀</Heading>
              <Hr style={divider} />
              
              <ul style={improvementsList}>
                {improvements.map((improvement, index) => (
                  <li key={index} style={improvementItem}>
                    <Text style={improvementText}>✅ {improvement}</Text>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Social Proof */}
          <Section style={socialProofSection}>
            <Heading style={socialProofHeading}>What our community is saying</Heading>
            <Hr style={divider} />
            
            <Section style={testimonialSection}>
              <Text style={testimonialText}>
                "I came back after 6 months and was amazed by all the new features 
                and products. The personalized recommendations are spot on!"
              </Text>
              <Text style={testimonialAuthor}>— Jessica L., returning customer</Text>
            </Section>
            
            <Section style={testimonialSection}>
              <Text style={testimonialText}>
                "Mercury's customer service reached out personally when I hadn't 
                ordered in a while. That's the kind of care that brings me back."
              </Text>
              <Text style={testimonialAuthor}>— Michael R., loyal customer</Text>
            </Section>
          </Section>

          {/* Why Come Back */}
          <Section style={whySection}>
            <Heading style={whySectionHeading}>Why customers return to Mercury</Heading>
            <Hr style={divider} />
            
            <table style={whyTable}>
              <tr>
                <td style={whyItem}>
                  <Text style={whyIcon}>🎯</Text>
                  <Text style={whyLabel}>Personalized Experience</Text>
                  <Text style={whyDescription}>Products curated just for you</Text>
                </td>
                <td style={whyItem}>
                  <Text style={whyIcon}>⚡</Text>
                  <Text style={whyLabel}>Faster Checkout</Text>
                  <Text style={whyDescription}>Your info is already saved</Text>
                </td>
                <td style={whyItem}>
                  <Text style={whyIcon}>🏆</Text>
                  <Text style={whyLabel}>Exclusive Access</Text>
                  <Text style={whyDescription}>Member-only deals and previews</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Easy Return */}
          <Section style={easyReturnSection}>
            <Heading style={easyReturnHeading}>Coming back is easy</Heading>
            <Text style={easyReturnText}>
              Your account is still active with all your preferences and order history. 
              Just sign in and pick up where you left off!
            </Text>
            
            <table style={easyReturnTable}>
              <tr>
                <td style={easyReturnItem}>
                  <Button
                    style={{ ...button, backgroundColor: brandColor }}
                    href="/login"
                  >
                    Sign In
                  </Button>
                </td>
                <td style={easyReturnItem}>
                  <Button
                    style={{ ...button, backgroundColor: '#28a745' }}
                    href="/products"
                  >
                    Browse Products
                  </Button>
                </td>
              </tr>
            </table>
          </Section>

          {/* Help Section */}
          <Section style={helpSection}>
            <Heading style={helpHeading}>Need help getting back in?</Heading>
            <Text style={helpText}>
              Our customer success team is here to help you get the most out of Mercury. 
              Whether you need password help or product recommendations, we're here for you.
            </Text>
            <Button
              style={{ ...button, backgroundColor: '#6c757d' }}
              href="/support"
            >
              Get Help
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              We genuinely hope to see you back at Mercury. You've been missed!
            </Text>
            <Text style={footerText}>
              <Link href="/about" style={footerLink}>Our Story</Link>{' '}
              |{' '}
              <Link href="/new-arrivals" style={footerLink}>What's New</Link>{' '}
              |{' '}
              <Link href="/support" style={footerLink}>Support</Link>
            </Text>
            <Hr style={footerDivider} />
            <Text style={unsubscribeText}>
              Don't want to receive win-back emails?{' '}
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
  backgroundColor: '#fff8e1',
  borderRadius: '8px',
  margin: '20px',
};

const heroEmoji = {
  fontSize: '48px',
  margin: '0 0 16px',
};

const heroHeading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
};

const heroSubtitle = {
  fontSize: '20px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 16px',
  fontWeight: '500',
};

const heroText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0',
};

const personalSection = {
  padding: '32px 20px',
  backgroundColor: '#f8f9fa',
  margin: '0 20px',
  borderRadius: '8px',
};

const personalHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const divider = {
  borderColor: '#eaeaea',
  margin: '0 0 24px',
};

const personalTable = {
  width: '100%',
  borderSpacing: '0',
  marginBottom: '20px',
};

const personalItem = {
  width: '33.33%',
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  padding: '0 8px',
};

const personalLabel = {
  fontSize: '12px',
  color: '#666',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  fontWeight: '600',
};

const personalValue = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#484848',
  margin: '0',
};

const personalNote = {
  fontSize: '14px',
  color: '#666',
  margin: '0',
  textAlign: 'center' as const,
  fontStyle: 'italic',
};

const offerSection = {
  padding: '32px 20px',
  backgroundColor: '#d4edda',
  borderRadius: '8px',
  margin: '0 20px',
  border: '1px solid #c3e6cb',
  textAlign: 'center' as const,
};

const offerHeading = {
  fontSize: '28px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#155724',
  margin: '0 0 16px',
};

const offerMainText = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#155724',
  margin: '0 0 12px',
};

const offerCodeText = {
  fontSize: '16px',
  color: '#155724',
  margin: '0 0 8px',
};

const offerCode = {
  backgroundColor: '#155724',
  color: '#d4edda',
  padding: '4px 12px',
  borderRadius: '4px',
  fontSize: '18px',
  fontWeight: '700',
  fontFamily: 'monospace',
};

const offerExpiryText = {
  fontSize: '14px',
  color: '#155724',
  margin: '0 0 24px',
  fontStyle: 'italic',
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

const primaryButton = {
  fontSize: '18px',
  padding: '16px 32px',
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

const sectionSubtext = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 24px',
};

const productsGrid = {
  width: '100%',
  borderSpacing: '16px 0',
};

const productCell = {
  width: '33.33%',
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
};

const productLink = {
  textDecoration: 'none',
  color: 'inherit',
};

const productImageContainer = {
  position: 'relative' as const,
  marginBottom: '8px',
};

const productImage = {
  borderRadius: '8px',
  border: '1px solid #eaeaea',
};

const newBadge = {
  position: 'absolute' as const,
  top: '8px',
  right: '8px',
  backgroundColor: '#28a745',
  color: '#fff',
  fontSize: '10px',
  fontWeight: '700',
  padding: '4px 6px',
  borderRadius: '3px',
};

const productTitle = {
  fontSize: '14px',
  lineHeight: '1.3',
  color: '#484848',
  margin: '0 0 4px',
  fontWeight: '500',
};

const productPrice = {
  fontSize: '16px',
  lineHeight: '1.3',
  color: '#484848',
  margin: '0',
  fontWeight: '600',
};

const improvementsSection = {
  padding: '32px 20px',
};

const improvementsHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
};

const improvementsList = {
  margin: '0',
  padding: '0',
  listStyle: 'none',
};

const improvementItem = {
  margin: '0 0 12px',
};

const improvementText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#484848',
  margin: '0',
};

const socialProofSection = {
  padding: '32px 20px',
  backgroundColor: '#f8f9fa',
  margin: '0 20px',
  borderRadius: '8px',
};

const socialProofHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const testimonialSection = {
  margin: '0 0 20px',
  padding: '16px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  borderLeft: '4px solid #007bff',
};

const testimonialText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#484848',
  margin: '0 0 8px',
  fontStyle: 'italic',
};

const testimonialAuthor = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
  textAlign: 'right' as const,
};

const whySection = {
  padding: '32px 20px',
};

const whySectionHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
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

const easyReturnSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#e7f3ff',
  borderRadius: '8px',
  margin: '0 20px',
};

const easyReturnHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#1a73e8',
  margin: '0 0 16px',
};

const easyReturnText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#1a73e8',
  margin: '0 0 24px',
};

const easyReturnTable = {
  width: '100%',
  borderSpacing: '0',
  maxWidth: '300px',
  margin: '0 auto',
};

const easyReturnItem = {
  width: '50%',
  textAlign: 'center' as const,
  padding: '0 8px',
};

const helpSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const helpHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 12px',
};

const helpText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 20px',
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

export default WinBackEmail;