# Security Policy 🛡️

This repository is an early open-source version of Health OS and is **no longer actively developed**. It does not receive security updates. If you run it yourself, you are responsible for keeping it and its dependencies up to date.

---

## 📋 Supported Versions

| Version | Supported |
| :--- | :--- |
| Any version in this repository | ❌ Not maintained |

---

## 🚨 Reporting a Vulnerability

Please **don't** create a public GitHub issue for a security problem. Email **`adityath2305@gmail.com`** with a description, steps to reproduce, and the likely impact. Reports are read, but because this repository is no longer maintained, a fix may not be published here.

---

## 🔒 Security Architecture & Defensive Engineering

Health OS implements defense-in-depth security principles across all API routes, database integrations, and client components:

### 1. Sessions & Data Isolation
- Users sign in with a single-use emailed code. A successful login sets an HTTP-only, signed, `SameSite=Lax` session cookie.
- API routes take identity only from the session and filter every timeline lookup by the signed-in user. Integration tests in `src/__tests__/apiIntegration.test.ts` verify this against a real MongoDB instance.
- Login codes are stored as HMAC hashes, expire after 5 minutes, and lock after 5 wrong guesses. Sending is rate limited.

### 2. NoSQL Injection Prevention
- Identifiers from request bodies must be strings of the expected format, so objects containing MongoDB operators (`$ne`, `$gt`) are rejected before reaching a query.

### 3. Input Validation
- Profile values, timeline payloads, image sizes and types, and text lengths are validated in `src/lib/validation.ts`.
- AI output is treated as untrusted: coach replies are limited to a fixed set of actions and written through the same validated routes as user input.

### 4. XSS Mitigation
- User and AI text is rendered through React, which escapes it. The app does not use `dangerouslySetInnerHTML`.

### 5. Zero Secrets in Client Bundles
- Sensitive values (`AUTH_SECRET`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MONGODB_URI`) are strictly server-side environment variables (`process.env`) and are **never** prefixed with `NEXT_PUBLIC_`.
- All AI vision analysis and coaching prompts execute exclusively in serverless API routes (`/api/vision`, `/api/coach`, `/api/diet/generate`).

---

## ⚙️ Automated Checks

**GitHub Actions CI (`.github/workflows/ci.yml`)** runs ESLint, TypeScript strict validation, the test suite, and a production build on every push and pull request to `main`.
