'use client'

import React, { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteWritingPromptAction } from '../actions'

interface DeletePromptButtonProps {
  promptId: string
}

export default function DeletePromptButton({ promptId }: DeletePromptButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this writing prompt?')) {
      return
    }

    startTransition(async () => {
      try {
        const res = await deleteWritingPromptAction(promptId)
        if (res.success) {
          toast.success('Writing prompt deleted successfully!')
        } else {
          toast.error(res.error || 'Failed to delete writing prompt.')
        }
      } catch (err) {
        console.error('Delete prompt failed:', err)
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
