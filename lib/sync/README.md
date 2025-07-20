# Mercury Data Sync Engine

This directory contains the data synchronization engine for Mercury, which handles real-time syncing between Shopify stores and the Mercury database.

## Architecture

### Components

1. **sync-queue.ts** - Queue management using BullMQ
   - Manages multiple queues for different resource types
   - Handles retries and failure scenarios
   - Provides queue monitoring and control

2. **shopify-sync.ts** - Shopify-specific sync logic
   - Bulk import using GraphQL for efficiency
   - Individual resource sync
   - Pagination handling
   - Conflict resolution (last-write-wins)

3. **webhook-processor.ts** - Real-time webhook processing
   - Processes Shopify webhooks through queues
   - Updates data in near real-time
   - Handles all webhook topics

4. **sync-manager.ts** - Orchestration layer
   - Manages all sync workers
   - Provides sync statistics
   - Handles graceful shutdown

5. **worker.ts** - Standalone worker process
   - Runs sync workers in separate process
   - Handles process lifecycle

## Queue Structure

- `product-sync` - Product synchronization
- `variant-sync` - Product variant synchronization  
- `collection-sync` - Collection synchronization
- `customer-sync` - Customer synchronization
- `order-sync` - Order synchronization
- `webhook-process` - Webhook processing (high priority)
- `bulk-import` - Bulk import orchestration

## Performance Targets

- Import 10k products < 15 minutes
- Process webhooks < 90 seconds
- Handle 10 webhooks/second
- Concurrent processing with configurable workers

## Usage

### Running the Sync Worker

```bash
# Development
npm run worker:dev

# Production
npm run worker
```

### Triggering Bulk Import

Bulk imports can be triggered through:
1. The sync dashboard UI at `/settings/sync`
2. The tRPC API: `trpc.shopify.bulkImport.mutate()`

### Monitoring

Queue status and sync progress can be monitored through:
1. The sync dashboard UI
2. Redis queue metrics
3. Application logs

## Configuration

Required environment variables:

```env
# Redis for queue management
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Shopify API
SHOPIFY_APP_API_KEY=
SHOPIFY_APP_API_SECRET=
SHOPIFY_WEBHOOK_SECRET=
```

## Database Schema

The sync engine uses these tables:
- `products` - Synced products
- `product_variants` - Product variants
- `collections` - Product collections
- `customers` - Customer data
- `orders` - Order data
- `webhook_logs` - Webhook processing logs
- `sync_jobs` - Bulk import job tracking

## Error Handling

- Automatic retries with exponential backoff
- Dead letter queues for failed jobs
- Comprehensive error logging
- Webhook replay capability

## Scaling

The sync engine is designed to scale horizontally:
- Multiple worker processes can run concurrently
- Redis handles queue distribution
- Database handles concurrent writes
- Queue concurrency is configurable per worker