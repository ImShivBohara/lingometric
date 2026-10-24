import { create } from 'zustand'
import { Question } from '@/types/database.types'

interface TestingState {
  questions: Question[]
  currentIndex: number
  answers: Record<string, string>
  startQuestionTime: number
  setSession: (questions: Question[], answers?: Record<string, string>) => void
  setAnswer: (questionId: string, option: string | null) => void
  goToQuestion: (index: number) => void
  reset: () => void
}

export const useTestingStore = create<TestingState>((set) => ({
  questions: [],
  currentIndex: 0,
  answers: {},
  startQuestionTime: 0,

  setSession: (questions, answers = {}) => set({
    questions,
    answers,
    currentIndex: 0,
    startQuestionTime: Date.now(),
  }),

  setAnswer: (questionId, option) => set((state) => {
    const nextAnswers = { ...state.answers }
    if (!option) {
      delete nextAnswers[questionId]
    } else {
      nextAnswers[questionId] = option
    }
    return { answers: nextAnswers }
  }),

  goToQuestion: (index) => set((state) => {
    if (index < 0 || index >= state.questions.length) {
      return state
    }
    return {
      currentIndex: index,
      startQuestionTime: Date.now(),
    }
  }),

  reset: () => set({
    questions: [],
    currentIndex: 0,
    answers: {},
    startQuestionTime: 0,
  }),
}))
