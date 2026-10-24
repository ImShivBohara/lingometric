# RISK_ANALYSIS.md
# LinguaCert AI — Risk Analysis & Mitigation Matrix
> **Status:** Approved Draft v1.0  |  **Author:** Senior Staff Engineer

---

## 1. Overview

Deploying an automated language assessment engine involves structural risks ranging from grading consistency (AI alignment) to security vulnerabilities (cheating, data leaks) and infrastructure cost constraints. This document details our primary system risks and engineering mitigations.

---

## 2. Risk Matrix

| Risk Domain | Risk Event | Severity | Probability | Mitigation Strategy |
|---|---|---|---|---|
| **AI Evaluation** | Score Inflation or Hallucination (Generative Drift) | High | Medium | 1. **Few-Shot Calibration:** Feed Gemini prompts 3 validated B2 and C1 human-scored essays as benchmarks.<br>2. **Strict JSON Schema Constraints:** Force output parsing using model options structured objects (Pydantic / Zod equivalents).<br>3. **Regression Audits:** Run daily automated scoring checks against 50 fixed "Golden Set" answers. Trigger alerts if variance > 5%. |
| **Speaking Pipeline** | Network dropouts during audio recording upload | Medium | High | 1. **Local WAV Compression:** Downsample audio client-side to 16 kHz Mono to minimize file size (~192 KB for 60s).<br>2. **Auto-resuming Uploads:** Configure Supabase Storage chunked uploads.<br>3. **Local Cache Fallback:** Cache audio raw PCM data in IndexedDB temporarily until confirmation receipt is issued. |
| **System Security** | Cheat vulnerabilities (Answers injection, level spoofing) | High | Medium | 1. **Server-Side Validation:** Client-side only displays current question context. Correct option values and scoring calculations reside entirely inside Server Actions.<br>2. **Browser Boundaries:** Track visibility change events (tab switching) and lock the session after 3 strikes.<br>3. **Anomaly Check:** Flag attempts showing response times < 2s for complex readings. |
| **API Costs & Limits**| Gemini API Rate Limits & unexpected invoice spikes | Medium | Medium | 1. **Debouncing & Limits:** Restrict evaluation queries to post-submit events (no real-time scoring runs while typing).<br>2. **Response Cache:** Cache identical static queries.<br>3. **Fallback Engine:** Setup cost controls and switch to smaller model targets (`Gemini 1.5 Flash`) for baseline evaluations, reserving `Pro` for complex multi-dimensional scoring. |
| **Database Security**| Data leakage between users (RLS failure) | Critical| Low | 1. **Database Schema Isolation:** Maintain strict foreign key checks on `user_id` mapped back to auth tables.<br>2. **Unit Tests:** Implement regression tests using dummy client tokens, asserting `403 Forbidden` response when query scopes overlap. |
| **Verification Fraud**| Forgery of downloadable certificates | High | Low | 1. **Verification Keys:** Generate verification hashes via HMAC keys utilizing UUID identifiers.<br>2. **ReadOnly Storage:** Save PDFs to read-only Supabase storage buckets accessed through secure public verification pages. |
