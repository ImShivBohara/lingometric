'use client'

import React, { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteListeningPassageAction } from '../actions'

interface DeletePassageButtonProps {
  passageId: string
}

export default function DeletePassageButton({ passageId }: DeletePassageButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this listening passage? All associated questions will be deleted as well.')) {
      return
    }

    startTransition(async () => {
      try {
        const res = await deleteListeningPassageAction(passageId)
        if (res.success) {
          toast.success('Passage deleted successfully!')
        } else {
          toast.error(res.error || 'Failed to delete passage.')
        }
      } catch (err) {
        console.error('Delete passage failed:', err)
        toast.error('An unexpected error occurred.')
      }
    })
  }

  return (
    <Button
      onClick={handleDelete}
      disabled={isPending}
      variant="outline"
      className="h-8 w-8 border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 hover:bg-rose-950/10 rounded-lg p-0 flex items-center justify-center disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
