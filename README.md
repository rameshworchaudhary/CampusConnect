# CampusConnect — College Club Management System

CampusConnect is a full-stack, enterprise-grade College Club Management System built according to the **Academic Monolith** design specification. The platform provides end-to-end administration for university organizations, student club discovery, member onboarding, event RSVP scheduling, announcements, role management, and landing page content management.

---

## 1. Design System & Strict Aesthetic Rules

* **Palette:** Pure achromatic discipline — Black (`#000000`), Crisp Surface (`#FFFFFF`), Off-White Canvas (`#F9F9F9` / `#F7F7F7`), and Neutral Grays (`#111111`, `#333333`, `#666666`, `#999999`, `#DDDDDD`, `#EEEEEE`). Zero colored accents.
* **Typography:** Inter with uppercase tracking (`0.04em`) for badges and tabular lining figures (`tabular-nums`) for statistical data.
* **Elevation & Borders:** Flat tonal layering with crisp 1px borders (`#DDDDDD`, `#EEEEEE`), 4px border radius for controls/buttons, and 8px for containers/cards.
* **Reference Fidelity:** Recreates the four Stitch references:
  1. **Club Directory / Landing Page** (Hero, stats strip, popular clubs, upcoming events preview, notice banner, footer).
  2. **Approvals Hub / Club Overview** (Club Admin dashboard with metric boxes, request review, event capacity bars, activity logs).
  3. **Student Dashboard** (Student portal with joined clubs, pending requests tracker, registered events, announcements).
  4. **Super Admin Platform Management** (Platform metrics, operational scope navigation, registered clubs status ledger, role management quick action, and immutable audit logs).

---

## 2. Technology Stack

* **Frontend:**
  * React 18 + Vite + TypeScript
  * Tailwind CSS (Academic Monolith tokens)
  * React Router v7
  * Axios (with centralized JWT interceptor)
  * Google Material Symbols & Lucide Icons
* **Backend:**
  * Java 17
  * Spring Boot 3.2.5
  * Spring Security 6 (Stateless JWT authentication & method security)
  * Spring Data JPA / Hibernate
  * Bean Validation (Jakarta Validation)
  * Apache Maven 3.9+
* **Database & Services:**
  * MySQL 8.0+
  * JavaMailSender (SMTP-based verification and password reset)

---

## 3. Project Structure

```
d:\Full Stack-II\CapStone Project
├── backend/                       # Spring Boot REST API
│   ├── pom.xml
│   ├── src/main/java/com/campusconnect/
│   │   ├── CampusConnectApplication.java
│   │   ├── config/                # Security, CORS, Exception Handling, SeedData
│   │   ├── controller/            # REST Controllers (Auth, Users, Clubs, Events, CMS, etc.)
│   │   ├── dto/                   # Request & Response Data Transfer Objects
│   │   ├── entity/                # JPA Entities (User, Club, Event, Membership, etc.)
│   │   ├── repository/            # Spring Data JPA Repositories
│   │   ├── security/              # UserPrincipal, JwtTokenProvider, JwtFilter
│   │   └── service/               # Business Logic, RBAC & Ownership validation
│   ├── src/main/resources/
│   │   └── application.properties # Spring configuration with environment variable fallbacks
│   └── src/test/java/             # Comprehensive security and RBAC unit tests
├── frontend/                      # React Vite TypeScript frontend
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js         # Academic Monolith configuration
│   ├── src/
│   │   ├── api/client.ts          # Centralized Axios client with Bearer token injection
│   │   ├── context/AuthContext.tsx# Reactive authentication and role management state
│   │   ├── components/            # Header, BottomNav, Modal, Toast
│   │   ├── pages/                 # LandingPage, StudentDashboard, ClubAdminDashboard, SuperAdminDashboard, Auth
│   │   └── types/index.ts         # Strongly-typed TypeScript interfaces
├── database/
│   └── schema.sql                 # MySQL Schema DDL definition
├── .env.example                   # Safe backend/.env configuration template
└── README.md                      # Comprehensive execution and operational manual
```

---

## 4. Prerequisites

1. **Java JDK 17 or higher** (`java -version`)
2. **Apache Maven 3.8+** (`mvn -version`)
3. **Node.js 18+ and npm 9+** (`node -v` and `npm -v`)
4. **MySQL Server 8.0+** running on port 3306

---

## 5. Database Setup

1. Open your terminal or MySQL command-line client:
   ```sql
   CREATE DATABASE IF NOT EXISTS campusconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. The backend uses the existing JPA entities with `spring.jpa.hibernate.ddl-auto=update`; it does not drop or recreate existing tables. Set the database variables in `backend/.env`:
   ```properties
   DB_URL=jdbc:mysql://localhost:3306/campusconnect
   DB_USERNAME=root
   DB_PASSWORD=your_mysql_password
   ```

---

## 6. Environment Configuration

Copy `.env.example` to `backend/.env` and replace placeholders locally. Spring Boot is configured to import this file using its native `file:./.env[.properties]` config import when started from `backend`; no dotenv library or PowerShell secret setup is required. OS environment variables still take precedence over the file.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_URL` | Full MySQL JDBC URL | `jdbc:mysql://localhost:3306/campusconnect` |
| `DB_HOST` | MySQL hostname | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `campusconnect` |
| `DB_USERNAME` | Database username | `root` |
| `DB_PASSWORD` | Database password | required |
| `JWT_SECRET` | Random signing secret (minimum 32 characters) | required |
| `FRONTEND_URL` | Frontend client URL | `http://localhost:5173` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `MAIL_USERNAME`| Gmail sender address | required for email |
| `MAIL_PASSWORD`| Gmail App Password, not the normal account password | required for email |
| `MAIL_FROM` | From address, normally the Gmail sender | `MAIL_USERNAME` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins | `http://localhost:5173` |
| `ADMIN_EMAIL` | Bootstrap Super Admin email | `admin@univ.edu` |
| `ADMIN_PASSWORD`| Bootstrap Super Admin password | required on first bootstrap |

> **Gmail setup:** Enable 2-Step Verification on the sender account, create a Gmail App Password, and set it as `MAIL_PASSWORD`. CampusConnect never prints verification or reset tokens to logs or API responses. Registration and password-reset requests fail clearly until both mail credentials are configured.

### Windows PowerShell environment setup

The application loads `backend/.env` automatically when started from the backend directory. For a first-time setup:

```powershell
Copy-Item ..\.env.example .env
# Edit .env with a local editor; do not commit it.
```

`backend/.env` must contain the real local values for `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM`. `MAIL_PASSWORD` must be a Gmail App Password, not the normal Gmail account password. The file is ignored by Git. `backend/application-local.properties` remains supported as an alternative local override.

---

## 7. Running the Application

### 7.1 Backend (Spring Boot)

Open a terminal in the root directory:

```powershell
Set-Location .\backend
mvn spring-boot:run
```

* The REST API will be available at: `http://localhost:8080/api`
* On first startup, `SeedDataConfig` bootstraps the configured Super Admin. Demo data seeding is disabled by default (`SEED_DEMO_DATA=false`).

### 7.2 Frontend (React Vite)

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

* Open your browser and navigate to: `http://localhost:5173`

### 7.3 Database creation command

Run this once in MySQL if the database does not already exist:

```sql
CREATE DATABASE IF NOT EXISTS campusconnect
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Do not run destructive commands such as `DROP DATABASE`, `DROP TABLE`, or `create-drop` against an existing installation.

---

## 8. Authentication email flows

- Registration always creates a `STUDENT`, stores a BCrypt password hash, creates a 24-hour single-use verification token, and emails the frontend verification URL.
- Forgot-password always returns the same response whether the address exists. Existing accounts receive a one-hour reset link.
- Verification and reset tokens are generated with `SecureRandom` and stored as SHA-256 hashes; raw tokens are only present in the email link.
- Reset tokens are invalidated after use. Unverified accounts cannot log in.

To test these flows, configure the PowerShell variables above, start the backend, register a new account at `/register`, and use the link received in Gmail. Do not use a development token or backend log token.

---

## 9. Testing & Security Verification

Execute the backend unit and security test suite:

```powershell
cd backend
mvn test
```

### Verified Security Controls:
1. **Public Registration Role Isolation:** Public registration requests can only provision the `STUDENT` role. Role elevation requires super admin authentication.
2. **Email Verification Requirement:** Accounts with `isVerified = false` are blocked from logging in.
3. **Club Admin Isolation:** Club Admins can manage only their assigned club. Attempts to access or modify other clubs result in `403 Forbidden` (`AccessDeniedException`).
4. **Last Active Super Admin Protection:** The system prevents accidental demotion or deactivation of the last remaining active `SUPER_ADMIN`.
5. **Event Capacity Atomicity:** Event registrations enforce strict capacity checks; registration fails when the event reaches capacity.
6. **Immutable Audit Trail:** All administrative operations (role changes, club admin assignments, event publishing, CMS edits) write an SHA-256 hashed audit log record with the actor's IP address.
