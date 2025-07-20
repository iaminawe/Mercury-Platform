# Mercury - Headless Shopify Platform

Mercury is a comprehensive Shopify companion platform that provides a headless storefront, unified analytics dashboard, and powerful management tools.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (via Supabase)
- Redis (for queue management)
- Shopify Partner account

### Installation

1. **Clone and install dependencies:**
```bash
cd mercury
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Fill in your credentials:
- `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`
- `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- `SHOPIFY_APP_KEY`
- `SHOPIFY_APP_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`

3. **Run database migrations:**
```bash
npx supabase db push
```

4. **Start Redis:**
```bash
redis-server
```

5. **Start the development server:**
```bash
npm run dev
```

6. **Start the sync worker (in another terminal):**
```bash
npm run worker:dev
```

## 📋 Features

### Phase 1 MVP (Complete)

#### 🛍️ Headless Storefront
- Server-side rendered product pages
- Responsive design with mobile optimization
- Shopping cart with persistence
- Variant selection
- Service worker for offline support

#### 📊 Analytics Dashboard
- Real-time sales metrics
- Product performance tracking
- Customer insights
- Conversion funnels
- Export to CSV/PNG

#### ⚡ Data Sync Engine
- Automatic Shopify data synchronization
- Webhook processing
- Bulk import capabilities
- Progress tracking

#### ✏️ Bulk Editor
- Excel-like interface
- Inline editing
- Bulk operations
- Undo/redo functionality
- CSV import/export

#### 🔐 Authentication
- Shopify OAuth integration
- Secure token management
- Role-based access control

## 🏗️ Architecture

```
mercury/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Admin dashboard
│   ├── (storefront)/      # Customer-facing store
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── dashboard/        # Dashboard components
│   ├── storefront/       # Store components
│   └── bulk-editor/      # Bulk editor components
├── lib/                   # Core libraries
│   ├── shopify/          # Shopify integration
│   ├── supabase/         # Database client
│   ├── sync/             # Data sync engine
│   └── trpc/             # API layer
├── database/             # Database schemas
└── public/               # Static assets
```

## 🧪 Development

### Running Tests
```bash
npm test
```

### Code Quality
```bash
npm run lint
npm run type-check
```

### Building for Production
```bash
npm run build
```

## 📚 Documentation

- [Shopify OAuth Setup](docs/SHOPIFY_OAUTH.md)
- [Database Schema](database/README.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🚦 Monitoring

The platform includes built-in monitoring:
- `/settings/sync` - Data sync status
- `/analytics` - Business metrics
- Application logs via Winston

## 🔧 Configuration

### Shopify App Settings
Required OAuth scopes:
- `read_products, write_products`
- `read_orders, read_customers`
- `read_analytics`

### Webhook Subscriptions
Automatically registered:
- `products/create`, `products/update`, `products/delete`
- `orders/create`, `orders/updated`
- `app/uninstalled`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Supabase](https://supabase.com/)
- [Shopify APIs](https://shopify.dev/)
- [tRPC](https://trpc.io/)
- [BullMQ](https://bullmq.io/)

---

**Mercury** - Unified Intelligence for Shopify Merchants