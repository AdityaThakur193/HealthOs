# Contributing to Health OS 🟢

Thank you for your interest in contributing to **Health OS**! We welcome open-source contributions from developers, designers, data scientists, and nutrition enthusiasts.

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our commitment to maintaining a welcoming, respectful, and inclusive community for everyone.

---

## 🛠️ Getting Started

### 1. Fork and Clone the Repository
```bash
git clone https://github.com/YOUR-USERNAME/HealthOs.git
cd HealthOs
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy the template environment file and fill in your development keys:
```bash
cp .env.local.example .env.local
```

Required keys:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/healthos
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌿 Branch Naming Conventions

Always create a new feature branch for your work using these prefixes:

- `feat/feature-name` — New feature or major enhancement
- `fix/bug-name` — Bug fix or error resolution
- `docs/doc-name` — Documentation update or clarification
- `test/test-name` — Adding or updating test suites
- `refactor/refactor-name` — Code restructuring without feature change

Example:
```bash
git checkout -b feat/macro-chart-zoom
```

---

## 📝 Commit Message Guidelines

We strictly enforce **Conventional Commits** to keep the project history clean and readable:

| Prefix | Description | Example |
| :--- | :--- | :--- |
| `feat:` | A new feature | `feat: add protein target adjustment slider` |
| `fix:` | A bug fix | `fix: resolve hanging promise in SW registration` |
| `docs:` | Documentation changes | `docs: update ARCHITECTURE.md with TDEE flow` |
| `test:` | Adding or updating tests | `test: add Vitest suite for IFCT portion math` |
| `refactor:` | Code changes that neither fix bugs nor add features | `refactor: extract portion calculation into ifctData.ts` |
| `style:` | Formatting changes (white-space, semi-colons) | `style: format tailwind utility classes` |

---

## 🧪 Testing & Verification Requirements

Before submitting a Pull Request, you **MUST** ensure that all tests pass and that there are no TypeScript or build errors:

```bash
# 1. Run Type Check
npm run type-check

# 2. Run Automated Vitest Test Suite
npm test

# 3. Verify Production Build
npm run build
```

---

## 📥 Submitting a Pull Request (PR)

1. Push your branch to your forked repository:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against the `main` branch of `AdityaThakur193/HealthOs`.
3. Complete the PR template checklist.
4. Ensure all automated GitHub Actions CI status checks pass.

Thank you for helping build the future of automated personal health operating systems! 🚀
