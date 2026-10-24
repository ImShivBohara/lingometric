# ARCHITECTURE.md
# LinguaCert AI — System Architecture Document
> **Status:** Approved Draft v1.0  |  **Author:** Senior Staff Engineer

---

## 1. System Overview

**LinguaCert AI** is a production-grade, AI-powered English proficiency testing platform designed to evaluate reading, listening, writing, and speaking competencies. The system maps test scores directly to the Common European Framework of Reference for Languages (CEFR) standard (A1–C2). 

It is built as a cloud-native, modern web application utilizing a serverless frontend + backend-as-a-service (BaaS) architecture designed for high scalability, near-instant responsiveness, and sub-200ms user interaction latency.

---

## 2. Technical Stack & Core Component Diagram

The platform utilizes a modern, serverless-first tech stack optimized for performance, developer velocity, and maintenance simplicity.

```
                  ┌──────────────────────────────┐
                  │      Client Tier (Web)       │
                  │   Next.js 15 · React 19      │
                  │   TailwindCSS · shadcn/ui    │
                  └──────────────┬───────────────┘
                                 │
                 HTTPS / WSS / Server Actions
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
┌────▼─────────────────┐   ┌─────▼────────────────┐   ┌──────▼───────────────┐
│    Supabase Auth     │   │ Supabase Postgres DB │   │   Supabase Storage   │
│ Identity & Sessions  │   │  JSONB Schema & RLS  │   │   Audio Assets (MP3) │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
                                 ▲
                                 │ Serverless Actions
                                 │ / Edge Functions
                       ┌─────────┴─────────┐
                       │  Gemini AI Core   │
                       │ Google AI SDK v1  │
                       └───────────────────┘
```

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | **Next.js 15 (App Router) & React 19** | Strict Server Components by default, optimized SSR for Landing Pages, and Next.js Server Actions for secure backend logic. |
| **Backend-as-a-Service** | **Supabase** | Simplifies infrastructure management by consolidating PostgreSQL database, Auth, Realtime APIs, and Storage buckets into a unified, secure layer. |
| **Primary Database** | **PostgreSQL (Supabase)** | Robust relational support, native UUID handling, JSONB compatibility for custom metadata storage, and strong ACID guarantees. |
| **AI Assessment Engine** | **Google Gemini (1.5 Flash / Pro)** | Gemini 1.5 features natively large context windows and direct multimodal processing (text, audio inputs) which bypasses separate speech-to-text pipeline latency. |
| **Storage Engine** | **Supabase Storage** | Integrated object storage for static assets, listening section mp3s, speaking voice recording blobs, and signed certificate PDFs. |
| **State Management** | **Zustand** | Ultra-lightweight, atomic, and reactive state stores for the test-taking engine, preventing re-render bottlenecks. |

---

## 3. Core Architectural Modules

### 3.1 Adaptive Testing Engine (CAT)
To minimize test duration while maintaining psychometric evaluation accuracy, the system uses a **multistage Computerized Adaptive Testing (CAT)** logic.
*   **Difficulty Shifts:** The assessment starts at a baseline of **B1**. A correct response increments the difficulty level (+1 CEFR tier), whereas an incorrect response decrements the difficulty level (-1 CEFR tier).
*   **State Control:** Run entirely within the user session state on the client side, validated by Next.js Server Actions on answer submission to prevent client manipulation.
*   **Cold Start:** New users without historical attempts begin at difficulty B1. Subsequent tests start at their last recorded average CEFR level minus one tier.

### 3.2 Multimodal AI Evaluation Pipeline
Evaluating open-ended submissions (Writing & Speaking) requires high-fidelity parsing:
```
[Writing Output] ──► Text Payload ──► Gemini API (Central Prompt) ──► CEFR Rubric JSON Output
[Speaking Output] ─► Audio Blob ───► Supabase Storage ────────────► Gemini Multimodal ──► CEFR Rubric JSON Output
```
1.  **Writing Engine:** Captures text payload from the client-side editor. Submits to a dedicated Next.js Server Action which calls Gemini with structured JSON formatting rules.
2.  **Speaking Engine:** Captures microphone input (PCM/WAV) via Web Audio API, uploads it to a secure Supabase storage bucket (`speaking-uploads/[userId]/[attemptId]/`), and sends the public storage URL or base64 stream to the Gemini Multimodal model for transcription, pronunciation analysis, and fluency metrics.

### 3.3 Secure Certificate Generation
Upon test completion, a cryptographically verifiable certificate is issued:
*   **Compilation:** Generated on-demand via `@react-pdf/renderer` or serverless HTML-to-PDF runtimes.
*   **Verification:** Implements a public verification path: `/verify/[certificateCode]`.
*   **Security:** Cryptographic verification hash generated by hashing the unique combinations of `attempt_id`, `user_id`, and a system-wide secret key.

---

## 4. System Security & Access Controls

### 4.1 Row Level Security (RLS)
The database enforces strict multitenancy at the database level. Direct API queries from the client will *only* return data that belongs to the authenticated user.
*   **Attempts & Responses:** Write access only enabled if `user_id == auth.uid()`.
*   **Certificates:** Universally read-accessible to support verification sharing; write-accessible only to database service roles.

### 4.2 Auth Flow
Uses Supabase Auth supporting standard Email/Password credentials and Google OAuth. Access tokens (JWT) are stored securely in HTTP-only cookies to eliminate Cross-Site Scripting (XSS) risks.

### 4.3 Prompt Protection & Centralization
Prompts are isolated entirely on the server. They are never exposed to client-side bundles. They are loaded dynamically from `AI_PROMPTS.md` or a dedicated system configuration file to allow updates without redeploying the core client.
