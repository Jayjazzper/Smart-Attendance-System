-- 🏫 SQL Script to create tables in Supabase SQL Editor for Smart Attendance System
-- Copy this entire code, paste it in Supabase -> SQL Editor -> New Query, and click "Run".

-- 1. Create students table
create table if not exists public.students (
  id text primary key,
  name text not null,
  email text,
  "faceDescriptor" jsonb, -- Stores face descriptors (number[] or number[][])
  "consentGiven" boolean default true,
  "registeredAt" text,
  classroom text,
  level text,
  "parentLineId" text,
  "avatarUrl" text,
  "bloodGroup" text,
  "emergencyPhone" text,
  "medicalAlert" text
);

-- 2. Create attendance table
create table if not exists public.attendance (
  id text primary key,
  "studentId" text,
  "studentName" text,
  "studentEmail" text,
  confidence numeric,
  timestamp text,
  classroom text,
  status text,
  temperature numeric,
  "healthStatus" text
);

-- 3. Create leaves table
create table if not exists public.leaves (
  id text primary key,
  "studentId" text,
  "studentName" text,
  classroom text,
  "startDate" text,
  "endDate" text,
  type text,
  reason text,
  status text default 'pending',
  "submittedAt" text,
  "contactEmail" text,
  "contactLine" text,
  "contactPhone" text,
  "evidenceUrl" text
);

-- 4. Create settings table
create table if not exists public.settings (
  key text primary key,
  value jsonb
);

-- Enable full read/write access to these tables (bypassing row-level security for initial simple backend integration)
alter table public.students disable row level security;
alter table public.attendance disable row level security;
alter table public.leaves disable row level security;
alter table public.settings disable row level security;
