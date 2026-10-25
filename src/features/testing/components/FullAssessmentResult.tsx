import Link from 'next/link'
import type { Attempt } from '@/types/database.types'
import { summarizeSession } from '../assessmentSession'
import GradingScale from './GradingScale'
import { PROVISIONAL_GRADING_DISCLAIMER } from '../cefrRating'

export default function FullAssessmentResult({ attempts }: { attempts: Attempt[] }) {
  const summary = summarizeSession(attempts)
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-white">Full Assessment Completed</h1>
      <p className="text-xl">Combined Score: <strong className="text-emerald-400">{summary.score ?? 'N/A'}/100</strong></p>
      <p className="text-sm text-slate-400">Each skill contributes 25% to your final score.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {summary.sections.map(a => <article key={a.id} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
          <h2 className="font-bold">{a.assessment_type}</h2>
          <p>{a.final_score ?? 'N/A'}/100 · CEFR {a.cefr_level ?? 'N/A'}</p>
          <Link className="text-indigo-300 underline" href={`/test/${a.id}/results?section=1`}>View section feedback and grading range</Link>
        </article>)}
      </div>
      <GradingScale score={summary.score} />
      <p className="text-xs text-slate-400">{PROVISIONAL_GRADING_DISCLAIMER}</p>
      <Link className="inline-block rounded-lg bg-indigo-600 px-5 py-3 text-white" href="/dashboard">Back to Dashboard</Link>
    </div>
  </main>
}
