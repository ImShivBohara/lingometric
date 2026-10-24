import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  HelpCircle, 
  Edit2, 
  Headphones,
  ClipboardList
} from 'lucide-react'
import DeletePassageButton from '@/features/admin/components/DeletePassageButton'

export default async function ListeningAdminListPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch listening passages with sections and questions
  const { data: passages, error } = await supabase
    .from('listening_passages')
    .select(`
      id,
      title,
      difficulty_level,
      duration_seconds,
      audio_url,
      sections (
        id,
        name,
        tests (
          id,
          title
        )
      ),
      questions: listening_questions (
        id
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load passages:', error.message)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-900">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Listening Passages
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Configure reusable listening comprehension passages, transcripts, and multiple-choice questions.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/admin/listening/assignments">
            <Button variant="outline" className="border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2 transition">
              <ClipboardList className="h-4 w-4 text-indigo-400" />
              <span>Test Assignments</span>
            </Button>
          </Link>
          <Link href="/admin/listening/new">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2 shadow-lg shadow-indigo-500/10 transition">
              <Plus className="h-4 w-4" />
              <span>Create Passage</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid/Table */}
      {!passages || passages.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
              <Headphones className="h-10 w-10 text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-white">No passages configured</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Click the &quot;Create Passage&quot; button above to upload your first audio passage and associate it with a test section.
            </p>
          </div>
        </Card>
      ) : (
        <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="p-4">Passage Title</th>
                  <th className="p-4">Section / Test Link</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Questions</th>
                  <th className="p-4">Audio Track</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {passages.map((passage) => {
                  const sectionData = passage.sections as unknown as { name: string; tests: { title: string } | null } | null
                  const sectionName = sectionData?.name || 'Unassigned'
                  const testTitle = sectionData?.tests?.title || 'Unknown Test'
                  
                  return (
                    <tr key={passage.id} className="hover:bg-slate-900/25 transition duration-150">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{passage.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[200px]">{passage.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{sectionName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{testTitle}</div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase">
                          {passage.difficulty_level}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">
                        {formatDuration(passage.duration_seconds)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                          <span className="font-bold text-slate-200">
                            {Array.isArray(passage.questions) ? passage.questions.length : 0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <audio 
                            src={passage.audio_url} 
                            controls 
                            className="h-7 max-w-[150px] md:max-w-[180px] scale-90 origin-left"
                            preload="none"
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2.5">
                          <Link href={`/admin/listening/${passage.id}/edit`}>
                            <Button
                              variant="outline"
                              className="h-8 px-3 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center space-x-1 text-[11px] font-semibold"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
                          </Link>
                          <DeletePassageButton passageId={passage.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
