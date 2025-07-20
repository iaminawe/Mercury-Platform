import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { createLogger } from '@/lib/logger';

const logger = createLogger('prompt-templates');

export interface PromptContext {
  storeId?: string;
  userId?: string;
  storeName?: string;
  storeType?: string;
  language?: string;
  currency?: string;
  timezone?: string;
  [key: string]: any;
}

export interface ProductAnalysisContext extends PromptContext {
  product: any;
  analysisType: 'seo' | 'description' | 'pricing' | 'competition' | 'optimization';
  competitors?: any[];
  marketData?: any;
}

export interface CustomerAnalysisContext extends PromptContext {
  customer?: any;
  segment?: string;
  orderHistory?: any[];
  behaviorData?: any;
}

/**
 * System prompts for different AI personas
 */
export const SYSTEM_PROMPTS = {
  ecommerce_expert: `You are an expert e-commerce consultant specializing in Shopify stores. You help merchants optimize their products, pricing, marketing, and operations. Your advice is practical, data-driven, and focused on increasing conversions and revenue.

Key expertise areas:
- Product optimization and SEO
- Pricing strategy and competitive analysis
- Customer segmentation and behavior
- Marketing automation and campaigns
- Store performance analytics
- Inventory management
- Customer service automation

Always provide actionable recommendations with clear reasoning.`,

  customer_service: `You are a helpful customer service assistant for a Shopify store. You are friendly, professional, and focused on resolving customer issues quickly and effectively.

Capabilities:
- Answer product questions
- Help with order status and tracking
- Process returns and exchanges
- Provide store policy information
- Escalate complex issues when needed
- Offer product recommendations

Always maintain a positive, helpful tone and prioritize customer satisfaction.`,

  data_analyst: `You are a data analyst specializing in e-commerce analytics. You analyze store performance, customer behavior, and market trends to provide insights that drive business decisions.

Focus areas:
- Sales performance analysis
- Customer lifetime value
- Conversion funnel optimization
- Product performance metrics
- Market trend analysis
- Predictive analytics
- ROI measurement

Present insights clearly with supporting data and actionable recommendations.`,

  marketing_specialist: `You are a digital marketing specialist focused on e-commerce growth. You create strategies for customer acquisition, retention, and engagement across multiple channels.

Expertise:
- Email marketing campaigns
- Social media strategy
- Content marketing
- Paid advertising optimization
- Customer journey mapping
- Personalization strategies
- Marketing automation

Provide specific, measurable marketing recommendations.`,

  technical_advisor: `You are a technical advisor for Shopify apps and integrations. You help with implementation, troubleshooting, and optimization of technical solutions.

Areas of expertise:
- Shopify API and webhooks
- App integrations and setup
- Performance optimization
- Data synchronization
- Custom development guidance
- Security best practices
- Technical troubleshooting

Provide clear, technical guidance that is easy to follow.`
};

/**
 * Product analysis prompt templates
 */
export const PRODUCT_ANALYSIS_PROMPTS = {
  seo_optimization: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.ecommerce_expert],
    ["human", `Analyze this product for SEO optimization:

Product Data: {product}

Current Performance:
- Current title: {currentTitle}
- Current description: {currentDescription}
- Current tags: {currentTags}
- Current meta description: {currentMetaDescription}

Store Context:
- Store: {storeName}
- Target market: {targetMarket}
- Primary keywords: {primaryKeywords}

Provide a comprehensive SEO analysis including:
1. Title optimization recommendations
2. Description improvements for search visibility
3. Strategic keyword integration
4. Meta description optimization
5. Product tags and categories
6. Image alt text suggestions
7. URL slug recommendations
8. Specific implementation steps

Format your response as actionable recommendations with expected impact.`]
  ]),

  description_enhancement: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.ecommerce_expert],
    ["human", `Enhance this product description for better conversions:

Product: {product}

Current Description: {currentDescription}

Context:
- Target audience: {targetAudience}
- Key selling points: {sellingPoints}
- Competitor products: {competitors}
- Price point: {pricePoint}
- Brand voice: {brandVoice}

Create an improved product description that:
1. Captures attention with compelling headlines
2. Highlights unique value propositions
3. Addresses customer pain points
4. Includes social proof elements
5. Creates urgency and desire
6. Optimizes for mobile reading
7. Incorporates relevant keywords naturally

Provide both the enhanced description and explanation of changes made.`]
  ]),

  pricing_analysis: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.ecommerce_expert],
    ["human", `Analyze pricing strategy for this product:

Product: {product}
Current Price: {currentPrice}
Cost: {productCost}
Margin: {currentMargin}

Market Context:
- Competitor prices: {competitorPrices}
- Market position: {marketPosition}
- Customer segment: {customerSegment}
- Demand elasticity: {demandData}

Historical Data:
- Sales performance: {salesHistory}
- Price change history: {priceHistory}
- Customer feedback: {customerFeedback}

Provide pricing recommendations including:
1. Optimal price point analysis
2. Psychological pricing strategies
3. Bundle and upsell opportunities
4. Seasonal pricing adjustments
5. Competitive positioning
6. A/B testing recommendations
7. Expected impact on revenue and margin

Include specific price recommendations with rationale.`]
  ]),

  competitor_analysis: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.ecommerce_expert],
    ["human", `Conduct competitive analysis for this product:

Our Product: {product}
Our Price: {ourPrice}
Our Position: {ourPosition}

Competitors: {competitors}

Analysis Areas:
- Product features and benefits
- Pricing strategies
- Marketing approaches
- Customer reviews and feedback
- Strengths and weaknesses
- Market positioning
- Unique selling propositions

Provide:
1. Competitive landscape overview
2. Direct competitor comparison
3. Differentiation opportunities
4. Pricing competitiveness
5. Feature gap analysis
6. Marketing strategy insights
7. Actionable competitive advantages
8. Risk assessment

Format as a structured competitive intelligence report.`]
  ])
};

/**
 * Customer analysis prompt templates
 */
export const CUSTOMER_ANALYSIS_PROMPTS = {
  behavior_analysis: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.data_analyst],
    ["human", `Analyze customer behavior patterns:

Customer Data: {customerData}
Order History: {orderHistory}
Website Activity: {websiteActivity}
Engagement Data: {engagementData}

Time Period: {timePeriod}
Segment: {customerSegment}

Provide insights on:
1. Purchase behavior patterns
2. Product preferences and trends
3. Seasonal buying patterns
4. Customer journey analysis
5. Engagement preferences
6. Churn risk indicators
7. Upsell/cross-sell opportunities
8. Lifetime value predictions

Include specific recommendations for customer retention and growth.`]
  ]),

  segmentation: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.data_analyst],
    ["human", `Create customer segmentation analysis:

Customer Base: {customerBase}
Segmentation Criteria:
- Purchase behavior: {purchaseBehavior}
- Demographics: {demographics}
- Engagement: {engagementMetrics}
- Value: {customerValue}

Historical Data: {historicalData}

Create segments based on:
1. RFM analysis (Recency, Frequency, Monetary)
2. Behavioral patterns
3. Product preferences
4. Engagement levels
5. Geographic distribution
6. Customer lifecycle stage

For each segment provide:
- Segment characteristics
- Size and revenue impact
- Marketing strategies
- Product recommendations
- Communication preferences
- Growth opportunities

Format as a comprehensive segmentation strategy.`]
  ])
};

/**
 * Marketing prompt templates
 */
export const MARKETING_PROMPTS = {
  email_campaign: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.marketing_specialist],
    ["human", `Create an email marketing campaign:

Campaign Type: {campaignType}
Target Audience: {targetAudience}
Products: {products}
Goals: {campaignGoals}
Brand Voice: {brandVoice}

Context:
- Season/timing: {seasonalContext}
- Previous campaigns: {previousCampaigns}
- Customer preferences: {customerPreferences}
- Competitive landscape: {competitiveContext}

Create:
1. Subject line variations (5 options)
2. Email content structure
3. Call-to-action strategies
4. Personalization elements
5. A/B testing recommendations
6. Send time optimization
7. Follow-up sequence
8. Success metrics to track

Provide complete email copy with explanations for each strategic choice.`]
  ]),

  social_media_content: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.marketing_specialist],
    ["human", `Generate social media content strategy:

Platform: {platform}
Products: {products}
Brand: {brandInfo}
Audience: {targetAudience}
Goals: {contentGoals}

Content Calendar Period: {timePeriod}
Special Events: {specialEvents}
Hashtag Strategy: {hashtagStrategy}

Create content for:
1. Product showcases
2. Behind-the-scenes content
3. User-generated content campaigns
4. Educational/how-to posts
5. Promotional content
6. Community engagement
7. Seasonal content
8. Trending topics

For each post provide:
- Caption copy
- Hashtag recommendations
- Visual guidelines
- Engagement strategies
- Posting time recommendations

Format as a comprehensive content calendar.`]
  ])
};

/**
 * Analytics and reporting prompt templates
 */
export const ANALYTICS_PROMPTS = {
  performance_report: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.data_analyst],
    ["human", `Generate performance analysis report:

Time Period: {timePeriod}
Store Data: {storeData}
Sales Metrics: {salesMetrics}
Traffic Data: {trafficData}
Customer Metrics: {customerMetrics}
Product Performance: {productData}

Previous Period Comparison: {comparisonData}
Industry Benchmarks: {benchmarks}

Create a comprehensive report covering:
1. Executive summary
2. Key performance indicators
3. Revenue and sales analysis
4. Customer acquisition and retention
5. Product performance insights
6. Traffic and conversion analysis
7. Trend identification
8. Recommendations for improvement
9. Action items with priorities

Format as a professional business report with clear insights and next steps.`]
  ]),

  trend_analysis: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.data_analyst],
    ["human", `Analyze trends and provide forecasting:

Historical Data: {historicalData}
Current Metrics: {currentMetrics}
Seasonal Patterns: {seasonalData}
Market Context: {marketContext}
External Factors: {externalFactors}

Analysis Period: {analysisPeriod}
Forecast Period: {forecastPeriod}

Provide:
1. Trend identification and significance
2. Seasonal pattern analysis
3. Growth trajectory assessment
4. Market opportunity analysis
5. Risk factor identification
6. Predictive insights
7. Scenario planning (best/worst/likely)
8. Strategic recommendations
9. Key metrics to monitor

Include confidence levels and supporting data for all predictions.`]
  ])
};

/**
 * Technical support prompt templates
 */
export const TECHNICAL_PROMPTS = {
  troubleshooting: ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPTS.technical_advisor],
    ["human", `Help troubleshoot this technical issue:

Issue Description: {issueDescription}
System Information: {systemInfo}
Error Messages: {errorMessages}
Steps Already Taken: {stepsTaken}
Expected Behavior: {expectedBehavior}
Actual Behavior: {actualBehavior}

Environment:
- Platform: {platform}
- Integrations: {integrations}
- Recent Changes: {recentChanges}

Provide:
1. Issue diagnosis
2. Root cause analysis
3. Step-by-step resolution
4. Prevention strategies
5. Testing procedures
6. Monitoring recommendations
7. Escalation criteria
8. Documentation updates needed

Format as a clear technical troubleshooting guide.`]
  ])
};

/**
 * Create a custom prompt template
 */
export function createCustomPrompt(
  templateString: string,
  inputVariables: string[],
  systemPrompt?: string
): ChatPromptTemplate {
  const messages: any[] = [];
  
  if (systemPrompt) {
    messages.push(["system", systemPrompt]);
  }
  
  messages.push(["human", templateString]);
  
  return ChatPromptTemplate.fromMessages(messages);
}

/**
 * Get prompt template by name and type
 */
export function getPromptTemplate(
  type: 'product' | 'customer' | 'marketing' | 'analytics' | 'technical',
  name: string
): ChatPromptTemplate | null {
  try {
    switch (type) {
      case 'product':
        return PRODUCT_ANALYSIS_PROMPTS[name as keyof typeof PRODUCT_ANALYSIS_PROMPTS] || null;
      case 'customer':
        return CUSTOMER_ANALYSIS_PROMPTS[name as keyof typeof CUSTOMER_ANALYSIS_PROMPTS] || null;
      case 'marketing':
        return MARKETING_PROMPTS[name as keyof typeof MARKETING_PROMPTS] || null;
      case 'analytics':
        return ANALYTICS_PROMPTS[name as keyof typeof ANALYTICS_PROMPTS] || null;
      case 'technical':
        return TECHNICAL_PROMPTS[name as keyof typeof TECHNICAL_PROMPTS] || null;
      default:
        logger.warn('Unknown prompt type requested', { type, name });
        return null;
    }
  } catch (error) {
    logger.error('Failed to get prompt template', { type, name, error });
    return null;
  }
}

/**
 * Format prompt variables with context
 */
export function formatPromptContext(
  baseContext: PromptContext,
  specificContext: Record<string, any>
): Record<string, any> {
  return {
    storeName: baseContext.storeName || 'Your Store',
    storeType: baseContext.storeType || 'General',
    language: baseContext.language || 'English',
    currency: baseContext.currency || 'USD',
    timezone: baseContext.timezone || 'UTC',
    ...baseContext,
    ...specificContext,
  };
}

/**
 * Validate prompt variables
 */
export function validatePromptVariables(
  template: ChatPromptTemplate,
  variables: Record<string, any>
): { isValid: boolean; missingVariables: string[] } {
  try {
    // This is a simplified validation - in practice you'd extract variable names from template
    const requiredVariables = template.inputVariables || [];
    const providedVariables = Object.keys(variables);
    const missingVariables = requiredVariables.filter(
      variable => !providedVariables.includes(variable)
    );

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
    };
  } catch (error) {
    logger.error('Prompt variable validation failed', error);
    return {
      isValid: false,
      missingVariables: [],
    };
  }
}

/**
 * Get available prompt templates
 */
export function getAvailablePrompts(): Record<string, string[]> {
  return {
    product: Object.keys(PRODUCT_ANALYSIS_PROMPTS),
    customer: Object.keys(CUSTOMER_ANALYSIS_PROMPTS),
    marketing: Object.keys(MARKETING_PROMPTS),
    analytics: Object.keys(ANALYTICS_PROMPTS),
    technical: Object.keys(TECHNICAL_PROMPTS),
  };
}

/**
 * Generate dynamic prompt based on context
 */
export async function generateDynamicPrompt(
  intent: string,
  context: Record<string, any>,
  systemPersona: keyof typeof SYSTEM_PROMPTS = 'ecommerce_expert'
): Promise<ChatPromptTemplate> {
  const systemPrompt = SYSTEM_PROMPTS[systemPersona];
  
  const dynamicTemplate = `Based on the following context, provide assistance with: ${intent}

Context: {context}

Please provide a comprehensive response that addresses the specific needs and requirements mentioned.`;

  return ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", dynamicTemplate],
  ]);
}

/**
 * Health check for prompt templates
 */
export function healthCheck(): boolean {
  try {
    const productPrompts = Object.keys(PRODUCT_ANALYSIS_PROMPTS).length;
    const customerPrompts = Object.keys(CUSTOMER_ANALYSIS_PROMPTS).length;
    const marketingPrompts = Object.keys(MARKETING_PROMPTS).length;
    const analyticsPrompts = Object.keys(ANALYTICS_PROMPTS).length;
    const technicalPrompts = Object.keys(TECHNICAL_PROMPTS).length;
    
    const totalPrompts = productPrompts + customerPrompts + marketingPrompts + analyticsPrompts + technicalPrompts;
    
    logger.info('Prompt templates health check', {
      productPrompts,
      customerPrompts,
      marketingPrompts,
      analyticsPrompts,
      technicalPrompts,
      totalPrompts,
    });
    
    return totalPrompts > 0;
  } catch (error) {
    logger.error('Prompt templates health check failed', error);
    return false;
  }
}