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

interface WelcomeEmailProps {
  customerName?: string;
  stepNumber?: number;
  totalSteps?: number;
  setupSteps?: Array<{
    title: string;
    description: string;
    action: string;
    actionUrl: string;
    completed?: boolean;
  }>;
  recommendedProducts?: Array<{
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    url: string;
  }>;
  brandColor?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
}

export const WelcomeSeriesEmail = ({
  customerName = 'there',
  stepNumber = 1,
  totalSteps = 3,
  setupSteps = [],
  recommendedProducts = [],
  brandColor = '#007bff',
  supportUrl = '/support',
  unsubscribeUrl = '#'
}: WelcomeEmailProps) => {
  const getStepTitle = () => {
    switch (stepNumber) {
      case 1:
        return `Welcome to Mercury, ${customerName}! 🎉`;
      case 2:
        return `Let's personalize your experience, ${customerName}`;
      case 3:
        return `You're all set up, ${customerName}! Time to explore`;
      default:
        return `Welcome to Mercury, ${customerName}!`;
    }
  };

  const getStepContent = () => {
    switch (stepNumber) {
      case 1:
        return {
          subtitle: "We're thrilled to have you join our community!",
          content: "Mercury is designed to help you discover amazing products tailored to your interests. Let's get you started on your journey to finding exactly what you're looking for."
        };
      case 2:
        return {
          subtitle: "A few quick steps to enhance your experience",
          content: "By completing your profile and preferences, we can provide you with personalized recommendations and exclusive offers that match your interests."
        };
      case 3:
        return {
          subtitle: "Your setup is complete - time to explore!",
          content: "Now that your profile is set up, we've curated some products we think you'll love. Plus, enjoy 15% off your first order as our welcome gift!"
        };
      default:
        return {
          subtitle: "Welcome aboard!",
          content: "We're excited to help you discover amazing products."
        };
    }
  };

  const stepContent = getStepContent();
  const previewText = getStepTitle();

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
            <Text style={stepIndicator}>
              Step {stepNumber} of {totalSteps}
            </Text>
          </Section>

          {/* Progress Bar */}
          <Section style={progressSection}>
            <div style={progressBar}>
              <div style={{
                ...progressFill,
                width: `${(stepNumber / totalSteps) * 100}%`,
                backgroundColor: brandColor
              }} />
            </div>
          </Section>

          {/* Hero Section */}
          <Section style={hero}>
            <Heading style={heroHeading}>
              {getStepTitle()}
            </Heading>
            <Text style={heroSubtitle}>
              {stepContent.subtitle}
            </Text>
            <Text style={heroText}>
              {stepContent.content}
            </Text>
          </Section>

          {/* Setup Steps */}
          {setupSteps.length > 0 && (
            <Section style={section}>
              <Heading style={sectionHeading}>
                {stepNumber === 1 ? 'Get Started' : 'Complete Your Setup'}
              </Heading>
              <Hr style={divider} />
              
              {setupSteps.map((step, index) => (
                <Section key={index} style={setupStepSection}>
                  <table style={setupStepTable}>
                    <tr>
                      <td style={setupStepIconCell}>
                        <div style={{
                          ...setupStepIcon,
                          backgroundColor: step.completed ? '#28a745' : brandColor
                        }}>
                          {step.completed ? '✓' : index + 1}
                        </div>
                      </td>
                      <td style={setupStepContentCell}>
                        <Heading style={setupStepTitle}>{step.title}</Heading>
                        <Text style={setupStepDescription}>{step.description}</Text>
                        {!step.completed && (
                          <Button
                            style={{ ...button, backgroundColor: brandColor }}
                            href={step.actionUrl}
                          >
                            {step.action}
                          </Button>
                        )}
                        {step.completed && (
                          <Text style={completedText}>✓ Completed</Text>
                        )}
                      </td>
                    </tr>
                  </table>
                </Section>
              ))}
            </Section>
          )}

          {/* Recommended Products (Step 3) */}
          {stepNumber === 3 && recommendedProducts.length > 0 && (
            <Section style={section}>
              <Heading style={sectionHeading}>Picked Just for You</Heading>
              <Hr style={divider} />
              <Text style={sectionSubtext}>
                Based on your preferences, here are some products we think you'll love:
              </Text>
              
              <table style={productsGrid}>
                <tr>
                  {recommendedProducts.slice(0, 3).map((product) => (
                    <td key={product.id} style={productCell}>
                      <Link href={product.url} style={productLink}>
                        <Img
                          src={product.imageUrl}
                          width="150"
                          height="150"
                          alt={product.title}
                          style={productImage}
                        />
                        <Text style={productTitle}>{product.title}</Text>
                        <Text style={productPrice}>${product.price.toFixed(2)}</Text>
                      </Link>
                    </td>
                  ))}
                </tr>
              </table>
            </Section>
          )}

          {/* Special Offer (Step 3) */}
          {stepNumber === 3 && (
            <Section style={offerSection}>
              <Heading style={offerHeading}>Welcome Gift: 15% Off! 🎁</Heading>
              <Text style={offerText}>
                Use code <strong>WELCOME15</strong> on your first order
              </Text>
              <Button
                style={{ ...button, ...primaryButton, backgroundColor: brandColor }}
                href="/products"
              >
                Start Shopping
              </Button>
            </Section>
          )}

          {/* Tips Section */}
          <Section style={tipsSection}>
            <Heading style={tipsHeading}>💡 Pro Tips</Heading>
            <Hr style={divider} />
            
            {stepNumber === 1 && (
              <div>
                <Text style={tipText}>• Complete your profile to get personalized recommendations</Text>
                <Text style={tipText}>• Enable notifications for exclusive deals and new arrivals</Text>
                <Text style={tipText}>• Add items to your wishlist to track price changes</Text>
              </div>
            )}
            
            {stepNumber === 2 && (
              <div>
                <Text style={tipText}>• The more preferences you set, the better our recommendations</Text>
                <Text style={tipText}>• You can update your preferences anytime in settings</Text>
                <Text style={tipText}>• Follow brands you love for exclusive updates</Text>
              </div>
            )}
            
            {stepNumber === 3 && (
              <div>
                <Text style={tipText}>• Check out our weekly newsletter for trending products</Text>
                <Text style={tipText}>• Join our community for reviews and recommendations</Text>
                <Text style={tipText}>• Use our mobile app for faster shopping on the go</Text>
              </div>
            )}
          </Section>

          {/* Support Section */}
          <Section style={supportSection}>
            <Heading style={supportHeading}>Need Help?</Heading>
            <Text style={supportText}>
              Our team is here to help you get the most out of Mercury. 
              Don't hesitate to reach out if you have any questions!
            </Text>
            <Button
              style={{ ...button, backgroundColor: '#6c757d' }}
              href={supportUrl}
            >
              Contact Support
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Thanks for choosing Mercury! We can't wait to help you discover amazing products.
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
  padding: '20px 20px 10px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #eaeaea',
};

const logo = {
  margin: '0 auto 10px',
};

const stepIndicator = {
  fontSize: '14px',
  color: '#666',
  margin: '0',
  fontWeight: '500',
};

const progressSection = {
  padding: '0 20px 20px',
};

const progressBar = {
  width: '100%',
  height: '6px',
  backgroundColor: '#e9ecef',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressFill = {
  height: '100%',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
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

const divider = {
  borderColor: '#eaeaea',
  margin: '0 0 24px',
};

const setupStepSection = {
  margin: '0 0 24px',
};

const setupStepTable = {
  width: '100%',
  borderSpacing: '0',
};

const setupStepIconCell = {
  width: '60px',
  verticalAlign: 'top' as const,
  paddingRight: '16px',
};

const setupStepContentCell = {
  verticalAlign: 'top' as const,
};

const setupStepIcon = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: '#007bff',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: '600',
  textAlign: 'center' as const,
  lineHeight: '40px',
};

const setupStepTitle = {
  fontSize: '18px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 8px',
};

const setupStepDescription = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 16px',
};

const completedText = {
  fontSize: '14px',
  color: '#28a745',
  fontWeight: '600',
  margin: '0',
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

const productImage = {
  borderRadius: '8px',
  border: '1px solid #eaeaea',
  marginBottom: '8px',
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

const offerSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#fff3cd',
  borderRadius: '8px',
  margin: '0 20px',
  border: '1px solid #ffeaa7',
};

const offerHeading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#856404',
  margin: '0 0 12px',
};

const offerText = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#856404',
  margin: '0 0 20px',
};

const primaryButton = {
  fontSize: '16px',
  padding: '12px 24px',
};

const tipsSection = {
  padding: '32px 20px',
  backgroundColor: '#f8f9fa',
  margin: '0 20px',
  borderRadius: '8px',
};

const tipsHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 16px',
};

const tipText = {
  fontSize: '14px',
  lineHeight: '1.4',
  color: '#666',
  margin: '0 0 8px',
};

const supportSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
};

const supportHeading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 12px',
};

const supportText = {
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

export default WelcomeSeriesEmail;