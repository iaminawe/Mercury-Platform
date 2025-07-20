import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/lib/trpc/app-router';
import { createContext } from '@/lib/trpc/context';
import { createLogger } from '@/lib/logger';

const logger = createLogger('trpc-handler');

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      logger.error('tRPC error', {
        path,
        error: error.message,
        code: error.code,
      });
    },
  });

export { handler as GET, handler as POST };