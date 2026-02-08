# Reimbursement App

A full-stack employee reimbursement management system built with Next.js, Prisma, and PostgreSQL. Employees can upload receipts, extract expense data via OCR, and submit reimbursement claims. Admins can review, approve, or reject claims.

## Features

- **Authentication** — JWT-based login with role-based access control (Employee / Admin)
- **OCR Extraction** — Upload receipts (PDF/images) and auto-extract expense data using OpenAI Vision
- **Reimbursement Claims** — Create, submit, and track reimbursement requests
- **Expense Limits** — Per-designation category limits enforced at submission time
- **Admin Dashboard** — View all submissions, approve/reject claims, manage employees and designations
- **PDF Generation** — Download reimbursement claims as formatted PDF documents
- **Multi-Currency** — Support for INR, USD, EUR, GBP

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase Postgres with Prisma ORM
- **Auth**: JWT (jsonwebtoken + jose)
- **OCR**: OpenAI Vision API (GPT-4o)
- **PDF**: pdf-lib
- **Storage**: Supabase Storage (local fallback for development)
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest
- **Hosting**: Vercel

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL (local or Supabase)
- OpenAI API key (for OCR features)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/gayathri-meka/reimbursement-app.git
   cd reimbursement-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your values:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL connection string (pooled for Supabase) |
   | `DIRECT_URL` | Direct PostgreSQL connection (for Prisma migrations) |
   | `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) |
   | `OPENAI_API_KEY` | OpenAI API key for OCR extraction |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

   For local development without Supabase Storage, set the Supabase variables to `placeholder` — file uploads will use the local filesystem.

4. **Set up the database**

   ```bash
   npx prisma migrate deploy
   ```

5. **Seed the database** (creates sample users and designations)

   ```bash
   npm run db:seed
   ```

   Default accounts:
   - Admin: `admin@company.com` / `admin123`
   - Employee: `alice@company.com` / `password123`

6. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx vitest run tests/reimbursement-flow.test.ts
```

Test suites:

| File | Description |
|------|-------------|
| `auth.test.ts` | Password hashing, JWT tokens, cookie helpers |
| `upload.test.ts` | File upload with local storage fallback |
| `ocr.test.ts` | OCR extraction pipeline (requires OPENAI_API_KEY) |
| `pdf.test.ts` | PDF generation and formatting |
| `currency.test.ts` | Currency formatting and defaults |
| `middleware.test.ts` | Route protection and role-based access |
| `reimbursement-flow.test.ts` | Integration tests: creation, approval, rejection, PDF download, end-to-end flow |

## Deployment (Vercel + Supabase)

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)

2. **Database** — Go to **Settings > Database** and copy:
   - **Connection string (Transaction/Session mode)** — use as `DATABASE_URL` (append `?pgbouncer=true` for the transaction mode URL on port 6543)
   - **Connection string (Direct)** — use as `DIRECT_URL` (port 5432)

3. **Storage** — Go to **Storage** and create a bucket:
   - Name: `expense-documents`
   - Public: **Yes** (so uploaded receipt URLs are accessible)
   - File size limit: 10MB

4. **API keys** — Go to **Settings > API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Deploy to Vercel

1. Push your code to GitHub (already done)

2. Go to [vercel.com/new](https://vercel.com/new) and import the `reimbursement-app` repository

3. Add the following **Environment Variables** in Vercel's project settings:

   ```
   DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres
   JWT_SECRET=<generate-a-strong-random-string>
   OPENAI_API_KEY=sk-...
   NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

4. Click **Deploy** — Vercel will run `npm install` (which triggers `prisma generate`) and then `npm run build`

### 3. Run database migrations

After the first deploy, run migrations against your Supabase database:

```bash
# Set your production DATABASE_URL and DIRECT_URL, then:
DATABASE_URL="<your-supabase-pooler-url>" DIRECT_URL="<your-supabase-direct-url>" npx prisma migrate deploy
```

Or from the Vercel project directory with env vars configured:

```bash
npx vercel env pull .env.production.local
npx prisma migrate deploy
```

### 4. Seed the production database (optional)

```bash
DATABASE_URL="<your-supabase-direct-url>" npx tsx prisma/seed.ts
```

This creates the default admin account and sample employees.

### Database Migrations

When you change the Prisma schema:

```bash
# Create a new migration locally
npm run db:migrate:dev -- --name describe_your_change

# Deploy to production
DATABASE_URL="<prod-url>" DIRECT_URL="<prod-direct-url>" npx prisma migrate deploy
```

## Project Structure

```
src/
├── app/
│   ├── api/                # API routes
│   │   ├── auth/           # Login, logout, session
│   │   ├── reimbursements/ # CRUD, approve, reject, PDF
│   │   ├── employees/      # Employee management
│   │   ├── designations/   # Designation management
│   │   ├── limits/         # Expense limit management
│   │   └── documents/      # File upload, OCR
│   ├── admin/              # Admin dashboard pages
│   ├── employee/           # Employee dashboard pages
│   └── login/              # Login page
├── components/             # Reusable React components
├── lib/                    # Business logic & utilities
│   ├── auth.ts             # Authentication helpers
│   ├── ocr.ts              # OpenAI Vision OCR
│   ├── pdf.ts              # PDF generation
│   ├── prisma.ts           # Database client
│   ├── supabase.ts         # File storage (Supabase / local)
│   └── currency.ts         # Currency formatting
└── middleware.ts           # Route protection
prisma/
├── schema.prisma           # Database schema
├── migrations/             # Migration history
└── seed.ts                 # Database seeding
tests/                      # Test suites
```
