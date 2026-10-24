'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { revalidatePath } from 'next/cache'

export async function syncTestReadingAssignmentsAction(
  testId: string,
  assignments: { question_id: string; display_order: number; is_active: boolean }[]
) {
  await requireAdmin()

  // 1. Validation: check that display_order is unique among the active/assigned questions
  const displayOrders = assignments.map(a => a.display_order)
  const uniqueOrders = new Set(displayOrders)
  if (uniqueOrders.size !== displayOrders.length) {
    return {
      success: false,
      error: 'Each assigned question must have a unique display order position.'
    }
  }

  const supabase = await createClient()

  // 2. Clear existing assignments for this test
  const { error: deleteError } = await supabase
    .from('test_reading_questions')
    .delete()
    .eq('test_id', testId)

  if (deleteError) {
    console.error('Failed to clear previous test reading assignments:', deleteError.message)
    return { success: false, error: deleteError.message }
  }

  // 3. Insert new assignments
  if (assignments.length > 0) {
    const payload = assignments.map(a => ({
      test_id: testId,
      question_id: a.question_id,
      display_order: a.display_order,
      is_active: a.is_active
    }))

    const { error: insertError } = await supabase
      .from('test_reading_questions')
      .insert(payload)

    if (insertError) {
      console.error('Failed to save test reading assignments:', insertError.message)
      return { success: false, error: insertError.message }
    }
  }

  // 4. Revalidate cache paths to propagate changes
  revalidatePath('/admin/reading')
  revalidatePath('/admin/reading/assignments')
  return { success: true }
}
