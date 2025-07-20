# Mercury Developer SDK

A comprehensive TypeScript SDK for building extensions, plugins, and integrations on the Mercury e-commerce platform.

## 🚀 Features

- **Complete API Coverage** - Full access to stores, products, customers, orders, and analytics
- **Plugin System** - Extensible architecture for custom functionality
- **Webhook Handling** - Secure webhook processing with signature validation
- **TypeScript Support** - Full type safety and IntelliSense
- **Real-time Events** - Event-driven architecture with built-in event emitter
- **Authentication** - Multiple auth methods (API key, OAuth, JWT)
- **Error Handling** - Comprehensive error types and retry logic
- **Developer Tools** - Testing utilities, debugging helpers, and validation

## 📦 Installation

```bash
npm install @mercury/sdk
```

## 🏃 Quick Start

```typescript
import { createMercurySDK } from '@mercury/sdk';

// Initialize the SDK
const mercury = createMercurySDK({
  apiKey: 'your-api-key',
  environment: 'production', // 'development' | 'staging' | 'production'
  enableLogging: true
});

// Fetch stores
const stores = await mercury.getStores();
console.log('Your stores:', stores);

// Listen for events
mercury.on('order:created', (event) => {
  console.log('New order:', event.payload);
});
```

## 📚 Core Concepts

### 1. SDK Configuration

```typescript
interface MercurySDKConfig {
  apiKey: string;                    // Required: Your Mercury API key
  environment?: string;              // development | staging | production
  baseUrl?: string;                  // Custom API base URL
  timeout?: number;                  // Request timeout (default: 30000ms)
  retryAttempts?: number;            // Retry attempts (default: 3)
  enableLogging?: boolean;           // Enable debug logging
  webhookSecret?: string;            // Webhook signature secret
}
```

### 2. Store Management

```typescript
// Get all stores
const stores = await mercury.getStores();

// Get specific store
const store = await mercury.getStore('store-id');

// Create new store
const newStore = await mercury.createStore({
  name: 'My New Store',
  domain: 'mynewstore.com',
  platform: 'shopify'
});

// Update store
const updatedStore = await mercury.updateStore('store-id', {
  name: 'Updated Store Name'
});
```

### 3. Product Management

```typescript
// Get products with filtering
const products = await mercury.getProducts('store-id', {
  page: 1,
  limit: 50,
  search: 'shoes',
  tags: ['featured', 'sale']
});

// Get single product
const product = await mercury.getProduct('store-id', 'product-id');

// Create product
const newProduct = await mercury.createProduct('store-id', {
  title: 'Amazing Sneakers',
  description: 'The best sneakers you\'ll ever wear',
  price: 99.99,
  inventory: 100,
  tags: ['shoes', 'sneakers'],
  variants: [
    {
      title: 'Size 9',
      price: 99.99,
      inventory: 25,
      options: [{ name: 'Size', value: '9' }]
    }
  ]
});

// Update product
const updatedProduct = await mercury.updateProduct('store-id', 'product-id', {
  price: 89.99,
  tags: ['shoes', 'sneakers', 'sale']
});
```

### 4. Customer Management

```typescript
// Get customers
const customers = await mercury.getCustomers('store-id', {
  page: 1,
  limit: 100,
  search: 'john@example.com'
});

// Get single customer
const customer = await mercury.getCustomer('store-id', 'customer-id');
```

### 5. Order Management

```typescript
// Get orders
const orders = await mercury.getOrders('store-id', {
  status: 'pending',
  customerId: 'customer-id',
  page: 1,
  limit: 50
});

// Get single order
const order = await mercury.getOrder('store-id', 'order-id');
```

### 6. Analytics

```typescript
// Get analytics data
const analytics = await mercury.getAnalytics('store-id', {
  metrics: ['revenue', 'orders', 'conversion_rate'],
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  granularity: 'day',
  dimensions: ['product', 'channel']
});
```

## 🔌 Plugin System

The Mercury SDK includes a powerful plugin system for extending functionality.

### Creating a Plugin

```typescript
import { Plugin } from '@mercury/sdk';

const myPlugin: Plugin = {
  id: 'my-awesome-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  description: 'Does awesome things',
  author: 'Your Name',
  
  dependencies: [],
  
  hooks: {
    async onInstall() {
      console.log('Plugin installed!');
    },
    
    async onActivate() {
      console.log('Plugin activated!');
    },
    
    async onDeactivate() {
      console.log('Plugin deactivated!');
    },
    
    async onUninstall() {
      console.log('Plugin uninstalled!');
    }
  },
  
  config: {
    apiEndpoint: 'https://api.example.com',
    enableFeatureX: true
  }
};

export default myPlugin;
```

### Using Plugins

```typescript
// Install and activate a plugin
await mercury.plugins.installPlugin(myPlugin, {
  apiEndpoint: 'https://my-api.com',
  enableFeatureX: true
});

await mercury.plugins.activatePlugin('my-awesome-plugin');

// Get plugin information
const installedPlugins = mercury.plugins.getInstalledPlugins();
const activePlugins = mercury.plugins.getActivePlugins();

// Update plugin configuration
await mercury.plugins.updatePluginConfig('my-awesome-plugin', {
  enableFeatureX: false
});
```

## 🪝 Webhook Handling

The SDK provides secure webhook processing with signature validation.

### Basic Webhook Handling

```typescript
// Setup webhook handler
mercury.webhooks.on('order.created', async (event) => {
  console.log('New order webhook:', event);
  
  // Process the order
  const order = event.data;
  await processNewOrder(order);
});

mercury.webhooks.on('customer.created', async (event) => {
  console.log('New customer webhook:', event);
  
  // Send welcome email
  await sendWelcomeEmail(event.data);
});

// Process webhook (typically in your API route)
const webhookEvent = await mercury.webhooks.processWebhook(
  request.body,        // Raw webhook payload
  request.headers['x-mercury-signature'], // Signature header
  {
    timestamp: request.headers['x-timestamp']
  }
);
```

### Express.js Integration

```typescript
import express from 'express';

const app = express();

// Use webhook middleware
app.post('/webhooks/mercury', 
  express.raw({ type: 'application/json' }),
  mercury.webhooks.middleware()
);

// Access webhook event in subsequent middleware
app.post('/webhooks/mercury', (req, res) => {
  const event = req.webhookEvent;
  console.log('Received webhook:', event.type);
  res.json({ success: true });
});
```

### Next.js API Route

```typescript
// pages/api/webhooks/mercury.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await mercury.webhooks.handleNextJS(req, res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
```

## 📡 Event System

The SDK includes a comprehensive event system for real-time updates.

```typescript
// Listen for events
mercury.on('store:updated', (event) => {
  console.log('Store updated:', event.payload);
});

mercury.on('product:created', (event) => {
  console.log('New product:', event.payload);
});

// One-time listeners
mercury.once('webhook:received', (event) => {
  console.log('First webhook received!');
});

// Remove listeners
mercury.off('store:updated');
mercury.off('product:created', specificHandler);
```

## 🔧 Error Handling

The SDK provides comprehensive error handling with specific error types.

```typescript
import { MercuryError, APIError, PluginError } from '@mercury/sdk';

try {
  const product = await mercury.getProduct('store-id', 'invalid-product-id');
} catch (error) {
  if (error instanceof APIError) {
    console.log('API Error:', error.message);
    console.log('Status Code:', error.statusCode);
    console.log('Endpoint:', error.endpoint);
  } else if (error instanceof MercuryError) {
    console.log('Mercury Error:', error.code, error.message);
  }
}
```

## 🧪 Testing

The SDK includes testing utilities for development and debugging.

```typescript
// Test webhook processing
const testEvent = await mercury.webhooks.testWebhook({
  type: 'order.created',
  data: {
    id: 'order-123',
    total: 99.99
  }
});

// Generate test signatures
const signature = mercury.webhooks.generateTestSignature(
  JSON.stringify(webhookPayload)
);

// Health check
const health = await mercury.health();
console.log('SDK Health:', health);
```

## 📊 Example Plugins

The SDK comes with example plugins to demonstrate capabilities:

### Email Marketing Plugin

Located in `/examples/plugins/email-marketing/`, this plugin provides:

- **Email Templates** - Welcome, abandoned cart, order confirmation
- **Campaign Management** - Create and send email campaigns
- **Analytics Tracking** - Email performance metrics
- **Automation** - Event-driven email triggers

```typescript
import emailMarketingPlugin from '@mercury/email-marketing-plugin';

await mercury.plugins.installPlugin(emailMarketingPlugin, {
  emailProvider: 'smtp',
  smtpConfig: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password'
    }
  },
  defaultFromEmail: 'store@example.com',
  defaultFromName: 'Your Store'
});
```

### Advanced Analytics Plugin

Located in `/examples/plugins/analytics/`, this plugin provides:

- **Custom Metrics** - Define and track custom KPIs
- **Real-time Dashboards** - Live analytics updates
- **Advanced Reporting** - Detailed performance insights
- **Alert System** - Threshold-based notifications

```typescript
import analyticsPlugin from '@mercury/analytics-plugin';

await mercury.plugins.installPlugin(analyticsPlugin, {
  trackingEnabled: true,
  retentionDays: 365,
  enableRealtimeTracking: true,
  alertThresholds: {
    conversionRate: 0.02,
    cartAbandonmentRate: 0.7
  }
});
```

## 🔗 API Reference

### Core SDK Methods

| Method | Description |
|--------|-------------|
| `getStores()` | Fetch all stores |
| `getStore(id)` | Fetch single store |
| `createStore(data)` | Create new store |
| `updateStore(id, data)` | Update store |
| `getProducts(storeId, options)` | Fetch products |
| `getProduct(storeId, productId)` | Fetch single product |
| `createProduct(storeId, data)` | Create product |
| `updateProduct(storeId, productId, data)` | Update product |
| `deleteProduct(storeId, productId)` | Delete product |
| `getCustomers(storeId, options)` | Fetch customers |
| `getCustomer(storeId, customerId)` | Fetch single customer |
| `getOrders(storeId, options)` | Fetch orders |
| `getOrder(storeId, orderId)` | Fetch single order |
| `getAnalytics(storeId, options)` | Fetch analytics data |

### Plugin Manager Methods

| Method | Description |
|--------|-------------|
| `installPlugin(plugin, config)` | Install plugin |
| `uninstallPlugin(pluginId)` | Uninstall plugin |
| `activatePlugin(pluginId)` | Activate plugin |
| `deactivatePlugin(pluginId)` | Deactivate plugin |
| `getInstalledPlugins()` | Get installed plugins |
| `getActivePlugins()` | Get active plugins |
| `updatePluginConfig(pluginId, config)` | Update plugin config |

### Webhook Handler Methods

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Register webhook handler |
| `off(event, handler)` | Remove webhook handler |
| `once(event, handler)` | Register one-time handler |
| `processWebhook(payload, signature)` | Process webhook |
| `middleware()` | Express middleware |
| `handleNextJS(req, res)` | Next.js handler |

## 📋 TypeScript Types

The SDK is fully typed with comprehensive TypeScript definitions:

```typescript
import type {
  MercurySDKConfig,
  Store,
  Product,
  Customer,
  Order,
  Plugin,
  WebhookEvent,
  AnalyticsData
} from '@mercury/sdk';
```

## 🌟 Advanced Usage

### Custom API Client

```typescript
import { APIClient } from '@mercury/sdk';

const apiClient = new APIClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://custom-api.example.com',
  timeout: 60000
});

const response = await apiClient.get('/custom/endpoint');
```

### Batch Requests

```typescript
const batchResponse = await mercury.apiClient.batch([
  { id: '1', method: 'GET', endpoint: '/stores' },
  { id: '2', method: 'GET', endpoint: '/stores/store-1/products' },
  { id: '3', method: 'POST', endpoint: '/stores/store-1/products', data: newProduct }
]);
```

### File Uploads

```typescript
const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

const uploadResponse = await mercury.apiClient.upload('/products/images', file, {
  filename: 'product-image.jpg',
  metadata: { productId: 'product-123' }
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.mercury.dev](https://docs.mercury.dev)
- **API Reference**: [https://api.mercury.dev/docs](https://api.mercury.dev/docs)
- **Community**: [https://community.mercury.dev](https://community.mercury.dev)
- **Issues**: [GitHub Issues](https://github.com/mercury/sdk/issues)

## 🗺️ Roadmap

- [ ] GraphQL API support
- [ ] Real-time subscriptions
- [ ] CLI tools for development
- [ ] Visual plugin builder
- [ ] Advanced caching strategies
- [ ] Offline-first capabilities

---

**Built with ❤️ by the Mercury Team**