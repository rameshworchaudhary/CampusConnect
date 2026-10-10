# CampusConnect

CampusConnect is a full-stack college club management platform. It provides
public club discovery, student membership and event workflows, club-admin
operations, super-admin management, CMS content, audit logs, and secure
email-verification and password-reset flows.

## Architecture

The repository has one deployable React/Vite frontend at the repository root
and one Spring Boot API:

```text
.
├── src/                 # Unified React/Vite frontend
│   ├── api/client.ts    # Central Axios client and JWT handling
│   ├── components/
│   ├── context/
│   ├── pages/
│   └── types/
├── backend/             # Spring Boot REST API
├── database/schema.sql  # Existing MySQL schema
├── index.html
├── package.json
├── vite.config.ts
└── .env.example         # Safe placeholder template
```

The older duplicate `frontend/` implementation and the in-memory mock API are
not part of the final architecture. All application data and authorization
come from the Spring Boot backend and MySQL.

## Prerequisites

- Java 17+
- Maven 3.8+
- Node.js 18+ and npm 9+
- MySQL 8+

## Configuration

Create the database if necessary:

```sql
CREATE DATABASE IF NOT EXISTS campusconnect
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `backend/.env` and set local values. At minimum,
configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`,
`MAIL_USERNAME`, and `MAIL_PASSWORD`. The backend also supports
`FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `MAIL_FROM`, and the admin bootstrap
settings shown in `.env.example`.

The frontend defaults to `http://localhost:8080/api`. To use a different
public backend URL, create a root `.env.local`:

```properties
VITE_API_BASE_URL=http://localhost:8080/api
```

Never place database credentials, SMTP credentials, JWT secrets, or tokens in
frontend environment variables.

## Run locally

Start the backend:

```powershell
Set-Location .\backend
mvn spring-boot:run
```

Start the frontend in a second terminal from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The root command `npm run dev:api` is a
convenience alternative for starting the backend from the repository root.

## Authentication and authorization

Public registration always creates a `STUDENT` account. New accounts must
verify their email before login. Password reset links are single-use and
time-limited. The backend enforces JWT authentication, the roles
`STUDENT`, `CLUB_ADMIN`, and `SUPER_ADMIN`, and club ownership restrictions;
frontend navigation does not replace server-side authorization.

## Verification

Run the production frontend build:

```powershell
npm run build
```

Run backend tests and package checks:

```powershell
Set-Location .\backend
mvn test
mvn package
```

The frontend uses the actual backend endpoints for clubs, memberships, events,
announcements, CMS, users, statistics, and audit logs. Empty database tables
produce zero counts and empty states rather than fabricated records.

## Security notes

- Do not commit `.env`, `backend/.env`, credentials, tokens, or generated
  build/dependency directories.
- Keep `.env.example` limited to placeholders.
- Do not use destructive database commands against an existing installation.
