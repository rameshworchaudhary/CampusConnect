# CampusConnect

CampusConnect is a campus club and student organization management platform built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Tech Stack & Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Routing**: React Router 7
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Storage)
- **Responsive Design**: Mobile-first, screen-compatible layout for mobile, tablet, and desktop devices

## Project Structure

```text
.
├── public/                 # Static assets and icons
├── src/                    # React application source code
│   ├── components/         # Reusable UI components (Header, BottomNav, Modal, ImageUploader, etc.)
│   ├── context/            # React context providers (AuthContext)
│   ├── lib/                # Supabase client initialization (supabase.ts)
│   ├── pages/              # Application pages and role-based dashboards
│   ├── services/           # Supabase data services (auth, clubs, events, memberships, etc.)
│   ├── types/              # TypeScript interface definitions
│   ├── App.tsx             # Main routing and layout configuration
│   ├── index.css           # Global Tailwind CSS directives and styles
│   └── main.tsx            # Vite React entry point
├── supabase/               # Supabase database schema and migrations
│   └── schema.sql          # PostgreSQL schema, RLS policies, and triggers
├── index.html              # HTML document root
├── package.json            # Project dependencies and npm scripts
├── tailwind.config.js      # Tailwind design system configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
```

Use the Supabase project URL and publishable (or legacy anon) key. Never use a
service-role key in Vite variables. `.env.local` is ignored by Git.

### 3. Supabase setup

The existing schema is in `supabase/schema.sql`. Apply the additive security
migration in `supabase/migrations/202610160001_security_stabilization.sql` to
the existing project using the Supabase SQL Editor or your normal migration
workflow. It does not reset tables or delete records. The app cannot apply SQL
automatically; verify the migration succeeds before deploying.

In Supabase Auth settings, enable the email confirmation behavior you want and
add the local and production app URLs (including `/verify-email` and
`/reset-password`) to the allowed redirect URLs. Configure the same project
URL and publishable key in Vercel's environment settings for Preview and
Production. The existing Vercel SPA rewrite is already present.

New signups receive `STUDENT` from the database trigger. Create the first
Super Admin by registering that operator's account, then promote its profile
from the Supabase SQL Editor using the verified profile UUID. Never expose an
admin key in the browser or grant a role from a client request.

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```
