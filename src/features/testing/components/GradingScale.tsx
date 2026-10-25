import { CEFR_DESCRIPTORS, CEFR_LEVELS } from '../cefrRating'
import type { AssessmentType } from '../attemptIdentity'

export default function GradingScale({ skill, level, score }: {
  skill?: AssessmentType; level?: string | null; score?: number | null
}) {
  const ranges = skill === 'Reading'
    ? ['0–20%', '>20–45%', '>45–75%', '>75–100%', 'Beyond this screener', 'Beyond this screener']
    : skill === 'Listening'
      ? ['0–<34%', '34–<67%', '67–100%', 'Beyond this screener', 'Beyond this screener', 'Beyond this screener']
      : skill === 'Writing' || skill === 'Speaking'
        ? ['0–20', '21–40', '41–60', '61–80', '81–90', '91–100']
        : ['0–20', '>20–40', '>40–60', '>60–80', '>80–90', '>90–100']
  return (
    <section aria-label="Grading range" className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-3 text-slate-300">
      <h2 className="font-bold text-white">Grading Scale {score != null ? `· ${score}/100` : ''}</h2>
      {score != null && Number.isFinite(Number(score)) && <div className="space-y-1">
        <div role="meter" aria-label="Assessment score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, score))}
          className="h-3 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400"><span>0</span><span>Your score: {score}/100</span><span>100</span></div>
      </div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CEFR_LEVELS.map((tier, index) => (
          <div key={tier} aria-current={tier === level ? 'true' : undefined}
            className={`rounded-lg border p-3 text-xs ${tier === level ? 'border-emerald-400 bg-emerald-500/15' : 'border-slate-800'}`}>
            <div className="font-bold text-base">{tier}{tier === level ? ' · Your level' : ''}</div>
            <div>{CEFR_DESCRIPTORS[tier].name}</div>
            <div className="mt-1 text-slate-400">{skill ? ranges[index] : `Reference band: ${ranges[index]}`}</div>
          </div>
        ))}
      </div>
      {(!skill || skill === 'Writing' || skill === 'Speaking') && <p className="text-xs text-slate-400">Scores range from 0 to 100. These are the Writing/Speaking rubric reference bands; qualitative requirements can lower the awarded CEFR level. The combined score averages all four skills and has no validated overall CEFR conversion.</p>}
    </section>
  )
}
