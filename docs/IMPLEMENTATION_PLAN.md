# IMPLEMENTATION_PLAN.md
# LinguaCert AI — Engineering Implementation Roadmap
> **Status:** Active Roadmap  |  **Author:** Senior Staff Engineer

---

## 1. Phased Roadmap Execution

The implementation is broken down into structured, linear execution blocks. Each phase serves as a gate; linting, typechecking, and regression testing must pass before transitioning to the next phase.

```
┌────────────────────────────────┐
│   Phase 1: Foundation & Auth   │ Next.js 15 config, Supabase setup, schemas (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│  Phase 2: Core Testing Module  │ Reading & Listening student UI, player (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│   Phase 3: AI Scoring Engine   │ Gemini multimodal inputs integration (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│  Phase 4: Certificates & Reports│ Verification page, React PDF compilation (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│ Phase 5: Telemetry & Hardening │ RLS audits, error trackers, monitoring (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│   Phase 6: Adaptive Engine     │ Dynamic difficulty logic & tracking (COMPLETE)
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│  Phase 7: Admin Panel Suite    │ Authentication, CRUD managers, assignments
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│   Phase 8: Advanced Analytics  │ Attempt Inspector, reporting enhancements
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│  Phase 9: UI/UX Redesign Pass  │ Consolidated styling and design pass
└────────────────────────────────┘
```

---

## 2. Phase-by-Phase Deliverables

### Phase 7: Administrative Suite & Analytics

This phase introduces administrative capabilities for management of all assessment content (Listening, Reading, Writing, Speaking) and test-specific assignments, leading into student progress tracking.

#### Completed Steps
*   [x] **Phase 7 Step 1 - Admin Shell & Authentication**: Admin route protection, `requireAdmin()` guard, sidebar layout, dynamic count statistics.
*   [x] **Phase 7 Step 2 - Listening Content Manager**: Dynamic Listening Passage and question/option CRUD, public bucket MP3 file upload interface.
*   [x] **Phase 7 Step 2.5 - Listening Test Assignments**: Linking passages to specific tests, display order reordering, activation/deactivation controls, validation of unique display orders.
*   [x] **Phase 7 Step 3 - Writing Prompt Manager**: Writing prompts database schema updates (`is_active` constraints), admin prompt library CRUD, active prompt toggling.
*   [x] **Phase 7 Step 4 - Reading Question Manager**: Multi-step Reading Comprehension question bank management, passage details, option choices.
*   [x] **Phase 7 Step 4.5 - Reading Test Assignments**: Dynamic assignment list for Reading Comprehension passages, reordering, activation flags, display order uniqueness validations.
*   [x] **Phase 7 Step 5 - Speaking Prompt Manager**: Speaking prompts database migration segment (`is_active` constraint), admin prompt library CRUD, active prompt deactivation rules.

#### Current Step
*   ➡️ **Phase 7 Step 6 - Student Progress & Analytics**: Implement `/admin/progress` student list interface and `/admin/progress/[studentId]` detailed analytics panel showing CEFR progression, skill breakdowns, and attempt history.

---

## 3. Planned Next Phase
*   ➡️ **Analytics Enhancements / Attempt Inspector**: Allow detailed inspection of student attempts (reading/listening answers, writing/speaking responses) and Gemini evaluations, as well as admin reporting features.

---

## 4. Planned Future Phase
*   ➡️ **Full UI/UX Redesign Phase**: A single consolidated pass to redesign all UI/UX modules, themes, and visual elements.
    
    > [!IMPORTANT]
    > The UI redesign pass must occur **AFTER** the following features are complete:
    > * Student Progress Dashboard
    > * Analytics Dashboard
    > * Attempt Inspector
    > * Admin reporting features
    >
    > **Reason**: We want feature completion first, then a single consolidated UI redesign pass, instead of redesigning screens that will still change.
