import Link from 'next/link'
import type { Attempt } from '@/types/database.types'
import { groupAssessmentAttempts, summarizeSession } from '../assessmentSession'
import GradingScale from './GradingScale'

export default function SessionHistory({ attempts, admin = false }: { attempts: Attempt[]; admin?: boolean }) {
  const groups = groupAssessmentAttempts(attempts.filter(a => a.session_id))
  if (!groups.length) return null
  return <section className="space-y-4">
    <h2 className="text-xl font-bold text-white">Full Assessment History</h2>
    {groups.map(group => {
      const summary = summarizeSession(group)
      return <article key={group[0].session_id} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-slate-300">
        <div className="flex flex-wrap justify-between gap-3">
          <div><p className="font-semibold text-white">Four-skill assessment</p>
            <time className="text-xs">{new Date(group[0].started_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} IST</time>
          </div>
          <p>{summary.discarded ? 'Discarded' : summary.complete ? `Completed · ${summary.score ?? 'N/A'}/100` : `In progress · ${summary.completedCount}/4 sections completed`}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {summary.sections.map(a => <div key={a.id} className="rounded-lg border border-slate-800 p-3">
            <p className="font-bold">{a.assessment_type}</p>
            <p>{a.status === 'SUBMITTED' ? `${a.final_score ?? 'N/A'}/100 · ${a.cefr_level ?? 'N/A'}` : a.status === 'DISCARDED' ? 'Discarded' : 'Pending'}</p>
          </div>)}
        </div>
        {!admin && !summary.discarded && <Link className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white" href={summary.complete ? `/test/${group[0].id}/results` : summary.nextPath || '/dashboard'}>
          {summary.complete ? 'View Final Result' : 'Resume Assessment'}
        </Link>}
        {admin && summary.complete && <GradingScale score={summary.score} />}
      </article>
    })}
  </section>
}
