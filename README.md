# LinguaCert AI

An AI-powered standardized English Proficiency Testing Platform aligned to CEFR levels (A1 to C2).

---

## 🚀 Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env.local` and fill in the credentials:

```bash
cp .env.example .env.local
```

You will need a **Supabase** instance. Set up a new project at [supabase.com](https://supabase.com) and retrieve the URL and Anon keys under Project Settings > API.

---

### 2. Database Schema Initialization

Using the Supabase SQL Editor, run the schema setup from [DATABASE_SCHEMA.md](file:///Users/akshatjain/Documents/tutor/DATABASE_SCHEMA.md) to initialize the base tables:

1. `users` (with default roles)
2. `tests`
3. `sections`
4. `questions`
5. `attempts`
6. `responses`
7. `certificates`

---

### 3. Local Development

First, install the package dependencies:

```bash
npm install
```

To run the development compiler:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the landing page.

---

## 🛠 Project Architecture

This application is built with a feature-based structure to ensure high reliability and encapsulation:

- **Next.js 15 App Router** for Server Components and Server Actions.
- **Supabase Auth & RLS** for identity verification and database security controls.
- **TailwindCSS & shadcn/ui** for high-fidelity dark-themed design.
