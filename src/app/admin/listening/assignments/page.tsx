import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import TestAssignmentsManager from '@/features/admin/components/TestAssignmentsManager'

export default async function ListeningAssignmentsPage() {
  // 1. Guard route for admin access only
  await requireAdmin()
  const supabase = await createClient()

  // 2. Fetch all configured tests
  const { data: tests, error: testsError } = await supabase
    .from('tests')
    .select('id, title, status')
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('Failed to load tests for assignments panel:', testsError.message)
  }

  // 3. Fetch all passages
  const { data: passages, error: passagesError } = await supabase
    .from('listening_passages')
    .select('id, title, difficulty_level')
    .order('created_at', { ascending: false })

  if (passagesError) {
    console.error('Failed to load passages for assignments panel:', passagesError.message)
  }

  // 4. Fetch all existing assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('test_listening_passages')
    .select('test_id, passage_id, display_order, is_active')

  if (assignmentsError) {
    console.error('Failed to load existing assignments:', assignmentsError.message)
  }

  return (
    <TestAssignmentsManager
      tests={tests || []}
      passages={passages || []}
      initialAssignments={assignments || []}
    />
  )
}
