import { GoogleGenAI } from '@google/genai'

// Configurable model name, defaulting to gemini-2.5-flash
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export interface EssayEvaluation {
  grammar_score: number
  vocabulary_score: number
  coherence_score: number
  fluency_score: number
  overall_score: number
  cefr_level: string
  feedback: {
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    general_feedback: string
  }
  raw_response: Record<string, unknown>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Executes a generateContent call with exponential retry logic.
 */
async function tryGenerate(
  ai: GoogleGenAI,
  model: string,
  userContent: string,
  systemInstruction: string,
  schema: Record<string, unknown>
) {
  const delays = [2000, 5000, 10000] // 2s, 5s, 10s delays

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      console.log(`Sending request to ${model} (attempt ${attempt + 1}/${delays.length + 1})...`)
      
      const response = await ai.models.generateContent({
        model,
        contents: userContent,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      })
      
      return response
    } catch (err: unknown) {
      console.error(`Attempt ${attempt + 1} with model ${model} failed. Error:`, err)
      
      // If we still have retries remaining, sleep and try again
      if (attempt < delays.length) {
        const delay = delays[attempt]
        console.log(`Waiting ${delay / 1000}s before next retry...`)
        await sleep(delay)
      } else {
        // All attempts for this model exhausted
        throw err
      }
    }
  }
  throw new Error(`Execution completed without returning a response for ${model}`)
}

/**
 * Main evaluation function calling the Gemini Flash API with fallback.
 */
export async function evaluateEssay(
  promptText: string,
  essayText: string
): Promise<EssayEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment variables. ' +
      'Please create a Gemini API key at https://aistudio.google.com/ and add GEMINI_API_KEY=your_key to .env.local.'
    )
  }

  const ai = new GoogleGenAI({ apiKey })

  const systemInstruction = `
    You are an expert English language examiner scoring student essays against the Common European Framework of Reference for Languages (CEFR) rubrics. 
    Evaluate the essay based on the provided prompt and write detailed, objective evaluations.

    ### Score-to-CEFR Mapping Table:
    - **0 - 20**: A1 (Beginner)
    - **21 - 40**: A2 (Elementary)
    - **41 - 60**: B1 (Intermediate)
    - **61 - 80**: B2 (Upper-Intermediate)
    - **81 - 90**: C1 (Advanced)
    - **91 - 100**: C2 (Proficiency)

    ### CEFR Levels Definitions:
    - **A1 (Beginner, 0-20)**: Can use simple everyday expressions, isolated words, and very basic phrases. Extremely limited grammatical and lexical control.
    - **A2 (Elementary, 21-40)**: Can write short, simple texts using basic connectors ("and", "but", "because"). High rate of basic errors.
    - **B1 (Intermediate, 41-60)**: Can write straightforward, connected texts on familiar topics. Displays reasonable grammatical control but lacks variety.
    - **B2 (Upper-Intermediate, 61-80)**: Can write clear, detailed texts on a wide range of subjects. Synthesizes info and gives arguments. Grammatically correct but simple essays with conventional vocabulary must remain inside the B2 boundary.
    - **C1 (Advanced, 81-90)**: Can write clear, well-structured texts on complex subjects, showing controlled use of organizational patterns, connectors, and cohesive devices. Requires advanced idiomatic vocabulary, varied sentence lengths, and complex syntactic structures.
    - **C2 (Proficiency, 91-100)**: Can write clear, smoothly flowing, and precise text in an appropriate style. Displays near-native control, natural structural variety, and sophisticated collocations.

    ### Scoring Rubrics (0-100 Range):
    1. **Grammar (Grammatical Accuracy)**:
       - **90-100**: Near-perfect accuracy. Errors are rare and do not affect comprehension.
       - **76-89**: Good control with minor errors. Complex structures show occasional slips.
       - **61-75**: Understandable with noticeable mistakes. Basic structures are secure; complex ones have errors.
       - **41-60**: Frequent errors in grammar and structure. Meaning is occasionally obscured.
       - **0-40**: Severe errors. Lacks control over even simple grammatical structures.

    2. **Vocabulary (Lexical Range & Accuracy)**:
       - **90-100**: Sophisticated. Precise, varied, and natural collocations with idiomatic range.
       - **76-89**: Varied. Good lexical range allowing detailed discussion, avoiding repetition.
       - **61-75**: Adequate. Sufficient words to express ideas, though relies on common vocabulary.
       - **41-60**: Basic. Repetitive word choices with limited range and occasional wrong usages.
       - **0-40**: Very limited. Restricted vocabulary causing communication breakdown.

    3. **Coherence (Coherence and Cohesion)**:
       - **90-100**: Exceptionally coherent. Smooth transitions and clear logical progression.
       - **76-89**: Well structured. Consistent paragraphing and effective use of connectors.
       - **61-75**: Logical but simple. Basic connectors are used accurately to link statements.
       - **41-60**: Partially organized. Lacks smooth paragraphing or clear structure.
       - **0-40**: Disorganized. Fragmented thoughts lacking cohesive connection.

    4. **Fluency (Lexical & Structural Fluency)**:
       - **90-100**: Native-like flow. Natural structural variety and expression.
       - **76-89**: Smooth and varied. Fluid sentence structures and structural range.
       - **61-75**: Reasonably fluent. Sentence lengths are secure, but complex flow is stiff.
       - **41-60**: Repetitive. Choppy sentence progression or constant pattern repetition.
       - **0-40**: Fragmented. Pauses in structure choice, writing is halted and broken.

    ### Grading Constraints & Score Inflation Prevention Rules:
    - **Score Inflation Ban**: Be strict. Do not award scores in the 90s unless the writing truly meets C2 proficiency.
    - **Simple Essay Cap**: Essays that are grammatically correct but use only simple sentences and basic vocabulary (lacking C1/C2 advanced structures/idioms) must be capped in the **B2** level (maximum score of 80).
    - **Hard C1 Gate**: To be graded at C1 (81-90), the essay must satisfy **both** metrics:
      - **Vocabulary score >= 85**
      - **Fluency score >= 85**
      - Multiple complex sentence structures (e.g., subordinating clauses, passive constructions, inversion) must be present.
    - **Hard C2 Gate**: To be graded at C2 (91-100), the essay must satisfy **all** metrics:
      - **All category scores (Grammar, Vocabulary, Coherence, Fluency) >= 90**
      - Near-native style, precision, and smooth composition.
    - **Length & Variety Penalties**: Significantly penalize essays that fail to meet prompt word count minimums, are highly repetitive, exhibit a lack of lexical variety, or are poorly developed.
    - **Score Justification**: Every score assigned must be fully justified through the strengths, weaknesses, and general feedback items you provide in the response JSON payload.

    ### CEFR Assignment Rules:
    - A score within a CEFR band does not automatically qualify the essay for that CEFR level.
    - The essay must satisfy the qualitative requirements of that CEFR level.
    - If the qualitative requirements are not met, assign the lower CEFR level even if the numeric score falls into a higher band.
  `

  const userContent = `
    Prompt: "${promptText}"
    Student's Essay:
    "${essayText}"
  `

  const responseSchema: Record<string, unknown> = {
    type: 'OBJECT',
    properties: {
      grammar_score: { type: 'INTEGER' },
      vocabulary_score: { type: 'INTEGER' },
      coherence_score: { type: 'INTEGER' },
      fluency_score: { type: 'INTEGER' },
      overall_score: { type: 'INTEGER' },
      cefr_level: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      feedback: {
        type: 'OBJECT',
        properties: {
          strengths: { type: 'ARRAY', items: { type: 'STRING' } },
          weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
          suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
          general_feedback: { type: 'STRING' }
        },
        required: ['strengths', 'weaknesses', 'suggestions', 'general_feedback']
      }
    },
    required: [
      'grammar_score',
      'vocabulary_score',
      'coherence_score',
      'fluency_score',
      'overall_score',
      'cefr_level',
      'feedback'
    ]
  }

  // Models to try in sequence: Primary model first, then fallback to gemini-flash-latest and gemini-2.0-flash
  const modelsToTry = [
    GEMINI_MODEL,
    'gemini-flash-latest',
    'gemini-2.0-flash'
  ]
  let lastError: unknown = null

  for (const model of modelsToTry) {
    try {
      console.log(`Initiating essay evaluation with model: ${model}`)
      const response = await tryGenerate(ai, model, userContent, systemInstruction, responseSchema)

      if (!response.text) {
        throw new Error('Gemini API returned an empty response text')
      }

      const parsedJson = JSON.parse(response.text)
      
      return {
        grammar_score: parsedJson.grammar_score,
        vocabulary_score: parsedJson.vocabulary_score,
        coherence_score: parsedJson.coherence_score,
        fluency_score: parsedJson.fluency_score,
        overall_score: parsedJson.overall_score,
        cefr_level: parsedJson.cefr_level,
        feedback: parsedJson.feedback,
        raw_response: parsedJson as Record<string, unknown>,
      }
    } catch (err: unknown) {
      console.error(`Evaluation with model ${model} failed after retries. Moving to next model...`)
      lastError = err
    }
  }

  // Log full detailed Gemini errors on the server console only
  console.error('All Gemini evaluation models failed. Full server error context:', lastError)

  // Throw user-friendly message. Do not expose raw API/JSON errors to the user client.
  throw new Error('AI evaluation service is temporarily busy. Please try again in a few moments.')
}

export interface SpeakingEvaluation {
  transcript: string
  pronunciation_score: number
  grammar_score: number
  fluency_score: number
  vocabulary_score: number
  overall_score: number
  cefr_level: string
  feedback: {
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    general_feedback: string
  }
  raw_response: Record<string, unknown>
}

/**
 * Evaluates raw audio speech response directly using Gemini's native audio understanding capabilities.
 */
export async function evaluateSpeech(
  promptText: string,
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<SpeakingEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment variables. ' +
      'Please create a Gemini API key at https://aistudio.google.com/ and add GEMINI_API_KEY=your_key to .env.local.'
    )
  }

  const ai = new GoogleGenAI({ apiKey })

  const systemInstruction = `
    You are an expert English language examiner scoring student spoken responses against the Common European Framework of Reference for Languages (CEFR) rubrics.
    Listen to the audio recording, transcribe it, and write a detailed evaluation.

    ### Score-to-CEFR Mapping Table:
    - **0 - 20**: A1 (Beginner)
    - **21 - 40**: A2 (Elementary)
    - **41 - 60**: B1 (Intermediate)
    - **61 - 80**: B2 (Upper-Intermediate)
    - **81 - 90**: C1 (Advanced)
    - **91 - 100**: C2 (Proficiency)

    Evaluate the following 4 categories (0-100 range):
    1. **Pronunciation**: Clarity of speech, consonant/vowel accuracy, word stress, accent intelligibility.
    2. **Fluency**: Smoothness, lack of hesitations, pause frequency, natural speaking rate.
    3. **Grammar**: Precision and complexity of spoken sentence structures.
    4. **Vocabulary**: Range, appropriateness, and precision of spoken word choices.

    Output the exact spoken transcript in the 'transcript' field.
    Provide actionable feedback: strengths, weaknesses (hesitations, pronunciation slips, structural errors), and recommendations.

    ### Grading Constraints & Score Inflation Prevention Rules:
    - **Score Inflation Ban**: Be strict and realistic. Do not award scores in the 90s unless the spoken performance displays authentic near-native fluency, complex syntax, and pristine phonological control.
    - **Standard Speech Cap**: Clear, intelligible speech with standard conversational vocabulary and simple structures must be capped at the **B2** tier (maximum score of 80).
    - **Hard C1 Gate**: To be graded at C1 (81-90), the response must show advanced lexical variety, spontaneous fluent pacing with negligible unnatural pauses, and accurate use of complex grammar.
    - **Hard C2 Gate**: To be graded at C2 (91-100), all category scores must be >= 90 with near-native ease, sophisticated idiomatic expression, and flawless delivery.
    - **Provisional Notice**: This assessment provides a provisional, indicative diagnostic rating based on a single oral response.

    All responses must be strictly JSON format conforming to the requested schema.
  `

  const userContent = `
    Speaking Prompt constraint to answer: "${promptText}"
    Please listen to the attached audio, transcribe it, and evaluate the response.
  `

  const responseSchema: Record<string, unknown> = {
    type: 'OBJECT',
    properties: {
      transcript: { type: 'STRING' },
      pronunciation_score: { type: 'INTEGER' },
      fluency_score: { type: 'INTEGER' },
      grammar_score: { type: 'INTEGER' },
      vocabulary_score: { type: 'INTEGER' },
      overall_score: { type: 'INTEGER' },
      cefr_level: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      feedback: {
        type: 'OBJECT',
        properties: {
          strengths: { type: 'ARRAY', items: { type: 'STRING' } },
          weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
          suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
          general_feedback: { type: 'STRING' }
        },
        required: ['strengths', 'weaknesses', 'suggestions', 'general_feedback']
      }
    },
    required: [
      'transcript',
      'pronunciation_score',
      'fluency_score',
      'grammar_score',
      'vocabulary_score',
      'overall_score',
      'cefr_level',
      'feedback'
    ]
  }

  // We reuse the same model fallback chain
  const modelsToTry = [
    GEMINI_MODEL,
    'gemini-flash-latest',
    'gemini-2.0-flash'
  ]
  let lastError: unknown = null

  for (const model of modelsToTry) {
    try {
      console.log(`Initiating speech evaluation with model: ${model}`)
      
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType
            }
          },
          {
            text: userContent
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      })

      if (!response.text) {
        throw new Error('Gemini API returned an empty response text')
      }

      const parsedJson = JSON.parse(response.text)
      
      return {
        transcript: parsedJson.transcript,
        pronunciation_score: parsedJson.pronunciation_score,
        fluency_score: parsedJson.fluency_score,
        grammar_score: parsedJson.grammar_score,
        vocabulary_score: parsedJson.vocabulary_score,
        overall_score: parsedJson.overall_score,
        cefr_level: parsedJson.cefr_level,
        feedback: parsedJson.feedback,
        raw_response: parsedJson as Record<string, unknown>,
      }
    } catch (err: unknown) {
      console.error(`Speech evaluation with model ${model} failed. Error:`, err)
      lastError = err
    }
  }

  console.error('All Gemini evaluation models failed for speech. Error details:', lastError)
  throw new Error('AI speech evaluation service is temporarily busy. Please try again in a few moments.')
}
