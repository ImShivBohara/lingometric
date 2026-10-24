# FOLDER_STRUCTURE.md
# LinguaCert AI — Feature-Based Folder Structure
> **Status:** Approved Draft v1.0  |  **Author:** Senior Staff Engineer

---

## 1. Directory Tree Overview

This project is organized as a unified, feature-based **Next.js 15 Monorepo** layout. Code is structured around core domains (features) to minimize cognitive load, maintain clean modular boundaries, and ensure high testability.

```
tutor/
├── .github/                 # CI/CD Workflows (Lint, Typecheck, Test, Deploy)
├── docs/                    # Centralized Design Package & Technical Spec docs
│   ├── ARCHITECTURE.md
│   ├── FOLDER_STRUCTURE.md
│   ├── API_SPEC.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── RISK_ANALYSIS.md
├── src/
│   ├── app/                 # Next.js App Router (Routes, Layouts, Server Actions)
│   │   ├── (auth)/          # Authentication grouping routes (login, signup)
│   │   ├── (dashboard)/     # Student & Admin dashboard routes
│   │   ├── test/            # Interactive testing screen (fullscreen, adaptive player)
│   │   ├── verify/          # Public certificate verification routes
│   │   ├── api/             # API Router Handlers (Webhook receivers, external endpoints)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/          # Reusable shared presentation elements (UI Kit)
│   │   └── ui/              # shadcn/ui base elements (buttons, inputs, dialogs)
│   ├── features/            # Feature-based domain logic (Self-contained modules)
│   │   ├── auth/            # Auth forms, hooks, Zustand store, action validations
│   │   ├── testing/         # CAT logic, section managers, question renderers
│   │   ├── evaluation/      # Gemini AI integrations, essay and voice scorers
│   │   ├── certificates/    # PDF engines, qr generation, verify forms
│   │   └── analytics/       # Chart components, admin dashboard telemetry
│   ├── hooks/               # Core shared custom hooks (useAudioRecorder, etc.)
│   ├── lib/                 # Core utilities and client instantiations
│   │   ├── supabase/        # Supabase server/client SDK instantiations
│   │   ├── gemini/          # Google Gen AI SDK client configuration
│   │   └── utils.ts         # Utility helper functions
│   ├── types/               # Globally shared TypeScript interfaces
│   │   ├── database.types.ts# Auto-generated Supabase types
│   │   └── index.ts         # Base project interfaces
│   └── styles/              # Global CSS, animations, and Tailwind directives
├── supabase/                # Local Supabase development configuration
│   ├── migrations/          # Version-controlled SQL migration scripts
│   ├── seeds.sql            # Core database seed data (questions, levels)
│   └── config.toml          # Local Supabase emulator config
├── tests/                   # Integration, E2E, and regression test suites
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 2. Anatomy of a Feature Module

To prevent code pollution and enforce SOLID guidelines, code inside `src/features/[feature-name]` must stay self-contained:

```
src/features/testing/
├── components/          # Specific components used ONLY by this feature
│   ├── AdaptivePlayer.tsx
│   ├── ProgressBar.tsx
│   └── AudioController.tsx
├── hooks/               # Feature-specific hooks
│   └── useAdaptiveSession.ts
├── services/            # Server actions or API wrappers for this module
│   ├── submitAnswer.ts
│   └── getNextQuestion.ts
├── store/               # Module state management (Zustand)
│   └── testingStore.ts
└── types.ts             # TypeScript definitions limited to this domain
```

---

## 3. Configuration & Database Files

*   **`supabase/migrations/`**: Every database mutation, schema change, and RLS policy modification must be written inside chronological sql migrations (`yyyyMMddhhmmss_init.sql`).
*   **`src/lib/`**: Used strictly for SDK clients configuration. No business logic belongs here.
