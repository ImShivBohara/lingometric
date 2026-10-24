'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { revalidatePath } from 'next/cache'

export async function syncTestListeningAssignmentsAction(
  testId: string,
  assignments: { passage_id: string; display_order: number; is_active: boolean }[]
) {
  await requireAdmin()

  // 1. Validation: check that display_order is unique among the active/assigned passages
  const displayOrders = assignments.map(a => a.display_order)
  const uniqueOrders = new Set(displayOrders)
  if (uniqueOrders.size !== displayOrders.length) {
    return {
      success: false,
      error: 'Each assigned passage must have a unique display order position.'
    }
  }

  const supabase = await createClient()

  // 2. Clear existing assignments for this test
  const { error: deleteError } = await supabase
    .from('test_listening_passages')
    .delete()
    .eq('test_id', testId)

  if (deleteError) {
    console.error('Failed to clear previous test listening assignments:', deleteError.message)
    return { success: false, error: deleteError.message }
  }

  // 3. Insert new assignments
  if (assignments.length > 0) {
    const payload = assignments.map(a => ({
      test_id: testId,
      passage_id: a.passage_id,
      display_order: a.display_order,
      is_active: a.is_active
    }))

    const { error: insertError } = await supabase
      .from('test_listening_passages')
      .insert(payload)

    if (insertError) {
      console.error('Failed to save test listening assignments:', insertError.message)
      return { success: false, error: insertError.message }
    }
  }

  // 4. Revalidate cache paths to propagate changes
  revalidatePath('/admin/listening')
  revalidatePath('/admin/listening/assignments')
  return { success: true }
}
