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
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: JWT (jsonwebtoken + jose)
- **OCR**: OpenAI Vision API (GPT-4o)
- **PDF**: pdf-lib
- **Storage**: Local filesystem (Supabase optional)
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest

## Prerequisites

- Node.js 18+
- PostgreSQL
- OpenAI API key (for OCR features)

## Setup

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
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Secret key for signing JWT tokens |
   | `OPENAI_API_KEY` | OpenAI API key for OCR extraction |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional, use `placeholder` to skip) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (optional) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (optional) |

4. **Set up the database**

   ```bash
   npx prisma db push
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
│   ├── supabase.ts         # File storage
│   └── currency.ts         # Currency formatting
└── middleware.ts           # Route protection
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Database seeding
tests/                      # Test suites
```
