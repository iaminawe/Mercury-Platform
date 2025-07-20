#!/usr/bin/env node

/**
 * Mercury CLI
 * Command-line tools for plugin development
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('mercury')
  .description('Mercury Plugin Development CLI')
  .version('1.0.0');

// Plugin scaffolding command
program
  .command('create <plugin-name>')
  .description('Create a new plugin from template')
  .option('-t, --template <template>', 'Plugin template to use', 'basic')
  .option('-d, --directory <dir>', 'Output directory', './plugins')
  .action(async (pluginName, options) => {
    try {
      await createPlugin(pluginName, options);
    } catch (error) {
      console.error('Error creating plugin:', error);
      process.exit(1);
    }
  });

// Plugin building command
program
  .command('build [plugin-path]')
  .description('Build a plugin for distribution')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('--minify', 'Minify the output', false)
  .option('--source-map', 'Generate source maps', false)
  .action(async (pluginPath = '.', options) => {
    try {
      await buildPlugin(pluginPath, options);
    } catch (error) {
      console.error('Error building plugin:', error);
      process.exit(1);
    }
  });

// Plugin testing command
program
  .command('test [plugin-path]')
  .description('Test a plugin')
  .option('--watch', 'Watch for changes', false)
  .option('--coverage', 'Generate coverage report', false)
  .action(async (pluginPath = '.', options) => {
    try {
      await testPlugin(pluginPath, options);
    } catch (error) {
      console.error('Error testing plugin:', error);
      process.exit(1);
    }
  });

// Plugin validation command
program
  .command('validate [plugin-path]')
  .description('Validate plugin manifest and structure')
  .action(async (pluginPath = '.') => {
    try {
      await validatePlugin(pluginPath);
    } catch (error) {
      console.error('Error validating plugin:', error);
      process.exit(1);
    }
  });

// Plugin packaging command
program
  .command('package [plugin-path]')
  .description('Package plugin for marketplace submission')
  .option('-o, --output <file>', 'Output file path')
  .action(async (pluginPath = '.', options) => {
    try {
      await packagePlugin(pluginPath, options);
    } catch (error) {
      console.error('Error packaging plugin:', error);
      process.exit(1);
    }
  });

// Plugin publishing command
program
  .command('publish [plugin-path]')
  .description('Publish plugin to marketplace')
  .option('--registry <url>', 'Registry URL', 'https://marketplace.mercury.dev')
  .option('--api-key <key>', 'API key for authentication')
  .action(async (pluginPath = '.', options) => {
    try {
      await publishPlugin(pluginPath, options);
    } catch (error) {
      console.error('Error publishing plugin:', error);
      process.exit(1);
    }
  });

// Plugin development server
program
  .command('dev [plugin-path]')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port number', '3001')
  .option('--host <host>', 'Host address', 'localhost')
  .action(async (pluginPath = '.', options) => {
    try {
      await startDevServer(pluginPath, options);
    } catch (error) {
      console.error('Error starting dev server:', error);
      process.exit(1);
    }
  });

// Plugin installation command
program
  .command('install <plugin-id>')
  .description('Install a plugin from marketplace')
  .option('--version <version>', 'Specific version to install')
  .option('--config <config>', 'Configuration JSON string')
  .action(async (pluginId, options) => {
    try {
      await installPlugin(pluginId, options);
    } catch (error) {
      console.error('Error installing plugin:', error);
      process.exit(1);
    }
  });

// Plugin listing command
program
  .command('list')
  .description('List installed plugins')
  .option('--all', 'Show all available plugins', false)
  .action(async (options) => {
    try {
      await listPlugins(options);
    } catch (error) {
      console.error('Error listing plugins:', error);
      process.exit(1);
    }
  });

// Implementation functions

async function createPlugin(pluginName: string, options: any): Promise<void> {
  const outputDir = resolve(options.directory, pluginName);
  
  if (existsSync(outputDir)) {
    throw new Error(`Directory ${outputDir} already exists`);
  }

  console.log(`Creating plugin "${pluginName}" with template "${options.template}"...`);
  
  // Create directory structure
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, 'src'), { recursive: true });
  mkdirSync(join(outputDir, 'tests'), { recursive: true });
  mkdirSync(join(outputDir, 'docs'), { recursive: true });

  // Create package.json
  const packageJson = {
    name: pluginName,
    version: '1.0.0',
    description: `Mercury plugin: ${pluginName}`,
    main: 'dist/index.js',
    scripts: {
      build: 'mercury build',
      test: 'mercury test',
      dev: 'mercury dev',
      validate: 'mercury validate',
      package: 'mercury package'
    },
    keywords: ['mercury', 'plugin'],
    dependencies: {
      '@mercury/sdk': '^1.0.0'
    },
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/node': '^20.0.0'
    }
  };

  writeFileSync(
    join(outputDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create plugin manifest
  const manifest = {
    id: pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: pluginName,
    version: '1.0.0',
    description: `A Mercury plugin that does amazing things`,
    author: {
      name: 'Your Name',
      email: 'your.email@example.com'
    },
    category: 'integration',
    tags: ['utility'],
    main: 'dist/index.js',
    mercuryVersion: '^1.0.0',
    storeTypes: ['shopify'],
    permissions: [
      {
        type: 'api',
        resource: 'products',
        access: 'read',
        description: 'Read product information'
      }
    ],
    hooks: [
      {
        event: 'store.product.created',
        handler: 'onProductCreated',
        priority: 50
      }
    ],
    config: {
      apiEndpoint: {
        type: 'string',
        label: 'API Endpoint',
        description: 'The API endpoint to connect to',
        required: true,
        default: 'https://api.example.com'
      },
      debugMode: {
        type: 'boolean',
        label: 'Debug Mode',
        description: 'Enable debug logging',
        default: false
      }
    }
  };

  writeFileSync(
    join(outputDir, 'mercury-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Create main plugin file
  const mainTemplate = getPluginTemplate(options.template);
  writeFileSync(join(outputDir, 'src', 'index.ts'), mainTemplate);

  // Create test file
  const testTemplate = getTestTemplate(pluginName);
  writeFileSync(join(outputDir, 'tests', 'index.test.ts'), testTemplate);

  // Create README
  const readmeTemplate = getReadmeTemplate(pluginName);
  writeFileSync(join(outputDir, 'README.md'), readmeTemplate);

  // Create TypeScript config
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'tests']
  };

  writeFileSync(
    join(outputDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  console.log(`✅ Plugin "${pluginName}" created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${outputDir}`);
  console.log(`  npm install`);
  console.log(`  mercury dev`);
}

async function buildPlugin(pluginPath: string, options: any): Promise<void> {
  const manifestPath = join(pluginPath, 'mercury-plugin.json');
  
  if (!existsSync(manifestPath)) {
    throw new Error('Not a valid Mercury plugin directory (mercury-plugin.json not found)');
  }

  console.log('Building plugin...');

  // Read manifest
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  // Run TypeScript compilation
  try {
    execSync('npx tsc', { 
      cwd: pluginPath, 
      stdio: 'inherit' 
    });
  } catch (error) {
    throw new Error('TypeScript compilation failed');
  }

  // Copy manifest to dist
  const distDir = join(pluginPath, options.output);
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  writeFileSync(
    join(distDir, 'mercury-plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('✅ Plugin built successfully!');
}

async function testPlugin(pluginPath: string, options: any): Promise<void> {
  console.log('Running plugin tests...');

  const testCommand = options.watch ? 'jest --watch' : 'jest';
  const coverageFlag = options.coverage ? '--coverage' : '';

  try {
    execSync(`npx ${testCommand} ${coverageFlag}`, {
      cwd: pluginPath,
      stdio: 'inherit'
    });
  } catch (error) {
    throw new Error('Tests failed');
  }

  console.log('✅ All tests passed!');
}

async function validatePlugin(pluginPath: string): Promise<void> {
  console.log('Validating plugin...');

  const manifestPath = join(pluginPath, 'mercury-plugin.json');
  
  if (!existsSync(manifestPath)) {
    throw new Error('mercury-plugin.json not found');
  }

  // Validate manifest structure
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const errors: string[] = [];

  // Required fields
  const required = ['id', 'name', 'version', 'main', 'mercuryVersion'];
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate version format
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Version must follow semantic versioning (x.y.z)');
  }

  // Check if main file exists
  const mainFile = join(pluginPath, manifest.main || 'index.js');
  if (!existsSync(mainFile)) {
    errors.push(`Main file not found: ${manifest.main}`);
  }

  // Validate permissions
  if (manifest.permissions) {
    for (const permission of manifest.permissions) {
      if (!permission.type || !permission.resource || !permission.access) {
        errors.push('Invalid permission structure');
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Plugin validation failed');
  }

  console.log('✅ Plugin validation passed!');
}

async function packagePlugin(pluginPath: string, options: any): Promise<void> {
  console.log('Packaging plugin...');

  // Build first
  await buildPlugin(pluginPath, { output: 'dist' });

  // Create package
  const manifest = JSON.parse(readFileSync(join(pluginPath, 'mercury-plugin.json'), 'utf-8'));
  const outputFile = options.output || `${manifest.id}-${manifest.version}.zip`;

  try {
    execSync(`zip -r "${outputFile}" dist/ mercury-plugin.json README.md`, {
      cwd: pluginPath,
      stdio: 'inherit'
    });
  } catch (error) {
    throw new Error('Failed to create package');
  }

  console.log(`✅ Plugin packaged: ${outputFile}`);
}

async function publishPlugin(pluginPath: string, options: any): Promise<void> {
  console.log('Publishing plugin to marketplace...');

  // Validate first
  await validatePlugin(pluginPath);

  // Package plugin
  await packagePlugin(pluginPath, {});

  // TODO: Implement actual publishing to marketplace
  console.log('📦 Plugin ready for marketplace submission');
  console.log('Visit https://marketplace.mercury.dev to submit your plugin');
}

async function startDevServer(pluginPath: string, options: any): Promise<void> {
  console.log(`Starting development server on ${options.host}:${options.port}...`);
  
  // TODO: Implement dev server with hot reload
  console.log('🔥 Dev server with hot reload coming soon!');
  console.log('For now, use "mercury build --watch" to rebuild on changes');
}

async function installPlugin(pluginId: string, options: any): Promise<void> {
  console.log(`Installing plugin: ${pluginId}...`);
  
  // TODO: Implement plugin installation from marketplace
  console.log('📦 Plugin installation coming soon!');
}

async function listPlugins(options: any): Promise<void> {
  console.log('Installed plugins:');
  
  // TODO: Implement plugin listing
  console.log('📋 Plugin listing coming soon!');
}

// Template functions

function getPluginTemplate(template: string): string {
  switch (template) {
    case 'ai':
      return getAIPluginTemplate();
    case 'analytics':
      return getAnalyticsPluginTemplate();
    case 'integration':
      return getIntegrationPluginTemplate();
    default:
      return getBasicPluginTemplate();
  }
}

function getBasicPluginTemplate(): string {
  return `import { PluginContext, PluginEvent, PluginEventData } from '@mercury/sdk';

export class Plugin {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    this.context.logger.info('Plugin initialized');
    
    // Register event handlers
    this.context.api.events.on('store.product.created', this.onProductCreated.bind(this));
  }

  async cleanup(): Promise<void> {
    this.context.logger.info('Plugin cleanup');
  }

  private async onProductCreated(event: PluginEvent, data: PluginEventData): Promise<void> {
    this.context.logger.info('Product created:', data);
    
    // Your plugin logic here
    // Example: Send notification, update analytics, etc.
  }
}

// Export the plugin class
export default Plugin;
`;
}

function getAIPluginTemplate(): string {
  return `import { PluginContext } from '@mercury/sdk';

export class AIPlugin {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    this.context.logger.info('AI Plugin initialized');
    
    // Setup AI model or service
    await this.setupAIService();
  }

  private async setupAIService(): Promise<void> {
    // Initialize your AI service
    // Example: OpenAI, custom model, etc.
  }

  async generateRecommendations(productId: string): Promise<any[]> {
    // AI recommendation logic
    return [];
  }

  async analyzeCustomerBehavior(customerId: string): Promise<any> {
    // AI analysis logic
    return {};
  }
}

export default AIPlugin;
`;
}

function getAnalyticsPluginTemplate(): string {
  return `import { PluginContext } from '@mercury/sdk';

export class AnalyticsPlugin {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    this.context.logger.info('Analytics Plugin initialized');
    
    // Setup analytics tracking
    this.context.api.events.on('store.order.created', this.trackOrder.bind(this));
  }

  private async trackOrder(event: string, data: any): Promise<void> {
    // Track order analytics
    this.context.logger.info('Tracking order:', data);
  }

  async generateReport(startDate: Date, endDate: Date): Promise<any> {
    // Generate analytics report
    return {};
  }
}

export default AnalyticsPlugin;
`;
}

function getIntegrationPluginTemplate(): string {
  return `import { PluginContext } from '@mercury/sdk';

export class IntegrationPlugin {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    this.context.logger.info('Integration Plugin initialized');
    
    // Setup external service integration
    await this.setupIntegration();
  }

  private async setupIntegration(): Promise<void> {
    const apiEndpoint = this.context.plugin.config.apiEndpoint;
    // Setup integration with external service
  }

  async syncData(): Promise<void> {
    // Sync data with external service
  }
}

export default IntegrationPlugin;
`;
}

function getTestTemplate(pluginName: string): string {
  return `import { describe, test, expect, beforeEach } from '@jest/globals';
import Plugin from '../src/index';

describe('${pluginName}', () => {
  let plugin: Plugin;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      plugin: {
        id: '${pluginName.toLowerCase()}',
        version: '1.0.0',
        config: {}
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      api: {
        events: {
          on: jest.fn(),
          emit: jest.fn()
        }
      }
    };

    plugin = new Plugin(mockContext);
  });

  test('should initialize successfully', async () => {
    await plugin.initialize();
    expect(mockContext.logger.info).toHaveBeenCalledWith('Plugin initialized');
  });

  test('should handle cleanup', async () => {
    await plugin.cleanup();
    expect(mockContext.logger.info).toHaveBeenCalledWith('Plugin cleanup');
  });
});
`;
}

function getReadmeTemplate(pluginName: string): string {
  return `# ${pluginName}

A Mercury plugin that does amazing things.

## Installation

\`\`\`bash
mercury install ${pluginName.toLowerCase()}
\`\`\`

## Configuration

Configure the plugin in your Mercury dashboard or via the API:

\`\`\`json
{
  "apiEndpoint": "https://api.example.com",
  "debugMode": false
}
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

## Development

\`\`\`bash
# Install dependencies
npm install

# Start development
mercury dev

# Run tests
mercury test

# Build for production
mercury build

# Package for distribution
mercury package
\`\`\`

## License

MIT
`;
}

// Parse command line arguments
program.parse();