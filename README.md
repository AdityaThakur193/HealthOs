<div align="center">

# 🟢 Health OS

### *The World's Most Intelligent Personal Health Operating System*

[![CI Build](https://github.com/AdityaThakur193/HealthOs/actions/workflows/ci.yml/badge.svg)](https://github.com/AdityaThakur193/HealthOs/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest Passed](https://img.shields.io/badge/Vitest-35%20Tests%20Passed-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas%20v8.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<p align="center">
  Reversing the health tracking paradigm from a manual logging diary into an <b>automated, adaptive decision engine</b>.
</p>

[Explore Features](#-core-architectural-pillars) • [Visual Showcase](#-visual-feature-showcase) • [Architecture Specs](ARCHITECTURE.md) • [API Documentation](API.md) • [Getting Started](#-quickstart--setup) • [Contributing](CONTRIBUTING.md)

</div>

---

## 🎨 Visual Feature Showcase

| Feature Module | Visual Interface | Description & Engine Impact |
| :--- | :---: | :--- |
| **Main Dashboard HUD** | ![Dashboard HUD](public/images/dashboard.png) | **Glassmorphic Command Center**: Displays real-time macro progression rings, 14-day adaptive TDEE expenditure, water/steps logging, and AI health coach insights. |
| **AI Vision & IFCT 2017 Portion Engine** | ![AI Vision Meal Capture](public/images/meal_capture.png) | **Deterministic Food Recognition**: Detects dish items via Gemini 2.5 Flash, cross-references official ICMR-NIN IFCT 2017 portion data, and offers interactive `-` / `+` portion quantity sliders. |
| **Progressive Overload Workout Tracker** | ![Workout Tracker HUD](public/images/workout_hud.jpg) | **Evidence-Based Gym Engine**: Supports 3 to 6-day splits, auto-calculates load progression (+2.5kg compound / +2.0kg isolation), and embeds exercise form video demos directly inside exercise cards. |
| **Autonomous AI Coach Assistant** | ![AI Coach Chat Assistant](public/images/coach_ai.jpg) | **Action-First Conversational Agent**: Directly reads and writes to the unified database timeline (logging meals, steps, water, sleep, weight) via natural language chat. |
| **Habit Tracker & Streak Analytics** | ![Habit Tracker HUD](public/images/habit_tracker.jpg) | **Daily Discipline & Habit Formation**: Tracks daily health habits, calculates streak streaks (🔥), and integrates with AI Coach for zero-friction habit check-ins. |

---

## 🚀 System Architecture Overview

Health OS decouples raw data collection from decision intelligence. All user actions (meal captures, workout completions, weight check-ins, sleep logs, habit check-ins) write to a unified, immutable **Health Timeline**. Downstream analytics engines process this timeline to adapt metabolic expenditure, fine-tune workout progressive overload, and audit nutritional intake.

```mermaid
graph TD
    %% User Action Layer
    User([👤 User Lives Life]) -->|Vision Capture| VisionAPI["/api/vision"]
    User -->|Weight Check-in| TimelineAPI["/api/timeline"]
    User -->|Workout Set| WorkoutEngine["Workout Engine"]
    User -->|Habit Checkin| HabitsAPI["/api/habits"]

    %% Vision Pipeline
    VisionAPI -->|1. Candidate Detection| GeminiVision["Gemini 2.5 Flash"]
    VisionAPI -->|2. Deterministic Macro Lookup| IFCTDB[("ICMR-NIN IFCT 2017 DB")]
    IFCTDB -->|3. Accurate Portion Math| QuantityUI["Interactive Quantity Sliders"]

    %% Timeline & Database Layer
    QuantityUI -->|Save Event| HealthTimeline[("Chronological Health Timeline")]
    TimelineAPI -->|Save Weight| HealthTimeline
    WorkoutEngine -->|Save Exercise Log| HealthTimeline
    HabitsAPI -->|Save Habit Event| HealthTimeline
    HealthTimeline -->|Mongoose Serverless Pool| MongoDB[("MongoDB Atlas")]

    %% Adaptive Decision Engine
    HealthTimeline -->|14-Day Linear Regression| AdaptiveTDEE["Adaptive TDEE Engine"]
    AdaptiveTDEE -->|Recalibrate Calories| ProfileState["UserProfile State"]
    ProfileState -->|Grounded MPS Prompt| DietEngine["Grounded Diet Generator"]
    DietEngine -->|Deterministic Math Audit| HUDDashboard["Premium Glassmorphic HUD"]
```

---

## ⚡ Core Architectural Pillars

### 1. 14-Day Adaptive TDEE Expenditure Engine (MacroFactor Paradigm)
- **Problem**: Static BMR formulas (Harris-Benedict, Mifflin-St Jeor) ignore metabolic adaptation, NEAT variance, and sodium water retention.
- **Engine Solution** (`src/lib/tdee.ts`): Computes a 14-day rolling window linear regression of daily weight change vs average caloric intake.
- **Math Integrity**: Features water weight spike clamping (clamping max daily TDEE shift to ±200 kcal/day) and boundary safety limits `[1,200 kcal, 4,500 kcal]`.

### 2. 4-Stage Perfect Vision & ICMR-NIN IFCT 2017 Portion Engine
- **Problem**: Standard LLM vision APIs output text token-by-token and hallucinate macro math (e.g. claiming thin mess dal has 20g protein).
- **Engine Solution** (`src/lib/ifctData.ts` & `src/lib/gemini.ts`):
  1. **Visual Contract**: AI vision detects dish names and unit counts without guessing raw calories.
  2. **IFCT 2017 Database**: Post-processes dish detections against official **ICMR-NIN IFCT 2017** benchmarks (Rotis, Thin Mess Dal, Rice, Curd, Paneer, Whey, Eggs).
  3. **Interactive Quantity Sliders**: Replaces vague `Small/Medium/Large` buttons with real-time `-` / `+` portion controls (`1 Katori`, `2 Pieces`, `1 Scoop`).
  4. **Self-Learning Memory**: Adapts to individual hostel mess portion sizes over time.

### 3. Grounded AI Diet Generator with MPS Leucine Protein Spacing
- **Engine Solution** (`src/lib/dietEngine.ts` & `/api/diet/generate`):
  - Pre-calculates 4-meal Muscle Protein Synthesis (MPS) leucine protein distribution (25% Breakfast / 30% Lunch / 15% Evening Snack / 30% Dinner).
  - Calculates exact required additions (Whey Protein, Egg Whites, Boiled Eggs, Paneer, Curd, Chicken Breast) based on user preference (`veg`, `eggetarian`, `non_veg`).
  - Executes `auditAndFixDietPlanMath` to re-sum meal items in TypeScript and override any LLM arithmetic errors (**0% error rate**).

### 4. Evidence-Based Gym Engine & Progressive Overload
- **Engine Solution** (`src/lib/workoutPlans.ts`):
  - Supports 3-day, 4-day, 5-day, and 6-day training splits.
  - Implements double progression logic: automatically calculates target weight increases (+2.5kg for compound / +2.0kg for isolation) when top rep targets are hit.
  - Curated YouTube exercise video timestamp links embedded directly into exercise cards.

### 5. Habit Tracker & Daily Discipline Engine
- **Engine Solution** (`src/lib/habitEngine.ts` & `/api/habits`):
  - Tracks daily health habits (hydration, sleep targets, prayer/meditation, physical activity).
  - Calculates active streaks (🔥) and completion percentages.
  - Fully integrated with Coach AI so users can check off habits via natural voice/text commands.

---

## 📦 Quickstart & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Atlas instance or local MongoDB server

### 1. Clone & Install
```bash
git clone https://github.com/AdityaThakur193/HealthOs.git
cd HealthOs
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory (refer to `.env.local.example`):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/healthos
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

### 4. Run Automated Test Suite
```bash
# Run TypeScript Strict Validation
npm run type-check

# Run Vitest Test Suite (35 Unit & Security Tests)
npm test
```

### 5. Build for Production
```bash
npm run build
npm run start
```

---

## 📂 Repository Layout Map

```
HealthOs/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                # GitHub Actions CI Workflow (Lint, Type-Check, Test, Build)
│   ├── PULL_REQUEST_TEMPLATE.md  # Standard Pull Request Submission Template
│   └── ISSUE_TEMPLATE/           # Bug Report & Feature Request Issue Templates
├── public/
│   ├── images/                   # High-Fidelity UI Interface Showcase Mockups
│   └── sw.js                     # Static Assets & PWA Service Worker
├── src/
│   ├── app/                      # Next.js 16 App Router Pages & REST API Routes
│   │   ├── api/                  # Serverless API Endpoints (/vision, /diet, /timeline, /habits, etc.)
│   │   ├── meal/                 # AI Vision Meal Capture Page
│   │   ├── workout/              # Progressive Overload Workout HUD Page
│   │   ├── habits/               # Habit Tracker & Streak Dashboard Page
│   │   ├── review/               # Sunday Weekly Review Page
│   │   └── page.tsx              # Main Glassmorphic Dashboard HUD
│   ├── components/               # Reusable Glassmorphic UI Components
│   ├── hooks/                    # Custom React Hooks (useConfirmDialog, useAuthGuard, etc.)
│   ├── lib/                      # Core Engineering Algorithms
│   │   ├── tdee.ts               # 14-Day Adaptive TDEE Expenditure Engine
│   │   ├── ifctData.ts           # ICMR-NIN IFCT 2017 Indian Food Database
│   │   ├── dietEngine.ts         # Grounded AI Diet Allocation & Math Audit Engine
│   │   ├── workoutPlans.ts       # Workout Split & Progressive Overload Engine
│   │   ├── habitEngine.ts         # Habit Tracker & Streak Analytics Engine
│   │   ├── gemini.ts             # Gemini 2.5 Flash Vision Integration
│   │   └── mongodb.ts            # Serverless Mongoose Connection Pool Cache
│   └── __tests__/                # Vitest Test Suites (35 Tests Passed)
├── ARCHITECTURE.md               # Technical Deep-Dive & Mermaid Flow Diagrams
├── API.md                        # Complete REST API Specifications
├── CONTRIBUTING.md               # Developer Contribution & Branch/Commit Standards
├── SECURITY.md                   # Vulnerability Reporting SLA & Security Specs
├── CHANGELOG.md                  # Release Version History
├── LICENSE                       # Official MIT License
└── package.json                  # Dependencies & npm Scripts
```

---

## 🧪 Automated Testing & Quality Audit

Health OS maintains an automated **Vitest** test suite covering 35 unit, integration, and security edge cases:

```
 RUN  v4.1.10 D:/HealthApp

 ✓ src/__tests__/security.test.ts (8 tests)
 ✓ src/__tests__/apiValidation.test.ts (4 tests)
 ✓ src/__tests__/tdee.test.ts (6 tests)
 ✓ src/__tests__/workoutPlans.test.ts (4 tests)
 ✓ src/__tests__/habitEngine.test.ts (5 tests)
 ✓ src/__tests__/ifctData.test.ts (4 tests)
 ✓ src/__tests__/dietEngine.test.ts (4 tests)

 Test Files  7 passed (7)
      Tests  35 passed (35)
```

---

## 📄 License & Attribution

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

Designed & Built with ❤️ by [Aditya Thakur](https://github.com/AdityaThakur193).
