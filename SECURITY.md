# Security Policy 🛡️

The Health OS maintainers take system security, data privacy, and vulnerability management seriously. We are committed to protecting user health data and ensuring our open-source software adheres to elite security standards.

---

## 📋 Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported |
| :--- | :--- |
| `1.0.x` | ✅ Supported |
| `< 1.0.0` | ❌ End of Life |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability in **Health OS**, please **DO NOT** create a public GitHub issue. Instead, report it privately following our Responsible Disclosure policy.

### Disclosure Process
1. Email your vulnerability report to **`adityath2305@gmail.com`**.
2. Include a detailed description of the vulnerability, proof-of-concept steps, and potential impact.
3. Our team will acknowledge receipt of your report within **24 hours** and provide an estimated fix timeline.
4. Once a fix is validated and released, we will publicly credit your contribution (unless you request anonymity).

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
