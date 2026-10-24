import { createClient } from '@supabase/supabase-js'

/**
 * Creates a privileged Supabase client using the private service-role key.
 * Strictly server-side: Never expose this key to client bundles or browser environment variables.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required in environment variables on the server to execute privileged AI evaluations.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
