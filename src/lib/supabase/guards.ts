import { redirect } from 'next/navigation'
import { createClient } from './server'
import { getUserProfile } from './queries'
import { User } from '@supabase/supabase-js'
import { UserProfile } from '@/types/database.types'

/**
 * Server-side guard to ensure only admin users can access a route.
 * Redirects to /auth/login if not authenticated.
 * Redirects to /dashboard if authenticated but not an admin.
 */
export async function requireAdmin(): Promise<{ user: User; profile: UserProfile }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const profile = await getUserProfile(user.id)

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return { user, profile }
}
