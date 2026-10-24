import { create } from 'zustand'
import { Question } from '@/types/database.types'

interface TestingState {
  questions: Question[]
  currentIndex: number
  selectedOption: string | null
  startQuestionTime: number
  setQuestions: (questions: Question[]) => void
  setSelectedOption: (option: string | null) => void
  nextQuestion: () => void
  reset: () => void
}

export const useTestingStore = create<TestingState>((set) => ({
  questions: [],
  currentIndex: 0,
  selectedOption: null,
  startQuestionTime: 0,

  setQuestions: (questions) => set({ 
    questions, 
    currentIndex: 0, 
    selectedOption: null, 
    startQuestionTime: Date.now() 
  }),

  setSelectedOption: (option) => set({ selectedOption: option }),

  nextQuestion: () => set((state) => ({
    currentIndex: state.currentIndex + 1,
    selectedOption: null,
    startQuestionTime: Date.now(),
  })),

  reset: () => set({
    questions: [],
    currentIndex: 0,
    selectedOption: null,
    startQuestionTime: 0,
  }),
}))
