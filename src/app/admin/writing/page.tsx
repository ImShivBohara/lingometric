import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/guards'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Edit2, 
  FileText,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import DeletePromptButton from '@/features/admin/components/DeletePromptButton'

export default async function WritingAdminListPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch writing prompts with sections and tests
  const { data: prompts, error } = await supabase
    .from('writing_prompts')
    .select(`
      id,
      prompt_text,
      minimum_words,
      maximum_words,
      difficulty_level,
      is_active,
      sections (
        id,
        name,
        tests (
          id,
          title
        )
      )
    `)
    .order('is_active', { ascending: false })

  if (error) {
    console.error('Failed to load writing prompts:', error.message)
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-900">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Writing Prompts
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Configure writing essay prompt assignments, word limits, and difficulty tiers.
          </p>
        </div>
        <Link href="/admin/writing/new">
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-5 py-3 flex items-center space-x-2 shadow-lg shadow-indigo-500/10 transition">
            <Plus className="h-4 w-4" />
            <span>Create Prompt</span>
          </Button>
        </Link>
      </div>

      {/* Prompts list table */}
      {!prompts || prompts.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
              <FileText className="h-10 w-10 text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-white">No writing prompts configured</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Click the &quot;Create Prompt&quot; button above to define your first writing assessment essay prompt.
            </p>
          </div>
        </Card>
      ) : (
        <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="p-4">Prompt Details</th>
                  <th className="p-4">Target Section / Test</th>
                  <th className="p-4 w-24 text-center">Difficulty</th>
                  <th className="p-4 w-32 text-center">Word Limit</th>
                  <th className="p-4 w-24 text-center">Status</th>
                  <th className="p-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {prompts.map((prompt) => {
                  const sectionData = prompt.sections as unknown as { name: string; tests: { title: string } | null } | null
                  const sectionName = sectionData?.name || 'Unassigned'
                  const testTitle = sectionData?.tests?.title || 'Unknown Test'
                  
                  return (
                    <tr key={prompt.id} className="hover:bg-slate-900/25 transition duration-150">
                      <td className="p-4 max-w-[320px]">
                        <div className="font-semibold text-slate-100 line-clamp-2 leading-relaxed text-xs">
                          {prompt.prompt_text}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">{prompt.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{sectionName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{testTitle}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase">
                          {prompt.difficulty_level}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-slate-400 text-xs">
                        {prompt.minimum_words} - {prompt.maximum_words}
                      </td>
                      <td className="p-4 text-center">
                        {prompt.is_active ? (
                          <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-full text-[10px] font-bold font-mono bg-slate-800 border border-slate-700/60 text-slate-500">
                            <XCircle className="h-3 w-3" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2.5">
                          <Link href={`/admin/writing/${prompt.id}/edit`}>
                            <Button
                              variant="outline"
                              className="h-8 px-3 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center space-x-1 text-[11px] font-semibold"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
                          </Link>
                          <DeletePromptButton promptId={prompt.id} />
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
