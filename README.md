# LingoMetric

> **Know Your English Level** — An AI-powered diagnostic English proficiency assessment platform aligned with the Common European Framework of Reference for Languages (CEFR).

---

## 📌 Overview

**LingoMetric** is a modern, full-stack diagnostic language assessment application built with **Next.js 16 (App Router)**, **TypeScript**, **Supabase (PostgreSQL)**, and **Google Gemini AI**. 

The platform evaluates English language proficiency across the four foundational skills:
- **Reading**
- **Listening**
- **Writing**
- **Speaking**

LingoMetric emphasizes **grading integrity**, **transparent psychometric scoring**, and **strict zero-trust security**. It distinguishes raw assessment accuracy from overall language capability, providing provisional diagnostic CEFR ratings rather than unvalidated claims of formal certification.

---

## 🎯 The Four Assessment Workflows

### 1. Reading Assessment
- **Content Structure:** Evaluates vocabulary depth, grammar, sentence completion, and passage comprehension.
- **Delivery:** Interactive question navigator with question-level timers and progress indicators.
- **Scoring & Security:** All answers are verified server-side against canonical database answer keys in PostgreSQL. Scoring uses the total assigned question count as the denominator to prevent partial-submission score exploits.
- **Provisional CEFR:** Calibrated to the difficulty range of the assessed items (A2–B2 ceiling for short diagnostic modules).

### 2. Listening Assessment
- **Content Structure:** Lecture and conversational audio scenarios with passage-level playback controls and comprehension multiple-choice questions.
- **Audio Delivery:** Streams high-fidelity audio assets with interactive playback status and wave animation indicators.
- **Scoring & Security:** Final scores and provisional ratings are computed via trusted atomic database RPC functions (`submit_listening_attempt`), re-verifying answer accuracy in PostgreSQL.
- **Provisional CEFR:** Evaluates standard comprehension aligned with the passage baseline tier (B1 indicative).

### 3. Writing Assessment
- **Content Structure:** Timed open-ended essay interface responding to structured diagnostic writing prompts with minimum and maximum word counts.
- **Live Guidance:** Real-time word count monitoring, countdown timer, and auto-save capabilities.
- **AI Evaluation:** Powered by Google Gemini structured JSON generation. The system evaluates four distinct criteria (0–100 scale):
  1. *Grammatical Accuracy*
  2. *Lexical Range & Vocabulary*
  3. *Coherence & Structural Cohesion*
  4. *Syntactic Fluency*
- **Integrity Guard:** Evaluated through a server-only service-role client (`submit_writing_evaluation` RPC) to prevent client-side score forgery. Includes strict score inflation prevention rules and anti-inflation caps for conversational essays.

### 4. Speaking Assessment
- **Content Structure:** Audio prompt response recorded directly in the browser via standard HTML5 `MediaRecorder` API.
- **Audio Pipeline:** Captures speech in WebM/WAV format, uploads directly to a private Supabase Storage bucket (`speaking-audio`), and passes raw audio buffers to Gemini's native multimodal audio understanding model.
- **AI Evaluation:** The multimodal model transcribes the spoken speech and scores:
  1. *Pronunciation & Phonological Clarity*
  2. *Spoken Fluency & Speech Cadence*
  3. *Grammatical Control*
  4. *Vocabulary Appropriateness*
- **Feedback & Review:** Returns full transcription, key strengths, pronunciation notes, actionable recommendations, and private 1-hour signed playback URLs for student self-review.

---

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) |
| **Language & Runtime** | TypeScript 5 (Strict Mode), Node.js v20+ |
| **Database & Auth** | Supabase (PostgreSQL 15+, Row-Level Security, PL/pgSQL Stored Procedures) |
| **Authentication** | Supabase Auth (`@supabase/ssr` cookie-based SSR session management) |
| **Storage** | Supabase Storage (`speaking-audio` private bucket, `listening-audio` public bucket) |
| **AI Assessment** | Google Gemini API (`@google/genai` multimodal audio & structured JSON) |
| **Styling & UI** | Tailwind CSS 4, shadcn/ui, Lucide Icons, Sonner (toasts) |
| **State & Forms** | Zustand, React Hook Form, Zod validation |
| **Testing** | Node.js native test runner (`node:test`, `tsx`) |

*(Note: This project does not use Express or MongoDB; it leverages Next.js Server Actions and Supabase PostgreSQL.)*

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later
- **Supabase Account**: Project on [supabase.com](https://supabase.com)
- **Google AI Studio API Key**: For Gemini models at [aistudio.google.com](https://aistudio.google.com/)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd linguacert-ai-main
npm install
```

### 2. Environment Configuration

Copy the template file to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the following variable names in `.env.local` (never commit real values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Service Role Secret Key (Server-side ONLY)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

> [!IMPORTANT]
> `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_`. It is exclusively utilized on the server in isolated trusted contexts.

---

## 🗄 Supabase Schema & Storage Setup

### Database Migrations

Apply the migration files located in `supabase/migrations/` in sequential timestamp order:

1. `20260606000000_init_schema.sql` — Base tables (`users`, `tests`, `sections`, `questions`, `attempts`, `responses`).
2. `20260606010000_seed_reading_questions.sql` — Reading question bank items.
3. `20260606020000_seed_writing_prompts.sql` — Diagnostic writing prompts.
4. `20260606030000_listening_schema.sql` — Listening passages and question schema.
5. `20260607000000_seed_speaking_prompts.sql` — Oral speaking prompts.
6. `20260607010000_test_listening_passages.sql` — Listening junction assignments.
7. `20260607020000_writing_prompts_active.sql` — Active status flags on writing prompts.
8. `20260607030000_add_question_category.sql` — Category taxonomy for reading items.
9. `20260607040000_test_reading_questions.sql` — Reading test-to-question junction.
10. `20260607050000_speaking_prompts_active.sql` — Active status flags on speaking prompts.
11. `20260607060000_admin_progress_rls.sql` — Admin RLS read policies for student analytics.
12. `20260607070000_admin_attempts_rls.sql` — Admin RLS read policies for test attempts.
13. `20260608010000_attempt_assessment_identity.sql` — Explicit `assessment_type` enum on attempts.
14. `20260608020000_attempt_security_and_constraints.sql` — Trusted RPC submission functions, RLS tightening, and anti-forgery guards.
15. `20260608030000_provisional_cefr_calibration.sql` — Calibrated provisional CEFR mapping for short screening modules.

### Supabase Storage Buckets

Configure two storage buckets in the Supabase Dashboard:

1. **`listening-audio`** (Public):
   - Stores listening passage MP3 audio files.
   - Public read access enabled.
2. **`speaking-audio`** (Private):
   - Stores uploaded student microphone recordings (`userId/attemptId.webm`).
   - Private bucket with RLS: Users can insert and read only their own recordings.
   - Student results pages generate temporary (1-hour expiry) signed URLs for private audio playback.

---

## 🤖 AI Integration Architecture

AI evaluation is performed using Google's `@google/genai` SDK:

- **Model Hierarchy & Fallback Chain:**
  1. `gemini-2.5-flash` (Primary default)
  2. `gemini-flash-latest` (First fallback)
  3. `gemini-2.0-flash` (Second fallback)
- **Resilience:** Automatic exponential backoff retries (delays: 2s, 5s, 10s) protect against transient rate-limits.
- **Multimodal Speech Processing:** Raw audio base64 buffers are sent directly to the model for native acoustic understanding, avoiding the loss of prosodic and phonological information that occurs with separate speech-to-text pipelines.
- **Structured Schemas:** All evaluations enforce strict JSON Schema specifications returning deterministic score fields, transcripts, and structured feedback arrays.

---

## 🔒 Security, Authentication & Privacy

- **Cookie-based Session Authentication:** Implemented via `@supabase/ssr` across middleware, server components, and server actions.
- **Zero-Trust Row-Level Security (RLS):** Enabled on all tables. Students can only insert and update responses on attempts they own that remain in `IN_PROGRESS` status.
- **Service-Role Isolation:** High-privilege database operations (such as saving writing and speaking evaluations) are strictly executed through `createServiceRoleClient()`, requiring verified server environment variables.
- **Anti-Tampering Trigger:** Database triggers prevent client overrides on `attempts.status`, `final_score`, `cefr_level`, and `submitted_at`.
- **Private Audio Retention:** Speaking recordings are stored privately and accessible only by the creator via time-limited signed URLs.

---

## 📊 Grading Methodology & Provisional CEFR Calibration

### Canonical CEFR Order
LingoMetric strictly follows the standard European framework progression:
$$\text{A1 (Beginner)} \rightarrow \text{A2} \rightarrow \text{B1} \rightarrow \text{B2} \rightarrow \text{C1} \rightarrow \text{C2 (Mastery)}$$

### Distinguishing Raw Accuracy from Language Proficiency
A 100% score on a short diagnostic test (e.g. 5 Reading questions or 3 Listening questions) represents **100% accuracy on the assessed items**, but **does not constitute C2 English mastery**.

To ensure academic and psychometric honesty:
1. **Accurate Raw Scoring:** Denominator accuracy is strictly preserved (e.g., 5/5 = 100% assessment accuracy).
2. **Provisional Indicative Tiers:**
   - **Reading Module (A2–B2 content):**
     - $0\% - 20\% \rightarrow \text{A1}$
     - $21\% - 45\% \rightarrow \text{A2}$
     - $46\% - 75\% \rightarrow \text{B1}$
     - $76\% - 100\% \rightarrow \text{B2}$ (indicative ceiling for the 5-item diagnostic screener)
   - **Listening Module (B1 passage):**
     - $0\% - 33\% \rightarrow \text{A1}$
     - $34\% - 66\% \rightarrow \text{A2}$
     - $67\% - 100\% \rightarrow \text{B1}$ (matches passage baseline)
3. **No Unsubstantiated Certificate Claims:** Results are transparently labeled as **provisional diagnostic ratings**. Formal C1/C2 accreditation requires multi-hour standardized examinations across academic and technical registers.

---

## 🧪 Testing & Verification

Run the full verification suite locally:

```bash
# 1. ESLint verification
npm run lint

# 2. Phase 1 & Security Test Suite
npx tsx --test tests/phase1.test.ts

# 3. Phase 2 Grading & Identity Test Suite
npx tsx --test tests/phase2.test.ts

# 4. Production Build Verification
npm run build
```

---

## 🌐 Deployment Readiness (Vercel)

The application is pre-configured for Vercel deployment:
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Required Environment Variables in Vercel Dashboard:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

*(Note: Per safety requirements, remote deployment has not been executed; review and configure environment variables in your Vercel project when ready to deploy.)*

---

## 📄 License

This project is licensed under the MIT License for educational and institutional evaluation purposes.
