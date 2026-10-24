'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  ArrowLeft, 
  Settings, 
  ClipboardList, 
  CheckCircle2, 
  Loader2, 
  ListOrdered, 
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { syncTestReadingAssignmentsAction } from '../actions/reading-assignments'

interface TestOption {
  id: string
  title: string
  status: string
}

interface QuestionOption {
  id: string
  question_text: string
  category: string
  difficulty_level: string
}

interface Assignment {
  test_id: string
  question_id: string
  display_order: number
  is_active: boolean
}

interface ReadingAssignmentsManagerProps {
  tests: TestOption[]
  questions: QuestionOption[]
  initialAssignments: Assignment[]
}

export default function ReadingAssignmentsManager({
  tests,
  questions,
  initialAssignments
}: ReadingAssignmentsManagerProps) {
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || '')

  // Helper function to build initial assignments state for a given test ID
  const getAssignmentsForTest = (testId: string) => {
    const currentAssignments = initialAssignments.filter(a => a.test_id === testId)
    const state: Record<string, { assigned: boolean; display_order: number; is_active: boolean }> = {}

    // Initialize all questions as unassigned
    questions.forEach(q => {
      state[q.id] = {
        assigned: false,
        display_order: 1,
        is_active: true
      }
    })

    // Populate with existing assignments
    currentAssignments.forEach(a => {
      if (state[a.question_id]) {
        state[a.question_id] = {
          assigned: true,
          display_order: a.display_order,
          is_active: a.is_active
        }
      }
    })

    return state
  }

  // Track working assignments state
  const [workingAssignments, setWorkingAssignments] = useState<
    Record<string, { assigned: boolean; display_order: number; is_active: boolean }>
  >(() => getAssignmentsForTest(tests[0]?.id || ''))

  const [isPending, startTransition] = useTransition()

  // Calculate duplicateError during render from workingAssignments
  const assignedOrders: number[] = []
  Object.values(workingAssignments).forEach(data => {
    if (data.assigned) {
      assignedOrders.push(data.display_order)
    }
  })

  const duplicates = assignedOrders.filter((item, index) => assignedOrders.indexOf(item) !== index)
  const duplicateError = duplicates.length > 0
    ? `Duplicate display order detected: position ${duplicates.join(', ')}. Please assign a unique number to each question.`
    : null

  // Handler for dropdown selection change
  const handleTestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const testId = e.target.value
    setSelectedTestId(testId)
    setWorkingAssignments(getAssignmentsForTest(testId))
  }

  const handleCheckboxChange = (questionId: string, assigned: boolean) => {
    setWorkingAssignments(prev => {
      const current = prev[questionId]
      // When newly assigned, give it a sensible default order
      let nextOrder = current.display_order
      if (assigned) {
        const activeOrders = Object.values(prev)
          .filter(x => x.assigned)
          .map(x => x.display_order)
        nextOrder = activeOrders.length > 0 ? Math.max(...activeOrders) + 1 : 1
      }
      return {
        ...prev,
        [questionId]: {
          ...current,
          assigned,
          display_order: nextOrder
        }
      }
    })
  }

  const handleOrderChange = (questionId: string, orderStr: string) => {
    const order = parseInt(orderStr, 10) || 0
    setWorkingAssignments(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        display_order: order
      }
    }))
  }

  const handleActiveToggle = (questionId: string, is_active: boolean) => {
    setWorkingAssignments(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        is_active
      }
    }))
  }

  const handleAutoReorder = () => {
    // Collect all assigned questions
    const assignedList = Object.entries(workingAssignments)
      .filter(([, data]) => data.assigned)
      .map(([id, data]) => ({ id, ...data }))
      
    // Sort them by their current order
    assignedList.sort((a, b) => a.display_order - b.display_order)

    // Re-assign sequential 1-based order numbers
    setWorkingAssignments(prev => {
      const next = { ...prev }
      assignedList.forEach((item, index) => {
        next[item.id] = {
          ...next[item.id],
          display_order: index + 1
        }
      })
      return next
    })
    
    toast.success('Question order numbers standardized sequentially.')
  }

  const handleSave = async () => {
    if (duplicateError) {
      toast.error('Cannot save: please resolve duplicate display orders first.')
      return
    }

    const payload = Object.entries(workingAssignments)
      .filter(([, data]) => data.assigned)
      .map(([questionId, data]) => ({
        question_id: questionId,
        display_order: data.display_order,
        is_active: data.is_active
      }))

    startTransition(async () => {
      const res = await syncTestReadingAssignmentsAction(selectedTestId, payload)
      if (res.success) {
        toast.success('Test assignments successfully synced.')
      } else {
        toast.error(`Save failed: ${res.error}`)
      }
    })
  }

  const activeTest = tests.find(t => t.id === selectedTestId)

  return (
    <div className="space-y-8 font-sans max-w-5xl">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-900">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
            <Link href="/admin/reading" className="hover:text-indigo-400 flex items-center gap-1 transition">
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Question Bank</span>
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Test Question Assignments
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Assign Reading questions from the library bank to tests and configure sequence ordering.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Test Selector Column */}
        <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings className="h-4 w-4 text-indigo-400" />
              Select Assessment
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Select the target test template to assign reading questions to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase font-mono">Target Test</label>
              <select
                value={selectedTestId}
                onChange={handleTestChange}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {tests.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            {activeTest && (
              <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-mono text-slate-500 font-bold">Metadata ID</div>
                <div className="text-[10px] text-slate-400 font-mono break-all">{activeTest.id}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions List & Assignments Table Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white">Question Library Pool</h3>
            
            {/* Auto-reorder utility button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoReorder}
              className="h-8 px-3 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center space-x-1.5 text-xs font-semibold"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Fix Order Numbers</span>
            </Button>
          </div>

          {/* Validation Alert */}
          {duplicateError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start space-x-3 text-xs">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{duplicateError}</span>
            </div>
          )}

          {!questions || questions.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-8">
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
                <ClipboardList className="h-8 w-8 text-slate-500" />
                <h2 className="text-sm font-bold text-white">No questions available</h2>
                <p className="text-xs text-slate-500">
                  Please create questions in the Reading Question library bank before managing assignments.
                </p>
              </div>
            </Card>
          ) : (
            <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
              <table className="w-full text-left border-collapse text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="p-4 w-16 text-center">Assigned</th>
                    <th className="p-4">Question Detail</th>
                    <th className="p-4 w-24">Display Order</th>
                    <th className="p-4 w-24 text-center">Active Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {questions.map(q => {
                    const status = workingAssignments[q.id] || { assigned: false, display_order: 1, is_active: true }
                    
                    // Parse passage layout if comprehension
                    const text = q.question_text
                    const passageIndex = text.indexOf('Passage:')
                    const questionIndex = text.indexOf('Question:')
                    let displayQuestion = text
                    let hasPassage = false

                    if (passageIndex !== -1 && questionIndex !== -1) {
                      displayQuestion = text.substring(questionIndex + 9).trim()
                      hasPassage = true
                    }

                    return (
                      <tr key={q.id} className={`transition-all duration-150 ${status.assigned ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-slate-900/25'}`}>
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={status.assigned}
                            onChange={(e) => handleCheckboxChange(q.id, e.target.checked)}
                            className="h-4.5 w-4.5 rounded-lg border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="p-4 max-w-[280px]">
                          {hasPassage && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
                              Comprehension
                            </span>
                          )}
                          <div className="font-bold text-white text-xs line-clamp-2 leading-relaxed">{displayQuestion}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-slate-800 border border-slate-700/60 text-slate-400 uppercase">
                              {q.category || 'General'}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 uppercase">
                              {q.difficulty_level}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Input
                            type="number"
                            min="1"
                            disabled={!status.assigned}
                            value={status.display_order}
                            onChange={(e) => handleOrderChange(q.id, e.target.value)}
                            className="h-8 w-16 bg-slate-950 border-slate-800 text-slate-100 rounded-lg text-xs font-mono text-center disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={status.is_active}
                              disabled={!status.assigned}
                              onChange={(e) => handleActiveToggle(q.id, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Action button bar */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isPending || !!duplicateError || questions.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-6 py-3 flex items-center space-x-2 shadow-lg shadow-indigo-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Assignments...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Save Assignments</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
