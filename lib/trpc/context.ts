import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function createContext(opts: FetchCreateContextFnOptions) {
  const supabase = await createServerSupabaseClient();
  
  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    logger.error('Error getting user in tRPC context', error);
  }

  return {
    supabase,
    user,
    headers: opts.req.headers,
  };
}