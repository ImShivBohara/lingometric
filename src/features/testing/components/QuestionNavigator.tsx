'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface QuestionNavigatorProps {
  total: number
  currentIndex: number
  answered: boolean[]
  onSelect: (index: number) => void
  disabled?: boolean
}

export default function QuestionNavigator({
  total,
  currentIndex,
  answered,
  onSelect,
  disabled = false,
}: QuestionNavigatorProps) {
  if (total <= 0) {
    return null
  }

  return (
    <nav aria-label="Question navigation" className="w-full mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Question Navigator
        </span>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-400" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Current
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Answered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            Unanswered
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: total }, (_, index) => {
          const isCurrent = index === currentIndex
          const isAnswered = Boolean(answered[index])

          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Question ${index + 1}${isCurrent ? ', current question' : ''}${isAnswered ? ', answered' : ', unanswered'}`}
              className={cn(
                'h-9 w-9 rounded-lg border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                isCurrent && 'border-indigo-500 bg-indigo-600 text-white shadow shadow-indigo-500/20',
                !isCurrent && isAnswered && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200',
                !isCurrent && !isAnswered && 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              {index + 1}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
