'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Edit2, 
  BookOpen, 
  Book, 
  SpellCheck, 
  Clock, 
  Grid, 
  AlignLeft, 
  FileText, 
  Compass, 
  GitFork, 
  HelpCircle,
  Search,
  X,
  SlidersHorizontal
} from 'lucide-react'
import DeleteQuestionButton from './DeleteQuestionButton'

interface QuestionWithSection {
  id: string
  question_type: string
  difficulty_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  question_text: string
  options: unknown
  correct_answer: string
  explanation: string | null
  category: string
  section_id: string
  sections: {
    id: string
    name: string
    type: string
    tests: {
      id: string
      title: string
    } | null
  } | null
}

interface ReadingQuestionListProps {
  initialQuestions: QuestionWithSection[]
}

const CATEGORIES = [
  'Grammar',
  'Vocabulary',
  'Tenses',
  'Sentence Completion',
  'Reading Comprehension',
  'Articles',
  'Prepositions',
  'Conditionals',
  'General'
]

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  'Total': { icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  'Grammar': { icon: Book, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  'Vocabulary': { icon: SpellCheck, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  'Tenses': { icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'Sentence Completion': { icon: Grid, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  'Reading Comprehension': { icon: AlignLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'Articles': { icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  'Prepositions': { icon: Compass, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'Conditionals': { icon: GitFork, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'General': { icon: HelpCircle, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
}

export default function ReadingQuestionList({ initialQuestions }: ReadingQuestionListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All')

  // Calculate static counts of all loaded questions by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Total: initialQuestions.length }
    CATEGORIES.forEach(cat => {
      counts[cat] = 0
    })
    initialQuestions.forEach(q => {
      const cat = q.category || 'General'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [initialQuestions])

  // Filter questions dynamically
  const filteredQuestions = useMemo(() => {
    return initialQuestions.filter(q => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        if (!q.question_text.toLowerCase().includes(term)) {
          return false
        }
      }
      // Category filter
      if (selectedCategory !== 'All') {
        if (q.category !== selectedCategory) {
          return false
        }
      }
      // Difficulty filter
      if (selectedDifficulty !== 'All') {
        if (q.difficulty_level !== selectedDifficulty) {
          return false
        }
      }
      return true
    })
  }, [initialQuestions, searchTerm, selectedCategory, selectedDifficulty])

  const handleCategoryCardClick = (catName: string) => {
    if (catName === 'Total') {
      setSelectedCategory('All')
    } else {
      setSelectedCategory(catName)
    }
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('All')
    setSelectedDifficulty('All')
  }

  return (
    <div className="space-y-6">
      
      {/* Category count dashboard cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* Total Card */}
        <button
          onClick={() => handleCategoryCardClick('Total')}
          className={`text-left transition-all duration-200 focus:outline-none ${
            selectedCategory === 'All'
              ? 'scale-[1.02] ring-1 ring-indigo-500 ring-offset-1 ring-offset-slate-950'
              : 'hover:scale-[1.01] opacity-75 hover:opacity-100'
          }`}
        >
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm cursor-pointer select-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Questions</p>
                <h3 className="text-2xl font-black text-white mt-1 font-mono">
                  {categoryCounts['Total']}
                </h3>
              </div>
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl">
                <BookOpen className="h-5 w-5 text-indigo-400" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Category Cards */}
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat] || CATEGORY_META['General']
          const IconComponent = meta.icon
          const count = categoryCounts[cat] || 0
          const isActive = selectedCategory === cat

          return (
            <button
              key={cat}
              onClick={() => handleCategoryCardClick(cat)}
              className={`text-left transition-all duration-200 focus:outline-none ${
                isActive
                  ? 'scale-[1.02] ring-1 ring-indigo-500 ring-offset-1 ring-offset-slate-950'
                  : 'hover:scale-[1.01] opacity-75 hover:opacity-100'
              }`}
            >
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm cursor-pointer select-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 truncate pr-1" title={cat}>
                      {cat}
                    </p>
                    <h3 className="text-xl font-bold text-white mt-1 font-mono">
                      {count}
                    </h3>
                  </div>
                  <div className={`p-2 ${meta.bg} border ${meta.border} rounded-xl flex-shrink-0`}>
                    <IconComponent className={`h-4.5 w-4.5 ${meta.color}`} />
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Filters & Actions Panel */}
      <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Search question text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950/80 border-slate-800 focus:ring-1 focus:ring-indigo-500 pl-10 pr-4 py-2 text-xs rounded-xl text-slate-100"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Select Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer w-full sm:w-44"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Select Dropdown */}
            <div className="relative">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer w-full sm:w-40"
              >
                <option value="All">All Difficulties</option>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filters / Stats summary */}
          <div className="flex items-center gap-3 justify-end flex-shrink-0">
            {(searchTerm || selectedCategory !== 'All' || selectedDifficulty !== 'All') && (
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-200 px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </Button>
            )}

            <div className="text-[10px] text-slate-500 font-mono font-bold">
              Showing {filteredQuestions.length} of {initialQuestions.length}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Questions table list */}
      {filteredQuestions.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/10 backdrop-blur-sm text-slate-100 p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
              <BookOpen className="h-8 w-8 text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-white">No questions match your criteria</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Try adjusting your search queries, clearing category filters, or add a new question to this selection.
            </p>
          </div>
        </Card>
      ) : (
        <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="p-4">Question Details</th>
                  <th className="p-4">Target Section & Test</th>
                  <th className="p-4 w-28 text-center">Category</th>
                  <th className="p-4 w-20 text-center">Difficulty</th>
                  <th className="p-4 w-28 text-center">Correct Option</th>
                  <th className="p-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredQuestions.map((q) => {
                  const sectionData = q.sections
                  const sectionName = sectionData?.name || 'Unassigned'
                  const testTitle = sectionData?.tests?.title || 'Unknown Test'

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
                    <tr key={q.id} className="hover:bg-slate-900/25 transition duration-150">
                      <td className="p-4 max-w-[360px]">
                        {hasPassage && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1.5">
                            Comprehension
                          </span>
                        )}
                        <div className="font-semibold text-slate-100 line-clamp-2 leading-relaxed text-xs">
                          {displayQuestion}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">{q.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{sectionName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{testTitle}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700/60 text-slate-300">
                          {q.category || 'General'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase">
                          {q.difficulty_level}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-emerald-400 text-xs truncate max-w-[120px]">
                        {q.correct_answer}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2.5">
                          <Link href={`/admin/reading/${q.id}/edit`}>
                            <Button
                              variant="outline"
                              className="h-8 px-3 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center space-x-1 text-[11px] font-semibold"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
                          </Link>
                          <DeleteQuestionButton questionId={q.id} />
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
