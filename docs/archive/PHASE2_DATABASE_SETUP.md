# PHASE2_DATABASE_SETUP.md
# LinguaCert AI — Database Setup & Synchronization Guide
> **Status:** Released v1.0  |  **Author:** Senior Staff Engineer

---

## 1. Overview

This document provides step-by-step instructions for initializing the LinguaCert AI database on Supabase, applying migrations, setting up hooks, and seeding baseline test structures.

---

## 2. Directory Mappings

- **Migration Scripts:** `/supabase/migrations/20260606000000_init_schema.sql`
- **SQL Seed Data:** `/supabase/seeds.sql`
- **TypeScript Mappings:** `/src/types/database.types.ts`
- **API Queries:** `/src/lib/supabase/queries.ts`

---

## 3. Database Sync & Triggers

To automate profile creation, a PostgreSQL function and trigger are set up on the `auth.users` schema.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url, role, current_cefr_level)
    VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        new.raw_user_meta_data->>'avatar_url',
        coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
        'B1'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

When a student registers via Supabase auth (Google OAuth or Email signup), their metadata is replicated immediately to `public.users`.

---

## 4. Setup Execution Steps

### Step 1: Run SQL Migrations
1. Open your Supabase Project Dashboard.
2. Go to **SQL Editor**.
3. Create a **New Query**.
4. Copy the complete content of `/supabase/migrations/20260606000000_init_schema.sql` and run it. This will initialize the enums, build the 13 tables, install the auth sync trigger, enable RLS, and configure security policies.

### Step 2: Seed Assessment Metadata
1. Create a second query inside the **SQL Editor**.
2. Copy the content of `/supabase/seeds.sql` and run it. This creates the baseline **Standard Adaptive English Level Test** and maps its sections (Reading, Listening, Writing, Speaking).

---

## 5. Storage Buckets Strategy

Two distinct storage structures must be configured inside the Supabase Storage panel:

| Bucket Name | Access Level | Policy Constraints | Purpose |
|---|---|---|---|
| `listening-audio` | Public | Read allows all users. Insert/Update limited to Admins. | Hosts MP3 listening comprehension media files. |
| `speaking-responses` | Private | Select restricted to authenticated owners (`/attempts/[attemptId]`). Insert allowed for authenticated users. | Stores recorded wav/mp3 speaking evaluation blobs. |

To create them in Supabase Storage:
1. Go to **Storage** in the Supabase Sidebar.
2. Click **New Bucket**. Name it `listening-audio` and set it to **Public**.
3. Click **New Bucket**. Name it `speaking-responses` and set it to **Private**.
