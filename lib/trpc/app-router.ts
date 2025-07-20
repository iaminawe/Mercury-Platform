import { router } from '@/lib/trpc/init';
import { authRouter } from '@/lib/trpc/routers/auth';
import { shopifyRouter } from '@/lib/trpc/routers/shopify';
import { analyticsRouter } from '@/lib/trpc/routers/analytics';
import { aiRouter } from '@/lib/trpc/routers/ai';
import { advisorRouter } from '@/lib/trpc/routers/advisor';
import { workflowsRouter } from '@/lib/trpc/routers/workflows';

export const appRouter = router({
  auth: authRouter,
  shopify: shopifyRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  advisor: advisorRouter,
  workflows: workflowsRouter,
});

export type AppRouter = typeof appRouter;