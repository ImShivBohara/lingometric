# LingoMetric

> **Know Your English Level** — An AI-powered diagnostic English proficiency assessment platform aligned with the Common European Framework of Reference for Languages (CEFR).

[![Live Application](https://img.shields.io/badge/Live%20Deployment-Vercel-black?logo=vercel)](https://lingometric.vercel.app)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2016-black?logo=next.js)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-Supabase%20(PostgreSQL)-3ECF8E?logo=supabase)](https://supabase.com/)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Google%20Gemini-4285F4?logo=google)](https://aistudio.google.com/)

---

## 🌐 Live Deployment

LingoMetric is deployed and operational on Vercel:

- **Production URL:** [https://lingometric.vercel.app](https://lingometric.vercel.app)
- **Deployment Platform:** Vercel (Edge Network, Node.js 20.x runtime)
- **CI/CD:** Automated production deployments from repository master branch

---

## 🎬 Project Demo Video

Watch the complete **3-minute demonstration** of LingoMetric:

**[▶ Watch LingoMetric Project Demo](https://drive.google.com/file/d/1D9KZfjeS6iKxRn_I_sT3ZD7YOxHa3JuY/view?usp=sharing)**

The demonstration covers user authentication, the student dashboard, the unified Reading, Listening, Writing, and Speaking assessments, Google Gemini-powered AI feedback, combined results, and assessment history.

## 📌 Overview

**LingoMetric** is a full-stack diagnostic language assessment application built with **Next.js 16 (App Router)**, **TypeScript**, **Supabase (PostgreSQL 15+)**, and **Google Gemini AI**.

The platform evaluates English language proficiency across the four foundational skills:
- **Reading**
- **Listening**
- **Writing**
- **Speaking**

LingoMetric emphasizes **grading integrity**, **transparent psychometric scoring**, and **zero-trust database security**. It distinguishes raw assessment accuracy from overall language capability, providing provisional diagnostic CEFR ratings rather than unvalidated claims of formal certification.

---

## 🎯 The Four Assessment Workflows

### 1. Reading Assessment
- **Content Structure:** Evaluates vocabulary depth, grammar, sentence completion, and passage comprehension.
- **Delivery:** Interactive question navigator with question-level timers and progress indicators.
- **Scoring & Integrity:** Answer keys (`correct_answer`, `explanation`) are strictly removed from student-facing server component props before delivery. Scores are calculated server-side in PostgreSQL using atomic `SECURITY DEFINER` stored procedures (`submit_reading_attempt`). The scoring denominator represents all required questions to prevent partial-submission score exploits.
- **Provisional CEFR:** Calibrated to the difficulty range of the assessed items (A2–B2 ceiling for short diagnostic modules).

### 2. Listening Assessment
- **Content Structure:** Lecture and conversational audio scenarios with passage-level playback controls and comprehension multiple-choice questions.
- **Audio Delivery:** Streams high-fidelity audio assets with interactive playback status and wave animation indicators. Seeking/rewinding is restricted to preserve diagnostic test conditions.
- **Scoring & Integrity:** Answer keys and transcripts are stripped from student-facing server-component payloads. Final scores and provisional ratings are computed via trusted atomic database RPC functions (`submit_listening_attempt`), re-verifying answer accuracy in PostgreSQL.
- **Provisional CEFR:** Evaluates standard comprehension aligned with the passage baseline tier (B1 indicative).

### 3. Writing Assessment
- **Content Structure:** Timed open-ended essay interface responding to structured diagnostic writing prompts with minimum and maximum word counts.
- **Live Guidance:** Real-time word count monitoring, countdown timer, and auto-save capabilities.
- **Server-Side Validation:** Server actions strictly enforce prompt-specific minimum and maximum word counts before invoking the AI, returning friendly validation messages for invalid attempts and protecting against unnecessary API consumption.
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

## Full English Proficiency Assessment

LingoMetric allows users to complete all four English language skills in one integrated assessment session.

**Assessment flow:** Reading → Listening → Writing → Speaking.

- **Unified Assessment:** Four skill assessments are grouped into one session.
- **Resume Progress:** Users can return to an unfinished assessment without losing their saved progress.
- **Combined Scoring:** Each skill contributes 25% to the final score. The combined score is the average of the four individual scores.
- **Detailed Results:** After completing all four sections, users can view their overall score, individual skill scores, feedback, and indicative CEFR levels.
- **Assessment History:** Completed and unfinished sessions appear in the student dashboard. Previous independent assessment records are preserved.
- **Admin Management:** Authorized administrators can manage assessment content, review student progress, and upload listening audio.

**Note:** CEFR levels are provisional diagnostic estimates, not official language proficiency certifications.

### Architecture

The application uses Next.js for the user interface and server-side actions, Supabase PostgreSQL for persistent assessment data, Supabase Authentication for account management, Supabase Storage for audio files, and Google Gemini for AI-based Writing and Speaking evaluation. The application is deployed on Vercel.

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) |
| **Language & Runtime** | TypeScript 5 (Strict Mode), Node.js v20+ |
| **Database & Auth** | Supabase (PostgreSQL 15+, Row-Level Security, PL/pgSQL Stored Procedures) |
| **Authentication** | Supabase Auth (`@supabase/ssr` cookie-based SSR session management across middleware, server components, and actions) |
| **Storage** | Supabase Storage (`speaking-audio` private bucket, `listening-audio` public bucket) |
| **AI Assessment** | Google Gemini API (`@google/genai` multimodal audio understanding & structured JSON rubrics) |
| **Styling & UI** | Tailwind CSS 4, shadcn/ui, Lucide Icons, Sonner (toasts) |
| **State & Forms** | Zustand, React Hook Form, Zod validation |
| **Testing** | Node.js native test runner (`node:test`, `tsx`) |

> [!NOTE]
> This application is built entirely on the modern Next.js 16 App Router architecture paired with Supabase PostgreSQL and Server Actions. It does not use Express or MongoDB.

---

## 🔒 Security, Privacy & Scoring Integrity

- **Cookie-based Session Authentication:** Implemented via `@supabase/ssr` with HttpOnly cookies across middleware, server components, and server actions.
- **Zero-Trust Row-Level Security (RLS):**
  - `public.users`: Students can view only their own profile (`auth.uid() = id`). Administrators retain legitimate student-progress visibility via non-recursive `public.is_admin()` checks. Unauthenticated users cannot read profiles or student emails.
  - `public.attempts` and responses: Students can only insert and update responses on attempts they own that remain in `IN_PROGRESS` status.
- **CEFR Level Immutability:** Authenticated client updates are restricted strictly to `(full_name, avatar_url)`. Ordinary users cannot modify `current_cefr_level` or `role`. Trusted database scoring functions update CEFR levels atomically via `SECURITY DEFINER`.
- **Scoring Integrity & Props Sanitization:**
  - Student test pages (`/test/[attemptId]` and `/test/[attemptId]/listening`) strip `correct_answer`, `explanation`, and audio `transcript` fields from server component props before rendering the client player.
  - Final scoring is calculated in PostgreSQL by joining responses to canonical question answer keys, strictly ignoring client-supplied scores.
  - The repository's demo questions serve diagnostic assessment purposes; formal high-stakes examination security is not claimed.
- **Service-Role Isolation:** High-privilege database operations (such as saving writing and speaking evaluations) are strictly executed through `createServiceRoleClient()`, requiring verified server environment variables.
- **Private Audio Retention:** Speaking recordings are stored privately in Supabase Storage and accessible only by the owning student via time-limited (1-hour) signed URLs.

---

## 📊 Grading Methodology & Provisional CEFR Calibration

### Canonical CEFR Order
LingoMetric strictly follows the standard European framework progression:
$$\text{A1 (Beginner)} \rightarrow \text{A2} \rightarrow \text{B1} \rightarrow \text{B2} \rightarrow \text{C1} \rightarrow \text{C2 (Mastery)}$$

### Distinguishing Raw Accuracy from Language Proficiency
A 100% score on a short diagnostic module (e.g. 5 Reading questions or 3 Listening questions) represents **100% accuracy on the assessed items**, but **does not constitute C2 English mastery**.

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

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later
- **Supabase Account**: Project on [supabase.com](https://supabase.com)
- **Google AI Studio API Key**: For Gemini models at [aistudio.google.com](https://aistudio.google.com/)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/ImShivBohara/lingometric.git
cd lingometric
npm install
```

### 2. Environment Configuration

Copy the template file to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the following variable names in `.env.local` (never commit real credentials):

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

## 🗄 Fresh Supabase Setup Instructions

Follow these reproducible steps to set up a fresh Supabase project from scratch:

### Step 1: Database Migrations
Execute all SQL migration scripts in `supabase/migrations/` in sequential timestamp order using the Supabase SQL Editor or Supabase CLI:

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
16. `20260608040000_audit_security_fixes.sql` — Non-recursive user profile RLS, CEFR immutability, sanitized props, and PostgREST tightening.
17. `20261025010000_full_assessment_sessions.sql`
    — Links Reading, Listening, Writing, and Speaking into unified assessment sessions.

18. `20261025020000_listening_audio_storage.sql`
    — Configures public listening audio playback and admin upload permissions.

### Step 2: Storage Buckets Configuration
In your Supabase Dashboard, navigate to **Storage** and configure the two required buckets:

1. **`listening-audio`** (Public):
   - Toggle **Public bucket** to `ON`.
   - Upload the sample listening passage audio file located in this repository at:
     `docs/archive/assets/renewable_energy.mp3`
2. **`speaking-audio`** (Private):
   - Leave **Public bucket** `OFF`.
   - Configure RLS policies so authenticated students can upload and read their own audio files (`(storage.foldername(name))[1] = auth.uid()::text`).

### Step 3: Configure Listening Audio URL
Migration 4 (`20260606030000_listening_schema.sql`) seeded a bootstrap reference URL for the sample passage. In your fresh Supabase project, update the audio URL to point to your project's storage bucket:

```sql
UPDATE public.listening_passages
SET audio_url = 'https://<your-project-id>.supabase.co/storage/v1/object/public/listening-audio/renewable_energy.mp3'
WHERE id = 'd4d70c5e-d63c-4384-a327-ee556c77d890';
```

*(Alternatively, log in as an administrator, navigate to `/admin/listening`, click **Edit** on the Renewable Energy passage, and update the **Audio File URL** field directly in the UI.)*

> [!NOTE]
> Current production audio settings in existing deployed environments are preserved automatically.

---

## 🧪 Testing & Verification

Run the comprehensive test and linting suite locally:

```bash
# 1. ESLint verification
npm run lint

# 2. Automated test suite (Phase 1, Phase 2 & Audit Fixes)
npm test

# 3. Next.js production build verification
npm run build
```

---

## 🌐 Production Deployment (Vercel)

LingoMetric is hosted on Vercel. For fresh deployments or environment updates:

1. Connect the GitHub repository `https://github.com/ImShivBohara/lingometric` to Vercel.
2. Ensure the following production environment variables are configured in the **Vercel Dashboard -> Project Settings -> Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (e.g. `gemini-2.5-flash` or `gemini-3.8-flash`)
3. The build pipeline uses the standard Next.js configuration:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build` (`npm run build`)
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

---

## 📄 License & Academic Attribution

This project is submitted as an academic final project for **Term 5 MERN** at **Scaler School of Technology (SST)**.

**Proprietary / Academic Submission** — All rights reserved. Created for educational assessment and evaluation purposes. Not licensed for unauthorized public redistribution.
