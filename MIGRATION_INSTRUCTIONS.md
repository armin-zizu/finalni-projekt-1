# Database Migration Instructions

## Problem
The `users` table exists but is missing required columns: `password_hash`, `role`, `is_owner`, `permissions`, and `updated_at`.

## Solution

You need to run the migration SQL script on your PostgreSQL server. You have two options:

### Option 1: Run via psql command line (Recommended)

Connect to your remote server and run:

```bash
psql -h 46.224.115.49 -U office_user -d office_app -f migrate-users-table.sql
```

You'll be prompted for the password.

### Option 2: Run via database GUI tool

1. Connect to your PostgreSQL database using pgAdmin, DBeaver, or similar tool
2. Open the `migrate-users-table.sql` file
3. Execute the SQL script

### Option 3: Run SQL directly in psql

```bash
psql -h 46.224.115.49 -U office_user -d office_app
```

Then paste and execute the contents of `migrate-users-table.sql`.

## What the migration does

- Adds `password_hash` column for storing hashed passwords
- Adds `role` column for user roles (vlasnik, konobar, etc.)
- Adds `is_owner` boolean column
- Adds `permissions` JSONB column
- Adds `updated_at` timestamp column
- Ensures `email` is NOT NULL
- Adds unique constraint on `email`
- Updates `updated_at` for existing rows

## After Migration

Once you've run the migration, restart your Next.js dev server and try logging in again.

