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

interface AbandonedCartEmailProps {
  customerName?: string;
  cartItems?: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    quantity: number;
    imageUrl: string;
    url: string;
  }>;
  cartTotal?: number;
  urgencyLevel?: 'low' | 'medium' | 'high';
  discountOffer?: {
    code: string;
    percentage: number;
    expiresAt: string;
  };
  brandColor?: string;
  cartUrl?: string;
  unsubscribeUrl?: string;
}

export const AbandonedCartEmail = ({
  customerName = 'there',
  cartItems = [],
  cartTotal = 0,
  urgencyLevel = 'medium',
  discountOffer,
  brandColor = '#007bff',
  cartUrl = '/cart',
  unsubscribeUrl = '#'
}: AbandonedCartEmailProps) => {
  const getUrgencyMessage = () => {
    switch (urgencyLevel) {
      case 'low':
        return {
          emoji: '💭',
          title: `Still thinking it over, ${customerName}?`,
          subtitle: 'Your items are waiting for you',
          message: 'Take your time! We\'ve saved your items for when you\'re ready.'
        };
      case 'medium':
        return {
          emoji: '🛒',
          title: `Don't forget your cart, ${customerName}!`,
          subtitle: 'Complete your purchase before these items sell out',
          message: 'These popular items are selling fast. Complete your order to secure yours!'
        };
      case 'high':
        return {
          emoji: '⏰',
          title: `${customerName}, your cart expires soon!`,
          subtitle: 'Only a few hours left to complete your purchase',
          message: 'Your cart will expire in 6 hours. Don\'t miss out on these amazing items!'
        };
      default:
        return {
          emoji: '🛒',
          title: `Don't forget your cart, ${customerName}!`,
          subtitle: 'Complete your purchase',
          message: 'Your items are waiting for you!'
        };
    }
  };

  const urgencyMsg = getUrgencyMessage();
  const previewText = `${urgencyMsg.title} - ${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} in your cart`;

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
            <Text style={heroEmoji}>{urgencyMsg.emoji}</Text>
            <Heading style={heroHeading}>
              {urgencyMsg.title}
            </Heading>
            <Text style={heroSubtitle}>
              {urgencyMsg.subtitle}
            </Text>
            <Text style={heroText}>
              {urgencyMsg.message}
            </Text>
          </Section>

          {/* Cart Items */}
          <Section style={section}>
            <Heading style={sectionHeading}>Your Cart</Heading>
            <Hr style={divider} />
            
            {cartItems.map((item, index) => (
              <Section key={item.id} style={cartItemSection}>
                <table style={cartItemTable}>
                  <tr>
                    <td style={itemImageCell}>
                      <Img
                        src={item.imageUrl}
                        width="100"
                        height="100"
                        alt={item.title}
                        style={itemImage}
                      />
                    </td>
                    <td style={itemContentCell}>
                      <Heading style={itemTitle}>{item.title}</Heading>
                      <Text style={itemDescription}>{item.description}</Text>
                      <table style={itemDetailsTable}>
                        <tr>
                          <td>
                            <Text style={itemQuantity}>Qty: {item.quantity}</Text>
                          </td>
                          <td style={itemPriceCell}>
                            <Text style={itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                {index < cartItems.length - 1 && <Hr style={itemDivider} />}
              </Section>
            ))}

            {/* Cart Total */}
            <Section style={totalSection}>
              <table style={totalTable}>
                <tr>
                  <td style={totalLabelCell}>
                    <Text style={totalLabel}>Total:</Text>
                  </td>
                  <td style={totalValueCell}>
                    <Text style={totalValue}>${cartTotal.toFixed(2)}</Text>
                  </td>
                </tr>
              </table>
            </Section>
          </Section>

          {/* Discount Offer */}
          {discountOffer && (
            <Section style={discountSection}>
              <Heading style={discountHeading}>
                🎁 Special Offer: {discountOffer.percentage}% Off!
              </Heading>
              <Text style={discountText}>
                Complete your purchase now and save {discountOffer.percentage}% with code{' '}
                <strong style={discountCode}>{discountOffer.code}</strong>
              </Text>
              <Text style={discountExpiry}>
                Expires: {new Date(discountOffer.expiresAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </Section>
          )}

          {/* CTA Section */}
          <Section style={ctaSection}>
            <Button
              style={{ ...button, ...primaryButton, backgroundColor: brandColor }}
              href={cartUrl}
            >
              Complete My Purchase
            </Button>
            <Text style={ctaSubtext}>
              Free shipping on orders over $50
            </Text>
          </Section>

          {/* Trust Signals */}
          <Section style={trustSection}>
            <Heading style={trustHeading}>Why customers love shopping with us</Heading>
            <Hr style={divider} />
            
            <table style={trustTable}>
              <tr>
                <td style={trustItem}>
                  <Text style={trustIcon}>🚚</Text>
                  <Text style={trustLabel}>Free Shipping</Text>
                  <Text style={trustDescription}>On orders over $50</Text>
                </td>
                <td style={trustItem}>
                  <Text style={trustIcon}>↩️</Text>
                  <Text style={trustLabel}>Easy Returns</Text>
                  <Text style={trustDescription}>30-day return policy</Text>
                </td>
                <td style={trustItem}>
                  <Text style={trustIcon}>🔒</Text>
                  <Text style={trustLabel}>Secure Payment</Text>
                  <Text style={trustDescription}>Your data is protected</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Alternative Actions */}
          <Section style={alternativeSection}>
            <Heading style={alternativeHeading}>Need help deciding?</Heading>
            <Text style={alternativeText}>
              Not quite ready to purchase? Here are some other options:
            </Text>
            
            <table style={alternativeTable}>
              <tr>
                <td style={alternativeItem}>
                  <Button
                    style={{ ...button, backgroundColor: '#6c757d' }}
                    href="/wishlist"
                  >
                    Save to Wishlist
                  </Button>
                </td>
                <td style={alternativeItem}>
                  <Button
                    style={{ ...button, backgroundColor: '#28a745' }}
                    href="/support/chat"
                  >
                    Chat with Expert
                  </Button>
                </td>
              </tr>
            </table>
          </Section>

          {/* Social Proof */}
          <Section style={socialProofSection}>
            <Heading style={socialProofHeading}>⭐ What our customers say</Heading>
            <Hr style={divider} />
            
            <Section style={reviewSection}>
              <Text style={reviewText}>
                "Fast shipping, great quality, and excellent customer service. 
                Mercury has become my go-to for online shopping!"
              </Text>
              <Text style={reviewAuthor}>— Sarah M., Verified Customer</Text>
            </Section>
            
            <Section style={reviewSection}>
              <Text style={reviewText}>
                "Love the personalized recommendations. They always suggest 
                products I end up loving!"
              </Text>
              <Text style={reviewAuthor}>— David K., 5-star review</Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Still have questions? Our customer support team is here to help!
            </Text>
            <Text style={footerText}>
              <Link href="/support" style={footerLink}>Contact Support</Link>{' '}
              |{' '}
              <Link href="/faq" style={footerLink}>FAQ</Link>{' '}
              |{' '}
              <Link href="/shipping" style={footerLink}>Shipping Info</Link>
            </Text>
            <Hr style={footerDivider} />
            <Text style={unsubscribeText}>
              Don't want to receive cart reminders?{' '}
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
  fontSize: '28px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  margin: '0 0 12px',
};

const heroSubtitle = {
  fontSize: '18px',
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

const cartItemSection = {
  margin: '0 0 20px',
};

const cartItemTable = {
  width: '100%',
  borderSpacing: '0',
};

const itemImageCell = {
  width: '120px',
  verticalAlign: 'top' as const,
  paddingRight: '16px',
};

const itemContentCell = {
  verticalAlign: 'top' as const,
};

const itemImage = {
  borderRadius: '8px',
  border: '1px solid #eaeaea',
};

const itemTitle = {
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 8px',
};

const itemDescription = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 12px',
};

const itemDetailsTable = {
  width: '100%',
  borderSpacing: '0',
};

const itemQuantity = {
  fontSize: '14px',
  color: '#666',
  margin: '0',
};

const itemPriceCell = {
  textAlign: 'right' as const,
};

const itemPrice = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#484848',
  margin: '0',
};

const itemDivider = {
  borderColor: '#f0f0f0',
  margin: '20px 0',
};

const totalSection = {
  padding: '16px 0',
  borderTop: '2px solid #eaeaea',
};

const totalTable = {
  width: '100%',
  borderSpacing: '0',
};

const totalLabelCell = {
  textAlign: 'left' as const,
};

const totalValueCell = {
  textAlign: 'right' as const,
};

const totalLabel = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#484848',
  margin: '0',
};

const totalValue = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#484848',
  margin: '0',
};

const discountSection = {
  padding: '24px 20px',
  backgroundColor: '#d4edda',
  borderRadius: '8px',
  margin: '0 20px',
  border: '1px solid #c3e6cb',
  textAlign: 'center' as const,
};

const discountHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#155724',
  margin: '0 0 12px',
};

const discountText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#155724',
  margin: '0 0 8px',
};

const discountCode = {
  backgroundColor: '#155724',
  color: '#d4edda',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '16px',
  fontWeight: '600',
};

const discountExpiry = {
  fontSize: '14px',
  color: '#155724',
  margin: '0',
  fontStyle: 'italic',
};

const ctaSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
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

const ctaSubtext = {
  fontSize: '14px',
  color: '#666',
  margin: '16px 0 0',
};

const trustSection = {
  padding: '32px 20px',
  backgroundColor: '#f8f9fa',
  margin: '0 20px',
  borderRadius: '8px',
};

const trustHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const trustTable = {
  width: '100%',
  borderSpacing: '0',
};

const trustItem = {
  width: '33.33%',
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  padding: '0 8px',
};

const trustIcon = {
  fontSize: '24px',
  margin: '0 0 8px',
};

const trustLabel = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 4px',
};

const trustDescription = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
};

const alternativeSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const alternativeHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 12px',
};

const alternativeText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 20px',
};

const alternativeTable = {
  width: '100%',
  borderSpacing: '0',
};

const alternativeItem = {
  width: '50%',
  textAlign: 'center' as const,
  padding: '0 8px',
};

const socialProofSection = {
  padding: '32px 20px',
};

const socialProofHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const reviewSection = {
  margin: '0 0 20px',
  padding: '16px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  borderLeft: '4px solid #007bff',
};

const reviewText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#484848',
  margin: '0 0 8px',
  fontStyle: 'italic',
};

const reviewAuthor = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
  textAlign: 'right' as const,
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

export default AbandonedCartEmail;