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

## Deploy on Render

This repository is prepared for separate Render services:

1. A **Web Service** for the Spring Boot API using [`backend/Dockerfile`](./backend/Dockerfile).
2. A **Static Site** for the root React/Vite frontend.
3. An externally hosted MySQL database. Render's filesystem is not a
   replacement for a persistent MySQL server.

### Backend Web Service

Create a Render **Web Service** connected to this repository and configure:

- **Environment:** Docker
- **Root directory:** `backend`
- **Dockerfile path:** `Dockerfile`
- **Docker build context:** `backend` (the selected root directory)
- **Health/check URL:** `/api/cms/public` (after the database is configured)

The Docker image builds with Maven and Java 17, then runs the generated
`campusconnect-backend-1.0.0.jar`. Render's `PORT` variable is used
automatically; the application falls back to port `8080` for local use.

Set these environment variables in the Render dashboard. Use the exact
credentials and connection URL supplied by your external MySQL provider:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DB_URL` | Yes | Full MySQL JDBC URL, including database name and provider options |
| `DB_USERNAME` | Yes | Production MySQL username |
| `DB_PASSWORD` | Yes | Production MySQL password |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters |
| `FRONTEND_URL` | Yes | Deployed frontend origin, for example `https://campusconnect.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed frontend origins |
| `MAIL_USERNAME` | Yes | SMTP account username |
| `MAIL_PASSWORD` | Yes | SMTP password or provider app password |
| `SMTP_HOST` | Yes | SMTP provider hostname |
| `SMTP_PORT` | Yes | Usually `587` for STARTTLS |
| `MAIL_FROM` | Recommended | Sender address accepted by the SMTP provider |
| `ADMIN_EMAIL` | Yes | Initial Super Admin email |
| `ADMIN_PASSWORD` | Yes | Initial Super Admin password |
| `ADMIN_NAME` | No | Initial Super Admin display name |
| `JWT_EXPIRATION_MS` | No | Defaults to `86400000` |
| `SEED_DEMO_DATA` | No | Keep `false` in production |

Do not upload `.env` files to Render or commit them to Git. Add the values
directly as encrypted Render environment variables. `PORT` is supplied by
Render and should not be hardcoded in the dashboard.

### External MySQL setup

Create the `campusconnect` database and apply
[`database/schema.sql`](./database/schema.sql) using your managed MySQL
provider's SQL client before starting the backend. Preserve existing data and
use a backup plus an explicit migration script for future schema changes;
do not use `DROP DATABASE` or destructive Hibernate settings. The application
currently uses `spring.jpa.hibernate.ddl-auto=update`, so it can maintain
compatible existing tables, but the managed database remains the source of
truth and must be backed up before upgrades.

The production `DB_URL` must point to the external host, not
`localhost`. Include the provider's required TLS and public-key options in
that URL. Keep `DB_HOST`, `DB_PORT`, and `DB_NAME` only for local fallback
configuration when `DB_URL` is not supplied.

### Frontend Static Site

Create a Render **Static Site** from the same repository:

- **Root directory:** leave blank
- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`
- **Environment variable:** `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com/api`

Set the backend's `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` to the final
frontend URL before testing login, registration, email verification, password
reset, and role-protected workflows. SMTP links also use `FRONTEND_URL`, so
the value must be the public frontend origin rather than a local URL.

### Render deployment checklist

- Configure the external MySQL database and import the existing schema.
- Add all required backend environment variables in the Render dashboard.
- Deploy the backend and confirm `/api/cms/public` responds successfully.
- Set `VITE_API_BASE_URL` on the Static Site and redeploy it after changing it.
- Update CORS and frontend URL values if Render assigns a different domain.
- Configure SMTP sender permissions and test both verification and reset emails.
- Use Render logs and database-provider logs for failures; never log secrets.

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
