# Mercury Plugin System

A comprehensive, secure, and scalable plugin architecture framework for Mercury that enables third-party developers to extend functionality while maintaining system security and performance.

## 🏗️ Architecture Overview

The Mercury Plugin System consists of several key components:

### Core Components

1. **Plugin Loader** (`plugin-loader.ts`)
   - Dynamic plugin loading and unloading
   - Hot reload support for development
   - Module caching and cleanup

2. **Sandbox Manager** (`sandbox.ts`)
   - Secure execution environment using VM2
   - Resource limits and access controls
   - Safe module loading and execution

3. **Registry** (`registry.ts`)
   - Plugin metadata and installation management
   - Version tracking and updates
   - Dependency validation

4. **Permission Manager** (`permissions.ts`)
   - Fine-grained permission system
   - Runtime access validation
   - Security auditing

5. **Hook System** (`hooks.ts`)
   - Event-driven architecture
   - Plugin lifecycle management
   - Middleware support

6. **Logger** (`logger.ts`)
   - Structured logging for plugins
   - Log aggregation and analysis
   - Security-aware log sanitization

## 🚀 Quick Start

### For Mercury Developers

```typescript
import { initializePluginSystem } from '@/lib/plugins';

// Initialize the plugin system
const pluginSystem = await initializePluginSystem({
  pluginsDir: './plugins',
  enableSandbox: true,
  enableHotReload: process.env.NODE_ENV === 'development'
});

// Install and activate a plugin
await pluginSystem.installPlugin('./plugins/my-plugin', {
  apiEndpoint: 'https://api.example.com'
}, { autoActivate: true });
```

### For Plugin Developers

```bash
# Install Mercury CLI
npm install -g @mercury/cli

# Create a new plugin
mercury create my-awesome-plugin

# Start development
cd my-awesome-plugin
mercury dev

# Test the plugin
mercury test

# Build for production
mercury build

# Package for marketplace
mercury package
```

## 📁 Plugin Structure

```
my-plugin/
├── mercury-plugin.json     # Plugin manifest
├── src/
│   ├── index.ts           # Main plugin entry point
│   ├── handlers/          # Event handlers
│   └── utils/             # Utility functions
├── tests/
│   └── index.test.ts      # Plugin tests
├── docs/
│   └── README.md          # Plugin documentation
└── package.json           # NPM package configuration
```

### Plugin Manifest (mercury-plugin.json)

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "An amazing plugin that does wonderful things",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://yourwebsite.com"
  },
  "category": "integration",
  "tags": ["api", "automation", "productivity"],
  "main": "dist/index.js",
  "mercuryVersion": "^1.0.0",
  "storeTypes": ["shopify", "woocommerce"],
  "permissions": [
    {
      "type": "api",
      "resource": "products",
      "access": "read",
      "description": "Read product information"
    },
    {
      "type": "network",
      "resource": "https://api.example.com/*",
      "access": "read",
      "description": "Connect to external API"
    }
  ],
  "hooks": [
    {
      "event": "store.product.created",
      "handler": "onProductCreated",
      "priority": 50
    }
  ],
  "config": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "description": "Your API key for external service",
      "required": true
    },
    "enableNotifications": {
      "type": "boolean",
      "label": "Enable Notifications",
      "default": true
    }
  }
}
```

## 🔒 Security Features

### Sandboxed Execution
- Plugins run in isolated VM environments
- Limited access to Node.js APIs
- Resource usage monitoring and limits

### Permission System
- Declarative permissions in manifest
- Runtime permission validation
- Granular access control

### Security Scanning
- Automated security analysis
- Vulnerability detection
- Code quality assessment

## 🛠️ API Reference

### Plugin Context

Every plugin receives a context object with access to Mercury's APIs:

```typescript
interface PluginContext {
  plugin: {
    id: string;
    version: string;
    config: Record<string, any>;
    dataDir: string;
    tempDir: string;
  };
  mercury: {
    version: string;
    store: StoreInfo;
    user: UserInfo;
  };
  api: PluginAPI;
  logger: PluginLogger;
}
```

### Plugin API

```typescript
interface PluginAPI {
  // Store data access
  store: {
    products: ProductAPI;
    orders: OrderAPI;
    customers: CustomerAPI;
    analytics: AnalyticsAPI;
  };
  
  // Mercury services
  ai: {
    vectorStore: VectorStoreAPI;
    embeddings: EmbeddingsAPI;
    chat: ChatAPI;
  };
  
  // HTTP client
  http: HTTPClient;
  
  // Database access (sandboxed)
  db: DatabaseAPI;
  
  // Storage
  storage: StorageAPI;
  
  // Events
  events: EventAPI;
}
```

### Available Events

Plugins can listen to various Mercury events:

- `store.product.created`
- `store.product.updated`
- `store.order.created`
- `store.order.updated`
- `store.customer.created`
- `analytics.data.updated`
- `ai.recommendation.generated`
- `workflow.triggered`
- `user.action`

## 🏪 Marketplace Integration

### Plugin Submission

1. **Develop** your plugin using Mercury CLI
2. **Test** thoroughly with `mercury test`
3. **Validate** with `mercury validate`
4. **Package** with `mercury package`
5. **Submit** to marketplace via API or dashboard

### Review Process

1. **Automated Scanning**
   - Security vulnerability check
   - Code quality analysis
   - Performance testing

2. **Manual Review**
   - Functionality verification
   - UX/UI assessment
   - Documentation review

3. **Approval & Publishing**
   - Plugin becomes available in marketplace
   - Developer receives notification
   - Revenue tracking begins

### Analytics & Reporting

The marketplace provides comprehensive analytics:

- Download statistics
- Revenue tracking
- User engagement metrics
- Performance monitoring
- Error tracking

## 🧪 Testing

### Unit Testing

```typescript
import { describe, test, expect } from '@jest/globals';
import MyPlugin from '../src/index';

describe('MyPlugin', () => {
  test('should initialize correctly', async () => {
    const mockContext = createMockContext();
    const plugin = new MyPlugin(mockContext);
    
    await plugin.initialize();
    
    expect(mockContext.logger.info).toHaveBeenCalled();
  });
});
```

### Integration Testing

```bash
# Test with real Mercury instance
mercury test --integration

# Test with specific Mercury version
mercury test --mercury-version 1.2.0
```

## 📊 Monitoring & Debugging

### Plugin Metrics

The system automatically tracks:
- API call counts and response times
- Error rates and types
- Memory and CPU usage
- Event handler performance

### Logging

```typescript
export class MyPlugin {
  constructor(private context: PluginContext) {}
  
  async processOrder(order: Order) {
    this.context.logger.info('Processing order', { orderId: order.id });
    
    try {
      await this.externalAPI.process(order);
      this.context.logger.info('Order processed successfully');
    } catch (error) {
      this.context.logger.error('Failed to process order', { error });
    }
  }
}
```

### Error Handling

```typescript
// Graceful error handling
export class MyPlugin {
  async onProductCreated(event: string, data: any) {
    try {
      await this.processProduct(data.product);
    } catch (error) {
      // Error is automatically logged and tracked
      // Plugin continues running
      this.context.logger.error('Product processing failed', { error });
    }
  }
}
```

## 🔄 Plugin Lifecycle

1. **Installation**
   - Download and validate plugin package
   - Install dependencies
   - Create plugin data directories

2. **Activation**
   - Load plugin into sandbox
   - Initialize plugin instance
   - Register event handlers

3. **Runtime**
   - Handle events and API calls
   - Monitor performance and errors
   - Apply configuration updates

4. **Deactivation**
   - Unregister event handlers
   - Cleanup resources
   - Preserve plugin data

5. **Uninstallation**
   - Remove plugin files
   - Clean up data (optional)
   - Update registry

## 🛡️ Best Practices

### Security
- Always validate input data
- Use parameterized queries for database operations
- Sanitize user-generated content
- Follow principle of least privilege

### Performance
- Implement async operations properly
- Use caching for expensive operations
- Monitor resource usage
- Optimize database queries

### Reliability
- Handle errors gracefully
- Implement proper cleanup
- Use timeouts for external API calls
- Test edge cases thoroughly

### User Experience
- Provide clear configuration options
- Include helpful error messages
- Write comprehensive documentation
- Follow Mercury's design guidelines

## 📚 Examples

### Basic Integration Plugin

```typescript
import { PluginContext } from '@mercury/sdk';

export class IntegrationPlugin {
  constructor(private context: PluginContext) {}

  async initialize() {
    this.context.logger.info('Integration plugin starting');
    
    // Register event handlers
    this.context.api.events.on('store.order.created', this.onOrderCreated.bind(this));
  }

  async onOrderCreated(event: string, data: any) {
    const { order } = data;
    
    // Send order to external system
    try {
      await this.context.api.http.post('https://api.example.com/orders', {
        orderId: order.id,
        total: order.total,
        items: order.items
      });
      
      this.context.logger.info('Order synced successfully', { orderId: order.id });
    } catch (error) {
      this.context.logger.error('Failed to sync order', { orderId: order.id, error });
    }
  }

  async cleanup() {
    this.context.logger.info('Integration plugin stopping');
  }
}

export default IntegrationPlugin;
```

### AI-Powered Plugin

```typescript
import { PluginContext } from '@mercury/sdk';

export class AIPlugin {
  constructor(private context: PluginContext) {}

  async initialize() {
    // Initialize AI service
    await this.setupAIService();
    
    // Register recommendation handler
    this.context.api.events.on('user.action', this.generateRecommendations.bind(this));
  }

  async generateRecommendations(event: string, data: any) {
    const { userId, action } = data;
    
    // Get user behavior data
    const behavior = await this.context.api.store.analytics.getUserBehavior(userId);
    
    // Generate AI recommendations
    const recommendations = await this.context.api.ai.generate({
      prompt: `Generate product recommendations for user behavior: ${JSON.stringify(behavior)}`,
      max_tokens: 200
    });
    
    // Store recommendations
    await this.context.api.storage.set(`recommendations:${userId}`, recommendations);
  }
}

export default AIPlugin;
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: https://docs.mercury.dev/plugins
- **API Reference**: https://api.mercury.dev/plugins
- **Community**: https://community.mercury.dev
- **Issues**: https://github.com/mercury/plugins/issues

---

Built with ❤️ by the Mercury team