'use client'

import React, { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  HelpCircle,
  CheckCircle
} from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  createListeningQuestionAction, 
  updateListeningQuestionAction, 
  deleteListeningQuestionAction 
} from '../actions'

interface Question {
  id: string
  passage_id: string
  question_text: string
  options: unknown // can be string[] or stringified
  correct_answer: string
  explanation?: string | null
}

interface QuestionManagerProps {
  passageId: string
  initialQuestions: Question[]
}

export default function QuestionManager({ passageId, initialQuestions }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [isPending, startTransition] = useTransition()
  
  // Modal states
  const [isOpen, setIsOpen] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  
  // Form fields
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState(0)
  const [explanation, setExplanation] = useState('')

  const getOptionsArray = (rawOptions: unknown): string[] => {
    if (Array.isArray(rawOptions)) return rawOptions as string[]
    try {
      if (typeof rawOptions === 'string') {
        const parsed = JSON.parse(rawOptions)
        if (Array.isArray(parsed)) return parsed as string[]
      }
    } catch {
      // ignore parsing error
    }
    return []
  }

  const handleOpenAdd = () => {
    setActiveQuestion(null)
    setQuestionText('')
    setOptions(['', '', '', ''])
    setSelectedCorrectIndex(0)
    setExplanation('')
    setIsOpen(true)
  }

  const handleOpenEdit = (q: Question) => {
    const opts = getOptionsArray(q.options)
    setActiveQuestion(q)
    setQuestionText(q.question_text)
    setOptions(opts.length > 0 ? opts : ['', '', '', ''])
    
    // Find index of correct answer
    const correctIdx = opts.indexOf(q.correct_answer)
    setSelectedCorrectIndex(correctIdx !== -1 ? correctIdx : 0)
    setExplanation(q.explanation || '')
    setIsOpen(true)
  }

  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options]
    newOptions[index] = val
    setOptions(newOptions)
  }

  const handleAddOptionField = () => {
    if (options.length >= 6) {
      toast.info('Maximum 6 choices permitted.')
      return
    }
    setOptions([...options, ''])
  }

  const handleRemoveOptionField = (index: number) => {
    if (options.length <= 2) {
      toast.info('Minimum 2 choices required.')
      return
    }
    const newOptions = options.filter((_, idx) => idx !== index)
    setOptions(newOptions)
    if (selectedCorrectIndex >= newOptions.length) {
      setSelectedCorrectIndex(newOptions.length - 1)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!questionText.trim()) {
      toast.error('Please enter the question text.')
      return
    }

    // Verify choice contents
    const filledOptions = options.map(o => o.trim()).filter(Boolean)
    if (filledOptions.length < 2) {
      toast.error('Please fill in at least 2 choice options.')
      return
    }

    if (options[selectedCorrectIndex]?.trim() === '') {
      toast.error('The selected correct choice cannot be empty.')
      return
    }

    const correctAnswerText = options[selectedCorrectIndex].trim()

    startTransition(async () => {
      try {
        const payload = {
          passage_id: passageId,
          question_text: questionText.trim(),
          options: options.map(o => o.trim()).filter(Boolean),
          correct_answer: correctAnswerText,
          explanation: explanation.trim() || undefined
        }

        if (activeQuestion) {
          // Edit operation
          const res = await updateListeningQuestionAction(activeQuestion.id, payload)
          if (res.success && res.data) {
            setQuestions(prev => prev.map(q => q.id === activeQuestion.id ? (res.data as Question) : q))
            toast.success('Question updated successfully!')
            setIsOpen(false)
          } else {
            toast.error(res.error || 'Failed to update question.')
          }
        } else {
          // Add operation
          const res = await createListeningQuestionAction(payload)
          if (res.success && res.data) {
            setQuestions(prev => [...prev, res.data as Question])
            toast.success('Question added successfully!')
            setIsOpen(false)
          } else {
            toast.error(res.error || 'Failed to add question.')
          }
        }
      } catch (err) {
        console.error('Question saving failed:', err)
        toast.error('Failed to save question data.')
      }
    })
  }

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    startTransition(async () => {
      try {
        const res = await deleteListeningQuestionAction(questionId, passageId)
        if (res.success) {
          setQuestions(prev => prev.filter(q => q.id !== questionId))
          toast.success('Question deleted successfully!')
        } else {
          toast.error(res.error || 'Failed to delete question.')
        }
      } catch (err) {
        console.error('Question deletion failed:', err)
        toast.error('An error occurred during deletion.')
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
        <div className="flex items-center space-x-2">
          <HelpCircle className="h-5 w-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">Comprehension Questions ({questions.length})</h3>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-4 py-2 flex items-center space-x-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>Add Question</span>
        </Button>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="bg-slate-900/10 border border-slate-900 rounded-xl p-8 text-center text-slate-500 text-xs">
          No questions created for this listening passage yet. Click &quot;Add Question&quot; above to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {questions.map((q, qIndex) => {
            const opts = getOptionsArray(q.options)
            return (
              <Card key={q.id} className="border-slate-800 bg-slate-900/20 backdrop-blur-sm text-slate-100 p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-3 flex-grow">
                    {/* Index & Question text */}
                    <div className="font-bold text-white text-sm flex items-start space-x-2.5">
                      <span className="text-indigo-400 font-mono text-xs mt-0.5">{qIndex + 1}.</span>
                      <p>{q.question_text}</p>
                    </div>

                    {/* Choices grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-6">
                      {opts.map((opt, oIdx) => {
                        const isCorrect = opt === q.correct_answer
                        return (
                          <div 
                            key={oIdx}
                            className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs border ${
                              isCorrect 
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 font-semibold' 
                                : 'bg-slate-950/40 border-slate-900 text-slate-400'
                            }`}
                          >
                            {isCorrect ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border border-slate-700 flex-shrink-0 flex items-center justify-center font-mono text-[8px] text-slate-500">
                                {String.fromCharCode(65 + oIdx)}
                              </div>
                            )}
                            <span className="truncate">{opt}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <p className="text-[10px] text-slate-500 italic pl-6 leading-relaxed">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center space-x-2.5 flex-shrink-0">
                    <Button
                      onClick={() => handleOpenEdit(q)}
                      variant="outline"
                      className="h-8 w-8 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg p-0 flex items-center justify-center"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(q.id)}
                      variant="outline"
                      className="h-8 w-8 border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 hover:bg-rose-950/10 rounded-lg p-0 flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Question Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              {activeQuestion ? 'Edit Comprehension Question' : 'Add Comprehension Question'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Formulate the multiple-choice question and define the correct select options.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            
            {/* Question Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Question Text
              </label>
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. What is the speaker's main recommendation?"
                className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-600"
              />
            </div>

            {/* Choices Options List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Options Choices
                </label>
                <Button
                  type="button"
                  onClick={handleAddOptionField}
                  disabled={options.length >= 6}
                  variant="ghost"
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-900/40 p-1 h-auto font-semibold"
                >
                  + Add Choice
                </Button>
              </div>

              <div className="space-y-2">
                {options.map((opt, oIndex) => (
                  <div key={oIndex} className="flex items-center space-x-2.5">
                    {/* Index Tag */}
                    <div className="h-8 w-8 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-center text-xs font-mono font-bold text-slate-500 flex-shrink-0">
                      {String.fromCharCode(65 + oIndex)}
                    </div>
                    {/* Option Text Input */}
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(oIndex, e.target.value)}
                      placeholder={`e.g. Option choice ${oIndex + 1}`}
                      className="flex-grow bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                    />
                    {/* Remove Action */}
                    <Button
                      type="button"
                      onClick={() => handleRemoveOptionField(oIndex)}
                      disabled={options.length <= 2}
                      variant="ghost"
                      className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 p-0 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Select Correct Answer */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Specify Correct Choice
              </label>
              <select
                value={selectedCorrectIndex}
                onChange={(e) => setSelectedCorrectIndex(parseInt(e.target.value))}
                className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
              >
                {options.map((opt, oIdx) => (
                  <option key={oIdx} value={oIdx} className="bg-slate-950">
                    Choice {String.fromCharCode(65 + oIdx)} {opt ? `— ${opt.substring(0, 30)}${opt.length > 30 ? '...' : ''}` : '(Empty)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Explanation textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Answer Explanation (Optional)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                placeholder="Briefly justify why this answer option is correct..."
                className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none placeholder-slate-700 font-sans"
              />
            </div>

            {/* Submit Trigger actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-850">
              <Button
                type="button"
                onClick={() => setIsOpen(false)}
                variant="outline"
                className="border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900 rounded-xl font-semibold text-xs px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl px-4 py-2 flex items-center space-x-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Question</span>
                )}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
