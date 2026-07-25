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

### 1. NoSQL Injection Prevention
- All user inputs passed to MongoDB query objects (`TimelineEvent.find()`, `UserProfile.findOne()`) are sanitized to reject MongoDB query operators (`$ne`, `$gt`, `$where`, `$expr`).
- Validated via automated unit tests in `src/__tests__/security.test.ts`.

### 2. Strict Input & Identifier Validation
- **Hex ObjectId Validation**: User IDs and event IDs are strictly validated against a 24-character hexadecimal regex (`/^[0-9a-fA-F]{24}$/`). Non-conforming IDs are safely rejected or coerced before reaching the database driver.
- **Email Regex Validation**: User email inputs are validated using the official RFC 5322 standard regex before profile creation.

### 3. XSS & HTML Injection Mitigation
- All user-generated text inputs (meal notes, coach chat messages, custom diet preferences) are stripped of executable `<script>` tags and sanitized with HTML entity escaping (`&lt;`, `&gt;`, `&quot;`) prior to state storage and DOM rendering.

### 4. Zero Secrets in Client Bundles
- Sensitive API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `MONGODB_URI`) are strictly server-side environment variables (`process.env`) and are **never** prefixed with `NEXT_PUBLIC_`.
- All AI vision analysis and coaching prompts execute exclusively in serverless API routes (`/api/vision`, `/api/coach`, `/api/diet/generate`).

---

## ⚙️ OpenSSF & Automated Security Workflows

Our GitHub repository runs automated continuous security scans on every pull request:
- **Dependabot**: Scans package dependencies weekly for known CVE vulnerabilities and opens automated security PRs.
- **GitHub Actions CI (`.github/workflows/ci.yml`)**: Runs TypeScript strict type validation and security unit test suites on every push.
