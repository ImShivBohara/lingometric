/**
 * Utility functions for validating student Writing submissions.
 */

export interface WordCountValidationResult {
  valid: boolean
  wordCount: number
  error?: string
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).filter(Boolean).length
}

export function validateWritingWordCount(
  text: string,
  minWords: number = 50,
  maxWords: number = 500
): WordCountValidationResult {
  const wordCount = countWords(text)

  if (wordCount < minWords) {
    return {
      valid: false,
      wordCount,
      error: `Your essay has ${wordCount} word${wordCount === 1 ? '' : 's'}. It must contain at least ${minWords} words to be evaluated.`,
    }
  }

  if (wordCount > maxWords) {
    return {
      valid: false,
      wordCount,
      error: `Your essay has ${wordCount} words, which exceeds the limit of ${maxWords} words. Please shorten your response.`,
    }
  }

  return {
    valid: true,
    wordCount,
  }
}
