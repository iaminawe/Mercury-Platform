#!/usr/bin/env node
import 'dotenv/config';
import { getSyncManager } from './sync-manager';
import { createLogger } from '@/lib/logger';

const logger = createLogger('sync-worker');

async function startWorker() {
  try {
    logger.info('Starting sync worker process...');
    
    const syncManager = getSyncManager();
    await syncManager.start();
    
    logger.info('Sync worker process started successfully');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await syncManager.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await syncManager.stop();
      process.exit(0);
    });

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start sync worker', error);
    process.exit(1);
  }
}

// Start the worker
startWorker().catch((error) => {
  logger.error('Unhandled error in worker', error);
  process.exit(1);
});