# API_SPEC.md
# LinguaCert AI — API & Action Specification
> **Status:** Approved Draft v1.0  |  **Author:** Senior Staff Engineer

---

## 1. Overview

Communication in LinguaCert AI happens primarily through secure **Next.js Server Actions** (highly optimized for client-to-server calls with type safety) and secondarily through standard **HTTP REST Endpoints** (for external integrations, webhook processors, and media assets download).

---

## 2. Next.js Server Actions

All actions return a standardized union response:
```typescript
type ActionResponse<T> = 
  | { success: true; data: T } 
  | { success: false; error: { code: string; message: string } };
```

### 2.1 Testing & Adaptive Lifecycle

#### `startTestAttempt`
Creates a new assessment session record, instantiating the starting CEFR tier.
*   **Parameters:** `{ testId: string }`
*   **Returns:** `{ attemptId: string; startCefr: 'B1'; currentSection: 'Reading' }`

#### `getNextQuestion`
Calculates and returns the next adaptive test item.
*   **Parameters:** `{ attemptId: string; sectionId: string }`
*   **Returns:**
    ```json
    {
      "id": "uuid",
      "question_type": "MCQ",
      "question_text": "Choose the correct past tense form...",
      "options": ["go", "went", "going", "gone"],
      "estimated_time_seconds": 30
    }
    ```

#### `submitAnswer`
Records user input, calculates correct/incorrect, updates latent CEFR tier (+1 / -1 difficulty level), and prepares the next stage.
*   **Parameters:** 
    ```typescript
    { 
      attemptId: string; 
      questionId: string; 
      selectedAnswer: string; 
      timeTakenSeconds: number;
    }
    ```
*   **Returns:** `{ isCorrect: boolean; nextDifficultyLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' }`

---

### 2.2 AI Scoring Actions

#### `evaluateWritingPrompt`
Triggers Gemini scoring evaluation of a written essay.
*   **Parameters:** `{ attemptId: string; promptId: string; essayText: string }`
*   **Returns:**
    ```json
    {
      "grammar_score": 85,
      "vocabulary_score": 78,
      "coherence_score": 82,
      "fluency_score": 80,
      "overall_score": 81,
      "cefr_level": "B2",
      "feedback": {
        "strengths": ["Clear essay structure", "Good usage of connectors"],
        "weaknesses": ["Minor spelling errors", "Limited vocabulary range"],
        "general": "The essay displays a strong upper-intermediate level..."
      }
    }
    ```

#### `evaluateSpeakingPrompt`
Triggers the multi-modal audio processing pipeline on the recorded audio upload.
*   **Parameters:** `{ attemptId: string; promptId: string; audioUrl: string }`
*   **Returns:**
    ```json
    {
      "pronunciation_score": 75,
      "grammar_score": 80,
      "fluency_score": 70,
      "vocabulary_score": 82,
      "overall_score": 77,
      "cefr_level": "B2",
      "feedback": {
        "prosody": "Slight monotone rhythm. Work on sentence-level stresses.",
        "general": "Good vocabulary articulation but needs more grammatical range."
      }
    }
    ```

---

## 3. Public REST Endpoints

### 3.1 Verification & Sharing

#### `GET /api/v1/verify/[certificateCode]`
A public query endpoint to verify certificate authenticity.
*   **Query Parameters:** None
*   **Response Code:** `200 OK` (Valid) or `404 Not Found` (Invalid/Forged)
*   **Payload:**
    ```json
    {
      "valid": true,
      "certificate_code": "LC-883921",
      "recipient_name": "Jane Doe",
      "issued_at": "2026-06-06T12:00:00Z",
      "cefr_level": "C1",
      "overall_score": 88
    }
    ```

---

## 4. Supabase Storage Policies (Media Uploads)

*   **Bucket:** `listening-audio`
    *   **Uploads:** Admins only.
    *   **Downloads:** Authenticated users.
*   **Bucket:** `speaking-responses`
    *   **Uploads:** Authenticated users (`/speaking-responses/attempts/[attemptId]/`).
    *   **Downloads:** Private / Service role only (AI parser accessed via signed private URLs to preserve student privacy).
